# Contributing

Use Node.js 22+. Run npm ci --ignore-scripts, npm run check, npm test and npm run package. Runtime has no npm dependencies. F5 launches the Extension Development Host. Provider accounts or model calls are not required for CI tests.

The extension and stdio MCP server use native.cjs. New harness adapters must discover and route to an existing native owner/inbox without starting a substitute process. Do not equate saved history, liveness, idle state, transport submission and model acknowledgement. Keep unsupported capabilities unknown. Do not import or redistribute proprietary provider modules.

Add regression tests for wire framing, discovery races, owner routing, config preservation and permission boundaries. Live sending must be deliberate and must not use unrelated user chats as automated CI fixtures. Record provider versions and the difference between transport and model results. Never log credentials or snapshots.

Packaging-only overrides pin Azure Identity 4.13.0 and uuid 11.1.1 to avoid known advisories in vsce's dependency tree. Local packaging is tested; publishing authentication with these overrides is not verified. Review them when upstream dependencies are patched. Manual artifact upload is the supported initial publication path.
