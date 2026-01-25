const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
    if (id === 'vscode') {
        return {
            window: {
                showInformationMessage: () => { },
                createOutputChannel: () => ({
                    appendLine: console.log,
                    show: () => { },
                    dispose: () => { }
                })
            },
            workspace: { getConfiguration: () => ({ get: () => undefined }) }
        };
    }
    return originalRequire.call(this, id);
};
console.log('VS Code mocked');
