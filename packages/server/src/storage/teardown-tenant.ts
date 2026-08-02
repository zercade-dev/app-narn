import { runWithTenant } from './pg/tenant-context.js';
import { getPool, withTenantTransaction, type Queryable } from './pg/pool.js';

/**
 * RLS-visibility-safe deletion order. Every DELETE is WHERE-less: it runs as the
 * non-owner `app_user` role under the tenant GUC, so each table's RLS USING
 * clause confines the delete to the rows THIS tenant owns (project-scoped via
 * `project_members`; user-global via the `app.user_id` GUC). The owner/superuser
 * would bypass RLS — `withTenantTransaction` guarantees we never run as it.
 *
 * Order matters because some tables' RLS visibility DEPENDS on others, and a row
 * the tenant can no longer SEE cannot be deleted:
 *   - `run_sidecars` visibility is "a tenant-visible parent run exists" → it must
 *     be deleted BEFORE `runs` (delete runs first and the sidecars orphan).
 *   - every project-scoped table is visible only via a `project_members` row →
 *     `project_members` MUST be deleted LAST (drop it first and projects,
 *     strings, glossaries, runs, … all vanish from view, un-deletable).
 *   - the user-global tables (templates, translation_memory, …) are scoped by the
 *     GUC alone, so their relative order is free; they sit between `projects` and
 *     `project_members`.
 *
 * This list IS the erase contract: every table with `enable row level security`
 * in `migrations.ts` must appear here (cross-checked: all 21 do).
 */
const DELETE_ORDER: readonly string[] = [
  // project-scoped — children before parents, all before project_members
  'run_sidecars',
  'runs',
  'review_order',
  'strings',
  'glossary_overrides',
  'glossaries',
  'project_backups',
  'projects',
  // user-global (GUC-scoped) — order-independent
  'templates',
  'collab_routing',
  'translation_memory',
  'module_instances',
  'module_configs',
  'workspace_settings',
  'global_config_meta',
  'active_project',
  'device_vaults',
  'policy_acceptances',
  'account_deletion_tokens',
  'notifications',
  // user-scoped membership anchor — MUST be last (every project-scoped policy
  // above resolves visibility through it)
  'project_members',
];

/**
 * Upper bound on convergence passes. Each pass is a full atomic sweep; a healthy
 * erase finishes in ONE pass (nothing else is writing), and even a lively
 * straggler is caught within a couple. Hitting this cap means rows are STILL
 * being produced faster than we can sweep them — a contract breach the caller
 * must see (we throw), never a silent partial erase.
 */
const MAX_SWEEP_PASSES = 10;

/**
 * Removes ONLY this tenant's `role = 'collaborator'` project_members rows —
 * never their `role = 'owner'` rows, and never any other tenant's row. See
 * the COLLABORATION note on {@link teardownTenant} for why this must run
 * before the generic DELETE_ORDER sweep, each pass.
 */
async function relinquishCollaboratorMemberships(tx: Queryable): Promise<number> {
  const { rows } = await tx.query(
    `delete from project_members
       where user_id = current_setting('app.user_id') and role = 'collaborator'
       returning 1`,
  );
  return rows.length;
}

