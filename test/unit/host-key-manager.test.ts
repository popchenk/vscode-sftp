import { describe, expect, test } from 'vitest';
import { HostKeyManager } from '../../src/config/host-key-manager';

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

describe('HostKeyManager', () => {
    test('adds and verifies known host keys', async () => {
        const context = createContext();
        const manager = new HostKeyManager(context);
        const key = Buffer.from('test-key');

        await manager.addHostKey('example.com', 22, 'ssh-ed25519', key);
        const result = await manager.verifyHostKey('example.com', 22, 'ssh-ed25519', key);

        expect(result.verified).toBe(true);
        expect(result.changed).toBe(false);
        expect(result.info?.host).toBe('example.com');
    });

    test('detects changed host keys', async () => {
        const context = createContext();
        const manager = new HostKeyManager(context);
        const key1 = Buffer.from('first-key');
        const key2 = Buffer.from('second-key');

        await manager.addHostKey('example.com', 22, 'ssh-ed25519', key1);
        const result = await manager.verifyHostKey('example.com', 22, 'ssh-ed25519', key2);

        expect(result.verified).toBe(false);
        expect(result.changed).toBe(true);
        expect(result.info?.host).toBe('example.com');
    });

    test('removes host keys for host and port', async () => {
        const context = createContext();
        const manager = new HostKeyManager(context);
        const key = Buffer.from('test-key');

        await manager.addHostKey('example.com', 22, 'ssh-ed25519', key);
        await manager.removeHostKey('example.com', 22);

        const exists = await manager.isKnownHost('example.com', 22, 'ssh-ed25519', key);
        expect(exists).toBe(false);
    });
});
