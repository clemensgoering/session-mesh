# Data handling

Session Mesh does not implement analytics, telemetry, advertising or a remote backend. It does not start its own model processes. It connects to local Claude/Codex processes under the current OS user. The explicit open_session action may launch/focus the provider Desktop app to open an existing Codex thread; that app may load its own session processes. The provider tools themselves contact their providers and may persist conversations or send their own telemetry under their existing settings. Messages injected into a session can enter that provider's model context and use its account quota.

Discovery reads Claude's live session registry and Codex's recent session index, including names, IDs, workspace paths, status and provider remote-registration metadata. Codex state subscriptions temporarily receive the native conversation snapshot in memory to extract runtime status; it is not logged or saved. Same-user sessions discovered through MCP receive peer metadata across workspaces. Only use this integration among mutually trusted sessions.

For Windows Claude peer delivery, Session Mesh reads the target's native OS-user-protected **peer** credential file. It never reads the own-child token or claims own-child status. Credentials are used only for native pipe authentication, are not returned by MCP and are not intentionally logged or saved. The integration does not implement a separate multi-user security boundary.

The extension persists hidden entry IDs and onboarding state in VS Code global storage. It copies the MCP runtime there to keep setup paths stable across upgrades. Setup explicitly changes MCP configs and managed instruction blocks at user or project scope and creates backups; existing config backups may contain secrets and must remain private. No setup file is written until the user invokes the setup command.

Messages are sent only by an explicit UI send action or an MCP send_message call. Output logs contain route IDs and transport outcomes, not message bodies. No TCP listener, cloud synchronization or automatic transcript forwarding is included. Native pipes remain subject to the providers' rules and OS access controls.

Stopping/uninstalling the extension does not stop provider sessions, remove provider histories or revoke sign-ins. Previously configured MCP runtime files and managed instruction blocks remain until explicitly removed as described in the README.

Version 0.3 additionally stores Desktop owner attestations, routing mode, orchestrator ID, last connection-probe marker/metadata and historical user phone checks in bridge-state.json next to the stable runtime. These are shared with same-user MCP processes, contain native IDs/timestamps and are not cryptographic identity or current device-health evidence. The last 50 UI attempt metadata records are memory-only. Connection probes send a small user-triggered model prompt; no probes run automatically.

Project discovery additionally reads only thread IDs, saved working directories and archive flags from the local Codex state database, opened read-only. Missing or incompatible metadata falls back to unknown; it never proves live ownership. The explicit open_session tool passes only a validated native UUID to the OS protocol handler, without prompt text or credentials.

Version 0.4.1 stores view scope and hidden IDs per VS Code workspace, and project-to-orchestrator assignments in shared bridge state. Runtime lock directories coordinate state updates and UI opening across updated processes; a stale lock blocks operations until inspected. These are coordination safeguards, not access controls.

Version 0.4.2 reads bounded head/tail regions (at most 128 KiB each) of local Claude session transcripts to extract only custom-title/ai-title metadata with the exact native session ID. Other content in those regions is transiently read but not returned, logged or saved by Session Mesh. Title results are cached in memory by file size/mtime. Native titles, original registry names and provenance are returned through discovery; user-defined display labels are stored in shared bridge state by session ID and do not rename provider chats.
