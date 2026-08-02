import type { Queryable } from './pg/pool.js';
import type { DeviceVaultRecord, DeviceVaultStore } from './types.js';

/**
 * Row shape for a `device_vaults` METADATA read. Deliberately excludes
 * `ciphertext`/`kdf_salt` — those columns are secret material (the encrypted
 * vault envelope + its salt); only `CloudVaultStore` (the actual vault
 * read/write path) ever selects them. This store exists ONLY to power the
 * Account → Security → Devices list/"forget device" UI, which must never see
 * the secret columns.
 */
interface DeviceVaultMetaRow {
  device_id: string;
  created_at: Date;
  updated_at: Date;
}

/** The metadata-only column list selected by {@link PgDeviceVaultStore.listForCurrentUser}. */
const COLUMNS = `device_id, created_at, updated_at`;

function rowToRecord(row: DeviceVaultMetaRow): DeviceVaultRecord {
  return {
    deviceId: row.device_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * PG-backed device-vault METADATA store — the Devices sub-section's read/
 * "forget" surface. Constructed exactly like every other PG store — `new
 * PgDeviceVaultStore(new TenantDb(getPool()))` — so each statement runs
 * inside a `withTenantTransaction` (role `app_user` + the `app.user_id` GUC)
 * and RLS applies; every method below is scoped to the AMBIENT tenant only
 * (no explicit `user_id` filter anywhere — mirrors PgNotificationStore), so
 * there is no WHERE clause to get wrong and no way to widen the blast radius
 * from the app layer.
 *
 * This is a metadata-only sibling of `CloudVaultStore`, which owns the actual
 * ciphertext/kdf_salt read+write path for vault unlock/setup — that path is
 * untouched by this store, which never selects those two columns.
 */
export class PgDeviceVaultStore implements DeviceVaultStore {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  /**
   * Every device_vaults row for the current tenant, newest first. No cap —
   * unlike notifications, a user's device count is small (one per enrolled
   * browser/machine), so there is no pagination concern.
   */
  async listForCurrentUser(): Promise<DeviceVaultRecord[]> {
    const { rows } = await this.db.query<DeviceVaultMetaRow>(
      `select ${COLUMNS}
       from device_vaults
       order by created_at desc, device_id desc`,
    );
    return rows.map(rowToRecord);
  }

  /**
   * Forget one device's vault row. A foreign/missing device_id is a silent
   * no-op — mirrors PgNotificationStore.delete()'s exact semantics (RLS alone
   * scopes the statement; no redundant in-SQL `user_id = ...` filter).
   */
  async delete(deviceId: string): Promise<void> {
    await this.db.query(`delete from device_vaults where device_id = $1`, [deviceId]);
  }
}

// The ambient-tenant convenience wrappers `listDeviceVaultsForCurrentUser`/
// `deleteDeviceVaultForCurrentUser` — the cloud composition root's
// `/auth/devices` routes import surface — live in `registry.ts` (beside
// `getDeviceVaultStore`), not here: they resolve THROUGH the registry
// getter, mirroring how `packages/server/src/routes/notifications.ts`
// calls `getNotificationStore().listForCurrentUser()` and how
// `collect-tenant-export.ts` resolves every store via the `./registry.js`
// getters — the established pattern for an ambient-only free function
// backing a registered store,
// keeping `setDeviceVaultStore()` a genuine test-injection seam rather than
// dead code. Defining them in THIS file would need to import `getDeviceVaultStore`
// back from `registry.ts`, which already imports `PgDeviceVaultStore` from here —
// an avoidable circular import.
