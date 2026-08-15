/**
 * Throttled retention sweep for `freeway_usage`'s rpm/tpm minute cells.
 *
 * Deletes rows past the retention cutoff via the SECURITY DEFINER
 * `narn_sweep_expired_freeway_windows()` (migration 0028) — that function
 * already bypasses `freeway_usage`'s per-tenant RLS (0027) and deletes
 * across every tenant in one call (a system/cron-shaped operation, not a
 * per-tenant one), so this runs on the raw pool with no `TenantDb`/tenant
 * context: no GUC is required (`app_user` was granted EXECUTE on the
 * function directly), and none would even scope the delete since the
 * DEFINER ignores the caller's role.
 *
 * There is no existing app-wide periodic-maintenance hook to attach to, so
 * this is triggered lazily from the freeway status GET route instead of
 * adding a new always-on timer — mirrors `manual-edit-sweep.ts`'s own hook
 * into the manual-edits GET route.
 *
 * The throttle idiom mirrors `manual-edit-sweep.ts` / `services/audit-logger.ts`'s
 * `maybePurgeDisk()`: a module-level "last run" timestamp gates a floor
 * interval so a busy read path (the status route is polled by the UI
 * checklist) doesn't sweep on every request — at most once per window,
 * best-effort, never throwing into the caller.
 */
import { getPool } from '../storage/pg/pool.js';
import { logger } from './M15-console-logger.js';

// Minimum gap between sweep attempts (mirrors manual-edit-sweep.ts's own SWEEP_INTERVAL_MS).
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
let lastSweepAt = 0;

/**
 * Run the sweep if the throttle window has elapsed; otherwise a no-op.
 * Returns a Promise so a test can await a forced sweep deterministically; the
 * route that triggers this lazily calls it WITHOUT awaiting (`void
 * maybeSweepExpiredFreewayWindows()`) so the sweep never delays the response.
 * Never throws — including when the DB pool itself is unavailable/unconfigured
 * (`getPool()` throws synchronously in that case), since a retention sweep
 * must never break the read path that triggers it.
 */
export async function maybeSweepExpiredFreewayWindows(): Promise<void> {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) {
    return;
  }
  lastSweepAt = now;
  try {
    await getPool().query('select narn_sweep_expired_freeway_windows()');
  } catch (err) {
    logger.warn('freeway-minute-sweep: sweep failed, will retry next window', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Test seam — resets the throttle so a test can force the next call through. */
export function __resetFreewayMinuteSweepThrottleForTests(): void {
  lastSweepAt = 0;
}
