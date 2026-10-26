# Changelog

## 0.4.0 — Open existing Codex workers on demand

- Adds identified MCP open_session and an extension action to open an exact saved Codex thread through the documented Desktop deep link. No task or message is sent by opening.
- Waits for native ownership and a known state; reports ready, already-online, blocked or open-requested without forcing locks or starting replacement threads.
- Preserves live owners, rejects archived/unknown targets, and coalesces duplicate opening requests within an MCP process.
- Reads saved project paths from local Codex SQLite metadata in read-only mode. Optional list_sessions project_path filters the project and descendants before the recent-thread limit. Missing metadata remains unknown.
- Updates orchestrator instructions for existing projects and on-demand opening. Native owner lifetime and MCP loading still depend on the provider.

Validation: 30 automated tests; live opening changed existing Lademanagement and Vulkan Biom threads from not-loaded/no owner to idle/route-ready without sending a message; the second check used the identified MCP handler. Project-filtered discovery found 35 saved project threads; the first worker remained reachable after opening the second. No new end-to-end messaging or phone test was performed for this version.


## 0.3.4 — Preview documentation and distribution

- Rewrites the English README around installation, explicit result reporting and a remote Claude orchestrator.
- Records user-reported successful phone use with Claude and Codex open in VS Code, without claiming general mobile compatibility.
- Translates command palette labels and package description to English; corrects the workspace-trust description.
- Updates security/support statements to match completed local bidirectional and active-turn tests. Corrects stale Desktop-only onboarding and fixes the optional Desktop confirmation action's missing owner snapshot. Native messaging behavior is unchanged from 0.3.3.


## 0.3.3 — Complete busy-turn request metadata

- Supplies restoreMessage (cwd, context/workspace roots, text and ID) and attachments on the private steering path. The owner UI dereferences these fields before dispatching turn/steer.
- Adds a regression for that native pre-dispatch contract.
- Local live verification: existing Codex worker sent a new test ping to Claude, Claude replied and the Codex worker confirmed ROUNDTRIP_OK; a separate active-turn steering probe confirmed BUSY_OK. Native view stayed ready with zero malformed inputs. No prior business message was resent.
- Test setup also exposed a stale/closed MCP connection in the controlling chat. The official thread-message API was used to supply the direct user-authorized test task; ping/pong used Session Mesh. Existing MCP clients must reconnect to load this version. Mobile access is unverified.

Validation: 24 passing tests plus the local live checks above.

## 0.3.2 — Fix native UI text and owner receipts

- Supplies the mandatory text_elements array on private owner UI text input, preventing the observed Desktop placeholder renderer crash.
- Decodes the method on the outer IPC reply and the unwrapped result; exposes the native turnId on accepted sends.
- Detects previously malformed optimistic input caches, reports native-view-needs-reload and blocks additional sends until UI recovery.
- Replaces self-consistent mock replies with fixtures matching the installed owner bridge response contract.

Validation: 23 passing tests. The affected business message was verified in persisted Codex history, its turn completed, and its reply was found in the recipient Claude transcript as peer input. No business message was resent. Existing UI cache recovery and a new live send with this fix require verification after the owning UI/MCP reload.

## 0.3.1 ? Remove the accidental local-routing barrier

- Default local routing accepts actual live Codex owners without a Desktop attestation.
- Retains optional Desktop-only policy and distinct remote evidence.
- Corrects common agent instructions: a remotely reachable Claude coordinator can delegate to local Codex workers in either UI.
- Adds a regression test for unknown/VS Code owner routing. This does not establish bidirectional delivery or fix native Codex mobile exclusivity.

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
