import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { sanitizeLogObject } from './M16-credential-store.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';
import { isLogFormatJson } from '../config/env.js';
// Deliberately the leaf `cloud-mode.js` seam and NOT `identity/registry.js`:
// registry pulls in the local vault store, which reaches `utils/fs.ts`, which
// imports this file — and that cycle breaks `vi.mock` for every suite that
// transitively loads M15. See cloud-mode.ts.
import { isCloudMode } from '../identity/cloud-mode.js';
import {
  LogEntryPools,
  TenantEntryPools,
  isPriorityLevel,
  type LogPoolDropCounts,
} from '@zercade-dev/narn-shared';

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
  /**
   * The tenant whose request emitted this entry, captured from the ambient
   * tenant context at log time. Undefined in open-core / outside a tenant
   * context. Used cloud-side to scope the /api/logs read routes to one tenant.
   */
  tenantId?: string;
}

// Map each log level to the NAME of the console method to mirror through.
// Resolved off the live `console` object at call time (not snapshotted as a
// function reference here) so a test's `vi.spyOn(console, 'log')` intercepts
// the mirror call — and so the choice of method follows any console wrapper a
// host installs after this module loads.
const CONSOLE_METHOD_BY_LEVEL: Record<LogEntry['level'], 'log' | 'warn' | 'error'> = {
  error: 'error',
  warn: 'warn',
  info: 'log',
  debug: 'log',
};

// Cap on individual string values in a broadcast LogEntry. Over-long values are
// almost always raw subprocess stderr or stack dumps (e.g. the copilot CLI's
// multi-KB crash output that arrives inside err.message) — useful to a developer
// in the server console, but a flood in the UI log stream. We clip the
// broadcast/history entry so the SSE log can never carry a multi-KB blob,
// independent of any verbose setting; the console mirror keeps the full text.
const MAX_LOG_VALUE_CHARS = 1000;

// Cap for the browser-only channel (see `ConsoleLogger.browser`). Entries there
// exist to carry diagnostic payloads — an AI system prompt, a conversation —
// that are useless clipped at MAX_LOG_VALUE_CHARS, and they never reach the
// console mirror, so the server-console flood the 1000-char cap guards against
// cannot happen. Still bounded, so the 1000-entry ring buffer stays memory-safe.
const MAX_BROWSER_LOG_VALUE_CHARS = 20_000;

