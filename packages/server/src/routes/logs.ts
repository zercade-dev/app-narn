import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger, type LogEntry } from '../modules/M15-console-logger.js';
import { asyncHandler, setupSSE } from '../http/index.js';
import {
  runEvents,
  isTerminalRunStatus,
  RUN_PROGRESS_THROTTLE_MS,
  type RunProgressEvent,
} from '../http/run-events.js';
import {
  auditLogger,
  AUDIT_EVENT_TYPES,
  type AuditEventType,
  type AuditLogEntry,
} from '../services/audit-logger.js';
import { getSessionId } from '../middleware/session.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { isCloudMode } from '../identity/registry.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getCorsOrigin, getAuditLogDir } from '../config/env.js';

export const logsRouter: Router = Router();

const ALLOWED_ORIGIN = getCorsOrigin();
const LOG_DIR = getAuditLogDir();

/**
 * Upper bound on the audit GET `limit` — large enough for any legitimate UI
 * page, small enough to keep an untrusted `limit` from forcing an unbounded
 * slice/serialize.
 */
const MAX_AUDIT_LIMIT = 10_000;

/**
 * Shared limiter for the three audit routes that touch the log directory —
 * writing an export, listing the directory, and streaming a file back. Each is
 * driven by a human clicking a button, so 30/min per bucket (tenant in cloud
 * mode, else client IP) is far above any real use while keeping a scripted
 * caller from turning the export route into an unbounded disk writer.
 */
const auditFileRateLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

/** A time-window bound: any string `new Date(...)` can parse (ISO is the norm). */
const auditTimeString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'Invalid timestamp' });

/**
 * Shared filter fields for both audit-query surfaces. `eventType` is bounded to
 * the known event-type enum; the time window must be a parseable date string.
 * Extra fields are stripped (zod default), matching validateBody's strip parse.
 */
const auditFilterSchema = z.object({
  eventType: z.enum(AUDIT_EVENT_TYPES).optional(),
  startTime: auditTimeString.optional(),
  endTime: auditTimeString.optional(),
});

/**
 * GET /api/logs/audit query schema: the shared filter plus a bounded `limit`
 * (query strings arrive as text, so coerce then bound). The export POST does
 * NOT accept `limit` (it reads all matching entries), so it uses the bare
 * {@link auditFilterSchema}.
 */
const auditQuerySchema = auditFilterSchema.extend({
  limit: z.coerce.number().int().positive().max(MAX_AUDIT_LIMIT).optional(),
});

/**
 * Validates that an untrusted filename segment is safe to join under LOG_DIR.
 *
 * The check operates on the raw filename (not the already-joined absolute path):
 * it rejects empty/traversal/absolute segments and then confirms the resolved
 * `LOG_DIR/<filename>` stays within `LOG_DIR`. Validating the joined path would
 * wrongly fail whenever `AUDIT_LOG_DIR` is itself an absolute directory.
 */
function validateLogFilename(filename: string): boolean {
  if (!filename || filename.includes('..') || filename.includes('/') || path.isAbsolute(filename)) {
    return false;
  }

  const logDirResolved = path.resolve(LOG_DIR);
  const resolvedPath = path.resolve(LOG_DIR, filename);
  return resolvedPath === logDirResolved || resolvedPath.startsWith(logDirResolved + path.sep);
}

/**
 * True for a rotated audit-log file (`audit.log.<timestamp>`). The active log is
 * always `audit.log`; rotation renames it to `audit.log.<timestamp>` (see
 * audit-logger.ts). Single predicate shared by the file-listing route and the
 * export reader so both agree on exactly which files count as rotated logs.
 */
function isRotatedAuditLog(name: string): boolean {
  return name.startsWith('audit.log.') && name.length > 'audit.log.'.length;
}

/**
 * Build the `auditLogger.getEntries` filter from an untrusted source object
 * (a query string or a request body), copying only the present
 * `eventType`/`startTime`/`endTime` fields. Shared by the audit GET and the
 * export POST so both filter identically. `limit` is intentionally NOT handled
 * here — only the GET route accepts it (and parses it as an int).
 */
