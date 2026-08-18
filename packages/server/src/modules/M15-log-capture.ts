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
}

const LOCAL_SCOPE = '';

/**
 * Opt-in full-fidelity retention beside the ring pools: while a capture is
 * active every entry that reaches ConsoleLogger.store() is also appended
 * here, bounded by entry and byte caps. Drop-NEWEST on cap: the ring pools
 * already retain a run's tail, capture preserves it from the start, so
 * head (capture) + tail (pools) bound the loss to a visible mid-run window
 * (droppedCount). Local mode keeps one buffer; cloud keys buffers by tenant
 * with a small concurrent-capture slot limit so tenants cannot exhaust
 * process memory.
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
      return 'slots-exhausted';
    }
    const fresh: CaptureState = {
      active: true,
      startedAt: Date.now(),
      entries: [],
      bytes: 0,
      droppedCount: 0,
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
    const entryCap = this.caps.isCloud() ? this.caps.tenantEntryCap : this.caps.localEntryCap;
    const byteCap = this.caps.isCloud() ? this.caps.tenantByteCap : this.caps.localByteCap;
    const size = JSON.stringify(entry).length;
    if (state.entries.length >= entryCap || state.bytes + size > byteCap) {
      state.droppedCount++;
      return;
    }
    state.entries.push(entry);
    state.bytes += size;
  }

  reset(): void {
    this.captures.clear();
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
