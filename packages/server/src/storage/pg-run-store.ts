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
 * Default row cap for {@link PgRunStore.listRunSummaries} — see that method's
 * doc for why this bounds only the terminal/historical tail, never an active
 * run. 300 is deliberately generous: it comfortably covers a project's whole
 * practical history (the Activity tab's own newest-first dropdown caps at 20 —
 * `selectRecentRuns` in `RunFilterSelect.tsx`), while still turning the
 * previously-unbounded row count (X2-06: every run a project has EVER had,
 * every 2s poll, including one row per AI chat session) into a fixed ceiling.
 */
const DEFAULT_RUN_LIST_LIMIT = 300;

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

  /**
   * Lists all runs for a project, ordered by start time, as FULL records.
   * Callers that write a run back (snapshot/backup, tenant export, the M9
   * orphan sweep, chat-usage, the revert route's multi-run guard) must use
   * this, never {@link listRunSummaries} — a summary fed through `updateRun`
   * would erase that run's `request` and its parked pairs for good.
   */
  async listRuns(projectId: string): Promise<RunStatus[]> {
    const { rows } = await this.db.query<{ data: RunStatus; created_by: string | null }>(
      'select data, created_by from runs where project_id = $1 order by started_at',
      [projectId],
    );
    return rows.map((r) => this.overlayCreatedBy(r.data, r.created_by));
  }

  /**
   * The same list in its SUMMARY shape, for the two-second-polled
   * `GET /api/projects/:projectId/runs`. Two payloads inside `RunStatus` grow
   * with the size of the WORK rather than of the run record, and no client
   * reads either one from the list:
   *   - `request.entryIds` — up to MAX_ENTRY_IDS (50 000) 64-char content ids,
   *     roughly 3.3 MB, recorded on every translation run and never cleared; and
   *   - `waitingForQuota.pairs` — one object per parked (entry, language) job,
   *     which survives even on a cancelled run.
   * Both are removed IN SQL, so they never cross the wire from Postgres and are
   * never parsed into JS; the parked-pair size is projected out separately as
   * `waitingForQuota.pairCount`, the only thing the Activity tab reads off
   * `pairs`. EVERY other field comes back verbatim — this is a jsonb
   * subtraction, not a column projection — so `usageByModule`, `judgeSummary`,
   * `chatSummary`, `errors`, `skipReason`, `aiScore`, `estimatedCostUsd` and
   * `queuePosition` are all still there and the tab renders unchanged.
   *
   * The `jsonb_typeof` guard keeps a run with no park — or a legacy row whose
   * `pairs` is not an array — from erroring inside `jsonb_array_length`.
   *
   * **Row count is bounded (X2-06)**, unlike {@link listRuns}: this backs
   * `GET /api/projects/:id/runs`, which the frontend re-polls every
   * `POLL_BASE_MS` (2s) for as long as any run is active, and the table grows
   * monotonically — nothing ever deletes a run row except project deletion and
   * snapshot restore, and every AI chat session mints one too. Unbounded, that
   * poll eventually reads every run a project has ever had.
   *
   * The bound is NOT a plain `ORDER BY started_at DESC LIMIT n` — that would
   * reintroduce a worse bug than the one it fixes. The frontend's poll control
   * loop (`fetchRuns` in `run-store.ts`) computes `anyActive` and diffs
   * failure transitions over the WHOLE returned list; a queued run can have an
   * old `started_at` (it was queued behind others) while unrelated newer runs
   * (including chat-usage rows) push it off a naive top-N page, so the client
   * would see an empty/all-terminal page, conclude nothing is active, and stop
   * polling a run that is still genuinely running server-side.
   *
   * So every NON-terminal run (pending/queued/running/paused — same set
   * {@link countActiveRuns} uses) is always included, with no limit — the
   * limit applies only to the terminal tail, via a `run_id in (...)`
   * subquery bounded to the newest `limit` rows overall. A run can therefore
   * only ever be excluded once it is terminal, at which point the poller no
   * longer needs to observe it — it was already delivered its terminal state
   * (via this same query, or via the SSE fast path `applyProgressEvent`
   * consumes, which fires unconditionally on every status write regardless of
   * whether the run stays on this list — see `runEvents.emitProgress`).
   */
  async listRunSummaries(projectId: string, limit = DEFAULT_RUN_LIST_LIMIT): Promise<RunStatus[]> {
    const { rows } = await this.db.query<{
      data: RunStatus;
      waiting_pair_count: number;
      created_by: string | null;
    }>(
      `select
         (data #- '{request}') #- '{waitingForQuota,pairs}' as data,
         case when jsonb_typeof(data #> '{waitingForQuota,pairs}') = 'array'
              then jsonb_array_length(data #> '{waitingForQuota,pairs}')
              else 0 end as waiting_pair_count,
         created_by
       from runs
       where project_id = $1
         and (
           status in ('pending', 'queued', 'running', 'paused')
           or run_id in (
             select run_id from runs where project_id = $1 order by started_at desc limit $2
           )
         )
       order by started_at`,
      [projectId, limit],
    );
    return rows.map((r) => {
      const status = this.overlayCreatedBy(r.data, r.created_by);
      // `#-` deleted the key outright, but `pairs` is non-optional on the type
      // (and a frontend bundle predating `pairCount` still reads `pairs.length`),
      // so re-seat a well-typed empty array and carry the real size alongside it.
      if (status.waitingForQuota) {
        status.waitingForQuota = {
          ...status.waitingForQuota,
          pairs: [],
          pairCount: Number(r.waiting_pair_count),
        };
      }
      return status;
    });
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
