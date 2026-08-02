# NARN

[![publish-image](https://github.com/zercade-dev/app-narn/actions/workflows/publish-image.yml/badge.svg?branch=develop)](https://github.com/zercade-dev/app-narn/actions/workflows/publish-image.yml)
[![CI](https://github.com/zercade-dev/app-narn/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/zercade-dev/app-narn/actions/workflows/ci.yml)
[![Security Audit](https://github.com/zercade-dev/app-narn/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/zercade-dev/app-narn/actions/workflows/security.yml)
[![docker-build](https://github.com/zercade-dev/app-narn/actions/workflows/docker-build.yml/badge.svg?branch=main)](https://github.com/zercade-dev/app-narn/actions/workflows/docker-build.yml)

NARN is a multi-provider machine-translation workbench with a React frontend,
supporting LLM-based and classical MT engines, AI review, glossaries, and
translation memory.

The repository is a pnpm workspace (Node >= 24, pnpm 11.2.2) with three
packages plus per-provider translation modules:

- `packages/server` — Express API with a module registry, a password-encrypted
  credential vault, glossaries, translation memory, and background run engines
  for translation and AI review.
- `packages/frontend` — Vite + React SPA for project management, module
  configuration, translation runs, AI/manual review, and reporting.
- `packages/shared` — the `TranslationModule` contract and the AI SDK provider
  layer used by every LLM module.
- `modules/<id>` — first-party translation providers (anthropic, copilot,
  deepl, deepseek, generic-ai, google, openai, openrouter, pseudo).

The app runs either standalone or embedded in a separate hosting layer, which
supplies its own adapters through the injection seams in `packages/server`.
Comments in the source call that layer the _cloud composition root_; it is not
part of this repository.

## Commands

The server stores its data in Postgres and will not start without
`DATABASE_URL` set, so arrange that before `pnpm dev`: copy `.env.example` to
`.env` at the workspace root and point it at a Postgres. `.env.example`
documents the other settings; `packages/server/src/config/env.ts` is the
authoritative list.
Alternatively `docker-compose.yml` runs the published image against a Postgres
of its own.

```bash
pnpm install   # install workspace deps
pnpm dev       # server (:3001) + frontend (:5173) in parallel
pnpm build     # clean + tsc build of all packages
pnpm lint      # eslint over packages/*/src
make verify    # build + lint + format:check + dependency security audit
```

## Tests

The automated suites — unit, integration and end-to-end — are maintained
outside this repository. Comments in the source that refer to a covering test
are describing those suites. `make verify` here runs the build, lint, format
and dependency-audit checks.

## Git hooks

`.githooks/pre-push` runs `make verify` before a push. Enable it once with
`git config core.hooksPath .githooks`.

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) covers the build, the `make verify` gate, the
code style, and the contributor licence agreement the project asks for.

## Licence

NARN is licensed under the Business Source License 1.1 (`BUSL-1.1`) — see
[`LICENSE`](LICENSE), which is the authoritative text. In summary: production
use is permitted, including running a non-commercial hosted instance, but
offering NARN to third parties as a commercial hosted or managed service
requires a separate licence. On the Change Date stated in that file, the licence
converts to the Apache License, Version 2.0.

Third-party code redistributed with NARN is covered by
[`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md). Trademark and
no-affiliation statements are in [`TRADEMARKS.md`](TRADEMARKS.md).
