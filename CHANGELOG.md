# Changelog

## 0.3.0 ? Desktop-/phone-oriented tunnel

- Defaults Codex delivery to user-confirmed Desktop owners; permits explicit any-owner local mode.
- Shows exact owner IDs, owner-evidence provenance, route readiness, role and separate historical phone checks.
- Rechecks ownership before sending and aborts on an owner change. No ownership takeover.
- Adds Desktop/mobile guide, explicit connection probes, phone-receipt confirmation and orchestrator marking.
- Adds read-only diagnose_session MCP tool and metadata-only diagnostic view.
- Shares persistent routing preferences between the version-stable MCP runtime and UI.
- Preserves hide/restore, exact addressing, global/project setup, standards and native approvals.

Validation: 19 passing automated tests, installed VSIX 0.3 verification, MCP 0.3 handshake and read-only live owner diagnosis. Existing-session message delivery and simultaneous mobile access require a live user test; no claim that native Codex exclusivity is fixed.

## 0.2.0 — Experimental existing-session tunnel

- Replaces managed worker creation with discovery of existing Claude sessions and indexed Codex threads.
- Adds native Codex owner discovery and separate online/idle/busy/unknown states.
- Routes through existing native IPC endpoints; does not start/resume provider sessions.
- Adds hide/remove, restore hidden entries, copy exact ID and refresh commands.
- Adds shared MCP tools and standards, user-wide/project setup, config backups and a version-stable MCP runtime path.
- Preserves native approvals and labels peer identity as self-reported.
- Shows Claude remote registration separately from verified connection; Codex remote state remains unknown.

Validation: automated protocol/config tests and read-only live discovery. Native bidirectional delivery, inbound policy outcomes and mobile delegation remain unverified. Reload VS Code when upgrading from 0.1; that removes the old managed UI entries without deleting provider chats.

## 0.1.0 — Initial experiment

Created separate Claude/Codex worker sessions. Retired because it did not connect the user's existing provider conversations. No longer exposed in 0.2.
