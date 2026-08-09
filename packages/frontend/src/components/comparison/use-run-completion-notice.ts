import { useEffect, useRef, useState } from 'react';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { useLoggerStore } from '../../stores/logger-store.js';
import { presentEntry } from '../../lib/log-presentation/present.js';
import type { Translate } from '../../lib/log-presentation/types.js';

type FinishedStatus =
  typeof RunStatusCode.Completed | typeof RunStatusCode.Failed | typeof RunStatusCode.Cancelled;

/** Progress totals captured at the moment a run finishes. */
export interface RunCompletion {
  runId: string;
  status: FinishedStatus;
  completed: number;
  failed: number;
  total: number;
}

function isFinished(status: RunStatusCode | undefined): status is FinishedStatus {
  return (
    status === RunStatusCode.Completed ||
    status === RunStatusCode.Failed ||
    status === RunStatusCode.Cancelled
  );
}

interface RunSnapshot {
  status: RunStatusCode | undefined;
  completed: number;
  failed: number;
  total: number;
}

/**
 * Encapsulates the "capture a run's completion during render, then fire a
 * notification exactly once" dance shared by the String table and the
 * Comparison tab. Tracking the previous status in render-phase state (rather
 * than an effect) lets the caller clear its run id the moment the run finishes,
 * which detaches the live run object; the captured {@link RunCompletion} is what
 * `onComplete` reads.
 *
 * @param runId   the run currently being watched, or null when idle
 * @param run     the live run snapshot for `runId` (status + progress), or null
 * @param onComplete fired once per finished run with the captured totals
 */
export function useRunCompletionNotice(
  runId: string | null,
  run: RunSnapshot | null,
  onComplete: (completion: RunCompletion) => void,
): void {
  const status = run?.status;
  const [prevStatus, setPrevStatus] = useState<RunStatusCode | undefined>(undefined);
  const [completion, setCompletion] = useState<RunCompletion | null>(null);
  const notifiedRunId = useRef<string | null>(null);

  // Capture completion during render (transition-based) so the caller can clear
  // its run id immediately; this converges because `status` then goes stale.
  if (prevStatus !== status) {
    setPrevStatus(status);
    if (runId && run && isFinished(status)) {
      setCompletion({
        runId,
        status,
        completed: run.completed,
        failed: run.failed,
        total: run.total,
      });
    }
  }

  // Notify once per finished run. `onComplete` is kept in a ref (synced in an
  // effect, not during render) so a fresh closure each render doesn't re-fire
  // the notification — the captured `completion` is the only trigger.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });
  useEffect(() => {
    if (!completion || notifiedRunId.current === completion.runId) return;
    notifiedRunId.current = completion.runId;
    onCompleteRef.current(completion);
  }, [completion]);
}

/**
 * Collect the distinct failure reasons logged for a finished run, rendered as
 * user-facing prose through the shared log presenter — so the notice says what
 * went wrong and what to do, in the user's language. The engine's English
 * `hint` metadata is deliberately ignored for display; it stays on the wire for
 * log export.
 */
export function collectRunFailureReasons(runId: string, t: Translate): string[] {
  const logEntries = useLoggerStore.getState().entries;
  const reasons = logEntries
    .filter(
      (e) =>
        (e.level === 'error' || e.level === 'warn') &&
        e.message === 'translation:failed' &&
        e.metadata?.runId === runId,
    )
    .map((e) => presentEntry(e, t).text)
    .filter(Boolean);
  return [...new Set(reasons)];
}
