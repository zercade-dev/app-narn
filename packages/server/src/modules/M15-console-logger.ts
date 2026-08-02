import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { sanitizeLogObject } from './M16-credential-store.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';
import { isLogFormatJson } from '../config/env.js';

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

class ConsoleLogger extends EventEmitter {
  private buffer: LogEntry[] = [];
  private readonly MAX_BUFFER = 1000;

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

    this.buffer.push(entry);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer.shift();
    }

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

    this.buffer.push(entry);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer.shift();
    }

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

  getHistory(n?: number): LogEntry[] {
    if (n === undefined) return [...this.buffer];
    return this.buffer.slice(-Math.abs(n));
  }

  clearBuffer(): void {
    this.buffer = [];
  }
}

export const logger = new ConsoleLogger();

// Each open `GET /api/logs/stream` SSE connection adds a `log:entry` listener
// (removed on request close). Raise the EventEmitter bound above Node's default
// of 10 so many concurrent log streams don't trip a spurious
// MaxListenersExceededWarning. 64 is an intentional cap, not unbounded growth.
logger.setMaxListeners(64);
