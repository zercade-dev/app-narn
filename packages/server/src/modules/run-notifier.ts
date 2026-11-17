import {
  RunStatusCode,
  type FailureCode,
  type NotificationSeverity,
  type RunNotificationData,
  type RunStatus,
} from '@zercade-dev/narn-shared';
import type { Queryable } from '../storage/pg/pool.js';
import { insertNotificationForUser } from '../storage/pg-notification-store.js';
import { logger } from './M15-console-logger.js';

/**
 * Run notifications: one entry when a run starts and one when it ends,
 * addressed to the person who started it. The run store calls
 * {@link notifyRunTransition} after every status write; this module decides
 * whether that write was a start or an end worth telling someone about.
 */

export interface RunNotificationDecision {
  kind: 'run-started' | 'run-finished' | 'run-finished-with-problems' | 'run-failed';
  severity: NotificationSeverity;
  bornRead: boolean;
  data: RunNotificationData;
}

const MAX_CAUSES = 3;

function isEnded(status: RunStatusCode | undefined): boolean {
  return (
    status === RunStatusCode.Completed ||
    status === RunStatusCode.Failed ||
    status === RunStatusCode.Cancelled
  );
}

/**
 * Which notification (if any) a write of `run` produces, given the status the
 * stored row had before (`undefined` for a new row).
 *
 * - Chat runs never notify.
 * - Started: the run becomes Running from anything but Running/Paused
 *   (new, pending, queued, or an ended run being retried), whatever its
 *   total (some runs learn their total after starting). Born read.
 * - Ended (only on the first write of an ended status):
 *   - Completed with nothing in scope (`total` and `failed` both 0): nothing.
 *   - Completed with no failed strings: finished.
 *   - Completed with some failed strings: finished with problems (warning).
 *   - Completed with every string failed, Failed, or Cancelled by the app
 *     (`stopCause` set): failed (critical).
 *   - Cancelled by the person (no `stopCause`): nothing.
 */
export function decideRunNotification(
  prev: RunStatusCode | undefined,
  run: RunStatus,
): RunNotificationDecision | null {
  if (run.kind === 'chat') return null;
  const make = (
    kind: RunNotificationDecision['kind'],
    severity: NotificationSeverity,
  ): RunNotificationDecision => ({
    kind,
    severity,
    bornRead: kind === 'run-started',
    data: notificationData(run),
  });

  if (run.status === RunStatusCode.Running) {
    const wasRunning = prev === RunStatusCode.Running || prev === RunStatusCode.Paused;
    return wasRunning ? null : make('run-started', 'info');
  }
  if (!isEnded(run.status) || isEnded(prev)) return null;

  switch (run.status) {
    case RunStatusCode.Completed:
      if (run.total === 0 && run.failed === 0) return null;
      if (run.failed === 0) return make('run-finished', 'info');
      if (run.failed < run.total) return make('run-finished-with-problems', 'warning');
      return make('run-failed', 'critical');
    case RunStatusCode.Failed:
      return make('run-failed', 'critical');
    default: // Cancelled
      return run.stopCause ? make('run-failed', 'critical') : null;
  }
}

/** Only ids, counts, language codes and failure codes — never provider text. */
function notificationData(run: RunStatus): RunNotificationData {
  return {
    runId: run.runId,
    projectId: run.projectId,
    runKind: run.kind ?? 'translate',
    total: run.total,
    completed: run.completed,
    failed: run.failed,
    targetLanguages: [...(run.request?.targetLanguages ?? [])],
    causes: aggregateCauses(run),
  };
}

/**
 * Failure codes counted across the run's errors (a missing code counts as
 * `unknown`), most common first, at most three. When the app stopped the run,
 * that cause leads.
 */
function aggregateCauses(run: RunStatus): RunNotificationData['causes'] {
  const counts = new Map<FailureCode, number>();
  for (const err of run.errors ?? []) {
    const code = err.code ?? 'unknown';
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const causes = [...counts]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);
  if (run.stopCause) {
    const stop = run.stopCause;
    const count = counts.get(stop) ?? 1;
    return [{ code: stop, count }, ...causes.filter((c) => c.code !== stop)].slice(0, MAX_CAUSES);
  }
  return causes.slice(0, MAX_CAUSES);
}

/**
 * Writes the notification {@link decideRunNotification} picks for this write,
 * for the run's starter. Never rejects: a failure is logged and dropped, so a
 * notification can never fail or slow a run's status write. `pool` may be a
 * getter, resolved inside the guard so a getter that throws is caught too.
 */
export async function notifyRunTransition(
  pool: Queryable | (() => Queryable),
  prev: RunStatusCode | undefined,
  run: RunStatus,
): Promise<void> {
  try {
    if (!run.createdBy) return;
    const decision = decideRunNotification(prev, run);
    if (!decision) return;
    const db = typeof pool === 'function' ? pool() : pool;
    await insertNotificationForUser(db, run.createdBy, decision);
  } catch (err) {
    // The error name only: a driver message can quote row data.
    logger.warn('notifications:run-write-failed', {
      error: err instanceof Error ? err.name : typeof err,
    });
  }
}
