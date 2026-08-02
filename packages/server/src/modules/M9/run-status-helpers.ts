/**
 * Progress/failure recording shared by both background-run engines
 * ({@link ../run-engine.ts BackgroundRunEngine} and
 * {@link ../M9-translation-engine.ts TranslationEngine}). Both engines emitted
 * byte-identical progress logs + fire-and-forget run-store persistence and
 * recorded per-item failures the same way; the duplication drifted, so the two
 * bodies live here once and each engine keeps a thin delegating wrapper (so all
 * existing call sites and signatures compile unchanged).
 */
import type { RunStatus } from '@zercade-dev/narn-shared';

/** The subset of a logger these helpers need (matches the engines' `LoggerLike`). */
interface ProgressLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/** The subset of the run store these helpers need. */
interface ProgressRunStore {
  updateRun(projectId: string, status: RunStatus): Promise<void>;
}

/**
 * Log the run's progress under `${logPrefix}:progress` and fire-and-forget the
 * status persist (a failed write logs `${logPrefix}:store-update-failed` but is
 * never awaited — progress logging must not block the run loop). `logPrefix` is
 * the engine's log-key prefix (`translation`, `judge`, …), so the output is
 * byte-identical to each engine's previous inline body.
 */
export function emitRunProgress(
  deps: { logger: ProgressLogger; runStore: ProgressRunStore },
  logPrefix: string,
  status: RunStatus,
): void {
  deps.logger.info(`${logPrefix}:progress`, {
    runId: status.runId,
    completed: status.completed,
    failed: status.failed,
    total: status.total,
    status: status.status,
  });
  deps.runStore.updateRun(status.projectId, status).catch((err: Error) => {
    deps.logger.error(`${logPrefix}:store-update-failed`, {
      runId: status.runId,
      error: err.message,
    });
  });
}

/**
 * Record a per-item failure on the run status: bump `failed` and append an error
 * entry ((entry, target-language) reference + message + timestamp). Mutates
 * `status` in place, matching both engines' previous inline bodies.
 */
export function recordRunFailure(
  status: RunStatus,
  ref: { entryId: string; targetLanguage?: string },
  message: string,
): void {
  status.failed++;
  status.errors.push({
    stringId: ref.entryId,
    targetLang: ref.targetLanguage ?? '',
    message,
    timestamp: Date.now(),
  });
}