/**
 * Irreversibly erase every row belonging to `userId`. Runs as the RLS-enforced
 * `app_user` role under the tenant GUC (via `runWithTenant` + `withTenantTransaction`),
 * so it is STRUCTURALLY incapable of touching another user's data — the database
 * refuses rows outside the tenant; there is no WHERE clause to get wrong and no
 * way to widen the blast radius from the app layer.
 *
 * Atomic per pass + converge-until-zero. The whole `DELETE_ORDER` sweep runs
 * inside ONE `withTenantTransaction` so the order-dependent RLS visibility holds
 * across all 21 deletes and each pass is all-or-nothing (a mid-sweep failure
 * rolls the pass back rather than leaving a half-erased tenant). That single-pass
 * transaction is then repeated in a bounded outer loop, summing the rows deleted
 * across the 21 statements, and STOPS the first pass that deletes zero. Because
 * each pass is its OWN transaction, a row a concurrent writer COMMITS after an
 * earlier pass began is picked up and swept by a later pass — the convergence
 * that shrinks the concurrent-writer window a single non-atomic sweep leaves
 * open. If rows are still being deleted at `MAX_SWEEP_PASSES`, we THROW (a
 * non-converged erase is a contract breach the caller must surface / retry), and
 * never silently return a partial erase.
 *
 * RESIDUAL (see also account-routes.ts): a run-scoped straggler (e.g. a
 * background engine's `updateRun`) that a concurrent process commits into a
 * *membership-dependent* table AFTER a pass has already deleted `project_members`
 * becomes RLS-invisible to this tenant and cannot be reached by a later pass — so
 * the complete guarantee still relies on the caller draining in-flight runs
 * before invoking this. This function deliberately does NOT cancel runs itself
 * (storage must never depend on the engine layer); the drain belongs in the
 * caller. See the deferral note in the block report for why a per-tenant
 * cancel-all is not wired here (process-local engine maps + no cross-engine
 * cancel API). The atomic-per-pass sweep narrows that window from milliseconds to
 * microseconds and fully closes it for the GUC-scoped (non-membership) tables.
 *
 * Idempotent: a re-run on an already-erased tenant deletes zero rows and returns
 * cleanly in ONE pass. Refuses an empty/blank `userId` up front (a blank
 * `app.user_id` GUC is the one value the RLS policies treat as "match nothing",
 * so guarding it is belt-and-braces against a no-op-that-looks-like-success).
 *
 * `${table}` is interpolated ONLY from the hard-coded `DELETE_ORDER` allowlist,
 * never from user input → not a SQL-injection surface.
 *
 * COLLABORATION: the generic sweep is WHERE-less and relies entirely on RLS
 * to scope every project-data delete to "a project_members row exists for
 * this user_id" — and that policy makes no role distinction,
 * so a `collaborator` is exactly as visible/deletable as an `owner`. Left
 * unguarded, deleting a collaborator's account would hard-delete every
 * project they merely COLLABORATE on in full — the owner's config, strings,
 * glossaries, runs, and backups — not just sever the collaborator's own
 * membership. {@link relinquishCollaboratorMemberships} runs BEFORE this
 * sweep each pass and removes ONLY this tenant's `role = 'collaborator'`
 * membership rows: once that row is gone, RLS makes the project's content
 * invisible to this tenant for the rest of the pass, so the generic
 * per-table deletes below naturally skip it — the owner's project survives
 * untouched. Projects this tenant OWNS are unaffected (their `role =
 * 'owner'` row is left standing until DELETE_ORDER's own trailing
 * `project_members` delete, by which point that project's content has
 * already been hard-deleted as intended).
 */
export async function teardownTenant(userId: string): Promise<void> {
  if (!userId || !userId.trim()) throw new Error('teardownTenant: empty userId');
  // Use the trimmed id so a padded value can't silently no-op: a stray-whitespace
  // `app.user_id` GUC matches nothing under RLS, which would look like a clean
  // (zero-row) erase instead of a real one.
  const uid = userId.trim();
  await runWithTenant({ userId: uid }, async () => {
    for (let pass = 1; pass <= MAX_SWEEP_PASSES; pass++) {
      // One atomic pass: the relinquish + all 21 deletes share a single
      // role/GUC setup and one transaction, so the order-dependent RLS
      // visibility holds and the pass is all-or-nothing. `returning 1` yields
      // one row per deleted row, so `rows.length` is the pass's per-statement
      // delete count (portable across pg and pglite, which the Queryable
      // interface does not expose a rowCount for).
      const deleted = await withTenantTransaction(getPool(), async (tx) => {
        // MUST run before DELETE_ORDER — see the doc comment above.
        let total = await relinquishCollaboratorMemberships(tx);
        for (const table of DELETE_ORDER) {
          const { rows } = await tx.query(`delete from ${table} returning 1`); // RLS-scoped
          total += rows.length;
        }
        return total;
      });
      if (deleted === 0) return; // converged — this tenant has no rows left to sweep
    }
    // Still deleting after the cap: something keeps committing this tenant's rows.
    // Surface it — a non-converged erase must NOT masquerade as a clean deletion.
    throw new Error(
      `teardownTenant: erase did not converge after ${MAX_SWEEP_PASSES} passes — ` +
        'a concurrent writer is still producing rows; drain in-flight runs and retry',
    );
  });
}
