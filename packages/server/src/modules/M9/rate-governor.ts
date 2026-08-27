/**
 * Per-minute rate governor for Freeway dispatch.
 *
 * Freeway's free-tier buckets declare per-minute request and token ceilings
 * that nothing enforced at dispatch time: the planner spent minute headroom on
 * a working copy, and the ledger recorded real spend only at completion. This
 * governor is the runtime half — an in-process permit pool per (tenant,
 * bucket), consulted as an admission gate before a dispatch task takes a queue
 * slot.
 *
 * Per-tenant is a hard invariant, not an optimization. Cloud is BYOK: each
 * tenant spends their own key's allowance, so one tenant's exhausted headroom
 * must never throttle another's.
 *
 * DEPLOY INVARIANT: in-process only — authoritative at exactly ONE server
 * replica, the same footing every other rate limiter in this stack already
 * stands on. The deployment enforces that single-replica contract at boot.
 * Scaling out requires moving all of them to a shared store together.
 */
import { getFreewayTargetUtilization } from '../../config/env.js';

export interface GovernorKey {
  tenantId: string;
  bucketKey: string;
  /** Provider key when this bucket shares an account-wide per-minute pool. */
  poolKey?: string;
}

export interface GovernorSeed {
  /** Declared per-minute request ceiling; absent when the model declares none. */
  rpm?: number;
  /** Declared per-minute token ceiling; absent when the model declares none. */
  tpm?: number;
  /** Declared shared-pool per-minute request ceiling. */
  poolRpm?: number;
  /** Headroom left in the CURRENT window, from the live BucketView. */
  minuteRequests?: number;
  minuteTokens?: number;
  poolMinuteRequests?: number;
  /** Epoch ms at which the current window rolls over. */
  minuteResetAt?: number;
}

interface Allowance {
  /** Declared ceiling this allowance refills to each window. */
  limit: number;
  /** Permits left this window. May go negative via forceAcquire. */
  remaining: number;
}

interface Entry {
  requests?: Allowance;
  tokens?: Allowance;
  windowEndsAt?: number;
}

const MINUTE_MS = 60_000;

function entryKey(key: GovernorKey): string {
  return `${key.tenantId}::${key.bucketKey}`;
}
function poolEntryKey(key: GovernorKey): string | undefined {
  return key.poolKey === undefined ? undefined : `${key.tenantId}::pool::${key.poolKey}`;
}

export class RateGovernor {
  private readonly entries = new Map<string, Entry>();
  private readonly utilization: number;

  constructor(utilization: number) {
    this.utilization = utilization > 0 && utilization <= 1 ? utilization : 0.7;
  }

  /**
   * `next` clamped against `previous` when both fall in the SAME window
   * (`previous`'s window and `next`'s window are the identical instant): a
   * second seed() mid-window (e.g. a later run's `resolveFreewayGroups`
   * starting while an earlier run of the same tenant still has calls in
   * flight) may only LOWER `remaining`, never raise it back up — the ledger
   * that headroom reads from only records at completion, so re-seeding from
   * it mid-window would hand back permits the earlier run has already spent.
   * A genuine window rollover (different window instant, or no `previous`)
   * always takes `next` as-is — that IS the refill.
   */
  private static clampToWindow(
    previous: Allowance | undefined,
    next: Allowance,
    sameWindow: boolean,
  ): Allowance {
    if (!sameWindow || previous === undefined) return next;
    return { limit: next.limit, remaining: Math.min(previous.remaining, next.remaining) };
  }

