import { cn } from '@/lib/utils';
import type { LqaGroupSummary } from '../QualityTab.js';
import { formatPercent, passRateBarClass, sequentialCellStyle } from './chart-utils.js';

export interface IssueHeatmapProps {
  readonly groups: Record<string, LqaGroupSummary>;
  readonly issueTypes: readonly string[];
  readonly checkLabel: (type: string) => string;
  /** Display formatter for a row key (e.g. localized source labels). Defaults to the raw key. */
  readonly rowLabel?: (key: string) => string;
  /** When present the row label renders as a button and drills down on click. */
  readonly onRowClick?: (key: string) => void;
  /** `data-testid` for each row label is `${testIdPrefix}-${key}`. */
  readonly testIdPrefix: string;
  /**
   * When true, renders a leading data column with a small inline pass-rate bar
   * + percent per row (from `group.passRate`), and sorts rows worst-first by
   * pass rate instead of the default alphabetical order. Off by default so
   * `byModule` (no drill-down dimension, no merged bar) is unaffected.
   */
  readonly passRateColumn?: boolean;
  /** Header label for the pass-rate column; only used when `passRateColumn` is true. */
  readonly passRateColumnLabel?: string;
}

/** Ramp legend stops, from "less" to "more" (relative intensity, not raw counts). */
const RAMP_STEPS = [0.2, 0.4, 0.6, 0.8, 1];

/**
 * Rows (one per group key) × issue-type columns. Rows are alphabetical by
 * default, or worst-first by pass rate when `passRateColumn` is set. Cell
 * background is a single sequential hue (`sequentialCellStyle`) scaled to
 * the table's max count; empty cells fall back to the track color and a "·"
 * glyph so the encoding never relies on color alone. A "less → more" ramp
 * legend documents the scale. Row labels become drill-down buttons when
 * `onRowClick` is supplied. `passRateColumn` adds a leading data column with
 * a small inline pass-rate bar + percent per row (color from the shared
 * `passRateBarClass` tier ladder — see the tab-level color legend).
 */
export function IssueHeatmap({
  groups,
  issueTypes,
  checkLabel,
  rowLabel,
  onRowClick,
  testIdPrefix,
  passRateColumn,
  passRateColumnLabel,
}: IssueHeatmapProps) {
  // Worst-first (lowest pass rate first) when the merged pass-rate column is
  // shown — preserves the old dedicated pass-rate bar list's ordering value.
  // Alphabetical otherwise (e.g. byModule, which has no pass-rate column).
  const rowKeys = passRateColumn
    ? Object.keys(groups).sort(
        (a, b) => groups[a].passRate - groups[b].passRate || a.localeCompare(b),
      )
    : Object.keys(groups).sort((a, b) => a.localeCompare(b));

  let max = 0;
  for (const key of rowKeys) {
    for (const type of issueTypes) {
      max = Math.max(max, groups[key].issues[type] ?? 0);
    }
  }

  return (
    <div className="space-y-2">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="px-1 text-left font-medium text-muted-foreground" />
            {passRateColumn && (
              <th className="px-1 text-left font-medium whitespace-nowrap text-muted-foreground">
                {passRateColumnLabel}
              </th>
            )}
            {issueTypes.map((type) => (
              <th
                key={type}
                className="px-1 text-center font-medium whitespace-nowrap text-muted-foreground"
              >
                {checkLabel(type)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((key) => {
            const label = rowLabel ? rowLabel(key) : key;
            const testId = `${testIdPrefix}-${key}`;
            return (
              <tr key={key}>
                <th className="px-1 text-left font-medium whitespace-nowrap">
                  {onRowClick ? (
                    <button
                      type="button"
                      className="cursor-pointer rounded px-1 hover:bg-muted/40 hover:underline"
                      onClick={() => onRowClick(key)}
                      data-testid={testId}
                    >
                      {label}
                    </button>
                  ) : (
                    <span data-testid={testId}>{label}</span>
                  )}
                </th>
                {passRateColumn && (
                  <td
                    className="w-full px-1"
                    data-testid={`${testIdPrefix}-passrate-${key}`}
                    title={`${label}: ${formatPercent(groups[key].passRate)}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="relative h-2 w-full min-w-12 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full',
                            passRateBarClass(groups[key].passRate),
                          )}
                          style={{ width: `${groups[key].passRate * 100}%` }}
                        />
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatPercent(groups[key].passRate)}
                      </span>
                    </span>
                  </td>
                )}
                {issueTypes.map((type) => {
                  const count = groups[key].issues[type] ?? 0;
                  return (
                    <td
                      key={type}
                      className="h-7 w-10 rounded text-center tabular-nums"
                      style={sequentialCellStyle(count, max)}
                      title={`${label} · ${checkLabel(type)}: ${count}`}
                    >
                      {count > 0 ? count : '·'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>less</span>
        <div className="flex gap-0.5">
          {RAMP_STEPS.map((step) => (
            <span key={step} className="h-3 w-4 rounded-sm" style={sequentialCellStyle(step, 1)} />
          ))}
        </div>
        <span>more</span>
      </div>
    </div>
  );
}
