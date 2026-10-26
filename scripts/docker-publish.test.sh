#!/usr/bin/env bash
# Checks scripts/docker-publish.sh against a stub `docker`, so nothing is built or
# pushed: the build command must carry the commit as the OCI revision label, and a
# context that is not a git checkout must make the script fail before building.
# Run: bash scripts/docker-publish.test.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Stub docker: record each call's argv, one call per line, and succeed.
mkdir "$work/bin"
cat >"$work/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$DOCKER_LOG"
STUB
chmod +x "$work/bin/docker"

fail() { echo "FAIL: $*" >&2; exit 1; }

# run_publish <context-dir>: run a copy of the script that treats <context-dir> as
# the repository root. Leaves the stub's log in $DOCKER_LOG and the status in $status.
run_publish() {
  mkdir -p "$1/scripts"
  cp "$here/docker-publish.sh" "$1/scripts/docker-publish.sh"
  DOCKER_LOG="$work/docker.log"
  : >"$DOCKER_LOG"
  status=0
  PATH="$work/bin:$PATH" DOCKER_LOG="$DOCKER_LOG" TAGS="t1" PUSH=false \
    GIT_CEILING_DIRECTORIES="$work" \
    bash "$1/scripts/docker-publish.sh" >/dev/null 2>&1 || status=$?
}

# 1. A git checkout: the build argv carries the full HEAD sha as the revision label.
repo="$work/repo"
mkdir "$repo"
git -C "$repo" init -q
git -C "$repo" -c user.name=t -c user.email=t@example.invalid commit -q --allow-empty -m init
sha="$(git -C "$repo" rev-parse HEAD)"
run_publish "$repo"
[ "$status" -eq 0 ] || fail "script exited $status in a git checkout"
build="$(grep '^buildx build ' "$DOCKER_LOG" || true)"
[ -n "$build" ] || fail "no 'docker buildx build' call recorded"
case "$build" in
  *"--label org.opencontainers.image.revision=${sha} "*) ;;
  *) fail "build argv lacks --label org.opencontainers.image.revision=${sha}: $build" ;;
esac

# 2. Not a git checkout: the script fails and never starts a build.
plain="$work/plain"
mkdir "$plain"
run_publish "$plain"
[ "$status" -ne 0 ] || fail "script succeeded in a non-git context"
if grep -q '^buildx build ' "$DOCKER_LOG"; then fail "built an image in a non-git context"; fi

echo "ok: docker-publish revision label"
