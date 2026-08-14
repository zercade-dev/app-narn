import type {
  CategorySuggestion,
  FreewayWindowKind,
  GlobalConfig,
  GlobalModuleConfigEntry,
  Glossary,
  GlossarySuggestion,
  GlossarySummary,
  GlossaryTerm,
  JudgeLogEntry,
  LQAResult,
  JudgeVerdictRecord,
  ModuleInstance,
  NotificationRecord,
  Project,
  ProjectTemplate,
  ProjectTemplateConfig,
  RoutingRule,
  RoutingRuleGroup,
  RunDetails,
  RunStatus,
  SourceReviewFinding,
  StringEntry,
  TmFingerprint,
  TmSegment,
  TranslationRecord,
  WorkspaceSettings,
} from '@zercade-dev/narn-shared';
import type { TmLookupQuery, TmLookupResult } from '../modules/M23-translation-memory.js';
import type { BackupTrigger } from '../modules/backup-trigger.js';

/**
 * Port: project config persistence. Local default = PgProjectStore (single
 * 'local' tenant); a cloud composition root injects a multi-tenant adapter
 * later. Signatures are identical to the former M1 ProjectStore class so
 * consumers are unaffected.
 */
export interface ProjectStore {
  createProject(
    name: string,
    sourceLanguage: string,
    activeLanguages: string[],
    icon?: string,
  ): Promise<Project>;
  loadProject(id: string): Promise<Project>;
  switchProject(id: string): Promise<void>;
  getActiveProjectId(): Promise<string | null>;
  deleteProject(id: string): Promise<void>;
  listProjects(): Promise<Project[]>;
  duplicateProject(id: string): Promise<Project>;
  updateProject(id: string, partial: Partial<Omit<Project, 'id' | 'createdAt'>>): Promise<Project>;
}

/**
 * Port: project-template persistence. Templates are GLOBAL (workspace-wide,
 * not per-project) — the local default keys them to the single 'local' tenant
 * with no `project_id`. A cloud composition root injects a multi-tenant
 * adapter later. Signatures match the former M24 TemplateStore class so the
 * routes are unaffected.
 */
export interface TemplateStore {
  listTemplates(): Promise<ProjectTemplate[]>;
  getTemplate(templateId: string): Promise<ProjectTemplate>;
  createTemplate(name: string, config: ProjectTemplateConfig): Promise<ProjectTemplate>;
  deleteTemplate(templateId: string): Promise<void>;
}

/**
 * Port: workspace-wide module configuration persistence (the former M19
 * GlobalConfigStore consumer surface). The local default = PgGlobalConfigStore
 * (single 'local' tenant); a cloud composition root injects a multi-tenant
 * adapter later. `cachedSettings()` is intentionally synchronous — M6 reads
 * `requestTimeoutMs` without an async hop when building module factories.
 */
export interface GlobalConfigStore {
  load(): Promise<GlobalConfig>;
  listModuleInstances(): Promise<ModuleInstance[]>;
  getSettings(): Promise<WorkspaceSettings>;
  cachedSettings(): WorkspaceSettings | undefined; // synchronous — M6 reads requestTimeoutMs
  save(cfg: GlobalConfig): Promise<void>;
  updateModule(moduleId: string, entry: GlobalModuleConfigEntry): Promise<GlobalConfig>;
  addModuleInstance(instance: ModuleInstance): Promise<GlobalConfig>;
  renameModuleInstance(
    instanceId: string,
    displayName: string,
  ): Promise<ModuleInstance | undefined>;
  removeModuleInstance(instanceId: string): Promise<boolean>;
  updateSettings(settings: Partial<WorkspaceSettings>): Promise<GlobalConfig>;
}

/**
 * Port: global (cross-project) translation-memory persistence (the former M23
 * TranslationMemoryStore consumer surface). TM is GLOBAL by design — keyed to
 * the single 'local' tenant with NO `project_id`, so a variant approved in one
 * project can auto-apply in another. The local default = PgTranslationMemory
 * (row-per-variant); a cloud composition root injects a multi-tenant adapter
 * later. `TmLookupQuery`/`TmLookupResult` stay defined on M23 (with the ranking /
 * fingerprint / hint helpers the adapter reuses) so consumers are unaffected.
 */
