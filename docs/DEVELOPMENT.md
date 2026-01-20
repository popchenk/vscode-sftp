# Development Guide

## Prerequisites
- Node.js 20.x+
- npm 9.x+
- VS Code 1.85+

## Setup
```bash
git clone https://github.com/popchenk/vscode-sftp.git
cd secure-sftp-vscode
npm install
```

## Common Scripts
```bash
npm run compile
npm run lint
npm test
npm run test:coverage
```

## Running the Extension
1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. Use the command palette to test commands

## Testing
- Unit tests: `npm test`
- Coverage: `npm run test:coverage`
- Integration tests: set `SFTP_TEST_*` env vars (see `test/integration/sftp.integration.test.ts`)
