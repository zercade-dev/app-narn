import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync, realpathSync } from 'node:fs';
dotenvConfig({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env') });
import express from 'express';
import cors from 'cors';
import { projectsRouter } from './routes/projects.js';
import { membersRouter } from './routes/members.js';
import { templatesRouter } from './routes/templates.js';
import { collabRoutingRouter } from './routes/collab-routing.js';
import { stringsRouter } from './routes/strings.js';
import { runsRouter } from './routes/runs.js';
import { classifyRouter } from './routes/classify.js';
import { logsRouter } from './routes/logs.js';
import { modulesRouter, projectModuleConfigRouter } from './routes/modules.js';
import { translationsRouter, translationsApproveRouter } from './routes/translations.js';
import { batchRouter } from './routes/batch.js';
import { glossaryRouter } from './routes/glossary.js';
import { orphansRouter } from './routes/orphans.js';
import { reportsRouter } from './routes/reports.js';
import { manualEditsRouter } from './routes/manual-edits.js';
import { backupRouter } from './routes/backup.js';
import { vaultRouter } from './routes/vault.js';
import { getVaultStore } from './identity/registry.js';
import { installTestTenantProviderIfEnabled } from './identity/test-tenant-identity-provider.js';
import { healthRouter } from './routes/health.js';
import { systemRouter } from './routes/system.js';
import { globalConfigRouter } from './routes/global-config.js';
import { freewayRouter } from './routes/freeway.js';
import { lqaRouter } from './routes/lqa.js';
import { tmRouter } from './routes/tm.js';
import { notificationsRouter } from './routes/notifications.js';
import { errorHandler } from './middleware/error-handler.js';
import { identityMiddleware } from './middleware/session.js';
import { requireUnlockedVault } from './middleware/require-vault.js';
import { csrfGuard } from './middleware/csrf-guard.js';
import { rateLimiter } from './middleware/rate-limiter.js';
import { hostGuard } from './middleware/host-guard.js';
import { parseTrustProxy } from './middleware/trust-proxy.js';
import {
  getPort,
  getHost,
  getCorsOrigin,
  getCorsOriginRaw,
  getFrontendDist,
  getTrustProxyRaw,
  getAllowedHost,
  getCsrfTrustedOrigin,
} from './config/env.js';
import { LOOPBACK_HOSTNAMES } from './middleware/loopback.js';
import {
  setupSecurityHeaders,
  setCSPWithNonce,
  isHstsEnabled,
} from './middleware/security-headers.js';
import { sessionCookieWouldBeSecure } from './identity/session-cookie.js';
import { mountSpa } from './http/serve-spa.js';
import { applyRegisteredRoutes, applyRegisteredEarlyMiddleware } from './http/extra-routes.js';
import { cspViolationRouter } from './routes/csp-violation.js';
import { colorTextRouter } from './routes/color-text.js';
import { stageDetailsRouter } from './routes/stage-details.js';
import { Router } from 'express';
import { logger } from './modules/M15-console-logger.js';
import { copilotClientPool } from './modules/copilot-client-pool.js';
import { closePool } from './storage/index.js';
import { startupSequence } from './startup.js';

const app: express.Application = express();
app.disable('x-powered-by');
// Loopback default (false); a cloud composition root sets TRUST_PROXY so
// req.secure/req.protocol reflects the reverse proxy's X-Forwarded-Proto.
app.set('trust proxy', parseTrustProxy(getTrustProxyRaw()));
setupSecurityHeaders(app);
// Anti-DNS-rebinding: reject non-loopback Host headers on every method.
app.use(hostGuard);
// Open-core injection seam (early): a cloud composition root may register
// middleware that must observe EVERY request — applied before CORS, identity,
// and CSRF, and all routers (e.g. HTTP timing metrics). No-op when unset.
applyRegisteredEarlyMiddleware(app);
const PORT = getPort();
// Loopback by default; opt-in to LAN/container-network access via HOST=0.0.0.0.
const HOST = getHost();

// Security: only allow requests from Vite dev server origin
app.use(
  cors({
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Session + CSRF run before body parsing: csrfGuard only reads headers/method
// and identityMiddleware resolves identity (the local provider only reads the cookie header), so a cross-origin request
// is rejected before its (≤10mb) body is read and parsed.
app.use(identityMiddleware);
// System status + operator restart-notice. Mounted BEFORE csrfGuard: the mutating
// routes authenticate with X-Restart-Token (a cross-origin page can't forge it), so
// the CSRF Origin check — which 403s a header-only POST — is redundant here.
// Scoped express.json gives these routes a parsed body; hostGuard (loopback) applies.
app.use('/api/system', express.json(), systemRouter);
app.use(csrfGuard);
app.use(express.json({ limit: '10mb' }));
// CSP reports arrive as application/csp-report (report-uri) or
// application/reports+json (Reporting API), not application/json.
app.use(
  express.text({
    type: ['application/csp-report', 'application/reports+json'],
    limit: '64kb',
  }),
);

// Cost-control (not anti-DDoS): cap how fast the paid-LLM kickoff routes can be
// fired so a runaway frontend loop or stray script can't rack up paid runs.
const paidRunLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

// Vault endpoints are reachable without an unlocked vault.
app.use('/api/vault', vaultRouter);

// Health endpoint for container healthcheck (ungated)
app.use('/api', healthRouter);

// Routes
app.use('/api', backupRouter);
app.use('/api/projects', projectsRouter);
// Ungated: the router does its own per-route assertProjectAccess call
// (membership resolves the 404-vs-403 split; no vault involvement).
app.use('/api/projects', membersRouter);
app.use('/api/projects', stringsRouter);
// Mounted before the vault-guarded routers: both report endpoints are
// read-only and must work with a locked vault.
app.use('/api/projects', reportsRouter);
// Mounted before the vault-guarded routers: glossary reads (list/get/export)
// must work with a locked vault; mutations are guarded per-route inside the
// router.
app.use('/api/projects', glossaryRouter);
// Mounted ungated: runsRouter's GET read endpoints and the
// queue/cancel/pause/resume controls operate on already-stored, non-secret run
// data and must work with a locked vault. The mutating LLM endpoints
// (retry/judge/source-review) apply requireUnlockedVault per-route.
app.use('/api/projects', runsRouter);
// Ungated, same reasoning as runsRouter above: reads already-stored, non-secret
// manual-edit audit rows and must work with a locked vault.
app.use('/api/projects', manualEditsRouter);
app.use('/api/projects', classifyRouter);
app.use('/api/projects', projectModuleConfigRouter);
// Ungated, and mounted BEFORE the vault-gated mounts. Express runs positional
// mount middleware (`app.use(prefix, mw, router)`) on EVERY request matching the
// prefix, regardless of whether the mounted router matches the inner path — so
// mounting orphans after the gated mounts made the gate + limiter fall through
// onto it (a locked-vault orphans GET 423'd, and each request burned 2 of the
// shared 30/min budget). Orphans reads are read-only; its mutations self-gate
// with per-route requireUnlockedVault inside the router, so nothing loses a gate.
app.use('/api/projects', orphansRouter);
// Ungated, and mounted BEFORE the vault-gated mounts, same reasoning as
// orphansRouter above: `/approve` records already-stored translations into the
// TM (a non-LLM write, ambient tenant) and must work with a locked vault — CSRF
// + identity middleware still apply globally. It must NOT sit behind the
// paid-LLM vault gate below (see the CARVE-OUT comment in routes/translations.ts).
app.use('/api/projects', translationsApproveRouter);
// The paid-LLM kickoff routers share ONE gate + limiter mount so a request is
// gated and counted exactly once. Two separate positional mounts double-ran both
// on the second router's routes (e.g. batch `/analyze`) via the same
// prefix-fall-through described above.
const gatedProjectRouters = Router();
gatedProjectRouters.use(translationsRouter);
gatedProjectRouters.use(batchRouter);
app.use('/api/projects', requireUnlockedVault, paidRunLimiter, gatedProjectRouters);
app.use('/api/templates', templatesRouter);
// Per-user (ambient-tenant) surface, same reasoning as tmRouter/
// notificationsRouter below: no LLM-credential dependency, so no
// requireUnlockedVault gate.
app.use('/api/collab-routing', collabRoutingRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/global-config', globalConfigRouter);
// Ungated: the router is read-only (one GET /status route), so there is
// nothing here that needs the vault unlocked.
app.use('/api/freeway', freewayRouter);
app.use('/api/lqa', lqaRouter);
app.use('/api/tm', tmRouter);
// Mounted ungated at the app level: the router applies requireUnlockedVault
// itself, per-route (`POST /chat`), so it doesn't need the shared
// gatedProjectRouters gate/limiter (this isn't a `/api/projects` route anyway).
app.use('/api/color-text', colorTextRouter);
// Mounted with the `:projectId` param baked into the prefix (mergeParams:
// true) rather than the flat `/api/projects` + internal `/:projectId/...`
// pattern sibling project-scoped routers use, so `PATCH /`, `POST /translate`,
// and `POST /chat` share one fixed prefix. Ungated: patching stage-details
// text is not an LLM-credential operation (`POST /translate` and
// `POST /chat` self-gate their own routes with requireUnlockedVault).
app.use('/api/projects/:projectId/stage-details', stageDetailsRouter);
// Ambient-tenant only, same reasoning as tmRouter above: no LLM-credential
// dependency, so no requireUnlockedVault gate.
app.use('/api/notifications', notificationsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/csp-violation', cspViolationRouter);

// Nonce endpoint for frontend
const nonceRouter = Router();
nonceRouter.get('/nonce', (req, res) => {
  const nonce = setCSPWithNonce(req, res);
  res.json({ nonce });
});
app.use('/api', nonceRouter);

// Resolve the built SPA dir. FRONTEND_DIST is set explicitly in the Docker
// image; otherwise locate packages/frontend/dist relative to this file. The file
// sits at a different depth when built (packages/server/dist/src/index.js ⇒
// ../../../frontend/dist) than when run from source via tsx in dev
// (packages/server/src/index.ts ⇒ ../../frontend/dist), so probe both and pick
// the one that actually holds an index.html. Falls back to the built path when
// neither exists; mountSpa then skips (logged below) instead of crashing on boot.
function resolveFrontendDist(): string {
  const explicit = getFrontendDist();
  if (explicit) return explicit;
  const here = dirname(fileURLToPath(import.meta.url));
  const builtDefault = resolve(here, '../../../frontend/dist'); // packages/server/dist/src
  const devFromSource = resolve(here, '../../frontend/dist'); // packages/server/src (tsx)
  for (const candidate of [builtDefault, devFromSource]) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return builtDefault;
}
const FRONTEND_DIST = resolveFrontendDist();
// We ship no favicon, so a browser's automatic /favicon.ico request would
// otherwise fall through to the SPA handler and get index.html back. Answer it
// with 204 No Content before mountSpa so the request resolves cleanly.
app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});
// Open-core route-injection seam: a cloud composition root may have called
// registerRoutes() to mount additional same-origin routes (e.g. cloud auth).
// Apply them here — after the /api routers, but before the SPA static/
// fallback/404/error handlers below. No-op when no registrar is set.
applyRegisteredRoutes(app);
// In dev the frontend is served by Vite (:5173), so a missing same-origin build
// is expected — mountSpa skips it and the API still boots.
if (!mountSpa(app, FRONTEND_DIST)) {
  logger.warn('spa:not-mounted', { frontendDist: FRONTEND_DIST });
}

// 404 handler for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

/**
 * The API has no authentication by design (single user, loopback only). The
 * secure defaults can all be overridden via env, so call out loudly when the
 * effective config exposes the server beyond the local machine.
 */
function warnIfExposedBeyondLoopback(): void {
  if (!LOOPBACK_HOSTNAMES.has(HOST)) {
    logger.warn(
      `HOST=${HOST} exposes the API beyond loopback. This server has NO authentication — ` +
        'anyone who can reach the port can read projects and trigger paid translation runs.',
    );
  }
  const corsOrigin = getCorsOriginRaw();
  if (corsOrigin === '*') {
    logger.warn(
      'CORS_ORIGIN=* allows any website open in your browser to call this API. ' +
        'Use the specific frontend origin instead.',
    );
  }
  const allowedHost = getAllowedHost();
  if (allowedHost) {
    logger.warn(
      `ALLOWED_HOST=${allowedHost} relaxes the anti-DNS-rebinding host guard ` +
        'beyond loopback hostnames.',
    );
  }
  warnIfPublicTransportUnhardened();
}

/**
 * In cloud/public mode (a public indicator — `CSRF_TRUSTED_ORIGIN` or
 * `ALLOWED_HOST` — is set) the transport-security preconditions must hold, or a
 * tenant's session cookie ships without `Secure` (interceptable over any
 * plain-HTTP hop) and there is no HSTS to force HTTPS. There is no `PUBLIC=1`
 * master switch, so fail LOUD at startup rather than silently: WARN when the
 * session cookie wouldn't be `Secure` (no `NODE_ENV=production` and no
 * `TRUST_PROXY` to engage the flag behind the TLS terminator) and WARN when HSTS
 * is off. Local mode (no public indicator) is untouched.
 */
function warnIfPublicTransportUnhardened(): void {
  const publicMode = !!(getCsrfTrustedOrigin()?.trim() || getAllowedHost()?.trim());
  if (!publicMode) return;
  if (!sessionCookieWouldBeSecure()) {
    logger.warn(
      'PUBLIC MODE (CSRF_TRUSTED_ORIGIN/ALLOWED_HOST set) but the session cookie will NOT be ' +
        'flagged Secure: set TRUST_PROXY (so req.secure reflects the TLS terminator’s ' +
        'X-Forwarded-Proto) or NODE_ENV=production. The credential-session cookie would ' +
        'otherwise be sent over plain HTTP and is interceptable.',
    );
  }
  if (!isHstsEnabled()) {
    logger.warn(
      'PUBLIC MODE (CSRF_TRUSTED_ORIGIN/ALLOWED_HOST set) but HSTS is OFF: set ENABLE_HSTS=1 when ' +
        'served behind TLS so browsers refuse to downgrade to HTTP.',
    );
  }
}

/**
 * Start the HTTP server: bind the port, harden the vault file, run the Postgres
 * migration/startup sequence, and register graceful-shutdown handlers. Resolves
 * once the server is listening.
 *
 * Extracted from module top-level so a cloud composition root can `import`
 * this module, register its cloud adapters via the identity and storage
 * registries, and THEN call `start()` — instead of the app listening as
 * an import-time side effect. When this file is the process entry point
 * (`node dist/src/index.js`, `tsx src/index.ts`) it self-starts via the
 * `isMainModule()` guard below, preserving the standalone/Docker boot.
 */
export function start(): Promise<void> {
  // E2E harness only (RATE_LIMIT_DISABLED=1, never prod/cloud): swap in a
  // provider that resolves a per-scenario tenant from the `test_tenant`
  // cookie so each e2e scenario is RLS-isolated. Inert otherwise; mirrors
  // the test-reset-lockout gate. identityMiddleware reads the provider per
  // request, so installing here (before listen) is in time for all traffic.
  installTestTenantProviderIfEnabled();
  return new Promise((resolveStarted) => {
    const server = app.listen(PORT, HOST, () => {
      logger.info(`Server started on ${HOST}:${PORT}`);
      warnIfExposedBeyondLoopback();
      // Fix permissions on vaults written before atomicWrite enforced 0600.
      void getVaultStore().harden();

      // Initialize Postgres + apply schema migrations before any store is used.
      // A migration failure is FATAL (the server cannot serve any store correctly);
      // the non-fatal instance/endpoint migrations stay warn-only inside
      // startupSequence → loadModulesAndInstances.
      void startupSequence().catch((err: unknown) => {
        logger.error('FATAL: database migration failed at startup; exiting', {
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      });
      resolveStarted();
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Server shutting down...');
      void copilotClientPool.destroyAll();
      void closePool();
      server.close(() => {
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}

/**
 * True when this module is the process entry point (run directly), false when
 * it is `import`ed by another module (a cloud composition root, or a test).
 * Compares the resolved entry path to this module's URL.
 */
function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  void start();
}

export { app };
// A cloud composition root calls this before tearing a tenant down, during
// account deletion, to drain a tenant's in-flight background runs. Exposed via the
// root barrel only — NOT `./storage` (storage must not import modules/engines).
export { drainProjectRuns, type DrainLogger } from './modules/run-drain.js';
