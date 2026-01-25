import * as path from 'path';
import * as vscode from 'vscode';
import { SFTPClient } from './sftp-client';
import { SSHManager } from './ssh-manager';
import { getLogger } from '../utils/logger';
import {
    SFTPConfig,
    WatcherConfig,
    WatcherEvent,
    WatcherEventType,
    BatchOperationResult,
} from '../types';

/**
 * Default patterns to ignore when watching files.
 */
const DEFAULT_IGNORE_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.svn/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.swp',
];

/**
 * Default debounce delay in milliseconds.
 */
const DEFAULT_DEBOUNCE_DELAY = 500;

/**
 * Threshold for delete confirmation.
 */
const DELETE_CONFIRMATION_THRESHOLD = 5;

interface PendingEvent {
    event: WatcherEvent;
    configName: string;
}

/**
 * File watcher that monitors local file changes and syncs them to remote SFTP servers.
 * Handles debouncing, batch processing, and delete confirmation.
 */
export class FileWatcher {
    private logger = getLogger();
    private watchers: vscode.FileSystemWatcher[] = [];
    private pendingEvents: Map<string, PendingEvent> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
    private processingPromise: Promise<void> | null = null;
    private configMap: Map<string, { config: SFTPConfig; workspaceRoot: string }> = new Map();

    constructor(
        private readonly sshManager: SSHManager,
        private readonly getGlobalSettings: () => { allowLocalhost?: boolean }
    ) {}

    /**
     * Start watching for file changes based on the configuration.
     * @param workspaceRoot Root path of the workspace
     * @param config SFTP configuration with watcher settings
     */
    startWatching(workspaceRoot: string, config: SFTPConfig): void {
        if (!config.watcher) {
            return;
        }

        const watcherConfig = config.watcher;
        this.logger.info(`Starting file watcher for ${config.name}: ${watcherConfig.files}`);

        // Store config for later use
        this.configMap.set(config.name, { config, workspaceRoot });

        // Create the VS Code file system watcher
        const pattern = new vscode.RelativePattern(workspaceRoot, watcherConfig.files);
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);

        if (watcherConfig.autoUpload) {
            watcher.onDidCreate((uri) => {
                this.handleFileEvent('create', uri, config.name, workspaceRoot, watcherConfig);
            });
            watcher.onDidChange((uri) => {
                this.handleFileEvent('change', uri, config.name, workspaceRoot, watcherConfig);
            });
        }

        if (watcherConfig.autoDelete) {
            watcher.onDidDelete((uri) => {
                this.handleFileEvent('delete', uri, config.name, workspaceRoot, watcherConfig);
            });
        }

