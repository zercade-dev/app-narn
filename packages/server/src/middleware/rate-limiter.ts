import type { Request, Response, NextFunction } from 'express';
import { clientIp } from './client-ip.js';
import { isCloudMode } from '../identity/registry.js';
import { isRateLimitDisabled } from '../config/env.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

interface BucketEntry {
  count: number;
  windowStart: number;
}

/**
 * The bucket key for a request: the tenant id in cloud mode (so tenants
 * behind the shared cloud proxy each get their own bucket instead of
 * collapsing onto the proxy/NAT IP), else the client IP.
 *
 * Cloud mode alone isn't enough — a pre-auth request (e.g. `/vault/unlock`
 * before session/login, or `/auth/*` itself) has no ambient tenant yet, so
 * `getCurrentTenant()` returns undefined and this correctly falls back to
 * `clientIp(req)`, exactly as in open-core. Once identity resolves,
 * `identityMiddleware` (middleware/session.ts) has already wrapped the rest
 * of the pipeline in `runWithTenant(...)`, so `getCurrentTenant()` sees it
 * here downstream.
 */
function rateLimitKey(req: Request): string {
  if (isCloudMode()) {
    const tenant = getCurrentTenant();
    if (tenant?.userId) return tenant.userId;
  }
  return clientIp(req);
}

/**
 * Creates a lightweight in-memory rate limiter middleware.
 *
 * Tracks request counts per bucket key (the tenant id in cloud mode, else the
 * client IP — see `rateLimitKey`) within a FIXED window, not a sliding one:
 * the bucket is reset wholesale once `windowMs` elapses from its start, so a
 * burst straddling a window boundary is counted leniently. Acceptable for a
 * single-user local app. Returns HTTP 429 with a `Retry-After` header when the
 * limit is exceeded.
 *
 * @param options.maxRequests - Maximum requests allowed per window
 * @param options.windowMs   - Window duration in milliseconds
 *
 * Set `RATE_LIMIT_DISABLED=1` (E2E/test servers only) to make this a no-op
 * pass-through; never enabled in production or normal dev.
 *
 * The bypass is INERT in cloud mode. `RATE_LIMIT_DISABLED` is a test-server
 * convenience that no-ops ALL rate limiting; honoring it on a multi-tenant cloud
 * deployment would silently remove the anti-brute-force guard. So the bypass
 * only fires when `!isCloudMode()`, evaluated PER-REQUEST (not once at
 * construction) because `vaultUnlockRateLimiter` is built at module load —
 * before the cloud composition root has wired its adapter — and must start
 * enforcing the moment cloud mode is active.
 *
 * SINGLE-PROCESS BY ASSUMPTION: the buckets below live in a per-process `Map`,
 * so each process counts independently instead of sharing one ceiling.
 * Local/open-core is one process by construction. Scaling out therefore
 * requires moving these buckets to a shared store first.
 */
export function rateLimiter({ maxRequests, windowMs }: RateLimiterOptions) {
  const buckets = new Map<string, BucketEntry>();

  // Periodically clean up expired buckets to prevent unbounded memory growth
  const cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of buckets) {
        if (now - entry.windowStart >= windowMs) {
          buckets.delete(key);
        }
      }
    },
    Math.max(windowMs, 60_000),
  );

  // Allow the process to exit even if this interval is active
  if (cleanupInterval.unref) cleanupInterval.unref();

  return function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction): void {
    // E2E opt-out — but only in open-core. In cloud mode the flag is ignored so
    // the multi-tenant deployment is never silently un-rate-limited. An e2e run
    // unlocks the vault repeatedly against one shared local server, which would
    // otherwise trip this guard (HTTP 429), so the e2e server sets
    // RATE_LIMIT_DISABLED=1 to opt out.
    if (isRateLimitDisabled() && !isCloudMode()) {
      next();
      return;
    }

    const key = rateLimitKey(req);
    const now = Date.now();

    const existing = buckets.get(key);

    if (!existing || now - existing.windowStart >= windowMs) {
      // Start a new window
      buckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    existing.count += 1;

    if (existing.count > maxRequests) {
      const retryAfterSecs = Math.ceil((windowMs - (now - existing.windowStart)) / 1000);
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSecs)));
      res.status(429).json({ error: 'too-many-requests' });
      return;
    }

    next();
  };
}
