import * as vscode from 'vscode';
import { HostKeyInfo } from '../types';
import { getLogger } from '../utils/logger';
import {
    generateFingerprints,
    hashHostKey,
    constantTimeCompare,
} from '../utils/crypto-utils';

/**
 * Manages SSH host keys for MITM protection.
 * Stores known host keys and verifies them on connection.
 */
export class HostKeyManager {
    private context: vscode.ExtensionContext;
    private logger = getLogger();
    private static readonly STORAGE_KEY = 'secure-sftp.known-hosts';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get all known hosts from storage.
     */
    private async getKnownHosts(): Promise<Map<string, HostKeyInfo>> {
        const stored = this.context.globalState.get<Record<string, HostKeyInfo>>(
            HostKeyManager.STORAGE_KEY,
            {}
        );

        const map = new Map<string, HostKeyInfo>();
        for (const [hash, info] of Object.entries(stored)) {
            // Convert date strings back to Date objects
            map.set(hash, {
                ...info,
                firstSeen: new Date(info.firstSeen),
                lastSeen: new Date(info.lastSeen),
            });
        }

        return map;
    }

    /**
     * Save known hosts to storage.
     */
    private async saveKnownHosts(hosts: Map<string, HostKeyInfo>): Promise<void> {
        const obj: Record<string, HostKeyInfo> = {};
        for (const [hash, info] of hosts.entries()) {
            obj[hash] = info;
        }
        await this.context.globalState.update(HostKeyManager.STORAGE_KEY, obj);
    }

    /**
     * Generate a unique identifier for a host key.
     */
    private getHostKeyHash(host: string, port: number, keyType: string, key: Buffer): string {
        return hashHostKey(host, port, keyType, key);
    }

    /**
     * Check if a host key is known.
     */
    async isKnownHost(host: string, port: number, keyType: string, key: Buffer): Promise<boolean> {
        const hash = this.getHostKeyHash(host, port, keyType, key);
        const knownHosts = await this.getKnownHosts();
        return knownHosts.has(hash);
    }

    /**
     * Get stored host key info.
     */
    async getHostKeyInfo(
        host: string,
        port: number,
        keyType: string,
        key: Buffer
    ): Promise<HostKeyInfo | undefined> {
        const hash = this.getHostKeyHash(host, port, keyType, key);
        const knownHosts = await this.getKnownHosts();
        return knownHosts.get(hash);
    }

    /**
     * Verify a host key against known hosts.
     * Returns true if key is known and matches.
     * Returns false if key is unknown or doesn't match.
     */
    async verifyHostKey(
        host: string,
        port: number,
        keyType: string,
        key: Buffer
    ): Promise<{ verified: boolean; info?: HostKeyInfo; changed: boolean }> {
        const hash = this.getHostKeyHash(host, port, keyType, key);
        const knownHosts = await this.getKnownHosts();

        // Check if we have any key for this host
        const existingKey = Array.from(knownHosts.values()).find(
            (info) => info.host === host && info.port === port
        );

        if (!existingKey) {
            // New host
            return { verified: false, changed: false };
        }

        // Check if the key matches
        const storedHash = this.getHostKeyHash(host, port, existingKey.keyType, Buffer.from(existingKey.key, 'base64'));

        if (constantTimeCompare(hash, storedHash)) {
            // Key matches - update last seen
            existingKey.lastSeen = new Date();
            knownHosts.set(storedHash, existingKey);
            await this.saveKnownHosts(knownHosts);

            return { verified: true, info: existingKey, changed: false };
        } else {
            // Key changed - POTENTIAL MITM ATTACK!
            this.logger.warn(`Host key changed for ${host}:${port} - possible MITM attack!`);
            return { verified: false, info: existingKey, changed: true };
        }
    }

