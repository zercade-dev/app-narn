/**
 * RunProgressCard — the inline "background run in progress" indicator shared by
 * the long-running run engines (category-gen, glossary-gen, source-review, …).
 * Pure presentational: a spinner + running label, a `completed / total` count
 * (or a "starting" label before the first batch lands), and a native `<progress>`
 * bar. The run keeps going if the user navigates away; the owner renders this
 * while the run is active.
 *
 * Generalized from CategoryTab's hand-rolled `category-gen-progress` markup, which
 * defines the canonical look (status-info native progress with an accessible label and
 * a test id). The bar is INDETERMINATE until the first unit of work completes
 * (`total === 0` or `completed === 0`) — `value`/`max` are spread only when
 * determinate, so the browser shows an animated indeterminate bar at the start.
 *
 * Only `run`, `runningLabel`, and (optionally) `startingLabel` are required; the
 * rest tune the chrome so each adopter keeps its own wrapper id, count phrasing,
 * border, and hint without forcing any specific i18n into this component.
 */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The minimal run shape this card needs — a structural subset of the shared
 * `RunStatus`, so any `RunStatus` (or a lighter `{ completed, total }`) fits.
 */
export interface RunProgressLike {
  /** Units of work finished so far. */
  completed: number;
  /** Total units of work; `0` until known (renders an indeterminate bar). */
  total: number;
  /** The run's status, forwarded to `data-status` for styling/tests. Optional. */
  status?: string;
}

export interface RunProgressCardProps {
  /** The active run; only `completed`/`total` are read for the bar + count. */
  readonly run: RunProgressLike;
  /** Text beside the spinner and the bar's `aria-label` (e.g. "Generating…"). */
  readonly runningLabel: string;
  /**
   * Shown in the count slot while `total === 0` (work not yet sized). Omit to
   * render the raw `${completed} / ${total}` count even at the start.
   */
  readonly startingLabel?: string;
  /**
   * Formats the count once `total > 0`. Defaults to `${completed} / ${total}`.
   * Pass a localized formatter for phrasing like "12 / 30 batches".
   */
  readonly countLabel?: (completed: number, total: number) => string;
  /** Optional background hint rendered below the bar. Omit for no hint. */
  readonly hint?: string;
  /** Wrap in a bordered card (CategoryTab's look). Default: false (bare). */
  readonly bordered?: boolean;
  /**
   * Test id for the wrapper. The bar's test id is `${testId}-bar` so adopters
   * keep their existing selectors (e.g. "category-gen-progress").
   */
  readonly 'data-testid'?: string;
}

export function RunProgressCard({
  run,
  runningLabel,
  startingLabel,
  countLabel,
  hint,
  bordered = false,
  'data-testid': testId,
}: RunProgressCardProps): React.JSX.Element {
  // Determinate as soon as the work is sized (total > 0), exactly like the
  // CategoryTab markup this generalizes — value/max are spread on total > 0 so a
  // sized-but-not-yet-started run (total=N, completed=0) shows a 0%-filled bar
  // rather than the indeterminate animation. While total is still 0 (work not yet
  // sized) no value/max is spread, so the native <progress> renders its
  // indeterminate (animated) state.
  const determinate = run.total > 0;
  // Show the starting label only before the work is sized; once total > 0 (or no
  // starting label was given) show the count.
  const countText =
    run.total === 0 && startingLabel !== undefined
      ? startingLabel
      : (countLabel?.(run.completed, run.total) ?? `${run.completed} / ${run.total}`);

  return (
    <section
      className={cn('space-y-1.5', bordered && 'rounded-lg border border-border/60 p-3')}
      data-testid={testId}
      {...(run.status ? { 'data-status': run.status } : {})}
    >
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-heading font-medium">
          <Loader2 className="size-4 animate-spin" />
          {runningLabel}
        </span>
        <span
          className="text-xs text-muted-foreground"
          data-testid={testId ? `${testId}-count` : undefined}
        >
          {countText}
        </span>
      </div>
      <progress
        {...(determinate ? { value: run.completed, max: run.total } : {})}
        className="h-1.5 w-full rounded-full bg-muted [appearance:none] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-status-info [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-status-info"
        aria-label={runningLabel}
        data-testid={testId ? `${testId}-bar` : undefined}
      />
      {hint !== undefined && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}
