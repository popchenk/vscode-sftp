import { describe, expect, test, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { activate, deactivate } from '../../src/extension';

const connectMock = vi.fn(async () => ({}));
const disconnectMock = vi.fn(async () => undefined);

vi.mock('../../src/core/ssh-manager', () => ({
    SSHManager: class {
        connect = connectMock;
        disconnectByConfig = disconnectMock;
        disconnectAll = vi.fn(async () => undefined);
    },
}));

const uploadMock = vi.fn(async () => undefined);
vi.mock('../../src/core/sftp-client', () => ({
    SFTPClient: class {
        upload = uploadMock;
        download = vi.fn(async () => undefined);
        constructor() {}
    },
}));

describe('Extension activation', () => {
    beforeEach(() => {
        connectMock.mockClear();
        disconnectMock.mockClear();
        uploadMock.mockClear();

        const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);
        getConfiguration.mockReturnValue({
            get: (key: string, defaultValue?: unknown) => {
                if (key === 'logLevel') {
                    return 'info';
                }
                if (key === 'uploadOnSave') {
                    return true;
                }
                if (key === 'configs') {
                    return [
                        {
                            name: 'Test',
                            host: 'example.com',
                            port: 22,
                            username: 'user',
                            remotePath: '/remote',
                            authMethod: 'password',
                            uploadOnSave: true,
                        },
                    ];
                }
                return defaultValue;
            },
        } as any);
    });

    test('registers commands and updates status on connect', async () => {
        const context = { secrets: {}, subscriptions: [] as any[] };
        activate(context as any);

        const registry = (globalThis as any).__vscodeCommandRegistry as Map<
            string,
            (...args: unknown[]) => unknown
        >;
        const statusItems = (globalThis as any).__vscodeStatusBarItems as any[];
        const statusBar = statusItems[statusItems.length - 1];

        const connectCommand = registry.get('secureSftp.connect');
        expect(connectCommand).toBeTruthy();

        await connectCommand?.();
        expect(connectMock).toHaveBeenCalled();
        expect(statusBar.text).toContain('example.com');
    });

    test('uploads on save when enabled', async () => {
        const context = { secrets: {}, subscriptions: [] as any[] };
        activate(context as any);

        const saveHandlers = (globalThis as any).__vscodeSaveHandlers as Array<
            (document: any) => void | Promise<void>
        >;

        const document = {
            uri: {
                scheme: 'file',
                fsPath: '/tmp/file.txt',
            },
        };

        await saveHandlers[0]?.(document);
        expect(uploadMock).toHaveBeenCalled();

        await deactivate();
    });
});