export interface TranslationMemory {
  lookup(query: TmLookupQuery): Promise<TmLookupResult>;
  record(input: {
    maskedSource: string;
    targetLanguage: string;
    translatedText: string;
    moduleId: string;
    lqaPassed: boolean;
    fingerprint: TmFingerprint;
  }): Promise<void>;
  list(): Promise<TmSegment[]>;
  deleteVariant(key: string, variantId: string): Promise<boolean>;
  clearAll(): Promise<number>;
}

/** One project glossary that lacks translations for some run target languages. */
export interface IncompleteGlossary {
  glossaryId: string;
  glossaryName: string;
  /** Target languages (codes) for which at least one non-constant term has no translation. */
  missingLanguages: string[];
  /** How many non-constant terms have at least one missing language. */
  missingTermCount: number;
}

/**
 * Port: project-scoped glossary persistence (the former M8 GlossaryManager
 * consumer surface — signatures copied verbatim, including the two-overload
 * `addTerm`/`updateTerm`/`deleteTerm` that discriminate on whether the second
 * arg is a glossary id or the term/partial). Glossaries are PER-PROJECT (rows
 * keyed `(project_id, id)`); a per-project overrides row holds the enabled
 * toggles for the static global glossaries. The local default =
 * PgGlossaryStore (single 'local' tenant); a cloud composition root injects
 * a multi-tenant adapter later.
 */
export interface GlossaryStore {
  getEnabledOverrides(projectId: string): Promise<Record<string, boolean>>;
  setEnabledOverrides(projectId: string, overrides: Record<string, boolean>): Promise<void>;
  listGlossaries(projectId: string): Promise<GlossarySummary[]>;
  getGlossary(projectId: string, glossaryId?: string): Promise<Glossary>;
  createGlossary(
    projectId: string,
    name: string,
    opts?: { readOnly?: boolean; id?: string },
  ): Promise<Glossary>;
  updateGlossary(
    projectId: string,
    glossaryId: string,
    patch: { name?: string; enabled?: boolean },
  ): Promise<Glossary>;
  deleteGlossary(projectId: string, glossaryId: string): Promise<void>;
  // Overload: addTerm(projectId, term) — default glossary (backward compat)
  // Overload: addTerm(projectId, glossaryId, term) — specific glossary
  addTerm(projectId: string, term: Omit<GlossaryTerm, 'id'>): Promise<GlossaryTerm>;
  addTerm(
    projectId: string,
    glossaryId: string,
    term: Omit<GlossaryTerm, 'id'>,
  ): Promise<GlossaryTerm>;
  // Overload: updateTerm(projectId, termId, partial) — default glossary (backward compat)
  // Overload: updateTerm(projectId, glossaryId, termId, partial) — specific glossary
  updateTerm(
    projectId: string,
    termId: string,
    partial: Partial<GlossaryTerm>,
  ): Promise<GlossaryTerm>;
  updateTerm(
    projectId: string,
    glossaryId: string,
    termId: string,
    partial: Partial<GlossaryTerm>,
  ): Promise<GlossaryTerm>;
  // Overload: deleteTerm(projectId, termId) — default glossary (backward compat)
  // Overload: deleteTerm(projectId, glossaryId, termId) — specific glossary
  deleteTerm(projectId: string, termId: string): Promise<void>;
  deleteTerm(projectId: string, glossaryId: string, termId: string): Promise<void>;
  pushToDeepL(
    projectId: string,
    glossaryId?: string,
    sessionId?: string,
    opts?: { replace?: boolean },
  ): Promise<{ pushed: number }>;
  getTermsForLanguage(
    projectId: string,
    targetLanguage: string,
    glossaryIds?: string[],
    /**
     * The project's configured target languages (source + pseudo-test
     * excluded), used only to auto-ignore incomplete terms in read-only
     * glossaries. Callers that already loaded the project should pass it
     * (`projectTargetLanguages(project)`) to avoid a redundant load; omitted ⇒
     * the store loads the project itself, but only when a read-only glossary
     * is actually present among the effective summaries.
     */
    projectTargetLangs?: string[],
  ): Promise<GlossaryTerm[]>;
  findIncompleteGlossaries(
    projectId: string,
    targetLanguages: string[],
  ): Promise<IncompleteGlossary[]>;
}

