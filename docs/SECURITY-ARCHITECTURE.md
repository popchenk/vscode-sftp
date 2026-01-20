# Security Architecture

## Overview
Secure SFTP prioritizes safe defaults and explicit user consent for risky operations. The core security goals are:
- Protect credentials at rest and in memory
- Prevent MITM attacks via strict host key verification
- Reject weak SSH algorithms
- Prevent path traversal and unsafe input handling

## Threat Model (Summary)
- Credential exposure in logs or settings
- Host key spoofing (MITM)
- Path traversal in remote and local operations
- Weak crypto algorithms

## Credential Handling
- Credentials are stored only in VS Code SecretStorage (OS keychain).
- Passwords, keys, and passphrases are never logged.
- Sensitive strings are overwritten after use.

## Host Key Verification
- Unknown keys require user approval.
- Changed keys trigger a warning and connection refusal.
- Known hosts are stored in global state with fingerprints.

## Algorithm Policy
- Default algorithms are modern-only (curve25519, AES-GCM/CTR, RSA-SHA2).
- Weak algorithms (e.g., SHA1/CBC) are rejected.

## Path Safety
- Input paths are sanitized.
- Remote paths are resolved relative to configured roots.
- Traversal attempts are blocked.

## Operational Defaults
- Strict host key checking enabled by default.
- No plaintext secrets in configs.
- Fail secure on validation errors.
