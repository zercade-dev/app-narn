import {
  RunStatusCode,
  type RunStatus,
  type RunDetails,
  type JudgeVerdictRecord,
  type JudgeLogEntry,
  type GlossarySuggestion,
  type CategorySuggestion,
} from '@zercade-dev/narn-shared';
import { KeyedAsyncLock } from '../utils/keyed-lock.js';
import type { Queryable } from './pg/pool.js';
import { withTransaction } from './pg/pool.js';
import { getCurrentTenant } from './pg/tenant-context.js';
import { runEvents } from '../http/run-events.js';
import type { RunStore, SourceReviewRecord, RelinkRetranslateRecord } from './types.js';

/**
 * The sidecar payload kinds, one row each per `(run_id, kind)` — the single
 * canonical list. `SidecarKind` is DERIVED from this array (not declared
 * independently) so the type and the runtime list can never drift apart.
 * `project-snapshot.ts` (full-project backup/restore) and
 * `collect-tenant-export.ts` (data-portability export) both import this
 * array rather than keeping their own copy — a stale local copy in
 * `project-snapshot.ts` once silently dropped `relink-retranslate` from
 * every backup.
 */
export const SIDECAR_KINDS = [
  'details',
  'verdicts',
  'judge-logs',
  'source-review',
  'glossary-suggestions',
  'category-suggestions',
  'relink-retranslate',
] as const;

export type SidecarKind = (typeof SIDECAR_KINDS)[number];

/**
 * Postgres-backed RunStore: one row per run in `runs`, the whole RunStatus
 * stored in `data jsonb` with scalar write-mirror columns (status/kind/
 * timestamps/queue_position/…) for ordering and filtering — reads return `data`
 * so the JS-number timestamps round-trip intact (the bigint columns are never
 * reconstructed into the read model). The seven large per-run payloads persist in
 * `run_sidecars`, one row per `(run_id, kind)`, mirroring the file store's
 * `<kind>-<runId>.json` sidecars and keeping the hot-path progress upserts
 * small. No `ProjectStore`/`getProjectDir` dependency — runs no longer own an
 * on-disk directory, and route handlers validate the project before reaching
 * the store, so there is no `loadProject` pre-check. `forceCancel`'s semantics
 * are transcribed verbatim from M22.
 */
export class PgRunStore implements RunStore {
  private readonly db: Queryable;
  // Serializes writes per project so concurrent run-progress upserts for the
  // same project never interleave — the same per-project guarantee M22's lock
  // gave the file store.
  // DEPLOY INVARIANT: in-process only — correct at exactly ONE server replica.
  // See the KeyedAsyncLock doc (utils/keyed-lock.ts) before scaling out.
  private readonly writeLock = new KeyedAsyncLock();

  constructor(db: Queryable) {
    this.db = db;
  }

  /**
   * Updates an existing run or inserts a new one. Upsert keyed on `run_id`; all
   * scalar columns are mirrored from `run` and `data` holds the whole RunStatus.
   * Under the per-project write lock to serialize concurrent progress writes.
   */
  async updateRun(projectId: string, run: RunStatus): Promise<void> {
    await this.writeLock.withLock(projectId, () => this.upsert(run));
    // Emit AFTER the locked persist resolves (never inside `upsert`), so
    // `forceCancel` — which persists via `upsert` directly under the same lock —
    // emits exactly once at its own call site rather than twice. Fire-and-forget:
    // `emitProgress` swallows listener errors, so a broken SSE relay can never
    // reject a run's progress write. The tenant stamp mirrors `LogEntry.tenantId`
    // (captured here in the emitter's async context) so the relay can scope by
    // tenant in cloud mode; undefined in open-core.
    runEvents.emitProgress({
      runId: run.runId,
      projectId: run.projectId,
      status: run.status,
      completed: run.completed,
      failed: run.failed,
      total: run.total,
      tenantId: getCurrentTenant()?.userId,
    });
  }

