/**
 * A severity-partitioned ring buffer for log entries, shared by the server's
 * `ConsoleLogger` (M15) and the frontend's `logger-store`. Both keep a
 * bounded in-memory log for a UI panel; without partitioning, a flood of
 * routine `info` activity during a large run evicts the `warn`/`error`
 * entries a user actually needs to see. This class keeps two independent
 * rings — one for `info`/`debug`/etc., one for `warn`/`error` — so priority
 * entries are never evicted by info volume, and additionally protects the
 * FIRST `priorityHeadCapacity` priority entries from eviction at all (the
 * earliest failure in a run is usually the root cause; keep it even after
 * the tail has wrapped many times over).
 *
 * Deliberately generic over `PoolableEntry` rather than importing either
 * concrete `LogEntry` type (server `M15-console-logger.ts` and frontend
 * `logger-store.ts` each declare their own, on purpose — see Slice A's
 * Global Constraints) — both satisfy this structural shape.
 */

/** Minimal shape the pools need; both `LogEntry` definitions satisfy it structurally. */
export interface PoolableEntry {
  id: string;
  level: string;
  timestamp: number;
}

export interface LogPoolOptions {
  infoCapacity: number;
  priorityCapacity: number;
  /** Entries retained permanently at the front of the priority pool. */
  priorityHeadCapacity: number;
}

export interface LogPoolDropCounts {
  info: number;
  priority: number;
}

/** True for the levels that belong in the priority pool. */
export function isPriorityLevel(level: string): boolean {
  return level === 'warn' || level === 'error';
}

/**
 * An entry tagged with its global insertion order. `merged()`/`priority()`
 * sort by `(timestamp, seq)` rather than timestamp alone — the pools store
 * entries in three separate arrays (info / priority head / priority tail),
 * so a plain concatenate-then-stable-sort would only preserve insertion
 * order *within* one array, not across all three. `seq` is the tie-breaker
 * that makes "keep insertion order" true globally, not per-pool.
 */
interface Slot<T> {
  entry: T;
  seq: number;
}

function byTimestampThenSeq<T extends PoolableEntry>(a: Slot<T>, b: Slot<T>): number {
  return a.entry.timestamp - b.entry.timestamp || a.seq - b.seq;
}

export class LogEntryPools<T extends PoolableEntry> {
  private readonly infoCapacity: number;
  private readonly priorityHeadCapacity: number;
  /** Tail capacity of the priority pool (total minus the permanent head). */
  private readonly priorityTailCapacity: number;

  // Plain FIFO ring for non-priority entries.
  private info: Slot<T>[] = [];
  // Permanently-retained front of the priority pool (never evicted).
  private priorityHead: Slot<T>[] = [];
  // FIFO ring for the remainder of the priority pool, once the head is full.
  private priorityTail: Slot<T>[] = [];

  // Ids currently held by EITHER pool, for O(1) dedupe. Freed on eviction.
  private ids = new Set<string>();

  // Monotonic global insertion counter — see Slot above.
  private nextSeq = 0;

  private dropCounts: LogPoolDropCounts = { info: 0, priority: 0 };

  constructor(options: LogPoolOptions) {
    this.infoCapacity = options.infoCapacity;
    this.priorityHeadCapacity = options.priorityHeadCapacity;
    this.priorityTailCapacity = options.priorityCapacity - options.priorityHeadCapacity;
  }

  /** Ignores an entry whose id is already held (SSE replay dedupe). Returns true when stored. */
  push(entry: T): boolean {
    if (this.ids.has(entry.id)) return false;

    const slot: Slot<T> = { entry, seq: this.nextSeq++ };

    if (isPriorityLevel(entry.level)) {
      if (this.priorityHead.length < this.priorityHeadCapacity) {
        this.priorityHead.push(slot);
      } else {
        this.priorityTail.push(slot);
        if (this.priorityTail.length > this.priorityTailCapacity) {
          const evicted = this.priorityTail.shift();
          if (evicted) this.ids.delete(evicted.entry.id);
          this.dropCounts.priority++;
        }
      }
    } else {
      this.info.push(slot);
      if (this.info.length > this.infoCapacity) {
        const evicted = this.info.shift();
        if (evicted) this.ids.delete(evicted.entry.id);
        this.dropCounts.info++;
      }
    }

    this.ids.add(entry.id);
    return true;
  }

  /** All held entries merged into one list ordered by timestamp ascending. */
  merged(): T[] {
    return [...this.info, ...this.priorityHead, ...this.priorityTail]
      .sort(byTimestampThenSeq)
      .map((slot) => slot.entry);
  }

  /** The last `n` merged entries (all of them when `n` is undefined). */
  recent(n?: number): T[] {
    const all = this.merged();
    if (n === undefined) return all;
    return all.slice(Math.max(0, all.length - n));
  }

  /** Only the priority pool, ordered by timestamp ascending. */
  priority(): T[] {
    return [...this.priorityHead, ...this.priorityTail]
      .sort(byTimestampThenSeq)
      .map((slot) => slot.entry);
  }

  dropped(): LogPoolDropCounts {
    return { ...this.dropCounts };
  }

  /**
   * How many entries each side is holding right now. Distinct from
   * {@link dropped}, which counts what has already been evicted: a caller
   * discarding a whole pool loses BOTH figures, and the held count is usually
   * the larger of the two.
   */
  heldCounts(): LogPoolDropCounts {
    return {
      info: this.info.length,
      priority: this.priorityHead.length + this.priorityTail.length,
    };
  }

  clear(): void {
    this.info = [];
    this.priorityHead = [];
    this.priorityTail = [];
    this.ids.clear();
    this.dropCounts = { info: 0, priority: 0 };
  }
}
