//
// Per-project PG-data snapshot for M13 backup/restore. A project's on-disk
// directory no longer holds config/strings/runs/glossaries/review-order —
// that data lives in Postgres — so a directory-only backup would miss it and
// a restore would yield a config-less, invisible project. `dumpProject` reads
// the project's PG-owned data through the store ACCESSORS (so it works for
// the cloud multi-tenant adapter too) into a plain `ProjectSnapshot`; M13
// serializes it into the archive (checksummed like every other file).
// `restoreProject` writes it back in ONE transaction with
// raw upserts — it is the single place that knows the per-project table shapes.
//
// PER-PROJECT data only. Templates, translation memory and global config are
// GLOBAL (tenant-scoped, shared across projects) — they are not part of a
// project backup and are deliberately excluded.
import type { Glossary, Project, RunStatus, StringEntry } from '@zercade-dev/narn-shared';
import { globalGlossaryIds } from '../data/global-glossaries/index.js';
import type { ReviewOrderMeta } from './types.js';
import type { Queryable } from './pg/pool.js';
import { withTenantTransaction } from './pg/pool.js';
import { PgGlossaryStore } from './pg-glossary-store.js';
import { PgProjectStore } from './pg-project-store.js';
import { PgReviewOrderStore } from './pg-review-order-store.js';
import { PgRunStore, SIDECAR_KINDS, type SidecarKind } from './pg-run-store.js';
import { PgStringStore } from './pg-string-store.js';
import {
  getGlossaryStore,
  getProjectStore,
  getReviewOrderStore,
  getRunStore,
  getStringStore,
} from './registry.js';

/** One run plus its seven sidecar payloads, keyed by sidecar kind. */
export interface RunSnapshot {
  run: RunStatus;
  sidecars: Record<string, unknown>;
}

/**
 * The full PG-owned state of a single project — everything a restored project
 * needs to be visible and functional. Serialized verbatim into the backup
 * archive as `pg-data.json`.
 */
export interface ProjectSnapshot {
  config: Project;
  strings: StringEntry[];
  runs: RunSnapshot[];
  glossaries: Glossary[];
  glossaryOverrides: Record<string, boolean>;
  reviewOrderMeta: ReviewOrderMeta | null;
}

/**
 * Reads a project's PG-owned data through the store accessors into a
 * `ProjectSnapshot`. Accessor-based (not raw SQL) so it transparently works
 * against whichever store implementation is installed — the local PG default
 * or the cloud multi-tenant adapter.
 *
 * Only the project's OWN glossaries are captured: the static global read-only
 * glossaries live in the registry (never in a project's rows), so they are
 * skipped here; their per-project enabled toggles are carried by
 * `glossaryOverrides` instead.
 *
 * `db` is OPTIONAL and, when passed, opts into a CONSISTENT single-transaction
 * dump (mirrors `restoreProject`'s `db: Queryable` param) instead of the
 * default below (each accessor call its own mini-transaction, so a backup
 * taken mid-run can tear: e.g. capture a `completed` run whose translation
 * isn't yet in the earlier-read `strings`). Passing `db` also collapses the
 * run-sidecar N+1 (one `run_id = any($1)` query instead of one query set per
 * run) — see {@link dumpProjectAtomic}. The registry accessors
 * (`getProjectStore()` etc.) don't expose their underlying client, so the
 * atomic path constructs its own store instances bound to `db` instead of
 * going through the registry; omitting `db` preserves today's exact behavior
 * for every existing caller.
 */
