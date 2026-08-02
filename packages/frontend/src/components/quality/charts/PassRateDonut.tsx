import { formatPercent } from './chart-utils.js';

export interface PassRateDonutProps {
  readonly passRate: number;
  readonly passed: number;
  readonly failed: number;
  /** Overall SVG width/height in px (viewBox scales to match). Default 120. */
  readonly size?: number;
}

const STROKE_WIDTH = 16;
/** Angular gap between the two arcs, expressed as an arc-length in SVG units (~2px). */
const GAP = 2;

/**
 * Hand-rolled SVG donut for the overall pass rate: two arcs (passed / failed)
 * sharing one ring, with a symmetric ~2px gap at both boundaries between
 * them (butt caps, each arc inset GAP/2 on both ends — round caps would
 * overshoot/overlap on a two-segment ring), and the pass rate printed in
 * the center. `role="img"` + an
 * aria-label carry the accessible summary; a native `<title>` gives the
 * passed/failed counts on hover.
 */
export function PassRateDonut({ passRate, passed, failed, size = 120 }: PassRateDonutProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - STROKE_WIDTH / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const clampedRate = Math.max(0, Math.min(1, passRate));
  const passedLen = clampedRate * circumference;
  const failedLen = circumference - passedLen;
  const pctLabel = formatPercent(passRate);

  // Each arc is inset by GAP/2 at BOTH its leading and trailing edge, so the two
  // boundaries between the segments (mid-ring, and the wrap point at 12 o'clock
  // under the center label) each get GAP/2 + GAP/2 = a full GAP of separation —
  // symmetric, unlike naively shortening both arcs at the same edge. `butt` caps
  // (not `round`) keep the arc ends flush with those insets instead of
  // overshooting past them.
  let passedArcLen: number;
  let passedArcStart: number;
  let failedArcLen: number;
  let failedArcStart: number;
  if (clampedRate >= 1) {
    // Degenerate 100% case: a single clean ring, no inset/gap to speak of.
    passedArcLen = circumference;
    passedArcStart = 0;
    failedArcLen = 0;
    failedArcStart = 0;
  } else if (clampedRate <= 0) {
    // Degenerate 0% case: mirror of the above, all failed.
    passedArcLen = 0;
    passedArcStart = 0;
    failedArcLen = circumference;
    failedArcStart = 0;
  } else {
    passedArcStart = GAP / 2;
    passedArcLen = Math.max(passedLen - GAP, 0);
    failedArcStart = passedLen + GAP / 2;
    failedArcLen = Math.max(failedLen - GAP, 0);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${pctLabel} passed`}
    >
      <title>{`${passed.toLocaleString()} passed / ${failed.toLocaleString()} failed`}</title>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        className="stroke-muted"
      />
      {/* Failed arc drawn first, offset to start right after the passed arc + gap. */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="butt"
        className="stroke-status-fail"
        strokeDasharray={`${failedArcLen} ${circumference - failedArcLen}`}
        strokeDashoffset={-failedArcStart}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="butt"
        className="stroke-status-pass"
        strokeDasharray={`${passedArcLen} ${circumference - passedArcLen}`}
        strokeDashoffset={-passedArcStart}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-lg font-semibold tabular-nums"
      >
        {pctLabel}
      </text>
    </svg>
  );
}
