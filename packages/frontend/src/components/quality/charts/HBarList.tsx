import { cn } from '@/lib/utils';

export interface HBarListItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly max: number;
  /** Tailwind background class for the fill (e.g. a `passRateBarClass` tier or a sequential hue). */
  readonly color: string;
  /** When present the row renders as a real button and drills down on click. */
  readonly onClick?: (key: string) => void;
  /** Native `title` attribute fallback when `hover` is omitted. */
  readonly title?: string;
  /** Per-row hover tooltip text (takes precedence over `title` when both are set). */
  readonly hover?: string;
}

export interface HBarListProps {
  readonly items: readonly HBarListItem[];
  readonly valueFormat: (value: number) => string;
  /** `data-testid` for each row is `${testIdPrefix}-${item.key}`. */
  readonly testIdPrefix: string;
}

/**
 * Horizontal bar list: `[label | track with a rounded-end fill | value]`. Pure
 * presentational — it renders `items` in the order given (callers sort).
 * Rows with an `onClick` are real `<button>`s (keyboard-operable, hover
 * background, `title`); rows without render as static divs. Values use the
 * ambient ink color, never the bar's fill color.
 */
export function HBarList({ items, valueFormat, testIdPrefix }: HBarListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => {
        const pct = item.max > 0 ? Math.max(0, Math.min(100, (item.value / item.max) * 100)) : 0;
        const tooltip = item.hover ?? item.title;
        const testId = `${testIdPrefix}-${item.key}`;
        const content = (
          <>
            <span className="truncate text-xs text-muted-foreground">{item.label}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                aria-hidden="true"
                className={cn('absolute inset-y-0 left-0 rounded-full', item.color)}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="shrink-0 text-right text-xs tabular-nums">
              {valueFormat(item.value)}
            </span>
          </>
        );

        if (item.onClick) {
          const onClick = item.onClick;
          return (
            <button
              key={item.key}
              type="button"
              className="grid w-full cursor-pointer grid-cols-[minmax(2.5rem,9rem)_1fr_auto] items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-muted/40"
              onClick={() => onClick(item.key)}
              data-testid={testId}
              title={tooltip}
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={item.key}
            className="grid w-full grid-cols-[minmax(2.5rem,9rem)_1fr_auto] items-center gap-3 px-2 py-1"
            data-testid={testId}
            title={tooltip}
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}