  /**
   * The bare upsert, without the write lock — so a caller that already holds the
   * per-project lock (`forceCancel`) can persist without deadlocking on the
   * non-reentrant {@link KeyedAsyncLock}. `updateRun` wraps this under the lock.
   * `db` defaults to `this.db`; `forceCancel` passes its transaction so the
   * read-modify-write shares one tenant tx (one role/GUC setup, atomic).
   */
  private async upsert(run: RunStatus, db: Queryable = this.db): Promise<void> {
    // created_by is stamped inline from the GUC (never a param — see
    // project_backups' precedent) and deliberately absent from DO UPDATE SET:
    // the enqueue-time ambient tenant is the creator, and later status
    // flushes must never reassign it.
    await db.query(
      `insert into runs (run_id, project_id, tenant_id, status, kind, total, completed, failed,
          started_at, finished_at, queue_position, source_run_id, ai_score, estimated_cost_usd, data, created_by)
       values ($1,$2,current_setting('app.user_id'),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,current_setting('app.user_id'))
       on conflict (run_id) do update set
         status=excluded.status, kind=excluded.kind, total=excluded.total, completed=excluded.completed,
         failed=excluded.failed, started_at=excluded.started_at, finished_at=excluded.finished_at,
         queue_position=excluded.queue_position, source_run_id=excluded.source_run_id,
         ai_score=excluded.ai_score, estimated_cost_usd=excluded.estimated_cost_usd, data=excluded.data`,
      [
        run.runId,
        run.projectId,
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
  }

  /** Lists all runs for a project, ordered by start time. */
  async listRuns(projectId: string): Promise<RunStatus[]> {
    const { rows } = await this.db.query<{ data: RunStatus; created_by: string | null }>(
      'select data, created_by from runs where project_id = $1 order by started_at',
      [projectId],
    );
    return rows.map((r) => this.overlayCreatedBy(r.data, r.created_by));
  }

  /**
   * Count of the current tenant's non-terminal runs across all their projects.
   * `this.db` is a tenant-scoped {@link TenantDb}, so RLS scopes the count to
   * this tenant (no explicit tenant filter). The `::int` cast makes node-pg /
   * pglite return a JS number for `count(*)`.
   */
  async countActiveRuns(): Promise<number> {
    const { rows } = await this.db.query<{ n: number }>(
      "select count(*)::int as n from runs where status in ('pending', 'queued', 'running', 'paused')",
    );
    return rows[0] ? Number(rows[0].n) : 0;
  }

  /**
   * Retrieves a specific run by id; null when absent. Project-scoped (RLS scopes
   * by membership; no explicit tenant filter — historically unfiltered, now
   * covered uniformly by membership RLS). `db` defaults to `this.db`;
   * `forceCancel` passes its transaction so the read-modify-write is atomic.
   */
  async getRun(
    projectId: string,
    runId: string,
    db: Queryable = this.db,
  ): Promise<RunStatus | null> {
    const { rows } = await db.query<{ data: RunStatus; created_by: string | null }>(
      'select data, created_by from runs where run_id = $1 and project_id = $2',
      [runId, projectId],
    );
    const row = rows[0];
    return row ? this.overlayCreatedBy(row.data, row.created_by) : null;
  }

  /**
   * Overlays the GUC-stamped `created_by` mirror column over the parsed
   * `data` jsonb's own `createdBy` field — the column wins (it can never be
   * spoofed by a stale/forged JS object), but legacy rows persisted before
   * migration 0024 have a null column and fall back to whatever `data`
   * carries (typically also absent, per the field's own doc comment).
   */
  private overlayCreatedBy(data: RunStatus, createdBy: string | null): RunStatus {
    return { ...data, createdBy: createdBy ?? data.createdBy };
  }

  /**
   * Distinct project ids with a run `created_by` some OTHER tenant than the
   * caller — RLS (the `runs` tenant_isolation policy, membership-scoped)
   * already limits rows to projects the caller is a member of, so no
   * explicit project filter is needed here.
   */
  async listProjectsWithForeignRuns(): Promise<string[]> {
    const { rows } = await this.db.query<{ project_id: string }>(
      `select distinct project_id from runs
       where created_by is not null and created_by <> current_setting('app.user_id', true)`,
    );
    return rows.map((r) => r.project_id);
  }

  /**
   * Force a persisted run into the terminal `Cancelled` state. Recovery path
   * for "stuck" runs the in-memory engines no longer hold. No-op (returns the
   * existing run unchanged) when already terminal; returns `null` when no such
   * run exists. Terminal-check + mutation transcribed verbatim from
   * M22.forceCancel — only the persistence layer (an upsert vs. a list rewrite)
   * differs. Runs under the per-project write lock, and the read-modify-write is
   * wrapped in one tenant transaction (`withTransaction` unwraps the `TenantDb`
   * to a single role/GUC setup) so the getRun→upsert pair is atomic.
   */
  async forceCancel(projectId: string, runId: string): Promise<RunStatus | null> {
    const run = await this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const run = await this.getRun(projectId, runId, tx);
        if (!run) return null;

        if (
          run.status === RunStatusCode.Completed ||
          run.status === RunStatusCode.Failed ||
          run.status === RunStatusCode.Cancelled
        ) {
          return run; // already terminal — nothing to cancel
        }

        run.status = RunStatusCode.Cancelled;
        run.finishedAt = Date.now();
        delete run.queuePosition;

        // Persist via the unlocked upsert — we already hold this project's lock,
        // and the lock is not reentrant (calling updateRun here would deadlock).
        await this.upsert(run, tx);
        return run;
      }),
    );
    // forceCancel persists via `upsert` (not `updateRun`), bypassing that path's
    // emit — so relay the transition here. Emitting on any non-null result (incl.
    // the already-terminal no-op) is harmless: the client re-applies the same
    // terminal state, which the relay flushes immediately. Null = no such run.
    if (run) {
      runEvents.emitProgress({
        runId: run.runId,
        projectId: run.projectId,
        status: run.status,
        completed: run.completed,
        failed: run.failed,
        total: run.total,
        tenantId: getCurrentTenant()?.userId,
      });
    }
    return run;
  }

  // --- generic sidecar helpers ---

  /**
   * Generic sidecar write: upserts the whole `data` payload for `(run_id, kind)`.
   * Backs the typed `save*` wrappers below. `db` defaults to `this.db`;
   * `updateSidecar` passes its transaction so the read-modify-write shares one
   * tenant tx (one role/GUC setup, atomic).
   */
  private async saveSidecar(
    runId: string,
    kind: SidecarKind,
    data: unknown,
    db: Queryable = this.db,
  ): Promise<void> {
    await db.query(
      `insert into run_sidecars (run_id, kind, tenant_id, data) values ($1,$2,current_setting('app.user_id'),$3)
       on conflict (run_id, kind) do update set data = excluded.data`,
      [runId, kind, JSON.stringify(data)],
    );
  }

  /**
   * Generic sidecar read: returns the stored `data`, or `fallback` when no row
   * exists for `(run_id, kind)`. Backs the typed `get*` wrappers below. `db`
   * defaults to `this.db`; `updateSidecar` passes its transaction so the
   * read-modify-write is atomic.
   */
  private async getSidecar<T>(
    runId: string,
    kind: SidecarKind,
    fallback: T,
    db: Queryable = this.db,
  ): Promise<T> {
    const { rows } = await db.query<{ data: T }>(
      'select data from run_sidecars where run_id = $1 and kind = $2',
      [runId, kind],
    );
    return rows[0]?.data ?? fallback;
  }

  /**
   * Atomic sidecar read-modify-write: under the same per-project {@link writeLock}
   * `updateRun`/`forceCancel` use, in one tenant transaction (`withTransaction`
   * unwraps the `TenantDb` to a single role/GUC setup), select the current
   * payload, apply `mutate`, and upsert the result — so two concurrent callers
   * (two reviewers, a double-click, a `suggestVerdict` racing a judge flush) can
   * never lose one another's edit, the way the callers' former unlocked
   * get→mutate→save did (both read the same array, the last save clobbered the
   * other). `mutate` returning `undefined` means "no change" — the upsert is
   * skipped and the current payload returned unchanged (the caller's 404 paths,
   * which must not write). A throwing `mutate` rolls the transaction back and
   * propagates, persisting nothing. Backs the typed `update*` wrappers below.
   */
  private async updateSidecar<T>(
    projectId: string,
    runId: string,
    kind: SidecarKind,
    fallback: T,
    mutate: (current: T) => T | undefined,
  ): Promise<T> {
    return this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const current = await this.getSidecar<T>(runId, kind, fallback, tx);
        const next = mutate(current);
        if (next !== undefined) await this.saveSidecar(runId, kind, next, tx);
        return next ?? current;
      }),
    );
  }

  async saveJudgeLogs(_projectId: string, runId: string, logs: JudgeLogEntry[]): Promise<void> {
    await this.saveSidecar(runId, 'judge-logs', logs);
  }

  async getJudgeLogs(_projectId: string, runId: string): Promise<JudgeLogEntry[]> {
    return this.getSidecar<JudgeLogEntry[]>(runId, 'judge-logs', []);
  }

  async saveRunDetails(_projectId: string, runId: string, details: RunDetails): Promise<void> {
    await this.saveSidecar(runId, 'details', details);
  }

  async getRunDetails(_projectId: string, runId: string): Promise<RunDetails | null> {
    return this.getSidecar<RunDetails | null>(runId, 'details', null);
  }

  async saveVerdicts(
    _projectId: string,
    runId: string,
    verdicts: JudgeVerdictRecord[],
  ): Promise<void> {
    await this.saveSidecar(runId, 'verdicts', verdicts);
  }

  async getVerdicts(_projectId: string, runId: string): Promise<JudgeVerdictRecord[]> {
    return this.getSidecar<JudgeVerdictRecord[]>(runId, 'verdicts', []);
  }

  async updateVerdicts(
    projectId: string,
    runId: string,
    mutate: (current: JudgeVerdictRecord[]) => JudgeVerdictRecord[] | undefined,
  ): Promise<JudgeVerdictRecord[]> {
    return this.updateSidecar<JudgeVerdictRecord[]>(projectId, runId, 'verdicts', [], mutate);
  }

  async saveSourceReview(
    _projectId: string,
    runId: string,
    records: SourceReviewRecord[],
  ): Promise<void> {
    await this.saveSidecar(runId, 'source-review', records);
  }

  async getSourceReview(_projectId: string, runId: string): Promise<SourceReviewRecord[]> {
    return this.getSidecar<SourceReviewRecord[]>(runId, 'source-review', []);
  }

  async updateSourceReview(
    projectId: string,
    runId: string,
    mutate: (current: SourceReviewRecord[]) => SourceReviewRecord[] | undefined,
  ): Promise<SourceReviewRecord[]> {
    return this.updateSidecar<SourceReviewRecord[]>(projectId, runId, 'source-review', [], mutate);
  }

  /**
   * Removes `entryId` from the `verdicts` and `source-review` sidecar arrays
   * across every run in `projectId`, in one statement — cheaper than loading
   * every run id first and looping `updateSidecar` per run. `run_sidecars` has
   * no `project_id` column (see the 0007_runs migration), so the subquery
   * joins through `runs`. Under the per-project write lock so this can't race
   * a concurrent `updateVerdicts`/`updateSourceReview` read-modify-write.
   */
  async deleteSidecarsForEntry(projectId: string, entryId: string): Promise<void> {
    await this.writeLock.withLock(projectId, () =>
      this.db.query(
        `update run_sidecars
           set data = coalesce(
             (select jsonb_agg(elem) from jsonb_array_elements(data) elem where elem->>'entryId' <> $2),
             '[]'::jsonb
           )
         where kind in ('verdicts', 'source-review')
           and run_id in (select run_id from runs where project_id = $1)
           and data @> jsonb_build_array(jsonb_build_object('entryId', $2::text))`,
        [projectId, entryId],
      ),
    );
  }

  async saveGlossarySuggestions(
    _projectId: string,
    runId: string,
    suggestions: GlossarySuggestion[],
  ): Promise<void> {
    await this.saveSidecar(runId, 'glossary-suggestions', suggestions);
  }

  async getGlossarySuggestions(_projectId: string, runId: string): Promise<GlossarySuggestion[]> {
    return this.getSidecar<GlossarySuggestion[]>(runId, 'glossary-suggestions', []);
  }

  async saveCategorySuggestions(
    _projectId: string,
    runId: string,
    suggestions: CategorySuggestion[],
  ): Promise<void> {
    await this.saveSidecar(runId, 'category-suggestions', suggestions);
  }

  async getCategorySuggestions(_projectId: string, runId: string): Promise<CategorySuggestion[]> {
    return this.getSidecar<CategorySuggestion[]>(runId, 'category-suggestions', []);
  }

  async saveRelinkRetranslate(
    _projectId: string,
    runId: string,
    records: RelinkRetranslateRecord[],
  ): Promise<void> {
    await this.saveSidecar(runId, 'relink-retranslate', records);
  }

  async getRelinkRetranslate(
    _projectId: string,
    runId: string,
  ): Promise<RelinkRetranslateRecord[]> {
    return this.getSidecar<RelinkRetranslateRecord[]>(runId, 'relink-retranslate', []);
  }
}
