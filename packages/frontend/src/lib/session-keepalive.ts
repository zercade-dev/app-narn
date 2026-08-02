/**
 * Proactive cloud-session keep-alive.
 *
 * The ONLY other session renewal is reactive — `use-api.ts` refreshes after an
 * `/api` call already 401'd at the ~1h access-token rollover. That logs an
 * actively-using user out for one request cycle and, under load, races the
 * refresh-token rotation. This scheduler refreshes the session BEFORE the access
 * token expires (a fixed sub-hour cadence) and again whenever the tab returns to
 * the foreground, funneling every call through the single-flight `refreshSession`
 * from `use-api.ts` so it never double-rotates the refresh token.
 *
 * CLOUD-MODE ONLY: open-core has no `/auth/refresh` route. The caller gates this
 * on the server-derived `cloudManaged` flag (false in open-core), so it is a
 * no-op there and is never started.
 *
 * Pauses while the tab is hidden or the browser is offline (no point burning a
 * rotation the user can't see) and resumes on visibility/online.
 */
import { refreshSession } from '../hooks/use-api.js';

/** ~80% of a 60-min access token; a fixed sub-hour cadence keeps it well clear. */
export const KEEPALIVE_INTERVAL_MS = 45 * 60 * 1000;

export interface KeepaliveOptions {
  /** Refresh cadence; defaults to {@link KEEPALIVE_INTERVAL_MS}. */
  intervalMs?: number;
  /** Refresh fn; defaults to the single-flight `refreshSession`. Injectable for tests. */
  refresh?: () => Promise<boolean>;
}

/**
 * Start the keep-alive scheduler. Returns a stop function that clears the timer
 * and detaches all listeners — call it from the React effect's cleanup.
 */
export function startSessionKeepalive(opts: KeepaliveOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? KEEPALIVE_INTERVAL_MS;
  const refresh = opts.refresh ?? refreshSession;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  // Don't refresh while the tab is hidden or the browser is offline.
  const active = (): boolean => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  };

  const tick = (): void => {
    if (stopped || !active()) return;
    // Fire-and-forget: a failed proactive refresh is non-fatal (the reactive
    // 401 path remains), so swallow rejections rather than surfacing them.
    void refresh().catch(() => {});
  };

  const startTimer = (): void => {
    if (timer === null && !stopped) timer = setInterval(tick, intervalMs);
  };
  const stopTimer = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const onVisibilityOrOnline = (): void => {
    if (stopped) return;
    if (active()) {
      // Returning to the foreground: catch up immediately (the timer was paused
      // or throttled while hidden), then resume the cadence.
      tick();
      startTimer();
    } else {
      stopTimer();
    }
  };

  if (active()) startTimer();

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityOrOnline);
  }
  if (typeof globalThis.addEventListener === 'function') {
    globalThis.addEventListener('online', onVisibilityOrOnline);
    globalThis.addEventListener('offline', onVisibilityOrOnline);
  }

  return (): void => {
    stopped = true;
    stopTimer();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityOrOnline);
    }
    if (typeof globalThis.removeEventListener === 'function') {
      globalThis.removeEventListener('online', onVisibilityOrOnline);
      globalThis.removeEventListener('offline', onVisibilityOrOnline);
    }
  };
}
