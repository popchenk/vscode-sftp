# Security Testing Checklist

## Manual Pen-Test Checklist
- MITM protection: connect to a host, verify fingerprint prompt, and ensure mismatch blocks.
- Host key rotation: change server key, confirm mismatch warning and refusal.
- Path traversal: attempt remote path `../` operations; ensure blocked.
- Credential logging: search logs for passwords, private keys, passphrases.
- SecretStorage: verify credentials are never stored in settings.json.
- Upload-on-save: ensure only configured host receives uploads.
- Connection cleanup: verify disconnect on deactivation.

## Automated Checks
- `npm audit --audit-level=moderate`
- ESLint security plugin (`npm run lint`)
- Unit/security tests (`npm test`)
