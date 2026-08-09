# Contributing to NARN

Thanks for wanting to help. This page covers the licence, the contributor
agreement and why it exists, and how to get the project building on your machine.

## The licence, and what it means for you

NARN is licensed under the Business Source License 1.1 — [`LICENSE`](LICENSE) is the
authoritative text, and this is only a summary. It is a source-available licence,
not an open-source one: you may read, modify and self-host the code, including
running a non-commercial hosted instance, but offering NARN to third parties as a
commercial hosted or managed service needs a separate licence. On the Change Date
stated in [`LICENSE`](LICENSE), that version converts to the Apache License,
Version 2.0.

Anything you contribute ships under those same terms, and converts along with the
version it ships in, on that version's own Change Date.

## The contributor licence agreement, and why there is one

NARN is maintained by a single owner, who also runs a hosted service built on this
code. That arrangement works only while the owner holds all the copyright in the
codebase — it is what makes it possible to publish this repository under BSL 1.1 in
the first place, to convert it to Apache 2.0 on the Change Date, and to grant a
separate commercial licence to anyone who needs one. A contribution the owner does
not hold those rights over would quietly take all of that away.

There are two usual ways to handle this, and they are not equivalent:

- A **Developer Certificate of Origin** — a `Signed-off-by` line on each commit — is
  almost no work for you, but all it does is certify that you had the right to
  submit what you submitted. It grants the project no rights, so it would not let
  the project relicense your work.
- A **contributor licence agreement** does grant those rights, at the cost of asking
  you to read and sign something once.

NARN asks for the agreement, because the relicensing right is the part the project
actually needs. It is in [`CLA.md`](CLA.md), and it is the Apache Software
Foundation's Individual Contributor License Agreement with the party names changed;
every deviation from the Apache original is listed at the bottom of that file.

**What you keep:** the copyright in your contribution stays yours. The licence you
grant is non-exclusive, so you can go on using your own work anywhere else, under
whatever terms you like, with no obligation to this project.

**How to sign:** read [`CLA.md`](CLA.md), fill in the details at the top, and email it
to the address given there. A typed name and date in the body of the email counts as
your signature — you do not need to print, scan or convert anything, though a scan or
a PDF is equally welcome. It is once per person, not once per contribution: say in
your first pull request that you have sent it, and the maintainer will confirm receipt
on that pull request, so both of you have a record.

Clause 4 of the agreement mentions a Corporate CLA, for contributors whose employer
holds rights in the work they create. There is no standing Corporate CLA document. If
your employer requires one, say so in the same email and one will be drawn up.

## Getting set up

You need Node 24 or newer and pnpm 11.2.2 — both are declared in the root
`package.json`, as `engines.node` and `packageManager`.

The server stores its data in Postgres and will not start without `DATABASE_URL`
set, so arrange that before `pnpm dev`: copy `.env.example` to `.env` at the
workspace root and point it at a Postgres. `.env.example` documents the other
settings, and `packages/server/src/config/env.ts` is the authoritative list.
Alternatively `docker-compose.yml` runs the published image against a Postgres of
its own.

```bash
pnpm install   # install workspace deps
pnpm dev       # server (:3001) + frontend (:5173) in parallel
pnpm build     # clean + tsc build of all packages
pnpm lint      # eslint over packages/*/src
```

## The local gate

```bash
make verify
```

`make verify` runs `pnpm build`, `pnpm lint`, `pnpm format:check` and a dependency
security audit that fails on high or critical advisories in production
dependencies. Run it before you open a pull request.

Two things it does **not** do, both deliberate:

- **It runs no automated suite.** The suites — unit, integration and end-to-end —
  are maintained outside this repository, so there is nothing here for it to run.
  Comments in the source that refer to a covering suite are describing those. Please
  do not add instructions telling people to run something this repository does not
  ship.
- **It does not check catalog pinning.** `pnpm lint:deps` does that, and continuous
  integration runs it separately. Run it yourself if you touched a dependency —
  versions are pinned in the `catalog:` section of `pnpm-workspace.yaml` and package
  manifests reference them as `"catalog:"`, not as literal versions.

`.githooks/pre-push` runs `make verify` for you before a push. Enable it once with
`git config core.hooksPath .githooks`.

## Code style

- **Formatting is Prettier's job, not yours.** The settings live in `.prettierrc`.
  `pnpm format` rewrites, `pnpm format:check` verifies. In Markdown, emphasis is
  written with `_underscores_`.
- **Linting is ESLint**, configured in `eslint.config.mjs` and run by `pnpm lint`
  over `packages/*/src`. Some rules — the React hooks rules in particular — are
  enforced only here, so a clean build and a clean format check do not imply a clean
  lint.
- **TypeScript throughout**, with the shared compiler settings in
  `tsconfig.base.json`.

Match the surrounding code rather than introducing a new style, and keep a pull
request to one subject.

## Opening an issue, and what the labels mean

Please use one of the [issue templates](https://github.com/zercade-dev/app-narn/issues/new/choose)
— a bug report, a feature request, or a small suggestion. Each one applies the label
that says what kind of issue it is, so you do not need to label anything yourself:
`bug`, `enhancement` or `polish`. `documentation` and `question` exist for the same
purpose and are applied by hand. An issue carries exactly one of these.

Every new issue also arrives with `needs-triage`, which means only that the
maintainer has not yet decided what happens to it. That label is managed
automatically, by [`.github/workflows/issue-triage.yml`](.github/workflows/issue-triage.yml),
and the rule it enforces is this: an issue stops needing triage once it is **closed**
or **assigned**. Closing is itself a decision — fixed, duplicate, `wontfix`, all of
them count — and assigning means someone has taken it on. Reopening an issue that
nobody is assigned to puts the label back, because the decision has been undone. A
daily sweep reconciles anything the live path missed, so `needs-triage` on an open,
unassigned issue always means what it says.

Please do not report a vulnerability as a public issue, whatever the labels suggest —
the `security` label is for issues that arrive that way by mistake. See _Reporting a
security issue_ below for the private channel.

## Pull requests

Open pull requests against `develop`; `main` carries releases. Continuous
integration builds, lints, checks formatting and checks catalog pinning on every
pull request.

Please do not bump the version in `package.json` — that happens once per release,
not once per change.

## Reporting a security issue

Please report a suspected vulnerability privately, by email to security@zercade.dev
rather than opening a public issue. GitHub's **Report a vulnerability** button on the
[Security tab](https://github.com/zercade-dev/app-narn/security/advisories/new) is the
same private channel and the easier route. That address is for security reports only;
the commercial-licensing contact in [`LICENSE`](LICENSE) is a different one. The full
policy, including what's in scope, is [`SECURITY.md`](SECURITY.md). Include enough
detail to reproduce the problem, and please give the maintainer a chance to ship a fix
before disclosing it publicly.

## Trademarks

[`TRADEMARKS.md`](TRADEMARKS.md) covers third-party names used in this project and
the absence of any affiliation. Third-party code redistributed with NARN is covered
by [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
