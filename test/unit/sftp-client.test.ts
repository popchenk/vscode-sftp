import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, test, vi } from 'vitest';
import { SFTPClient } from '../../src/core/sftp-client';

function createClient(mockSftp: any) {
    return {
        sftp: (callback: (error: Error | undefined, sftp?: any) => void) => {
            callback(undefined, mockSftp);
        },
    } as any;
}

describe('SFTPClient', () => {
    test('uploads with progress and file size', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sftp-client-'));
        const localPath = path.join(tempDir, 'file.txt');
        await fs.writeFile(localPath, 'hello');

        const fastPut = vi.fn(
            (local: string, remote: string, options: any, cb: (err?: Error) => void) => {
                options.step?.(5, 1, options.fileSize);
                cb();
            }
        );

        const mockSftp = { fastPut };
        const client = createClient(mockSftp);
        const sftpClient = new SFTPClient(client, '/remote/root');

        let progressTotal = 0;
        await sftpClient.upload(localPath, 'file.txt', {
            onProgress: (transferred, total) => {
                progressTotal = total;
            },
        });

        expect(fastPut).toHaveBeenCalled();
        const options = fastPut.mock.calls[0][2];
        expect(options.fileSize).toBe(5);
        expect(progressTotal).toBe(5);
    });

    test('downloads with progress and file size', async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sftp-client-'));
        const localPath = path.join(tempDir, 'download.txt');

        const stat = vi.fn((_path: string, cb: (err?: Error, stats?: any) => void) => {
            cb(undefined, { size: 10 });
        });
        const fastGet = vi.fn(
            (remote: string, local: string, options: any, cb: (err?: Error) => void) => {
                options.step?.(10, 1, options.fileSize);
                cb();
            }
        );

        const mockSftp = { stat, fastGet };
        const client = createClient(mockSftp);
        const sftpClient = new SFTPClient(client, '/remote/root');

        let progressTotal = 0;
        await sftpClient.download('/remote/root/remote.txt', localPath, {
            onProgress: (transferred, total) => {
                progressTotal = total;
            },
        });

        expect(fastGet).toHaveBeenCalled();
        const options = fastGet.mock.calls[0][2];
        expect(options.fileSize).toBe(10);
        expect(progressTotal).toBe(10);
    });

    test('blocks remote path traversal', async () => {
        const mockSftp = {
            fastPut: vi.fn((_local: string, _remote: string, _options: any, cb: () => void) => {
                cb();
            }),
        };

        const client = createClient(mockSftp);
        const sftpClient = new SFTPClient(client, '/remote/root');

        await expect(sftpClient.upload('/tmp/file.txt', '../etc/passwd')).rejects.toThrow(
            'Remote path is outside of configured root'
        );
    });

    test('lists directory entries', async () => {
        const readdir = vi.fn((_path: string, cb: (err?: Error, list?: any[]) => void) => {
            cb(undefined, [
                {
                    filename: 'file.txt',
                    longname: '',
                    attrs: {
                        mode: 0o100644,
                        size: 12,
                        uid: 1000,
                        gid: 1000,
                        atime: 1,
                        mtime: 2,
                    },
                },
            ]);
        });

        const mockSftp = { readdir };
        const client = createClient(mockSftp);
        const sftpClient = new SFTPClient(client, '/remote/root');

        const entries = await sftpClient.listDirectory('/remote/root');
        expect(entries).toHaveLength(1);
        expect(entries[0].name).toBe('file.txt');
        expect(entries[0].type).toBe('file');
    });
});
