# Security Policy

Please do not open public issues for suspected vulnerabilities that could expose
Hawk credentials, access tokens, or customer telemetry.

Use GitHub's private vulnerability reporting feature for this repository when
it is enabled. Include:

- affected version and Node.js version;
- reproduction steps or a minimal proof of concept;
- expected and observed behavior;
- impact and suggested mitigation, if known.

Do not include real Hawk tokens, passwords, request headers, request bodies,
source maps, or private customer data in a report. Redact identifiers and
credentials before attaching logs.

The MCP server stores authentication tokens only in the configured local
session file. It never prints those tokens through MCP tools.
