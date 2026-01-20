import { describe, expect, test } from 'vitest';
import {
    DEFAULT_SSH_ALGORITHMS,
    DEFAULT_SSH_CONFIG,
    getSecureSSHConfig,
    isSecureAlgorithm,
} from '../../src/config/ssh-config';

describe('SSH Config Defaults', () => {
    test('merges defaults with user config', () => {
        const config = getSecureSSHConfig({
            host: 'example.com',
            username: 'user',
        });

        expect(config.port).toBe(DEFAULT_SSH_CONFIG.port);
        expect(config.algorithms).toEqual(DEFAULT_SSH_ALGORITHMS);
        expect(config.strictHostKeyChecking).toBe(true);
    });

    test('overrides algorithms when provided', () => {
        const config = getSecureSSHConfig({
            host: 'example.com',
            username: 'user',
            algorithms: {
                kex: ['curve25519-sha256'],
                cipher: ['aes256-ctr'],
                serverHostKey: ['ssh-ed25519'],
                hmac: ['hmac-sha2-256'],
            },
        });

        expect(config.algorithms?.kex).toEqual(['curve25519-sha256']);
        expect(config.algorithms?.cipher).toEqual(['aes256-ctr']);
    });
});

describe('SSH Algorithm Validation Helpers', () => {
    test('identifies secure algorithms', () => {
        expect(isSecureAlgorithm('curve25519-sha256', 'kex')).toBe(true);
        expect(isSecureAlgorithm('aes256-ctr', 'cipher')).toBe(true);
        expect(isSecureAlgorithm('ssh-ed25519', 'serverHostKey')).toBe(true);
        expect(isSecureAlgorithm('hmac-sha2-256', 'hmac')).toBe(true);
    });

    test('rejects unknown algorithms', () => {
        expect(isSecureAlgorithm('diffie-hellman-group1-sha1', 'kex')).toBe(false);
        expect(isSecureAlgorithm('3des-cbc', 'cipher')).toBe(false);
    });
});
