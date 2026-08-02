import { gzipSync } from 'node:zlib';

import { AUTOMATIC_BACKUP_TRIGGERS, type BackupTrigger } from '../modules/backup-trigger.js';
import type { Queryable } from './pg/pool.js';
import type { BackupRecord, BackupStore, NewBackupInput } from './types.js';

/**
 * Shape of one metadata row returned by the `select <cols>` queries below —
 * every column EXCEPT `payload`. `pg`/pglite return `timestamptz` as a JS
 * `Date` and `integer` as a JS `number`, so only `created_at` needs coercion
 * (→ ISO string) in {@link rowToRecord}. The count/size columns are plain
 * numbers (`bigint`/`int8` would come back as strings, but none are used here).
 */
interface BackupMetaRow {
  id: string;
  project_id: string;
  trigger: BackupTrigger;
  schema_version: number;
  created_at: Date;
  size_bytes: number | null;
  uncompressed_bytes: number | null;
  sha256: string | null;
  label: string | null;
  project_name: string | null;
  string_count: number | null;
  language_count: number | null;
  run_count: number | null;
  created_by: string | null;
}

/** The metadata column list (NOT `payload`), shared by insert-returning/list/getRecord. */
const META_COLUMNS = `id, project_id, trigger, schema_version, created_at, size_bytes,
            uncompressed_bytes, sha256, label, project_name, string_count,
            language_count, run_count, created_by`;

/**
 * PG-backed project-backup store (replaces the on-disk `.backups/` zips). Holds
 * the gzip'd `ProjectSnapshot` JSON in `payload bytea` with a searchable scalar
 * mirror so list/preview never decompress. Constructed exactly like every other
 * PG store — `new PgBackupStore(new TenantDb(getPool()))` — so each statement
 * runs inside a `withTenantTransaction` (role `app_user` + the `app.user_id`
 * GUC) and RLS applies. `tenant_id`/`created_by` are written from
 * `current_setting('app.user_id')`, never a request param (mirrors
 * PgTemplateStore / restoreProject).
 *
 * The store owns gzip: `insert` receives the UNcompressed `snapshotJson` and
 * runs `gzipSync` to produce the stored `payload`, stamping `sizeBytes =
 * payload.byteLength`. `getPayload` returns the compressed `Buffer` verbatim;
 * decompression lives in the caller that knows the snapshot shape, so the
 * gzip boundary is isolated here (a future brotli swap is one file).
 */
export class PgBackupStore implements BackupStore {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  /** Map a metadata row to a BackupRecord (timestamptz Date → ISO string). */
  private rowToRecord(row: BackupMetaRow): BackupRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      trigger: row.trigger,
      schemaVersion: row.schema_version,
      createdAt: row.created_at.toISOString(),
      sizeBytes: row.size_bytes,
      uncompressedBytes: row.uncompressed_bytes,
      sha256: row.sha256,
      label: row.label,
      projectName: row.project_name,
      stringCount: row.string_count,
      languageCount: row.language_count,
      runCount: row.run_count,
      createdBy: row.created_by,
    };
  }

  async insert(input: NewBackupInput): Promise<BackupRecord> {
    // The store gzips the uncompressed snapshot JSON and stamps the compressed
    // length; `created_at` is left to the DB default. `tenant_id`/`created_by`
    // come from the GUC (never a param), so the row is self-describing and the
    // creator is attributed to the current tenant.
    const payload = gzipSync(input.snapshotJson);
    const { rows } = await this.db.query<BackupMetaRow>(
      `insert into project_backups
         (id, project_id, tenant_id, trigger, schema_version, size_bytes,
          uncompressed_bytes, sha256, label, project_name, string_count,
          language_count, run_count, created_by, payload)
       values ($1, $2, current_setting('app.user_id'), $3, $4, $5,
               $6, $7, $8, $9, $10, $11, $12, current_setting('app.user_id'), $13)
       returning ${META_COLUMNS}`,
      [
        input.id,
        input.projectId,
        input.trigger,
        input.schemaVersion,
        payload.byteLength,
        input.uncompressedBytes,
        input.sha256,
        input.label ?? null,
        input.projectName,
        input.stringCount,
        input.languageCount,
        input.runCount,
        payload,
      ],
    );
    return this.rowToRecord(rows[0]!);
  }

  async list(projectId: string): Promise<BackupRecord[]> {
    const { rows } = await this.db.query<BackupMetaRow>(
      `select ${META_COLUMNS}
       from project_backups
       where project_id = $1
       order by created_at desc, id desc`,
      [projectId],
    );
    return rows.map((row) => this.rowToRecord(row));
  }

  async getRecord(projectId: string, id: string): Promise<BackupRecord | null> {
    const { rows } = await this.db.query<BackupMetaRow>(
      `select ${META_COLUMNS}
       from project_backups
       where project_id = $1 and id = $2`,
      [projectId, id],
    );
    return rows.length > 0 ? this.rowToRecord(rows[0]!) : null;
  }

  async getPayload(projectId: string, id: string): Promise<Buffer | null> {
    // `bytea` comes back as a Node Buffer from `pg` but as a plain Uint8Array
    // from pglite; normalize to a Buffer so the interface contract holds on both
    // engines. `Buffer.from(view)` is a thin wrapper, no hex/escape handling
    // needed. Returns the COMPRESSED blob; the caller gunzips.
    const { rows } = await this.db.query<{ payload: Uint8Array }>(
      `select payload from project_backups where project_id = $1 and id = $2`,
      [projectId, id],
    );
    const payload = rows[0]?.payload;
    return payload != null ? Buffer.from(payload) : null;
  }

  async delete(projectId: string, id: string): Promise<boolean> {
    // `returning id` + `rows.length` is portable across pg + pglite; the
    // `Queryable` surface only types `{ rows }`, so we never rely on `rowCount`.
    const { rows } = await this.db.query<{ id: string }>(
      `delete from project_backups where project_id = $1 and id = $2 returning id`,
      [projectId, id],
    );
    return rows.length > 0;
  }

  async prune(projectId: string, maxPerTrigger: number): Promise<void> {
    // Keep only the newest `maxPerTrigger` per AUTOMATIC trigger per project;
    // `'manual'` is excluded from the candidate set, so manual backups are never
    // pruned. `order by created_at desc, id desc` makes the tiebreak (two
    // automatic snapshots sharing a created_at) deterministic. Runs under the
    // tenant tx → RLS already scopes the candidates; the explicit project_id
    // keeps it to the one project being snapshotted.
    // Candidate triggers are sourced from AUTOMATIC_BACKUP_TRIGGERS (not a
    // hard-coded literal) so a newly-added automatic trigger (e.g. 'pre-accept')
    // is pruned without editing this SQL. Bound as $3.. after the two fixed args.
    const triggerPlaceholders = AUTOMATIC_BACKUP_TRIGGERS.map((_, i) => `$${i + 3}`).join(', ');
    await this.db.query(
      `delete from project_backups pb
       using (
         select id
         from (
           select id,
                  row_number() over (
                    partition by project_id, trigger
                    order by created_at desc, id desc
                  ) as rn
           from project_backups
           where project_id = $1
             and trigger in (${triggerPlaceholders})
         ) ranked
         where rn > $2
       ) victims
       where pb.id = victims.id`,
      [projectId, maxPerTrigger, ...AUTOMATIC_BACKUP_TRIGGERS],
    );
  }
}
