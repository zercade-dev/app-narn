# Security Policy

## Reporting a vulnerability

**Please don't open a public issue for a security report.** Use GitHub's
private vulnerability reporting instead — the **Report a vulnerability**
button on this repository's
[Security tab](https://github.com/zercade-dev/app-narn/security/advisories/new).
It opens a draft advisory only you and the maintainers can see, and it's
where the fix gets worked on and disclosed from.

If you'd rather not go through GitHub, email **security@zercade.dev**.

Either way, please include:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof of concept if you have one.
- The version (or commit/image tag) you tested against.

You'll get an acknowledgement within a few days. Once a fix is out, we'll
credit you in the release notes unless you'd rather stay anonymous. There's
no bug-bounty program — reports are triaged and credited, not paid.

## Scope

This repository is the open-core NARN app, designed to run locally,
single-user, with no network-facing authentication of its own — see the
[README](README.md) for that model. It's also the codebase a separate
hosted multi-tenant cloud service is built on top of, so reports about
either side are welcome:

- Anything that could expose or exfiltrate credentials from the vault
  (`packages/server/src/modules/M18-vault.ts` and
  `M16-credential-store.ts`), or bypass the vault-unlock gate on the
  mutating LLM routes.
- Anything that defeats the server's host guard, CSRF/origin guard, or lets
  a request reach the API despite the loopback-only bind.
- Remote code execution, path traversal, or injection anywhere in the
  server or a translation module.
- Cross-site scripting in the frontend.
- Anything in this codebase that a multi-tenant deployment built on top of
  it would inherit — e.g. a gap in the injection seams the hosting layer
  uses to add its own auth/tenancy, or a request path that assumes
  single-user isolation that doesn't actually hold.

Reports that only apply to running the server on a network you don't
control, or with `HOST` deliberately set to expose it beyond loopback, are
still welcome — that's an explicitly documented risk, but real bugs in how
it's mitigated are still worth reporting.

The hosting layer's own source isn't in this repository and isn't public
yet, so a cloud-specific report will usually be based on the hosted
service's observed behavior rather than its code — that's fine, report it
here the same way. It'll get its own security policy if and when it's
published separately.

## Supported versions

Only the latest released version is supported. Please upgrade before
reporting if you're on an older one — the issue may already be fixed.
