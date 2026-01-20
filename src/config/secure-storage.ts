import * as vscode from 'vscode';
import { Credentials } from '../types';
import { getLogger } from '../utils/logger';
import { clearString } from '../utils/crypto-utils';

/**
 * Secure credential storage using VS Code SecretStorage API.
 * Credentials are stored in the OS keychain (Keychain on macOS, Credential Manager on Windows, etc.)
 * and are NEVER stored in plaintext or logged.
 */
export class SecureStorage {
    private secrets: vscode.SecretStorage;
    private logger = getLogger();

    constructor(secrets: vscode.SecretStorage) {
        this.secrets = secrets;
    }

    /**
     * Generate storage key for credentials.
     * Format: secure-sftp.{host}.{username}
     */
    private getStorageKey(host: string, username: string): string {
        return `secure-sftp.${host}.${username}`;
    }

    /**
     * Store password for a host/username combination.
     */
    async storePassword(host: string, username: string, password: string): Promise<void> {
        const key = this.getStorageKey(host, username);

        try {
            const credentials: Credentials = { password };
            await this.secrets.store(key, JSON.stringify(credentials));
            this.logger.info(`Stored credentials for ${username}@${host}`);
        } catch (error) {
            this.logger.error(`Failed to store credentials for ${username}@${host}`, error as Error);
            throw new Error('Failed to store credentials securely');
        }
    }

    /**
     * Store private key and optional passphrase.
     */
    async storePrivateKey(
        host: string,
        username: string,
        privateKey: string,
        passphrase?: string
    ): Promise<void> {
        const key = this.getStorageKey(host, username);

        try {
            const credentials: Credentials = { privateKey, passphrase };
            await this.secrets.store(key, JSON.stringify(credentials));
            this.logger.info(`Stored private key for ${username}@${host}`);
        } catch (error) {
            this.logger.error(`Failed to store private key for ${username}@${host}`, error as Error);
            throw new Error('Failed to store private key securely');
        }
    }

    /**
     * Store only a private key passphrase (private key stored on disk).
     */
    async storePassphrase(host: string, username: string, passphrase: string): Promise<void> {
        const key = this.getStorageKey(host, username);

        try {
            const credentials: Credentials = { passphrase };
            await this.secrets.store(key, JSON.stringify(credentials));
            this.logger.info(`Stored passphrase for ${username}@${host}`);
        } catch (error) {
            this.logger.error(`Failed to store passphrase for ${username}@${host}`, error as Error);
            throw new Error('Failed to store passphrase securely');
        }
    }

    /**
     * Retrieve credentials for a host/username combination.
     * Returns undefined if no credentials are stored.
     */
    async getCredentials(host: string, username: string): Promise<Credentials | undefined> {
        const key = this.getStorageKey(host, username);

        try {
            const stored = await this.secrets.get(key);
            if (!stored) {
                this.logger.debug(`No stored credentials found for ${username}@${host}`);
                return undefined;
            }

            const credentials: Credentials = JSON.parse(stored);
            this.logger.debug(`Retrieved credentials for ${username}@${host}`);
            return credentials;
        } catch (error) {
            this.logger.error(`Failed to retrieve credentials for ${username}@${host}`, error as Error);
            return undefined;
        }
    }

    /**
     * Delete stored credentials for a host/username combination.
     */
    async deleteCredentials(host: string, username: string): Promise<void> {
        const key = this.getStorageKey(host, username);

        try {
            await this.secrets.delete(key);
            this.logger.info(`Deleted credentials for ${username}@${host}`);
        } catch (error) {
            this.logger.error(`Failed to delete credentials for ${username}@${host}`, error as Error);
            throw new Error('Failed to delete credentials');
        }
    }

    /**
     * Clear credentials from memory.
     * Best effort to overwrite sensitive data.
     */
    clearCredentials(credentials: Credentials): void {
        if (credentials.password) {
            credentials.password = clearString(credentials.password);
        }
        if (credentials.privateKey) {
            credentials.privateKey = clearString(credentials.privateKey);
        }
        if (credentials.passphrase) {
            credentials.passphrase = clearString(credentials.passphrase);
        }
    }

    /**
     * Check if credentials exist for a host/username combination.
     */
    async hasCredentials(host: string, username: string): Promise<boolean> {
        const credentials = await this.getCredentials(host, username);
        return credentials !== undefined;
    }

    /**
     * List all stored credential keys (for management UI).
     * Returns array of {host, username} pairs.
     */
    async listStoredCredentials(): Promise<Array<{ host: string; username: string }>> {
        // Note: VS Code SecretStorage doesn't provide a list API
        // This would need to be tracked separately in global state
        // For now, return empty array
        this.logger.warn('listStoredCredentials not yet implemented');
        return [];
    }
}
