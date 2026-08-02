import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { getPool } from '../storage/pg/pool.js';
import { restoreProject, type ProjectSnapshot } from '../storage/project-snapshot.js';
import { sha256Hex } from '../utils/hash.js';
import { BackupIntegrityError } from '../types/errors.js';
import { moduleConfigBaseURLError } from '../utils/validate-module-config.js';
import { forbiddenModuleConfigKeys } from '../utils/module-config-secrets.js';
import { requireTenant } from '../storage/pg/tenant-context.js';
import { logger } from './M15-console-logger.js';
import { type BackupTrigger } from './backup-trigger.js';

const MANIFEST_FILENAME = 'manifest.json';
// A project's entire persisted state lives in Postgres (config/strings/runs/
// glossaries/review-order), so a backup IS this dump — the sole payload file
// alongside the manifest. Checksummed like any backed-up file so the
// integrity guarantee covers it; see modules/../storage/project-snapshot.ts.
const PG_DATA_FILENAME = 'pg-data.json';

// Hard ceiling on a snapshot's UNcompressed size, shared by the uploaded-zip
// bomb guard (restoreBackup) and the PG-payload path (restoreSnapshotBuffer
// pre-checks `uncompressed_bytes` against this before gunzipping). A backup
// larger than this can't be restored, so creation rejects it too.
export const MAX_UNCOMPRESSED_BYTES = 104_857_600; // 100 MB

export interface BackupManifestEntry {
  path: string;
  sha256: string;
  size: number;
}

export interface BackupManifest {
  version: 1;
  createdAt: string;
  projectId: string;
  /**
   * What prompted this backup. Optional and additive — older archives have no
   * trigger field and are treated as manual; the manifest version stays 1 so
   * `readManifest` keeps accepting both shapes.
   */
  trigger?: BackupTrigger;
  files: BackupManifestEntry[];
}

export interface RestoreBackupResult {
  projectId: string;
  /**
   * Count of validated manifest entries other than `pg-data.json`. Always 0 for
   * current archives (which carry only `pg-data.json`); for a legacy archive it
   * reports the residual `.json` entries that were validated but, being redundant
   * duplicates of the PG data, were intentionally not materialized to disk.
   */
  filesRestored: number;
}

/**
 * Builds the in-memory backup zip (manifest.json + pg-data.json) for a snapshot
 * and returns its bytes. Pure — no filesystem, no store — so the download route
 * can stream a zip generated on the fly from a stored PG payload. `sha256` is
 * the digest of the (uncompressed) pg-data bytes, recorded in the manifest for
 * the same integrity guarantee the on-disk archives carried. `createdAt`
 * defaults to now but the download route passes the row's stored timestamp so
 * the generated archive reflects when the backup was actually taken. Async
 * because yazl emits the archive as a stream.
 */
export async function buildBackupZip(
  snapshot: ProjectSnapshot,
  sha256: string,
  trigger: BackupTrigger,
  projectId: string,
  createdAt: string = new Date().toISOString(),
): Promise<Buffer> {
  const pgDataBuf = Buffer.from(JSON.stringify(snapshot));
  const manifest: BackupManifest = {
    version: 1,
    createdAt,
    projectId,
    trigger,
    files: [{ path: PG_DATA_FILENAME, sha256, size: pgDataBuf.byteLength }],
  };
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2)), MANIFEST_FILENAME);
  zip.addBuffer(pgDataBuf, PG_DATA_FILENAME);
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * A backup zip opened for reading: central-directory metadata for every entry
 * (no file data has been inflated yet — the bomb guards in restoreBackup run
 * on this before any extraction), plus an on-demand per-entry data reader.
 * Callers must close() in a finally.
 */
interface OpenedArchive {
  entries: yauzl.Entry[];
  readData(entry: yauzl.Entry): Promise<Buffer>;
  close(): void;
}

