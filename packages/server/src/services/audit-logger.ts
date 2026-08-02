import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Request } from 'express';
import { credentialStore, sanitizeLogObject } from '../modules/M16-credential-store.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';
import { getAuditLogDir, getAuditLogRetentionDays } from '../config/env.js';

const LOG_DIR = getAuditLogDir();
const LOG_FILE = path.join(LOG_DIR, 'audit.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

// Age-based retention. Audit entries can carry IP addresses (personal data), so
// the published privacy commitment is "security/diagnostic logs kept ≤ 7 days".
// Size-based rotation (above) bounds DISK USE; this bounds AGE — entries older
// than the window are evicted from BOTH the in-memory ring and disk (rotated
// files AND stale lines in the still-active file, since a low-traffic instance
// may never rotate). Override the window with AUDIT_LOG_RETENTION_DAYS.
const DEFAULT_RETENTION_DAYS = getAuditLogRetentionDays();
const DEFAULT_RETENTION_MS = DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
// Minimum gap between disk sweeps — the in-memory ring is pruned on every log(),
// but rewriting the on-disk file is throttled so a busy instance doesn't rewrite
// it on every event.
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

// Substrings (case-insensitive) that mark a key as sensitive. Shared by the
// key-redaction pass and the `redacted` flag so they never disagree about
// what counts as sensitive.
const SENSITIVE_KEY_PATTERNS = [
  'pin',
  'password',
  'apiKey',
  'api_key',
  'token',
  'secret',
  'credential',
  'credentials',
  'GITHUB_TOKEN',
  'DEEPL_API_KEY',
].map((k) => k.toLowerCase());

function matchesSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * All audit event types, as a readonly tuple so it can back BOTH the
 * `AuditEventType` union (below) and a runtime `z.enum(...)` — a single source
 * of truth for the audit-query validation in routes/logs.ts.
 */
export const AUDIT_EVENT_TYPES = [
  'user.login',
  'user.logout',
  'vault.unlocked',
  'vault.locked',
  'vault.password.changed',
  'credential.updated',
  'project.created',
  'project.deleted',
  'translation.started',
  'translation.completed',
  'translation.failed',
  'file.uploaded',
  'file.downloaded',
  'backup.created',
  'backup.restored',
  'module.config.updated',
  'global.config.updated',
  'user.settings.updated',
  'security.failed-login',
  'security.rate-limited',
  'security.path-traversal-attempt',
  'security.csp-violation',
  'security.csp-violation-error',
  'security.audit-export',
  'security.audit-file-access',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  ip?: string;
  userAgent?: string;
  details: Record<string, unknown>;
  redacted?: boolean;
  /**
   * The tenant whose request produced this audit event, captured from the
   * ambient tenant context at log time. Undefined in open-core / outside a
   * tenant context. Used cloud-side to scope GET /api/logs/audit to one tenant.
   */
  userId?: string;
}

export class AuditLogger {
  private readonly entries: AuditLogEntry[] = [];
  private readonly maxSize: number;
  // Age window after which entries are purged from memory + disk (see constants).
  private readonly retentionMs: number;
  // Wall-clock of the last disk sweep, so purges are throttled (PURGE_INTERVAL_MS).
  private lastPurgeAt = 0;
  // Serializes file writes so rotation stays atomic relative to appends and
  // entries land in append order even when log() is called concurrently.
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: { maxSize?: number; retentionMs?: number } = {}) {
    this.maxSize = options.maxSize || 10000;
    this.retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  }

  public log(
    eventType: AuditEventType,
    details: Record<string, unknown> = {},
    req?: Request,
  ): void {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      eventType,
      ip: req?.ip || req?.socket.remoteAddress,
      userAgent: req?.headers['user-agent'],
      details: this.redactSensitiveData(details),
      redacted: this.hasSensitiveData(details),
      // Stamp the emitting tenant (cloud mode) so GET /api/logs/audit can scope
      // to one tenant. Null-safe: undefined in open-core / outside a tenant.
      userId: getCurrentTenant()?.userId,
    };

    // Push to in-memory storage first (synchronous)
    this.entries.push(entry);

    // Evict entries past the retention window (oldest-first; entries are pushed
    // in timestamp order so the front is always the oldest), then cap by count.
    this.pruneMemory();
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
    }

    // Write to file asynchronously (non-blocking), serialized so rotation and
    // appends never interleave across concurrent log() calls.
    this.writeChain = this.writeChain.then(() => this.writeToFile(entry)).catch(() => {});

    // Periodically sweep aged-out entries from disk (throttled, on the same chain
    // so it never interleaves with an append/rotation).
    this.maybePurgeDisk();
  }

  /** Drop in-memory entries older than the retention window (front = oldest). */
  private pruneMemory(): void {
    const cutoff = Date.now() - this.retentionMs;
    while (this.entries.length > 0 && new Date(this.entries[0].timestamp).getTime() < cutoff) {
      this.entries.shift();
    }
  }

  /** Enqueue a throttled disk sweep onto the write chain. */
  private maybePurgeDisk(): void {
    const now = Date.now();
    if (now - this.lastPurgeAt < PURGE_INTERVAL_MS) {
      return;
    }
    this.lastPurgeAt = now;
    this.writeChain = this.writeChain.then(() => this.purgeExpired()).catch(() => {});
  }

  /**
   * Best-effort age-based disk purge: delete rotated `audit.log.*` files older
   * than the window, and rewrite the active `audit.log` keeping only lines whose
   * entry timestamp is within the window. Public so the retention behaviour can
   * be exercised deterministically in tests; never throws.
   */
  public async purgeExpired(): Promise<void> {
    const cutoff = Date.now() - this.retentionMs;
    try {
      // 1) Rotated history files — drop those last modified before the cutoff.
      const files = await fs.readdir(LOG_DIR).catch(() => [] as string[]);
      for (const f of files) {
        if (!f.startsWith('audit.log.') || f.length <= 10) {
          continue;
        }
        const full = path.join(LOG_DIR, f);
        const stat = await fs.stat(full).catch(() => null);
        if (stat && stat.mtimeMs < cutoff) {
          await fs.unlink(full).catch(() => {});
        }
      }

      // 2) Active file — a low-traffic instance may never rotate, so stale
      //    IP-bearing lines linger here; rewrite keeping only in-window entries.
      const raw = await fs.readFile(LOG_FILE, 'utf8').catch(() => null);
      if (raw !== null) {
        const kept: string[] = [];
        for (const line of raw.split('\n')) {
          if (!line) {
            continue;
          }
          let ts = Date.now(); // unparseable → treat as current (keep, don't lose)
          try {
            ts = new Date((JSON.parse(line) as AuditLogEntry).timestamp).getTime();
          } catch {
            /* keep */
          }
          if (ts >= cutoff) {
            kept.push(line);
          }
        }
        const next = kept.length ? kept.join('\n') + '\n' : '';
        if (next.length !== raw.length) {
          await fs.writeFile(LOG_FILE, next);
        }
      }
    } catch {
      // Retention is best-effort; never let it throw into the write chain.
    }
  }

  private async writeToFile(entry: AuditLogEntry): Promise<void> {
    try {
      await fs.mkdir(LOG_DIR, { recursive: true });

      // Check if rotation is needed
      await this.rotateLogFile();

      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(LOG_FILE, logLine);
    } catch (err) {
      // Log to console as fallback
      console.error('Failed to write audit log:', err);
    }
  }

  private async rotateLogFile(): Promise<void> {
    try {
      const stats = await fs.stat(LOG_FILE).catch(() => null);
      if (stats && stats.size >= MAX_LOG_SIZE) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedName = `${LOG_FILE}.${timestamp}`;
        await fs.rename(LOG_FILE, rotatedName);

        // Clean up old log files
        await this.cleanupOldLogFiles();
      }
    } catch {
      // Ignore rotation errors
    }
  }

  private async cleanupOldLogFiles(): Promise<void> {
    try {
      const files = await fs.readdir(LOG_DIR);
      const logFiles = files
        .filter((f) => f.startsWith('audit.log.') && f.length > 10)
        .sort()
        .slice(0, -MAX_LOG_FILES); // Keep only MAX_LOG_FILES

      for (const file of logFiles) {
        await fs.unlink(path.join(LOG_DIR, file)).catch(() => {});
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  private redactSensitiveData(details: Record<string, unknown>): Record<string, unknown> {
    // The static list cannot know user-defined credential names (e.g. a custom
    // key configured for the generic-ai module), so also redact any key that
    // matches a credential name currently held in the vault, and finish with
    // M16's value-hash sanitizer, which masks credential *values* wherever
    // they appear regardless of key name.
    const vaultKeys = new Set(credentialStore.listAllCredentialKeys().map((k) => k.toLowerCase()));
    // Value-hash masking runs first so the key pass can overwrite its
    // `****`-style masks with the cleaner `[REDACTED]` placeholder.
    return this.redactByKey(sanitizeLogObject(details), vaultKeys);
  }

  private redactByKey(
    details: Record<string, unknown>,
    vaultKeys: ReadonlySet<string>,
  ): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      if (matchesSensitiveKey(key) || vaultKeys.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else if (Array.isArray(value)) {
        redacted[key] = value.map((v) =>
          v && typeof v === 'object' && !Array.isArray(v)
            ? this.redactByKey(v as Record<string, unknown>, vaultKeys)
            : v,
        );
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactByKey(value as Record<string, unknown>, vaultKeys);
      } else {
        redacted[key] = value;
      }
    }
    return redacted;
  }

  private hasSensitiveData(details: Record<string, unknown>): boolean {
    return Object.keys(details).some((key) => matchesSensitiveKey(key));
  }

  public getEntries(
    options: {
      eventType?: AuditEventType;
      startTime?: string;
      endTime?: string;
      limit?: number;
    } = {},
  ): AuditLogEntry[] {
    // Never surface entries past the retention window, even if no log() has run
    // since they aged out.
    const cutoff = Date.now() - this.retentionMs;
    let entries = this.entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);

    if (options.eventType) {
      entries = entries.filter((e) => e.eventType === options.eventType);
    }

    if (options.startTime) {
      const start = new Date(options.startTime).getTime();
      entries = entries.filter((e) => new Date(e.timestamp).getTime() >= start);
    }

    if (options.endTime) {
      const end = new Date(options.endTime).getTime();
      entries = entries.filter((e) => new Date(e.timestamp).getTime() <= end);
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  public clear(): void {
    this.entries.length = 0;
  }

  /**
   * Await every asynchronous file write/purge that log() has enqueued onto the
   * internal write chain. log() fires those in the background and returns
   * synchronously, so a caller that must not leave writes in flight — graceful
   * shutdown, or a test that must not let its writes bleed into the next —
   * awaits this. The chain is reassigned as work is appended, so awaiting the
   * current tail drains everything enqueued so far; nothing more is appended
   * unless log() runs again.
   */
  public async flush(): Promise<void> {
    await this.writeChain;
  }
}

export const auditLogger = new AuditLogger();
