import { describe, expect, test } from 'vitest';
import {
    clearBuffer,
    clearString,
    constantTimeCompare,
    generateFingerprints,
    hashHostKey,
} from '../../src/utils/crypto-utils';

describe('Crypto Utils', () => {
    test('generates fingerprints', () => {
        const key = Buffer.from('test-key');
        const fingerprints = generateFingerprints(key);

        expect(fingerprints.sha256).toMatch(/^SHA256:/);
        expect(fingerprints.md5).toMatch(/^[0-9a-f]{2}(:[0-9a-f]{2}){15}$/);
    });

    test('clears buffer contents', () => {
        const buffer = Buffer.from('secret');
        clearBuffer(buffer);
        expect(buffer.toString()).toBe('\0'.repeat(6));
    });

    test('clears string with null bytes', () => {
        expect(clearString('secret')).toBe('\0'.repeat(6));
    });

    test('compares values in constant time', () => {
        expect(constantTimeCompare('abc', 'abc')).toBe(true);
        expect(constantTimeCompare('abc', 'abd')).toBe(false);
    });

    test('hashes host key data', () => {
        const hash = hashHostKey('example.com', 22, 'ssh-ed25519', Buffer.from('key'));
        expect(hash).toBeTruthy();
    });
});
