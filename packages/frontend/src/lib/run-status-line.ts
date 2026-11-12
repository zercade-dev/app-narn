import { RunStatusCode, runTypeLabel, type RunStatus } from '@zercade-dev/narn-shared';
import { RUN_TYPE_KEY, isTranslationRun } from './run-kind.js';
import { languageName } from './log-presentation/registry.js';
import type { Translate } from './log-presentation/types.js';

/**
 * The one-line live status on the console bar: what the most relevant run of
 * the current project is doing right now, or `null` when nothing is in flight.
 *
 * `t` must resolve namespaced keys (`console:` for the line, `strings:` for the
 * run-type label).
 */

const NS = 'console:statusLine.';

/** A paused run that is parked waiting on quota or a provider, not paused by the person. */
function isWaiting(run: RunStatus): boolean {
  return run.status === RunStatusCode.Paused && run.waitingForQuota !== undefined;
}

/** Lower is shown first: a working run beats a waiting one, which beats the queue. */
function rank(run: RunStatus): number | undefined {
  switch (run.status) {
    case RunStatusCode.Running:
    case RunStatusCode.Pending:
      return 0;
    case RunStatusCode.Paused:
      return isWaiting(run) ? 1 : undefined;
    case RunStatusCode.Queued:
      return 2;
    default:
      return undefined;
  }
}

function pick(runs: RunStatus[]): RunStatus | undefined {
  let best: { run: RunStatus; rank: number } | undefined;
  for (const run of runs) {
    const r = rank(run);
    if (r === undefined) continue;
    const better =
      !best ||
      r < best.rank ||
      (r === best.rank &&
        (r === 2
          ? (run.queuePosition ?? Infinity) < (best.run.queuePosition ?? Infinity)
          : run.startedAt > best.run.startedAt));
    if (better) best = { run, rank: r };
  }
  return best?.run;
}

/**
 * `activeProjectId` (when given) restricts the line to that project's runs, so a
 * project switch never shows the previous project's run while the store catches up.
 */
export function statusLineFor(
  runs: RunStatus[],
  t: Translate,
  activeProjectId?: string | null,
): string | null {
  const run = pick(
    activeProjectId === undefined ? runs : runs.filter((r) => r.projectId === activeProjectId),
  );
  if (!run) return null;
  const type = t(`strings:${RUN_TYPE_KEY[runTypeLabel(run.kind)]}`);

  if (run.status === RunStatusCode.Queued) {
    return run.queuePosition !== undefined
      ? t(`${NS}queued`, { type, position: run.queuePosition })
      : t(`${NS}queuedNoPosition`, { type });
  }
  if (run.total === 0) return t(`${NS}starting`, { type });

  const progress = { done: run.completed + run.failed, total: run.total };
  if (isWaiting(run)) return t(`${NS}waiting`, { type, ...progress });

  const languages = isTranslationRun(run) ? (run.request?.targetLanguages ?? []) : [];
  if (languages.length === 1) {
    return t(`${NS}translatingInto`, { language: languageName(languages[0]), ...progress });
  }
  if (languages.length > 1) {
    return t(`${NS}translatingLanguages`, { count: languages.length, ...progress });
  }
  return t(`${NS}progress`, { type, ...progress });
}
