import type { Queryable } from './pg/pool.js';
import type { ReviewOrderMeta, ReviewOrderStore } from './types.js';

/**
 * Adapter for the review-order "last sorted" META. The `tenant_id` is sourced
 * from the `app.user_id` GUC the `TenantDb` wrapper sets (RLS scopes reads by
 * project membership). One row per project keyed `(project_id)`; the per-entry
 * `reviewSortIndex` lives in `strings.data` (via StringStore), not here.
 */
export class PgReviewOrderStore implements ReviewOrderStore {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  async getMeta(projectId: string): Promise<ReviewOrderMeta | null> {
    const { rows } = await this.db.query<{
      version: number;
      computed_at: string | number;
      count: number;
    }>('select version, computed_at, count from review_order where project_id = $1', [projectId]);
    const r = rows[0];
    if (!r) return null;
    // `computed_at` is a `bigint` column — `pg` returns it as a string, so coerce
    // to a JS number (pglite already returns a number; Number() is a no-op there).
    return { version: r.version, computedAt: Number(r.computed_at), count: r.count };
  }

  async saveMeta(projectId: string, meta: ReviewOrderMeta): Promise<void> {
    await this.db.query(
      `insert into review_order (project_id, tenant_id, version, computed_at, count)
       values ($1, current_setting('app.user_id'), $2, $3, $4)
       on conflict (project_id) do update
         set version = excluded.version,
             computed_at = excluded.computed_at,
             count = excluded.count`,
      [projectId, meta.version, meta.computedAt, meta.count],
    );
  }
}
