import * as fs from 'fs/promises';
import * as path from 'path';
import { Client, SFTPWrapper, TransferOptions as SshTransferOptions } from 'ssh2';
import { getLogger } from '../utils/logger';
import { sanitizePath } from '../utils/validators';
import { FileEntry, TransferOptions, TransferResult } from '../types';

const MODE_MASK = 0o170000;
const MODE_DIR = 0o040000;
const MODE_SYMLINK = 0o120000;

export class SFTPClient {
    private logger = getLogger();

    constructor(private readonly client: Client, private readonly remoteRoot?: string) {}

    async listDirectory(remotePath: string): Promise<FileEntry[]> {
        const sftp = await this.getSftp();
        const resolvedPath = this.resolveRemotePath(remotePath);

        return new Promise((resolve, reject) => {
            sftp.readdir(resolvedPath, (error, list) => {
                if (error) {
                    reject(error);
                    return;
                }

                const entries = list.map((entry) => {
                    const entryPath = path.posix.join(resolvedPath, entry.filename);
                    const mode = entry.attrs.mode ?? 0;
                    const type = this.getEntryType(mode);
                    const modifyTime = new Date((entry.attrs.mtime ?? 0) * 1000);
                    const accessTime = new Date((entry.attrs.atime ?? 0) * 1000);

                    return {
                        name: entry.filename,
                        path: entryPath,
                        type,
                        size: entry.attrs.size ?? 0,
                        modifyTime,
                        accessTime,
                        permissions: mode,
                        owner: entry.attrs.uid ?? 0,
                        group: entry.attrs.gid ?? 0,
                    };
                });

                resolve(entries);
            });
        });
    }

    async upload(
        localPath: string,
        remotePath: string,
        options?: TransferOptions
    ): Promise<TransferResult> {
        const sftp = await this.getSftp();
        const sanitizedLocal = sanitizePath(localPath);
        const resolvedRemote = this.resolveRemotePath(remotePath);
        const start = Date.now();
        const stats = await fs.stat(sanitizedLocal);
        const totalSize = stats.size;

        const step: SshTransferOptions['step'] | undefined = options?.onProgress
            ? (transferred, _chunkSize, fileSize): void => {
                  options.onProgress?.(transferred, fileSize);
              }
            : undefined;

        const transferOptions: SshTransferOptions = {
            concurrency: options?.concurrency,
            chunkSize: options?.chunkSize,
            fileSize: totalSize,
            mode: options?.mode,
            step,
        };

        return new Promise((resolve, reject) => {
            sftp.fastPut(sanitizedLocal, resolvedRemote, transferOptions, (error) => {
                const duration = Date.now() - start;
                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    success: true,
                    localPath: sanitizedLocal,
                    remotePath: resolvedRemote,
                    bytesTransferred: totalSize,
                    duration,
                });
            });
        });
    }

    async download(
        remotePath: string,
        localPath: string,
        options?: TransferOptions
    ): Promise<TransferResult> {
        const sftp = await this.getSftp();
        const sanitizedLocal = sanitizePath(localPath);
        const resolvedRemote = this.resolveRemotePath(remotePath);
        const start = Date.now();
        const remoteStat = await this.statRemote(sftp, resolvedRemote);
        const totalSize = remoteStat.size ?? 0;

        const step: SshTransferOptions['step'] | undefined = options?.onProgress
            ? (transferred, _chunkSize, fileSize): void => {
                  options.onProgress?.(transferred, fileSize);
              }
            : undefined;

        const transferOptions: SshTransferOptions = {
            concurrency: options?.concurrency,
            chunkSize: options?.chunkSize,
            fileSize: totalSize,
            mode: options?.mode,
            step,
        };

        return new Promise((resolve, reject) => {
            sftp.fastGet(resolvedRemote, sanitizedLocal, transferOptions, (error) => {
                const duration = Date.now() - start;
                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    success: true,
                    localPath: sanitizedLocal,
                    remotePath: resolvedRemote,
                    bytesTransferred: totalSize,
                    duration,
                });
            });
        });
    }

    async uploadDirectory(localDir: string, remoteDir: string): Promise<void> {
        const sftp = await this.getSftp();
        const sanitizedLocal = sanitizePath(localDir);
        const resolvedRemote = this.resolveRemotePath(remoteDir);

        await this.ensureRemoteDir(sftp, resolvedRemote);

        const entries = await fs.readdir(sanitizedLocal, { withFileTypes: true });
        for (const entry of entries) {
            const localPath = path.join(sanitizedLocal, entry.name);
            const remotePath = path.posix.join(resolvedRemote, entry.name);

            if (entry.isDirectory()) {
                await this.uploadDirectory(localPath, remotePath);
            } else if (entry.isFile()) {
                await this.upload(localPath, remotePath);
            }
        }
    }

    async syncDirectory(localDir: string, remoteDir: string): Promise<void> {
        await this.uploadDirectory(localDir, remoteDir);
    }

    private getEntryType(mode: number): FileEntry['type'] {
        const typeBits = mode & MODE_MASK;
        if (typeBits === MODE_DIR) {
            return 'directory';
        }
        if (typeBits === MODE_SYMLINK) {
            return 'symlink';
        }
        return 'file';
    }

    private async getSftp(): Promise<SFTPWrapper> {
        return new Promise((resolve, reject) => {
            this.client.sftp((error, sftp) => {
                if (error || !sftp) {
                    reject(error ?? new Error('Failed to initialize SFTP session'));
                    return;
                }
                resolve(sftp);
            });
        });
    }

    private async ensureRemoteDir(sftp: SFTPWrapper, remoteDir: string): Promise<void> {
        const parts = remoteDir.split('/').filter(Boolean);
        let current = '';

        for (const part of parts) {
            current = current ? `${current}/${part}` : `/${part}`;
            // eslint-disable-next-line no-await-in-loop
            const exists = await this.statRemoteSafe(sftp, current);
            if (!exists) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise<void>((resolve) => {
                    sftp.mkdir(current, () => resolve());
                });
            }
        }
    }

    private resolveRemotePath(remotePath: string): string {
        const sanitized = sanitizePath(remotePath);
        const base = this.remoteRoot ? sanitizePath(this.remoteRoot) : '';
        const baseResolved = base ? path.posix.resolve(base) : '';
        const resolved = baseResolved
            ? path.posix.resolve(baseResolved, sanitized)
            : path.posix.resolve(sanitized);

        if (baseResolved) {
            const relative = path.posix.relative(baseResolved, resolved);
            if (relative.startsWith('..') || path.posix.isAbsolute(relative)) {
                this.logger.warn('Remote path traversal attempt blocked');
                throw new Error('Remote path is outside of configured root');
            }
        }

        return resolved;
    }

    private async statRemote(sftp: SFTPWrapper, remotePath: string): Promise<{ size?: number }> {
        return new Promise((resolve, reject) => {
            sftp.stat(remotePath, (error, stats) => {
                if (error || !stats) {
                    reject(error ?? new Error('Failed to stat remote file'));
                    return;
                }
                resolve(stats);
            });
        });
    }

    private async statRemoteSafe(
        sftp: SFTPWrapper,
        remotePath: string
    ): Promise<{ size?: number } | null> {
        return new Promise((resolve) => {
            sftp.stat(remotePath, (error, stats) => {
                if (error || !stats) {
                    resolve(null);
                    return;
                }
                resolve(stats);
            });
        });
    }
}