export class BackupManager {
  /**
   * Opens a backup zip, mapping any read error to a `BackupIntegrityError`.
   * Also walks the central directory to collect entry metadata.
   */
  private async openArchive(archivePath: string): Promise<OpenedArchive> {
    let zipfile: yauzl.ZipFile | undefined;
    try {
      zipfile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
        yauzl.open(archivePath, { lazyEntries: true, autoClose: false }, (err, zf) => {
          if (err) reject(err);
          else resolve(zf);
        });
      });
      const zf = zipfile;
      // Metadata-only central-directory walk (openReadStream is never called
      // here, so nothing is inflated). yauzl validates entry file names during
      // this walk — `..` segments, absolute paths, backslashes — and errors out,
      // so crafted-path archives are rejected right here as integrity failures;
      // the explicit path guard in restoreBackup stays as defense-in-depth.
      const entries = await new Promise<yauzl.Entry[]>((resolve, reject) => {
        const acc: yauzl.Entry[] = [];
        zf.on('entry', (entry: yauzl.Entry) => {
          acc.push(entry);
          zf.readEntry();
        });
        zf.once('end', () => resolve(acc));
        zf.once('error', reject);
        zf.readEntry();
      });
      const readData = (entry: yauzl.Entry): Promise<Buffer> =>
        new Promise<Buffer>((resolve, reject) => {
          zf.openReadStream(entry, (err, stream) => {
            if (err) return reject(err);
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.once('end', () => resolve(Buffer.concat(chunks)));
            stream.once('error', reject);
          });
        });
      return { entries, readData, close: () => zf.close() };
    } catch (err) {
      zipfile?.close();
      throw new BackupIntegrityError(
        `Failed to open backup archive: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * SSRF guard for a restored snapshot. A backup's `pg-data.json` carries the
   * project's `moduleConfigs`, whose per-module `config.baseURL` is the endpoint
   * each LLM module sends the (vault) credential to as an Authorization header.
   * A crafted/hand-edited archive could point a baseURL at a link-local/metadata
   * host (e.g. `169.254.169.254`) to exfiltrate the BYOK key on the next run, so
   * every baseURL in the snapshot is validated through the SAME server-side
   * validator the live config-PUT route uses ({@link moduleConfigBaseURLError},
   * which wraps the shared `validateBaseURL`). The internal-host override is honored
   * ONLY via the operator-env `ALLOW_INTERNAL_LLM_HOSTS` exactly as the live path
   * does — never from the (untrusted) restored config blob. A bad host rejects the
   * WHOLE restore as a `BackupIntegrityError` before anything is persisted.
   *
   * `judgeConfig`/`sourceReviewConfig` carry only a module/model SELECTION (no
   * baseURL), and the snapshot has no global-config blob, so the project's
   * `moduleConfigs` are the only baseURL surface to validate.
   */
  private validateSnapshotBaseURLs(snapshot: ProjectSnapshot): void {
    const moduleConfigs = snapshot.config?.moduleConfigs;
    if (!moduleConfigs || typeof moduleConfigs !== 'object') return;
    for (const [moduleId, entry] of Object.entries(moduleConfigs)) {
      const err = moduleConfigBaseURLError((entry as { config?: unknown } | null)?.config);
      if (err) {
        throw new BackupIntegrityError(
          `Unsafe baseURL in backup module config "${moduleId}": ${err}`,
        );
      }
    }
  }

  /**
   * Credential guard for a restored snapshot, the write-side counterpart of
   * {@link validateSnapshotBaseURLs}. `pg-data.json` carries the project's
   * `moduleConfigs` verbatim and `restoreProject` upserts them into the
   * `projects` row without passing any route guard, so a crafted (or simply
   * old) archive can plant a `format: 'password'` key — a state the read-side
   * redaction then has to contain. Every such key is removed BEFORE the restore
   * transaction, using the same write-side classifier the bulk project PUT and
   * template import use (schema-driven, name-heuristic fallback for a module id
   * the registry cannot resolve).
   *
   * STRIPS rather than throwing, unlike the baseURL guard next door. That guard
   * rejects because an attacker-chosen endpoint is an active exfiltration
   * channel that a partial restore would leave armed; a credential key is inert
   * once removed, and restore is the RECOVERY path — refusing to restore a
   * user's own backup because it predates this hygiene rule would cost them
   * their data to protect them from their own key. The value is dropped, the
   * restore proceeds, and the loss is logged by key name only.
   */
  private stripSnapshotConfigSecrets(snapshot: ProjectSnapshot): void {
    const moduleConfigs = snapshot.config?.moduleConfigs;
    if (!moduleConfigs || typeof moduleConfigs !== 'object') return;
    const stripped: string[] = [];
    for (const [moduleId, entry] of Object.entries(moduleConfigs)) {
      const config = (entry as { config?: Record<string, unknown> } | null)?.config;
      if (!config || typeof config !== 'object') continue;
      for (const key of forbiddenModuleConfigKeys(moduleId, config)) {
        delete config[key];
        stripped.push(`${moduleId}.${key}`);
      }
    }
    if (stripped.length > 0) {
      logger.warn('backup:restore stripped credential-format module config keys', {
        projectId: snapshot.config?.id,
        keys: stripped,
      });
    }
  }

  /**
   * Reads and validates the `manifest.json` entry from an opened backup zip.
   * Single source of truth shared by {@link restoreBackup} and
   * {@link peekManifest}.
   */
  private async readManifest(archive: OpenedArchive): Promise<BackupManifest> {
    const manifestEntry = archive.entries.find((e) => e.fileName === MANIFEST_FILENAME);
    if (!manifestEntry) {
      throw new BackupIntegrityError('Backup archive is missing manifest.json');
    }

    let raw: Buffer;
    try {
      raw = await archive.readData(manifestEntry);
    } catch (err) {
      throw new BackupIntegrityError(
        `Failed to read backup manifest: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(raw.toString('utf-8')) as BackupManifest;
    } catch {
      throw new BackupIntegrityError('Backup manifest.json is not valid JSON');
    }

    if (
      !manifest ||
      manifest.version !== 1 ||
      !Array.isArray(manifest.files) ||
      !manifest.projectId
    ) {
      throw new BackupIntegrityError('Backup manifest has an unsupported shape');
    }

    return manifest;
  }

  /**
   * Restores a snapshot from a (trusted) PG-stored payload — the server-side
   * by-id restore path. The payload is gzip'd `ProjectSnapshot` JSON owned by
   * the store, so the zip-bomb/checksum machinery `restoreBackup` applies to
   * UNtrusted uploaded archives is skipped; the SSRF baseURL guard still runs
   * before any write (a payload could carry a config landed by a past hand-
   * crafted upload-restore). gunzip/JSON failures are wrapped as
   * `BackupIntegrityError` (a corrupt blob is treated like a failed-integrity
   * archive). Re-asserts the ambient tenant at this boundary, exactly like
   * `restoreBackup`, so a future off-request restore fails closed.
   */
  async restoreSnapshotBuffer(payload: Buffer): Promise<RestoreBackupResult> {
    requireTenant();

    let snapshot: ProjectSnapshot;
    let json: Buffer;
    try {
      json = gunzipSync(payload);
    } catch (err) {
      throw new BackupIntegrityError(
        `Failed to decompress backup payload: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    try {
      snapshot = JSON.parse(json.toString('utf-8')) as ProjectSnapshot;
    } catch {
      throw new BackupIntegrityError(`Backup ${PG_DATA_FILENAME} is not valid JSON`);
    }

    // SSRF guard: reject a link-local/metadata baseURL BEFORE persisting, so
    // nothing is applied to Postgres on rejection. Same validator the
    // uploaded-zip restore and live config-PUT use; operator-env override only.
    this.validateSnapshotBaseURLs(snapshot);
    // Credential hygiene: drop any password-format module config key the payload
    // carries (see stripSnapshotConfigSecrets) so the restore cannot re-plant a
    // secret in project config.
    this.stripSnapshotConfigSecrets(snapshot);
    // restoreProject is withTenantTransaction-based; the request's runWithTenant
    // context (or the re-asserted tenant above) satisfies it. One transaction →
    // a mid-restore failure rolls back cleanly.
    await restoreProject(getPool(), snapshot);

    logger.info('backup:restored-from-pg', { projectId: snapshot.config.id });
    return { projectId: snapshot.config.id, filesRestored: 0 };
  }

  /**
   * Restores a backup zip into Postgres. Every file checksum in the archive is
   * verified against the manifest BEFORE anything is applied; on any mismatch a
   * `BackupIntegrityError` is thrown and no data is touched. The project's
   * state is applied from `pg-data.json` in one transaction; a current backup
   * carries no residual on-disk files, so none are materialized.
   */
  async restoreBackup(archivePath: string): Promise<RestoreBackupResult> {
    // Assert the ambient tenant at this boundary (defense against a future
    // off-request auto-restore): restoreProject writes under withTenantTransaction
    // and the SSRF validation honors the operator env, but the snapshot is applied
    // to the CURRENT tenant — fail closed with NoTenantContextError if absent
    // rather than restoring into an unscoped context.
    requireTenant();

    const MAX_ENTRY_COUNT = 1000;

    const archive = await this.openArchive(archivePath);
    try {
      // Bomb-defense: check entry count and total uncompressed size before any extraction
      const allEntries = archive.entries;
      if (allEntries.length === 0) {
        throw new BackupIntegrityError('Archive is empty');
      }
      if (allEntries.length > MAX_ENTRY_COUNT) {
        throw new BackupIntegrityError(
          `Archive has too many entries (${allEntries.length}); maximum is ${MAX_ENTRY_COUNT}`,
        );
      }
      // Check entry names before any extraction. fileName is the full relative path.
      const seenEntryNames = new Set<string>();
      for (const entry of allEntries) {
        if (entry.fileName.includes('..') || path.isAbsolute(entry.fileName)) {
          throw new BackupIntegrityError(`Unsafe path in archive: ${entry.fileName}`);
        }
        // Reject symlink entries: the high 16 bits of the external file
        // attributes (yauzl exposes the raw external attributes) hold the Unix
        // mode; S_IFLNK (0o120000) means the entry materializes as a symlink
        // that could point outside the project dir and break containment.
        if (((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000) {
          throw new BackupIntegrityError(`Symlink entries are not allowed: ${entry.fileName}`);
        }
        // Reject duplicate entry names: the archive would otherwise resolve one
        // arbitrarily while the manifest only checksums one, letting a crafted
        // archive smuggle in an unverified second copy.
        if (seenEntryNames.has(entry.fileName)) {
          throw new BackupIntegrityError(`Duplicate entry in archive: ${entry.fileName}`);
        }
        seenEntryNames.add(entry.fileName);
      }
      let totalUncompressedSize = 0;
      for (const entry of allEntries) {
        totalUncompressedSize += entry.uncompressedSize;
        if (totalUncompressedSize > MAX_UNCOMPRESSED_BYTES) {
          throw new BackupIntegrityError('Archive uncompressed size exceeds the 100 MB limit');
        }
      }

      const manifest = await this.readManifest(archive);

      // Validate ALL checksums before any write
      const validated = new Map<string, Buffer>();
      for (const item of manifest.files) {
        if (item.path.includes('..') || path.isAbsolute(item.path)) {
          throw new BackupIntegrityError(`Unsafe path in manifest: ${item.path}`);
        }
        const entry = allEntries.find((e) => e.fileName === item.path);
        if (!entry) {
          throw new BackupIntegrityError(`Archive missing file listed in manifest: ${item.path}`);
        }
        let buf: Buffer;
        try {
          buf = await archive.readData(entry);
        } catch (err) {
          throw new BackupIntegrityError(
            `Failed to read archive entry ${item.path}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        const actual = sha256Hex(buf);
        if (actual !== item.sha256) {
          throw new BackupIntegrityError(
            `Checksum mismatch for ${item.path}: expected ${item.sha256}, got ${actual}`,
          );
        }
        validated.set(item.path, buf);
      }

      // All checksums valid. Apply the Postgres-owned project data (one
      // transaction inside restoreProject). Residual project-dir files are no
      // longer part of a backup; any present in a legacy archive were redundant
      // duplicates of this PG data and are intentionally NOT materialized.
      const pgDataBuf = validated.get(PG_DATA_FILENAME);
      if (!pgDataBuf) {
        // A legacy/crafted manifest whose `files` array never lists
        // `pg-data.json` (e.g. `files: []`) would otherwise fall through this
        // branch silently, restore nothing, and still report success. Fail
        // closed instead — a restore that touches no data is not a success.
        throw new BackupIntegrityError(
          `Backup manifest does not reference ${PG_DATA_FILENAME}; nothing to restore`,
        );
      }
      let snapshot: ProjectSnapshot;
      try {
        snapshot = JSON.parse(pgDataBuf.toString('utf-8')) as ProjectSnapshot;
      } catch {
        throw new BackupIntegrityError(`Backup ${PG_DATA_FILENAME} is not valid JSON`);
      }
      // Cross-check the manifest's declared projectId against the snapshot's own
      // config.id: a crafted/corrupted archive could otherwise carry a manifest
      // that claims one project while its pg-data.json payload restores another.
      if (snapshot.config?.id !== manifest.projectId) {
        throw new BackupIntegrityError(
          `Backup manifest projectId "${manifest.projectId}" does not match snapshot projectId "${snapshot.config?.id}"`,
        );
      }
      // SSRF guard: validate every module config's baseURL in the restored
      // snapshot BEFORE persisting (a crafted archive could otherwise smuggle a
      // link-local/metadata baseURL that exfiltrates the vault key on the next
      // run). Throws BackupIntegrityError on an internal/link-local host, so
      // nothing is applied to Postgres.
      this.validateSnapshotBaseURLs(snapshot);
      // Credential hygiene: an uploaded archive is fully attacker-supplied, so
      // drop every password-format module config key before it can be persisted
      // (stripped, not rejected — see stripSnapshotConfigSecrets).
      this.stripSnapshotConfigSecrets(snapshot);
      // restoreProject is withTenantTransaction-based, so it requires an ambient
      // tenant context. Every current restore path is request-scoped (the route
      // runs under the session middleware's runWithTenant), which satisfies this;
      // restoreBackup also re-asserts requireTenant() at its boundary above. A
      // future startup-time auto-restore would run OFF any request and must wrap
      // this in runWithTenant({ userId: 'local' }) like startup.ts does.
      await restoreProject(getPool(), snapshot);

      const residualCount = [...validated.keys()].filter((p) => p !== PG_DATA_FILENAME).length;
      logger.info('backup:restored', {
        projectId: manifest.projectId,
        pgDataRestored: true,
        residualEntriesIgnored: residualCount,
      });
      return { projectId: manifest.projectId, filesRestored: residualCount };
    } finally {
      archive.close();
    }
  }

  /**
   * Reads only the `manifest.json` from a backup zip without extracting or
   * verifying all file checksums. Used for restore preview.
   */
  async peekManifest(archivePath: string): Promise<BackupManifest> {
    const archive = await this.openArchive(archivePath);
    try {
      return await this.readManifest(archive);
    } finally {
      archive.close();
    }
  }
}

export const backupManager = new BackupManager();
