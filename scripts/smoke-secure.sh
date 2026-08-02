#!/usr/bin/env bash
# Smoke test for `start:secure`: boots the built server under Node's permission
# model and verifies it serves reads and persists writes into its allow-listed
# paths (notably the vault file) — catching changes that add a new write location
# without updating the --allow-fs-* flags in packages/server/package.json.
#
# The server fail-closes without DATABASE_URL, so this spins an ephemeral throwaway
# Postgres (Docker), points the server at it over TCP, and tears it down on exit —
# mirroring how it already manages its own server process. Set SMOKE_DATABASE_URL to
# reuse an existing throwaway DB (e.g. a CI service container) and skip Docker.
#
# Requires a prior `pnpm build`. Used by `make smoke-secure` and CI.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-3919}"
BASE="http://127.0.0.1:$PORT"
SERVER_DIR="$PWD/packages/server"
# A throwaway vault so the smoke test never touches (or fails against) a real
# one. The path matches the `--allow-fs-write=$PWD/.translator-vault.json*`
# glob, so unlocking exercises the vault write path under the permission model.
VAULT_FILE="$SERVER_DIR/.translator-vault.json.smoke"
COOKIES=$(mktemp)
SERVER_LOG=$(mktemp)

# Ephemeral Postgres, pinned to the same image the cloud stack uses. Torn down by
# the trap below; PG_CONTAINER stays empty when we reuse SMOKE_DATABASE_URL.
PG_IMAGE="${SMOKE_PG_IMAGE:-postgres:17-bookworm@sha256:517f51201e18a12503a42945ef0b434d65a5297d72a4180f11905d905fcc5612}"
PG_CONTAINER=""

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    # setsid put the server in its own group; kill the whole tree, not just pnpm.
    kill -- -"$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  # -v: also drop the container's anonymous volume (postgres declares a VOLUME),
  # else each smoke run orphans one and they stack endlessly on the runner.
  [ -n "$PG_CONTAINER" ] && docker rm -f -v "$PG_CONTAINER" >/dev/null 2>&1 || true
  if [ -s "$SERVER_LOG" ]; then
    echo "--- start:secure server log ---" >&2
    cat "$SERVER_LOG" >&2 || true
  fi
  rm -f "$VAULT_FILE" "$COOKIES" "$SERVER_LOG"
}
trap cleanup EXIT

# --- Database: the server fail-closes without DATABASE_URL. ---
if [ -n "${SMOKE_DATABASE_URL:-}" ]; then
  export DATABASE_URL="$SMOKE_DATABASE_URL"
  echo "smoke-secure: using SMOKE_DATABASE_URL (skipping ephemeral Postgres)"
