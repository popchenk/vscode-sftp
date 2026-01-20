import { SSHAlgorithms, SSHConfig } from '../types';

/**
 * Secure SSH configuration with modern algorithms.
 * These are the default algorithms used when connecting to SSH servers.
 * All weak and deprecated algorithms are excluded.
 */

/**
 * Modern key exchange algorithms (ordered by preference).
 * - Curve25519: Fast, secure elliptic curve
 * - ECDH: Elliptic curve Diffie-Hellman
 * - DH Group 18/16/14: Large Diffie-Hellman groups with SHA512/256
 */
export const SECURE_KEX_ALGORITHMS: string[] = [
    'curve25519-sha256',
    'curve25519-sha256@libssh.org',
    'ecdh-sha2-nistp521',
    'ecdh-sha2-nistp384',
    'ecdh-sha2-nistp256',
    'diffie-hellman-group18-sha512',
    'diffie-hellman-group16-sha512',
    'diffie-hellman-group14-sha256',
];

/**
 * Modern cipher algorithms (ordered by preference).
 * - ChaCha20-Poly1305: Fast, authenticated encryption
 * - AES-GCM: Hardware-accelerated authenticated encryption
 * - AES-CTR: Counter mode (not authenticated but better than CBC)
 */
export const SECURE_CIPHER_ALGORITHMS: string[] = [
    'chacha20-poly1305@openssh.com',
    'aes256-gcm@openssh.com',
    'aes128-gcm@openssh.com',
    'aes256-ctr',
    'aes192-ctr',
    'aes128-ctr',
];

/**
 * Modern server host key algorithms (ordered by preference).
 * - Ed25519: Fast, secure, small keys
 * - ECDSA: Elliptic curve signatures
 * - RSA-SHA2: RSA with SHA2 (not SHA1)
 */
export const SECURE_HOST_KEY_ALGORITHMS: string[] = [
    'ssh-ed25519',
    'ecdsa-sha2-nistp521',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp256',
    'rsa-sha2-512',
    'rsa-sha2-256',
];

/**
 * Modern HMAC algorithms (ordered by preference).
 * - ETM (Encrypt-Then-MAC): More secure than MAC-then-encrypt
 * - SHA2-512/256: Strong hash functions
 */
export const SECURE_HMAC_ALGORITHMS: string[] = [
    'hmac-sha2-512-etm@openssh.com',
    'hmac-sha2-256-etm@openssh.com',
    'hmac-sha2-512',
    'hmac-sha2-256',
];

/**
 * Default secure SSH algorithms.
 */
export const DEFAULT_SSH_ALGORITHMS: SSHAlgorithms = {
    kex: SECURE_KEX_ALGORITHMS,
    cipher: SECURE_CIPHER_ALGORITHMS,
    serverHostKey: SECURE_HOST_KEY_ALGORITHMS,
    hmac: SECURE_HMAC_ALGORITHMS,
};

/**
 * Default SSH configuration with secure defaults.
 */
export const DEFAULT_SSH_CONFIG: Partial<SSHConfig> = {
    port: 22,
    algorithms: DEFAULT_SSH_ALGORITHMS,
    strictHostKeyChecking: true,
    readyTimeout: 20000, // 20 seconds
    keepaliveInterval: 10000, // 10 seconds
};

/**
 * Get secure SSH configuration for a connection.
 * Merges user config with secure defaults.
 */
export function getSecureSSHConfig(userConfig: Partial<SSHConfig>): SSHConfig {
    // Start with defaults
    const config: SSHConfig = {
        host: userConfig.host || '',
        port: userConfig.port || DEFAULT_SSH_CONFIG.port!,
        username: userConfig.username || '',
        algorithms: { ...DEFAULT_SSH_ALGORITHMS },
        strictHostKeyChecking: userConfig.strictHostKeyChecking ?? true,
        readyTimeout: userConfig.readyTimeout || DEFAULT_SSH_CONFIG.readyTimeout,
        keepaliveInterval: userConfig.keepaliveInterval || DEFAULT_SSH_CONFIG.keepaliveInterval,
    };

    // If user provided custom algorithms, merge with defaults
    if (userConfig.algorithms) {
        config.algorithms = {
            kex: userConfig.algorithms.kex || DEFAULT_SSH_ALGORITHMS.kex,
            cipher: userConfig.algorithms.cipher || DEFAULT_SSH_ALGORITHMS.cipher,
            serverHostKey:
                userConfig.algorithms.serverHostKey || DEFAULT_SSH_ALGORITHMS.serverHostKey,
            hmac: userConfig.algorithms.hmac || DEFAULT_SSH_ALGORITHMS.hmac,
        };
    }

    return config;
}

/**
 * Check if an algorithm is considered secure.
 */
export function isSecureAlgorithm(algorithm: string, type: keyof SSHAlgorithms): boolean {
    switch (type) {
        case 'kex':
            return SECURE_KEX_ALGORITHMS.includes(algorithm);
        case 'cipher':
            return SECURE_CIPHER_ALGORITHMS.includes(algorithm);
        case 'serverHostKey':
            return SECURE_HOST_KEY_ALGORITHMS.includes(algorithm);
        case 'hmac':
            return SECURE_HMAC_ALGORITHMS.includes(algorithm);
        default:
            return false;
    }
}
