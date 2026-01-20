# Threat Model

## Assets
- User credentials (passwords, private keys, passphrases)
- Host key fingerprints
- Local and remote file contents

## Threats and Mitigations

### Credential exposure
- **Threat**: Leaked via logs, settings, or error messages
- **Mitigation**: SecretStorage only, log redaction, no plaintext config storage

### MITM attacks
- **Threat**: Spoofed host keys
- **Mitigation**: Strict host key verification, explicit user approval for new keys

### Path traversal
- **Threat**: Access outside allowed directories
- **Mitigation**: Path sanitization and root checks for remote operations

### Weak crypto
- **Threat**: Legacy SSH algorithms
- **Mitigation**: Secure algorithm defaults, reject weak algorithms

### Supply-chain risk
- **Threat**: Vulnerable dependencies
- **Mitigation**: Regular audits, minimal dependency set, CI checks

## Out of Scope
- Compromised developer machines
- Malicious VS Code extensions or plugins
