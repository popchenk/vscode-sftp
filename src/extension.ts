import * as vscode from 'vscode';

/**
 * Extension activation function.
 * Called when the extension is activated (first command executed or activation event occurs).
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Secure SFTP extension is now active');

    // TODO: Initialize managers and register commands in Phase 3
    // - Initialize SecretStorage for credentials
    // - Initialize SSH Manager
    // - Initialize Config Manager
    // - Register all commands
    // - Set up status bar

    // Placeholder command registration
    const disposable = vscode.commands.registerCommand('secureSftp.connect', () => {
        void vscode.window.showInformationMessage(
            'Secure SFTP: Connect command (not yet implemented)'
        );
    });

    context.subscriptions.push(disposable);
}

/**
 * Extension deactivation function.
 * Called when the extension is deactivated.
 * CRITICAL: Must clean up all connections and clear sensitive data.
 */
export function deactivate(): void {
    console.log('Secure SFTP extension is being deactivated');

    // TODO: Implement cleanup in Phase 3
    // - Disconnect all SSH connections
    // - Clear sensitive data from memory
    // - Dispose of all resources
}
