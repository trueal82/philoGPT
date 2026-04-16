# Security Policy

## Supported Scope

Security reports are accepted for:

- API authentication and authorization
- session, ownership, and access-control paths
- admin-only routes and privilege boundaries
- dependency and deployment misconfiguration issues

## Reporting a Vulnerability

Please do not open public issues for undisclosed vulnerabilities.

Instead, email the maintainers at:

- security@philogpt.dev

If this address is not active in your deployment/fork, open a private communication channel with repository maintainers.

Include:

- vulnerability type and impact
- exact affected endpoint/component
- reproduction steps
- proof-of-concept details
- suggested remediation if available

## Response Expectations

- Initial acknowledgment target: 72 hours
- Triage decision target: 7 days
- Patch timeline: based on severity and exploitability

## Hardening Baseline

- use strong `JWT_SECRET` values
- rotate admin credentials on first boot
- keep MongoDB inaccessible from public networks
- run `npm run test:security` before releases
