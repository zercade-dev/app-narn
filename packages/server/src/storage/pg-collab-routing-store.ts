import type { Queryable } from './pg/pool.js';
import type { CollabRoutingConfig, CollabRoutingStore } from './types.js';

/**
 * PG-backed per-user collaboration routing store (migration 0025). One row
 * per tenant (`tenant_id` primary key), like `workspace_settings` —
 * `get`/`save` are a plain read / whole-document upsert, RLS-scoped by the
 * `app.user_id` GUC (mirrors PgGlobalConfigStore's `workspace_settings`
 * read/write, minus the in-process cache: this document
 * is read far less often, so a cache isn't worth the invalidation surface).
 */
export class PgCollabRoutingStore implements CollabRoutingStore {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  async get(): Promise<CollabRoutingConfig | null> {
    // No explicit WHERE — RLS confines this to (at most) the ambient tenant's
    // own row, exactly like PgGlobalConfigStore's `select data from
    // workspace_settings`.
    const { rows } = await this.db.query<{ config: CollabRoutingConfig }>(
      'select config from collab_routing',
    );
    return rows[0]?.config ?? null;
  }

  async save(config: CollabRoutingConfig): Promise<CollabRoutingConfig> {
    await this.db.query(
      `insert into collab_routing (tenant_id, config)
       values (current_setting('app.user_id'), $1)
       on conflict (tenant_id) do update set config = excluded.config, updated_at = now()`,
      [JSON.stringify(config)],
    );
    return config;
  }
}
