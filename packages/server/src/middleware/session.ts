import type { Request, Response, NextFunction } from 'express';
import type { ResolvedIdentity } from '../identity/types.js';
import { getIdentityProvider } from '../identity/registry.js';
import { runWithTenant } from '../storage/pg/tenant-context.js';

/**
 * Resolves the request's identity via the registered IdentityProvider and
 * stores it on `res.locals.identity`. Replaces the former cookie-parsing
 * sessionMiddleware: the local provider still parses the `translator_session`
 * cookie, so local behavior is unchanged, but a cloud composition root can
 * inject a cloud provider. Resolution is async; a rejection is forwarded to
 * the error chain.
 *
 * This is also the single HTTP seam that establishes the ambient tenant
 * context for the whole downstream pipeline: once identity resolves, the rest
 * of the request (csrfGuard, body parsing, every router and its async-handler
 * continuations) runs inside `runWithTenant`, so the storage layer's RLS
 * tenant is set without each route threading it manually. The wrap must sit
 * INSIDE `.then` (after identity is set) — identity is async-resolved,
 * so wrapping before would capture an undefined tenant. When identity is
 * undefined we call `next()` plainly and establish no context; downstream
 * `requireUnlockedVault`/`requireTenant` then fail closed.
 */
export function identityMiddleware(req: Request, res: Response, next: NextFunction): void {
  getIdentityProvider()
    .resolve(req, res)
    .then((identity) => {
      res.locals.identity = identity;
      if (identity) {
        runWithTenant(
          { userId: identity.userId, sessionId: identity.sessionId, deviceId: identity.deviceId },
          () => next(),
        );
      } else {
        next();
      }
    })
    .catch(next);
}

/** The full resolved identity for this request, or undefined. */
export function getIdentity(res: Response): ResolvedIdentity | undefined {
  return res.locals.identity as ResolvedIdentity | undefined;
}

/**
 * The session id for this request — the opaque token M16 keys credentials by.
 * Sourced from the resolved identity (no longer the raw cookie). Same return
 * contract as before: a non-empty string, else undefined.
 */
export function getSessionId(res: Response): string | undefined {
  const sid = getIdentity(res)?.sessionId;
  return typeof sid === 'string' && sid !== '' ? sid : undefined;
}

/** The user id for this request (forward-compatible authz seam), or undefined. */
export function getUserId(res: Response): string | undefined {
  return getIdentity(res)?.userId;
}
