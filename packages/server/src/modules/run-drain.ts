/**
 * Drain a tenant's in-flight background runs before `teardownTenant`.
 *
 * During cloud account deletion, `teardownTenant` deletes `project_members` (and
 * the rest of the tenant's rows) in an atomic-per-pass convergence loop. A
 * background run that commits a `runs`/`run_sidecars` write in the window AFTER a
 * sweep pass deletes `project_members` becomes RLS-invisible → orphaned tenant
 * data survives the erase. Cancelling a run only SIGNALS it; the detached task
 * already in flight still writes on its `finally`. So this aggregator asks every
 * engine to cancel each project's runs AND await their REAL settlement (the
 * per-run settled deferred) before deletion proceeds.
 *
 * Hang-safety dominates: account deletion must NEVER block. The whole drain is
 * bounded by `timeoutMs`; on timeout it resolves `{ timedOut: true }` and the
 * caller proceeds — `teardownTenant`'s convergence loop is the backstop for any
 * straggler write. It never throws.
 */
import { backgroundRunEngines } from './run-engines.js';

/** Minimal logger surface (the app logger and `console` both satisfy it). */
export interface DrainLogger {
  warn(message: string, metadata?: Record<string, unknown>): void;
}

/** Default overall drain budget — generous enough for a normal settle, short
 * enough that account deletion never noticeably stalls. */
const DEFAULT_DRAIN_TIMEOUT_MS = 15_000;

/**
 * Cancel and drain every background run for `projectIds` across all engine
 * singletons, bounded by `opts.timeoutMs` (default 15s). Returns how many runs
 * were cancelled and whether the drain timed out. Never throws.
 */
export async function drainProjectRuns(
  projectIds: string[],
  opts?: { timeoutMs?: number; logger?: DrainLogger },
): Promise<{ drained: number; timedOut: boolean }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS;
  const logger = opts?.logger;
  if (projectIds.length === 0) return { drained: 0, timedOut: false };

  // Each (engine × project) cancel is already internally bounded by timeoutMs and
  // never throws, so Promise.all settles within ~timeoutMs. An overall race is a
  // belt-and-braces guarantee that a pathological engine can't extend the budget.
  const perEngine = backgroundRunEngines.flatMap((engine) =>
    projectIds.map(async (projectId) => {
      try {
        return await engine.cancelAllForProject(projectId, { timeoutMs });
      } catch {
        // Defensive: cancelAllForProject is contracted not to throw, but a drain
        // failure must never abort account deletion.
        return { cancelled: [] as string[], timedOut: true };
      }
    }),
  );

  const settleAll = Promise.all(perEngine);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const overall = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs + 1_000);
  });

  let raced: Awaited<typeof settleAll> | 'timeout';
  try {
    raced = await Promise.race([settleAll, overall]);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (raced === 'timeout') {
    logger?.warn('run-drain:overall-timeout', { projects: projectIds.length, timeoutMs });
    return { drained: 0, timedOut: true };
  }

  const drained = raced.reduce((sum, r) => sum + r.cancelled.length, 0);
  const timedOut = raced.some((r) => r.timedOut);
  if (timedOut) {
    logger?.warn('run-drain:timeout', { projects: projectIds.length, drained, timeoutMs });
  }
  return { drained, timedOut };
}