export interface StringQueryFilters {
  category?: string;
  source?: string;
  translationStatus?: 'pending' | 'translated' | 'reviewed' | 'flagged';
  language?: string;
  untranslatedOnly?: boolean;
  untranslatedForLanguage?: string;
  lqaFailed?: boolean;
  /** Match entries with at least one translation produced by this run id. */
  runId?: string;
}

/** One ranked relink candidate: a live (non-orphan) entry plus its source text. */
export interface RelinkCandidate {
  id: string;
  sourceText: string;
}

/**
 * Port: project-scoped string-entry persistence (the former M3 StringStore
 * consumer surface — originally the exact 10-method surface, since extended
 * with `restoreTranslation` for run-revert and `rankBySourceSimilarity` for
 * relink candidate ranking). Strings are PER-PROJECT, one row per entry keyed
 * `(project_id, id)`, the full StringEntry stored in `data jsonb` with `seq`
 * preserving insertion order. The local default = PgStringStore (single
 * 'local' tenant); a cloud composition root injects a multi-tenant adapter
 * later.
 */
export interface StringStore {
  load(projectId: string): Promise<StringEntry[]>;
  getById(projectId: string, id: string): Promise<StringEntry>;
  query(projectId: string, filters: StringQueryFilters): Promise<StringEntry[]>;
  save(projectId: string, entries: StringEntry[]): Promise<void>;
  mutateAll(
    projectId: string,
    fn: (entries: StringEntry[]) => StringEntry[] | void | Promise<StringEntry[] | void>,
  ): Promise<void>;
  /**
   * `opts.recordManualEdits` (default false, existing callers unchanged): when
   * true, records one `manual_edits` audit row per language whose incoming
   * text differs from the currently-stored text, inside the same
   * per-project write-lock transaction as the entry write. Callers gate this
   * on the manual-edit-audit project flag + sharing eligibility (see
   * `routes/strings.ts`'s PUT/PATCH handlers) — never pass `true`
   * unconditionally.
   */
  updateEntry(
    projectId: string,
    id: string,
    partial: Partial<Omit<StringEntry, 'id' | 'createdAt' | 'sourceText'>>,
    opts?: { recordManualEdits?: boolean },
  ): Promise<StringEntry>;
  /**
   * Merges a single translation record into an entry's translations map,
   * atomically under the per-project write lock. When
   * `opts.preserveReviewedIfSameText` is set and the entry's CURRENT record for
   * `targetLanguage` has `status: 'reviewed'` and exactly the same `text` as
   * `record`, the stored record keeps `status: 'reviewed'` and
   * `needsReview: false` (human review survives an identical re-write); all
   * other fields (`moduleId`, `timestamp`, `runId`, history) still come from
   * `record`. When the flag is absent, or the current record is not reviewed,
   * or the text differs, `record` wins verbatim (with the normal history fold).
   */
  setTranslation(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    record: TranslationRecord,
    opts?: { preserveReviewedIfSameText?: boolean },
  ): Promise<StringEntry>;
  /**
   * Restores (or clears) a single language's translation record WITHOUT
   * folding the record being replaced into version history — the run-revert
   * counterpart to `setTranslation`'s forward write. `record: null` removes
   * the language key entirely (used when the pair had no translation before
   * the run that is being reverted). Also clears `lqaResults[targetLanguage]`,
   * since that verdict was computed against the text being discarded. Atomic
   * under the same per-project write lock as every other single-entry write.
   */
  restoreTranslation(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    record: TranslationRecord | null,
  ): Promise<StringEntry>;
  /**
   * Atomic read-modify-write of a SINGLE language's LQA verdict under the
   * per-project write lock: reads the entry inside the lock, computes `next =
   * fn(current verdict for `targetLanguage`)`, and writes back with ONLY
   * `lqaResults[targetLanguage]` replaced (all other languages/fields
   * preserved). `fn` receives the FRESH per-language verdict, never a caller's
   * pre-lock snapshot — so a judge pass appending its issues merges into the
   * current gate result instead of reverting a concurrent verdict. Throws
   * `EntryNotFoundError` when the entry is gone.
   */
  mutateLqaResult(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    fn: (current: LQAResult | undefined) => LQAResult,
  ): Promise<StringEntry>;
  /**
   * Flips STATUS-ONLY fields (`status`/`needsReview`) on one language's
   * translation record under the per-project write lock, re-reading the entry
   * inside the lock. NEVER carries `text` — the current stored text is
   * preserved, so this cannot revert a concurrent text write (unlike passing a
   * whole snapshot record through `updateEntry`). A no-op when the language has
   * no stored record. Throws `EntryNotFoundError` when the entry is gone.
   */
  setTranslationStatus(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    patch: { status?: TranslationRecord['status']; needsReview?: boolean },
  ): Promise<StringEntry>;
  deleteEntry(projectId: string, id: string): Promise<void>;
  /** See `updateEntry` — same optional, default-false `recordManualEdits` audit opt-in. */
  bulkUpdate(
    projectId: string,
    ids: string[],
    partial: Partial<Omit<StringEntry, 'id' | 'createdAt' | 'sourceText' | 'translations'>> & {
      translations?: Record<string, Partial<TranslationRecord>>;
    },
    opts?: { recordManualEdits?: boolean },
  ): Promise<StringEntry[]>;
  setReviewSortIndices(projectId: string, indexById: ReadonlyMap<string, number>): Promise<number>;
  bulkUpsert(
    projectId: string,
    incoming: StringEntry[],
  ): Promise<{ entries: StringEntry[]; ghostsBlocked: number }>;
  /**
   * Stamps `orphanedAt = timestamp` on each listed entry (full-replace CSV
   * import's soft delete). Ids with no stored row are skipped silently (the
   * entry vanished between diff and
   * apply). Returns the number of rows actually stamped. Runs under the same
   * per-project write lock as every other write.
   */
  markOrphaned(projectId: string, ids: string[], timestamp: number): Promise<number>;
  /**
   * Relink-tab candidates: live (non-excluded) entries ranked by how similar
   * their `sourceText` is to `query`, most-similar first, via native Postgres
   * pg_trgm trigram `similarity()` (migration 0018). Falls back to
   * unranked stored order when the extension is unavailable — see the
   * implementation's guard.
   */
  rankBySourceSimilarity(
    projectId: string,
    query: string,
    excludeIds: string[],
  ): Promise<RelinkCandidate[]>;
}

