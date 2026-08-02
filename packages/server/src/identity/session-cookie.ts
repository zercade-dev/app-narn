import type { Request } from 'express';
import { CREDENTIAL_TTL_MS } from '../modules/M16-credential-store.js';
import { isCloudMode } from './registry.js';
import { SESSION_COOKIE_NAME, parseSessionCookie } from './session-cookie-parse.js';
import { isNodeEnvProduction, getTrustProxyRaw } from '../config/env.js';

// Re-exported for backward compatibility — the registry-free parse primitives
// live in ./session-cookie-parse.js (see that module for the cycle rationale).
export { SESSION_COOKIE_NAME, parseSessionCookie };

/**
 * Whether the session cookie's `Secure` attribute should be set based on
 * startup-knowable signals — true when `NODE_ENV==='production'` OR cloud mode
 * is active (`isCloudMode()`). A cloud deploy is multi-tenant + internet-live
 * even when `NODE_ENV` is unset/development, so keying on `NODE_ENV` alone would
 * silently ship the credential-session cookie WITHOUT `Secure` (and without the
 * `Partitioned`/CHIPS flag, which requires Secure). Open-core/local stays OFF
 * by default (plain-HTTP localhost, where a `Secure` cookie would never be
 * stored). The per-request builders OR this with `req.secure` so a proxied-HTTPS
 * request still gets `Secure` even outside these two signals.
 */
export function shouldSetSecureCookie(): boolean {
  return isNodeEnvProduction() || isCloudMode();
}

/**
 * Builds the Set-Cookie header for an unlocked session. Verbatim semantics
 * from the former routes/vault.ts:32-45: HttpOnly; SameSite=Strict; Path=/;
 * Max-Age mirrors the credential TTL; Secure + Partitioned (CHIPS) only when
 * the connection is secure (Partitioned requires Secure).
 */
export function sessionCookie(req: Request, sid: string): string {
  const isSecure = shouldSetSecureCookie() || req.secure;
  const secure = isSecure ? '; Secure' : '';
  const partitioned = isSecure ? '; Partitioned' : '';
  const maxAge = Math.floor(CREDENTIAL_TTL_MS / 1000);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sid)}; HttpOnly; SameSite=Strict${partitioned}; Path=/; Max-Age=${maxAge}${secure}`;
}

/** Builds the Set-Cookie header that clears the session (Max-Age=0). */
export function clearSessionCookie(req: Request): string {
  const secure = shouldSetSecureCookie() || req.secure ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

/**
 * Whether the session cookie will be flagged `Secure` based on the
 * startup-knowable env signals. The per-request decision (`sessionCookie`)
 * also honors `req.secure`, but `req.secure` is only ever true when EITHER
 * `NODE_ENV==='production'` OR a `TRUST_PROXY` setting lets Express derive
 * the scheme from the TLS terminator's `X-Forwarded-Proto`. So at boot, those
 * two env signals are exactly the conditions under which the cookie can be
 * Secure for a real (proxied-HTTPS) request — letting the startup WARN flag
 * a public deployment whose cookies would silently ship without `Secure`.
 */
export function sessionCookieWouldBeSecure(): boolean {
  return isNodeEnvProduction() || !!getTrustProxyRaw()?.trim();
}
