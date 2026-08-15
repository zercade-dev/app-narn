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
 * Unlike `manual-edit-sweep.ts` (which has no periodic hook to attach to and
 * is instead triggered lazily from a GET route), this DOES have one: M9
 * `TranslationEngine`'s process-wide quota-resume tick
 * (`M9-translation-engine.ts`, `quotaSweepTimer`) runs unconditionally, every
 * 60s, for the life of the process — independent of any route ever being
 * called. Minute cells accrue from Freeway dispatches that don't require a
 * human to open the status UI (automation-driven runs included), so a
 * route-triggered sweep would leave those tenants' rows unbounded; the
 * existing tick is the only invocation guaranteed to run regardless. This
 * function is called from that tick's callback, not from a route.
 *
 * The throttle idiom mirrors `manual-edit-sweep.ts` / `services/audit-logger.ts`'s
 * `maybePurgeDisk()`: a module-level "last run" timestamp gates a floor
 * interval so a fast, frequent caller (the tick fires every 60s) doesn't
 * sweep on every call — at most once per window, best-effort, never
 * throwing into the caller.
 */
import { getPool } from '../storage/pg/pool.js';
import { logger } from './M15-console-logger.js';

// Minimum gap between sweep attempts (mirrors manual-edit-sweep.ts's own SWEEP_INTERVAL_MS).
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h
let lastSweepAt = 0;

/**
 * Run the sweep if the throttle window has elapsed; otherwise a no-op.
 * Returns a Promise so a test can await a forced sweep deterministically; the
 * quota-sweep tick that calls this does so WITHOUT awaiting (`void
 * maybeSweepExpiredFreewayWindows().catch(...)`) so a slow or failing sweep
 * never blocks the tick's own quota-resume work. Never throws — including
 * when the DB pool itself is unavailable/unconfigured (`getPool()` throws
 * synchronously in that case) — since a retention sweep must never break the
 * caller that triggers it.
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
