/**
 * Minimal client-side concurrency limiting for outbound provider requests.
 *
 * One limiter per module id (so e.g. a local generic-ai endpoint and a cloud
 * provider never share a slot pool), capping how many requests that module may
 * have in flight at once. Where {@link RateLimiter} spaces consecutive requests
 * in time, this bounds how many run *simultaneously* — the two compose.
 *
 * Acquisition is FIFO: when no permit is free the caller queues and is resumed
 * in order as permits are released.
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

const semaphores = new Map<string, Semaphore>();

const NO_OP = (): void => {};

/**
 * Acquire a slot for one in-flight request issued by `moduleId`. `maxParallel`
 * of undefined / non-finite / <= 0 disables limiting (resolves immediately with
 * a no-op release). Otherwise resolves once fewer than `maxParallel` requests
 * for this module are in flight; call the returned fn to release the slot.
 */
export function acquireConcurrencySlot(
  moduleId: string,
  maxParallel: number | undefined,
): Promise<() => void> {
  if (maxParallel === undefined || !Number.isFinite(maxParallel) || maxParallel <= 0) {
    return Promise.resolve(NO_OP);
  }
  const max = Math.floor(maxParallel);
  let semaphore = semaphores.get(moduleId);
  if (!semaphore) {
    semaphore = new Semaphore(max);
    semaphores.set(moduleId, semaphore);
  } else {
    semaphore.setMax(max);
  }
  return semaphore.acquire();
}

/** @internal test helper — drops all per-module semaphore state. */
export function resetConcurrencyLimiters(): void {
  semaphores.clear();
}
