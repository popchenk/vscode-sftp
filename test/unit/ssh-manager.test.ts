import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, test, vi } from 'vitest';
import { SSHManager } from '../../src/core/ssh-manager';
import { SFTPConfig } from '../../src/types';
import { hashHostKey } from '../../src/utils/crypto-utils';

const { EventEmitter } = require('events');

class MockClient extends EventEmitter {
    connect(config: any) {
        const key = Buffer.from('host-key');
        const ok = config.hostVerifier ? config.hostVerifier(key) : true;
        if (!ok) {
            this.emit('error', new Error('Host verification failed'));
            return;
        }
        this.emit('ready');
    }

    end() {
        this.emit('close');
    }

    destroy() {
        this.emit('close');
    }
}

const mockSSH2 = {
    Client: MockClient,
    utils: {
        parseKey: () => ({ type: 'ssh-ed25519' }),
    },
};

describe('SSHManager', () => {
    test('connects when host key is known', async () => {
        const hostKeyManager = {
            getKnownHostsSnapshot: vi.fn(async () => {
                const info = {
                    host: 'example.com',
                    port: 22,
                    keyType: 'ssh-ed25519',
                    key: Buffer.from('host-key').toString('base64'),
                    fingerprint: 'fp',
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                };
                return new Map([['hash', info]]);
            }),
            getHostKeyHash: vi.fn(() => 'hash'),
            promptUserForNewHost: vi.fn(),
            addHostKey: vi.fn(),
        };
        const secureStorage = {
            getCredentials: vi.fn(async () => ({ password: 'secret' })),
            clearCredentials: vi.fn(),
        };

        const manager = new SSHManager(secureStorage as any, hostKeyManager as any, mockSSH2);

        const config: SFTPConfig = {
            name: 'Test',
            host: 'example.com',
            port: 22,
            username: 'user',
            remotePath: '/remote',
            authMethod: 'password',
        };

        const client = await manager.connect(config);
        expect(client).toBeTruthy();
        await manager.disconnectByConfig(config);
    });

    test('prompts on unknown host key even if config disables strict checking', async () => {
        const hostKeyManager = {
            getKnownHostsSnapshot: vi.fn(async () => new Map()),
            getHostKeyHash: vi.fn(() => 'hash'),
            promptUserForNewHost: vi.fn(async () => false),
            addHostKey: vi.fn(async () => undefined),
        };
        const secureStorage = {
            getCredentials: vi.fn(async () => ({ password: 'secret' })),
            clearCredentials: vi.fn(),
        };

        const manager = new SSHManager(secureStorage as any, hostKeyManager as any, mockSSH2);

        const config: SFTPConfig = {
            name: 'Test',
            host: 'example.com',
            port: 22,
            username: 'user',
            remotePath: '/remote',
            authMethod: 'password',
            strictHostKeyChecking: false,
        };

        await expect(manager.connect(config)).rejects.toThrow();
        expect(hostKeyManager.promptUserForNewHost).toHaveBeenCalled();
    });

    test('prompts and retries when host key is unknown', async () => {
        const knownHosts = new Map<string, any>();
        const hostKeyManager = {
            getKnownHostsSnapshot: vi.fn(async () => new Map(knownHosts)),
            getHostKeyHash: vi.fn((host: string, port: number, keyType: string, key: Buffer) =>
                hashHostKey(host, port, keyType, key)
            ),
            promptUserForNewHost: vi.fn(async (host: string, port: number, keyType: string, key: Buffer) => {
                const hash = hashHostKey(host, port, keyType, key);
                knownHosts.set(hash, {
                    host,
                    port,
                    keyType,
                    key: key.toString('base64'),
                    fingerprint: 'fp',
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                });
                return true;
            }),
            addHostKey: vi.fn(async () => undefined),
        };
        const secureStorage = {
            getCredentials: vi.fn(async () => ({ password: 'secret' })),
            clearCredentials: vi.fn(),
        };

        const manager = new SSHManager(secureStorage as any, hostKeyManager as any, mockSSH2);

        const config: SFTPConfig = {
            name: 'Test',
            host: 'example.com',
            port: 22,
            username: 'user',
            remotePath: '/remote',
            authMethod: 'password',
        };

        await manager.connect(config);
        expect(hostKeyManager.promptUserForNewHost).toHaveBeenCalled();
    });

    test('throws when password is missing', async () => {
        const hostKeyManager = {
            getKnownHostsSnapshot: vi.fn(async () => new Map()),
            getHostKeyHash: vi.fn(() => 'hash'),
            promptUserForNewHost: vi.fn(),
            addHostKey: vi.fn(),
        };
        const secureStorage = {
            getCredentials: vi.fn(async () => undefined),
            clearCredentials: vi.fn(),
        };

        const manager = new SSHManager(secureStorage as any, hostKeyManager as any, mockSSH2);

        const config: SFTPConfig = {
            name: 'Test',
            host: 'example.com',
            port: 22,
            username: 'user',
            remotePath: '/remote',
            authMethod: 'password',
        };

        await expect(manager.connect(config)).rejects.toThrow('No stored password found');
    });

    test('loads private key from file', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ssh-manager-'));
        const keyPath = path.join(tempDir, 'id_ed25519');
        await fs.writeFile(keyPath, 'PRIVATEKEY');

        const hostKeyManager = {
            getKnownHostsSnapshot: vi.fn(async () => new Map([['hash', {
                host: 'example.com',
                port: 22,
                keyType: 'ssh-ed25519',
                key: Buffer.from('host-key').toString('base64'),
                fingerprint: 'fp',
                firstSeen: new Date(),
                lastSeen: new Date(),
            }]])),
            getHostKeyHash: vi.fn(() => 'hash'),
            promptUserForNewHost: vi.fn(),
            addHostKey: vi.fn(),
        };
        const secureStorage = {
            getCredentials: vi.fn(async () => ({ passphrase: 'pass' })),
            clearCredentials: vi.fn(),
        };

        const manager = new SSHManager(secureStorage as any, hostKeyManager as any, mockSSH2);

        const config: SFTPConfig = {
            name: 'Test',
            host: 'example.com',
            port: 22,
            username: 'user',
            remotePath: '/remote',
            authMethod: 'privateKey',
            privateKeyPath: keyPath,
        };

        const client = await manager.connect(config);
        expect(client).toBeTruthy();
    });
});
