# Release Process

## Checklist
- Ensure tests pass: `npm test`
- Run coverage: `npm run test:coverage`
- Run audit: `npm audit --audit-level=moderate`
- Update `CHANGELOG.md`
- Bump version in `package.json`
- Create a signed tag for the release

## Notes
- Security fixes should be called out in the changelog.
- Release workflow in GitHub Actions expects a clean working tree.
