# Session Mesh

**Experimental preview · Windows x64 · VS Code Desktop.** A local tunnel between your **existing** Claude Code sessions and Codex threads. It does not create replacement chats, run a separate agent or manage an orchestration queue. Not affiliated with Anthropic, OpenAI or Microsoft.

## Recovery from the 0.3.0/0.3.1 rendering failure

A message sent with an older adapter may already have been processed and answered even though the tool said delivery unknown. Do not resend it. Versions through 0.3.1 omitted the UI text_elements array and checked the wrong response envelope. This could crash the native Desktop renderer while backend work continued.

After installing 0.3.2, reload the owning Codex UI (for a VS Code owner: Developer: Reload Window), reopen the same existing thread, then retry the Desktop view. Reconnect/reload Session Mesh MCP in both harnesses so no old server process remains. The extension diagnoses native-view-needs-reload while malformed optimistic input remains cached and blocks further sends to that view. No provider transcript, binary or model history is patched by this repair. Existing-session read-only history reload alone did not clear the observed cache; UI recovery still requires verification after the owning UI reload.

## Minimal remote orchestration setup

Use a remote-enabled Claude session as your phone entry point. Keep your existing Codex workers open locally in VS Code or Desktop. Both load the same user-wide Session Mesh MCP server and standards. Claude identifies itself, sends a task to an exact Codex ID, and asks the worker to explicitly send_message its result back to Claude. From the phone, continue that same Claude Remote Control session. Codex does not need its own mobile connection for this route. A local live test has now completed Codex → Claude → Codex and a separate active-turn steering check. This does not verify mobile UI access.

Version 0.3.1 removes the accidental default Desktop-confirmation barrier. Online local recipients may receive messages through their real owner even if the owner app type is unknown. If upgrading a setup that explicitly saved desktop-only mode, choose Codex-Routing ? Alle lokalen Besitzer erlauben. Direct mobile control of every Codex thread remains independent and is not promised by this tunnel.

## What it does

- Discovers live Claude sessions from their native registry and recently indexed Codex threads from the native index.
- Probes the existing inbox/owning application instead of treating files on disk as online sessions.
- Shows name, native ID, harness, online status, observed idle/busy state and known remote registration.
- Delivers messages to the exact native session through its existing transport; busy Codex turns use steering.
- Gives both harnesses the same MCP tools and communication standards. An agent explicitly sends results to its designated orchestrator; no completion hook is required.
- Lets you hide entries without deleting, archiving or stopping the original chat.

## Optional direct Codex phone workflow

VS Code may stay open as a tunnel. Do not keep the target Codex chat open there for this workflow. Default Codex routing now accepts **any actual live native owner**. Desktop-only mode is optional, and the following steps apply only if you deliberately choose it. The MCP runtime can route without an open VS Code window. This changes routing safeguards, not Codex remote-control support.

1. Let the current answer finish. Close that Codex chat in VS Code, then open the **same existing thread** in the Desktop app. If Desktop still says it is used in another session, do not confirm it yet. Closing a tab is not guaranteed to release native ownership. Session Mesh does not force it.
2. Refresh Session Mesh. Inspect its actual native owner client ID. The owner application can remain unknown: originator and saved last-writer metadata are not proof. A native client-status event can identify VS Code; otherwise choose **Desktop-Besitzer best?tigen** only after you checked Desktop is independently usable and the conflicting VS Code chat is closed. This is an explicit user attestation, labelled as such.
3. Choose **Verbindungstest senden**. This deliberately sends a small prompt to the existing session, asking for a unique MESH_PROBE reply without tools or file changes. Check the reply in Desktop and then on the phone in that same host/thread. Native approvals can still block it.
4. Choose **Handy-Empfang best?tigen** only when that exact reply is visible on the phone. Confirmation records a historical user check and timestamp, not continuous remote health. A fresh successful transport submission (within 15 minutes) for the same owner is required.
5. Use **Als Orchestrator markieren** to publish that session's coordinator role through list_sessions. Workers should still address its exact ID. No model is started by marking a role.

Owner changes invalidate matching Desktop/mobile evidence. To intentionally permit VS Code-owned local workers, use **Codex-Routing w?hlen ? Alle lokalen Besitzer erlauben**; this may reproduce the native mobile conflict. The tunnel never transfers ownership or bypasses that conflict. Read-only **diagnose_session** and the extension's diagnostic view expose owner IDs, route blocks and separate remote evidence.

Hidden entries, online, idle, routeReady, owner application evidence and remote check are distinct. A pipe write or owning UI response never becomes a model/mobile acknowledgement automatically. If mobile updates still fail, this remains an unresolved provider path; a separately tested remote Claude orchestrator is an alternative.

## Install and use

