import type { LogEntry } from './M15-console-logger.js';

export interface CaptureStatus {
  active: boolean;
  startedAt: number | null;
  entryCount: number;
  droppedCount: number;
  bytes: number;
}

export interface LogCaptureCaps {
  localEntryCap: number;
  localByteCap: number;
  tenantEntryCap: number;
  tenantByteCap: number;
  maxTenantCaptures: number;
  isCloud: () => boolean;
}

export const DEFAULT_CAPTURE_CAPS: Omit<LogCaptureCaps, 'isCloud'> = {
  localEntryCap: 100_000,
  localByteCap: 256 * 1024 * 1024,
  tenantEntryCap: 25_000,
  tenantByteCap: 32 * 1024 * 1024,
  maxTenantCaptures: 4,
};

interface CaptureState {
  active: boolean;
  startedAt: number;
  entries: LogEntry[];
  bytes: number;
  droppedCount: number;
  /**
   * Latched true on the FIRST drop (either cap) so the buffer stops
   * appending for good rather than admitting a later, smaller entry that
   * happens to fit under the byte cap — that would leave a silent
   * mid-stream hole (kept, dropped, kept) that `droppedCount` alone can't
   * locate. `start()` always creates a fresh `CaptureState`, so this resets
   * with every new capture.
   */
  capped: boolean;
}

const LOCAL_SCOPE = '';

/**
 * Opt-in full-fidelity retention beside the ring pools: while a capture is
 * active every entry that reaches ConsoleLogger.store() is also appended
 * here, bounded by entry and byte caps. Drop-NEWEST on cap: the FIRST entry
 * that would exceed either cap latches the capture as `capped` and stops
 * appending for good — every entry after that is counted in `droppedCount`
 * but never admitted, even a later one small enough to fit under the byte
 * cap, so the retained entries stay a contiguous prefix with no silent
 * mid-stream holes. The ring pools already retain a run's tail, capture
 * preserves it from the start, so head (capture) + tail (pools) bound the
 * loss to a visible mid-run window. Local mode keeps one buffer; cloud keys
 * buffers by tenant
 * with a small concurrent-capture slot limit so tenants cannot exhaust
 * process memory — once all slots are held, `start()` for a new tenant
 * evicts the oldest STOPPED (inactive) capture to free a slot, and only
 * reports `'slots-exhausted'` when every held slot is still active.
 */
export class LogCaptureBuffer {
  private readonly captures = new Map<string, CaptureState>();
  constructor(private readonly caps: LogCaptureCaps) {}

  private scopeKey(tenantId?: string): string | undefined {
    if (!this.caps.isCloud()) return LOCAL_SCOPE;
    return tenantId; // undefined → no scope in cloud
  }

  start(tenantId?: string): CaptureStatus | 'slots-exhausted' {
    const key = this.scopeKey(tenantId);
    if (key === undefined) return 'slots-exhausted';
    const existing = this.captures.get(key);
    if (existing?.active) return this.toStatus(existing);
    if (
      this.caps.isCloud() &&
      !this.captures.has(key) &&
      this.captures.size >= this.caps.maxTenantCaptures
    ) {
      const evictKey = this.oldestInactiveKey();
      if (evictKey === undefined) return 'slots-exhausted';
      this.captures.delete(evictKey);
    }
    const fresh: CaptureState = {
      active: true,
      startedAt: Date.now(),
      entries: [],
      bytes: 0,
      droppedCount: 0,
      capped: false,
    };
    this.captures.set(key, fresh);
    return this.toStatus(fresh);
  }

  stop(tenantId?: string): CaptureStatus {
    const key = this.scopeKey(tenantId);
    const state = key === undefined ? undefined : this.captures.get(key);
    if (!state) return this.toStatus(undefined);
    state.active = false;
    return this.toStatus(state);
  }

  status(tenantId?: string): CaptureStatus {
    const key = this.scopeKey(tenantId);
    return this.toStatus(key === undefined ? undefined : this.captures.get(key));
  }

  entriesFor(tenantId?: string): readonly LogEntry[] {
    const key = this.scopeKey(tenantId);
    return (key === undefined ? undefined : this.captures.get(key))?.entries ?? [];
  }

  /** Called from ConsoleLogger.store() for every entry, active or not. */
  record(entry: LogEntry): void {
    const key = this.caps.isCloud() ? entry.tenantId : LOCAL_SCOPE;
    if (key === undefined) return;
    const state = this.captures.get(key);
    if (!state?.active) return;
    if (state.capped) {
      state.droppedCount++;
      return;
    }
    const entryCap = this.caps.isCloud() ? this.caps.tenantEntryCap : this.caps.localEntryCap;
    const byteCap = this.caps.isCloud() ? this.caps.tenantByteCap : this.caps.localByteCap;
    const size = JSON.stringify(entry).length;
    if (state.entries.length >= entryCap || state.bytes + size > byteCap) {
      state.capped = true;
      state.droppedCount++;
      return;
    }
    state.entries.push(entry);
    state.bytes += size;
  }

  reset(): void {
    this.captures.clear();
  }

  /**
   * The key of the oldest (smallest `startedAt`) currently-stopped capture,
   * or undefined when every held slot is still active. Map iteration order
   * is insertion order, and the strict `<` comparison below keeps the FIRST
   * key seen on a `startedAt` tie, so ties resolve to the earlier-started
   * (earlier-inserted) capture deterministically.
   */
  private oldestInactiveKey(): string | undefined {
    let bestKey: string | undefined;
    let bestStartedAt = Infinity;
    for (const [key, state] of this.captures) {
      if (!state.active && state.startedAt < bestStartedAt) {
        bestKey = key;
        bestStartedAt = state.startedAt;
      }
    }
    return bestKey;
  }

  private toStatus(state: CaptureState | undefined): CaptureStatus {
    if (!state) return { active: false, startedAt: null, entryCount: 0, droppedCount: 0, bytes: 0 };
    return {
      active: state.active,
      startedAt: state.startedAt,
      entryCount: state.entries.length,
      droppedCount: state.droppedCount,
      bytes: state.bytes,
    };
  }
}
