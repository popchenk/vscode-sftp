# Security Policy

## Reporting a Vulnerability

We take the security of Secure SFTP seriously. If you discover a security vulnerability, please follow these guidelines:

### How to Report

**Please DO NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report security vulnerabilities by emailing:

📧 **security@yourdomain.com**

Include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)
- Your name/handle for credit (optional)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Updates**: We will keep you informed of our progress
- **Resolution**: We aim to resolve critical issues within 30 days
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

Once version 1.0.0 is released, we will support:
- Latest major version
- Previous major version for 6 months after new major release

## Security Best Practices for Users

### Credential Storage

✅ **DO**:
- Use the built-in credential storage (`Secure SFTP: Store Credentials`)
- Use SSH keys instead of passwords when possible
- Use SSH agent for key management
- Regularly rotate credentials

❌ **DON'T**:
- Store passwords in `sftp.json` configuration files
- Share configuration files containing credentials
- Commit credentials to version control
- Use the same password across multiple servers

### Host Key Verification

✅ **DO**:
- Keep `strictHostKeyChecking` enabled (default: `true`)
- Verify host key fingerprints on first connection
- Investigate host key changes immediately (possible MITM attack)

❌ **DON'T**:
- Disable host key verification
- Ignore host key change warnings
- Auto-accept unknown host keys without verification

### SSH Configuration

✅ **DO**:
- Use modern authentication methods (Ed25519 keys preferred)
- Keep SSH client libraries up to date
- Use strong passphrases for private keys
- Restrict private key file permissions (chmod 600)

❌ **DON'T**:
- Use weak or deprecated algorithms
- Share private keys
- Store unencrypted private keys in cloud storage
- Use default/example configurations in production

### Network Security

✅ **DO**:
- Use VPN when connecting over untrusted networks
- Verify you're connecting to the correct server
- Monitor connection logs for suspicious activity
- Use firewall rules to restrict SSH access

❌ **DON'T**:
- Connect to SSH servers over public WiFi without VPN
- Ignore certificate/host key warnings
- Use SSH on non-standard ports without understanding the risks

## Security Features

This extension implements the following security measures:

### Credential Protection
- OS keychain integration via VS Code SecretStorage API
- No plaintext credential storage
- Credentials cleared from memory after use
- No credential logging at any log level

### SSH Security
- Modern algorithm defaults (ChaCha20-Poly1305, AES-GCM, Ed25519)
- Rejection of weak ciphers and key exchange methods
- Strict host key verification by default
- Protection against downgrade attacks

### Input Validation
- Path traversal prevention
- Command injection prevention
- Host/port validation
- Username validation

### Secure Defaults
- Strict host key checking enabled
- Modern algorithms only
- Secure error messages (no credential leakage)
- Fail-secure behavior

## Known Security Considerations

### SSH Protocol Limitations
- SSH protocol is only as secure as the server configuration
- Weak server configurations can reduce security
- Man-in-the-middle attacks possible if host keys not verified

### VS Code Extension Sandbox
- Extensions run with user privileges
- Extensions can access VS Code APIs and workspace files
- Trust only extensions from verified publishers

### Dependency Security
- We use minimal dependencies to reduce attack surface
- Dependencies are regularly audited with `npm audit`
- Security updates are applied promptly

## Security Audit History

| Date | Type | Findings | Status |
|------|------|----------|--------|
| TBD  | Initial Release Audit | TBD | Planned |

## Responsible Disclosure

We follow responsible disclosure practices:

1. Security researchers report vulnerabilities privately
2. We acknowledge and investigate reports promptly
3. We develop and test fixes
4. We coordinate disclosure timing with reporter
5. We release security updates
6. We publish security advisories with credit to reporters

## Security Updates

Security updates will be:
- Released as soon as possible after verification
- Clearly marked in release notes with `[SECURITY]` tag
- Announced via GitHub Security Advisories
- Documented in CHANGELOG.md

## Contact

For security-related questions or concerns:

📧 Email: security@yourdomain.com  
🔒 PGP Key: [Link to PGP key] (optional)  
🐛 GitHub: [Security Advisories](https://github.com/yourusername/secure-sftp-vscode/security/advisories)

---

**Last Updated**: 2026-01-20

Thank you for helping keep Secure SFTP and its users safe!
