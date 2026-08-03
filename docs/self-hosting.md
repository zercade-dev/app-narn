# Self-hosting NARN

The published image bundles the API and UI on one port; Postgres is required — the server
won't start without `DATABASE_URL` — so both options below include one.

## With Docker Compose (recommended)

[`docker-compose.yml`](../docker-compose.yml) is a complete local stack. Download that one
file — a full checkout isn't needed — and from its directory run:

```bash
docker compose up -d
```

Then open <http://127.0.0.1:3001>.

Compose is the recommended path because it also applies the parts that are easy to get wrong:
Postgres joins an internal network with no host port, so only the app container can reach it,
and the app runs with a read-only root filesystem, dropped Linux capabilities,
`no-new-privileges`, and memory and PID limits.

## With plain Docker

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

`HOST=0.0.0.0` binds inside the container so Docker can forward to it; the published port
stays on host loopback. Keep it on `127.0.0.1` — the standalone API has no authentication, by
design. Exposing it on `0.0.0.0` would put an unauthenticated API on your network.

To use a different host port, change only the left-hand side of the mapping
(`-p 127.0.0.1:8000:3001`). The container always listens on 3001 internally.

## After it starts

Provider credentials are configured in the UI, not through the environment. On first run you
choose a vault password; API keys are then stored in a local AES-256-GCM-encrypted vault and
are never read from environment variables.

Two volumes hold everything that must survive a container replacement:

- `narn-data` (`/data`) — the vault file plus per-project backups and auto-snapshots.
- `narn-db` — the Postgres data directory, which holds the project data itself.

Schema migrations apply automatically on first connect.

`:latest` tracks the newest stable release; pin `:X.Y.Z` for a reproducible deployment.
[`.env.example`](../.env.example) documents every supported setting and
`packages/server/src/config/env.ts` is the authoritative list.

## Building from source, running tests, and contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) — it covers the commands, the local build/lint/format
gate, running tests, and the git hooks.
