# Configuration Reference

This extension reads configuration from VS Code settings under the `secureSftp` namespace.
Credentials are stored separately in the OS keychain via VS Code SecretStorage.

## Settings

### `secureSftp.configs`
Array of SFTP configurations. Example:

```json
[
  {
    "name": "Production",
    "host": "example.com",
    "port": 22,
    "username": "deploy",
    "remotePath": "/var/www/html",
    "authMethod": "privateKey",
    "privateKeyPath": "~/.ssh/id_ed25519",
    "uploadOnSave": false,
    "ignore": [
      "**/.git/**",
      "**/node_modules/**"
    ],
    "strictHostKeyChecking": true
  }
]
```

### `secureSftp.logLevel`
String enum: `error`, `warn`, `info`, `debug`. Default: `info`. Sensitive data is always redacted.

### `secureSftp.uploadOnSave`
Boolean. Default: `false`. When enabled, the extension uploads the saved file to the first matching config:
- Prefer configs with `uploadOnSave: true`
- Otherwise use the first config if `secureSftp.uploadOnSave` is enabled

### `secureSftp.allowLocalhost`
Boolean. Default: `false`. Allow `localhost/127.0.0.1` hosts for development only.

## Per-Config Fields

### Required
- `name`: Display name for selection.
- `host`: Hostname or IP (public, non-local).
- `port`: SSH port (default 22 if omitted).
- `username`: SSH user.
- `remotePath`: Base remote directory.
- `authMethod`: `password` | `privateKey` | `agent`.

### Optional
- `privateKeyPath`: Required for `privateKey` auth when key is stored on disk.
- `uploadOnSave`: Enable upload on save for this config.
- `ignore`: Glob patterns to ignore (future use).
- `algorithms`: SSH algorithm overrides (must be secure).

## Host Key Verification

Strict host key checking is always enforced. Any `strictHostKeyChecking` setting or per-config override is ignored for security.

## Credential Storage

Use the command `Secure SFTP: Store Credentials` to store passwords or private key passphrases.
Credentials are never stored in settings or workspace files.
For passphrase-only storage, use `Secure SFTP: Store Private Key Passphrase`.