/**
 * One persisted per-entry source-review result. The full list is stored in a
 * `source-review-<runId>.json` sidecar — kept out of `runs.json` so the
 * hot-path run-progress writes stay small — and surfaced as the disaggregated
 * detail behind the run's findings summary.
 */
export interface SourceReviewRecord {
  entryId: string;
  /** The source text reviewed, captured at review time. */
  sourceText: string;
  findings: SourceReviewFinding[];
  /**
   * Optional unified corrected source for the whole entry — the exact
   * replacement value only. Absent when the source is clean.
   */
  suggestion?: string;
  /**
   * True once the user approved this entry in the Source AI review tab.
   * Persisted so a reload keeps the approved state and navigation can skip it.
   */
  approved?: boolean;
}

/**
 * One persisted per-(entry, target language) result from a Relink-tab AI
 * retranslate run. The full list is stored in a
 * `relink-retranslate-<runId>.json` sidecar, mirroring `SourceReviewRecord`.
 */
export interface RelinkRetranslateRecord {
  targetLanguage: string;
  /** The translation text before the retranslate pass. */
  oldText: string;
  /** The translation text after the retranslate pass; empty on failure. */
  newText: string;
  error?: string;
}

/**
 * Port: per-project translation/AI-review run persistence (the former M22
 * RunStore consumer surface — originally the exact 16-method surface, since
 * extended). Runs are PER-PROJECT, one row per run; the whole RunStatus lives
 * in `data jsonb` with scalar write-mirror columns for ordering/filtering. The
 * large per-run payloads (details/verdicts/judge-logs/source-review/glossary-
 * suggestions/category-suggestions/relink-retranslate) persist one row per
 * `(run_id, kind)` in `run_sidecars`. The local default = PgRunStore (single
 * 'local' tenant); a cloud composition root injects a multi-tenant adapter
 * later. Signatures match the former M22 RunStore class so consumers are
 * unaffected.
 */
