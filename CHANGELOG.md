# Changelog

## 0.1.0 — Unreleased experimental preview

- Independent Windows x64 VS Code extension with Claude and Codex adapters.
- Session names, Mesh IDs, native IDs, connection status and availability.
- Shared `list_sessions` and `send_message` MCP tools.
- Local session conversations and per-request approval dialogs.
- Authenticated loopback transport; no bundled provider binaries or credentials.

Validation: both native CLIs answered a smoke prompt. Claude → Codex delivery succeeded. The Codex → Claude response did not complete within the 55-second test window; bidirectional communication remains an open release gate.
