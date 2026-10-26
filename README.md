# Session Mesh

Connect **existing Claude Code sessions and Codex threads** through a local MCP messaging bridge. A Claude orchestrator can delegate to Codex workers and receive results while you control Claude from your phone.

**Experimental preview · Windows x64 · VS Code Desktop · MIT**

[Download VSIX](https://github.com/clemensgoering/session-mesh/releases) · [Changelog](CHANGELOG.md) · [Transport details](TRANSPORTS.md)

## Features

- Lists names, native IDs, observed online/idle/busy state and route readiness.
- Sends messages through existing native endpoints, including steering active Codex turns.
- Sets up shared MCP tools and communication instructions for both providers.
- Marks an orchestrator and hides entries without deleting provider chats.

Session Mesh does not create, resume or take ownership of provider threads. It has no durable queue, automatic replay or completion forwarding. Agents explicitly send results back. Provider approvals still apply.

## Requirements

Local Windows x64, VS Code 1.94+, Node.js 22+, and separately installed and signed-in Claude Code and Codex. Keep the participating sessions running. A trusted local workspace is required; Remote SSH/WSL extension hosts and virtual workspaces are unsupported.

The native transports are private and version-sensitive. Provider updates may break compatibility. No provider binaries or credentials are bundled. This project is not affiliated with Anthropic, OpenAI or Microsoft.

## Installation

1. Download the VSIX from [GitHub Releases](https://github.com/clemensgoering/session-mesh/releases). In VS Code, choose **Extensions → … → Install from VSIX**.
2. Open **Session Mesh** in the Activity Bar. Refresh after opening additional sessions. Discovery considers the latest 100 indexed Codex threads; a saved thread alone is not reachable.
3. Run **Session Mesh: Set up tools and standards**. Choose user-wide setup for use across projects, or project-only setup. Set `sessionMesh.nodePath` if Node is installed elsewhere.
4. Reconnect/reload MCP and instructions in both providers. Reopen the same existing threads if necessary. Accept native MCP trust prompts. A VSIX upgrade cannot hot-load tools into existing MCP processes.
5. Check `routeReady: true` and copy the full `claude:<native-id>` or `codex:<native-id>` IDs. Names can collide; Claude registry names can differ from tab titles.

## Claude orchestrator and phone access

Keep VS Code with Session Mesh running and both provider sessions open. Default routing accepts the actual live Codex owner in VS Code or Desktop; Desktop confirmation is not required.

1. Right-click the Claude session and choose **Mark as orchestrator**.
2. Give Claude the exact Codex worker ID and task. Ask it to identify itself, send the task through Session Mesh and request an explicit result addressed to its own ID.
3. Give workers the instruction below, replacing the placeholder with Claude's actual native ID.
4. Enable Claude's own Remote Control and continue that same Claude session from your phone. Keep the PC and participating sessions running. Codex workers do not need separate mobile access for this workflow.

> Use Session Mesh to identify yourself with your own native session ID. Explicitly send your final result or blocker with send_message to claude:<orchestrator-native-id>, including the task reference. Your ordinary final answer is not forwarded. Do not reply to simple acknowledgements.

For another project, reuse user-wide setup, open the relevant sessions, reload their MCP/instructions if needed, and select their exact IDs. More specific project settings can override user-wide configuration. Discovery spans the same OS user and machine, across projects: connect only mutually trusted sessions.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `list_sessions` | Find sessions, reachability, availability and orchestrator role. |
| `identify_session` | Pin your own native ID for this MCP connection before sending. |
| `send_message` | Send a task, question or result to an exact session ID. |
| `diagnose_session` | Inspect the owner and blocked routes without sending. |
| `mesh_standards` | Read the shared communication rules. |

Identity is self-reported, not authentication. Peer messages are agent input, never human approvals.

## Status and delivery

**Online** means a live endpoint or owner was observed. **Available** means positively observed idle; unknown is not available. **Route ready** means current local routing checks passed. These observations can change before a send.

**Submitted** means a Claude inbox write. **Accepted** means the Codex owner accepted the request. Neither proves model receipt or task completion. Request an explicit acknowledgement/result with a unique reference. Never automatically resend an ambiguous failure or timeout; a busy state alone is not a receipt.

Local live tests completed **Codex → Claude → Codex** with an explicit result, plus a separate active-turn steering test. The native view remained healthy. The user also reported successful phone use while Claude and Codex were both open in VS Code. This is one observed setup, not a guarantee for other machines or provider versions.

Session Mesh has no phone UI or network listener and does not activate provider remote access. Remote registration and transport acceptance do not prove phone receipt. Direct mobile access to individual Codex threads is a separate provider feature and can be blocked by native session exclusivity; Session Mesh cannot bypass it.

Optional Desktop-only routing and manual Desktop/phone confirmations support testing that separate workflow. Confirmations record historical user checks, not continuous remote health. Keep **Allow all local owners** for the Claude-orchestrator workflow.

## Troubleshooting

- **Missing tools or transport closed:** reconnect Session Mesh MCP in that provider. Running MCP processes may retain the old version after an upgrade.
- **Saved thread offline:** open the same thread in its provider UI and refresh. The bridge does not start substitute sessions.
- **Route blocked:** use `diagnose_session` and check the owner and routing mode.
- **Native view needs reload:** versions through 0.3.1 could leave malformed UI input cached. Reload the owning UI and reopen the same thread. A message may already have been processed; inspect history before resending.
- **Unclear delivery:** check recipient history and request a referenced result; do not blindly retry.

## Configuration and removal

User-wide setup updates the Session Mesh MCP entry/managed blocks in `~/.claude.json`, `~/.codex/config.toml`, `~/.claude/CLAUDE.md` and `~/.codex/AGENTS.md`. Project setup uses `.mcp.json`, `.codex/config.toml`, `CLAUDE.md` and `AGENTS.md` in the chosen folder. Setup preserves unrelated content, backs up changed files and rejects conflicting unmanaged entries. Keep `.session-mesh-<timestamp>.bak` backups private: original configs can contain secrets.

The MCP runtime is copied to VS Code extension global storage so its path survives upgrades. Routing preferences, orchestrator selection and historical probe/phone checks are stored beside it. There is no durable message outbox.

To remove the integration, remove its MCP entries and marked instruction blocks, reconnect the providers, then uninstall the extension. Remove the stored runtime only after removing MCP references. Provider chats remain untouched.

## Development and distribution

```sh
npm ci --ignore-scripts
npm run check
npm test
npm audit --audit-level=high
npm run package
```

The runtime has no npm dependencies. CI validates and packages the VSIX; it does not publish. Downloads are distributed through GitHub Releases. The Marketplace publisher is not configured; `local-lab` is the existing preview extension identity. See [release requirements](RELEASING.md) before Marketplace publication.

[Privacy](PRIVACY.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [License](LICENSE)
