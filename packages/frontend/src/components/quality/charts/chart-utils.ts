/**
 * Shared pure helpers for the Quality tab's hand-rolled chart primitives
 * (`PassRateDonut`, `HBarList`, `IssueHeatmap`) — no chart library, just SVG/CSS
 * geometry + the color-tier ladder shared across the dashboard.
 *
 * The pass-rate tier helpers moved here from `QualityTab.tsx` verbatim (same
 * thresholds/classes) so both the legacy heatmap table and the new chart
 * primitives share one definition instead of drifting.
 */

/** Pass-rate severity tier: the single threshold ladder the bar/text hues share. */
export type PassRateTier = 'high' | 'mid' | 'low';

export function passRateTier(passRate: number): PassRateTier {
  if (passRate >= 0.9) return 'high';
  if (passRate >= 0.7) return 'mid';
  return 'low';
}

/**
 * Micro-bar fill class for a pass-rate, keyed to the theme-aware status tokens
 * (pass/warn/fail) so the ladder desaturates correctly under every theme
 * instead of leaking a fixed emerald/amber/red palette.
 */
export function passRateBarClass(passRate: number): string {
  return { high: 'bg-status-pass', mid: 'bg-status-warn', low: 'bg-status-fail' }[
    passRateTier(passRate)
  ];
}

/** Text hue mirroring the pass-rate bar ladder, for headline stat numbers. */
export function passRateTextClass(passRate: number): string {
  return {
    high: 'text-status-pass',
    mid: 'text-status-warn',
    low: 'text-status-fail',
  }[passRateTier(passRate)];
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export interface SequentialCellStyle {
  readonly background: string;
  readonly color: string;
}

/**
 * Heatmap/ramp cell style for a single sequential hue (the app's `--status-info`
 * blue, already theme-aware in `index.css`), intensity scaled against the
 * table's max count — mirrors the approved mockup's ramp (a floor of ~18%
 * opacity so even the smallest nonzero count still reads, up to ~100% at the
 * max). Empty cells fall back to the neutral track color.
 */
export function sequentialCellStyle(count: number, max: number): SequentialCellStyle {
  if (count <= 0 || max <= 0) {
    return { background: 'var(--muted)', color: 'var(--muted-foreground)' };
  }
  const intensity = 0.18 + 0.82 * Math.min(1, count / max);
  return {
    background: `color-mix(in oklch, var(--color-status-info) ${Math.round(intensity * 100)}%, var(--card))`,
    color: intensity > 0.55 ? '#fff' : 'var(--muted-foreground)',
  };
}

export interface TopIssueEntry {
  readonly key: string;
  readonly count: number;
  /** Set on the folded "everything past the top N" row. */
  readonly isOther?: true;
}

/**
 * Sorts issue-type counts descending (ties broken alphabetically for
 * determinism) and keeps the top `n`; anything beyond that is folded into a
 * single trailing `{ key: 'other', count, isOther: true }` row so the bar
 * list never grows unbounded. Zero-count issue types are dropped entirely.
 */
export function topIssuesWithOther(issues: Record<string, number>, n: number): TopIssueEntry[] {
  const sorted = Object.entries(issues)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (sorted.length <= n) {
    return sorted.map(([key, count]) => ({ key, count }));
  }

  const top = sorted.slice(0, n).map(([key, count]) => ({ key, count }));
  const otherCount = sorted.slice(n).reduce((sum, [, count]) => sum + count, 0);
  return [...top, { key: 'other', count: otherCount, isOther: true }];
}
