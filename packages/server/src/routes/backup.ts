import { Router, type RequestHandler } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import {
  backupManager,
  buildBackupZip,
  MAX_UNCOMPRESSED_BYTES,
} from '../modules/M13-backup-manager.js';
import { backupFilenameTriggerToken } from '../modules/backup-trigger.js';
import { createSnapshot } from '../modules/auto-snapshot.js';
import { getBackupStore, getProjectStore } from '../storage/registry.js';
import type { BackupRecord } from '../storage/types.js';
import type { ProjectSnapshot } from '../storage/project-snapshot.js';
import { assertProjectAccess } from '../middleware/authz.js';
import { slugify } from '../utils/slugify.js';
import { BackupIntegrityError } from '../types/errors.js';
import { logger } from '../modules/M15-console-logger.js';
import { asyncHandler } from '../http/index.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { singleFileUpload, requireFile } from '../utils/upload.js';
import { extensionFileFilter, validateUploadedFile } from '../utils/file-validation.js';

export const backupRouter: Router = Router();

// Where multer stages an accepted upload. Named rather than inlined below so
// the restore handler can re-assert that the file it was handed really does
// live here, instead of trusting the path multer reports.
const BACKUP_UPLOAD_DIR = path.join(os.tmpdir(), 'translator-backup-uploads');

// Anti-malware hardening: extension allowlist (.zip only — the client-supplied
// `mimetype` is never trusted for this) plus, once the file lands on disk,
// magic-byte content verification (the ZIP signature check inside
// validateUploadedFile, run on the upload route below) before the archive is
// ever handed to the zip reader. Decompression-bomb/zip-slip/symlink guards live in
// M13-backup-manager.ts (entry-count + uncompressed-size + path checks).
const upload = singleFileUpload({
  maxBytes: 200 * 1024 * 1024, // 200 MB
  dest: BACKUP_UPLOAD_DIR,
  fileFilter: extensionFileFilter(['.zip']),
});

/**
 * Resolves the temp path of an accepted upload and confirms it stays inside
 * {@link BACKUP_UPLOAD_DIR}.
 *
 * The name here is multer's, not the client's — multer generates it and keeps
 * the client-supplied `originalname` separate (that one is validated by
 * `validateUploadedFile`). So this cannot fail for an upload that came through
 * the middleware above; it is a containment assertion, held close to the two
 * filesystem calls that consume the path so the property stays visible if the
 * storage configuration is ever changed.
 */
function resolveUploadTempPath(uploadPath: string): string {
  const root = path.resolve(BACKUP_UPLOAD_DIR);
  const resolved = path.resolve(root, path.basename(uploadPath));
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Upload temp path escaped the upload directory');
  }
  return resolved;
}

// Guard for routes with a :backupId param. Backup ids are opaque store tokens
// (`bk_<uuid>`) used ONLY as an exact-match SQL bind — never a path segment — so
// this is a cheap charset bound that rejects obviously-malformed ids early with
// a 400 (it does NOT prevent traversal; there is no path to traverse).
const requireSafeBackupId: RequestHandler = (req, res, next) => {
  const backupId = req.params.backupId;
  if (typeof backupId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(backupId)) {
    res.status(400).json({ error: 'Invalid backup id' });
    return;
  }
  next();
};

/** ISO-8601 → the compact `YYYY-MM-DD-HHmmss` stamp used in cosmetic filenames. */
function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * A purely-cosmetic download filename for a backup record — the same
 * `<slug>-backup-[<trigger>-]<timestamp>.zip` shape the on-disk archives used —
 * so the UI's download link and testids keep a friendly name. NOT an addressing
 * key: every route addresses by `record.id`.
 */
function cosmeticFilename(record: BackupRecord): string {
  const slug = slugify(record.projectName ?? record.projectId);
  return (
    `${slug}-backup-` +
    `${backupFilenameTriggerToken(record.trigger)}${formatTimestamp(record.createdAt)}.zip`
  );
}

// POST /api/projects/:id/backups — create a backup stored as a PG row.
// Retention (per-trigger pruning of automatic snapshots; manual backups are
// never auto-pruned) is applied inside createSnapshot — the single policy
// shared with the pre-import and pre-retranslate snapshot paths.
// Limit backup creation so a runaway client (or a request that slips past the
// CSRF guard) cannot spam snapshots. Generous for local use.
const backupCreateRateLimiter = rateLimiter({ maxRequests: 20, windowMs: 60_000 });