export async function dumpProject(projectId: string, db?: Queryable): Promise<ProjectSnapshot> {
  if (db) return dumpProjectAtomic(projectId, db);

  const projectStore = getProjectStore();
  const stringStore = getStringStore();
  const runStore = getRunStore();
  const glossaryStore = getGlossaryStore();
  const reviewOrderStore = getReviewOrderStore();

  const config = await projectStore.loadProject(projectId);
  const strings = await stringStore.load(projectId);

  // SECURITY: unlike collectTenantExport (account-data export), this reads
  // EVERY run in the project unfiltered — it does not apply the
  // collaborator-own-run rule (mirrored from assertRunVisible in
  // middleware/authz.ts). That is safe ONLY because every route.ts backup
  // route gates on `assertProjectAccess(id, { type: 'manage' })`, and `can()`
  // denies 'manage' to every collaborator — so this function is unreachable
  // by anyone but the project owner today. If a future change ever grants
  // collaborators any backup/snapshot capability, this call must gain the
  // same createdBy filter collectTenantExport applies, or a collaborator's
  // snapshot would leak other members' full run history.
  const runStatuses = await runStore.listRuns(projectId);
  const runs: RunSnapshot[] = [];
  for (const run of runStatuses) {
    const [
      details,
      verdicts,
      judgeLogs,
      sourceReview,
      glossarySuggestions,
      categorySuggestions,
      relinkRetranslate,
    ] = await Promise.all([
      runStore.getRunDetails(projectId, run.runId),
      runStore.getVerdicts(projectId, run.runId),
      runStore.getJudgeLogs(projectId, run.runId),
      runStore.getSourceReview(projectId, run.runId),
      runStore.getGlossarySuggestions(projectId, run.runId),
      runStore.getCategorySuggestions(projectId, run.runId),
      runStore.getRelinkRetranslate(projectId, run.runId),
    ]);
    const sidecars: Record<string, unknown> = {
      // Persist a sidecar only when it carries data, so the restore re-creates
      // exactly the rows the source had (a null/empty payload had no row).
      ...(details !== null ? { details } : {}),
      ...(verdicts.length > 0 ? { verdicts } : {}),
      ...(judgeLogs.length > 0 ? { 'judge-logs': judgeLogs } : {}),
      ...(sourceReview.length > 0 ? { 'source-review': sourceReview } : {}),
      ...(glossarySuggestions.length > 0 ? { 'glossary-suggestions': glossarySuggestions } : {}),
      ...(categorySuggestions.length > 0 ? { 'category-suggestions': categorySuggestions } : {}),
      ...(relinkRetranslate.length > 0 ? { 'relink-retranslate': relinkRetranslate } : {}),
    };
    runs.push({ run, sidecars });
  }

  // Only the project's own glossaries persist as rows. `listGlossaries` already
  // omits stored project-rows for global ids and appends the registry globals;
  // filter those appended globals out so the snapshot mirrors the table exactly.
  const summaries = await glossaryStore.listGlossaries(projectId);
  const glossaries: Glossary[] = [];
  for (const summary of summaries) {
    if (globalGlossaryIds.has(summary.id)) continue;
    glossaries.push(await glossaryStore.getGlossary(projectId, summary.id));
  }
  const glossaryOverrides = await glossaryStore.getEnabledOverrides(projectId);

  const reviewOrderMeta = await reviewOrderStore.getMeta(projectId);

  return { config, strings, runs, glossaries, glossaryOverrides, reviewOrderMeta };
}

/**
 * The `db`-provided variant of {@link dumpProject}: every read runs inside
 * ONE `withTenantTransaction`, so the whole snapshot is consistent (no
 * mid-run tear), and every run's sidecars are fetched with a single
 * `run_id = any($1)` query instead of one query set per run. Constructs its
 * own store instances bound to the transaction client (rather than going
 * through the registry, which doesn't expose the `Queryable` a currently
 * registered store holds) — safe today since every registered store is one of
 * the `Pg*Store` adapters below; produces the exact same `ProjectSnapshot`
 * shape as the default path.
 */
