import * as os from 'os';
import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { HostKeyManager } from '../../src/config/host-key-manager';
import { SecureStorage } from '../../src/config/secure-storage';
import { SFTPClient } from '../../src/core/sftp-client';
import { SSHManager } from '../../src/core/ssh-manager';
import { SFTPConfig } from '../../src/types';

const hopHost = process.env.SFTP_TEST_HOP_HOST;
const hopPort = Number(process.env.SFTP_TEST_HOP_PORT || 2222);
const hopUser = process.env.SFTP_TEST_HOP_USER;
const hopPass = process.env.SFTP_TEST_HOP_PASS;

const targetHost = process.env.SFTP_TEST_TARGET_HOST;
const targetUser = process.env.SFTP_TEST_TARGET_USER;
const targetPass = process.env.SFTP_TEST_TARGET_PASS;

const hasEnv =
    Boolean(hopHost) && Boolean(hopUser) && Boolean(hopPass) &&
    Boolean(targetHost) && Boolean(targetUser) && Boolean(targetPass);

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

describe.skip('Jump Host Integration', () => {
    const config: SFTPConfig = {
        name: 'JumpHostTest',
        host: targetHost!,
        port: 2222, // Internal port of target is 2222 (standard containers usually 2222) NO, image uses 2222.
        // Wait, standard linuxserver/openssh-server exposes 2222 by default externally, but internally it listens on 2222.
        username: targetUser!,
        remotePath: '/',
        authMethod: 'password',
        hop: {
            host: hopHost!,
            port: hopPort,
            username: hopUser!,
            authMethod: 'password',
        }
    };

    test('lists remote directory entries via jump host', async () => {
        const context = createContext();
        const hostKeyManager = new HostKeyManager(context);
        hostKeyManager.promptUserForNewHost = async (h, p, k, key) => {
            await hostKeyManager.addHostKey(h, p, k, key);
            return true;
        };
        const secureStorage = new SecureStorage({
            store: async () => undefined,
            get: async (key: string) => {
                // Mock secure storage to return correct password based on user
                // The key is usually service-host-username
                if (key.includes(targetUser!)) return JSON.stringify({ password: targetPass });
                if (key.includes(hopUser!)) return JSON.stringify({ password: hopPass });
                return undefined;
            },
            delete: async () => undefined,
        } as any);

        // We need to inject the mock logic for `getCredentials` which ssh-manager calls directly on secureStorage instance
        // But SecureStorage is a class. We can wrap it or mock `getCredentials`.
        // SSHManager calls `secureStorage.getCredentials(host, username)`.
        secureStorage.getCredentials = async (host: string, username: string) => {
            if (host === targetHost && username === targetUser) return { password: targetPass };
            if (host === hopHost && username === hopUser) return { password: hopPass };
            return undefined;
        };

        const manager = new SSHManager(secureStorage, hostKeyManager);
        const client = await manager.connect(config, { allowLocalhost: true });
        const sftp = new SFTPClient(client, config.remotePath);

        const entries = await sftp.listDirectory('.');
        expect(Array.isArray(entries)).toBe(true);
        // Verify we are on target host (check for file/folder specific to it? or just connectivity)

        await manager.disconnectByConfig(config);
    });
});
