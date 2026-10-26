# Security policy

This is an experimental same-user integration, not a multi-user messaging service. Only the current source version is maintained. Existing provider permission and inbound controls must remain in effect. Agent messages and claimed identities are untrusted input, never human approvals. Source IDs are self-reported by MCP callers and are not authenticated attestations of a process's native identity.

Report vulnerabilities privately through https://github.com/clemensgoering/session-mesh/security/advisories/new if enabled. If unavailable, contact the maintainer privately before sharing exploit details. The maintainer must verify a working private reporting channel before Marketplace publication.

Known limitations: private/version-sensitive transports, no model-delivery receipt for Claude, no durable outbox, no cross-machine discovery, no exactly-once delivery, finite discovery window, no global message budget and incomplete existing-session bidirectional/mobile validation. Native same-user IPC is not a security boundary against other processes running as that user. Setup backups can contain existing secrets and must not be committed.

Desktop and mobile confirmations are user attestations stored under the same OS user; they are operational safeguards, not a security boundary against local code or an identity-proof mechanism. Only the user interface exposes confirmation/mode mutation, not the MCP tool set. Private provider behavior and mobile exclusivity remain unverified until the live test.