async function dumpProjectAtomic(projectId: string, db: Queryable): Promise<ProjectSnapshot> {
  return withTenantTransaction(db, async (tx) => {
    const projectStore = new PgProjectStore(tx);
    const stringStore = new PgStringStore(tx);
    const runStore = new PgRunStore(tx);
    const glossaryStore = new PgGlossaryStore(tx, {});
    const reviewOrderStore = new PgReviewOrderStore(tx);

    const config = await projectStore.loadProject(projectId);
    const strings = await stringStore.load(projectId);

    // SECURITY: unfiltered like dumpProject's own listRuns call above — see
    // that call site's comment. Safe only while every backup route stays
    // 'manage'-gated (owner-only).
    const runStatuses = await runStore.listRuns(projectId);
    const runIds = runStatuses.map((r) => r.runId);
    // One batched query for every run's sidecars, instead of the seven
    // per-run queries (Promise.all above) times the run count.
    const sidecarRows =
      runIds.length > 0
        ? (
            await tx.query<{ run_id: string; kind: SidecarKind; data: unknown }>(
              'select run_id, kind, data from run_sidecars where run_id = any($1)',
              [runIds],
            )
          ).rows
        : [];
    const sidecarsByRun = new Map<string, Partial<Record<SidecarKind, unknown>>>();
    for (const row of sidecarRows) {
      const bucket = sidecarsByRun.get(row.run_id) ?? {};
      bucket[row.kind] = row.data;
      sidecarsByRun.set(row.run_id, bucket);
    }
    const runs: RunSnapshot[] = runStatuses.map((run) => {
      const raw = sidecarsByRun.get(run.runId) ?? {};
      const sidecars: Record<string, unknown> = {};
      // Same "only when it carries data" filtering as the default path above,
      // in the same SIDECAR_KINDS order so the resulting object's key order
      // matches too: `details` is the lone non-array kind (kept unless null);
      // every other kind is an array (kept unless empty).
      for (const kind of SIDECAR_KINDS) {
        const value = raw[kind];
        if (value === undefined) continue;
        if (kind === 'details') {
          if (value !== null) sidecars[kind] = value;
        } else if (Array.isArray(value) && value.length > 0) {
          sidecars[kind] = value;
        }
      }
      return { run, sidecars };
    });

    const summaries = await glossaryStore.listGlossaries(projectId);
    const glossaries: Glossary[] = [];
    for (const summary of summaries) {
      if (globalGlossaryIds.has(summary.id)) continue;
      glossaries.push(await glossaryStore.getGlossary(projectId, summary.id));
    }
    const glossaryOverrides = await glossaryStore.getEnabledOverrides(projectId);

    const reviewOrderMeta = await reviewOrderStore.getMeta(projectId);

    return { config, strings, runs, glossaries, glossaryOverrides, reviewOrderMeta };
  });
}

/**
 * Writes a `ProjectSnapshot` back into Postgres in ONE tenant-scoped transaction
 * (so a mid-restore failure rolls back cleanly), upserting every per-project
 * table with `on conflict do update`. Raw `$1` SQL mirroring each adapter's
 * columns — this seam is allowed to know the table shapes. `strings.seq`
 * (bigserial) is omitted so the restored rows get fresh,
 * monotonically-increasing sequence values that preserve array order, exactly
 * like `PgProjectStore.duplicateProject`.
 *
 * Runs under `withTenantTransaction` (SET LOCAL ROLE app_user + the
 * `app.user_id` GUC), so the restore is correct under RLS: the owner
 * `project_members` row is inserted FIRST so the `projects` membership-`EXISTS`
 * `WITH CHECK` passes within the same tx, and every `tenant_id` is sourced from
 * `current_setting('app.user_id')` (the current tenant) rather than a hardcoded
 * value. Restore is HTTP-only, so the request's tenant context is present;
 * `withTenantTransaction` is fail-closed (`requireTenant()` throws otherwise).
 */