backupRouter.post(
  '/projects/:id/backups',
  requireUnlockedVault,
  backupCreateRateLimiter,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    // Membership gate: a non-member gets 404 (same as a missing project) before
    // any backup is created. (createSnapshot also RLS-loads the project, but this
    // keeps the rejection a clean 404 rather than leaking through a deeper path.)
    await assertProjectAccess(projectId, { type: 'manage' });
    const record = await createSnapshot(projectId, 'manual');
    res.status(201).json({
      ...record,
      filename: cosmeticFilename(record),
      downloadUrl: `/api/projects/${projectId}/backups/${record.id}/download`,
    });
  }),
);

// POST /api/projects/:id/backups/pre-accept — take a `pre-accept` safety
// snapshot right before accepted AI suggestions are persisted. Used by the
// glossary accept flow, which creates/assigns glossaries client-side across
// several requests (unlike category accept, which snapshots server-side inside
// the assign route). Same membership gate + rate limit + retention as the manual
// POST; no vault gate (snapshots need no credentials, matching pre-import).
backupRouter.post(
  '/projects/:id/backups/pre-accept',
  backupCreateRateLimiter,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const record = await createSnapshot(projectId, 'pre-accept');
    res.status(201).json({
      ...record,
      filename: cosmeticFilename(record),
      downloadUrl: `/api/projects/${projectId}/backups/${record.id}/download`,
    });
  }),
);

// GET /api/projects/:id/backups — list existing backups for a project (metadata
// only, newest first; never decompresses).
backupRouter.get(
  '/projects/:id/backups',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    // Cross-tenant gate: reject (404) before listing another tenant's backups.
    await assertProjectAccess(id, { type: 'manage' });
    const records = await getBackupStore().list(id);
    const files = records.map((record) => ({
      ...record,
      // Cosmetic, server-generated (slug + trigger + timestamp) — addressing is
      // always by `record.id` (see downloadUrl).
      filename: cosmeticFilename(record),
      downloadUrl: `/api/projects/${id}/backups/${record.id}/download`,
    }));
    res.json({ files });
  }),
);

// GET /api/projects/:id/backups/:backupId/manifest — synthesize the manifest
// from the metadata row (NO decompression). Matches the UI's BackupManifest
// shape; 404 if the backup id is unknown.
backupRouter.get(
  '/projects/:id/backups/:backupId/manifest',
  requireSafeBackupId,
  asyncHandler(async (req, res) => {
    const { id, backupId } = req.params as { id: string; backupId: string };
    // Cross-tenant gate: reject (404) before disclosing another tenant's backup.
    await assertProjectAccess(id, { type: 'manage' });
    const record = await getBackupStore().getRecord(id, backupId);
    if (!record) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.json({
      version: 1,
      projectId: record.projectId,
      createdAt: record.createdAt,
      trigger: record.trigger,
      files: [{ path: 'pg-data.json', size: record.uncompressedBytes, sha256: record.sha256 }],
    });
  }),
);

