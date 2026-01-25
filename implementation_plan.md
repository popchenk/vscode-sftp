# Jump Host Implementation and Test Plan

## Goal Description
Implement native "Jump Host" (ProxyJump) support in existing `vscode-sftp` extension. This allows users to connect to a target SFTP server *through* an intermediate SSH server (the jump host) without manually setting up local tunnels. The extension will manage the tunnel lifecycle.

## User Review Required
> [!IMPORTANT]
> **Configuration Structure**: I propose adding a `hop` or `proxy` field to the existing `SFTPConfig` object. This will contain the jump host's credentials.
>
> **Restart Required**: Users will need to reload the window or reconnect for changes to `package.json` (schema) to take full effect in the settings UI.

## Proposed Changes

### Configuration
#### [MODIFY] package.json
- Add schema definitions for `hop` configuration:
    - `hop.host`
    - `hop.port` (default 22)
    - `hop.username`
    - `hop.passphrase` (for keys)
    - `hop.privateKeyPath`

#### [MODIFY] src/types/index.ts
- Update `SFTPConfig` interface to include `hop?: ConnectConfig` (or a specific HopConfig type).

### Core Logic
#### [MODIFY] src/core/ssh-manager.ts
- Update `connect` method:
    1.  Check if `config.hop` is present.
    2.  If yes, establish connection to the Hop server first.
    3.  Use `hopClient.forwardOut` to create a stream to the target `host:port`.
    4.  Connect the main `Client` using this stream (`connect({ ...config, sock: stream })`).
- Update `disconnect` to ensure both connections are closed (or the hop connection if it's shared).

### Verification Environment (Docker)
#### [NEW] docker-compose.yml
- **`jump-host`**: SSH server exposing port 2222.
- **`target-host`**: SFTP server (not exposed directly to host, or exposed on different port for verification).
- **Network**: `jump-host` can talk to `target-host`.

## Handover Issue Report for Claude

### Current Status
- **Architecture**: Implemented. Code can connect to jump host, authenticate (fixed credential storage), and attempt `forwardOut`.
- **Unit Tests**: Passing (Mocked `ssh2` verifies the logic).
- **Integration Tests**: Skipped/Failing due to environment issues.
- **Manual Verification**: Failing with `(SSH) Channel open failure: open failed`.

### The Problem
The `ssh2.forwardOut()` call is being rejected by the Jump Host server.
- **Error**: `Channel open failure: open failed`.
- **Jump Host**: `linuxserver/openssh-server` listening on port 2222.
- **Target**: Internal IP `172.18.0.2` (Verified via `ping` and `nc` from Jump Host).

### Findings & Actions Taken
1.  **Network Reachability**:
    - `docker exec sftp-jump-host ping target-host` -> SUCCESS.
    - `docker exec sftp-jump-host nc -zv 172.18.0.2 2222` -> SUCCESS.
2.  **SSH Configuration (The likely culprit)**:
    - Default `sshd_config` often disables forwarding (`AllowTcpForwarding no`).
    - Attempted to patch `/etc/ssh/sshd_config` -> **FAILED** (Ignored by container).
    - **CRITICAL DISCOVERY**: This container uses `/config/sshd/sshd_config` as the active configuration file.
    - **Status**: The correct config file `/config/sshd/sshd_config` **NEEDS TO BE PATCHED** to allow forwarding (`AllowTcpForwarding yes`, `GatewayPorts yes`, `PermitOpen any`). The previous attempt was interrupted.
3.  **Client-Side Tweaks**:
    - `ssh-manager.ts`: Changed `forwardOut` source IP from `127.0.0.1` to `0.0.0.0` (Pending verification).

### Next Steps for Claude
1.  **Patch the correct config**: Run a command to append `AllowTcpForwarding yes` to `/config/sshd/sshd_config` inside the `sftp-jump-host` container and restart it.
2.  **Verify Forwarding**: Retry the manual connection. The error should resolve once `sshd` allows the tunnel.