export async function restoreProject(db: Queryable, snap: ProjectSnapshot): Promise<void> {
  await withTenantTransaction(db, async (tx) => {
    const projectId = snap.config.id;

    // project_members (project_id, user_id, role) — the owner row MUST be
    // inserted BEFORE the projects upsert so the projects membership-`EXISTS`
    // `WITH CHECK` is satisfied within this tx. user_id is the current tenant.
    await tx.query(
      `insert into project_members (project_id, user_id, role)
       values ($1, current_setting('app.user_id'), 'owner')
       on conflict (project_id, user_id) do nothing`,
      [projectId],
    );

    // projects (id, tenant_id, data) — tenant_id is the current tenant.
    await tx.query(
      `insert into projects (id, tenant_id, data)
       values ($1, current_setting('app.user_id'), $2)
       on conflict (id) do update set data = excluded.data`,
      [projectId, JSON.stringify(snap.config)],
    );

    // DELETE-FIRST: clear the project's per-project CHILD rows so the restore
    // REPRODUCES the snapshot exactly instead of MERGING onto whatever is live.
    // Without this, rows present in the live project but absent from the snapshot
    // survive the upserts — restoring a pre-import backup would leave every entry
    // the bad import added, and a snapshot with empty glossaryOverrides / null
    // reviewOrderMeta would leave the stale single row (those writes are skipped
    // below). These deletes are RLS membership-EXISTS-gated, so they run AFTER the
    // project_members insert above; they are all inside this one transaction, so a
    // mid-restore failure still rolls back cleanly. Mirrors
    // PgProjectStore.deleteProject's child sweep MINUS the project/members/
    // active_project/backups rows (the project row + membership must persist, and
    // project_backups are not part of a project snapshot). run_sidecars is FK-less,
    // so it is cleared (by subquery over the project's runs) BEFORE runs.
    await tx.query(
      'delete from run_sidecars where run_id in (select run_id from runs where project_id = $1)',
      [projectId],
    );
    await tx.query('delete from runs where project_id = $1', [projectId]);
    await tx.query('delete from strings where project_id = $1', [projectId]);
    await tx.query('delete from glossaries where project_id = $1', [projectId]);
    await tx.query('delete from glossary_overrides where project_id = $1', [projectId]);
    await tx.query('delete from review_order where project_id = $1', [projectId]);

    // strings (project_id, id, tenant_id, data) — seq omitted (fresh per insert)
    for (const entry of snap.strings) {
      await tx.query(
        `insert into strings (project_id, id, tenant_id, data)
         values ($1, $2, current_setting('app.user_id'), $3)
         on conflict (project_id, id) do update set data = excluded.data`,
        [projectId, entry.id, JSON.stringify(entry)],
      );
    }

    // runs + run_sidecars. Runs are keyed by the global `run_id`; the scalar
    // columns mirror the same fields PgRunStore.upsert writes.
    for (const { run, sidecars } of snap.runs) {
      await tx.query(
        `insert into runs (run_id, project_id, tenant_id, status, kind, total, completed, failed,
            started_at, finished_at, queue_position, source_run_id, ai_score, estimated_cost_usd, data)
         values ($1,$2,current_setting('app.user_id'),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (run_id) do update set
           status=excluded.status, kind=excluded.kind, total=excluded.total, completed=excluded.completed,
           failed=excluded.failed, started_at=excluded.started_at, finished_at=excluded.finished_at,
           queue_position=excluded.queue_position, source_run_id=excluded.source_run_id,
           ai_score=excluded.ai_score, estimated_cost_usd=excluded.estimated_cost_usd, data=excluded.data`,
        [
          run.runId,
          projectId,
          run.status,
          run.kind ?? null,
          run.total,
          run.completed,
          run.failed,
          run.startedAt,
          run.finishedAt ?? null,
          run.queuePosition ?? null,
          run.sourceRunId ?? null,
          run.aiScore ?? null,
          run.estimatedCostUsd ?? null,
          JSON.stringify(run),
        ],
      );
      for (const kind of SIDECAR_KINDS) {
        if (!(kind in sidecars)) continue;
        await tx.query(
          `insert into run_sidecars (run_id, kind, tenant_id, data)
           values ($1, $2, current_setting('app.user_id'), $3)
           on conflict (run_id, kind) do update set data = excluded.data`,
          [run.runId, kind, JSON.stringify(sidecars[kind])],
        );
      }
    }

    // glossaries (project_id, id, tenant_id, data)
    for (const glossary of snap.glossaries) {
      await tx.query(
        `insert into glossaries (project_id, id, tenant_id, data)
         values ($1, $2, current_setting('app.user_id'), $3)
         on conflict (project_id, id) do update set data = excluded.data`,
        [projectId, glossary.id, JSON.stringify(glossary)],
      );
    }

    // glossary_overrides (project_id, tenant_id, overrides) — one row per project
    if (Object.keys(snap.glossaryOverrides).length > 0) {
      await tx.query(
        `insert into glossary_overrides (project_id, tenant_id, overrides)
         values ($1, current_setting('app.user_id'), $2)
         on conflict (project_id) do update set overrides = excluded.overrides`,
        [projectId, JSON.stringify(snap.glossaryOverrides)],
      );
    }

    // review_order (project_id, tenant_id, version, computed_at, count) — one row per project
    if (snap.reviewOrderMeta) {
      await tx.query(
        `insert into review_order (project_id, tenant_id, version, computed_at, count)
         values ($1, current_setting('app.user_id'), $2, $3, $4)
         on conflict (project_id) do update
           set version = excluded.version,
               computed_at = excluded.computed_at,
               count = excluded.count`,
        [
          projectId,
          snap.reviewOrderMeta.version,
          snap.reviewOrderMeta.computedAt,
          snap.reviewOrderMeta.count,
        ],
      );
    }
  });
}