export interface RunStore {
  saveJudgeLogs(projectId: string, runId: string, logs: JudgeLogEntry[]): Promise<void>;
  getJudgeLogs(projectId: string, runId: string): Promise<JudgeLogEntry[]>;
  saveRunDetails(projectId: string, runId: string, details: RunDetails): Promise<void>;
  getRunDetails(projectId: string, runId: string): Promise<RunDetails | null>;
  saveVerdicts(projectId: string, runId: string, verdicts: JudgeVerdictRecord[]): Promise<void>;
  getVerdicts(projectId: string, runId: string): Promise<JudgeVerdictRecord[]>;
  /**
   * Atomic read-modify-write of the run's verdicts sidecar under the per-project
   * write lock, in one tenant transaction: loads the current records, applies
   * `mutate`, and persists the result — so two concurrent edits (a
   * `suggestVerdict` racing a judge flush, two reviewers) can't lose one
   * another's write, unlike a plain get→mutate→`saveVerdicts`. `mutate`
   * returning `undefined` skips the write (no change) and returns the current
   * records; a throwing `mutate` persists nothing and propagates.
   */
  updateVerdicts(
    projectId: string,
    runId: string,
    mutate: (current: JudgeVerdictRecord[]) => JudgeVerdictRecord[] | undefined,
  ): Promise<JudgeVerdictRecord[]>;
  saveSourceReview(projectId: string, runId: string, records: SourceReviewRecord[]): Promise<void>;
  getSourceReview(projectId: string, runId: string): Promise<SourceReviewRecord[]>;
  /**
   * Atomic read-modify-write of the run's source-review sidecar — the
   * source-review counterpart of {@link updateVerdicts}, same locking/tx and
   * `undefined`-means-no-write semantics (used by the approve/ignore routes'
   * 404 paths).
   */
  updateSourceReview(
    projectId: string,
    runId: string,
    mutate: (current: SourceReviewRecord[]) => SourceReviewRecord[] | undefined,
  ): Promise<SourceReviewRecord[]>;
  saveGlossarySuggestions(
    projectId: string,
    runId: string,
    suggestions: GlossarySuggestion[],
  ): Promise<void>;
  getGlossarySuggestions(projectId: string, runId: string): Promise<GlossarySuggestion[]>;
  saveCategorySuggestions(
    projectId: string,
    runId: string,
    suggestions: CategorySuggestion[],
  ): Promise<void>;
  getCategorySuggestions(projectId: string, runId: string): Promise<CategorySuggestion[]>;
  saveRelinkRetranslate(
    projectId: string,
    runId: string,
    records: RelinkRetranslateRecord[],
  ): Promise<void>;
  getRelinkRetranslate(projectId: string, runId: string): Promise<RelinkRetranslateRecord[]>;
  listRuns(projectId: string): Promise<RunStatus[]>;
  /**
   * Count of the CURRENT TENANT's non-terminal runs across all their projects
   * (RLS-scoped — no projectId arg). Non-terminal = pending/queued/running/
   * paused. Used by the per-tenant run-concurrency cap.
   */
  countActiveRuns(): Promise<number>;
  getRun(projectId: string, runId: string): Promise<RunStatus | null>;
  updateRun(projectId: string, run: RunStatus): Promise<void>;
  forceCancel(projectId: string, runId: string): Promise<RunStatus | null>;
  /**
   * Project ids (RLS-scoped to the current tenant's memberships) that have at
   * least one run created by someone OTHER than the current tenant — i.e. run
   * HISTORY of being shared, independent of current membership count (a
   * collaborator can leave a project and its owner still needs `sharedEver`
   * to stay true). Used by `GET /api/projects`'s `sharedEver` widening.
   */
  listProjectsWithForeignRuns(): Promise<string[]>;
  /**
   * Removes `entryId`'s record from the `verdicts` and `source-review` sidecar
   * arrays, across every run in `projectId`. Called by
   * `StringStore.deleteEntry` so a deleted entry's judge verdicts and
   * source-review findings don't silently reattach to a later entry that
   * reuses the same content-addressed id.
   */
  deleteSidecarsForEntry(projectId: string, entryId: string): Promise<void>;
}

/**
 * Port: the review-order pre-sort's "last sorted" META persistence (the meta
 * the former `ReviewOrderService` wrote to `projects/<id>/review-order.json`).
 * Per-project, one row keyed `(project_id)`. The local default =
 * PgReviewOrderStore (single 'local' tenant); a cloud composition root
 * injects a multi-tenant adapter later. The per-entry `reviewSortIndex`
 * itself is NOT here — it persists through StringStore.setReviewSortIndices.
 * `ReviewOrderMeta` is defined here (the storage contract) and imported by
 * `modules/review-order.ts` — the service that computes and reads it — so
 * the edge points downward.
 */