    /**
     * Add a new host key after user confirmation.
     */
    async addHostKey(host: string, port: number, keyType: string, key: Buffer): Promise<void> {
        const hash = this.getHostKeyHash(host, port, keyType, key);
        const fingerprints = generateFingerprints(key);

        const hostKeyInfo: HostKeyInfo = {
            host,
            port,
            keyType,
            key: key.toString('base64'),
            fingerprint: fingerprints.sha256,
            firstSeen: new Date(),
            lastSeen: new Date(),
        };

        const knownHosts = await this.getKnownHosts();
        knownHosts.set(hash, hostKeyInfo);
        await this.saveKnownHosts(knownHosts);

        this.logger.info(`Added host key for ${host}:${port} (${keyType})`);
    }

    /**
     * Remove a host key (for key rotation or manual removal).
     */
    async removeHostKey(host: string, port: number): Promise<void> {
        const knownHosts = await this.getKnownHosts();

        // Find and remove all keys for this host:port
        const toRemove: string[] = [];
        for (const [hash, info] of knownHosts.entries()) {
            if (info.host === host && info.port === port) {
                toRemove.push(hash);
            }
        }

        for (const hash of toRemove) {
            knownHosts.delete(hash);
        }

        await this.saveKnownHosts(knownHosts);
        this.logger.info(`Removed host key(s) for ${host}:${port}`);
    }

    /**
     * Prompt user to accept a new host key.
     * Shows fingerprint for verification.
     */
    async promptUserForNewHost(
        host: string,
        port: number,
        keyType: string,
        key: Buffer
    ): Promise<boolean> {
        const fingerprints = generateFingerprints(key);

        const message = `The authenticity of host '${host}:${port}' can't be established.\n` +
            `${keyType} key fingerprint is:\n` +
            `  ${fingerprints.sha256}\n` +
            `  ${fingerprints.md5} (MD5, deprecated)\n\n` +
            `Are you sure you want to continue connecting?`;

        const result = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Yes, Trust This Host',
            'No, Cancel Connection'
        );

        if (result === 'Yes, Trust This Host') {
            await this.addHostKey(host, port, keyType, key);
            return true;
        }

        this.logger.info(`User rejected host key for ${host}:${port}`);
        return false;
    }

    /**
     * Handle host key mismatch (potential MITM attack).
     */
    async handleHostKeyMismatch(
        host: string,
        port: number,
        oldInfo: HostKeyInfo,
        newKeyType: string,
        newKey: Buffer
    ): Promise<boolean> {
        const newFingerprints = generateFingerprints(newKey);

        const message = `⚠️ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! ⚠️\n\n` +
            `IT IS POSSIBLE THAT SOMEONE IS DOING SOMETHING NASTY!\n` +
            `Someone could be eavesdropping on you right now (man-in-the-middle attack)!\n\n` +
            `Host: ${host}:${port}\n\n` +
            `Old key (${oldInfo.keyType}):\n  ${oldInfo.fingerprint}\n` +
            `First seen: ${oldInfo.firstSeen.toLocaleString()}\n\n` +
            `New key (${newKeyType}):\n  ${newFingerprints.sha256}\n\n` +
            `If you know the host key has been legitimately changed, you can accept the new key.`;

        const result = await vscode.window.showErrorMessage(
            message,
            { modal: true },
            'Accept New Key',
            'Cancel Connection'
        );

        if (result === 'Accept New Key') {
            // Remove old key and add new one
            await this.removeHostKey(host, port);
            await this.addHostKey(host, port, newKeyType, newKey);
            this.logger.warn(`User accepted new host key for ${host}:${port} after mismatch`);
            return true;
        }

        this.logger.info(`User rejected new host key for ${host}:${port} after mismatch`);
        return false;
    }

    /**
     * Clear all known hosts (for testing or reset).
     */
    async clearAllHosts(): Promise<void> {
        await this.context.globalState.update(HostKeyManager.STORAGE_KEY, {});
        this.logger.info('Cleared all known hosts');
    }
}
