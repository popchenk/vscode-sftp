import { describe, test, expect } from 'vitest';
import {
    isValidHost,
    isValidPort,
    isValidUsername,
    sanitizePath,
    isPathWithinRoot,
    validateSSHConfig,
} from '../../src/utils/validators';
import { SSHConfig } from '../../src/types';

describe('Host Validation', () => {
    test('accepts valid hostnames', () => {
        expect(isValidHost('example.com')).toBe(true);
        expect(isValidHost('sub.example.com')).toBe(true);
        expect(isValidHost('my-server.example.com')).toBe(true);
    });

    test('accepts valid IP addresses', () => {
        expect(isValidHost('192.168.1.1')).toBe(false); // Private IP blocked
        expect(isValidHost('8.8.8.8')).toBe(true);
        expect(isValidHost('1.2.3.4')).toBe(true);
    });

    test('blocks localhost', () => {
        expect(isValidHost('localhost')).toBe(false);
        expect(isValidHost('127.0.0.1')).toBe(false);
        expect(isValidHost('127.0.0.2')).toBe(false);
        expect(isValidHost('::1')).toBe(false);
    });

    test('allows localhost when explicitly enabled', () => {
        expect(isValidHost('localhost', { allowLocalhost: true })).toBe(true);
        expect(isValidHost('127.0.0.1', { allowLocalhost: true })).toBe(true);
        expect(isValidHost('127.0.0.2', { allowLocalhost: true })).toBe(true);
        expect(isValidHost('::1', { allowLocalhost: true })).toBe(true);
    });

    test('blocks private IP ranges', () => {
        expect(isValidHost('10.0.0.1')).toBe(false);
        expect(isValidHost('192.168.1.1')).toBe(false);
        expect(isValidHost('172.16.0.1')).toBe(false);
    });

    test('rejects invalid hostnames', () => {
        expect(isValidHost('')).toBe(false);
        expect(isValidHost('   ')).toBe(false);
        expect(isValidHost('invalid..hostname')).toBe(false);
        expect(isValidHost('-invalid.com')).toBe(false);
    });
});

describe('Port Validation', () => {
    test('accepts valid ports', () => {
        expect(isValidPort(22)).toBe(true);
        expect(isValidPort(80)).toBe(true);
        expect(isValidPort(443)).toBe(true);
        expect(isValidPort(8080)).toBe(true);
        expect(isValidPort(65535)).toBe(true);
    });

    test('rejects invalid ports', () => {
        expect(isValidPort(0)).toBe(false);
        expect(isValidPort(-1)).toBe(false);
        expect(isValidPort(65536)).toBe(false);
        expect(isValidPort(100000)).toBe(false);
        expect(isValidPort(3.14)).toBe(false);
    });
});

describe('Username Validation', () => {
    test('accepts valid usernames', () => {
        expect(isValidUsername('user')).toBe(true);
        expect(isValidUsername('john.doe')).toBe(true);
        expect(isValidUsername('user_123')).toBe(true);
        expect(isValidUsername('deploy-user')).toBe(true);
    });

    test('rejects invalid usernames', () => {
        expect(isValidUsername('')).toBe(false);
        expect(isValidUsername('   ')).toBe(false);
        expect(isValidUsername('user@host')).toBe(false);
        expect(isValidUsername('user;rm -rf /')).toBe(false);
        expect(isValidUsername('user`whoami`')).toBe(false);
        expect(isValidUsername('a'.repeat(33))).toBe(false); // Too long
    });
});

describe('Path Sanitization', () => {
    test('removes null bytes', () => {
        expect(sanitizePath('/path/to/file\0')).toBe('/path/to/file');
        expect(sanitizePath('/path\0/to\0/file')).toBe('/path/to/file');
    });

    test('normalizes path separators', () => {
        expect(sanitizePath('C:\\Users\\test\\file.txt')).toBe('C:/Users/test/file.txt');
        expect(sanitizePath('/path//to///file')).toBe('/path/to/file');
    });

    test('throws on invalid input', () => {
        expect(() => sanitizePath('')).toThrow();
        expect(() => sanitizePath(null as any)).toThrow();
        expect(() => sanitizePath(undefined as any)).toThrow();
    });
});

describe('Path Traversal Prevention', () => {
    test('blocks path traversal attempts', () => {
        expect(isPathWithinRoot('../../../etc/passwd', '/home/user')).toBe(false);
        expect(isPathWithinRoot('/home/user/../../../etc/passwd', '/home/user')).toBe(false);
        expect(isPathWithinRoot('../../etc/passwd', '/home/user')).toBe(false);
    });

    test('allows valid paths within root', () => {
        expect(isPathWithinRoot('/home/user/file.txt', '/home/user')).toBe(true);
        expect(isPathWithinRoot('/home/user/subdir/file.txt', '/home/user')).toBe(true);
        expect(isPathWithinRoot('file.txt', '/home/user')).toBe(true);
        expect(isPathWithinRoot('./subdir/file.txt', '/home/user')).toBe(true);
    });

    test('handles edge cases', () => {
        expect(isPathWithinRoot('', '/home/user')).toBe(false);
        expect(isPathWithinRoot('/home/user', '')).toBe(false);
    });
});

describe('SSH Config Validation', () => {
    test('accepts valid SSH config', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 22,
            username: 'user',
        };

        expect(() => validateSSHConfig(config)).not.toThrow();
    });

    test('rejects invalid host', () => {
        const config: SSHConfig = {
            host: 'localhost',
            port: 22,
            username: 'user',
        };

        expect(() => validateSSHConfig(config)).toThrow('Invalid host');
    });

    test('rejects invalid port', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 0,
            username: 'user',
        };

        expect(() => validateSSHConfig(config)).toThrow('Invalid port');
    });

    test('rejects invalid username', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 22,
            username: 'user;rm -rf /',
        };

        expect(() => validateSSHConfig(config)).toThrow('Invalid username');
    });

    test('rejects weak key exchange algorithms', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 22,
            username: 'user',
            algorithms: {
                kex: ['diffie-hellman-group1-sha1'],
                cipher: ['aes256-ctr'],
                serverHostKey: ['ssh-ed25519'],
                hmac: ['hmac-sha2-256'],
            },
        };

        expect(() => validateSSHConfig(config)).toThrow('Weak key exchange algorithms');
    });

    test('rejects weak ciphers', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 22,
            username: 'user',
            algorithms: {
                kex: ['curve25519-sha256'],
                cipher: ['3des-cbc', 'aes128-cbc'],
                serverHostKey: ['ssh-ed25519'],
                hmac: ['hmac-sha2-256'],
            },
        };

        expect(() => validateSSHConfig(config)).toThrow('Weak ciphers');
    });

    test('rejects weak host key algorithms', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 22,
            username: 'user',
            algorithms: {
                kex: ['curve25519-sha256'],
                cipher: ['aes256-ctr'],
                serverHostKey: ['ssh-dss', 'ssh-rsa'],
                hmac: ['hmac-sha2-256'],
            },
        };

        expect(() => validateSSHConfig(config)).toThrow('Weak host key algorithms');
    });

    test('rejects weak HMAC algorithms', () => {
        const config: SSHConfig = {
            host: 'example.com',
            port: 22,
            username: 'user',
            algorithms: {
                kex: ['curve25519-sha256'],
                cipher: ['aes256-ctr'],
                serverHostKey: ['ssh-ed25519'],
                hmac: ['hmac-md5', 'hmac-sha1'],
            },
        };

        expect(() => validateSSHConfig(config)).toThrow('Weak HMAC algorithms');
    });
});
