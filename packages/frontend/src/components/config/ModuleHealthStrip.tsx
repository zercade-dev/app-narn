/**
 * ModuleHealthStrip — compact per-module reliability summary rendered on the
 * module config cards (project settings and global config). Shows success
 * rate, median latency, retry counters, and a unicode sparkline of recent
 * 429 responses. Data comes from `GET /api/modules/health` (in-memory,
 * reset on server restart), so "no data yet" is the common cold-start state.
 */
import { useTranslation } from 'react-i18next';
import type { ModuleHealthAggregate } from '../../hooks/use-module-health.js';

const SPARKLINE_BUCKETS = 10;
const SPARKLINE_WINDOW_MS = 10 * 60_000; // last 10 minutes
const SPARKLINE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Buckets recent-429 timestamps into a fixed-width unicode bar sparkline
 * covering the last `SPARKLINE_WINDOW_MS`. Returns null when no 429s fall
 * inside the window (the sparkline is hidden entirely).
 */
export function buildRateLimitSparkline(timestamps: number[], now = Date.now()): string | null {
  const buckets = new Array<number>(SPARKLINE_BUCKETS).fill(0);
  const bucketMs = SPARKLINE_WINDOW_MS / SPARKLINE_BUCKETS;
  for (const ts of timestamps) {
    const age = now - ts;
    if (age < 0 || age >= SPARKLINE_WINDOW_MS) continue;
    buckets[SPARKLINE_BUCKETS - 1 - Math.floor(age / bucketMs)]++;
  }
  const max = Math.max(...buckets);
  if (max === 0) return null;
  return buckets
    .map((count) =>
      count === 0
        ? SPARKLINE_CHARS[0]
        : SPARKLINE_CHARS[Math.min(7, Math.max(1, Math.round((count / max) * 7)))],
    )
    .join('');
}

function formatMs(ms: number): string {
  if (ms >= 10_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export interface ModuleHealthStripProps {
  moduleId: string;
  stats?: ModuleHealthAggregate;
}

export function ModuleHealthStrip({
  moduleId,
  stats,
}: Readonly<ModuleHealthStripProps>): React.JSX.Element {
  const { t } = useTranslation('config');

  if (!stats || stats.total === 0) {
    return (
      <p className="text-xs text-muted-foreground" data-testid={`module-health-strip-${moduleId}`}>
        {t('health.noData')}
      </p>
    );
  }

  const ratePct = Math.round((stats.successRate ?? 0) * 100);
  const sparkline = buildRateLimitSparkline(stats.recent429s);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
      data-testid={`module-health-strip-${moduleId}`}
    >
      <span data-testid={`module-health-success-rate-${moduleId}`}>
        {t('health.successRate', { rate: ratePct })}
      </span>
      {stats.latency.p50 !== null && (
        <span data-testid={`module-health-latency-${moduleId}`}>
          {t('health.medianLatency', { latency: formatMs(stats.latency.p50) })}
        </span>
      )}
      {stats.rateLimit429Retries > 0 && (
        <span data-testid={`module-health-429-retries-${moduleId}`}>
          {t('health.rateLimitRetries', { count: stats.rateLimit429Retries })}
        </span>
      )}
      {stats.lqaRetries > 0 && (
        <span data-testid={`module-health-lqa-retries-${moduleId}`}>
          {t('health.lqaRetries', { count: stats.lqaRetries })}
        </span>
      )}
      {sparkline !== null && (
        <span
          className="font-mono leading-none"
          title={t('health.sparklineTitle')}
          data-testid={`module-health-429-sparkline-${moduleId}`}
        >
          {sparkline}
        </span>
      )}
    </div>
  );
}
