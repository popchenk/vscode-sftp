# Contributing to Secure SFTP

Thank you for your interest in contributing to Secure SFTP! This document provides guidelines for contributing to the project.

## Code of Conduct

Be respectful, professional, and constructive in all interactions. We're building a security-focused tool together.

## How to Contribute

### Reporting Bugs

Before creating a bug report:
1. Check existing issues to avoid duplicates
2. Verify you're using the latest version
3. Test with a minimal configuration

When creating a bug report, include:
- VS Code version
- Extension version
- Operating system
- SSH server type and version
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs (with credentials redacted)

**Security vulnerabilities**: Please report privately via our [Security Policy](SECURITY.md).

### Suggesting Features

Feature suggestions are welcome! Please:
1. Check existing issues/discussions
2. Explain the use case
3. Consider security implications
4. Propose implementation approach (optional)

### Pull Requests

We welcome pull requests! Please:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** following our coding standards
4. **Write tests** for new functionality
5. **Run the test suite**: `npm test`
6. **Run linting**: `npm run lint`
7. **Format code**: `npm run format`
8. **Commit with clear messages**: Follow conventional commits format
9. **Push to your fork**
10. **Open a pull request** with a clear description

## Development Setup

### Prerequisites

- Node.js 20.x or later
- npm 9.x or later
- VS Code 1.85.0 or later
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/yourusername/secure-sftp-vscode.git
cd secure-sftp-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to start debugging
3. A new VS Code window will open with the extension loaded
4. Test your changes in the Extension Development Host

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage
```

## Coding Standards

### TypeScript

- Use **strict mode** (already configured)
- Provide **explicit return types** for functions
- Avoid `any` type (use `unknown` if necessary)
- Use `const` over `let`, never use `var`
- Prefer async/await over callbacks

### Security

**CRITICAL**: All contributions must follow security best practices:

✅ **DO**:
- Use VS Code SecretStorage API for credentials
- Validate all user inputs
- Sanitize all file paths
- Use parameterized queries/commands
- Clear sensitive data from memory after use
- Write security tests for sensitive code

❌ **DON'T**:
- Log passwords, keys, or credentials
- Store secrets in plaintext
- Use `eval()` or `Function()` constructor
- Construct shell commands from user input
- Auto-accept host keys without user confirmation
- Disable security features by default

### Code Style

We use Prettier for formatting and ESLint for linting:

```bash
# Auto-format code
npm run format

# Check formatting
npm run format:check

# Fix linting issues
npm run lint:fix
```

**Key style points**:
- 2 spaces for indentation
- Single quotes for strings
- Trailing commas in objects/arrays
- 100 character line width
- Semicolons required

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks
- `security`: Security improvements

**Examples**:
```
feat(ssh): add support for Ed25519 keys

fix(upload): prevent path traversal in file uploads

security(auth): clear credentials from memory after use
```

## Testing Guidelines

### Test Coverage

- Aim for >80% coverage on security-critical code
- All new features must include tests
- All bug fixes must include regression tests

### Test Types

1. **Unit Tests** (`test/unit/`):
   - Test individual functions/classes
   - Mock external dependencies
   - Fast execution

2. **Integration Tests** (`test/integration/`):
   - Test component interactions
   - Use Docker SSH server for testing
   - Verify end-to-end workflows

3. **Security Tests** (`test/security/`):
   - Verify no credential leakage
   - Test input validation
   - Verify secure defaults

### Writing Tests

```typescript
import { describe, test, expect } from 'vitest';

describe('PathValidator', () => {
  test('blocks path traversal attempts', () => {
    const result = isPathWithinRoot('../../../etc/passwd', '/home/user');
    expect(result).toBe(false);
  });

  test('allows valid paths', () => {
    const result = isPathWithinRoot('/home/user/file.txt', '/home/user');
    expect(result).toBe(true);
  });
});
```

## Documentation

### Code Documentation

- Add JSDoc comments for public APIs
- Explain complex algorithms
- Document security considerations
- Include usage examples

```typescript
/**
 * Validates that a path is within the allowed root directory.
 * Prevents path traversal attacks.
 * 
 * @param path - The path to validate
 * @param root - The root directory
 * @returns true if path is within root, false otherwise
 * 
 * @example
 * isPathWithinRoot('/home/user/file.txt', '/home/user') // true
 * isPathWithinRoot('../etc/passwd', '/home/user') // false
 */
export function isPathWithinRoot(path: string, root: string): boolean {
  // Implementation
}
```

### User Documentation

Update relevant documentation when adding features:
- README.md - User-facing features
- SECURITY.md - Security implications
- docs/ - Detailed guides

## Review Process

### What We Look For

1. **Security**: Does this introduce any security risks?
2. **Functionality**: Does it work as intended?
3. **Tests**: Are there adequate tests?
4. **Code Quality**: Is it readable and maintainable?
5. **Documentation**: Is it properly documented?
6. **Breaking Changes**: Are they necessary and documented?

### Review Timeline

- Initial review: Within 1 week
- Follow-up reviews: Within 3 days
- Merge: After approval from maintainer

## Release Process

Maintainers handle releases:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Run full test suite
4. Run security audit
5. Create git tag
6. Publish to VS Code Marketplace
7. Create GitHub release

## Questions?

- Open a [Discussion](https://github.com/yourusername/secure-sftp-vscode/discussions)
- Comment on relevant issues
- Reach out to maintainers

---

Thank you for contributing to Secure SFTP! Your help makes this extension better and more secure for everyone.
