# Project Context for Claude

## What You're Building

You are building **Secure SFTP** - a VS Code extension that provides secure SFTP file transfer functionality. This is an open-source project that prioritizes security above all else.

## Why This Exists

Existing VS Code SFTP extensions have compatibility issues (handshake errors, cipher mismatches) and questionable security practices (storing passwords in plaintext config files). This extension solves both problems by:

1. Using the `ssh2` library directly with full control over SSH algorithm negotiation
2. Implementing security best practices throughout (SecretStorage API, strict host key verification, etc.)

## Core Functionality

- Connect to remote servers via SSH/SFTP
- Upload and download files
- Sync local folders with remote servers
- Upload on save (optional)
- **File watcher** - Auto-sync on file create/change/delete (with debouncing)
- **Jump host support** - Connect through SSH proxy/bastion hosts
- All with modern security defaults and proper credential handling

## Key Security Principles

1. **Never store secrets in plaintext** - Use VS Code's SecretStorage API (OS keychain)
2. **Never log sensitive data** - No passwords, keys, or connection strings in logs
3. **Strict host key verification** - No auto-accept, alert on key changes (MITM protection)
4. **Modern algorithms only** - Reject weak ciphers and key exchange methods
5. **Validate all inputs** - Prevent path traversal and injection attacks
6. **Fail secure** - When in doubt, refuse the operation rather than proceed insecurely

## Tech Stack

- TypeScript (strict mode)
- VS Code Extension API
- `ssh2` npm package for SSH/SFTP
- Vitest for testing
- ESLint with security plugin

## Before You Start Coding

Read `plan.md` in this repository - it contains:
- Detailed project structure
- Security architecture and threat model
- Implementation details for each component
- Testing strategy
- Security hardening checklist

## Quick Reference

```
src/
├── extension.ts          # Entry point
├── core/
│   ├── ssh-manager.ts    # SSH connection management
│   ├── sftp-client.ts    # SFTP operations (upload, download, delete)
│   └── file-watcher.ts   # File system watcher for auto-sync
├── config/               # Configuration & secure storage
├── providers/            # VS Code integration
├── commands/             # User commands
└── utils/                # Validators, logging, helpers
```

## Important Files to Create First

1. `package.json` - Extension manifest with VS Code engine, commands, configuration schema
2. `tsconfig.json` - TypeScript config with strict mode
3. `src/extension.ts` - Activation/deactivation with cleanup
4. `src/config/secure-storage.ts` - Credential handling via SecretStorage
5. `src/core/ssh-manager.ts` - Connection management with secure defaults

## Commands

The extension provides:

- `secureSftp.connect` - Connect to server
- `secureSftp.disconnect` - Disconnect
- `secureSftp.uploadFile` - Upload current file
- `secureSftp.uploadFolder` - Upload folder
- `secureSftp.downloadFile` - Download file
- `secureSftp.sync` - Sync folders
- `secureSftp.setPassword` - Store credentials securely
- `secureSftp.setPassphrase` - Store private key passphrase
- `secureSftp.clearCredentials` - Remove stored credentials
- `secureSftp.viewHostKeys` - View/manage known hosts
- `secureSftp.configure` - Open settings

## File Watcher Configuration

Enable automatic file syncing by adding a `watcher` block to your config:

```json
{
    "secureSftp.configs": [{
        "name": "my-server",
        "host": "example.com",
        "watcher": {
            "files": "**/*",
            "autoUpload": true,
            "autoDelete": true,
            "debounceDelay": 500,
            "excludePatterns": ["**/test/**"]
        }
    }]
}
```

Default ignored patterns: `node_modules`, `.git`, `.svn`, `.DS_Store`, `Thumbs.db`, `*.swp`

## Testing Approach

- Unit test all validators and security-critical paths
- Integration test against a Docker SSH server
- Security tests to verify no credential leakage
- Target >80% coverage on security code

## When You Need to Make Security Decisions

Ask yourself:
- Could this expose credentials?
- Could this be exploited for path traversal?
- What happens if this input is malicious?
- Is this the most secure default?

If unsure, choose the more restrictive option.

---

Start by reading `plan.md`, then begin with Phase 1 (project setup) and work through sequentially.
