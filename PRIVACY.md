# Data handling

Session Mesh does not implement analytics, telemetry, advertising or a remote backend. It does not start model processes. It connects to existing local Claude/Codex processes under the current OS user. The provider tools themselves contact their providers and may persist conversations or send their own telemetry under their existing settings. Messages injected into a session can enter that provider's model context and use its account quota.

Discovery reads Claude's live session registry and Codex's recent session index, including names, IDs, workspace paths, status and provider remote-registration metadata. Codex state subscriptions temporarily receive the native conversation snapshot in memory to extract runtime status; it is not logged or saved. Same-user sessions discovered through MCP receive peer metadata across workspaces. Only use this integration among mutually trusted sessions.

For Windows Claude peer delivery, Session Mesh reads the target's native OS-user-protected **peer** credential file. It never reads the own-child token or claims own-child status. Credentials are used only for native pipe authentication, are not returned by MCP and are not intentionally logged or saved. The integration does not implement a separate multi-user security boundary.

The extension persists hidden entry IDs and onboarding state in VS Code global storage. It copies the MCP runtime there to keep setup paths stable across upgrades. Setup explicitly changes MCP configs and managed instruction blocks at user or project scope and creates backups; existing config backups may contain secrets and must remain private. No setup file is written until the user invokes the setup command.

Messages are sent only by an explicit UI send action or an MCP send_message call. Output logs contain route IDs and transport outcomes, not message bodies. No TCP listener, cloud synchronization or automatic transcript forwarding is included. Native pipes remain subject to the providers' rules and OS access controls.

Stopping/uninstalling the extension does not stop provider sessions, remove provider histories or revoke sign-ins. Previously configured MCP runtime files and managed instruction blocks remain until explicitly removed as described in the README.

Version 0.3 additionally stores Desktop owner attestations, routing mode, orchestrator ID, last connection-probe marker/metadata and historical user phone checks in bridge-state.json next to the stable runtime. These are shared with same-user MCP processes, contain native IDs/timestamps and are not cryptographic identity or current device-health evidence. The last 50 UI attempt metadata records are memory-only. Connection probes send a small user-triggered model prompt; no probes run automatically.
