import type { Request, Response } from 'express';
import type { IdentityProvider, ResolvedIdentity } from './types.js';
import { parseSessionCookie } from './session-cookie-parse.js';

/** The single-user id the local (self-hosted) app always runs as. */
export const LOCAL_USER_ID = 'local';

/**
 * Default Identity adapter for the public app. The single-user self-hosted app is
 * ALWAYS the `'local'` tenant, so identity must NOT depend on the vault session:
 * the tenant is resolved unconditionally, and the `translator_session` cookie's id
 * (when present) rides along for the M16 BYOK credential lookup.
 *
 * Returning `undefined` when no session cookie was present (the old behavior) left
 * the request with no ambient tenant — so once the app went Postgres-everywhere, any
 * tenant-scoped read (RLS via `requireTenant()`) threw `NoTenantContextError` → 500
 * once the cookie was gone. That happens after a vault LOCK (which clears the
 * cookie): e.g. `GET /runs` 500'd instead of returning the list. Always resolving
 * `'local'` keeps reads working while the vault is locked; the vault gate
 * (`requireUnlockedVault` → `isUnlocked(sessionId)`) still 423s the credential-gated
 * LLM routes because `sessionId` is `undefined` when locked.
 */
export class LocalIdentityProvider implements IdentityProvider {
  async resolve(req: Request, _res: Response): Promise<ResolvedIdentity | undefined> {
    const sessionId = parseSessionCookie(req);
    return { userId: LOCAL_USER_ID, sessionId };
  }
}
