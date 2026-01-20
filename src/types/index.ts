/**
 * Core type definitions for the Secure SFTP extension.
 * These types are used throughout the extension for type safety.
 */

/**
 * Authentication methods supported by the extension.
 */
export type AuthMethod = 'password' | 'privateKey' | 'agent';

/**
 * Log levels for the secure logger.
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Credentials for SSH authentication.
 * WARNING: This type contains sensitive data and must NEVER be logged.
 */
export interface Credentials {
    password?: string;
    privateKey?: string;
    passphrase?: string;
}

/**
 * SSH algorithm configuration.
 * Specifies allowed algorithms for key exchange, ciphers, host keys, and HMAC.
 */
export interface SSHAlgorithms {
    kex: string[];
    cipher: string[];
    serverHostKey: string[];
    hmac: string[];
}

/**
 * SSH connection configuration.
 */
export interface SSHConfig {
    host: string;
    port: number;
    username: string;
    algorithms?: SSHAlgorithms;
    strictHostKeyChecking?: boolean;
    readyTimeout?: number;
    keepaliveInterval?: number;
}

/**
 * Host key information for verification.
 */
export interface HostKeyInfo {
    host: string;
    port: number;
    keyType: string;
    key: string; // Base64 encoded
    fingerprint: string; // SHA256 fingerprint
    firstSeen: Date;
    lastSeen: Date;
}

/**
 * SFTP server configuration (stored in workspace settings).
 * NOTE: Credentials are NOT stored here - they're in SecretStorage.
 */
export interface SFTPConfig {
    name: string;
    host: string;
    port: number;
    username: string;
    remotePath: string;
    authMethod: AuthMethod;
    privateKeyPath?: string;
    uploadOnSave?: boolean;
    watcher?: WatcherConfig;
    ignore?: string[];
    strictHostKeyChecking?: boolean;
    algorithms?: SSHAlgorithms;
}

/**
 * File watcher configuration.
 */
export interface WatcherConfig {
    files: string;
    autoUpload: boolean;
    autoDelete: boolean;
}

/**
 * File transfer options.
 */
export interface TransferOptions {
    concurrency?: number;
    chunkSize?: number;
    mode?: number | string;
    preserveTimestamps?: boolean;
    onProgress?: (transferred: number, total: number) => void;
}

/**
 * File transfer result.
 */
export interface TransferResult {
    success: boolean;
    localPath: string;
    remotePath: string;
    bytesTransferred: number;
    duration: number;
    error?: Error;
}

/**
 * Remote file entry.
 */
export interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'symlink';
    size: number;
    modifyTime: Date;
    accessTime: Date;
    permissions: number;
    owner: number;
    group: number;
}

/**
 * Connection status.
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Connection info for status tracking.
 */
export interface ConnectionInfo {
    id: string;
    config: SFTPConfig;
    status: ConnectionStatus;
    connectedAt?: Date;
    error?: string;
}
