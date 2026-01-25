import * as fs from 'fs/promises';
import type { ConnectConfig } from 'ssh2';
import { HostKeyManager } from '../config/host-key-manager';
import { SecureStorage } from '../config/secure-storage';
import { getSecureSSHConfig } from '../config/ssh-config';
import { clearBuffer, clearString } from '../utils/crypto-utils';
import { getLogger } from '../utils/logger';
import { validateSSHConfig } from '../utils/validators';
import { Credentials, SFTPConfig, HopConfig } from '../types';

interface HostKeyCheckResult {
    key: Buffer;
    keyType: string;
    hash: string;
    known: boolean;
    changed: boolean;
}

interface ActiveConnection {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hopClient?: any;
}

export class SSHManager {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private connections = new Map<string, ActiveConnection>();
    private logger = getLogger();

    constructor(
        private readonly secureStorage: SecureStorage,
        private readonly hostKeyManager: HostKeyManager,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        private readonly ssh2Module?: any
    ) { }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getSSH2Module(): any {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return this.ssh2Module || require('ssh2');
    }

    getConnectionId(config: SFTPConfig): string {
        const baseId = `${config.username}@${config.host}:${config.port}`;
        if (config.hop) {
            return `${baseId}+hop(${config.hop.username}@${config.hop.host}:${config.hop.port})`;
        }
        return baseId;
    }

    async connect(
        config: SFTPConfig,
        options: { allowLocalhost?: boolean } = {}
    ): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
        const ssh2 = this.getSSH2Module();
        const Client = ssh2.Client;
        const sshUtils = ssh2.utils;

        const connectionId = this.getConnectionId(config);
        const existing = this.connections.get(connectionId);
        if (existing) {
            return existing.client;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let hopClient: any | undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let stream: any;

        try {
            if (config.hop) {
                this.logger.info(`Connecting to jump host ${config.hop.host}...`);
                hopClient = await this.connectToHop(config.hop, options);

                this.logger.info(`Establishing tunnel to ${config.host}:${config.port}...`);
                stream = await new Promise((resolve, reject) => {
                    hopClient!.forwardOut(
                        '0.0.0.0',
                        0,
                        config.host,
                        config.port,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (err: any, stream: any) => {
                            if (err) {
                                this.logger.error(`ForwardOut failed to ${config.host}:${config.port}: ${err.message}`);
                                reject(err);
                            } else {
                                resolve(stream);
                            }
                        }
                    );
                });
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

            if (stream) {
                // Use the tunnel stream
                connectConfig.sock = stream;
            }

            const hostKeyCheckRef: { current: HostKeyCheckResult | null } = { current: null };
            const knownHosts = await this.hostKeyManager.getKnownHostsSnapshot();
            const strictHostKeyChecking = true; // Still enforced for the final target

            // Note: Host verification of the Jump Host happens inside connectToHop
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
                        // If we had a hop client, we should reuse it instead of reconnecting?
                        // For simplicity, we just recursively call connect. 
                        // But we must close the current incomplete hop stuff first.
                        if (hopClient) hopClient.end();
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

            this.connections.set(connectionId, { client, hopClient });

            client.once('close', () => {
                this.disconnect(connectionId);
            });

            if (hopClient) {
                hopClient.once('close', () => {
                    // If jump host disconnects, the main connection is dead too
                    this.disconnect(connectionId);
                });
            }

            return client;

        } catch (error) {
            if (hopClient) {
                hopClient.end();
            }
            throw error;
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async connectToHop(hop: HopConfig, options: { allowLocalhost?: boolean }): Promise<any> {
        const ssh2 = this.getSSH2Module();
        const Client = ssh2.Client;
        const sshUtils = ssh2.utils;

        // Similar to connect(), but for the jump host
        const sshConfig = getSecureSSHConfig({
            host: hop.host,
            port: hop.port,
            username: hop.username,
            algorithms: hop.algorithms,
            strictHostKeyChecking: true,
        });

        // We might want to allow localhost for hop if testing
        if (options.allowLocalhost && (hop.host === 'localhost' || hop.host === '127.0.0.1')) {
            // Bypass validation failure for localhost if requested
        } else {
            validateSSHConfig(sshConfig, { allowLocalhost: options.allowLocalhost });
        }

        const credentials = await this.secureStorage.getCredentials(hop.host, hop.username);

        // Create a temporary SFTPConfig-like object for buildConnectConfig
        const tempConfig: SFTPConfig = {
            name: 'hop',
            host: hop.host,
            port: hop.port,
            username: hop.username,
            remotePath: '/',
            authMethod: hop.authMethod,
            privateKeyPath: hop.privateKeyPath,
        };

        const connectConfig = await this.buildConnectConfig(tempConfig, sshConfig, credentials);

        // Host Verification for Hop
        const hostKeyCheckRef: { current: HostKeyCheckResult | null } = { current: null };
        const knownHosts = await this.hostKeyManager.getKnownHostsSnapshot();
        const strictHostKeyChecking = true;

        connectConfig.hostVerifier = (key: Buffer): boolean => {
            const parsed = sshUtils.parseKey(key);
            if (parsed instanceof Error) {
                hostKeyCheckRef.current = {
                    key, keyType: 'unknown', hash: '', known: false, changed: true,
                };
                return false;
            }
            const keyType = parsed.type;
            const hash = this.hostKeyManager.getHostKeyHash(hop.host, hop.port, keyType, key);
            const known = knownHosts.has(hash);
            const existing = Array.from(knownHosts.values()).find(
                (info) => info.host === hop.host && info.port === hop.port
            );

            hostKeyCheckRef.current = {
                key, keyType, hash, known, changed: Boolean(existing) && !known,
            };
            return known;
        };

        const client = new Client();

        try {
            await this.awaitReady(client, connectConfig);
            return client;
        } catch (error) {
            client.destroy();

            const hostKeyCheck = hostKeyCheckRef.current;
            if (hostKeyCheck?.changed) {
                throw new Error(`Jump Host ${hop.host} key mismatch.`);
            }

            if (hostKeyCheck && !hostKeyCheck.known && strictHostKeyChecking) {
                const accepted = await this.hostKeyManager.promptUserForNewHost(
                    hop.host,
                    hop.port,
                    hostKeyCheck.keyType,
                    hostKeyCheck.key
                );
                if (accepted) {
                    return this.connectToHop(hop, options);
                }
            }
            throw error;
        } finally {
            this.clearConnectSecrets(connectConfig);
            if (credentials) {
                this.secureStorage.clearCredentials(credentials);
            }
        }
    }

    async disconnect(connectionId: string): Promise<void> {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return;
        }

        conn.client.end();
        if (conn.hopClient) {
            conn.hopClient.end();
        }
        this.connections.delete(connectionId);
    }

    async disconnectAll(): Promise<void> {
        const pending = Array.from(this.connections.values()).map((conn) => {
            conn.client.end();
            if (conn.hopClient) conn.hopClient.end();
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private awaitReady(client: any, connectConfig: ConnectConfig): Promise<void> {
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
