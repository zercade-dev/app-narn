/**
 * Automatic safety snapshots (feature idea 13).
 *
 * `createSnapshot` is the single entry point for every backup-creation path
 * (manual button, pre-import, pre-retranslate): it writes a PG row via the
 * BackupStore (the gzip'd `ProjectSnapshot` JSON) and then applies the ONE
 * retention policy:
 *
 *   - automatic snapshots are pruned to the newest `maxBackupsPerProject`
 *     (WorkspaceSettings, falling back to the `MAX_BACKUPS_PER_PROJECT` env
 *     var, default 20) PER TRIGGER, so aggressive auto-snapshotting cannot
 *     crowd anything out. In cloud mode retention is env-only: the workspace
 *     setting is ignored so a tenant cannot raise its own backup quota;
 *   - manual backups are never auto-pruned.
 *
 * Snapshotting needs no credentials, so callers may invoke this without the
 * vault gate (the CSV import route is deliberately not vault-gated).
 */
import { randomUUID } from 'node:crypto';
import type { WorkspaceSettings } from '@zercade-dev/narn-shared';
import { dumpProject } from '../storage/project-snapshot.js';
import { getPool } from '../storage/pg/pool.js';
import { MAX_UNCOMPRESSED_BYTES } from './M13-backup-manager.js';
import type { BackupTrigger } from './backup-trigger.js';
import { getBackupStore, getGlobalConfigStore } from '../storage/registry.js';
import { isCloudMode } from '../identity/registry.js';
import { getMaxBackupsPerProject } from '../config/env.js';
import type { BackupRecord } from '../storage/types.js';
import { requireTenant } from '../storage/pg/tenant-context.js';
import { KeyedAsyncLock } from '../utils/keyed-lock.js';
import { BackupIntegrityError } from '../types/errors.js';
import { sha256Hex } from '../utils/hash.js';
import { logger } from './M15-console-logger.js';

/**
 * Serializes the snapshot-write + prune cycle per project so two concurrent
 * snapshots for the same project cannot race the prune (one could otherwise
 * delete the other's freshly-inserted row). Keyed by `projectId`; RLS already
 * tenant-scopes the rows, so no tenant component is needed in the key. In-process
 * per server instance — the SQL `prune`'s deterministic ordering makes
 * a multi-replica double-prune idempotent.
 */
const backupCreateLock = new KeyedAsyncLock();

// Hard fallback when neither WorkspaceSettings.maxBackupsPerProject nor a valid
// MAX_BACKUPS_PER_PROJECT env var is set.
const HARD_DEFAULT_MAX_BACKUPS_PER_PROJECT = 20;

/**
 * Coerce a configured retention value to a finite positive integer, or
 * `undefined` when it is unusable (unset / non-numeric / <= 0). Guards against a
 * malformed env or setting silently disabling retention (`NaN` → never prunes)
 * or wiping every automatic backup (`0` → prunes all).
 */
function sanitizeMaxBackups(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

/**
 * Resolve the per-project, per-trigger automatic-backup retention cap.
 *
 * Precedence:
 *   - cloud (`isCloudMode()`): env-only — `MAX_BACKUPS_PER_PROJECT ?? 20`. The
 *     workspace setting is deliberately IGNORED (the cloud route also drops it
 *     from the PUT body) so a tenant cannot raise its own backup quota;
 *   - self-hosted: `settings.maxBackupsPerProject ?? env ?? 20`.
 *
 * `settings` defaults to a store read so production callers can invoke it
 * arg-less; passing it in keeps the resolver unit-testable without a DB. The
 * env var is read on each call (not cached at module load) so it tracks runtime
 * changes. All values pass through `sanitizeMaxBackups`, so a malformed env or
 * setting falls through to the next source rather than disabling/zeroing
 * retention.
 */
export async function resolveMaxBackupsPerProject(
  settings?: Pick<WorkspaceSettings, 'maxBackupsPerProject'>,
): Promise<number> {
  const envDefault =
    sanitizeMaxBackups(getMaxBackupsPerProject()) ?? HARD_DEFAULT_MAX_BACKUPS_PER_PROJECT;
  if (isCloudMode()) return envDefault; // cloud: env-only, ignore workspace setting
  const resolved =
    settings ??
    (await getGlobalConfigStore()
      .getSettings()
      .catch(() => ({}) as WorkspaceSettings));
  return sanitizeMaxBackups(resolved.maxBackupsPerProject) ?? envDefault;
}

/**
 * Creates a trigger-tagged backup of `projectId` as a PG row and applies
 * retention. The returned promise resolves only after the row is committed —
 * callers taking a pre-write safety snapshot MUST await it before their first
 * store write (the pre-import snapshot must land before the CSV upsert).
 *
 * Asserts the ambient tenant at its OWN boundary (`requireTenant()`), so a
 * future off-request trigger fails closed instead of writing under an unscoped
 * context. The insert + prune run under a per-project lock so concurrent
 * snapshots can't race the prune.
 *
 * Rejects (`BackupIntegrityError`) a snapshot larger than 100 MB uncompressed:
 * a backup that big could not be restored — the restore/download paths reject
 * it at the same ceiling — so it is refused at creation too.
 */
export async function createSnapshot(
  projectId: string,
  trigger: BackupTrigger,
): Promise<BackupRecord> {
  requireTenant();
  return backupCreateLock.withLock(projectId, async () => {
    const snapshot = await dumpProject(projectId, getPool());
    const json = Buffer.from(JSON.stringify(snapshot));
    if (json.byteLength > MAX_UNCOMPRESSED_BYTES) {
      throw new BackupIntegrityError(
        `Project snapshot exceeds the 100 MB limit (${json.byteLength} bytes); cannot back up`,
      );
    }

    const record = await getBackupStore().insert({
      id: `bk_${randomUUID()}`,
      projectId,
      trigger,
      schemaVersion: 1,
      // The store gzips this and stamps `sizeBytes` (the gzip boundary lives in
      // the store). The caller computes sha256/uncompressedBytes/the
      // denormalized stats from the SAME uncompressed buffer.
      snapshotJson: json,
      uncompressedBytes: json.byteLength,
      sha256: sha256Hex(json),
      projectName: snapshot.config.name,
      stringCount: snapshot.strings.length,
      languageCount: snapshot.config.activeLanguages.length,
      runCount: snapshot.runs.length,
      createdBy: requireTenant().userId,
    });

    try {
      await getBackupStore().prune(projectId, await resolveMaxBackupsPerProject());
    } catch (err) {
      // Retention is best-effort — never fail the calling operation over pruning.
      logger.warn('backup:prune-failed', {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return record;
  });
}
