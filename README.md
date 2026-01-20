# Secure SFTP for VS Code

[![CI](https://github.com/popchenk/vscode-sftp/workflows/CI/badge.svg)](https://github.com/popchenk/vscode-sftp/actions)
[![Security Audit](https://github.com/popchenk/vscode-sftp/workflows/Security%20Audit/badge.svg)](https://github.com/popchenk/vscode-sftp/actions)

A VS Code extension that provides **secure** SFTP file transfer capabilities with modern security practices.

## Why This Extension?

Existing VS Code SFTP extensions have compatibility issues (handshake errors, cipher mismatches) and questionable security practices (storing passwords in plaintext config files). **Secure SFTP** solves both problems:

✅ **Security First**: Uses VS Code's SecretStorage API (OS keychain) for credentials  
✅ **Modern SSH**: Full control over SSH algorithm negotiation using `ssh2` library  
✅ **Strict Verification**: Host key verification with MITM protection  
✅ **No Plaintext Secrets**: Never stores passwords in config files or logs  
✅ **Secure Defaults**: Modern algorithms only, strict host key checking enabled by default

## Features

- 🔐 **Secure credential storage** using OS keychain (never plaintext)
- 🔑 **Multiple authentication methods**: password, private key, SSH agent
- 📁 **File operations**: upload, download, sync folders
- 💾 **Upload on save** (optional)
- 🔍 **Strict host key verification** (MITM protection)
- 🛡️ **Modern SSH algorithms** only (no weak ciphers)
- 📊 **Transfer progress** reporting
- 🐛 **Better error messages** for debugging SSH issues

## Installation

### From VS Code Marketplace (Coming Soon)

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search for "Secure SFTP"
4. Click Install

### From Source

```bash
git clone https://github.com/popchenk/vscode-sftp.git
cd secure-sftp-vscode
npm install
npm run compile
# Press F5 in VS Code to run the extension in debug mode
```

## Quick Start

### 1. Configure Your Server

Create a `.vscode/sftp.json` file in your workspace:

```json
{
  "name": "My Server",
  "host": "example.com",
  "port": 22,
  "username": "myuser",
  "remotePath": "/home/myuser/www",
  "authMethod": "password"
}
```

**Note**: Credentials are NOT stored in this file. They're stored securely in your OS keychain.

### 2. Store Your Credentials

Open the Command Palette (Cmd+Shift+P / Ctrl+Shift+P) and run:

```
Secure SFTP: Store Credentials
```

Enter your password when prompted. It will be encrypted and stored in your OS keychain.

### 3. Connect and Upload

- **Connect**: `Secure SFTP: Connect to Server`
- **Upload current file**: `Secure SFTP: Upload Current File`
- **Download file**: `Secure SFTP: Download File`
- **Sync folders**: `Secure SFTP: Sync Folders`

## Configuration

### Server Configuration

```json
{
  "name": "Production Server",
  "host": "example.com",
  "port": 22,
  "username": "deploy",
  "remotePath": "/var/www/html",
  
  // Authentication method: "password", "privateKey", or "agent"
  "authMethod": "privateKey",
  "privateKeyPath": "~/.ssh/id_ed25519",
  
  // Optional: Upload on save
  "uploadOnSave": false,
  
  // Optional: Files to ignore (glob patterns)
  "ignore": [
    "**/.git/**",
    "**/node_modules/**",
    "**/.DS_Store"
  ]
}
```

### Extension Settings

- `secureSftp.strictHostKeyChecking`: Verify server host keys (default: `true`, **strongly recommended**)
- `secureSftp.logLevel`: Log level - `error`, `warn`, `info`, `debug` (default: `info`)
- `secureSftp.uploadOnSave`: Automatically upload files when saved (default: `false`)

## Security

This extension prioritizes security above all else:

- ✅ **No plaintext credentials** - Uses VS Code SecretStorage API (OS keychain)
- ✅ **No credential logging** - Passwords and keys are never logged
- ✅ **Strict host key verification** - Always enforced, alerts on key changes
- ✅ **Modern algorithms only** - Rejects weak ciphers and key exchange methods
- ✅ **Input validation** - Prevents path traversal and injection attacks
- ✅ **Fail secure** - Refuses operations rather than proceeding insecurely

For detailed security information, see [SECURITY.md](SECURITY.md).
Additional docs:
- [Security Architecture](docs/SECURITY-ARCHITECTURE.md)
- [Security Best Practices](docs/SECURITY-BEST-PRACTICES.md)
- [Security Testing](docs/SECURITY-TESTING.md)

## Troubleshooting

### Connection Issues

**"Timed out while waiting for handshake"**
- Check firewall settings
- Verify SSH server is running on the specified port
- Try connecting with `ssh` command line to verify credentials

**"Host key verification failed"**
- The server's host key has changed (possible MITM attack)
- If you trust the new key, clear stored host keys and reconnect
- Run: `Secure SFTP: Clear Stored Credentials`

**"All configured authentication methods failed"**
- Verify your credentials are correct
- Check that your authentication method matches server configuration
- For private keys, ensure the key file exists and has correct permissions

### Upload/Download Issues

**"Permission denied"**
- Check remote path permissions
- Verify your user has write access to the remote directory

**"No such file or directory"**
- Verify the remote path exists
- Check that the path is absolute or relative to your home directory

More help: [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

## Documentation

- [Configuration Reference](docs/CONFIGURATION.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [Threat Model](docs/THREAT-MODEL.md)
- [Release Process](docs/RELEASE.md)
- [Changelog](CHANGELOG.md)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/popchenk/vscode-sftp.git
cd secure-sftp-vscode
npm install
npm run compile
```

Run tests:
```bash
npm test
```

### Security Contributions

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md) for responsible disclosure.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [ssh2](https://github.com/mscdex/ssh2) library
- Inspired by the need for secure, reliable SFTP in VS Code
- Thanks to all contributors who prioritize security

---

**Note**: This extension is in active development. Please report issues on [GitHub](https://github.com/popchenk/vscode-sftp/issues).
