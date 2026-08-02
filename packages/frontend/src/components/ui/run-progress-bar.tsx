import { useTranslation } from 'react-i18next';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { cn } from '@/lib/utils';

export interface RunProgressBarProps {
  /** Units of work finished successfully so far. */
  readonly completed: number;
  /** Units of work that finished with an error. */
  readonly failed: number;
  /** Total units of work; `0` until the run is sized. */
  readonly total: number;
  /** The run's status; drives the indeterminate shimmer (see below). */
  readonly status?: RunStatusCode;
  /** Accessible label for the `progressbar` element. */
  readonly 'aria-label'?: string;
  readonly className?: string;
}

/**
 * Determinate run progress bar: a `completed` (bg-primary) segment and a
 * `failed` (bg-destructive) segment stacked over a bg-muted track, with the
 * raw counts as its visible label — `{completed}/{total}`, plus the failed
 * count when it's non-zero. Falls back to an indeterminate shimmer when the
 * run hasn't been sized yet (`total === 0`) and is still actively in flight
 * (pending / queued / running); a `total === 0` run that isn't active (e.g.
 * paused before its first batch, or a terminal run with nothing to do) shows
 * a flat empty track instead of shimmering forever.
 */
export function RunProgressBar({
  completed,
  failed,
  total,
  status,
  className,
  ...rest
}: RunProgressBarProps): React.JSX.Element {
  const { t } = useTranslation('strings');
  const isActive =
    status === RunStatusCode.Pending ||
    status === RunStatusCode.Queued ||
    status === RunStatusCode.Running;
  const indeterminate = total === 0 && isActive;
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;
  const label =
    `${completed}/${total}` +
    (failed > 0 ? ` ${t('runs.progressFailedSuffix', { count: failed })}` : '');

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      data-testid="run-progress-bar"
      {...(status ? { 'data-status': status } : {})}
    >
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-label={rest['aria-label']}
        {...(indeterminate ? {} : { 'aria-valuenow': completed + failed, 'aria-valuemax': total })}
        className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        {indeterminate ? (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
        ) : (
          <>
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${completedPct}%` }}
            />
            <div
              className="h-full bg-destructive transition-all duration-500"
              style={{ width: `${failedPct}%` }}
            />
          </>
        )}
      </div>
      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{label}</span>
    </div>
  );
}
