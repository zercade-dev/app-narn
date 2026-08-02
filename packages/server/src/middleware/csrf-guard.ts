import type { Request, Response, NextFunction } from 'express';
import { isLoopbackHostname } from './loopback.js';
import { isCloudMode } from '../identity/registry.js';
import { logger } from '../modules/M15-console-logger.js';
import { getCsrfTrustedOrigin } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function extractHostname(header: string): string | null {
  try {
    return new URL(header).hostname;
  } catch {
    return null;
  }
}

/** The scheme+host+port of an Origin/Referer header value, or null if unparseable. */
function extractOrigin(header: string): string | null {
  try {
    return new URL(header).origin;
  } catch {
    return null;
  }
}

/**
 * The configured trusted parent origins. `CSRF_TRUSTED_ORIGIN` is a
 * comma-separated list (a single value is the one-element case) of exact origins
 * (scheme+host+port, e.g. `https://app.example`), each entry trimmed — mirroring
 * hostGuard's `ALLOWED_HOST` parsing. Empty/unset → an empty set, so the guard
 * stays in its default loopback-only mode.
 */
function trustedOrigins(): Set<string> {
  const raw = getCsrfTrustedOrigin();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o !== ''),
  );
}

/**
 * CSRF guard middleware.
 *
 * For all non-GET/HEAD/OPTIONS requests, inspects the Origin or Referer
 * header:
 * - Missing header → 403 Forbidden (a client we can't attribute)
 * - Origin/Referer from localhost / 127.0.0.1 / ::1 → allowed (LOCAL MODE ONLY)
 * - Everything else (including present-but-unparseable) → 403 Forbidden
 *
 * NB: in local mode this deliberately accepts ANY loopback origin (any port),
 * not just the configured frontend origin. A malicious page on a public site
 * cannot forge a loopback Origin (the browser sets it to the page's real
 * origin), so the real cross-site threat is still blocked; pinning to an exact
 * port instead would break legitimate local tooling — including the e2e
 * harness's request client and its parallel per-worker ports — for
 * negligible additional safety on a single-user localhost app. (See the SSE
 * endpoint for its own connect-time Origin check, since EventSource is a simple
 * GET this guard exempts.)
 *
 * CLOUD/PUBLIC MODE (`CSRF_TRUSTED_ORIGIN` set): when the app runs inside
 * a cloud composition root on a public multi-tenant host, the blanket
 * loopback-trust is too loose (a same-machine process on a shared/multi-tenant
 * host would be implicitly trusted). So the moment `CSRF_TRUSTED_ORIGIN` is
 * configured, the loopback-trust branch is DISABLED and ONLY the configured
 * origin(s) are allowed (a comma-separated list — mirrors hostGuard's
 * `ALLOWED_HOST`). In open-core, absent the env var, behavior is byte-identical
 * to before (loopback-only).
 *
 * Fail-closed: in CLOUD mode with `CSRF_TRUSTED_ORIGIN` UNSET, falling back to
 * loopback-trust would be fail-open — loopback is not a meaningful trust
 * boundary on a multi-tenant host. So in cloud mode an unset trusted-origin is
 * treated as "no trusted cross-origin": loopback is NOT auto-trusted, so a
 * non-same-origin unsafe-method request is rejected (a prominent one-time
 * warning is logged). Open-core/local behavior is unchanged.
 */
let warnedUnsetTrustedOriginInCloud = false;

export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  // State-changing requests must declare their origin. Browsers always send
  // Origin on cross-origin unsafe-method fetches; absence means a client we
  // can't attribute, so refuse rather than allow by default.
  if (!origin && !referer) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const headerValue = origin ?? referer!;

  // Opt-in: when one or more trusted parent origins are configured the app is in
  // cloud/public mode, so loopback is NO LONGER auto-trusted — only an exact
  // match against the configured origin(s) passes. Compare scheme+host+port so a
  // Referer's path doesn't matter.
  const trusted = trustedOrigins();
  if (trusted.size > 0) {
    const reqOrigin = extractOrigin(headerValue);
    if (reqOrigin !== null && trusted.has(reqOrigin)) {
      next();
      return;
    }
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // Fail-closed: cloud mode with no configured trusted origin must NOT fall
  // back to loopback-trust (loopback is not a trust boundary on a multi-tenant
  // host). Treat it as "no trusted cross-origin" and reject any non-same-origin
  // unsafe-method request. Warn once so the misconfiguration is visible (the
  // deploy should set CSRF_TRUSTED_ORIGIN to its parent origin).
  if (isCloudMode()) {
    if (!warnedUnsetTrustedOriginInCloud) {
      warnedUnsetTrustedOriginInCloud = true;
      logger.warn('csrf:cloud-mode-unset-trusted-origin', {
        message:
          'Cloud mode is active but CSRF_TRUSTED_ORIGIN is unset; failing CLOSED ' +
          '(loopback no longer auto-trusted). Set CSRF_TRUSTED_ORIGIN to the ' +
          'parent origin(s) to allow cross-origin state-changing requests.',
      });
    }
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // Default (local) mode: any loopback origin is trusted. A present-but-
  // unparseable Origin/Referer is rejected too.
  const hostname = extractHostname(headerValue);
  if (hostname !== null && isLoopbackHostname(hostname)) {
    next();
    return;
  }

  res.status(403).json({ error: 'forbidden' });
}