// GET /api/projects/:id/backups/:backupId/download — stream a zip generated on
// the fly from the stored payload (gunzip → buildBackupZip). 404 if unknown.
backupRouter.get(
  '/projects/:id/backups/:backupId/download',
  requireSafeBackupId,
  asyncHandler(async (req, res) => {
    const { id, backupId } = req.params as { id: string; backupId: string };
    // Cross-tenant gate: reject (404) before serving another tenant's backup.
    await assertProjectAccess(id, { type: 'manage' });
    const record = await getBackupStore().getRecord(id, backupId);
    if (!record) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    // Cheap 100 MB ceiling on the UNcompressed size before gunzipping (parity
    // with the uploaded-zip bomb guard); rejects an over-large payload without
    // decompressing it.
    if (record.uncompressedBytes != null && record.uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
      throw new BackupIntegrityError('Backup uncompressed size exceeds the 100 MB limit');
    }
    const payload = await getBackupStore().getPayload(id, backupId);
    // TOCTOU: a delete between getRecord and getPayload yields null → 404.
    if (!payload) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    let snapshot: ProjectSnapshot;
    try {
      snapshot = JSON.parse(gunzipSync(payload).toString('utf-8')) as ProjectSnapshot;
    } catch (err) {
      throw new BackupIntegrityError(
        `Failed to read backup payload: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const zip = await buildBackupZip(
      snapshot,
      record.sha256 ?? '',
      record.trigger,
      record.projectId,
      record.createdAt,
    );
    const filename = cosmeticFilename(record);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zip.byteLength);
    res.end(zip);
  }),
);

const backupRestoreRateLimiter = rateLimiter({ maxRequests: 10, windowMs: 60_000 });

// POST /api/backup/restore — multipart zip upload, restores the project into
// Postgres. The ONE path that still touches the filesystem (uploads stream to
// /tmp, which is writable in the cloud); unchanged by the PG-store migration.
backupRouter.post(
  '/backup/restore',
  requireUnlockedVault,
  backupRestoreRateLimiter,
  upload,
  requireFile,
  asyncHandler(async (req, res) => {
    let tempPath: string | null = null;
    try {
      tempPath = resolveUploadTempPath(req.file!.path);
      // Magic-byte content verification: the extension/mimetype checked at
      // upload time (fileFilter) is client-supplied and never trusted alone —
      // read the first few bytes actually written to disk and reject anything
      // that isn't a real ZIP (including a script/binary mis-named `.zip`).
      const handle = await fs.open(tempPath, 'r');
      let header: Buffer;
      try {
        header = Buffer.alloc(4);
        await handle.read(header, 0, 4, 0);
      } finally {
        await handle.close();
      }
      validateUploadedFile(req.file!.originalname, header, {
        allowedExtensions: ['.zip'],
        requireZipMagic: true,
      });
      const result = await backupManager.restoreBackup(tempPath);
      logger.info('Backup restored', {
        projectId: result.projectId,
        filesRestored: result.filesRestored,
      });
      // After restore, this projectId may not previously have existed — ensure it loads.
      await getProjectStore()
        .loadProject(result.projectId)
        .catch(() => undefined);
      res.json(result);
    } finally {
      if (tempPath) {
        await fs.unlink(tempPath).catch(() => undefined);
      }
    }
  }),
);

// DELETE /api/projects/:id/backups/:backupId — delete a server-side backup by id.
backupRouter.delete(
  '/projects/:id/backups/:backupId',
  requireUnlockedVault,
  requireSafeBackupId,
  asyncHandler(async (req, res) => {
    const { id, backupId } = req.params as { id: string; backupId: string };
    // Cross-tenant gate: reject (404) before deleting another tenant's backup —
    // same membership scope as the read routes (don't let B tamper with A's data).
    await assertProjectAccess(id, { type: 'manage' });
    const deleted = await getBackupStore().delete(id, backupId);
    if (!deleted) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    res.status(204).send();
  }),
);

// POST /api/projects/:id/backups/:backupId/restore — restore a server-side
// backup by id. The store query is scoped by project_id, so a row only loads
// under its own project (the old filename-route's 409 "target mismatch" guard is
// now structurally impossible); a defensive projectId check is kept for
// belt-and-braces.
backupRouter.post(
  '/projects/:id/backups/:backupId/restore',
  requireUnlockedVault,
  requireSafeBackupId,
  asyncHandler(async (req, res) => {
    const { id, backupId } = req.params as { id: string; backupId: string };
    // Cross-tenant gate: reject (404) before restoring another tenant's backup.
    await assertProjectAccess(id, { type: 'manage' });
    const record = await getBackupStore().getRecord(id, backupId);
    if (!record) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    if (record.projectId !== id) {
      res
        .status(409)
        .json({ error: 'Backup target mismatch', expected: id, actual: record.projectId });
      return;
    }
    const payload = await getBackupStore().getPayload(id, backupId);
    // TOCTOU: a delete between getRecord and getPayload yields null → 404.
    if (!payload) {
      res.status(404).json({ error: 'Backup not found' });
      return;
    }
    const result = await backupManager.restoreSnapshotBuffer(payload);
    logger.info('backup:restored-from-server', {
      projectId: result.projectId,
      backupId,
      filesRestored: result.filesRestored,
    });
    await getProjectStore()
      .loadProject(result.projectId)
      .catch(() => undefined);
    res.json(result);
  }),
);
