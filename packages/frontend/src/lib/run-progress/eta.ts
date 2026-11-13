import type { Translate } from '../log-presentation/types.js';

export interface ProgressSample {
  at: number;
  done: number;
}
export type Eta = { kind: 'estimating' } | { kind: 'waiting' } | { kind: 'eta'; seconds: number };

/** Items settled (and at least 5% of the total) before an estimate is shown. */
export const ETA_MIN_DONE = 5;
export const ETA_MIN_ELAPSED_MS = 10_000;
/** The rate is measured over samples inside the last minute. */
export const ETA_WINDOW_MS = 60_000;
/** The rate window must span at least this long to be trusted. */
const ETA_MIN_SPAN_MS = 5_000;
/** next = 0.3·raw + 0.7·previous */
export const ETA_SMOOTHING = 0.3;

/**
 * Remaining-time estimate from a sliding-window rate with exponential
 * smoothing. Returns `estimating` whenever there is not enough evidence (early
 * in the run, `total` of 0, or nothing settled inside the window) and
 * `waiting` while the run is parked by design.
 */
export function estimateEta(a: {
  samples: ProgressSample[];
  total: number;
  startedAt: number;
  now: number;
  waiting: boolean;
  previous?: number;
}): Eta {
  if (a.waiting) return { kind: 'waiting' };
  if (a.total <= 0 || a.samples.length === 0) return { kind: 'estimating' };

  const done = a.samples[a.samples.length - 1].done;
  if (done < Math.max(ETA_MIN_DONE, Math.ceil(a.total * 0.05))) return { kind: 'estimating' };
  if (a.now - a.startedAt < ETA_MIN_ELAPSED_MS) return { kind: 'estimating' };

  const inWindow = a.samples.filter((s) => s.at >= a.now - ETA_WINDOW_MS);
  if (inWindow.length < 2) return { kind: 'estimating' };
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const spanMs = last.at - first.at;
  const gained = last.done - first.done;
  if (spanMs < ETA_MIN_SPAN_MS || gained <= 0) return { kind: 'estimating' };

  const rate = gained / (spanMs / 1000); // items per second
  const raw = Math.max(0, a.total - done) / rate;
  const prev = a.previous !== undefined && a.previous >= 0 ? a.previous : undefined;
  const seconds = prev === undefined ? raw : ETA_SMOOTHING * raw + (1 - ETA_SMOOTHING) * prev;
  return { kind: 'eta', seconds: Math.max(0, seconds) };
}

/** "less than a minute" / "about 3 min" / "about 1 h 2 min" left, via the `console` keys. */
export function formatDuration(ms: number, t: Translate): string {
  const totalMinutes = Math.ceil(Math.max(0, ms) / 60_000);
  if (ms < 60_000) return t('progress.etaUnderMinute');
  if (totalMinutes < 60) return t('progress.etaMinutes', { count: totalMinutes });
  return t('progress.etaHours', {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  });
}

/** Locale-neutral elapsed clock: `m:ss`, or `h:mm:ss` from one hour. */
export function formatElapsed(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
