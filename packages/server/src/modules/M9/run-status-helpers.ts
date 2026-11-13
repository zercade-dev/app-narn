/**
 * Progress/failure recording shared by both background-run engines
 * ({@link ../run-engine.ts BackgroundRunEngine} and
 * {@link ../M9-translation-engine.ts TranslationEngine}). Both engines emitted
 * byte-identical progress logs + fire-and-forget run-store persistence and
 * recorded per-item failures the same way; the duplication drifted, so the two
 * bodies live here once and each engine keeps a thin delegating wrapper (so all
 * existing call sites and signatures compile unchanged).
 */
import type { FailureCode, LanguageProgress, RunStatus } from '@zercade-dev/narn-shared';

/** The subset of a logger these helpers need (matches the engines' `LoggerLike`). */
interface ProgressLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/** The subset of the run store these helpers need. */
interface ProgressRunStore {
  updateRun(
    projectId: string,
    status: RunStatus,
    opts?: { keepPendingCorrections?: boolean },
  ): Promise<void>;
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
  writeOpts?: { keepPendingCorrections?: boolean },
): void {
  deps.logger.info(`${logPrefix}:progress`, {
    runId: status.runId,
    completed: status.completed,
    failed: status.failed,
    total: status.total,
    status: status.status,
  });
  deps.runStore.updateRun(status.projectId, status, writeOpts).catch((err: Error) => {
    deps.logger.error(`${logPrefix}:store-update-failed`, {
      runId: status.runId,
      error: err.message,
    });
  });
}

/**
 * A fresh per-language progress map for one dispatch: each language's `total`
 * is the number of pairs targeting it, every counter starts at zero.
 */
export function initLanguageProgress(
  decisions: ReadonlyArray<{ targetLanguage: string }>,
): Record<string, LanguageProgress> {
  const progress: Record<string, LanguageProgress> = {};
  for (const { targetLanguage } of decisions) {
    const entry = (progress[targetLanguage] ??= {
      total: 0,
      completed: 0,
      failed: 0,
      needsReview: 0,
    });
    entry.total++;
  }
  return progress;
}

/**
 * Bump one language's counter and report whether that settled it. Returns the
 * language's progress only on the bump that makes `completed + failed` reach
 * its `total` (so the caller announces each language exactly once per
 * attempt); null otherwise, and always null when the run keeps no per-language
 * map (every engine but translation) or the language is not in it.
 */
function bumpLanguage(
  status: RunStatus,
  targetLanguage: string | undefined,
  field: 'completed' | 'failed',
  needsReview: boolean,
): LanguageProgress | null {
  if (targetLanguage === undefined) return null;
  const progress = status.languageProgress?.[targetLanguage];
  if (!progress) return null;
  progress[field]++;
  if (needsReview) progress.needsReview++;
  return progress.completed + progress.failed === progress.total ? { ...progress } : null;
}

/** completed++ (and the language's), counting needsReview; returns the language's progress when it just settled, else null. */
export function recordRunCompleted(
  status: RunStatus,
  targetLanguage: string,
  opts?: { needsReview?: boolean },
): LanguageProgress | null {
  status.completed++;
  return bumpLanguage(status, targetLanguage, 'completed', opts?.needsReview === true);
}

/**
 * Record a per-item failure on the run status: bump `failed` and append an error
 * entry ((entry, target-language) reference + message + timestamp, plus the
 * closed-list failure `code` when the caller classified one). Mutates `status`
 * in place, matching both engines' previous inline bodies. When the run keeps
 * per-language progress the language's `failed` is bumped too, and its
 * progress is returned if that settled it (see {@link recordRunCompleted}).
 */
export function recordRunFailure(
  status: RunStatus,
  ref: { entryId: string; targetLanguage?: string },
  message: string,
  code?: FailureCode,
): LanguageProgress | null {
  status.failed++;
  status.errors.push({
    stringId: ref.entryId,
    targetLang: ref.targetLanguage ?? '',
    message,
    timestamp: Date.now(),
    ...(code !== undefined ? { code } : {}),
  });
  return bumpLanguage(status, ref.targetLanguage, 'failed', false);
}