  /**
   * Install (or replace) the allowance for a bucket from its live BucketView.
   * The CURRENT window gets the view's actual headroom; every later window
   * refills from the declared ceiling, so the governor keeps pacing without a
   * storage read of its own.
   */
  seed(key: GovernorKey, seed: GovernorSeed, now: number): void {
    const share = (n: number): number => Math.floor(n * this.utilization);
    const name = entryKey(key);
    const previous = this.entries.get(name);
    const windowEndsAt =
      seed.rpm !== undefined || seed.tpm !== undefined
        ? (seed.minuteResetAt ?? now + MINUTE_MS)
        : undefined;
    const sameWindow =
      previous?.windowEndsAt !== undefined && previous.windowEndsAt === windowEndsAt;
    const entry: Entry = {};
    if (seed.rpm !== undefined) {
      entry.requests = RateGovernor.clampToWindow(
        previous?.requests,
        { limit: seed.rpm, remaining: share(seed.minuteRequests ?? seed.rpm) },
        sameWindow,
      );
    }
    if (seed.tpm !== undefined) {
      entry.tokens = RateGovernor.clampToWindow(
        previous?.tokens,
        { limit: seed.tpm, remaining: share(seed.minuteTokens ?? seed.tpm) },
        sameWindow,
      );
    }
    if (entry.requests !== undefined || entry.tokens !== undefined) {
      entry.windowEndsAt = windowEndsAt;
    }
    this.entries.set(name, entry);

    const pk = poolEntryKey(key);
    if (pk !== undefined && seed.poolRpm !== undefined) {
      const previousPool = this.entries.get(pk);
      const poolWindowEndsAt = seed.minuteResetAt ?? now + MINUTE_MS;
      const poolSameWindow =
        previousPool?.windowEndsAt !== undefined && previousPool.windowEndsAt === poolWindowEndsAt;
      this.entries.set(pk, {
        requests: RateGovernor.clampToWindow(
          previousPool?.requests,
          {
            limit: seed.poolRpm,
            remaining: share(seed.poolMinuteRequests ?? seed.poolRpm),
          },
          poolSameWindow,
        ),
        windowEndsAt: poolWindowEndsAt,
      });
    }
  }

  /** Roll `entry` forward to the window containing `now`, refilling from its declared ceilings. */
  private rollWindow(entry: Entry, now: number): void {
    if (entry.windowEndsAt === undefined || now < entry.windowEndsAt) return;
    const share = (n: number): number => Math.floor(n * this.utilization);
    // One refill regardless of how many windows elapsed: an idle bucket does
    // not bank permits, and a deficit older than one window is already
    // reflected in the ledger the next seed() reads.
    if (entry.requests) entry.requests.remaining = share(entry.requests.limit);
    if (entry.tokens) entry.tokens.remaining = share(entry.tokens.limit);
    const elapsed = now - entry.windowEndsAt;
    entry.windowEndsAt = now + MINUTE_MS - (elapsed % MINUTE_MS);
  }

  private admits(
    name: string,
    projectedTokens: number,
    now: number,
    requestsOnly: boolean,
  ): boolean {
    const entry = this.entries.get(name);
    if (entry === undefined) return true; // never seeded ⇒ ungoverned
    this.rollWindow(entry, now);
    if (entry.requests !== undefined && entry.requests.remaining < 1) return false;
    if (!requestsOnly && entry.tokens !== undefined && entry.tokens.remaining < projectedTokens) {
      // A single request larger than a whole window's token budget would
      // otherwise never be admissible. Let it through when the window is
      // untouched — it goes into deficit and the next window repays it.
      return entry.tokens.remaining >= Math.floor(entry.tokens.limit * this.utilization);
    }
    return true;
  }

  private take(name: string, projectedTokens: number, requestsOnly: boolean): void {
    const entry = this.entries.get(name);
    if (entry === undefined) return;
    if (entry.requests !== undefined) entry.requests.remaining -= 1;
    if (!requestsOnly && entry.tokens !== undefined) entry.tokens.remaining -= projectedTokens;
  }

  /** Atomic check-and-take across the bucket's own allowance and its shared pool. */
  tryAcquire(key: GovernorKey, projectedTokens: number, now: number): boolean {
    const own = entryKey(key);
    const pool = poolEntryKey(key);
    if (!this.admits(own, projectedTokens, now, false)) return false;
    if (pool !== undefined && !this.admits(pool, 0, now, true)) return false;
    this.take(own, projectedTokens, false);
    if (pool !== undefined) this.take(pool, 0, true);
    return true;
  }

  /**
   * Take permits even into deficit, for a call that is already happening — a
   * failover reroute, a parse-failure split half, a retry. The call spends real
   * provider quota whether or not the governor approved it, so recording the
   * deficit is what stops a reroute-heavy run from silently running at double
   * the intended rate.
   */
  forceAcquire(key: GovernorKey, projectedTokens: number, now: number): void {
    const own = entryKey(key);
    const pool = poolEntryKey(key);
    const entry = this.entries.get(own);
    if (entry !== undefined) this.rollWindow(entry, now);
    this.take(own, projectedTokens, false);
    if (pool !== undefined) {
      const poolEntry = this.entries.get(pool);
      if (poolEntry !== undefined) this.rollWindow(poolEntry, now);
      this.take(pool, 0, true);
    }
  }

