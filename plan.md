# Secure SFTP Extension for VS Code

## Project Overview

A VS Code extension that provides secure SFTP file transfer capabilities using native SSH connections. Built with security as the primary concern, this extension aims to solve compatibility issues found in existing SFTP extensions while maintaining the highest security standards.

## Project Goals

1. Provide reliable SFTP functionality without handshake/compatibility issues
2. Implement security best practices throughout
3. Create a clean, maintainable open-source codebase
4. Offer better error messages and debugging capabilities than existing solutions

---

## Phase 1: Project Setup and Foundation

### 1.1 Repository Initialization

- [ ] Create GitHub repository with appropriate license (MIT or Apache 2.0 recommended for open source)
- [ ] Initialize with `.gitignore` for Node.js/TypeScript/VS Code extensions
- [ ] Set up branch protection rules (require PR reviews, signed commits)
- [ ] Create initial README.md with project description
- [ ] Add SECURITY.md for vulnerability reporting guidelines
- [ ] Add CONTRIBUTING.md with contribution guidelines

### 1.2 Development Environment

- [ ] Initialize npm project with `npm init`
- [ ] Install VS Code extension generator: `npx yo code`
- [ ] Configure TypeScript with strict mode enabled
- [ ] Set up ESLint with security-focused rules (`eslint-plugin-security`)
- [ ] Configure Prettier for consistent formatting
- [ ] Set up Husky for pre-commit hooks (linting, type checking)

### 1.3 Project Structure

```
secure-sftp-vscode/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Continuous integration
│   │   ├── security-audit.yml  # Dependency scanning
│   │   └── release.yml         # Automated releases
│   ├── SECURITY.md
│   └── CODEOWNERS
├── src/
│   ├── extension.ts            # Extension entry point
│   ├── core/
│   │   ├── ssh-manager.ts      # SSH connection management
│   │   ├── sftp-client.ts      # SFTP operations
│   │   └── tunnel-manager.ts   # SSH tunnel handling (if needed)
│   ├── config/
│   │   ├── config-manager.ts   # Configuration handling
│   │   ├── config-schema.ts    # Configuration validation
│   │   └── secure-storage.ts   # Credential storage
│   ├── providers/
│   │   ├── file-system-provider.ts  # VS Code FileSystemProvider
│   │   └── tree-data-provider.ts    # Explorer view
│   ├── commands/
│   │   ├── upload.ts
│   │   ├── download.ts
│   │   ├── sync.ts
│   │   └── connection.ts
│   ├── utils/
│   │   ├── logger.ts           # Secure logging (no sensitive data)
│   │   ├── validators.ts       # Input validation
│   │   └── path-utils.ts       # Path sanitization
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── test/
│   ├── unit/
│   ├── integration/
│   └── security/               # Security-specific tests
├── docs/
│   ├── SECURITY-ARCHITECTURE.md
│   ├── CONFIGURATION.md
│   └── DEVELOPMENT.md
├── .eslintrc.js
├── .prettierrc
├── tsconfig.json
├── package.json
└── README.md
```

### 1.4 Dependencies

**Production dependencies (keep minimal):**
```json
{
  "ssh2": "^1.15.0"
}
```

**Development dependencies:**
```json
{
  "@types/node": "^20.x",
  "@types/vscode": "^1.85.0",
  "@types/ssh2": "^1.15.0",
  "typescript": "^5.3.0",
  "eslint": "^8.x",
  "eslint-plugin-security": "^2.x",
  "@typescript-eslint/eslint-plugin": "^6.x",
  "prettier": "^3.x",
  "husky": "^8.x",
  "vitest": "^1.x"
}
```

---

## Phase 2: Security Architecture

### 2.1 Threat Model

Document and address the following threats:

| Threat | Mitigation |
|--------|------------|
| Credential exposure in logs | Never log passwords, keys, or connection strings |
| Credential exposure in config files | Use VS Code SecretStorage API for sensitive data |
| Man-in-the-middle attacks | Strict host key verification, no auto-accept |
| Path traversal attacks | Validate and sanitize all paths |
| Command injection | No shell command construction from user input |
| Dependency vulnerabilities | Regular audits, minimal dependencies |
| Memory exposure | Clear sensitive data from memory when done |
| Insecure defaults | Secure defaults, explicit user opt-in for less secure options |

