import * as vscode from 'vscode';
import { DEFAULT_SSH_CONFIG } from './ssh-config';
import { getLogger } from '../utils/logger';
import { isValidHost, isValidPort, isValidUsername } from '../utils/validators';
import { LogLevel, SFTPConfig } from '../types';

const AUTH_METHODS = new Set<SFTPConfig['authMethod']>(['password', 'privateKey', 'agent']);

export interface GlobalSettings {
    strictHostKeyChecking: boolean;
    logLevel: LogLevel;
    uploadOnSave: boolean;
}

export class ConfigManager {
    private logger = getLogger();

    getGlobalSettings(): GlobalSettings {
        const config = vscode.workspace.getConfiguration('secureSftp');
        const strictHostKeyChecking = config.get<boolean>('strictHostKeyChecking', true);

        if (strictHostKeyChecking === false) {
            this.logger.warn(
                'strictHostKeyChecking is disabled in settings but will be enforced for security.'
            );
        }

        return {
            strictHostKeyChecking: true,
            logLevel: config.get<LogLevel>('logLevel', 'info'),
            uploadOnSave: config.get<boolean>('uploadOnSave', false),
        };
    }

    getConfigs(): SFTPConfig[] {
        const config = vscode.workspace.getConfiguration('secureSftp');
        const configs = config.get<SFTPConfig[]>('configs', []);

        const validated: SFTPConfig[] = [];
        for (const entry of configs) {
            const normalized = this.normalizeConfig(entry);
            if (this.isValidConfig(normalized)) {
                validated.push(normalized);
            }
        }

        if (validated.length === 0 && configs.length > 0) {
            this.logger.warn('No valid Secure SFTP configurations found in settings');
        }

        return validated;
    }

    async pickConfig(): Promise<SFTPConfig | undefined> {
        const configs = this.getConfigs();
        if (configs.length === 0) {
            void vscode.window.showWarningMessage(
                'No Secure SFTP configurations found. Add one in Settings under secureSftp.configs.'
            );
            return undefined;
        }

        if (configs.length === 1) {
            return configs[0];
        }

        const picks = configs.map((config) => ({
            label: config.name || `${config.username}@${config.host}`,
            description: `${config.host}:${config.port}`,
            config,
        }));

        const selected = await vscode.window.showQuickPick(picks, {
            placeHolder: 'Select a Secure SFTP configuration',
        });

        return selected?.config;
    }

    private normalizeConfig(config: SFTPConfig): SFTPConfig {
        const port = config.port || DEFAULT_SSH_CONFIG.port || 22;
        return { ...config, port };
    }

    private isValidConfig(config: SFTPConfig): boolean {
        if (!config.name || typeof config.name !== 'string') {
            this.logger.warn('SFTP config missing name');
            return false;
        }

        if (!isValidHost(config.host)) {
            this.logger.warn(`Invalid host in config "${config.name}"`);
            return false;
        }

        if (!isValidPort(config.port)) {
            this.logger.warn(`Invalid port in config "${config.name}"`);
            return false;
        }

        if (!isValidUsername(config.username)) {
            this.logger.warn(`Invalid username in config "${config.name}"`);
            return false;
        }

        if (!config.remotePath || typeof config.remotePath !== 'string') {
            this.logger.warn(`Invalid remotePath in config "${config.name}"`);
            return false;
        }

        if (!AUTH_METHODS.has(config.authMethod)) {
            this.logger.warn(`Invalid authMethod in config "${config.name}"`);
            return false;
        }

        if (config.authMethod === 'privateKey' && !config.privateKeyPath) {
            this.logger.warn(`Missing privateKeyPath in config "${config.name}"`);
            return false;
        }

        if (config.strictHostKeyChecking === false) {
            this.logger.warn(
                `strictHostKeyChecking is disabled in config "${config.name}" but will be enforced.`
            );
        }

        return true;
    }
}