else
  command -v docker >/dev/null 2>&1 || {
    echo "smoke-secure: Docker is required to start an ephemeral Postgres (the server needs DATABASE_URL). Install Docker, or set SMOKE_DATABASE_URL to a throwaway DB." >&2
    exit 1
  }
  PG_CONTAINER="translator-smoke-pg-$$"
  PG_DB="translator_smoke"
  PG_PASSWORD="smoke-secure"
  echo "smoke-secure: starting ephemeral Postgres ($PG_IMAGE)"
  docker run -d --name "$PG_CONTAINER" \
    -e POSTGRES_PASSWORD="$PG_PASSWORD" \
    -e POSTGRES_DB="$PG_DB" \
    -p 127.0.0.1::5432 "$PG_IMAGE" >/dev/null || {
    echo "smoke-secure: failed to start the Postgres container" >&2
    exit 1
  }
  # Discover the ephemeral host port Docker assigned (avoids collisions when
  # other jobs on a shared runner also bind 5432).
  PG_PORT=$(docker inspect \
    --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' \
    "$PG_CONTAINER")
  # First IP across the container's networks (the legacy top-level
  # .NetworkSettings.IPAddress key is absent on newer docker API versions —
  # the template hard-errors, so range the networks map instead). `|| true`:
  # an inspect failure just disables the bridge fallback, it must not abort
  # the script under set -e.
  PG_BRIDGE_IP=$(docker inspect \
    --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' \
    "$PG_CONTAINER" 2>/dev/null | awk '{print $1}' || true)
  # Wait until the DB answers a query over TCP *inside* the container. The
  # unix socket is not a safe probe: the image's init phase runs a temporary
  # server with listen_addresses='' that answers the socket but not TCP, and
  # the host-side accept is no signal either — docker-proxy accepts on the
  # published port before (and while) the backend isn't listening (observed:
  # host accept at t=1s with postgres not yet answering at all). Requiring
  # in-container TCP closes that window: it only passes once the final,
  # post-init server is listening. Then a TCP path from the host must accept.
  # Preferred TCP path is the published port (127.0.0.1:$PG_PORT); if that
  # never comes up but the container's bridge IP accepts directly, fall back
  # to the bridge IP — docker's port publishing (docker-proxy/DNAT) broke on
  # the CI runner on 2026-07-11 (container healthy + listening, mapped port
  # ECONNREFUSED for 30s+), and the bridge route sidesteps it on native-Linux
  # docker. DATABASE_URL is only exported after the working path is known.
  # timeout: a firewalled (DROP) path makes the bash /dev/tcp connect hang for
  # the kernel connect timeout (~2 min) — observed wedging the CI smoke step
  # for 20+ min on 2026-07-11. Bound each probe so an unreachable path fails
  # in seconds, not hours.
  tcp_ok() {
    timeout 2 bash -c "exec 3<>'/dev/tcp/$1/$2'" 2>/dev/null
  }
  pg_query_ok() {
    docker exec "$PG_CONTAINER" psql -h 127.0.0.1 -U postgres -d "$PG_DB" -c 'select 1' >/dev/null 2>&1
  }
  PG_HOST=""
  for _ in $(seq 1 30); do
    if pg_query_ok; then
      if tcp_ok 127.0.0.1 "$PG_PORT"; then
        PG_HOST="127.0.0.1"
        break
      fi
      if [ -n "$PG_BRIDGE_IP" ] && tcp_ok "$PG_BRIDGE_IP" 5432; then
        echo "smoke-secure: published port 127.0.0.1:$PG_PORT unreachable; using container bridge IP $PG_BRIDGE_IP:5432 (runner port-publishing appears broken)" >&2
        PG_HOST="$PG_BRIDGE_IP"
        PG_PORT=5432
        break
      fi
    fi
    sleep 1
  done
  [ -n "$PG_HOST" ] || {
    echo "smoke-secure: ephemeral Postgres did not become ready in time (needs in-container TCP psql AND host TCP via 127.0.0.1:$PG_PORT or $PG_BRIDGE_IP:5432)" >&2
    docker logs --tail 20 "$PG_CONTAINER" >&2 || true
    exit 1
  }
  export DATABASE_URL="postgres://postgres:$PG_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB"
fi

rm -f "$VAULT_FILE"
export PORT VAULT_FILE

# setsid: pnpm wraps the real node process, so killing only $! would leave the
# server running. A fresh process group lets cleanup kill the whole tree.
setsid pnpm --filter @zercade-dev/narn-server start:secure >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -fsS "$BASE/api/vault/status" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "smoke-secure: server exited before becoming ready" >&2
    exit 1
  fi
  sleep 1
done

curl -fsS "$BASE/api/vault/status" | grep -q '"unlocked"' || {
  echo "smoke-secure: vault status check failed" >&2
  exit 1
}

# First unlock creates the (throwaway) vault file — a write into the
# .translator-vault.json* allow-list entry.
curl -fsS -c "$COOKIES" -X POST "$BASE/api/vault/unlock" \
  -H "Origin: $BASE" \
  -H 'Content-Type: application/json' \
  -d '{"password":"Smoke-Secure-Passw0rd!"}' \
  | grep -q '"unlocked":true' || {
  echo "smoke-secure: vault unlock (vault file write) failed" >&2
  exit 1
}

# End-to-end check: project create round-trips through the API and the Postgres
# store under the permission model (project data lives in Postgres; the vault
# unlock above is the file-based write-path check).
create_response=$(
  curl -fsS -b "$COOKIES" -X POST "$BASE/api/projects" \
    -H "Origin: $BASE" \
    -H 'Content-Type: application/json' \
    -d '{"name":"secure-smoke","sourceLanguage":"en","activeLanguages":[]}'
)
echo "$create_response" | grep -q '"secure-smoke"' || {
  echo "smoke-secure: project create failed under the permission model" >&2
  echo "$create_response" >&2
  exit 1
}

# Clean up the smoke project so local runs don't accumulate test data.
# (node, not sed: the response nests other objects with "id" fields.)
project_id=$(echo "$create_response" | node -e '
  const chunks = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", () => {
    const d = JSON.parse(Buffer.concat(chunks).toString());
    process.stdout.write(String(d.id ?? d.project?.id ?? ""));
  });
')
if [ -n "$project_id" ]; then
  curl -fsS -b "$COOKIES" -H "Origin: $BASE" -X DELETE "$BASE/api/projects/$project_id" >/dev/null || true
fi

# The permission model must not have denied any write the server actually needs.
# The audit logger swallows its own failure, so assert on the server log — this is
# the check that catches a writable path missing from the --allow-fs-* flags.
sleep 1  # let any async audit-write failure flush to the log
if grep -qE 'ERR_ACCESS_DENIED|Failed to write audit log' "$SERVER_LOG"; then
  echo "smoke-secure: server hit a permission-model denial — a write path is not covered by the --allow-fs-* flags in packages/server/package.json:" >&2
  grep -nE 'ERR_ACCESS_DENIED|Failed to write audit log' "$SERVER_LOG" >&2 || true
  exit 1
fi

echo "smoke-secure: start:secure boots and serves reads/writes under the permission model"
