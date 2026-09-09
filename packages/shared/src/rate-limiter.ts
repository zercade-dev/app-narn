/**
 * Minimal client-side rate limiting for outbound provider requests.
 *
 * One limiter per limiter key — the identity that owns the quota being spent:
 * the tenant plus the resolved module instance, supplied by the host (M6's
 * `createWithConfig`), or the bare module id when no host supplies one. So
 * DeepL and an LLM provider never serialize each other, and neither do two
 * tenants: `requestsPerSecond` is a per-tenant setting, so a shared limiter
 * would let whichever tenant acquired last dictate the spacing — and the FIFO
 * order — for all of them. Enforcement is a FIFO min-interval gate:
 * consecutive acquisitions on the same limiter are spaced at least
 * `1000 / rps` ms apart; the first acquisition passes immediately.
 *
 * A limiter also backs off automatically when the caller reports an observed
 * rate-limit error (`reportRateLimitHit`): the effective spacing doubles, on
 * top of whatever the configured rate already demands, capped at a 10s floor.
 * This is independent of the configured rate so a live global-config update
 * (which re-applies the configured value on every acquisition) can't silently
 * erase backoff that was earned by an actual provider rejection.
 *
 * The key space is tenant-derived, so the map is capped at
 * {@link MAX_RATE_LIMITERS} and drops least-recently-used entries — skipping
 * any with an acquisition still queued, so a live gate is never cut loose
 * mid-run. A dropped limiter loses its spacing and any earned backoff, which
 * is what `resetRateLimiters()` already does between runs.
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
  /** Acquisitions issued but not yet scheduled. */
  private pending = 0;

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

  /** True when nothing is waiting on this limiter, i.e. it is safe to drop. */
  isIdle(): boolean {
    return this.pending === 0;
  }

  /** Resolves when the caller may issue its request. */
  acquire(): Promise<void> {
    const intervalMs = this.effectiveIntervalMs();
    if (intervalMs <= 0) return Promise.resolve();
    this.pending++;
    const turn = this.tail.then(async () => {
      const now = Date.now();
      const wait = this.nextFreeAt - now;
      this.nextFreeAt = Math.max(now, this.nextFreeAt) + intervalMs;
      if (wait > 0) await sleep(wait);
      this.pending--;
    });
    // The chain must survive a rejected consumer; acquire() itself never rejects.
    this.tail = turn.catch(() => {});
    return turn;
  }
}

/** Hard cap on retained limiters; the least-recently-used idle one goes first. */
export const MAX_RATE_LIMITERS = 512;

const limiters = new Map<string, RateLimiter>();

/**
 * Drop least-recently-used idle limiters until there is room for one more. A
 * limiter with an acquisition still queued is skipped rather than dropped, so a
 * burst of distinct keys can hold the map briefly above the cap instead of
 * cutting a live gate loose.
 */
function evictIdleLimiters(): void {
  if (limiters.size < MAX_RATE_LIMITERS) return;
  for (const [key, limiter] of limiters) {
    if (limiter.isIdle()) limiters.delete(key);
    if (limiters.size < MAX_RATE_LIMITERS) return;
  }
}

/**
 * Acquire a slot for one outbound HTTP request issued under `limiterKey` (see
 * the file doc: tenant + resolved module instance). `requestsPerSecond` of 0 /
 * undefined / non-finite disables limiting (resolves immediately).
 */
export function acquireRateLimit(
  limiterKey: string,
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
  let limiter = limiters.get(limiterKey);
  if (!limiter) {
    evictIdleLimiters();
    limiter = new RateLimiter(intervalMs);
  } else {
    limiter.setIntervalMs(intervalMs);
    // Re-inserted below, so insertion order stays the eviction order.
    limiters.delete(limiterKey);
  }
  limiters.set(limiterKey, limiter);
  return limiter.acquire();
}

/**
 * Report an observed rate-limit error from the provider behind `limiterKey` so
 * its limiter backs off (doubles the effective spacing, capped at a 0.1 req/s
 * floor) for the rest of the run. A no-op — returning an unchanged zero
 * result — if no limiter exists for `limiterKey` (defensive only; a limiter is
 * always created before any response, successful or not, can come back).
 */
export function reportRateLimitHit(limiterKey: string): RateLimitHitResult {
  const limiter = limiters.get(limiterKey);
  if (!limiter) return { changed: false, previousIntervalMs: 0, newIntervalMs: 0 };
  return limiter.reportHit();
}

/** @internal test helper — drops all limiter state. */
export function resetRateLimiters(): void {
  limiters.clear();
}

/** @internal test seam — how many limiters are currently retained. */
export function rateLimiterCount(): number {
  return limiters.size;
}
