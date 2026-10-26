# Efficient orchestration

These are default working rules for Session Mesh agents. Explicit user requirements and native approval rules take precedence. They reduce avoidable work; they are not token metering or enforced spending limits.

## Choose where work belongs

- Do a small task directly if briefing and integrating a worker would cost more than completing it.
- Reuse an existing session with relevant project context for a separable assignment. Do not send the same task to several workers for reassurance.
- Prefer the least expensive available model and reasoning setting that can reliably satisfy the acceptance checks. Use supported low-cost subagents for bounded searches, implementation or checks; use stronger models for architecture, difficult diagnosis and integration.
- Respect user model preferences. Session Mesh neither selects models nor verifies prices. Do not silently change another worker's settings or assume that a model is cheaper because of its name.
- Default to one worker. Use at most two concurrent workers unless a concrete plan justifies more. Avoid recursive delegation and overlapping file ownership. A worker should complete its bounded task or report a blocker before expanding it.

## Keep context small

Give a worker the goal, relevant paths, constraints, acceptance checks and exact return ID. Target 1,500 characters for the task packet, extending only when necessary evidence requires it. Link files and line numbers instead of copying transcripts or whole files. Share only the context the assignment needs.

Read relevant files first, narrow searches and reuse verified findings. Do not repeatedly scan the entire repository. Before context exhaustion, produce a short handoff containing decisions, changed files, checks, blockers and the next action. Do not repeat the full history.

## Minimize messages

Normally send one assignment and one result/blocker. Intermediate messages are for a blocking question, scope change or material coordination issue. No routine acknowledgements, unsolicited readiness announcements, heartbeat messages, repeated connectivity tests or polling loops.

Discover peers once per dispatch batch with project_path. Recheck when dispatching or after an owner change, failure or dependency requires it. Keep exact IDs for the current task; names are display aids. accepted/submitted is not completion. Never automatically resend ambiguous delivery.

Start with one bounded attempt. If it fails, report the failure and the proposed next step instead of repeatedly trying variations or expanding scope. The coordinator decides whether more work is justified. Run checks relevant to the change; repeat or broaden only for new changes, failures or unresolved concerns.

## Message templates

Assignment:

```text
TASK <reference>
Goal: <concrete outcome>
Scope: <paths and file ownership>
Constraints: <requirements; relevant context references>
Done when: <acceptance checks>
Budget: one bounded attempt; report blockers before expanding scope.
Return: send_message to <exact orchestrator ID>, same reference.
```

Result:

```text
RESULT <reference>: done | blocked
Outcome: <short result>
Files: <changed paths>
Checks: <relevant checks and result>
Open: <remaining issue or none>
```

A worker explicitly sends this result through Session Mesh before its ordinary final answer. Do not reply to a simple acknowledgement.

## Loading these rules

Setup writes the concise policy into managed Claude/Codex instruction blocks. The MCP initialization response and mesh_standards expose it as well. Reconnect MCP and reload provider instructions after upgrades; installed rules cannot rewrite an already running model's context. list_sessions omits repeated standards by default to save context; include_standards: true requests them when needed.