### 2.2 Credential Storage Strategy

```typescript
// NEVER store credentials in:
// - settings.json (plaintext)
// - workspace files
// - environment variables logged anywhere

// ALWAYS use VS Code SecretStorage API:
interface SecureCredentialStorage {
  // Store encrypted in OS keychain
  storePassword(host: string, username: string, password: string): Promise<void>;
  storePrivateKey(host: string, keyPath: string): Promise<void>;
  
  // Retrieve only when needed
  getCredentials(host: string): Promise<Credentials | undefined>;
  
  // Clear from memory after use
  clearCredentials(credentials: Credentials): void;
}
```

### 2.3 SSH Security Configuration

```typescript
// Secure defaults - modern algorithms only
const SECURE_SSH_CONFIG = {
  algorithms: {
    kex: [
      'curve25519-sha256',
      'curve25519-sha256@libssh.org',
      'ecdh-sha2-nistp521',
      'ecdh-sha2-nistp384',
      'ecdh-sha2-nistp256',
      'diffie-hellman-group18-sha512',
      'diffie-hellman-group16-sha512',
      'diffie-hellman-group14-sha256'
    ],
    cipher: [
      'chacha20-poly1305@openssh.com',
      'aes256-gcm@openssh.com',
      'aes128-gcm@openssh.com',
      'aes256-ctr',
      'aes192-ctr',
      'aes128-ctr'
    ],
    serverHostKey: [
      'ssh-ed25519',
      'ecdsa-sha2-nistp521',
      'ecdsa-sha2-nistp384',
      'ecdsa-sha2-nistp256',
      'rsa-sha2-512',
      'rsa-sha2-256'
    ],
    hmac: [
      'hmac-sha2-512-etm@openssh.com',
      'hmac-sha2-256-etm@openssh.com',
      'hmac-sha2-512',
      'hmac-sha2-256'
    ]
  },
  // Reject weak algorithms
  strictHostKeyChecking: true,
  hashKnownHosts: true
};
```

### 2.4 Host Key Verification

```typescript
// CRITICAL: Never auto-accept host keys
interface HostKeyVerification {
  // First connection: prompt user to verify fingerprint
  promptUserForNewHost(host: string, fingerprint: string): Promise<boolean>;
  
  // Subsequent connections: verify against stored key
  verifyKnownHost(host: string, key: Buffer): boolean;
  
  // If key changes: BLOCK and alert user (possible MITM)
  handleHostKeyMismatch(host: string, expected: string, received: string): void;
}
```

### 2.5 Input Validation

```typescript
// Validate ALL user inputs
interface Validators {
  // Host validation - prevent SSRF
  isValidHost(host: string): boolean;
  
  // Port validation
  isValidPort(port: number): boolean;
  
  // Path validation - prevent traversal
  sanitizePath(path: string): string;
  isPathWithinRoot(path: string, root: string): boolean;
  
  // Username validation
  isValidUsername(username: string): boolean;
}
```

---

## Phase 3: Core Implementation

### 3.1 SSH Connection Manager

```typescript
// src/core/ssh-manager.ts

import { Client, ConnectConfig } from 'ssh2';

export class SSHManager {
  private connections: Map<string, Client> = new Map();
  
  async connect(config: SecureConnectionConfig): Promise<Client> {
    // 1. Validate all inputs
    // 2. Retrieve credentials from secure storage
    // 3. Apply secure algorithm defaults
    // 4. Verify host key
    // 5. Establish connection
    // 6. Clear password from memory immediately after auth
  }
  
  async disconnect(connectionId: string): Promise<void> {
    // Clean disconnect, clear all sensitive data
  }
  
  async disconnectAll(): Promise<void> {
    // Called on extension deactivation
  }
}
```

### 3.2 SFTP Client

