# Data handling

Session Mesh does not implement analytics, telemetry, advertising or its own remote backend. It starts the installed Claude or Codex CLI when you create a session. Those tools contact their respective providers and may use their own telemetry, authentication and storage settings. Your provider accounts, terms and usage charges continue to apply.

Session Mesh holds names, IDs, workspace paths, messages, pending messages and conversation text in extension-host memory. Reloading or closing that extension host loses this state. Native harnesses can separately persist conversations and execution logs under their own configuration directories. The VS Code Output channel receives transport status, routing metadata and generic diagnostics. Session Mesh does not intentionally persist authentication tokens or raw harness stderr.

Each session receives a random local router credential through its MCP subprocess configuration. That credential allows the session to list peers and send messages to them within this extension-host instance. Peer listings disclose session names, IDs, availability and workspace paths. Messages are sent to the target harness and can enter the target provider's model context. Only create mutually trusted sessions in the same instance. Processes running as the same OS user are outside this isolation boundary.

The router listens on an OS-assigned port on 127.0.0.1, requires a session credential, and has no public-network listener. No cloud synchronization is provided. Do not include secrets in bug reports, screenshots or conversation exports. There is no export feature in this preview.

Stopping a session disconnects its credential and terminates its direct harness process. Model-invoked subprocess cleanup depends on the harness; inspect your processes if a shutdown fails. Uninstalling the extension does not delete provider-owned data or revoke provider sign-ins.
