# syntax=docker/dockerfile:1

# ---- builder: install + build the whole workspace ----
# Base image pinned by digest (multi-arch index) for reproducible, supply-chain-safe
# builds. Dependabot's `docker` ecosystem (.github/dependabot.yml) proposes digest
# bumps; refresh manually with: docker buildx imagetools inspect node:26-bookworm
FROM node:26-bookworm@sha256:9f94d34c787165dca03b74e5bf9c3bf90e8de79b19aa3d87fe1fa1694bf75c89 AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# Node 26 no longer ships corepack — install it explicitly before activating pnpm.
RUN npm install -g corepack && corepack enable && corepack prepare pnpm@11.2.2 --activate
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
FROM node:26-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime
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
