/**
 * Single source of truth for every server environment variable.
 *
 * Each accessor names its KEY, applies the SAME default + coercion the call
 * sites used before this module existed, and — critically — reads
 * `process.env` LIVE on every call (a function, never an import-time snapshot).
 * Server tests mutate `process.env` in `beforeEach`/at call time
 * (RATE_LIMIT_DISABLED, RESTART_ADMIN_TOKEN, TRUST_PROXY, SLOT_LABEL, …), so a
 * frozen object would both break those tests and change runtime behavior.
 *
 * Where a value is materialized into an eager module-level `const` today (e.g.
 * `PROJECTS_ROOT`, audit-logger's `LOG_DIR`, `MODELS_CACHE_DIR`), the const
 * calls the matching accessor at module-eval — identical import-time read
 * timing, with the KEY + default still defined only here.
 *
 * Two existing helpers already centralize their own concern and are NOT
 * duplicated here — reuse them directly:
 *   - `isCloudMode()`      — ../identity/registry.js
 *   - `parseTrustProxy()`  — ../middleware/trust-proxy.js
 * This module is deliberately dependency-free (only `process.env` / `process.cwd`)
 * so it can be imported from anywhere without introducing an import cycle.
 */

/* ────────────────────────────── Network ────────────────────────────── */

/** `PORT` — HTTP listen port. Default 3001. (index.ts) */
export function getPort(): number {
  return Number.parseInt(process.env.PORT ?? '3001', 10);
}

/** `HOST` — listen address. Loopback by default. (index.ts) */
export function getHost(): string {
  return process.env.HOST ?? '127.0.0.1';
}

/**
 * `CORS_ORIGIN` — allowed browser origin for the API. Default the Vite dev
 * origin. Used for the cors() config and the logs SSE `ALLOWED_ORIGIN`; the
 * startup `=== '*'` warning also reads it (the default value is never `'*'`, so
 * applying the default there is provably inert). (index.ts, routes/logs.ts)
 */
export function getCorsOrigin(): string {
  return process.env.CORS_ORIGIN ?? 'http://localhost:5173';
}

/**
 * `CORS_ORIGIN` — raw value (no default). Kept distinct from `getCorsOrigin()`
 * for the startup `=== '*'` exposure warning, which reads the raw var: unset →
 * `undefined` (no warn), exactly as before. (index.ts)
 */
export function getCorsOriginRaw(): string | undefined {
  return process.env.CORS_ORIGIN;
}

/** `FRONTEND_DIST` — explicit built-SPA dir override; unset → probe. (index.ts) */
export function getFrontendDist(): string | undefined {
  return process.env.FRONTEND_DIST;
}

/* ─────────────────────────── Transport / proxy ─────────────────────── */

/**
 * `TRUST_PROXY` — raw value. Two coercions consume it downstream and must both
 * see the raw string: `parseTrustProxy(...)` (Express `trust proxy` setting)
 * and `!!raw?.trim()` (session-cookie Secure predicate). (index.ts,
 * identity/session-cookie.ts)
 */
export function getTrustProxyRaw(): string | undefined {
  return process.env.TRUST_PROXY;
}

/** `TRUST_PROXY_CLIENT_IP` — honor the proxy client-IP header only when `=== '1'`. (client-ip) */
export function isTrustProxyClientIp(): boolean {
  return process.env.TRUST_PROXY_CLIENT_IP === '1';
}

/**
 * `PROXY_CLIENT_IP_HEADER` — the header carrying the true client IP, as set by
 * the CDN / reverse proxy in front. Lowercased for Node's header map; defaults
 * to one CDN's specific header spelling; set `PROXY_CLIENT_IP_HEADER` for
 * others. (client-ip)
 */
export function getProxyClientIpHeader(): string {
  const v = (process.env.PROXY_CLIENT_IP_HEADER ?? '').trim().toLowerCase();
  return v === '' ? 'cf-connecting-ip' : v;
}

/**
 * True when the RENAMED `TRUST_CF_CLIENT_IP` is still set. It is no longer read;
 * this exists only so startup can tell the operator their setting is inert. (startup)
 */
export function hasLegacyTrustCfClientIp(): boolean {
  return (process.env.TRUST_CF_CLIENT_IP ?? '').trim() !== '';
}

/**
 * `TRUSTED_PROXY_IPS` — trimmed comma-separated peer allow-list, or undefined.
 * The `.trim()` matches the call site, which treats empty as "no peer trusted".
 * (middleware/client-ip.ts)
 */
export function getTrustedProxyIps(): string | undefined {
  return process.env.TRUSTED_PROXY_IPS?.trim();
}

/* ────────────────────────────── Security ───────────────────────────── */

/**
 * `RATE_LIMIT_DISABLED` — raw `=== '1'` flag (NOT combined with cloud mode; the
 * call sites compose it with `!isCloudMode()` / `|| isCloudMode()` differently).
 * (rate-limiter, routes/vault, identity/test-tenant-identity-provider)
 */
export function isRateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === '1';
}

/** `NODE_ENV` — production predicate. (identity/session-cookie.ts) */
export function isNodeEnvProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * `ENABLE_HSTS` — raw `=== '1'` opt-in flag. `isHstsEnabled()` in
 * middleware/security-headers.ts ORs this with cloud mode; this accessor owns
 * only the env key + coercion. (middleware/security-headers.ts)
 */
export function isHstsFlagEnabled(): boolean {
  return process.env.ENABLE_HSTS === '1';
}

/** `CSP_CONNECT_SRC` — trimmed extra connect-src sources, or undefined. (security-headers) */
export function getCspConnectSrc(): string | undefined {
  return process.env.CSP_CONNECT_SRC?.trim();
}

