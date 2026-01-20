import * as crypto from 'crypto';

/**
 * Cryptographic utilities for SSH operations.
 * Handles fingerprint generation, key hashing, and secure operations.
 */

/**
 * Generate SHA256 fingerprint from SSH public key.
 * Returns format: SHA256:base64hash
 */
export function generateSHA256Fingerprint(publicKey: Buffer): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('base64');
    return `SHA256:${hash}`;
}

/**
 * Generate MD5 fingerprint from SSH public key.
 * Returns format: xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx:xx
 * Note: MD5 is deprecated but still shown for compatibility.
 */
export function generateMD5Fingerprint(publicKey: Buffer): string {
    const hash = crypto.createHash('md5').update(publicKey).digest('hex');
    return hash.match(/.{2}/g)?.join(':') || '';
}

/**
 * Generate both SHA256 and MD5 fingerprints for display.
 */
export function generateFingerprints(publicKey: Buffer): {
    sha256: string;
    md5: string;
} {
    return {
        sha256: generateSHA256Fingerprint(publicKey),
        md5: generateMD5Fingerprint(publicKey),
    };
}

/**
 * Hash a host key for storage.
 * Uses SHA256 for privacy (known_hosts hashing).
 */
export function hashHostKey(host: string, port: number, keyType: string, key: Buffer): string {
    const data = `${host}:${port}:${keyType}:${key.toString('base64')}`;
    return crypto.createHash('sha256').update(data).digest('base64');
}

/**
 * Generate cryptographically secure random bytes.
 */
export function secureRandomBytes(length: number): Buffer {
    return crypto.randomBytes(length);
}

/**
 * Generate a secure random string (hex encoded).
 */
export function secureRandomString(length: number): string {
    return secureRandomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}

/**
 * Clear a buffer from memory by overwriting with zeros.
 * Use this for sensitive data like passwords or keys.
 */
export function clearBuffer(buffer: Buffer): void {
    if (buffer && Buffer.isBuffer(buffer)) {
        buffer.fill(0);
    }
}

/**
 * Clear a string from memory (best effort).
 * Note: JavaScript strings are immutable, so this creates a new string.
 * The original may still exist in memory until garbage collected.
 */
export function clearString(str: string): string {
    return '\0'.repeat(str.length);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use this when comparing secrets, tokens, or hashes.
 */
export function constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Format a fingerprint for display to user.
 */
export function formatFingerprintForDisplay(
    keyType: string,
    sha256: string,
    md5: string
): string {
    return `${keyType} key fingerprint:\n  ${sha256}\n  ${md5} (deprecated)`;
}
