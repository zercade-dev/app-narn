/**
 * The vault-unlock nudge: one forced quota-resume pass under a freshly
 * unlocked session.
 *
 * Sessions do not survive a restart, and Freeway bucket visibility is
 * session-scoped (`getMetadata(moduleId, sessionId)` gates `credentialed`),
 * so the sweep's own 60s timer can never re-credential a run adopted from the
 * store: it would stamp `skipReason` forever and still need a manual resume.
 * The first successful unlock is the natural recovery point.
 *
 * Deliberately a standalone module, not inline in a route: BOTH unlock paths
 * need it — the open-core `/api/vault/unlock` route here, and a cloud
 * composition root's own `/auth/vault-unlock` handler, which reaches this seam
 * through this package's root export via a LAZY import (the same shape
 * `drainProjectRuns` is consumed with). Callers import this module lazily too,
 * so merely mounting a route never pulls the engine graph (and its
 * process-wide singleton) into the importing module's graph.
 */
import { toErrorMessage } from '@zercade-dev/narn-shared';
import { translationEngine } from './M9-translation-engine.js';
import { logger } from './M15-console-logger.js';

/**
 * Fire-and-forget one forced sweep pass with `sessionId` standing in for the
 * sessions the restart lost. Never throws and never returns a promise the
 * caller must handle: an unlock must not fail, or wait, because a background
 * resume did. The sweep applies the fallback only to runs of the CALLING
 * tenant, so this must be called inside the unlocking request's tenant
 * context (both call sites are).
 */
export function nudgeQuotaResumes(sessionId: string): void {
  void translationEngine
    .sweepQuotaResumes(Date.now(), { fallbackSessionId: sessionId, force: true })
    .catch((err: unknown) => {
      logger.warn('translation:quota-resume-nudge-failed', { error: toErrorMessage(err) });
    });
}
