#!/usr/bin/env bash
# Build the translator app image from the repository root and push it to GHCR for
# the given tag(s) and platform(s). Shared by the CI image workflows and runnable
# locally on any Docker host. Uses only the Docker CLI (buildx) — no marketplace
# Docker actions to pin.
#
# Env vars:
#   IMAGE           target image (default: ghcr.io/zercade-dev/narn)
#   TAGS            space-separated tag list, e.g. "pr-12-amd64 abc1234-amd64" (REQUIRED)
#   PLATFORMS       buildx platform (default: linux/amd64)
#   PUSH            "true" to push (default) or "false" to --load into the local
#                   image store (no publish).
#   GHCR_USER       GHCR username for login (default: $USER); login is skipped if no token
#   GHCR_TOKEN      GHCR token (e.g. the Actions GITHUB_TOKEN); login skipped if unset
#   BUILDX_BUILDER  buildx builder name (default: translator-builder)
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/zercade-dev/narn}"
PLATFORMS="${PLATFORMS:-linux/amd64}"
PUSH="${PUSH:-true}"
: "${TAGS:?set TAGS to one or more space-separated tags, e.g. 'pr-12-amd64'}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
context="$(dirname "$script_dir")" # the repository root — the Docker build context

# Authenticate to GHCR when a token is provided (CI passes the Actions token).
# Done before `set -x` and via --password-stdin so the token never hits the log.
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USER:-$USER}" --password-stdin
fi

# Use a docker-container (buildx) builder for --push plus a persistent build cache
# that survives across runs on the self-hosted runner. Idempotent: reuse if it exists.
builder="${BUILDX_BUILDER:-translator-builder}"
if ! docker buildx inspect "$builder" >/dev/null 2>&1; then
  docker buildx create --name "$builder" --driver docker-container >/dev/null
fi
docker buildx use "$builder"

# Build the --tag flags from the space-separated TAGS (intentional word-split).
tag_args=()
for t in ${TAGS}; do tag_args+=(--tag "${IMAGE}:${t}"); done

# --push publishes to the registry; otherwise --load into the local image store.
output_flag="--push"
[ "$PUSH" = "true" ] || output_flag="--load"

set -x
docker buildx build \
  --platform "$PLATFORMS" \
  --file "$context/Dockerfile" \
  "${tag_args[@]}" \
  "$output_flag" \
  "$context"
