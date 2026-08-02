/**
 * Throttled retention sweep for `manual_edits`.
 *
 * Deletes rows past `expires_at` via the SECURITY DEFINER
 * `narn_sweep_expired_manual_edits()` (migration 0026) — that function
 * already bypasses `manual_edits`' per-tenant RLS and deletes across every
 * tenant in one call (a system/cron-shaped operation, not a per-tenant one),
 * so this runs on the raw pool with no `TenantDb`/tenant context: no GUC is
 * required (`app_user` was granted EXECUTE on the function directly), and none
 * would even scope the delete since the DEFINER ignores the caller's role.
 *
 * There is no existing app-wide periodic-maintenance hook to attach to, so this
 * is triggered lazily from the manual-edits GET route instead of adding a new
 * always-on timer.
 *
 * The throttle idiom mirrors `services/audit-logger.ts`'s `maybePurgeDisk()`:
 * a module-level "last run" timestamp gates a floor interval so a busy read
 * path (the GET route calls this on every hit) doesn't sweep on every
 * request — at most once per window, best-effort, never throwing into the
 * caller.
 */
import { getPool } from '../storage/pg/pool.js';
import { logger } from './M15-console-logger.js';

// Minimum gap between sweep attempts (mirrors audit-logger's PURGE_INTERVAL_MS).
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
let lastSweepAt = 0;

/**
 * Run the sweep if the throttle window has elapsed; otherwise a no-op.
 * Returns a Promise so a test can await a forced sweep deterministically; the
 * route that triggers this lazily calls it WITHOUT awaiting (`void
 * maybeSweepExpiredManualEdits()`) so the sweep never delays the response.
 * Never throws — including when the DB pool itself is unavailable/unconfigured
 * (`getPool()` throws synchronously in that case), since a retention sweep
 * must never break the read path that triggers it.
 */
export async function maybeSweepExpiredManualEdits(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) {
    return;
  }
  lastSweepAt = now;
  try {
    await getPool().query('select narn_sweep_expired_manual_edits()');
  } catch (err) {
    logger.warn('manual-edit-sweep: sweep failed, will retry next window', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Test seam — resets the throttle so a test can force the next call through. */
export function __resetManualEditSweepThrottleForTests(): void {
  lastSweepAt = 0;
}
