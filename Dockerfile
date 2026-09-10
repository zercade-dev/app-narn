# syntax=docker/dockerfile:1

# ---- builder: install + build the whole workspace ----
# Base image pinned by digest (multi-arch index) for reproducible, supply-chain-safe
# builds. Dependabot's `docker` ecosystem (.github/dependabot.yml) proposes digest
# bumps; refresh manually with: docker buildx imagetools inspect node:26-bookworm
FROM node:26-bookworm@sha256:e7bc1a4cd2419953c91f9a6f7bb6efb3737773093fb4ded0b1c77a0a5831fac4 AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Node 26 no longer ships corepack — install it explicitly before activating pnpm.
# Both corepack's version and the pnpm tarball's hash are pinned: this step fetches and
# then runs the package manager for the whole install, so an unpinned fetch here is the
# one unreproducible link in an otherwise digest-pinned build. The descriptor matches
# package.json's `packageManager`; regenerate both with `corepack use pnpm@<version>`.
RUN npm install -g corepack@0.36.0 \
    && corepack enable \
    && corepack prepare pnpm@11.2.2+sha512.36e6621fad506178936455e70247b8808ef4ec25797a9f437a93281a020484e2607f6a469a22e982987c3dbb8866e3071514ab10a4a1749e06edcd1ec118436f --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# Builds shared, all 9 modules, server (tsc), and frontend (vite build).
RUN pnpm -r build
# Flatten @zercade-dev/narn-server + its workspace/prod deps into a self-contained dir.
# --legacy: pnpm 10+ refuses `deploy` unless the workspace sets
# inject-workspace-packages=true; this workspace links normally, so use the
# pre-v10 deploy behavior (ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE otherwise).
RUN pnpm --filter @zercade-dev/narn-server deploy --prod --legacy /deploy

# ---- runtime: slim, no build tooling ----
# Base image pinned by digest (multi-arch index); see the builder note above.
FROM node:26-bookworm-slim@sha256:cd9f682fa2885cd1056e830424764158570061c59736a1da836bc3d73df095ae AS runtime
# Links the published GHCR package to this repo (previously set by docker/metadata-action).
LABEL org.opencontainers.image.source="https://github.com/zercade-dev/app-narn"
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV FRONTEND_DIST=/app/frontend-dist
# Self-contained server (dist + node_modules incl. shared + all modules).
COPY --from=builder /deploy /app
# The built SPA is NOT a server dependency, so copy it explicitly.
COPY --from=builder /app/packages/frontend/dist /app/frontend-dist
# Data dir owned by the non-root user so a fresh named volume inherits write access.
RUN mkdir -p /data && chown node:node /data
WORKDIR /data
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "/app/dist/src/index.js"]