function buildAuditQueryOptions(
  src: Record<string, unknown>,
): NonNullable<Parameters<typeof auditLogger.getEntries>[0]> {
  const options: NonNullable<Parameters<typeof auditLogger.getEntries>[0]> = {};
  if (src['eventType']) options.eventType = src['eventType'] as AuditEventType;
  if (src['startTime']) options.startTime = src['startTime'] as string;
  if (src['endTime']) options.endTime = src['endTime'] as string;
  return options;
}

/**
 * Express handler that 404s the on-disk audit-FILE routes when running in cloud
 * mode. Those files (`audit.log.<timestamp>` rotations + `audit-export-*.json`)
 * AGGREGATE ALL TENANTS historically and cannot be retroactively per-tenant
 * filtered, so they are operator-only artifacts read server-side — not a tenant
 * feature. Returns 404 (not 403) so the routes are simply absent to a tenant.
 * In open-core (`!isCloudMode()`) this is a transparent pass-through, leaving
 * the routes byte-identical to today.
 */
function blockAuditFilesInCloud(_req: Request, res: Response, next: NextFunction): void {
  if (isCloudMode()) {
    res.status(404).json({ error: 'not-found' });
    return;
  }
  next();
}

// GET /api/logs/stream — SSE endpoint for real-time log streaming
logsRouter.get('/stream', requireUnlockedVault, (req: Request, res: Response) => {
  const sse = setupSSE(req, res, { allowedOrigin: ALLOWED_ORIGIN });

  // Capture the SUBSCRIBER's tenant ONCE, here in the subscriber's async
  // context. `onEntry` fires in the EMITTER's async context (possibly another
  // tenant's request), so it must NOT call getCurrentTenant() itself — that
  // would read the wrong tenant and is the load-bearing correctness point.
  // Cloud mode only; open-core leaves this undefined and never filters.
  const subTenant = getCurrentTenant()?.userId;
  const visibleTo = (entry: LogEntry): boolean => !isCloudMode() || entry.tenantId === subTenant;

  // Send recent history on connect (scoped to the subscriber in cloud mode).
  // getConnectHistory() widens this from the last 50 entries to the FULL
  // priority pool (every retained warn/error) plus the most recent 200 info
  // entries — the old getHistory(50) replay could silently drop an early
  // error under a flood of routine info activity. `subTenant` now also
  // selects the tenant-scoped POOL itself (cloud mode partitions retention
  // per tenant so one tenant's flood can't evict another's capacity — see
  // M15's `store()`), but the per-entry `visibleTo()` filter below stays: it
  // is the load-bearing cloud-mode tenancy boundary and a redundant
  // per-entry comparison is the cheapest insurance in this file, so it keeps
  // wrapping every replayed entry unchanged even though the partitioned pool
  // makes it redundant in the common case.
  // Send the subscriber's own server-side eviction counts before the replay,
  // so a client attaching mid-run can tell that the history it is about to
  // receive is incomplete. Cumulative, not a delta — the client replaces.
  sse.send('log:dropped', logger.droppedCounts(subTenant));

  const history = logger.getConnectHistory(subTenant);
  for (const entry of history) {
    if (visibleTo(entry)) sse.send('log:entry', entry);
  }

  const onEntry = (entry: LogEntry) => {
    if (res.writableEnded) return;
    if (visibleTo(entry)) sse.send('log:entry', entry);
  };

  logger.on('log:entry', onEntry);

  // --- run-progress relay (streamed on the SAME SSE channel as the log lines) ---
  // Reuses the log stream's tenancy scoping: `subTenant` was captured once above
  // in the SUBSCRIBER's async context. In cloud mode a subscriber sees only
  // events stamped with their own tenant id; open-core leaves `subTenant`
  // undefined and passes everything.
  const progressVisibleTo = (e: RunProgressEvent): boolean =>
    !isCloudMode() || e.tenantId === subTenant;

  // Coalesce per `runId` on a trailing edge so a burst of progress writes (e.g.
  // trivial-matcher fan-out) collapses to one client frame; the newest event per
  // runId wins within a window. Terminal-status events flush immediately.
  const pendingProgress = new Map<string, RunProgressEvent>();
  const progressTimers = new Map<string, NodeJS.Timeout>();

  // Forward ONLY the six client-contract fields — `tenantId` is server-side
  // scoping and must never leave the process.
  const sendProgress = (e: RunProgressEvent): void => {
    sse.send('run-progress', {
      runId: e.runId,
      projectId: e.projectId,
      status: e.status,
      completed: e.completed,
      failed: e.failed,
      total: e.total,
    });
  };

  const flushProgress = (runId: string): void => {
    const timer = progressTimers.get(runId);
    if (timer) {
      clearTimeout(timer);
      progressTimers.delete(runId);
    }
    const pending = pendingProgress.get(runId);
    if (pending === undefined) return;
    pendingProgress.delete(runId);
    if (!res.writableEnded) sendProgress(pending);
  };

  const onProgress = (e: RunProgressEvent): void => {
    if (res.writableEnded || !progressVisibleTo(e)) return;
    pendingProgress.set(e.runId, e); // coalesce: newest wins within the window
    if (isTerminalRunStatus(e.status)) {
      flushProgress(e.runId); // terminal → immediate, bypassing the timer
      return;
    }
    if (!progressTimers.has(e.runId)) {
      progressTimers.set(
        e.runId,
        setTimeout(() => flushProgress(e.runId), RUN_PROGRESS_THROTTLE_MS),
      );
    }
  };

  runEvents.on('progress', onProgress);

  req.on('close', () => {
    logger.removeListener('log:entry', onEntry);
    runEvents.removeListener('progress', onProgress);
    // Drop any pending trailing-edge timers/frames — no leaks past disconnect.
    for (const timer of progressTimers.values()) clearTimeout(timer);
    progressTimers.clear();
    pendingProgress.clear();
  });
});