```typescript
// src/core/sftp-client.ts

export class SFTPClient {
  async upload(
    localPath: string, 
    remotePath: string,
    options?: TransferOptions
  ): Promise<TransferResult> {
    // 1. Validate paths (no traversal)
    // 2. Check file permissions
    // 3. Transfer with progress reporting
    // 4. Verify transfer integrity (optional checksum)
  }
  
  async download(
    remotePath: string,
    localPath: string,
    options?: TransferOptions
  ): Promise<TransferResult> {
    // Same security checks as upload
  }
  
  async listDirectory(remotePath: string): Promise<FileEntry[]> {
    // Validate path, return sanitized results
  }
}
```

### 3.3 Configuration Manager

```typescript
// src/config/config-manager.ts

// Configuration file structure (NO SECRETS HERE)
interface SFTPConfig {
  name: string;
  host: string;
  port: number;                    // default: 22
  username: string;
  remotePath: string;
  
  // Authentication method (credentials stored separately)
  authMethod: 'password' | 'privateKey' | 'agent';
  privateKeyPath?: string;         // Path only, not the key itself
  
  // Optional settings
  uploadOnSave?: boolean;
  watcher?: WatcherConfig;
  ignore?: string[];               // Glob patterns to ignore
  
  // Security settings (with secure defaults)
  strictHostKeyChecking?: boolean; // default: true
  algorithms?: AlgorithmConfig;    // default: secure set
}
```

---

## Phase 4: VS Code Integration

### 4.1 Extension Activation

```typescript
// src/extension.ts

export async function activate(context: vscode.ExtensionContext) {
  // Initialize secure storage
  const secretStorage = context.secrets;
  
  // Initialize managers
  const sshManager = new SSHManager(secretStorage);
  const configManager = new ConfigManager();
  
  // Register commands
  registerCommands(context, sshManager, configManager);
  
  // Register file system provider (optional)
  registerFileSystemProvider(context, sshManager);
  
  // Set up status bar
  createStatusBar(context);
}

export async function deactivate() {
  // CRITICAL: Clean up all connections and clear sensitive data
  await sshManager.disconnectAll();
  clearAllSensitiveData();
}
```

### 4.2 Commands to Implement

| Command | Description |
|---------|-------------|
| `secureSftp.connect` | Connect to configured server |
| `secureSftp.disconnect` | Disconnect from server |
| `secureSftp.uploadFile` | Upload current file |
| `secureSftp.uploadFolder` | Upload entire folder |
| `secureSftp.downloadFile` | Download file from server |
| `secureSftp.sync` | Synchronize local and remote |
| `secureSftp.configure` | Open configuration |
| `secureSftp.setPassword` | Securely store password |
| `secureSftp.clearCredentials` | Remove stored credentials |
| `secureSftp.viewHostKeys` | View/manage known hosts |

### 4.3 Configuration Schema

```json
{
  "contributes": {
    "configuration": {
      "title": "Secure SFTP",
      "properties": {
        "secureSftp.configs": {
          "type": "array",
          "description": "SFTP server configurations"
        },
        "secureSftp.strictHostKeyChecking": {
          "type": "boolean",
          "default": true,
          "description": "Verify server host keys (STRONGLY recommended)"
        },
        "secureSftp.logLevel": {
          "type": "string",
          "enum": ["error", "warn", "info", "debug"],
          "default": "info",
          "description": "Log level (sensitive data is NEVER logged)"
        }
      }
    }
  }
}
```

---

## Phase 5: Testing Strategy

### 5.1 Unit Tests

```typescript
// test/unit/validators.test.ts
describe('Path Validation', () => {
  test('blocks path traversal attempts', () => {
    expect(isPathWithinRoot('../../../etc/passwd', '/home/user')).toBe(false);
    expect(isPathWithinRoot('/home/user/../../../etc/passwd', '/home/user')).toBe(false);
  });
  
  test('allows valid paths', () => {
    expect(isPathWithinRoot('/home/user/project/file.ts', '/home/user')).toBe(true);
  });
});

// test/unit/ssh-config.test.ts
describe('SSH Configuration', () => {
  test('rejects weak algorithms', () => {
    const config = { algorithms: { cipher: ['3des-cbc'] } };
    expect(() => validateSSHConfig(config)).toThrow();
  });
});
```

- [x] Added unit tests for ConfigManager, SSHManager, SFTPClient, SecureStorage, CryptoUtils, and extension wiring

