/**
 * A bounded, LRU-evicting map of per-tenant {@link LogEntryPools}.
 *
 * The severity partitioning in `entry-pools.ts` protects `warn`/`error`
 * entries from being evicted by `info` volume. It does not protect one
 * tenant's entries from another's: on a shared process the permanently
 * retained head and the connect-replay budget are allocated across every
 * tenant at once, then filtered per subscriber on read — so whichever tenant
 * logs first claims capacity the others never get back. This wraps the
 * per-severity pools in a per-tenant one so each tenant's head and budget are
 * their own.
 *
 * Deliberately policy-free: it does not know what a tenant is, when
 * partitioning applies, or where the ids come from. The caller decides that.
 */
import {
  LogEntryPools,
  type LogPoolDropCounts,
  type LogPoolOptions,
  type PoolableEntry,
} from './entry-pools.js';

const EMPTY_DROPS: LogPoolDropCounts = { info: 0, priority: 0 };

/**
 * Tenants whose post-eviction loss figures are remembered. Two integers per
 * tenant, so this is bounded far more generously than the pools themselves. A
 * tenant evicted from THIS map reports zero again — an honest limit of a
 * bounded structure, not a bug: the alternative is an unbounded map keyed by
 * attacker-suppliable ids.
 */
const MAX_CARRIED_TENANTS = 1024;

export interface TenantPoolOptions extends LogPoolOptions {
  /** Hard cap on retained tenant pools; the least-recently-pushed is evicted first. */
  maxTenants: number;
}

export class TenantEntryPools<T extends PoolableEntry> {
  private readonly pools = new Map<string, LogEntryPools<T>>();
  /** Losses belonging to tenants whose pool has been evicted; see MAX_CARRIED_TENANTS. */
  private carried = new Map<string, LogPoolDropCounts>();
  private readonly options: TenantPoolOptions;

  constructor(options: TenantPoolOptions) {
    if (options.maxTenants < 1) {
      throw new RangeError(
        `TenantEntryPools: maxTenants must be at least 1, got ${options.maxTenants}`,
      );
    }
    this.options = options;
  }

  push(tenantId: string, entry: T): void {
    let pool = this.pools.get(tenantId);
    if (pool === undefined) {
      // Evict BEFORE inserting so the map never exceeds the cap even briefly.
      while (this.pools.size >= this.options.maxTenants) {
        const oldest = this.pools.keys().next();
        if (oldest.done === true) break;
        const evicted = this.pools.get(oldest.value);
        if (evicted !== undefined) this.carry(oldest.value, evicted);
        this.pools.delete(oldest.value);
      }
      pool = new LogEntryPools<T>(this.options);
    } else {
      // Re-insert to move this tenant to the most-recent end of the Map's
      // insertion order, which is what makes keys().next() the LRU victim.
      this.pools.delete(tenantId);
    }
    this.pools.set(tenantId, pool);
    pool.push(entry);
  }

  /**
   * Reads never create a pool — a read for an unknown tenant must not evict a
   * real one, and a subscriber must not have to tell "no pool" from "empty
   * pool".
   */
  merged(tenantId: string): T[] {
    return this.pools.get(tenantId)?.merged() ?? [];
  }

  recent(tenantId: string, n?: number): T[] {
    return this.pools.get(tenantId)?.recent(n) ?? [];
  }

  /**
   * Fold a pool's losses into the carried map before it is discarded. BOTH
   * halves count: what it had already evicted, and what it was still holding —
   * the tenant can no longer see either, and the held half is usually the
   * larger. Without this the tenant's next connect gets an empty replay AND a
   * marker asserting nothing was lost, which is the one case where the marker
   * actively claims completeness while being maximally wrong.
   */
  private carry(tenantId: string, pool: LogEntryPools<T>): void {
    const dropped = pool.dropped();
    const held = pool.heldCounts();
    const prior = this.carried.get(tenantId) ?? EMPTY_DROPS;
    // Re-insert at the most-recent end so keys().next() is this map's LRU victim too.
    this.carried.delete(tenantId);
    while (this.carried.size >= MAX_CARRIED_TENANTS) {
      const oldest = this.carried.keys().next();
      if (oldest.done === true) break;
      this.carried.delete(oldest.value);
    }
    this.carried.set(tenantId, {
      info: prior.info + dropped.info + held.info,
      priority: prior.priority + dropped.priority + held.priority,
    });
  }

  dropped(tenantId: string): LogPoolDropCounts {
    const live = this.pools.get(tenantId)?.dropped() ?? EMPTY_DROPS;
    const carried = this.carried.get(tenantId) ?? EMPTY_DROPS;
    return { info: live.info + carried.info, priority: live.priority + carried.priority };
  }

  clear(): void {
    this.pools.clear();
    this.carried.clear();
  }

  /** Test seam: how many tenant pools are currently held. */
  size(): number {
    return this.pools.size;
  }
}
