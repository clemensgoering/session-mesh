# Security policy

This is an experimental preview, not a hardened multi-user service. Only the current source version is maintained. It executes local AI harnesses with the user's existing credentials in a trusted workspace. Agent messages are untrusted input and must never be treated as human approval.

Do not report exploitable vulnerabilities in public issues. Use [GitHub private vulnerability reporting](https://github.com/clemensgoering/session-mesh/security/advisories/new) if enabled. If it is unavailable, contact the repository maintainer privately before sharing reproduction details. The maintainer must enable and verify this reporting channel before Marketplace publication.

Known limits: in-memory queues, no cross-instance sessions, no exactly-once delivery, no global message budget, limited server-request types, and incomplete bidirectional live validation. Unsupported requests are declined. Do not use the preview for unattended sensitive workflows.
