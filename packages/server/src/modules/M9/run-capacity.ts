import { type RunStatus, RunStatusCode } from '@zercade-dev/narn-shared';
import type { RunStore } from '../../storage/types.js';
import { TooManyRunsError } from '../../types/errors.js';
import { getMaxConcurrentRunsPerTenant } from '../../config/env.js';

/**
 * Process-start timestamp, captured once at module load. Any run whose
 * `startedAt` predates this belongs to a PRIOR process generation — a run left
 * `Running`/`Paused`/`Pending` by a crash or a mid-run redeploy, whose
 * in-memory controller no longer exists and which can therefore never finish or
 * be dequeued. {@link sweepOrphanedRuns} uses it to reconcile such rows.
 */
export const PROCESS_START_MS = Date.now();

const TERMINAL_STATUSES: ReadonlySet<RunStatusCode> = new Set([
  RunStatusCode.Completed,
  RunStatusCode.Failed,
  RunStatusCode.Cancelled,
]);

/**
 * Boot reconciliation for crash/redeploy-orphaned runs. Deploys are
 * frequent (every push publishes an image), so a redeploy mid-run leaves rows
 * stuck non-terminal forever, consuming `MAX_CONCURRENT_RUNS_PER_TENANT` until
 * manually cancelled. This flips a project's non-terminal, non-`queued` runs
 * whose `startedAt` predates process start to `Failed`.
 *
 * Scope note: RunStore exposes only a per-project `listRuns` and a tenant-scoped
 * COUNT (`countActiveRuns`) — there is no all-tenants/all-projects run listing to
 * drive a single global boot sweep, and adding one would touch the storage layer
 * outside this change's remit. So the sweep is invoked lazily, once per project,
 * the first time a tenant touches the engine for that project (under that
 * request's RLS-scoped store — never bypassing tenancy). `queued` runs are left
 * untouched (they carry no in-flight work to reconcile and the queue may still
 * legitimately dequeue them). Idempotent and safe to run repeatedly: a second
 * pass finds only terminal or current-process runs and changes nothing. Runs
 * started by the CURRENT process (`startedAt >= PROCESS_START_MS`) are never
 * touched, so an active run is never dropped.
 *
 * @returns the number of runs flipped to `Failed`.
 */
export async function sweepOrphanedRuns(
  runStore: Pick<RunStore, 'listRuns' | 'updateRun'>,
  projectId: string,
  cutoffMs: number = PROCESS_START_MS,
): Promise<number> {
  const runs = await runStore.listRuns(projectId);
  let swept = 0;
  for (const run of runs) {
    if (TERMINAL_STATUSES.has(run.status)) continue;
    if (run.status === RunStatusCode.Queued) continue;
    if (typeof run.startedAt !== 'number' || run.startedAt >= cutoffMs) continue;
    const failed: RunStatus = { ...run, status: RunStatusCode.Failed, finishedAt: Date.now() };
    delete failed.queuePosition;
    await runStore.updateRun(projectId, failed);
    swept++;
  }
  return swept;
}

/**
 * Per-tenant run-concurrency cap. Call at the very top of each engine's
 * `enqueue`, before the run is created. When `MAX_CONCURRENT_RUNS_PER_TENANT`
 * is a positive integer, count the current tenant's non-terminal runs
 * (RLS-scoped via the RunStore) and throw `TooManyRunsError` (→ 429) if
 * already at the cap. Unset / non-finite / ≤0 ⇒ unbounded: the count is never
 * issued, so single-user/local is unchanged.
 *
 * Leak-free by construction: there is no in-process permit — a run's natural
 * terminal flip in the store lowers the next count, so the "release" cannot be
 * missed on any of M9's terminal/finally paths.
 */
export async function assertRunCapacity(
  runStore: Pick<RunStore, 'countActiveRuns'>,
): Promise<void> {
  const raw = getMaxConcurrentRunsPerTenant();
  if (!raw) return;
  const cap = Number(raw);
  if (!Number.isFinite(cap) || cap <= 0) return;
  const active = await runStore.countActiveRuns();
  if (active >= cap) throw new TooManyRunsError();
}
