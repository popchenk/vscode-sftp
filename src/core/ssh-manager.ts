import * as fs from 'fs/promises';
import { Client, ConnectConfig, utils as sshUtils } from 'ssh2';
import { HostKeyManager } from '../config/host-key-manager';
import { SecureStorage } from '../config/secure-storage';
import { getSecureSSHConfig } from '../config/ssh-config';
import { clearBuffer, clearString } from '../utils/crypto-utils';
import { getLogger } from '../utils/logger';
import { validateSSHConfig } from '../utils/validators';
import { Credentials, SFTPConfig } from '../types';

interface HostKeyCheckResult {
    key: Buffer;
    keyType: string;
    hash: string;
    known: boolean;
    changed: boolean;
}

export class SSHManager {
    private connections = new Map<string, Client>();
    private logger = getLogger();

    constructor(
        private readonly secureStorage: SecureStorage,
        private readonly hostKeyManager: HostKeyManager
    ) {}

    getConnectionId(config: SFTPConfig): string {
        return `${config.username}@${config.host}:${config.port}`;
    }

    async connect(
        config: SFTPConfig,
        options: { allowLocalhost?: boolean } = {}
    ): Promise<Client> {
        const connectionId = this.getConnectionId(config);
        const existing = this.connections.get(connectionId);
        if (existing) {
            return existing;
        }

        const sshConfig = getSecureSSHConfig({
            host: config.host,
            port: config.port,
            username: config.username,
            algorithms: config.algorithms,
            strictHostKeyChecking: config.strictHostKeyChecking,
        });
        validateSSHConfig(sshConfig, { allowLocalhost: options.allowLocalhost });

        const credentials = await this.secureStorage.getCredentials(config.host, config.username);
        const connectConfig = await this.buildConnectConfig(config, sshConfig, credentials);

        const hostKeyCheckRef: { current: HostKeyCheckResult | null } = { current: null };
        const knownHosts = await this.hostKeyManager.getKnownHostsSnapshot();
        const strictHostKeyChecking = true;

        connectConfig.hostVerifier = (key: Buffer): boolean => {
            const parsed = sshUtils.parseKey(key);
            if (parsed instanceof Error) {
                this.logger.warn('Failed to parse host key during verification');
                hostKeyCheckRef.current = {
                    key,
                    keyType: 'unknown',
                    hash: '',
                    known: false,
                    changed: true,
                };
                return false;
            }

            const keyType = parsed.type;
            const hash = this.hostKeyManager.getHostKeyHash(config.host, config.port, keyType, key);
            const known = knownHosts.has(hash);
            const existing = Array.from(knownHosts.values()).find(
                (info) => info.host === config.host && info.port === config.port
            );

            hostKeyCheckRef.current = {
                key,
                keyType,
                hash,
                known,
                changed: Boolean(existing) && !known,
            };

            if (known) {
                return true;
            }

            return false;
        };

        const client = new Client();

        try {
            await this.awaitReady(client, connectConfig);
        } catch (error) {
            client.destroy();

            const hostKeyCheck = hostKeyCheckRef.current;

            if (hostKeyCheck?.changed) {
                throw new Error('Host key mismatch detected. Connection aborted.');
            }

            if (hostKeyCheck && !hostKeyCheck.known && strictHostKeyChecking) {
                const accepted = await this.hostKeyManager.promptUserForNewHost(
                    config.host,
                    config.port,
                    hostKeyCheck.keyType,
                    hostKeyCheck.key
                );
                if (accepted) {
                    return this.connect(config, options);
                }
            }

            throw error;
        } finally {
            this.clearConnectSecrets(connectConfig);
            if (credentials) {
                this.secureStorage.clearCredentials(credentials);
            }
        }

        this.connections.set(connectionId, client);
        client.on('close', () => {
            this.connections.delete(connectionId);
        });

        return client;
    }

    async disconnect(connectionId: string): Promise<void> {
        const client = this.connections.get(connectionId);
        if (!client) {
            return;
        }

        client.end();
        this.connections.delete(connectionId);
    }

    async disconnectAll(): Promise<void> {
        const pending = Array.from(this.connections.values()).map((client) => {
            client.end();
        });

        await Promise.all(pending);
        this.connections.clear();
    }

    async disconnectByConfig(config: SFTPConfig): Promise<void> {
        await this.disconnect(this.getConnectionId(config));
    }

    private async buildConnectConfig(
        config: SFTPConfig,
        sshConfig: ReturnType<typeof getSecureSSHConfig>,
        credentials?: Credentials
    ): Promise<ConnectConfig> {
        const connectConfig: ConnectConfig = {
            host: sshConfig.host,
            port: sshConfig.port,
            username: sshConfig.username,
            algorithms: sshConfig.algorithms as ConnectConfig['algorithms'],
            readyTimeout: sshConfig.readyTimeout,
            keepaliveInterval: sshConfig.keepaliveInterval,
        };

        switch (config.authMethod) {
            case 'password': {
                const password = credentials?.password;
                if (!password) {
                    throw new Error('No stored password found for this host');
                }
                connectConfig.password = password;
                break;
            }
            case 'privateKey': {
                const { privateKey, passphrase } = await this.resolvePrivateKey(config, credentials);
                connectConfig.privateKey = privateKey;
                if (passphrase) {
                    connectConfig.passphrase = passphrase;
                }
                break;
            }
            case 'agent': {
                const agentSock = process.env.SSH_AUTH_SOCK;
                if (!agentSock) {
                    throw new Error('SSH agent not available (SSH_AUTH_SOCK not set)');
                }
                connectConfig.agent = agentSock;
                break;
            }
            default:
                throw new Error(`Unsupported auth method: ${config.authMethod}`);
        }

        return connectConfig;
    }

    private async resolvePrivateKey(
        config: SFTPConfig,
        credentials?: Credentials
    ): Promise<{ privateKey: string; passphrase?: string }> {
        if (config.privateKeyPath) {
            const keyData = await fs.readFile(config.privateKeyPath, 'utf8');
            const passphrase = credentials?.passphrase;
            return { privateKey: keyData, passphrase };
        }

        if (credentials?.privateKey) {
            return { privateKey: credentials.privateKey, passphrase: credentials.passphrase };
        }

        throw new Error('Private key not found for this configuration');
    }

    private awaitReady(client: Client, connectConfig: ConnectConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            const onReady = (): void => {
                cleanup();
                resolve();
            };

            const onError = (error: Error): void => {
                cleanup();
                reject(error);
            };

            const onClose = (): void => {
                cleanup();
                reject(new Error('Connection closed before ready'));
            };

            const cleanup = (): void => {
                client.off('ready', onReady);
                client.off('error', onError);
                client.off('close', onClose);
            };

            client.once('ready', onReady);
            client.once('error', onError);
            client.once('close', onClose);

            client.connect(connectConfig);
        });
    }

    private clearConnectSecrets(connectConfig: ConnectConfig): void {
        if (connectConfig.password) {
            connectConfig.password = clearString(connectConfig.password);
        }
        if (connectConfig.passphrase) {
            if (typeof connectConfig.passphrase === 'string') {
                connectConfig.passphrase = clearString(connectConfig.passphrase);
            } else {
                clearBuffer(connectConfig.passphrase);
            }
        }
        if (typeof connectConfig.privateKey === 'string') {
            connectConfig.privateKey = clearString(connectConfig.privateKey);
        } else if (connectConfig.privateKey) {
            clearBuffer(connectConfig.privateKey);
        }
    }
}
