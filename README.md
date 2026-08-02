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

## Run it with Docker

The published image serves the API and the built UI on a single port. Postgres
is required — the server exits on boot without `DATABASE_URL` — so both recipes
below start a database alongside the app. Nothing else needs installing.

The image is built for **amd64**; on Apple Silicon Docker runs it under
emulation. While the package is private, run `docker login ghcr.io` once with a
token that has `read:packages`.

### With Docker Compose

[`docker-compose.yml`](docker-compose.yml) is a complete local stack. Download
that one file — a full checkout is not needed — and from its directory run:

```bash
docker compose up -d
```

Then open <http://127.0.0.1:3001>.

Compose is the recommended path because it also applies the parts that are easy
to get wrong: Postgres joins an internal network with no host port, so only the
app container can reach it, and the app runs with a read-only root filesystem,
dropped Linux capabilities, `no-new-privileges`, and memory and PID limits.

### With plain Docker

```bash
docker network create narn

docker run -d --name narn-db --network narn \
  -e POSTGRES_USER=translator \
  -e POSTGRES_PASSWORD=translator \
  -e POSTGRES_DB=translator \
  -v narn-db:/var/lib/postgresql/data \
  postgres:17-bookworm

docker run -d --name narn --network narn \
  -p 127.0.0.1:3001:3001 \
  -e HOST=0.0.0.0 \
  -e DATABASE_URL='postgres://translator:translator@narn-db:5432/translator' \
  -v narn-data:/data \
  ghcr.io/zercade-dev/narn:latest
```

`HOST=0.0.0.0` binds inside the container so Docker can forward to it; the
published port stays on host loopback. Keep it on `127.0.0.1` — the standalone
API has no authentication, by design. Exposing it on `0.0.0.0` would put an
unauthenticated API on your network.

To use a different host port, change only the left-hand side of the mapping
(`-p 127.0.0.1:8000:3001`). The container always listens on 3001 internally.

### After it starts

Provider credentials are configured in the UI, not through the environment. On
first run you choose a vault password; API keys are then stored in a local
AES-256-GCM-encrypted vault and are never read from environment variables.

Two volumes hold everything that must survive a container replacement:

- `narn-data` (`/data`) — the vault file plus per-project backups and
  auto-snapshots.
- `narn-db` — the Postgres data directory, which holds the project data itself.

Schema migrations apply automatically on first connect.

`:latest` tracks the newest stable release; pin `:X.Y.Z` for a reproducible
deployment. [`.env.example`](.env.example) documents every supported setting and
`packages/server/src/config/env.ts` is the authoritative list.

## Commands

The server stores its data in Postgres and will not start without
`DATABASE_URL` set, so arrange that before `pnpm dev`: copy `.env.example` to
`.env` at the workspace root and point it at a Postgres. `.env.example`
documents the other settings; `packages/server/src/config/env.ts` is the
authoritative list. To run the released image instead of a source checkout, see
[Run it with Docker](#run-it-with-docker) above.

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
