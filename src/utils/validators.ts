import * as path from 'path';
import { SSHConfig, SSHAlgorithms } from '../types';

/**
 * Validates that a hostname is valid and not attempting SSRF.
 * Blocks localhost, private IPs, and invalid formats.
 */
export function isValidHost(host: string): boolean {
    if (!host || typeof host !== 'string') {
        return false;
    }

    // Trim and check length
    const trimmed = host.trim();
    if (trimmed.length === 0 || trimmed.length > 253) {
        return false;
    }

    // Block localhost variations
    const lowercased = trimmed.toLowerCase();
    if (
        lowercased === 'localhost' ||
        lowercased === '127.0.0.1' ||
        lowercased === '::1' ||
        lowercased.startsWith('127.')
    ) {
        return false;
    }

    // Block private IP ranges (basic check)
    if (
        lowercased.startsWith('10.') ||
        lowercased.startsWith('192.168.') ||
        lowercased.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
    ) {
        return false;
    }

    // Basic hostname/IP validation
    // eslint-disable-next-line security/detect-unsafe-regex
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    // eslint-disable-next-line security/detect-unsafe-regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // eslint-disable-next-line security/detect-unsafe-regex
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

    return hostnameRegex.test(trimmed) || ipv4Regex.test(trimmed) || ipv6Regex.test(trimmed);
}

/**
 * Validates that a port number is valid.
 */
export function isValidPort(port: number): boolean {
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * Validates that a username is valid.
 * Prevents special characters that could be used for injection.
 */
export function isValidUsername(username: string): boolean {
    if (!username || typeof username !== 'string') {
        return false;
    }

    const trimmed = username.trim();
    if (trimmed.length === 0 || trimmed.length > 32) {
        return false;
    }

    // Allow alphanumeric, underscore, hyphen, and dot
    const usernameRegex = /^[a-zA-Z0-9._-]+$/;
    return usernameRegex.test(trimmed);
}

/**
 * Sanitizes a file path by removing dangerous characters.
 * Does NOT validate path traversal - use isPathWithinRoot for that.
 */
export function sanitizePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Path must be a non-empty string');
    }

    // Remove null bytes
    let sanitized = filePath.replace(/\0/g, '');

    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');

    // Remove multiple consecutive slashes
    sanitized = sanitized.replace(/\/+/g, '/');

    return sanitized;
}

/**
 * Validates that a path is within the allowed root directory.
 * Prevents path traversal attacks.
 */
export function isPathWithinRoot(filePath: string, root: string): boolean {
    if (!filePath || !root) {
        return false;
    }

    try {
        // Sanitize inputs
        const sanitizedPath = sanitizePath(filePath);
        const sanitizedRoot = sanitizePath(root);

        // Resolve to absolute paths
        const resolvedPath = path.resolve(sanitizedPath);
        const resolvedRoot = path.resolve(sanitizedRoot);

        // Check if path starts with root
        const relative = path.relative(resolvedRoot, resolvedPath);

        // If relative path starts with '..' or is absolute, it's outside root
        return !relative.startsWith('..') && !path.isAbsolute(relative);
    } catch (error) {
        // If path resolution fails, reject
        return false;
    }
}

/**
 * Weak SSH algorithms that should be rejected.
 */
const WEAK_KEX_ALGORITHMS = [
    'diffie-hellman-group1-sha1',
    'diffie-hellman-group14-sha1',
    'diffie-hellman-group-exchange-sha1',
];

const WEAK_CIPHERS = [
    '3des-cbc',
    'aes128-cbc',
    'aes192-cbc',
    'aes256-cbc',
    'arcfour',
    'arcfour128',
    'arcfour256',
    'blowfish-cbc',
    'cast128-cbc',
];

const WEAK_HOST_KEY_ALGORITHMS = ['ssh-dss', 'ssh-rsa']; // ssh-rsa without SHA2 is weak

const WEAK_HMAC_ALGORITHMS = [
    'hmac-md5',
    'hmac-md5-96',
    'hmac-sha1',
    'hmac-sha1-96',
    'hmac-ripemd160',
];

/**
 * Validates SSH configuration and rejects weak algorithms.
 */
export function validateSSHConfig(config: SSHConfig): void {
    // Validate host
    if (!isValidHost(config.host)) {
        throw new Error(`Invalid host: ${config.host}`);
    }

    // Validate port
    if (!isValidPort(config.port)) {
        throw new Error(`Invalid port: ${config.port}`);
    }

    // Validate username
    if (!isValidUsername(config.username)) {
        throw new Error(`Invalid username: ${config.username}`);
    }

    // Validate algorithms if provided
    if (config.algorithms) {
        validateAlgorithms(config.algorithms);
    }
}

/**
 * Validates that SSH algorithms don't include weak options.
 */
function validateAlgorithms(algorithms: SSHAlgorithms): void {
    // Check key exchange algorithms
    if (algorithms.kex) {
        const weakKex = algorithms.kex.filter((alg) => WEAK_KEX_ALGORITHMS.includes(alg));
        if (weakKex.length > 0) {
            throw new Error(`Weak key exchange algorithms detected: ${weakKex.join(', ')}`);
        }
    }

    // Check ciphers
    if (algorithms.cipher) {
        const weakCiphers = algorithms.cipher.filter((alg) => WEAK_CIPHERS.includes(alg));
        if (weakCiphers.length > 0) {
            throw new Error(`Weak ciphers detected: ${weakCiphers.join(', ')}`);
        }
    }

    // Check host key algorithms
    if (algorithms.serverHostKey) {
        const weakHostKeys = algorithms.serverHostKey.filter((alg) =>
            WEAK_HOST_KEY_ALGORITHMS.includes(alg)
        );
        if (weakHostKeys.length > 0) {
            throw new Error(`Weak host key algorithms detected: ${weakHostKeys.join(', ')}`);
        }
    }

    // Check HMAC algorithms
    if (algorithms.hmac) {
        const weakHmac = algorithms.hmac.filter((alg) => WEAK_HMAC_ALGORITHMS.includes(alg));
        if (weakHmac.length > 0) {
            throw new Error(`Weak HMAC algorithms detected: ${weakHmac.join(', ')}`);
        }
    }
}