// GET /api/logs/history?n=100 — return last N log entries
logsRouter.get('/history', requireUnlockedVault, (req: Request, res: Response) => {
  const n = Number.parseInt((req.query['n'] as string) ?? '100', 10);
  const tenantId = isCloudMode() ? getCurrentTenant()?.userId : undefined;
  let entries = logger.getHistory(Number.isNaN(n) ? 100 : n, tenantId);
  // Cloud mode: scope to the requesting tenant. The pool is now already
  // tenant-partitioned (see M15's getHistory), so this per-entry filter is
  // redundant in the common case — kept anyway as the load-bearing tenancy
  // boundary, the cheapest insurance against a partitioning bug ever leaking
  // one tenant's entries into another's response. Open-core: return all
  // (unchanged, tenantId is undefined so isCloudMode() gates this off).
  if (isCloudMode()) {
    entries = entries.filter((e) => e.tenantId === tenantId);
  }
  res.json(entries);
});

// GET /api/logs/audit — return audit log entries from memory
logsRouter.get(
  '/audit',
  requireUnlockedVault,
  validateQuery(auditQuerySchema),
  (req: Request, res: Response) => {
    const options = buildAuditQueryOptions(req.query);

    // `limit` is GET-only (the export reads all matching entries).
    const limit = req.query['limit'];
    if (limit) {
      options.limit = Number.parseInt(limit as string, 10);
    }

    let entries = auditLogger.getEntries(options);
    // Cloud mode: scope to the requesting tenant. Open-core: return all (unchanged).
    if (isCloudMode()) {
      const tenantId = getCurrentTenant()?.userId;
      entries = entries.filter((e) => e.userId === tenantId);
    }
    res.json(entries);
  },
);