function clipLogString(value: string, max: number = MAX_LOG_VALUE_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… [truncated ${value.length - max} chars]`;
}

// Depth cap for clipLogValue's recursive walk — mirrors M16's sanitizeLogObject
// cap. Belt-and-braces: by the time metadata reaches clipLogValue it has
// already passed through sanitizeLogObject (which resolves cycles/Error/Date
// itself), but this function has no such guarantee if ever called directly.
const MAX_CLIP_DEPTH = 20;

/**
 * Recursively clip long string leaves in an (already credential-sanitized)
 * metadata value. `seen`/`depth` are internal-only (defaulted): a WeakSet
 * cycle guard (added before recursing, removed once a container returns)
 * against a circular value — which would otherwise recurse until a
 * `RangeError` escapes the log call — plus a depth cap backstop. Error/Date
 * have no enumerable own properties, so without the explicit branches below
 * they would collapse to `{}`.
 */
function clipLogValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
  max: number = MAX_LOG_VALUE_CHARS,
): unknown {
  if (typeof value === 'string') return clipLogString(value, max);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: clipLogString(value.message, max),
      ...(value.stack ? { stack: clipLogString(value.stack, max) } : {}),
    };
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_CLIP_DEPTH) return '[Truncated: max depth exceeded]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((v) => clipLogValue(v, seen, depth + 1, max));
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = clipLogValue(v, seen, depth + 1, max);
    return out;
  } finally {
    seen.delete(value);
  }
}

// Number of most-recent info entries carried alongside the FULL priority pool
// in getConnectHistory() (the SSE connect replay). Bounded independently of
// the info pool's own 1000-entry capacity so a freshly (re)connected client
// gets a reasonably small initial payload — 670+ reconnects/hour have been
// observed in practice (see the frontend logger-store's own comment), and
// replaying the whole 1000-entry info pool on every one of those would be
// wasteful when the priority pool is what a reconnect actually needs intact.
const CONNECT_HISTORY_INFO_COUNT = 200;

class ConsoleLogger extends EventEmitter {
  // Severity-partitioned ring buffer (shared `entry-pools.ts`): a `warn`/
  // `error` entry gets its own capacity plus permanent head retention, so a
  // flood of routine `info` activity during a large run can never evict it.
  private readonly pools = new LogEntryPools<LogEntry>({
    infoCapacity: 1000,
    priorityCapacity: 1000,
    priorityHeadCapacity: 50,
  });

  // Cloud capacities are per TENANT and deliberately smaller than local's
  // single shared pool: a tenant's own 250 info entries beat their diluted
  // share of a shared 1000 in every realistic multi-tenant case, and
  // 64 x 500 bounds worst-case retention to something one process can hold.
  // 64 matches setMaxListeners(64) below — the cap on concurrent log streams,
  // so the most tenants that can be actively reading at once.
  private readonly tenantPools = new TenantEntryPools<LogEntry>({
    infoCapacity: 250,
    priorityCapacity: 250,
    priorityHeadCapacity: 25,
    maxTenants: 64,
  });

  /**
   * Cloud partitions retention by tenant; local keeps the single shared pool.
   * An entry with no tenant is NOT pooled in cloud: `visibleTo()` in
   * routes/logs.ts requires an exact tenant match, so startup logs, sweep ticks
   * and background engine ticks already reach neither the SSE replay nor
   * /api/logs/history there — they stay console-only, and pooling them would
   * only consume capacity nobody can read. Local pools everything, because
   * there `visibleTo()` is always true and those entries are most of the panel.
   * isCloudMode() is read per call: this class is constructed at module load,
   * before cloud mode is necessarily resolved.
   */
  private store(entry: LogEntry): void {
    if (!isCloudMode()) {
      this.pools.push(entry);
      return;
    }
    if (entry.tenantId === undefined) return;
    this.tenantPools.push(entry.tenantId, entry);
  }

  log(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): void {
    // Defensive credential scrubbing — caller still owns primary masking.
    // M16's `sanitizeLogObject` is the single redaction layer of record (it
    // masks by stored-credential value-hash and by `CREDENTIAL_KEY_PATTERN`).
    const safeMetadata = metadata ? sanitizeLogObject(metadata) : undefined;
    // Clip long string leaves for the broadcast/history entry (SSE log + UI) so a
    // multi-KB subprocess stderr/stack can never flood it. The console mirror
    // below still receives the full, unclipped text for server-side debugging.
    const entryMetadata = safeMetadata
      ? (clipLogValue(safeMetadata) as Record<string, unknown>)
      : undefined;
    const entry: LogEntry = {
      id: randomUUID(),
      level,
      message: clipLogString(message),
      metadata: entryMetadata,
      timestamp: Date.now(),
      // Stamp the emitting tenant (cloud mode) so the /api/logs read routes can
      // scope to one tenant. Null-safe: undefined in open-core / outside a tenant.
      tenantId: getCurrentTenant()?.userId,
    };

    // Emission is unconditional and must NOT depend on push()'s return value
    // (it only reports false for a duplicate id, which live logging never
    // produces — every entry gets a fresh randomUUID() above). Gating emit()
    // on it would silently drop a live log line the moment ids ever collided.
    this.store(entry);
    this.emit('log:entry', entry);

    // Mirror to Node.js console — never log raw API keys from metadata.
    // LOG_FORMAT=json emits one structured JSON line per entry (for log
    // shippers); unset keeps the human-readable text format. sanitizeLogObject
    // has already scrubbed safeMetadata in both modes.
    const consoleFn = console[CONSOLE_METHOD_BY_LEVEL[level]];
    if (isLogFormatJson()) {
      consoleFn(
        JSON.stringify({
          timestamp: new Date(entry.timestamp).toISOString(),
          level,
          message,
          ...(safeMetadata && Object.keys(safeMetadata).length > 0
            ? { metadata: safeMetadata }
            : {}),
        }),
      );
    } else {
      const metaSuffix =
        safeMetadata && Object.keys(safeMetadata).length > 0
          ? ` ${JSON.stringify(safeMetadata)}`
          : '';
      consoleFn(`[${level.toUpperCase()}] ${message}${metaSuffix}`);
    }
  }

  /**
   * Emit an entry to the SSE log stream + history ONLY — no console mirror, so
   * nothing reaches container stdout.
   *
   * Intended for per-tenant diagnostic detail (AI prompts, per-turn timings)
   * that would be both a privacy problem and a volume problem in shared
   * operator logs. The `/api/logs` read surfaces filter the stream by the
   * `tenantId` stamped here, so an entry reaches only the tenant whose request
   * produced it; container stdout has no equivalent scoping. Redaction is
   * unchanged — `sanitizeLogObject` still runs — and long string leaves are
   * clipped at the higher {@link MAX_BROWSER_LOG_VALUE_CHARS} so a prompt
   * survives intact instead of being cut at 1000 chars.
   */
  browser(level: LogEntry['level'], message: string, metadata?: Record<string, unknown>): void {
    const safeMetadata = metadata ? sanitizeLogObject(metadata) : undefined;
    const entry: LogEntry = {
      id: randomUUID(),
      level,
      message: clipLogString(message, MAX_BROWSER_LOG_VALUE_CHARS),
      metadata: safeMetadata
        ? (clipLogValue(safeMetadata, new WeakSet(), 0, MAX_BROWSER_LOG_VALUE_CHARS) as Record<
            string,
            unknown
          >)
        : undefined,
      timestamp: Date.now(),
      tenantId: getCurrentTenant()?.userId,
    };

    // See the identical comment in log() above — emission stays unconditional.
    this.store(entry);
    this.emit('log:entry', entry);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata);
  }

  /**
   * The newest `n` entries, chronological (oldest first). All entries when
   * `n` is omitted. `n`'s sign is ignored (matches the pre-pools contract,
   * which used `Math.abs(n)`) — `n` mostly comes from an untrusted `?n=`
   * query param on `GET /api/logs/history`, and a negative value there must
   * not turn into an out-of-range slice that returns nothing. A count of
   * exactly `0` also means "everything", matching the old
   * `buffer.slice(-Math.abs(0))` — `slice`'s start arg treats `-0` as
   * non-negative, so `slice(-0)` was `slice(0)`, the whole buffer.
   * `LogEntryPools.recent(0)` has no such special case (it slices to
   * `all.length - 0`, i.e. nothing), so `0` is normalized to `undefined`
   * here rather than passed straight through (`Math.abs(0) || undefined` is
   * `undefined`).
   *
   * `tenantId` scopes cloud mode to one tenant's pool; local mode ignores it
   * (one shared pool, `visibleTo()` in routes/logs.ts is always true there).
   * An omitted `tenantId` in cloud mode returns nothing rather than falling
   * back to some other tenant's data.
   */
  getHistory(n?: number, tenantId?: string): LogEntry[] {
    const count = n === undefined ? undefined : Math.abs(n) || undefined;
    if (!isCloudMode()) return this.pools.recent(count);
    return tenantId === undefined ? [] : this.tenantPools.recent(tenantId, count);
  }

  /**
   * The SSE connect-replay payload: the FULL priority pool (every retained
   * `warn`/`error`, including permanently-retained head entries) plus the
   * most recent {@link CONNECT_HISTORY_INFO_COUNT} info entries, merged
   * chronologically. Replaces the old `getHistory(50)` replay, which could
   * silently drop an early error under a flood of routine info activity —
   * the last 50 entries by insertion order were not necessarily the last 50
   * that mattered.
   *
   * `tenantId` scopes cloud mode to one tenant's pool (an omitted id returns
   * nothing); local mode ignores it and always merges the single shared pool.
   */
  getConnectHistory(tenantId?: string): LogEntry[] {
    // Walk pools.merged() ONCE rather than concatenating pools.priority()
    // with a separately-filtered/sliced info list and re-sorting: merged()
    // already carries the pools' own global (timestamp, seq) ordering (see
    // entry-pools.ts), and re-sorting on timestamp alone would collapse that
    // — a priority and an info entry sharing a millisecond would always
    // resolve the tie by concatenation order (priority first) instead of
    // true insertion order. Two passes over the already-sorted list (count,
    // then keep) preserve that ordering exactly and never re-sort.
    const merged = isCloudMode()
      ? tenantId === undefined
        ? []
        : this.tenantPools.merged(tenantId)
      : this.pools.merged();
    const infoCount = merged.reduce((n, entry) => n + (isPriorityLevel(entry.level) ? 0 : 1), 0);
    let infoToSkip = Math.max(0, infoCount - CONNECT_HISTORY_INFO_COUNT);
    const result: LogEntry[] = [];
    for (const entry of merged) {
      if (isPriorityLevel(entry.level)) {
        result.push(entry); // every priority entry is kept
      } else if (infoToSkip > 0) {
        infoToSkip--; // an older info entry beyond the most-recent-200 window
      } else {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Eviction counts since the last `clearBuffer()`, one per pool. `tenantId`
   * scopes cloud mode to one tenant (an omitted id reports zero drops rather
   * than some other tenant's); local mode ignores it.
   */
  droppedCounts(tenantId?: string): LogPoolDropCounts {
    if (!isCloudMode()) return this.pools.dropped();
    return tenantId === undefined ? { info: 0, priority: 0 } : this.tenantPools.dropped(tenantId);
  }

  /**
   * Clears every pool, both modes. No route calls this — the frontend's Clear
   * button is client-side only — so there are no per-tenant clear semantics to
   * define. It exists for tests and for a future ops surface.
   */
  clearBuffer(): void {
    this.pools.clear();
    this.tenantPools.clear();
  }
}

export const logger = new ConsoleLogger();

// Each open `GET /api/logs/stream` SSE connection adds a `log:entry` listener
// (removed on request close). Raise the EventEmitter bound above Node's default
// of 10 so many concurrent log streams don't trip a spurious
// MaxListenersExceededWarning. 64 is an intentional cap, not unbounded growth.
logger.setMaxListeners(64);
