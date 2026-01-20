import { describe, expect, test, vi } from 'vitest';
import * as vscode from 'vscode';
import { HostKeyManager } from '../../src/config/host-key-manager';

function createContext() {
    const storage: Record<string, any> = {};
    return {
        globalState: {
            get: (key: string, defaultValue?: unknown) => {
                return key in storage ? storage[key] : defaultValue;
            },
            update: async (key: string, value: unknown) => {
                storage[key] = value;
            },
        },
    } as any;
}

describe('Host Key Prompt Security', () => {
    test('accepts and stores host key when user trusts', async () => {
        const context = createContext();
        const manager = new HostKeyManager(context);
        const key = Buffer.from('host-key');

        const showWarning = vi.mocked(vscode.window.showWarningMessage);
        showWarning.mockResolvedValueOnce('Yes, Trust This Host' as any);

        const accepted = await manager.promptUserForNewHost('example.com', 22, 'ssh-ed25519', key);

        expect(accepted).toBe(true);
        expect(await manager.isKnownHost('example.com', 22, 'ssh-ed25519', key)).toBe(true);
    });

    test('does not store host key when user cancels', async () => {
        const context = createContext();
        const manager = new HostKeyManager(context);
        const key = Buffer.from('host-key');

        const showWarning = vi.mocked(vscode.window.showWarningMessage);
        showWarning.mockResolvedValueOnce('No, Cancel Connection' as any);

        const accepted = await manager.promptUserForNewHost('example.com', 22, 'ssh-ed25519', key);

        expect(accepted).toBe(false);
        expect(await manager.isKnownHost('example.com', 22, 'ssh-ed25519', key)).toBe(false);
    });
});
