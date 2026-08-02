import type { Request, Response, NextFunction } from 'express';
import { credentialStore } from '../modules/M16-credential-store.js';
import { getSessionId } from './session.js';

/**
 * Express middleware that returns HTTP 423 `{ error: 'vault-locked' }` when
 * the request is associated with a session whose vault is not unlocked.
 */
export function requireUnlockedVault(req: Request, res: Response, next: NextFunction): void {
  const sid = getSessionId(res);
  if (!sid || !credentialStore.isUnlocked(sid)) {
    res.status(423).json({ error: 'vault-locked' });
    return;
  }
  // Real use of a vault-guarded route refreshes the idle TTL (sliding expiry).
  credentialStore.touch(sid);
  next();
}