/**
 * `ALLOWED_HOST` — raw value. Consumers apply their own parsing:
 * host-guard splits/trims/lowercases; index.ts startup warns + `?.trim()`s.
 * (middleware/host-guard.ts, index.ts)
 */
export function getAllowedHost(): string | undefined {
  return process.env.ALLOWED_HOST;
}

/**
 * `CSRF_TRUSTED_ORIGIN` — raw value. csrf-guard splits/trims; index.ts startup
 * `?.trim()`s. (middleware/csrf-guard.ts, index.ts)
 */
export function getCsrfTrustedOrigin(): string | undefined {
  return process.env.CSRF_TRUSTED_ORIGIN;
}

/* ─────────────────────────── Storage / paths ───────────────────────── */

/** `PROJECTS_ROOT` — root dir for project folders. Default `./projects`. (utils/project-path.ts) */
export function getProjectsRoot(): string {
  return process.env.PROJECTS_ROOT ?? './projects';
}

/** `VAULT_FILE` — explicit whole-file vault override; unset → tenant-scoped path. (utils/vault-file.ts) */
export function getVaultFile(): string | undefined {
  return process.env.VAULT_FILE;
}

/** `DATABASE_URL` — runtime Postgres DSN (unset throws at the call site). (storage/pg/pool.ts) */
export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

/** `MIGRATION_DATABASE_URL` — superuser DSN for schema migrations; unset → runtime pool. (storage/pg/pool.ts) */
export function getMigrationDatabaseUrl(): string | undefined {
  return process.env.MIGRATION_DATABASE_URL;
}

/**
 * `MODELS_CACHE_DIR` — base dir for the model cache; unset → `process.cwd()`.
 * The call site appends `/.cache` via `resolve(base, '.cache')`, so this owns
 * only the env key + cwd fallback. (routes/modules.ts)
 */
export function getModelsCacheBase(): string {
  return process.env.MODELS_CACHE_DIR ?? process.cwd();
}

/* ────────────────────────────── Logging ────────────────────────────── */

/**
 * `AUDIT_LOG_DIR` — directory for audit logs. Default `./logs`. NOTE the `||`
 * (not `??`): an empty string falls through to the default. (services/audit-logger.ts,
 * routes/logs.ts)
 */
export function getAuditLogDir(): string {
  return process.env.AUDIT_LOG_DIR || './logs';
}

/**
 * `AUDIT_LOG_RETENTION_DAYS` — retention window in days. `Number(...)`; a
 * non-finite or ≤0 value falls back to 7. (services/audit-logger.ts)
 */
export function getAuditLogRetentionDays(): number {
  const raw = Number(process.env.AUDIT_LOG_RETENTION_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

/** `LOG_FORMAT` — emit structured JSON log lines when `=== 'json'`. (M15-console-logger) */
export function isLogFormatJson(): boolean {
  return process.env.LOG_FORMAT === 'json';
}

/* ────────────────────────────── Limits ─────────────────────────────── */

/**
 * `MAX_CONCURRENT_RUNS_PER_TENANT` — raw value. The call site early-returns on
 * unset/non-finite/≤0 (unbounded), so the coercion stays there. (M9/run-capacity.ts)
 */
export function getMaxConcurrentRunsPerTenant(): string | undefined {
  return process.env.MAX_CONCURRENT_RUNS_PER_TENANT;
}

/**
 * `MAX_BACKUPS_PER_PROJECT` — raw value; passed through `sanitizeMaxBackups`
 * (which rejects malformed input) at the call site. (modules/auto-snapshot.ts)
 */
export function getMaxBackupsPerProject(): string | undefined {
  return process.env.MAX_BACKUPS_PER_PROJECT;
}

/**
 * `TRANSLATION_CONCURRENCY` — job-queue concurrency; default string `'3'`. The
 * call site applies `Number.parseInt(..., 10)` then guards finite/>0.
 * (modules/M9-translation-engine.ts)
 */
export function getTranslationConcurrency(): string {
  return process.env.TRANSLATION_CONCURRENCY ?? '3';
}

/* ────────────────────────────── Restart / ops ──────────────────────── */

/**
 * `RESTART_BANNERS_ENABLED` — enabled when the trimmed/lowercased value is one
 * of `1|true|yes|on`. (routes/system.ts)
 */
export function isRestartBannersEnabled(): boolean {
  const v = (process.env.RESTART_BANNERS_ENABLED ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * `RESTART_RECENTLY_WINDOW_MS` — "recently restarted" window in ms. `parseInt`;
 * a non-finite or ≤0 value falls back to 300_000. (routes/system.ts)
 */
export function getRestartRecentlyWindowMs(): number {
  const n = Number.parseInt(process.env.RESTART_RECENTLY_WINDOW_MS ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 300_000;
}

/** `SLOT_LABEL` — deployment slot label; trimmed, empty → null. (routes/system.ts) */
export function getSlotLabel(): string | null {
  const v = (process.env.SLOT_LABEL ?? '').trim();
  return v === '' ? null : v;
}

/** `RESTART_ADMIN_TOKEN` — operator restart token. Default `''` (feature off). (routes/system.ts) */
export function getRestartAdminToken(): string {
  return process.env.RESTART_ADMIN_TOKEN ?? '';
}

/**
 * `SUPPORT_EMAIL` — contact address surfaced in the UI. Unset/blank → null, and
 * the frontend hides the contact affordance entirely (a self-hosted instance has
 * no support inbox, and a broken `mailto:` is worse than none). (routes/system)
 */
export function getSupportEmail(): string | null {
  const v = (process.env.SUPPORT_EMAIL ?? '').trim();
  return v === '' ? null : v;
}
