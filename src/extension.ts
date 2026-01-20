import * as path from 'path';
import * as vscode from 'vscode';
import { ConfigManager } from './config/config-manager';
import { HostKeyManager } from './config/host-key-manager';
import { SecureStorage } from './config/secure-storage';
import { SFTPClient } from './core/sftp-client';
import { SSHManager } from './core/ssh-manager';
import { getLogger, initLogger } from './utils/logger';
import { LogLevel } from './types';

/**
 * Extension activation function.
 * Called when the extension is activated (first command executed or activation event occurs).
 */
let sshManager: SSHManager | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

export function activate(context: vscode.ExtensionContext): void {
    const configuration = vscode.workspace.getConfiguration('secureSftp');
    const logLevel = configuration.get<LogLevel>('logLevel', 'info');
    initLogger(logLevel);

    const configManager = new ConfigManager();
    const logger = getLogger();

    const secureStorage = new SecureStorage(context.secrets);
    const hostKeyManager = new HostKeyManager(context);
    sshManager = new SSHManager(secureStorage, hostKeyManager);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = 'Secure SFTP: Disconnected';
    statusBarItem.command = 'secureSftp.connect';
    statusBarItem.show();

    const connectCommand = vscode.commands.registerCommand('secureSftp.connect', async () => {
        const manager = sshManager;
        const config = await configManager.pickConfig();
        if (!config || !manager) {
            return;
        }

        try {
            await manager.connect(config);
            updateStatus('connected', config);
            void vscode.window.showInformationMessage(
                `Secure SFTP connected to ${config.host}:${config.port}`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            updateStatus('error', config, message);
            void vscode.window.showErrorMessage(`Secure SFTP connect failed: ${message}`);
        }
    });

    const disconnectCommand = vscode.commands.registerCommand('secureSftp.disconnect', async () => {
        const manager = sshManager;
        if (!manager) {
            return;
        }

        const config = await configManager.pickConfig();
        if (!config) {
            return;
        }

        try {
            await manager.disconnectByConfig(config);
            updateStatus('disconnected');
            void vscode.window.showInformationMessage(
                `Secure SFTP disconnected from ${config.host}:${config.port}`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            updateStatus('error', config, message);
            void vscode.window.showErrorMessage(`Secure SFTP disconnect failed: ${message}`);
        }
    });

    const setPasswordCommand = vscode.commands.registerCommand(
        'secureSftp.setPassword',
        async () => {
            const config = await configManager.pickConfig();
            if (!config) {
                return;
            }

            const password = await vscode.window.showInputBox({
                prompt: `Enter password for ${config.username}@${config.host}`,
                password: true,
                ignoreFocusOut: true,
            });

            if (!password) {
                return;
            }

            try {
                await secureStorage.storePassword(config.host, config.username, password);
                void vscode.window.showInformationMessage(
                    `Secure SFTP stored credentials for ${config.username}@${config.host}`
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                void vscode.window.showErrorMessage(`Secure SFTP credential store failed: ${message}`);
            }
        }
    );

    const clearCredentialsCommand = vscode.commands.registerCommand(
        'secureSftp.clearCredentials',
        async () => {
            const config = await configManager.pickConfig();
            if (!config) {
                return;
            }

            try {
                await secureStorage.deleteCredentials(config.host, config.username);
                void vscode.window.showInformationMessage(
                    `Secure SFTP cleared credentials for ${config.username}@${config.host}`
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                void vscode.window.showErrorMessage(`Secure SFTP credential clear failed: ${message}`);
            }
        }
    );

    const uploadFileCommand = vscode.commands.registerCommand('secureSftp.uploadFile', async () => {
        const manager = sshManager;
        if (!manager) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'file') {
            void vscode.window.showWarningMessage('No local file open to upload.');
            return;
        }

        const config = await configManager.pickConfig();
        if (!config) {
            return;
        }

        const localPath = editor.document.uri.fsPath;
        const remoteFileName = path.posix.basename(localPath);

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Uploading ${remoteFileName}`,
                    cancellable: false,
                },
                async (progress) => {
                    let lastPercent = 0;
                    const client = await manager.connect(config);
                    const sftp = new SFTPClient(client, config.remotePath);
                    await sftp.upload(localPath, remoteFileName, {
                        onProgress: (transferred, total) => {
                            if (total > 0) {
                                const percent = (transferred / total) * 100;
                                progress.report({ increment: percent - lastPercent });
                                lastPercent = percent;
                            }
                        },
                    });
                }
            );
            void vscode.window.showInformationMessage(
                `Secure SFTP uploaded ${remoteFileName} to ${config.host}`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            void vscode.window.showErrorMessage(`Secure SFTP upload failed: ${message}`);
        }
    });

    const uploadFolderCommand = vscode.commands.registerCommand(
        'secureSftp.uploadFolder',
        async () => {
            const manager = sshManager;
            if (!manager) {
                return;
            }

            const config = await configManager.pickConfig();
            if (!config) {
                return;
            }

            const selection = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: 'Select Folder to Upload',
            });

            if (!selection || selection.length === 0) {
                return;
            }

            const localDir = selection[0].fsPath;
            const folderName = path.posix.basename(localDir);
            const remoteDir = path.posix.join(config.remotePath, folderName);

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Uploading folder ${folderName}`,
                        cancellable: false,
                    },
                    async () => {
                        const client = await manager.connect(config);
                        const sftp = new SFTPClient(client, config.remotePath);
                        await sftp.uploadDirectory(localDir, remoteDir);
                    }
                );
                void vscode.window.showInformationMessage(
                    `Secure SFTP uploaded ${folderName} to ${config.host}`
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                void vscode.window.showErrorMessage(`Secure SFTP upload failed: ${message}`);
            }
        }
    );

    const downloadFileCommand = vscode.commands.registerCommand(
        'secureSftp.downloadFile',
        async () => {
            const manager = sshManager;
            if (!manager) {
                return;
            }

            const config = await configManager.pickConfig();
            if (!config) {
                return;
            }

            const remotePath = await vscode.window.showInputBox({
                prompt: 'Enter remote file path to download',
                value: config.remotePath,
                ignoreFocusOut: true,
            });

            if (!remotePath) {
                return;
            }

            const defaultFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: defaultFolder,
                saveLabel: 'Download',
            });

            if (!saveUri) {
                return;
            }

            const localPath = saveUri.fsPath;
            const remoteName = path.posix.basename(remotePath);

            try {
                await vscode.window.withProgress(
                    {
                        location: vscode.ProgressLocation.Notification,
                        title: `Downloading ${remoteName}`,
                        cancellable: false,
                    },
                    async (progress) => {
                        let lastPercent = 0;
                        const client = await manager.connect(config);
                        const sftp = new SFTPClient(client, config.remotePath);
                        await sftp.download(remotePath, localPath, {
                            onProgress: (transferred, total) => {
                                if (total > 0) {
                                    const percent = (transferred / total) * 100;
                                    progress.report({ increment: percent - lastPercent });
                                    lastPercent = percent;
                                }
                            },
                        });
                    }
                );
                void vscode.window.showInformationMessage(
                    `Secure SFTP downloaded ${remoteName} from ${config.host}`
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                void vscode.window.showErrorMessage(`Secure SFTP download failed: ${message}`);
            }
        }
    );

    const syncCommand = vscode.commands.registerCommand('secureSftp.sync', async () => {
        const manager = sshManager;
        if (!manager) {
            return;
        }

        const config = await configManager.pickConfig();
        if (!config) {
            return;
        }

        const selection = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Local Folder to Sync',
        });

        if (!selection || selection.length === 0) {
            return;
        }

        const localDir = selection[0].fsPath;
        const folderName = path.posix.basename(localDir);
        const remoteDir = path.posix.join(config.remotePath, folderName);

        try {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Syncing ${folderName}`,
                    cancellable: false,
                },
                async () => {
                    const client = await manager.connect(config);
                    const sftp = new SFTPClient(client, config.remotePath);
                    await sftp.syncDirectory(localDir, remoteDir);
                }
            );
            void vscode.window.showInformationMessage(
                `Secure SFTP sync complete for ${folderName}`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            void vscode.window.showErrorMessage(`Secure SFTP sync failed: ${message}`);
        }
    });

    const configureCommand = vscode.commands.registerCommand('secureSftp.configure', async () => {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'secureSftp');
    });

    const viewHostKeysCommand = vscode.commands.registerCommand(
        'secureSftp.viewHostKeys',
        async () => {
            const entries = await hostKeyManager.listHostKeys();
            if (entries.length === 0) {
                void vscode.window.showInformationMessage('No known hosts stored yet.');
                return;
            }

            const picks = entries.map((entry) => ({
                label: `${entry.host}:${entry.port} (${entry.keyType})`,
                description: entry.fingerprint,
                entry,
            }));

            const selected = await vscode.window.showQuickPick(picks, {
                placeHolder: 'Select a host key to view or remove',
            });

            if (!selected) {
                return;
            }

            const detail = `Fingerprint: ${selected.entry.fingerprint}\nFirst seen: ${selected.entry.firstSeen.toISOString()}\nLast seen: ${selected.entry.lastSeen.toISOString()}`;
            const action = await vscode.window.showWarningMessage(
                detail,
                { modal: true },
                'Remove Host Key',
                'Close'
            );

            if (action === 'Remove Host Key') {
                await hostKeyManager.removeHostKey(selected.entry.host, selected.entry.port);
                void vscode.window.showInformationMessage(
                    `Removed host keys for ${selected.entry.host}:${selected.entry.port}`
                );
            }
        }
    );

    const uploadOnSaveListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.uri.scheme !== 'file') {
            return;
        }

        const manager = sshManager;
        if (!manager) {
            return;
        }

        const settings = configManager.getGlobalSettings();
        const configs = configManager.getConfigs();
        if (configs.length === 0) {
            return;
        }

        const config =
            configs.find((entry) => entry.uploadOnSave) ||
            (settings.uploadOnSave ? configs[0] : undefined);

        if (!config) {
            return;
        }

        const localPath = document.uri.fsPath;
        const remoteFileName = path.posix.basename(localPath);

        try {
            const client = await manager.connect(config);
            const sftp = new SFTPClient(client, config.remotePath);
            await sftp.upload(localPath, remoteFileName);
            updateStatus('connected', config);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger.warn(`Upload on save failed: ${message}`);
            updateStatus('error', config, message);
        }
    });

    context.subscriptions.push(
        connectCommand,
        disconnectCommand,
        setPasswordCommand,
        clearCredentialsCommand,
        uploadFileCommand,
        uploadFolderCommand,
        downloadFileCommand,
        syncCommand,
        configureCommand,
        viewHostKeysCommand,
        uploadOnSaveListener,
        statusBarItem
    );
}

/**
 * Extension deactivation function.
 * Called when the extension is deactivated.
 * CRITICAL: Must clean up all connections and clear sensitive data.
 */
export async function deactivate(): Promise<void> {
    if (sshManager) {
        await sshManager.disconnectAll();
        sshManager = null;
    }

    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
    }
}

function updateStatus(
    state: 'connected' | 'disconnected' | 'error',
    config?: { host: string; port: number },
    errorMessage?: string
): void {
    if (!statusBarItem) {
        return;
    }

    if (state === 'connected' && config) {
        statusBarItem.text = `Secure SFTP: ${config.host}:${config.port}`;
        statusBarItem.tooltip = 'Secure SFTP connected';
        statusBarItem.command = 'secureSftp.disconnect';
        return;
    }

    if (state === 'error') {
        statusBarItem.text = 'Secure SFTP: Error';
        statusBarItem.tooltip = errorMessage || 'Secure SFTP error';
        statusBarItem.command = 'secureSftp.connect';
        return;
    }

    statusBarItem.text = 'Secure SFTP: Disconnected';
    statusBarItem.tooltip = 'Secure SFTP disconnected';
    statusBarItem.command = 'secureSftp.connect';
}
