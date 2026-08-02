import type { Request } from 'express';

/**
 * Registry-free cookie-parse primitives.
 *
 * Split out from `session-cookie.ts` so that `local-identity-provider.ts` (which
 * the registry constructs eagerly at module load) can read the session cookie
 * WITHOUT importing `registry.ts`. `session-cookie.ts` now imports `registry`
 * (for the `shouldSetSecureCookie()` cloud check); keeping these two helpers
 * here breaks the `local-identity-provider → session-cookie → registry →
 * (new LocalIdentityProvider) → local-identity-provider` load-time cycle that
 * would otherwise leave `LocalIdentityProvider` in its TDZ. `session-cookie.ts`
 * re-exports both for backward compatibility.
 */

/** The single source of truth for the session cookie name. */
export const SESSION_COOKIE_NAME = 'translator_session';

/**
 * Parses the session cookie out of `req.headers.cookie` (manual scan, no
 * cookie-parser dependency). Returns the url-decoded value, or undefined.
 * Behavior identical to the former sessionMiddleware parse loop.
 *
 * A malformed value (e.g. a dangling `%`) makes `decodeURIComponent` throw
 * `URIError` — caught here and treated as "no session" so the request falls
 * through to the normal unauthenticated (401) path and the bad cookie can be
 * cleared, instead of every request 500ing on a wedged cookie.
 */
export function parseSessionCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const raw of cookieHeader.split(';')) {
    const idx = raw.indexOf('=');
    if (idx < 0) continue;
    const name = raw.slice(0, idx).trim();
    if (name === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(raw.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
