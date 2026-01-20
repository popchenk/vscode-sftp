import { describe, expect, test, vi } from 'vitest';
import { SecureStorage } from '../../src/config/secure-storage';

describe('SecureStorage', () => {
    test('stores and retrieves password credentials', async () => {
        const secrets = {
            store: vi.fn(async () => undefined),
            get: vi.fn(async (key: string) => {
                if (key === 'secure-sftp.example.com.user') {
                    return JSON.stringify({ password: 'secret' });
                }
                return undefined;
            }),
            delete: vi.fn(async () => undefined),
        };

        const storage = new SecureStorage(secrets as any);
        await storage.storePassword('example.com', 'user', 'secret');

        expect(secrets.store).toHaveBeenCalledWith(
            'secure-sftp.example.com.user',
            JSON.stringify({ password: 'secret' })
        );

        const credentials = await storage.getCredentials('example.com', 'user');
        expect(credentials?.password).toBe('secret');
    });

    test('deletes credentials for host and user', async () => {
        const secrets = {
            store: vi.fn(async () => undefined),
            get: vi.fn(async () => undefined),
            delete: vi.fn(async () => undefined),
        };

        const storage = new SecureStorage(secrets as any);
        await storage.deleteCredentials('example.com', 'user');

        expect(secrets.delete).toHaveBeenCalledWith('secure-sftp.example.com.user');
    });

    test('stores private key credentials and checks presence', async () => {
        const secrets = {
            store: vi.fn(async () => undefined),
            get: vi.fn(async () =>
                JSON.stringify({ privateKey: 'KEY', passphrase: 'passphrase' })
            ),
            delete: vi.fn(async () => undefined),
        };

        const storage = new SecureStorage(secrets as any);
        await storage.storePrivateKey('example.com', 'user', 'KEY', 'passphrase');

        expect(secrets.store).toHaveBeenCalledWith(
            'secure-sftp.example.com.user',
            JSON.stringify({ privateKey: 'KEY', passphrase: 'passphrase' })
        );

        const hasCredentials = await storage.hasCredentials('example.com', 'user');
        expect(hasCredentials).toBe(true);
    });

    test('stores passphrase only', async () => {
        const secrets = {
            store: vi.fn(async () => undefined),
            get: vi.fn(async () => JSON.stringify({ passphrase: 'pass' })),
            delete: vi.fn(async () => undefined),
        };

        const storage = new SecureStorage(secrets as any);
        await storage.storePassphrase('example.com', 'user', 'pass');

        expect(secrets.store).toHaveBeenCalledWith(
            'secure-sftp.example.com.user',
            JSON.stringify({ passphrase: 'pass' })
        );
    });
});