        this.watchers.push(watcher);
        this.logger.info(`File watcher active for ${config.name}`);
    }

    /**
     * Stop all file watchers and clear pending events.
     */
    stopWatching(): void {
        this.logger.info('Stopping all file watchers');

        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();

        // Dispose all watchers
        for (const watcher of this.watchers) {
            watcher.dispose();
        }
        this.watchers = [];

        // Clear pending events
        this.pendingEvents.clear();
        this.configMap.clear();
    }

    /**
     * Handle a file system event.
     */
    private handleFileEvent(
        type: WatcherEventType,
        uri: vscode.Uri,
        configName: string,
        workspaceRoot: string,
        watcherConfig: WatcherConfig
    ): void {
        const localPath = uri.fsPath;
        const relativePath = path.relative(workspaceRoot, localPath);

        // Check ignore patterns
        if (this.shouldIgnore(relativePath, watcherConfig)) {
            this.logger.debug(`Ignoring file: ${relativePath}`);
            return;
        }

        const event: WatcherEvent = {
            type,
            localPath,
            relativePath,
            timestamp: new Date(),
        };

        this.queueEvent(event, configName, watcherConfig);
    }

    /**
     * Check if a path should be ignored based on patterns.
     */
    private shouldIgnore(relativePath: string, watcherConfig: WatcherConfig): boolean {
        const patterns = [
            ...DEFAULT_IGNORE_PATTERNS,
            ...(watcherConfig.excludePatterns || []),
        ];

        // Normalize path separators for matching
        const normalizedPath = relativePath.replace(/\\/g, '/');

        for (const pattern of patterns) {
            if (this.matchPattern(normalizedPath, pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob pattern matching.
     */
    private matchPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.')
            .replace(/{{GLOBSTAR}}/g, '.*');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(filePath);
    }

    /**
     * Queue an event with debouncing.
     */
    private queueEvent(
        event: WatcherEvent,
        configName: string,
        watcherConfig: WatcherConfig
    ): void {
        const key = `${configName}:${event.relativePath}`;
        const debounceDelay = watcherConfig.debounceDelay ?? DEFAULT_DEBOUNCE_DELAY;

        // Clear existing timer for this file
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Store/update the pending event (newer events override older ones)
        this.pendingEvents.set(key, { event, configName });

        this.logger.debug(`Queued ${event.type} event for ${event.relativePath}`);

        // Set debounce timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(key);
            this.triggerProcessing();
        }, debounceDelay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Trigger processing of pending events.
     */
    private triggerProcessing(): void {
        // If already processing, the current run will pick up new events
        if (this.processingPromise) {
            return;
        }

        this.processingPromise = this.processPendingEvents().finally(() => {
            this.processingPromise = null;

            // Check if more events were added during processing
            if (this.pendingEvents.size > 0 && this.debounceTimers.size === 0) {
                this.triggerProcessing();
            }
        });
    }

    /**
     * Process all pending events.
     */
    private async processPendingEvents(): Promise<void> {
        // Collect events that are ready (no pending debounce timer)
        const readyEvents: PendingEvent[] = [];
        for (const [key, pending] of this.pendingEvents.entries()) {
            if (!this.debounceTimers.has(key)) {
                readyEvents.push(pending);
                this.pendingEvents.delete(key);
            }
        }

        if (readyEvents.length === 0) {
            return;
        }

        this.logger.info(`Processing ${readyEvents.length} file events`);

        // Group events by config
        const eventsByConfig = new Map<string, WatcherEvent[]>();
        for (const { event, configName } of readyEvents) {
            const events = eventsByConfig.get(configName) || [];
            events.push(event);
            eventsByConfig.set(configName, events);
        }

        // Process each config's events
        for (const [configName, events] of eventsByConfig) {
            await this.processConfigEvents(configName, events);
        }
    }

    /**
     * Process events for a specific configuration.
     */
    private async processConfigEvents(
        configName: string,
        events: WatcherEvent[]
    ): Promise<void> {
        const configData = this.configMap.get(configName);
        if (!configData) {
            this.logger.warn(`Config not found: ${configName}`);
            return;
        }

        const { config } = configData;
        const deleteEvents = events.filter((e) => e.type === 'delete');
        const uploadEvents = events.filter((e) => e.type !== 'delete');

        // Confirm bulk deletes
        if (deleteEvents.length > DELETE_CONFIRMATION_THRESHOLD) {
            const confirmed = await this.confirmBulkDelete(deleteEvents.length, config.name);
            if (!confirmed) {
                this.logger.info(`Bulk delete cancelled by user for ${config.name}`);
                // Remove delete events, keep uploads
                events = uploadEvents;
            }
        }

        if (events.length === 0) {
            return;
        }

        // Show progress notification
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Syncing ${events.length} file${events.length === 1 ? '' : 's'} to ${config.name}`,
                cancellable: false,
            },
            async (progress) => {
                const result = await this.executeEvents(config, events, progress);
                this.reportResult(config.name, result);
            }
        );
    }

    /**
     * Show confirmation dialog for bulk deletes.
     */
    private async confirmBulkDelete(count: number, configName: string): Promise<boolean> {
        const result = await vscode.window.showWarningMessage(
            `About to delete ${count} files from ${configName}. Continue?`,
            { modal: true },
            'Delete',
            'Cancel'
        );
        return result === 'Delete';
    }

    /**
     * Execute the file events (upload/delete).
     */
    private async executeEvents(
        config: SFTPConfig,
        events: WatcherEvent[],
        progress: vscode.Progress<{ increment?: number; message?: string }>
    ): Promise<BatchOperationResult> {
        const result: BatchOperationResult = {
            successful: [],
            failed: [],
            skipped: [],
        };

        let client;
        let sftp: SFTPClient;

        try {
            const settings = this.getGlobalSettings();
            client = await this.sshManager.connect(config, {
                allowLocalhost: settings.allowLocalhost,
            });
            sftp = new SFTPClient(client, config.remotePath);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to connect for file watcher: ${message}`);
            // Mark all events as failed
            for (const event of events) {
                result.failed.push({ path: event.relativePath, error: message });
            }
            return result;
        }

        const increment = 100 / events.length;

        for (const event of events) {
            progress.report({ message: event.relativePath });

            // Normalize path separators for remote (always use forward slashes)
            const remotePath = event.relativePath.replace(/\\/g, '/');

            try {
                if (event.type === 'delete') {
                    await sftp.deleteFile(remotePath);
                    this.logger.info(`Deleted: ${remotePath}`);
                } else {
                    // Ensure parent directory exists before upload
                    const remoteDir = path.posix.dirname(remotePath);
                    if (remoteDir && remoteDir !== '.') {
                        await sftp.ensureDirectory(remoteDir);
                    }
                    await sftp.upload(event.localPath, remotePath);
                    this.logger.info(`Uploaded: ${remotePath}`);
                }
                result.successful.push(event.relativePath);
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(`Failed to sync ${event.relativePath}: ${message}`);
                result.failed.push({ path: event.relativePath, error: message });
            }

            progress.report({ increment });
        }

        return result;
    }

    /**
     * Report the result of batch operations.
     */
    private reportResult(configName: string, result: BatchOperationResult): void {
        const total = result.successful.length + result.failed.length + result.skipped.length;

        if (result.failed.length === 0) {
            void vscode.window.showInformationMessage(
                `Synced ${result.successful.length} file${result.successful.length === 1 ? '' : 's'} to ${configName}`
            );
        } else if (result.successful.length === 0) {
            void vscode.window.showErrorMessage(
                `Failed to sync ${result.failed.length} file${result.failed.length === 1 ? '' : 's'} to ${configName}`
            );
        } else {
            void vscode.window.showWarningMessage(
                `Synced ${result.successful.length}/${total} files to ${configName} (${result.failed.length} failed)`
            );
        }

        // Log details
        this.logger.info(
            `Sync complete for ${configName}: ${result.successful.length} succeeded, ` +
            `${result.failed.length} failed, ${result.skipped.length} skipped`
        );

        for (const failure of result.failed) {
            this.logger.warn(`  Failed: ${failure.path} - ${failure.error}`);
        }
    }

    /**
     * Get disposables for cleanup.
     */
    getDisposables(): vscode.Disposable[] {
        return this.watchers;
    }
}