Requires local Windows x64, VS Code 1.94+, Node.js 22+, and separately installed and signed-in provider CLIs/extensions. Provider accounts, usage costs and approval policies still apply. No provider binaries or credentials are bundled. Remote SSH/WSL extension hosts and virtual/untrusted workspaces are not supported in this preview.

1. Install `session-mesh-win32-x64-0.3.3.vsix` via Extensions → … → Install from VSIX. Reload the VS Code window once when upgrading from 0.1.
2. Open Session Mesh in the Activity Bar. Existing reachable sessions appear automatically; use Refresh if you open more chats. The latest 100 indexed Codex threads are considered. Claude names are its native registry names and can differ from tab titles.
3. Run **Session Mesh: Werkzeuge und Standards einrichten**. Choose **Alle Projekte dieses Benutzers** for user-wide adoption, or **Nur dieses Projekt**. Supply an absolute Node.js path if needed. Setup preserves existing entries and backs up changed files. It refuses conflicting unmanaged `session-mesh` configuration instead of overwriting it.
4. Reload MCP/configuration in your **existing** provider sessions, or reopen those same threads if your harness requires it. Installation alone cannot hot-load new tools or instructions into an already running agent. Approve native MCP trust prompts as required. Changing project instructions does not rewrite a running model's context.
5. Right-click an entry to copy its full ID, send a message or choose **Aus Session Mesh entfernen**. **Ausgeblendete Sessions wieder anzeigen** restores hidden entries. Removing an entry never deletes its provider history.

Example instruction for a worker:

> Use Session Mesh list_sessions. Identify yourself with identify_session using your own native ID. Work on the assigned task and explicitly send your final result or blocker with send_message to `claude:<orchestrator-native-id>`. Do not respond to simple acknowledgements.

If the agent cannot establish its own native ID, tell it the ID shown in Session Mesh. Identity is self-reported, not an authenticated permission boundary. Multiple sessions can share a title; use `claude:<uuid>` or `codex:<uuid>` for reliable routing.

## Online, available and remote

**Online/reachable** means a native pipe/owner was observed. **Available** means that reachable session was positively observed idle. Unknown state is never presented as available. Discovery is a point-in-time observation and can race with closure or a new turn. Claude state comes from its live registry, which may lag runtime changes. Codex state comes from a temporary read-only stream subscription to the owning UI. An unowned saved thread must first be opened in its provider UI; Session Mesh will not resume it in a second process.

Claude remote `registered` means its registry contains a provider bridge session ID, not that a mobile device is currently connected. Codex remote status is currently unknown. Use the provider's own Remote Control setup in the original session. Session Mesh does not activate remote access, alter remote policies, expose a network listener or implement a phone UI. With a remotely reachable orchestrator and running host, its loaded MCP tools can delegate through the local tunnel.

Delivery results are **submitted** for a Claude inbox write and **accepted** for an owning Codex UI response. Neither confirms the model read the message or completed the work. Claude inbound rules can hold/refuse messages. Request an explicit reply when needed; never blindly retry an ambiguous timeout. No automatic queue, transcript forwarding, replay or persistence is implemented.

## Setup files

User-wide setup changes `~/.claude.json` (only the named MCP entry), `~/.codex/config.toml` (managed MCP block), `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md` (marked instruction blocks). Project setup instead changes `.mcp.json`, `.codex/config.toml`, `CLAUDE.md` and `AGENTS.md` in the chosen folder. Backups use `.session-mesh-<timestamp>.bak`; keep backups private because the original configs may contain secrets. Setup is user-invoked and never silently changes every project on activation. More specific project settings or provider policy can override user-wide configuration.

Desktop bindings, routing mode, designated orchestrator, last probe metadata and phone checks are stored in bridge-state.json next to the stable runtime. MCP clients and the UI share it. The last 50 UI transport attempts are in memory and clear on reload.

The MCP runtime is copied into VS Code's extension global storage so its path survives extension version upgrades. To uninstall the integration, remove the `session-mesh` MCP entry/marked blocks from the above files, reload MCP in the providers, then uninstall the extension. Uninstalling the VSIX alone does not remove those user-configured files or provider history. Delete the global-storage runtime only after removing its MCP references.

## Development and verification

`npm ci --ignore-scripts`, `npm run check`, `npm test`, `npm run package`. The packaged runtime has no npm dependencies. GitHub CI packages the VSIX but never publishes it. F5 uses the Extension Development Host.

Native read-only discovery has identified a live Claude VS Code session and an active Codex owner without starting/resuming chats. End-to-end delivery in both directions into existing provider windows, busy/idle races, inbound hold/refuse and remote-mobile delegation remain release gates. Private transport compatibility is experimental and can change on provider updates; see [transport notes](TRANSPORTS.md).

[Privacy](PRIVACY.md) · [Security](SECURITY.md) · [MIT License](LICENSE) · [Changes](CHANGELOG.md) · [Contributing](CONTRIBUTING.md) · [Release procedure](RELEASING.md).
