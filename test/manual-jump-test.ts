// Mock vscode module before imports
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id: string) {
    if (id === 'vscode') {
        return {
            window: { showInformationMessage: () => { } },
            workspace: { getConfiguration: () => ({ get: () => undefined }) }
        };
    }
    return originalRequire.call(this, id);
};

import { HostKeyManager } from '../src/config/host-key-manager';
import { SecureStorage } from '../src/config/secure-storage';
import { SSHManager } from '../src/core/ssh-manager';
import { SFTPClient } from '../src/core/sftp-client';
import { SFTPConfig } from '../src/types';

async function run() {
    const hopHost = process.env.SFTP_TEST_HOP_HOST || 'localhost';
    const hopPort = Number(process.env.SFTP_TEST_HOP_PORT || 2222);
    const hopUser = process.env.SFTP_TEST_HOP_USER || 'jumpuser';
    const hopPass = process.env.SFTP_TEST_HOP_PASS || 'password123';

    const targetHost = process.env.SFTP_TEST_TARGET_HOST || 'sftp-target-host';
    const targetUser = process.env.SFTP_TEST_TARGET_USER || 'targetuser';
    const targetPass = process.env.SFTP_TEST_TARGET_PASS || 'password456';

    console.log(`Testing Jump Host: ${hopUser}@${hopHost}:${hopPort} -> ${targetUser}@${targetHost}`);

    // Mock Context for HostKeyManager
    const context = {
        globalState: {
            get: () => undefined,
            update: () => Promise.resolve(),
        }
    };
    const hostKeyManager = new HostKeyManager(context as any);
    // Auto-accept host keys
    hostKeyManager.promptUserForNewHost = async () => true;
    hostKeyManager.getHostKeyHash = () => 'manual-test-hash';

    // Mock SecureStorage
    const secureStorage = new SecureStorage({} as any);
    secureStorage.getCredentials = async (host: string, username: string) => {
        if (host === targetHost && username === targetUser) return { password: targetPass };
        if (host === hopHost && username === hopUser) return { password: hopPass };
        return undefined;
    };
    secureStorage.clearCredentials = () => { };

    const manager = new SSHManager(secureStorage, hostKeyManager);

    const config: SFTPConfig = {
        name: 'ManualTest',
        host: targetHost,
        port: 2222, // Standard port inside container? No, target exposes 2222? 
        // Wait, target container uses openssh-server which listens on 2222 by default?
        // linuxserver/openssh-server listens on 2222 internally.
        username: targetUser,
        remotePath: '/',
        authMethod: 'password',
        hop: {
            host: hopHost,
            port: hopPort,
            username: hopUser,
            authMethod: 'password',
        },
        strictHostKeyChecking: false
    };

    console.log('Connecting...');
    try {
        const client = await manager.connect(config, { allowLocalhost: true });
        console.log('Connected to target via jump host!');

        const sftp = new SFTPClient(client, '/');
        console.log('Listing directory...');
        const entries = await sftp.listDirectory('.');
        console.log(`Found ${entries.length} entries:`, entries.map(e => e.name).join(', '));

        await manager.disconnectByConfig(config);
        console.log('Disconnected.');
        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

run();
