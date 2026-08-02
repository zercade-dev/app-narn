/**
 * Minimal client-side rate limiting for outbound provider requests.
 *
 * One limiter per module id (so e.g. DeepL and an LLM provider never
 * serialize each other), all sharing the single workspace-wide
 * requests-per-second value from the global config. Enforcement is a
 * FIFO min-interval gate: consecutive acquisitions on the same limiter are
 * spaced at least `1000 / rps` ms apart; the first acquisition passes
 * immediately.
 *
 * A limiter also backs off automatically when the caller reports an observed
 * rate-limit error (`reportRateLimitHit`): the effective spacing doubles, on
 * top of whatever the configured rate already demands, capped at a 10s floor.
 * This is independent of the configured rate so a live global-config update
 * (which re-applies the configured value on every acquisition) can't silently
 * erase backoff that was earned by an actual provider rejection.
 */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Backoff ceiling: requests never space out further than this (0.1 req/s). */
const MAX_BACKOFF_INTERVAL_MS = 10_000;

export interface RateLimitHitResult {
  /** Whether this hit actually changed the effective interval. */
  changed: boolean;
  previousIntervalMs: number;
  newIntervalMs: number;
}

export class RateLimiter {
  /** Spacing derived from the configured requests-per-second value. */
  private baseIntervalMs: number;
  /**
   * Extra spacing imposed by `reportHit()` after an observed rate-limit error,
   * on top of `baseIntervalMs`. 0 until the first hit. Deliberately NOT
   * touched by `setIntervalMs` — see the file-level doc comment.
   */
  private backoffIntervalMs = 0;
  /** Earliest timestamp at which the next slot may start. */
  private nextFreeAt = 0;
  /** FIFO chain: each acquire waits for every earlier acquire to schedule. */
  private tail: Promise<void> = Promise.resolve();

  constructor(intervalMs: number) {
    this.baseIntervalMs = intervalMs;
  }

  /** Update the spacing (the global RPS value may change between runs). */
  setIntervalMs(ms: number): void {
    this.baseIntervalMs = ms;
  }

  private effectiveIntervalMs(): number {
    return Math.max(this.baseIntervalMs, this.backoffIntervalMs);
  }

  /**
   * Doubles the current effective spacing (capped at MAX_BACKOFF_INTERVAL_MS)
   * in response to an observed provider rate-limit error. `baseIntervalMs` is
   * always > 0 by the time any limiter is reachable via `reportRateLimitHit`
   * (acquireRateLimit only ever constructs/updates one when requestsPerSecond
   * > 0), so there is no need to seed a starting value here.
   */
  reportHit(): RateLimitHitResult {
    const previousIntervalMs = this.effectiveIntervalMs();
    const newIntervalMs = Math.min(MAX_BACKOFF_INTERVAL_MS, previousIntervalMs * 2);
    this.backoffIntervalMs = newIntervalMs;
    return { changed: newIntervalMs !== previousIntervalMs, previousIntervalMs, newIntervalMs };
  }

  /** Resolves when the caller may issue its request. */
  acquire(): Promise<void> {
    const intervalMs = this.effectiveIntervalMs();
    if (intervalMs <= 0) return Promise.resolve();
    const turn = this.tail.then(async () => {
      const now = Date.now();
      const wait = this.nextFreeAt - now;
      this.nextFreeAt = Math.max(now, this.nextFreeAt) + intervalMs;
      if (wait > 0) await sleep(wait);
    });
    // The chain must survive a rejected consumer; acquire() itself never rejects.
    this.tail = turn.catch(() => {});
    return turn;
  }
}

const limiters = new Map<string, RateLimiter>();

/**
 * Acquire a slot for one outbound HTTP request issued by `moduleId`.
 * `requestsPerSecond` of 0 / undefined / non-finite disables limiting
 * (resolves immediately).
 */
export function acquireRateLimit(
  moduleId: string,
  requestsPerSecond: number | undefined,
): Promise<void> {
  if (
    requestsPerSecond === undefined ||
    !Number.isFinite(requestsPerSecond) ||
    requestsPerSecond <= 0
  ) {
    return Promise.resolve();
  }
  const intervalMs = 1000 / requestsPerSecond;
  let limiter = limiters.get(moduleId);
  if (!limiter) {
    limiter = new RateLimiter(intervalMs);
    limiters.set(moduleId, limiter);
  } else {
    limiter.setIntervalMs(intervalMs);
  }
  return limiter.acquire();
}

/**
 * Report an observed rate-limit error from `moduleId`'s provider so its
 * limiter backs off (doubles the effective spacing, capped at a 0.1 req/s
 * floor) for the rest of the run. A no-op — returning an unchanged zero
 * result — if no limiter has been created for `moduleId` yet (defensive only;
 * a limiter is always created before any response, successful or not, can
 * come back).
 */
export function reportRateLimitHit(moduleId: string): RateLimitHitResult {
  const limiter = limiters.get(moduleId);
  if (!limiter) return { changed: false, previousIntervalMs: 0, newIntervalMs: 0 };
  return limiter.reportHit();
}

/** @internal test helper — drops all per-module limiter state. */
export function resetRateLimiters(): void {
  limiters.clear();
}
