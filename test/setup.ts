import { vi } from 'vitest';

const commandRegistry = new Map<string, (...args: unknown[]) => unknown>();
const saveHandlers: Array<(document: any) => void | Promise<void>> = [];
const statusBarItems: any[] = [];

const createStatusBarItem = vi.fn(() => {
    const item = {
        text: '',
        tooltip: '',
        command: '',
        show: vi.fn(),
        dispose: vi.fn(),
    };
    statusBarItems.push(item);
    return item;
});

(globalThis as any).__vscodeCommandRegistry = commandRegistry;
(globalThis as any).__vscodeSaveHandlers = saveHandlers;
(globalThis as any).__vscodeStatusBarItems = statusBarItems;

vi.mock('vscode', () => ({
    ProgressLocation: {
        Notification: 15,
    },
    StatusBarAlignment: {
        Left: 1,
    },
    commands: {
        registerCommand: vi.fn((command: string, callback: (...args: unknown[]) => unknown) => {
            commandRegistry.set(command, callback);
            return { dispose: vi.fn() };
        }),
        executeCommand: vi.fn(async () => undefined),
    },
    window: {
        createOutputChannel: () => ({
            appendLine: vi.fn(),
            show: vi.fn(),
            dispose: vi.fn(),
        }),
        createStatusBarItem,
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showInputBox: vi.fn(),
        showQuickPick: vi.fn(),
        showOpenDialog: vi.fn(),
        showSaveDialog: vi.fn(),
        withProgress: vi.fn(async (_opts: unknown, task: any) => task({ report: vi.fn() })),
        activeTextEditor: null,
    },
    workspace: {
        getConfiguration: vi.fn(() => ({
            get: vi.fn(),
        })),
        onDidSaveTextDocument: vi.fn((handler: any) => {
            saveHandlers.push(handler);
            return { dispose: vi.fn() };
        }),
        workspaceFolders: [],
    },
}));