/** Persisted "last sorted" meta describing the most recent review-order pre-sort. */
export interface ReviewOrderMeta {
  version: number;
  /** Epoch ms when the order was computed (supplied by the route handler). */
  computedAt: number;
  /** Number of entries assigned a reviewSortIndex. */
  count: number;
}

export interface ReviewOrderStore {
  getMeta(projectId: string): Promise<ReviewOrderMeta | null>;
  saveMeta(projectId: string, meta: ReviewOrderMeta): Promise<void>;
}

/**
 * One row of the `project_backups` listing — the searchable metadata mirror of
 * a stored project backup, WITHOUT the (large, compressed) `payload` blob, so
 * list/preview never decompresses. The gzip'd `ProjectSnapshot` JSON itself is
 * fetched separately via `BackupStore.getPayload`. `createdAt` is the ISO-8601
 * rendering of the `timestamptz` column; every count/size/hash field is
 * nullable because the columns are (a future/partial ingest path may omit them,
 * even though the live store sets them all). PROJECT-scoped: a backup belongs to
 * a project and RLS keys on `project_members`.
 */
export interface BackupRecord {
  id: string;
  projectId: string;
  trigger: BackupTrigger;
  schemaVersion: number;
  createdAt: string; // ISO 8601 (timestamptz → toISOString)
  sizeBytes: number | null; // compressed payload byteLength
  uncompressedBytes: number | null; // decompressed JSON length
  sha256: string | null; // hex SHA-256 of the UNcompressed snapshot JSON
  label: string | null;
  projectName: string | null;
  stringCount: number | null;
  languageCount: number | null;
  runCount: number | null;
  createdBy: string | null;
}

/**
 * What `BackupStore.insert` persists alongside the payload. The STORE owns
 * gzip: the caller supplies `snapshotJson` (the UNcompressed
 * `JSON.stringify(snapshot)` Buffer) and the store runs `gzipSync` to
 * produce the stored `payload` and stamps `sizeBytes = payload.byteLength`.
 * The caller still computes `sha256`/`uncompressedBytes`/the denormalized stats
 * from the same uncompressed buffer (it is the side that knows the snapshot
 * shape); keeping gzip in the store means a future codec swap touches one place.
 */
export interface NewBackupInput {
  id: string;
  projectId: string;
  trigger: BackupTrigger;
  schemaVersion: number;
  snapshotJson: Buffer; // UNcompressed JSON.stringify(snapshot); the store gzips it
  uncompressedBytes: number; // snapshotJson.byteLength
  sha256: string; // sha256Hex(snapshotJson)
  projectName: string;
  stringCount: number;
  languageCount: number;
  runCount: number;
  createdBy: string;
  label?: string | null;
}

/**
 * Port: per-project backup persistence (replaces the on-disk `.backups/` zips
 * with PG rows so the read-only cloud container can snapshot). Every method
 * carries `projectId` so each query is additionally scoped `where project_id =
 * $1` — belt-and-braces over RLS, so a backup id from project A can never
 * address project B's row even within one tenant. The local default =
 * PgBackupStore (single 'local' tenant); a cloud composition root injects a
 * multi-tenant adapter later.
 */
export interface BackupStore {
  insert(input: NewBackupInput): Promise<BackupRecord>;
  list(projectId: string): Promise<BackupRecord[]>; // metadata only, newest first
  getRecord(projectId: string, id: string): Promise<BackupRecord | null>; // metadata only
  getPayload(projectId: string, id: string): Promise<Buffer | null>; // the bytea blob (compressed)
  delete(projectId: string, id: string): Promise<boolean>; // false if not found
  prune(projectId: string, maxPerTrigger: number): Promise<void>; // retention; manual never pruned
}

/**
 * Port: current-tenant in-app notification persistence. Every method is
 * scoped to the AMBIENT tenant only (RLS on `user_id`, no explicit filter) —
 * mirrors PgTranslationMemory.list(). Broadcast fan-out (one row per
 * addressee) happens at INSERT time via the separate
 * module-level `insertNotificationForUser` helper (the future admin/ops
 * path), which is NOT part of this port — this port is the user-facing
 * read/ack/dismiss surface only. Latest-50, no pagination for v1 (no
 * retention/expiry job yet). The local default = PgNotificationStore (single
 * 'local' tenant); a cloud composition root injects a multi-tenant adapter
 * later.
 */
