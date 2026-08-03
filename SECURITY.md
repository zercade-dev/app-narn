# Security Policy

## Reporting a vulnerability

**Please don't open a public issue for a security report.** Email
**security@zercade.dev** instead, with:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept if you have one.
- The version (or commit/image tag) you tested against.

You'll get an acknowledgement within a few days. Once a fix is out, we'll
credit you in the release notes unless you'd rather stay anonymous.

## Scope

NARN is designed to run locally, single-user, with no network-facing
authentication of its own — see the [README](README.md) for that model. Reports
most relevant to that design include:

- Anything that could expose or exfiltrate credentials from the vault
  (`packages/server/src/modules/M18-vault.ts` and
  `M16-credential-store.ts`), or bypass the vault-unlock gate on the
  mutating LLM routes.
- Anything that defeats the server's host guard, CSRF/origin guard, or lets
  a request reach the API despite the loopback-only bind.
- Remote code execution, path traversal, or injection anywhere in the
  server or a translation module.
- Cross-site scripting in the frontend.

Reports that only apply to running the server on a network you don't
control, or with `HOST` deliberately set to expose it beyond loopback, are
still welcome — that's an explicitly documented risk, but real bugs in how
it's mitigated are still worth reporting.

## Supported versions

Only the latest released version is supported. Please upgrade before
reporting if you're on an older one — the issue may already be fixed.
