import { useTranslation } from 'react-i18next';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { cn } from '@/lib/utils';
import { formatDuration, formatElapsed } from '../../lib/run-progress/eta.js';
import { RUN_CARD_LINGER_MS, useRunProgress } from '../../stores/run-progress-store.js';

export interface RunProgressCardProps {
  runId: string;
  /** `console` is the flat strip in the log panel; `callout` the framed copy inside a tour step. */
  variant: 'console' | 'callout';
}

const OUTCOME_KEY: Partial<Record<RunStatusCode, string>> = {
  [RunStatusCode.Completed]: 'progress.outcome.completed',
  [RunStatusCode.Failed]: 'progress.outcome.failed',
  [RunStatusCode.Cancelled]: 'progress.outcome.cancelled',
};

/**
 * Live progress of one run: bar, `done / total`, failures, elapsed time and an
 * ETA. Once the run ends it shows the outcome for a few seconds, then renders
 * nothing. Both variants read the same hook, so they always show equal numbers.
 */
export function RunProgressCard({
  runId,
  variant,
}: RunProgressCardProps): React.JSX.Element | null {
  const { t } = useTranslation('console');
  const progress = useRunProgress(runId);
  if (!progress) return null;
  const { run, done, elapsedMs, eta, now } = progress;

  const ended = run.finishedAt !== undefined;
  if (ended && now - (run.finishedAt as number) >= RUN_CARD_LINGER_MS) return null;

  const outcomeKey = OUTCOME_KEY[run.status];
  const pct = run.total > 0 ? Math.min(100, Math.round((done / run.total) * 100)) : 0;

  let etaText: string | null = null;
  if (!ended) {
    if (eta.kind === 'estimating') etaText = t('progress.estimating');
    else if (eta.kind === 'waiting') etaText = t('progress.waiting');
    else etaText = formatDuration(eta.seconds * 1000, t);
  }

  return (
    <div
      data-testid="run-progress-card"
      data-variant={variant}
      className={cn(
        'flex flex-col gap-1 text-xs',
        variant === 'callout' ? 'border border-border bg-card p-2' : 'px-3 py-1.5',
      )}
    >
      <div
        data-testid="run-progress-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={run.total}
        aria-valuenow={done}
        className="h-1.5 w-full overflow-hidden bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 text-muted-foreground">
        <span data-testid="run-progress-counts" className="font-medium text-foreground">
          {t('progress.counts', { done, total: run.total })}
        </span>
        {run.failed > 0 && (
          <span className="text-status-fail">{t('progress.failed', { count: run.failed })}</span>
        )}
        <span data-testid="run-progress-elapsed">
          {t('progress.elapsed', { time: formatElapsed(elapsedMs) })}
        </span>
        {etaText !== null && <span data-testid="run-progress-eta">{etaText}</span>}
        {ended && outcomeKey && (
          <span data-testid="run-progress-outcome" className="font-medium text-foreground">
            {t(outcomeKey)}
          </span>
        )}
      </div>
    </div>
  );
}