export interface NotificationStore {
  listForCurrentUser(): Promise<NotificationRecord[]>; // newest 50, newest-first
  countUnread(): Promise<number>;
  markRead(id: string): Promise<void>; // idempotent; foreign/missing id is a no-op
  markAllRead(): Promise<{ count: number }>;
  delete(id: string): Promise<void>; // foreign/missing id is a no-op
}

/**
 * One `device_vaults` row's PUBLIC metadata — deviceId + timestamps only.
 * `ciphertext`/`kdf_salt` (the encrypted vault envelope + its salt) are secret
 * material and are NEVER part of this shape; only `CloudVaultStore` reads
 * those two columns, for the actual vault unlock/setup path, which is
 * untouched by this port. `createdAt`/`updatedAt` are the ISO-8601 rendering
 * of the `timestamptz` columns.
 */
export interface DeviceVaultRecord {
  deviceId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Port: current-tenant device-vault METADATA persistence — the Account →
 * Security → Devices list/"forget device" surface (`/auth/devices`,
 * cloud-only). Every method is scoped to the AMBIENT tenant only (RLS on
 * `user_id`, no explicit filter) — mirrors NotificationStore/
 * PgNotificationStore. The local default = PgDeviceVaultStore; `device_vaults`
 * rows only ever exist in cloud mode (written by CloudVaultStore during vault
 * setup), so this port is unused but harmless in open-core (an empty list).
 */
export interface DeviceVaultStore {
  listForCurrentUser(): Promise<DeviceVaultRecord[]>; // newest-first, no cap
  delete(deviceId: string): Promise<void>; // foreign/missing id is a no-op
}

/**
 * One `project_members` row (the membership anchor; migration 0021 adds
 * `writable_languages`/`joined_at`). `role: 'owner'` rows are created solely
 * by `PgProjectStore.createProject` (one per project, `project_members_single_owner`,
 * migration 0015) and can never be language-scoped or removed through
 * MemberStore. `joinedAt` is the ISO-8601 rendering of the `timestamptz`
 * column.
 */
export interface ProjectMember {
  projectId: string;
  userId: string;
  role: 'owner' | 'collaborator';
  writableLanguages: string[];
  joinedAt: string; // ISO 8601
}

/**
 * Port: project membership. Backed by the 0021 owner-managed RLS policy on
 * `project_members` — the USING clause lets a project's owner see every
 * member row, a collaborator only their own; the WITH CHECK clause only
 * allows a `role='collaborator'` insert when the ambient tenant is the
 * project's owner (`narn_is_project_owner`). The local default =
 * PgMemberStore (single 'local' tenant); a cloud composition root's
 * project-join flow establishes owner tenant context explicitly for
 * addCollaborator (mirrors `insertNotificationForUser`'s explicit-tenant
 * pattern).
 */
export interface MemberStore {
  /** The AMBIENT tenant's own membership row for the project, or null. */
  getMembership(projectId: string): Promise<ProjectMember | null>;
  /** All member rows RLS lets the ambient tenant see (owner: all; collaborator: self). */
  listMembers(projectId: string): Promise<ProjectMember[]>;
  /** Insert a collaborator row. MUST run under the project owner's tenant context. */
  addCollaborator(projectId: string, userId: string): Promise<ProjectMember>;
  /** Replace a member's writable set; null when the row isn't visible/absent. */
  updateWritableLanguages(
    projectId: string,
    userId: string,
    writableLanguages: string[],
  ): Promise<ProjectMember | null>;
  /** Delete a member row (owner removing a member, or a member leaving). */
  removeMember(projectId: string, userId: string): Promise<boolean>;
  /** All membership rows of the AMBIENT tenant across projects (own rows only, by RLS). */
  listMyMemberships(): Promise<ProjectMember[]>;
  /**
   * Member count per project id, over every row RLS lets the tenant see —
   * for an owner that's the full member list of owned projects, so a count
   * > 1 on an owned project means "currently shared".
   */
  countMembersByProject(): Promise<Record<string, number>>;
}

/**
 * One tenant's routing document: a collaborator's routing rules are keyed to
 * THEM, not to any one project — the same rule set applies across every
 * project they collaborate on (their own projects keep the existing
 * per-project `Project.routingRules`). Shape
 * mirrors the per-project routing fields (`Project.routingRules`/
 * `routingRuleGroups`/`activeRoutingRuleGroupId`) so the frontend can reuse the
 * same routing-editor components against either source.
 */
export interface CollabRoutingConfig {
  routingRules: RoutingRule[];
  routingRuleGroups?: RoutingRuleGroup[];
  activeRoutingRuleGroupId?: string | null;
}

/**
 * Port: per-user collaboration routing persistence. User-global, one
 * document per tenant — exactly like TemplateStore/GlobalConfigStore's
 * `workspace_settings`, keyed by `tenant_id` alone (no `project_id`). The
 * local default = PgCollabRoutingStore (single 'local' tenant); a cloud
 * composition root injects a multi-tenant adapter later.
 */
export interface CollabRoutingStore {
  /** The AMBIENT tenant's personal collab routing, or null when never saved. */
  get(): Promise<CollabRoutingConfig | null>;
  /** Upsert the ambient tenant's config (whole-document replace). */
  save(config: CollabRoutingConfig): Promise<CollabRoutingConfig>;
}

/** Additive usage recorded for one dispatch attempt (all fields default 0). */
export interface FreewayUsageDelta {
  requests?: number;
  inputTokens?: number;
  outputTokens?: number;
  chars?: number;
}

/** One (window kind, window start) cell a caller wants counted or read. */
export interface FreewayWindowRef {
  kind: FreewayWindowKind;
  /** Epoch ms — computed by the caller via shared `windowStart()`. */
  start: number;
}

export interface FreewayWindowUsage extends FreewayWindowRef {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  chars: number;
}

/** Per-(model, language) quality EMAs, stored in freeway_buckets.stats. */
export interface FreewayBucketStats {
  /** key: target language → EMA of LQA gate pass (0..1). */
  gatePassByLanguage?: Record<string, number>;
  /** EMA of 429-per-request (0..1). */
  rateLimitRate?: number;
  /** EMA of latency ms per request. */
  latencyMs?: number;
}

export interface FreewayBucketState {
  /** `'<moduleOrInstanceId>::<modelId>'`, e.g. `google::gemini-2.5-flash`, `generic-ai:mistral::mistral-small-latest`. */
  bucketKey: string;
  cooldownUntil?: number;
  disabledReason?: string;
  flapCount: number;
  stats: FreewayBucketStats;
  updatedAt: number;
}

export interface FreewayLedgerStore {
  /** Atomically add `delta` to EVERY listed window cell of `bucketKey` (upsert). */
  recordAttempt(
    bucketKey: string,
    windows: FreewayWindowRef[],
    delta: FreewayUsageDelta,
  ): Promise<void>;
  /** Read the listed window cells (missing cells come back zeroed). */
  usage(bucketKey: string, windows: FreewayWindowRef[]): Promise<FreewayWindowUsage[]>;
  /** All bucket states for the tenant (empty array when none). */
  listBuckets(): Promise<FreewayBucketState[]>;
  /** Overwrites cooldown_until (last write wins); bumps flap_count when `flap` is true. Upserts. */
  setCooldown(bucketKey: string, until: number, opts?: { flap?: boolean }): Promise<void>;
  /** Clear cooldown and reset flap_count to 0. No-op when the row is absent. */
  clearCooldown(bucketKey: string): Promise<void>;
  /** Mark a bucket disabled (bad credentials) or re-enabled (null). Upserts. */
  setDisabled(bucketKey: string, reason: string | null): Promise<void>;
  /** Shallow-merge `stats` into the stored stats object. Upserts. */
  mergeStats(bucketKey: string, stats: FreewayBucketStats): Promise<void>;
  /**
   * Overwrite a window cell with authoritative usage from a provider probe
   * (DeepL /v2/usage, OpenRouter /api/v1/key) — sets, does not add.
   * Unspecified counter fields are written as 0 (the cell is fully
   * overwritten, not partially patched).
   */
  syncAuthoritativeUsage(
    bucketKey: string,
    window: FreewayWindowRef,
    usage: FreewayUsageDelta,
  ): Promise<void>;
}
