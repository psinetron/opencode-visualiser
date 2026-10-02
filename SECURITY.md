# Security Policy

## Supported Versions

Security fixes are provided for the latest published version of
`psinetron-opencode-visualizer`. Please update before reporting a vulnerability.

## Reporting a Vulnerability

Please report vulnerabilities privately through
[GitHub security advisories](https://github.com/psinetron/opencode-visualiser/security/advisories/new)
if private vulnerability reporting is enabled. If that option is unavailable,
contact the maintainer through the contact information on the
[psinetron GitHub profile](https://github.com/psinetron) to arrange a private
reporting channel. Do not include exploit details or sensitive data in public
issues or pull requests.

Include the affected plugin and OpenCode versions, operating system, steps to
reproduce, expected and observed behavior, and potential impact. Remove secrets
and personal data from logs and screenshots. Reports will be reviewed on a
best-effort basis; no response deadline is guaranteed.

## Local Data and Network Access

The plugin runs inside OpenCode and starts an HTTP/WebSocket server bound to
`127.0.0.1:5173`. It sends the project working directory, selected skin, and
selected OpenCode event payloads to the local visualizer. It stores skin
preferences in `.opencode/viz-skin.json` and diagnostic logs in
`.opencode/ocv-debug.log`.

The local server does not authenticate clients. Keep it restricted to a trusted
local environment and do not expose it through port forwarding or a public
proxy. Treat event payloads and diagnostic logs as potentially sensitive.
