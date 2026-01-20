import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../../src/utils/logger';

describe('Logger Security', () => {
    let logger: Logger;

    beforeEach(() => {
        logger = new Logger('Test Logger', 'debug');
    });

    test('redacts passwords from log messages', () => {
        const logSpy = vi.spyOn(logger as any, 'sanitize');

        const message = 'Connecting with password: secret123';
        logger.info(message);

        expect(logSpy).toHaveBeenCalled();
        const sanitized = logSpy.mock.results[0].value;
        expect(sanitized).not.toContain('secret123');
        expect(sanitized).toContain('[REDACTED]');
    });

    test('redacts private keys from log messages', () => {
        const logSpy = vi.spyOn(logger as any, 'sanitize');

        const message =
            'Using privateKey: -----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
        logger.info(message);

        expect(logSpy).toHaveBeenCalled();
        const sanitized = logSpy.mock.results[0].value;
        expect(sanitized).not.toContain('BEGIN RSA PRIVATE KEY');
        expect(sanitized).toContain('[REDACTED]');
    });

    test('redacts passphrases from log messages', () => {
        const logSpy = vi.spyOn(logger as any, 'sanitize');

        const message = 'Key passphrase: mySecretPhrase123';
        logger.info(message);

        expect(logSpy).toHaveBeenCalled();
        const sanitized = logSpy.mock.results[0].value;
        expect(sanitized).not.toContain('mySecretPhrase123');
        expect(sanitized).toContain('[REDACTED]');
    });

    test('sanitizes objects with sensitive fields', () => {
        const obj = {
            username: 'testuser',
            password: 'secret123',
            host: 'example.com',
            privateKey: '-----BEGIN PRIVATE KEY-----',
        };

        const sanitized = Logger.sanitizeObject(obj) as any;

        expect(sanitized.username).toBe('testuser');
        expect(sanitized.host).toBe('example.com');
        expect(sanitized.password).toBe('[REDACTED]');
        expect(sanitized.privateKey).toBe('[REDACTED]');
    });

    test('sanitizes nested objects', () => {
        const obj = {
            config: {
                host: 'example.com',
                credentials: {
                    username: 'user',
                    password: 'secret',
                },
            },
        };

        const sanitized = Logger.sanitizeObject(obj) as any;

        expect(sanitized.config.host).toBe('example.com');
        expect(sanitized.config.credentials).toBe('[REDACTED]');
    });

    test('respects log levels', () => {
        const infoLogger = new Logger('Info Logger', 'info');
        const outputSpy = vi.spyOn((infoLogger as any).outputChannel, 'appendLine');

        infoLogger.debug('Debug message');
        expect(outputSpy).not.toHaveBeenCalled();

        infoLogger.info('Info message');
        expect(outputSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));

        infoLogger.error('Error message');
        expect(outputSpy).toHaveBeenCalledWith(expect.stringContaining('[ERROR]'));
    });
});
