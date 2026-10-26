# Release procedure

## Current status

The source repository is https://github.com/clemensgoering/session-mesh . Version 0.3.0 is an experimental preview. No Marketplace listing or publisher account has been created by these scripts.

## Before a public listing

1. Set the real Marketplace `publisher` in package.json. `local-lab` is deliberately only a local placeholder; changing publisher changes extension identity.
2. Set real HTTPS `repository.url`, `homepage`, and `bugs.url`. Enable private vulnerability reporting and add the actual security contact to SECURITY.md. Confirm project name availability and rights to distributed assets. The MIT license covers this project's source, not third-party binaries.
3. Run a native existing-session end-to-end test in both directions with idle and busy recipients, explicit result reporting to an orchestrator, tool approvals, process exit and restart. Test on a clean Windows x64 installation with Node 22+ and separately installed, signed-in harnesses. Record CLI versions, expected/observed results and reviewer/date; never record credentials.
4. Inspect UI at normal and high zoom, light/dark themes and keyboard navigation. Verify restricted and virtual workspaces cannot launch harnesses. Verify no provider process starts or thread is resumed by discovery. Verify native owners, busy/idle races, hide/restore, setup idempotence, Desktop owner changes, attestation expiry and remote-mobile delegation.
5. Update CHANGELOG.md, version and README support status. Set `.release-evidence.json` locally to `{"bidirectionalLiveTest":true,"reviewedBy":"...","reviewedAt":"YYYY-MM-DD"}` only after genuinely completing validation. This file is ignored and never packaged.
6. Run `npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm audit`, `npm run release:check`, and `npm run package`. Review `npx vsce ls --no-dependencies` and the final VSIX contents. Test installation of that exact artifact.
7. Upload the reviewed VSIX manually to a GitHub Release or Marketplace as a preview after owner approval. Authenticate through the publisher's supported Marketplace flow. Do not commit tokens or place publishing credentials in pull-request workflows.

CI builds a downloadable VSIX artifact on pushes, pull requests and manual runs; it does not publish or create releases. Configure the repository's protected branch and required CI check after upload. VSIX packaging is possible before publication metadata is finalized; `release:check` intentionally rejects placeholders and missing evidence. Use `npm run package:release` for a Marketplace preview artifact after satisfying these gates. Both package commands resolve documentation links against the source repository.

References: https://code.visualstudio.com/api/working-with-extensions/publishing-extension and https://code.visualstudio.com/api/extension-guides/workspace-trust . Publisher policies and technical checks are not a legal compliance certification.
