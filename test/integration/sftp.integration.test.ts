import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { HostKeyManager } from '../../src/config/host-key-manager';
import { SecureStorage } from '../../src/config/secure-storage';
import { SFTPClient } from '../../src/core/sftp-client';
import { SSHManager } from '../../src/core/ssh-manager';
import { SFTPConfig } from '../../src/types';

const host = process.env.SFTP_TEST_HOST;
const port = Number(process.env.SFTP_TEST_PORT || 22);
const username = process.env.SFTP_TEST_USER;
const password = process.env.SFTP_TEST_PASS;
const remotePath = process.env.SFTP_TEST_REMOTE_PATH;
const remoteWritePath = process.env.SFTP_TEST_REMOTE_WRITE_PATH;
const privateKeyPath = process.env.SFTP_TEST_PRIVATE_KEY_PATH;
const privateKeyPassphrase = process.env.SFTP_TEST_PRIVATE_KEY_PASSPHRASE;

const hasEnv =
    Boolean(host) && Boolean(username) && Boolean(password) && Boolean(remotePath);

const describeIntegration = hasEnv ? describe : describe.skip;

function createContext() {
    const storage: Record<string, any> = {};
    return {
        globalState: {
            get: (key: string, defaultValue?: unknown) => {
                return key in storage ? storage[key] : defaultValue;
            },
            update: async (key: string, value: unknown) => {
                storage[key] = value;
            },
        },
    } as any;
}

describeIntegration('SFTP Integration', () => {
    const config: SFTPConfig = {
        name: 'Integration',
        host: host!,
        port,
        username: username!,
        remotePath: remotePath!,
        authMethod: 'password',
    };

    test('lists remote directory entries', async () => {
        const context = createContext();
        const hostKeyManager = new HostKeyManager(context);
        hostKeyManager.promptUserForNewHost = async (h, p, k, key) => {
            await hostKeyManager.addHostKey(h, p, k, key);
            return true;
        };
        const secureStorage = new SecureStorage({
            store: async () => undefined,
            get: async () => JSON.stringify({ password }),
            delete: async () => undefined,
        } as any);

        const manager = new SSHManager(secureStorage, hostKeyManager);
        const client = await manager.connect(config);
        const sftp = new SFTPClient(client, config.remotePath);

        const entries = await sftp.listDirectory('.');
        expect(Array.isArray(entries)).toBe(true);

        await manager.disconnectByConfig(config);
    });

    test('reconnects after disconnect', async () => {
        const context = createContext();
        const hostKeyManager = new HostKeyManager(context);
        hostKeyManager.promptUserForNewHost = async (h, p, k, key) => {
            await hostKeyManager.addHostKey(h, p, k, key);
            return true;
        };
        const secureStorage = new SecureStorage({
            store: async () => undefined,
            get: async () => JSON.stringify({ password }),
            delete: async () => undefined,
        } as any);

        const manager = new SSHManager(secureStorage, hostKeyManager);
        const client = await manager.connect(config);
        const sftp = new SFTPClient(client, config.remotePath);
        await sftp.listDirectory('.');
        await manager.disconnectByConfig(config);

        const client2 = await manager.connect(config);
        const sftp2 = new SFTPClient(client2, config.remotePath);
        await sftp2.listDirectory('.');
        await manager.disconnectByConfig(config);
    });

    test('connects with private key when configured', async () => {
        if (!privateKeyPath) {
            return;
        }

        const context = createContext();
        const hostKeyManager = new HostKeyManager(context);
        hostKeyManager.promptUserForNewHost = async (h, p, k, key) => {
            await hostKeyManager.addHostKey(h, p, k, key);
            return true;
        };
        const secureStorage = new SecureStorage({
            store: async () => undefined,
            get: async () =>
                JSON.stringify({ passphrase: privateKeyPassphrase || undefined }),
            delete: async () => undefined,
        } as any);

        const manager = new SSHManager(secureStorage, hostKeyManager);
        const keyConfig: SFTPConfig = {
            ...config,
            authMethod: 'privateKey',
            privateKeyPath,
        };

        const client = await manager.connect(keyConfig);
        const sftp = new SFTPClient(client, keyConfig.remotePath);
        const entries = await sftp.listDirectory('.');
        expect(Array.isArray(entries)).toBe(true);
        await manager.disconnectByConfig(keyConfig);
    });

    test('uploads and downloads a file when write path is provided', async () => {
        if (!remoteWritePath) {
            return;
        }

        const context = createContext();
        const hostKeyManager = new HostKeyManager(context);
        hostKeyManager.promptUserForNewHost = async (h, p, k, key) => {
            await hostKeyManager.addHostKey(h, p, k, key);
            return true;
        };
        const secureStorage = new SecureStorage({
            store: async () => undefined,
            get: async () => JSON.stringify({ password }),
            delete: async () => undefined,
        } as any);

        const manager = new SSHManager(secureStorage, hostKeyManager);
        const client = await manager.connect(config);
        const sftp = new SFTPClient(client, remoteWritePath);

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sftp-integration-'));
        const localPath = path.join(tempDir, 'upload.txt');
        const downloadPath = path.join(tempDir, 'download.txt');
        const contents = `hello-${Date.now()}`;
        await fs.writeFile(localPath, contents, 'utf8');

        await sftp.upload(localPath, 'upload.txt');
        await sftp.download('upload.txt', downloadPath);

        const downloaded = await fs.readFile(downloadPath, 'utf8');
        expect(downloaded).toBe(contents);

        await manager.disconnectByConfig(config);
    });
});
