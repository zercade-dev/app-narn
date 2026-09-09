/**
 * Minimal client-side concurrency limiting for outbound provider requests.
 *
 * One pool per limiter key — the identity that owns the quota being spent: the
 * tenant plus the resolved module instance, supplied by the host (M6's
 * `createWithConfig`), or the bare module id when no host supplies one —
 * capping how many requests that instance may have in flight at once. A local
 * generic-ai endpoint and a cloud provider therefore never share a pool, and
 * neither do two instances of one base module: they carry their own
 * `maxParallel`, and since every acquire re-applies its own ceiling to the pool
 * it lands in, a shared pool would let the wider instance's ceiling admit the
 * narrower one's queued callers. Where {@link RateLimiter} spaces consecutive
 * requests in time, this bounds how many run *simultaneously* — the two
 * compose.
 *
 * Acquisition is FIFO: when no permit is free the caller queues and is resumed
 * in order as permits are released.
 *
 * The key space is tenant-derived, so the map is capped at
 * {@link MAX_CONCURRENCY_LIMITERS} and drops least-recently-used entries —
 * skipping any that still has a permit out or a caller queued.
 */

/** A counting semaphore with a mutable permit ceiling. */
class Semaphore {
  /** Permits currently available (may go briefly negative if max is lowered). */
  private available: number;
  /** Configured ceiling; `available` trends toward this as work drains. */
  private max: number;
  /** FIFO waiters parked until a permit frees up. */
  private readonly waiters: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
    this.available = max;
  }

  /** Adjust the ceiling (the config value may change between runs). */
  setMax(max: number): void {
    const delta = max - this.max;
    this.max = max;
    this.available += delta;
    this.pump();
  }

  /** True when no permit is out and nobody is queued, i.e. safe to drop. */
  isIdle(): boolean {
    return this.waiters.length === 0 && this.available >= this.max;
  }

  /** Resolves with a release fn once a permit is held by the caller. */
  acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      this.waiters.push(() => resolve(this.makeRelease()));
      this.pump();
    });
  }

  /** Wake queued waiters while permits remain. */
  private pump(): void {
    while (this.available > 0 && this.waiters.length > 0) {
      this.available--;
      const wake = this.waiters.shift()!;
      wake();
    }
  }

  /** A release fn that returns its permit exactly once. */
  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.available++;
      this.pump();
    };
  }
}

/** Hard cap on retained pools; the least-recently-used idle one goes first. */
export const MAX_CONCURRENCY_LIMITERS = 512;

const semaphores = new Map<string, Semaphore>();

const NO_OP = (): void => {};

/**
 * Drop least-recently-used idle pools until there is room for one more. A pool
 * with a permit out or a caller queued is skipped rather than dropped, so a
 * burst of distinct keys can hold the map briefly above the cap instead of
 * cutting a live gate loose.
 */
function evictIdleSemaphores(): void {
  if (semaphores.size < MAX_CONCURRENCY_LIMITERS) return;
  for (const [key, semaphore] of semaphores) {
    if (semaphore.isIdle()) semaphores.delete(key);
    if (semaphores.size < MAX_CONCURRENCY_LIMITERS) return;
  }
}

/**
 * Acquire a slot for one in-flight request issued under `limiterKey` (see the
 * file doc: tenant + resolved module instance). `maxParallel` of undefined /
 * non-finite / <= 0 disables limiting (resolves immediately with a no-op
 * release). Otherwise resolves once fewer than `maxParallel` requests for this
 * key are in flight; call the returned fn to release the slot.
 */
export function acquireConcurrencySlot(
  limiterKey: string,
  maxParallel: number | undefined,
): Promise<() => void> {
  if (maxParallel === undefined || !Number.isFinite(maxParallel) || maxParallel <= 0) {
    return Promise.resolve(NO_OP);
  }
  const max = Math.floor(maxParallel);
  let semaphore = semaphores.get(limiterKey);
  if (!semaphore) {
    evictIdleSemaphores();
    semaphore = new Semaphore(max);
  } else {
    semaphore.setMax(max);
    // Re-inserted below, so insertion order stays the eviction order.
    semaphores.delete(limiterKey);
  }
  semaphores.set(limiterKey, semaphore);
  return semaphore.acquire();
}

/** @internal test helper — drops all semaphore state. */
export function resetConcurrencyLimiters(): void {
  semaphores.clear();
}

/** @internal test seam — how many pools are currently retained. */
export function concurrencyLimiterCount(): number {
  return semaphores.size;
}
