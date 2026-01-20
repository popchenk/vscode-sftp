import { describe, expect, test, vi } from 'vitest';
import * as vscode from 'vscode';
import { ConfigManager } from '../../src/config/config-manager';
import { SFTPConfig } from '../../src/types';

describe('ConfigManager', () => {
    test('returns global settings from configuration', () => {
        const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);
        getConfiguration.mockReturnValue({
            get: (key: string, defaultValue?: unknown) => {
                if (key === 'strictHostKeyChecking') {
                    return false;
                }
                if (key === 'logLevel') {
                    return 'debug';
                }
                if (key === 'uploadOnSave') {
                    return true;
                }
                return defaultValue;
            },
        } as any);

        const manager = new ConfigManager();
        const settings = manager.getGlobalSettings();

        expect(settings.strictHostKeyChecking).toBe(true);
        expect(settings.logLevel).toBe('debug');
        expect(settings.uploadOnSave).toBe(true);
    });

    test('filters invalid configs and normalizes ports', () => {
        const validConfig: SFTPConfig = {
            name: 'Valid',
            host: 'example.com',
            port: 0,
            username: 'user',
            remotePath: '/var/www',
            authMethod: 'password',
        };

        const invalidConfig: SFTPConfig = {
            name: 'Invalid',
            host: 'localhost',
            port: 22,
            username: 'user',
            remotePath: '/var/www',
            authMethod: 'password',
        };

        const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);
        getConfiguration.mockReturnValue({
            get: (key: string, defaultValue?: unknown) => {
                if (key === 'configs') {
                    return [validConfig, invalidConfig];
                }
                return defaultValue;
            },
        } as any);

        const manager = new ConfigManager();
        const configs = manager.getConfigs();

        expect(configs).toHaveLength(1);
        expect(configs[0].host).toBe('example.com');
        expect(configs[0].port).toBe(22);
    });

    test('uses quick pick when multiple configs exist', async () => {
        const configs: SFTPConfig[] = [
            {
                name: 'First',
                host: 'example.com',
                port: 22,
                username: 'user',
                remotePath: '/var/www',
                authMethod: 'password',
            },
            {
                name: 'Second',
                host: 'example.org',
                port: 22,
                username: 'user2',
                remotePath: '/srv',
                authMethod: 'password',
            },
        ];

        const getConfiguration = vi.mocked(vscode.workspace.getConfiguration);
        getConfiguration.mockReturnValue({
            get: (key: string, defaultValue?: unknown) => {
                if (key === 'configs') {
                    return configs;
                }
                return defaultValue;
            },
        } as any);

        const showQuickPick = vi.mocked(vscode.window.showQuickPick);
        showQuickPick.mockResolvedValueOnce({
            label: 'Second',
            description: 'example.org:22',
            config: configs[1],
        } as any);

        const manager = new ConfigManager();
        const selection = await manager.pickConfig();

        expect(selection?.host).toBe('example.org');
        expect(showQuickPick).toHaveBeenCalled();
    });
});
