# Contributing

Use Node.js 22 or later. Run `npm ci --ignore-scripts`, `npm run check`, `npm test` and `npm run package`. The packaged runtime has no npm dependencies. The pinned development packaging tool is in package-lock.json.

Packaging-only dependency overrides pin Azure Identity 4.13.0 and uuid 11.1.1 to avoid audited advisories in the current vsce dependency tree. The local packaging path is tested; publisher authentication using these overrides is not verified. Review/remove the overrides when upstream ships a patched compatible tree. Use the manual artifact-upload path until publisher authentication is validated.

Use the Extension Development Host configuration in .vscode/launch.json to test in VS Code. Native harness tests use the tester's own accounts and can incur provider usage. Never run those tests against a contributor's account automatically in CI.

Add adapters through the Session contract (`start`, `send`, `snapshot`, `stop`, `change`). Expose capabilities honestly: connected does not mean idle, accepted does not mean processed, and a saved thread is not a live session. Extend shared routing separately from provider protocol handling. Keep secrets and raw protocol payloads out of diagnostic output.

For protocol changes, add meaningful regression tests and record the CLI versions used for live verification. Never bundle or patch proprietary provider binaries. Preserve user approvals and label peer messages as agent input.
