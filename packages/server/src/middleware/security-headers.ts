import type { Request, Response, NextFunction, Application } from 'express';
import helmet from 'helmet';
import { isCloudMode } from '../identity/registry.js';
import { logger } from '../modules/M15-console-logger.js';
import { isHstsFlagEnabled, getCspConnectSrc } from '../config/env.js';

/**
 * Whether HSTS is enabled. HSTS is OFF by default in open-core (plain-HTTP
 * localhost — an HSTS header there would be wrong) and opt-in via
 * `ENABLE_HSTS=1`. In CLOUD mode it defaults ON (the cloud edge is
 * TLS-fronted), so an unset `ENABLE_HSTS` still emits HSTS — fail-closed
 * by omission. The startup transport-hardening check uses this predicate to
 * WARN/decide; single source of truth shared with the helmet config below
 * so the predicate and the actual header can't drift.
 */
export function isHstsEnabled(): boolean {
  return isHstsFlagEnabled() || isCloudMode();
}

/**
 * Validates one `CSP_CONNECT_SRC` source-expression entry before it is
 * appended to the CSP `connect-src` directive verbatim. Rejects a bare `*`
 * wildcard (would allow connections to any host) and anything that isn't a
 * well-formed origin (`https://host[:port]`) or scheme source (`https:`).
 * Returns true for an acceptable entry. Keyword sources like `'self'` are not
 * accepted here ('self' is already present); this only vets externally-supplied
 * cross-origin endpoints.
 */
export function isValidConnectSrc(entry: string): boolean {
  const value = entry.trim();
  if (value === '') return false;
  // Never allow a wildcard host (bare `*` or scheme-relative `//*`, host `*`).
  if (value === '*' || value.includes('*')) return false;
  // Scheme source, e.g. `https:` (a bare scheme followed by a single colon).
  if (/^[a-z][a-z0-9+.-]*:$/i.test(value)) return true;
  // Otherwise require a parseable absolute origin whose own normalized origin
  // round-trips (rejects paths, query strings, credentials, and junk).
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    return url.origin === value && url.origin !== 'null';
  } catch {
    return false;
  }
}

/**
 * The validated, space-joined `CSP_CONNECT_SRC` sources, or '' when none
 * are configured/valid. Each bad entry is dropped (warned once) rather than
 * emitted into the CSP, so a misconfigured value can never widen connect-src to
 * an unsafe wildcard.
 */
let warnedBadConnectSrc = false;
function validatedConnectSrc(): string {
  const raw = getCspConnectSrc();
  if (!raw) return '';
  const entries = raw
    .split(/[\s,]+/)
    .map((e) => e.trim())
    .filter((e) => e !== '');
  const valid: string[] = [];
  const dropped: string[] = [];
  for (const e of entries) {
    if (isValidConnectSrc(e)) valid.push(e);
    else dropped.push(e);
  }
  if (dropped.length > 0 && !warnedBadConnectSrc) {
    warnedBadConnectSrc = true;
    logger.warn('csp:invalid-connect-src-dropped', {
      message:
        'Dropping unsafe/malformed CSP_CONNECT_SRC entries (a bare `*` wildcard ' +
        'or non-origin value) rather than emitting an unsafe connect-src.',
      dropped,
    });
  }
  return valid.join(' ');
}

function generateNonce(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Throw error instead of using insecure fallback
    throw new Error('Crypto not available - cannot generate secure nonce');
  }
  return Buffer.from(array).toString('base64');
}

export function setupSecurityHeaders(app: Application): void {
  // Nonce storage middleware - generates a per-request nonce on res.locals
  // (same pattern as the session middleware).
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.locals.nonce = generateNonce();
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false, // We handle CSP separately
      // COEP deliberately disabled: plain-HTTP localhost app. HSTS is
      // OFF by default for the same reason and opt-in via ENABLE_HSTS=1 when
      // served behind the proxy's TLS; it defaults ON in cloud mode
      // (the cloud edge is TLS-fronted) via isHstsEnabled().
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      dnsPrefetchControl: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: isHstsEnabled() ? { maxAge: 31536000, includeSubDomains: true } : false,
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // Add Permissions-Policy to restrict sensitive browser features
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=(), ' +
        'usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ' +
        'sync-xhr=()',
    );
    next();
  });

  // Set CSP with nonce on every response
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');

    applyCspHeaders(res);

    next();
  });
}

function applyCspHeaders(res: Response): string {
  const nonce =
    typeof res.locals.nonce === 'string' && res.locals.nonce ? res.locals.nonce : generateNonce();
  const cspHeader =
    `default-src 'self'; ` +
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' data:; ` +
    `font-src 'self' data:; ` +
    `connect-src ${["'self'", validatedConnectSrc()].filter(Boolean).join(' ')}; ` +
    `frame-ancestors 'none'; ` +
    `base-uri 'self'; ` +
    `form-action 'self'; ` +
    `object-src 'none'; ` +
    `media-src 'self'; ` +
    `worker-src 'self' blob:; ` +
    `frame-src 'none'; ` +
    `manifest-src 'self'; ` +
    `child-src 'self' blob:; ` +
    `report-uri /api/csp-violation`;

  res.setHeader('Content-Security-Policy', cspHeader);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  return nonce;
}

export function setCSPWithNonce(_req: Request, res: Response): string {
  return applyCspHeaders(res);
}
