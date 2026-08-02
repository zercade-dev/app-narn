/**
 * Manual-edit audit trail read API.
 *
 * GET /api/projects/:projectId/manual-edits — the non-expired `manual_edits`
 * rows for a project, newest-first, source-joined for a preview.
 * Owners see every row; collaborators see only edits THEY made (mirrors
 * `runsRouter`'s `GET /:projectId/runs` own-scoping for the same role).
 * `assertProjectAccess` is the app-layer 404-for-non-member gate and also
 * resolves the caller's role for that filter; the `manual_edits` RLS policy
 * (tenant_isolation, scoped through `project_members`) covers the query
 * itself as defense-in-depth.
 *
 * Mounted ungated (no `requireUnlockedVault`): this reads already-stored,
 * non-secret audit data and must work with a locked vault, same reasoning as
 * `runsRouter`/`reportsRouter`.
 */
import { Router } from 'express';
import { getPool, TenantDb } from '../storage/pg/pool.js';
import { assertProjectAccess } from '../middleware/authz.js';
import { requireTenant } from '../storage/pg/tenant-context.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { maybeSweepExpiredManualEdits } from '../modules/manual-edit-sweep.js';

export const manualEditsRouter: Router = Router();

// Validate the project id against path traversal (matches runs/classify/orphans).
manualEditsRouter.param('projectId', projectIdParam);

/**
 * Row shape as returned by `pg`/pglite. `strings.id`/`strings.data` come from
 * the LEFT JOIN and are null when the source entry no longer exists (deleted
 * after the edit was recorded). `created_at` is a `timestamptz` → JS `Date`
 * (mirrors PgNotificationStore).
 */
interface ManualEditRow {
  id: string;
  entry_id: string;
  entry_key: string | null;
  source_preview: string | null;
  language: string;
  before_text: string | null;
  after_text: string;
  created_by: string;
  created_at: Date;
}

/**
 * GET /:projectId/manual-edits
 * Non-expired manual edits for the project, newest-first, capped at 500.
 * Owners get every row; collaborators only their own (`created_by` = caller).
 * `entryKey` mirrors the joined string's own `id` (== `entryId` while the
 * source entry still exists) and falls back to `entryId` once the entry has
 * been deleted (LEFT JOIN miss); `sourcePreview` is null in that same case.
 */
manualEditsRouter.get(
  '/:projectId/manual-edits',
  asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const access = await assertProjectAccess(projectId, { type: 'read' });

    // Cheap, lazy retention trigger — fire-and-forget so it never delays the
    // response (see manual-edit-sweep.ts for the throttle).
    void maybeSweepExpiredManualEdits();

    const db = new TenantDb(getPool());
    const params: unknown[] = [projectId];
    let ownFilter = '';
    if (access.role === 'collaborator') {
      params.push(requireTenant().userId);
      ownFilter = ' and me.created_by = $2';
    }

    const { rows } = await db.query<ManualEditRow>(
      `select me.id, me.entry_id, coalesce(s.id, me.entry_id) as entry_key,
              s.data->>'sourceText' as source_preview,
              me.language, me.before_text, me.after_text, me.created_by, me.created_at
       from manual_edits me
       left join strings s on s.project_id = me.project_id and s.id = me.entry_id
       where me.project_id = $1 and me.expires_at > now()${ownFilter}
       order by me.created_at desc
       limit 500`,
      params,
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        entryId: r.entry_id,
        entryKey: r.entry_key ?? r.entry_id,
        sourcePreview: r.source_preview,
        language: r.language,
        beforeText: r.before_text,
        afterText: r.after_text,
        createdBy: r.created_by,
        createdAt: r.created_at.toISOString(),
      })),
    );
  }),
);