  /**
   * Debit `count` additional REQUEST-only permits for calls the provider
   * layer made inside a dispatch this governor already accounted for once —
   * a `splitAndRetry` half or an in-SDK transient retry, invisible to the
   * engine's own "permit spent" bookkeeping since they never reach a
   * separate `translate()` call site. No token debit: the one projection the
   * enclosing dispatch was admitted (or force-acquired) under already covers
   * these, and `release()` reconciles it against real usage regardless of
   * how many requests it took.
   */
  forceAcquireRequests(key: GovernorKey, count: number, now: number): void {
    if (count <= 0) return;
    const own = entryKey(key);
    const pool = poolEntryKey(key);
    const entry = this.entries.get(own);
    if (entry !== undefined) this.rollWindow(entry, now);
    for (let i = 0; i < count; i++) this.take(own, 0, true);
    if (pool !== undefined) {
      const poolEntry = this.entries.get(pool);
      if (poolEntry !== undefined) this.rollWindow(poolEntry, now);
      for (let i = 0; i < count; i++) this.take(pool, 0, true);
    }
  }

  /**
   * Undo an admission that never produced a call: the queue's `tryAcquire`
   * already spent one request permit (own bucket AND its shared pool) plus
   * the full token projection, but a pre-dispatch short-circuit — a
   * TM/glossary/trivial hit that absorbed the whole batch, a park, a block —
   * meant no provider call ever went out. Restores exactly what `tryAcquire`
   * took. Callers must never reach this once a call has actually happened:
   * from that point on the "permit spent" invariant owns the accounting, and
   * refunding on top of it would hand back a permit that really was spent.
   */
  refund(key: GovernorKey, projectedTokens: number): void {
    const own = this.entries.get(entryKey(key));
    if (own !== undefined) {
      if (own.requests !== undefined) own.requests.remaining += 1;
      if (own.tokens !== undefined) own.tokens.remaining += projectedTokens;
    }
    const pk = poolEntryKey(key);
    if (pk !== undefined) {
      const pool = this.entries.get(pk);
      if (pool?.requests !== undefined) pool.requests.remaining += 1;
    }
  }

  /**
   * Mark the call finished. When the real token usage is known it replaces the
   * projection, so the next window's pacing is corrected by this window's
   * reality rather than compounding an estimate.
   */
  release(key: GovernorKey, projectedTokens = 0, actualTokens?: number): void {
    const entry = this.entries.get(entryKey(key));
    if (entry === undefined || actualTokens === undefined || entry.tokens === undefined) return;
    entry.tokens.remaining += projectedTokens - actualTokens;
  }

  /** Soonest window rollover among governed entries, for the queue's re-arm timer. */
  nextRefillAt(now: number): number | undefined {
    let soonest: number | undefined;
    for (const entry of this.entries.values()) {
      if (entry.windowEndsAt === undefined) continue;
      const at = entry.windowEndsAt <= now ? now : entry.windowEndsAt;
      if (soonest === undefined || at < soonest) soonest = at;
    }
    return soonest;
  }

  /**
   * `key`'s OWN next window rollover — never the process-wide soonest that
   * {@link nextRefillAt} reports. That one mixes in every other bucket AND
   * every other tenant's windows, which is both the wrong number for a
   * detail line naming `key`'s bucket and, per-tenant being a hard invariant
   * here, a cross-tenant leak in cloud. Undefined when `key` was never
   * seeded (ungoverned) or has no `windowEndsAt` of its own.
   */
  nextRefillAtFor(key: GovernorKey, now: number): number | undefined {
    const entry = this.entries.get(entryKey(key));
    if (entry?.windowEndsAt === undefined) return undefined;
    return entry.windowEndsAt <= now ? now : entry.windowEndsAt;
  }
}

export const rateGovernor = new RateGovernor(Number.parseFloat(getFreewayTargetUtilization()));
