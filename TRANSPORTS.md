# Existing-session transport notes — 0.2 preview

Session Mesh reimplements minimal clients; it does not copy, patch, bundle or import proprietary provider code. The transport contract is list, resolve and send. Extension UI and MCP server share the same implementation. No thread/start, thread/resume or provider process spawn is used.

## Codex

Observed installation: VS Code extension 26.1021.22027 win32-x64. The existing local router is `\\.\pipe\codex-ipc`. Frames use a little-endian 32-bit byte length followed by JSON. The integration registers as its own client, declines all incoming ownership-discovery requests, and asks thread-owner-discovery for an existing local owner. It does not start a replacement router.

A temporary follower subscription obtains a snapshot from the exact discovered owner and is removed immediately. threadRuntimeStatus determines idle/active; missing or unknown values remain unknown. Sends recheck ownership and snapshot state, then use the owner's thread-follower-start-turn (idle) or thread-follower-steer-turn (active), inheriting native thread settings. Peer sends require the owner's supportsUntrustedAppInput capability. No policy/model overrides or approval replies are sent. A race may still produce a native rejection; failed/ambiguous requests are not automatically replayed.

These IDE coordination methods are **private and version-sensitive**, distinct from the documented public app-server API. They were established by static examination of the user's installed extension and a read-only live probe. Discovery succeeded. Native message delivery is not yet accepted as an end-to-end tested feature.

## Claude

Observed live registry: native CLI 2.1.310. Read ~/.claude/sessions/<pid>.json; require a live PID and a cc-msg named-pipe address. Probe the endpoint before calling it reachable. A process-identity token in the peer key is checked against the registry when present. This does not fully rule out every PID/endpoint reuse race.

Windows peer keys are stored as <pid>.<sha256(lowercase(pipePath))>.key. Only peerToken is used, never an own-child credential. Reject symlinked key files, require a supported credential format, and send the auth line followed by a type:user frame with message.content, native session_id and message UUID. The native receiver marks this as peer input and applies inbound controls; the sender does not claim a permission-mode class. Claimed Session Mesh source ID is included as self-reported text, not a forged native Claude identity or return socket.

The local receiver implementation and schema were examined in the installed binary. The native inbox concept and inbound rules are documented at https://code.claude.com/docs/en/cross-session-messaging . There is no model-delivery receipt in this client, so writes return submitted, not delivered. A connected pipe is insufficient evidence that inbound rules allow the message. Native SendMessage cannot directly reply to a Session Mesh ID; replies use the shared MCP send_message tool after setup.

## Remote control

Remote control remains owned by each provider. No external port or alternate remote authentication is introduced. Claude bridgeSessionId is only a registration observation. Codex remote status is unknown. No claim of verified phone delegation is made without a live mobile end-to-end test.

## 0.3 owner and remote safeguards

Client status broadcasts can identify a client type when observed. Existing owners are not enumerated by the router handshake, so app type can remain unknown. Never infer current application ownership from originator/source fields. Default Desktop routing requires observed Desktop type or explicit user attestation for the live ownerClientId; an observed vscode type takes precedence over an attestation. Owner identity is checked again before mutation. UI/MCP do not register ownership handlers or resume threads. The immutable owner ID changes on client recreation, invalidating old evidence. Remote success is separately user-confirmed against a recent probe and displayed with its timestamp. It is not an automated provider-health measurement.

## 0.3.1 correction

The 0.3 Desktop-attestation default blocked otherwise reachable recipients before any message was sent. It is now optional; the default sends to the actual native owner. Unknown app type is diagnostic information, not a failed transport. Keep local send/receive testing separate from phone UI testing.

## 0.3.2 wire-contract correction

The private owner UI input is not the same contract as a minimal public app-server text input. Text must include text_elements:[]; the observed Desktop renderer calls that field's some method without a null fallback. The owning bridge validates its frontend {method,result} envelope and unwraps result before returning via IPC. Consequently the method is on the outer IPC response, with payload under result.result. Start acceptance includes payload.turn.id; steer acceptance includes payload.turnId. Versions through 0.3.1 checked result.method incorrectly. A completed persisted native turn and a corresponding incoming Claude peer message established delivery despite that misleading error. No native content or proprietary assets are part of the regression fixtures.

## 0.3.3 active-turn contract and live verification

The private steer entry point dereferences restoreMessage.cwd and restoreMessage.context.workspaceRoots before it dispatches anything. Include a restoreMessage with the same client message ID, text, timestamp, native workspace context and empty attachment arrays. This is native UI recovery metadata; it does not override the running turn permissions or model. A new local end-to-end ping/pong and a separate active-turn steer completed successfully. A first pong attempt on 0.3.2 failed before dispatch due to missing recovery metadata; the idle retry was performed only after the failure and absent pong were verified. No claim of mobile delivery follows from these checks.

## 0.4 existing-thread UI opening

The explicit open_session action uses the documented codex://threads/<UUID> Desktop deep link through the OS protocol handler. It never calls a model resume/start API or registers ownership. It validates exact saved IDs, preserves live owners, rejects known archived threads and polls native owner/state after navigation. A local live test opened Lademanagement from unowned to idle and route-ready; opening sent no message. This does not establish keep-alive for multiple idle tabs, model receipt or phone access. Saved cwd/archive metadata is read from state_5.sqlite in read-only mode and cannot establish current ownership. See https://learn.chatgpt.com/docs/reference/commands .