// POST /api/logs/audit/export — export audit logs to file
logsRouter.post(
  '/audit/export',
  requireUnlockedVault,
  auditFileRateLimiter,
  blockAuditFilesInCloud,
  validateBody(auditFilterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const options = buildAuditQueryOptions(req.body || {});

    let entries = auditLogger.getEntries(options);

    // Also include entries from file-based logs
    const fileEntries = await readLogFileEntries();
    entries = [...entries, ...fileEntries];

    // Sort by timestamp
    entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `audit-export-${timestamp}.json`;

    // Validate the filename segment to prevent directory traversal
    if (!validateLogFilename(filename)) {
      res.status(400).json({ error: 'Invalid log directory' });
      return;
    }

    const filepath = path.join(LOG_DIR, filename);

    // Write to file
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(entries, null, 2));

    // Log the export action
    auditLogger.log('security.audit-export', {
      filename,
      entryCount: entries.length,
      sessionId: getSessionId(res),
    });

    res.json({
      success: true,
      filename,
      filepath,
      entryCount: entries.length,
    });
  }),
);

// GET /api/logs/audit/files — list available audit log files
logsRouter.get(
  '/audit/files',
  requireUnlockedVault,
  auditFileRateLimiter,
  blockAuditFilesInCloud,
  asyncHandler(async (_req: Request, res: Response) => {
    await fs.mkdir(LOG_DIR, { recursive: true });
    const files = await fs.readdir(LOG_DIR);

    const logFiles = files.filter(isRotatedAuditLog).map((f) => ({
      name: f,
      path: path.join(LOG_DIR, f),
      size: 0, // Will be updated below
    }));

    // Get file sizes
    for (const file of logFiles) {
      try {
        const stats = await fs.stat(file.path);
        file.size = stats.size;
      } catch {
        file.size = 0;
      }
    }

    res.json({ files: logFiles });
  }),
);

// GET /api/logs/audit/file/:filename — download a specific audit log file
logsRouter.get(
  '/audit/file/:filename',
  requireUnlockedVault,
  auditFileRateLimiter,
  blockAuditFilesInCloud,
  asyncHandler(async (req: Request, res: Response) => {
    const filename = Array.isArray(req.params.filename)
      ? req.params.filename[0]
      : req.params.filename;

    // Validate the untrusted filename segment to prevent path traversal
    if (!validateLogFilename(filename)) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    // Resolve the request against the directory's own listing, and serve the
    // NAME THAT CAME BACK rather than the one the client sent. The two strings
    // are equal whenever this succeeds, so no response changes — but the value
    // handed to the filesystem now originates from the filesystem, which makes
    // the route safe by construction instead of safe by the guard above alone.
    // A name with no matching entry takes the same 404 the old existence check
    // produced.
    const entries = await fs.readdir(LOG_DIR).catch(() => [] as string[]);
    const storedName = entries.find((entry) => entry === filename);
    if (storedName === undefined) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Log file access for audit purposes
    auditLogger.log('security.audit-file-access', {
      filename: storedName,
      sessionId: getSessionId(res),
    });

    // Set headers for download. Strip characters that could break out of the
    // quoted header value (defense-in-depth — validateLogFilename already
    // rejects `..`/`/`/absolute, but not a literal `"` or CR/LF).
    const safeFilename = storedName.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    // `res.sendFile` requires an ABSOLUTE path (it throws "path must be
    // absolute" otherwise) — LOG_DIR is relative by default (`./logs`), so pass
    // it as the sendFile `root` (absolute-resolved, same as validateLogFilename
    // above) rather than a possibly relative joined path.
    res.sendFile(storedName, { root: path.resolve(LOG_DIR) });
  }),
);

// Helper function to read entries from file-based logs
async function readLogFileEntries(): Promise<AuditLogEntry[]> {
  try {
    const files = await fs.readdir(LOG_DIR);
    const entries: AuditLogEntry[] = [];

    for (const file of files) {
      if (isRotatedAuditLog(file)) {
        try {
          const filepath = path.join(LOG_DIR, file);
          const content = await fs.readFile(filepath, 'utf8');
          for (const line of content.trim().split('\n')) {
            if (line.trim()) {
              try {
                entries.push(JSON.parse(line) as AuditLogEntry);
              } catch {
                // Skip malformed lines
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }

    return entries;
  } catch {
    return [];
  }
}