### 5.2 Integration Tests

- [x] Test against local SSH server (env-gated integration test)
- [x] Test various authentication methods (password + optional private key env)
- [x] Test connection recovery after network issues (reconnect test)
- [x] Test file transfer integrity (upload/download when write path provided)

### 5.3 Security Tests

```typescript
// test/security/credential-handling.test.ts
describe('Credential Security', () => {
  test('passwords are not logged', async () => {
    const logSpy = vi.spyOn(logger, 'log');
    await connect({ password: 'secret123' });
    
    const allLogs = logSpy.mock.calls.flat().join(' ');
    expect(allLogs).not.toContain('secret123');
  });
  
  test('passwords are cleared from memory', async () => {
    // Verify credential objects are zeroed after use
  });
});
```

- [x] Host key prompt acceptance/cancel coverage
- [x] Credential clearing overwrites in-memory values

---

## Phase 6: Security Hardening Checklist

### Pre-Release Security Audit

- [x] **Dependency audit**: Run `npm audit` and resolve all vulnerabilities
- [x] **Static analysis**: Run ESLint with security plugin, zero warnings
- [x] **Dependency audit follow-up**: Moderate `esbuild/vite` advisory in dev deps (requires `vitest` major bump)
- [x] **Secrets scanning**: Ensure no secrets in codebase (use git-secrets or similar)
- [x] **Code review**: Security-focused review of all credential handling
- [x] **Test coverage**: >80% coverage on security-critical code paths
- [x] **Penetration testing**: Test common attack vectors
- [x] **Security review doc**: Document findings and scope in docs
- [x] **Pen-test checklist doc**: Document manual testing steps in docs

### Runtime Security

- [x] No sensitive data in logs at any log level
- [x] No sensitive data in error messages shown to users
- [x] No sensitive data in VS Code output channel
- [x] Credentials cleared from memory after use
- [x] Connections properly closed on deactivation
- [x] Host key verification cannot be bypassed without explicit user action

### Configuration Security

- [x] Secure defaults for all settings
- [x] Clear warnings when user selects less secure options
- [x] No option to completely disable host key checking
- [x] Password/key storage only via SecretStorage API

---

## Phase 7: Documentation

### 7.1 User Documentation

- [x] README with quick start guide
- [x] Configuration reference
- [x] Troubleshooting guide (common SSH errors)
- [x] Security best practices for users

### 7.2 Security Documentation

- [x] SECURITY.md with vulnerability reporting process
- [x] Security architecture document
- [x] Threat model documentation
- [x] Changelog with security fixes highlighted

### 7.3 Developer Documentation

- [x] Contributing guidelines
- [x] Development setup guide
- [x] Code style guide
- [x] Release process documentation

---

## Phase 8: Release and Maintenance

### 8.1 Release Checklist

- [x] All tests passing
- [x] Security audit completed
- [x] Documentation updated
- [x] Changelog updated
- [x] Version bumped appropriately
- [ ] Signed commits/tags (requires GPG available)

### 8.2 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm audit

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Snyk
        uses: snyk/actions/node@master
```

### 8.3 Ongoing Maintenance

- Weekly dependency updates review
- Monthly security audit
- Respond to security reports within 48 hours
- Regular review of SSH/SFTP security best practices

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Setup | 1-2 days |
| Phase 2: Security Architecture | 2-3 days |
| Phase 3: Core Implementation | 5-7 days |
| Phase 4: VS Code Integration | 3-5 days |
| Phase 5: Testing | 3-4 days |
| Phase 6: Security Hardening | 2-3 days |
| Phase 7: Documentation | 2-3 days |
| Phase 8: Release Prep | 1-2 days |

**Total: 3-5 weeks** (depending on experience and time available)

---

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [ssh2 npm package](https://github.com/mscdex/ssh2)
- [VS Code SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [SSH Hardening Guide](https://www.sshaudit.com/)

---

## Notes

This plan prioritizes security over features. The initial release should have a minimal feature set that works reliably and securely. Additional features can be added in subsequent releases after the security foundation is solid.

Key principle: **When in doubt, fail secure.** It's better to refuse an operation than to proceed insecurely.
