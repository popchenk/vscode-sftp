# Troubleshooting

## Connection Issues

### "Timed out while waiting for handshake"
- Verify the SSH server is reachable and running.
- Confirm the port is correct and open.
- Check network/firewall rules.

### "Host key mismatch detected"
- The server's host key changed. Treat as a possible MITM.
- If you trust the new key, remove the old key via `Secure SFTP: View Known Hosts`.

### "All configured authentication methods failed"
- Confirm username and auth method match server configuration.
- For private keys, verify the key file path and permissions.
- If using SSH agent, ensure `SSH_AUTH_SOCK` is set.

## Upload/Download Issues

### "Permission denied"
- Verify remote directory permissions for the SSH user.

### "No such file or directory"
- Check the remote path exists.
- Ensure you are using absolute paths or paths relative to `remotePath`.

### Upload on save doesn't run
- Confirm `secureSftp.uploadOnSave` or per-config `uploadOnSave` is enabled.
- Ensure there is at least one valid configuration.
