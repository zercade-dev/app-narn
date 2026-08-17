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

export interface TenantPoolOptions extends LogPoolOptions {
  /** Hard cap on retained tenant pools; the least-recently-pushed is evicted first. */
  maxTenants: number;
}

export class TenantEntryPools<T extends PoolableEntry> {
  private readonly pools = new Map<string, LogEntryPools<T>>();
  private readonly options: TenantPoolOptions;

  constructor(options: TenantPoolOptions) {
    this.options = options;
  }

  push(tenantId: string, entry: T): void {
    let pool = this.pools.get(tenantId);
    if (pool === undefined) {
      // Evict BEFORE inserting so the map never exceeds the cap even briefly.
      while (this.pools.size >= this.options.maxTenants) {
        const oldest = this.pools.keys().next();
        if (oldest.done === true) break;
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

  dropped(tenantId: string): LogPoolDropCounts {
    return this.pools.get(tenantId)?.dropped() ?? { ...EMPTY_DROPS };
  }

  clear(): void {
    this.pools.clear();
  }

  /** Test seam: how many tenant pools are currently held. */
  size(): number {
    return this.pools.size;
  }
}
