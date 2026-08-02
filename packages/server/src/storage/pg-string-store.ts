import { randomUUID } from 'node:crypto';
import type { LQAResult, StringEntry, TranslationRecord } from '@zercade-dev/narn-shared';
import { MAX_PREVIOUS_VERSIONS } from '@zercade-dev/narn-shared';
import { KeyedAsyncLock } from '../utils/keyed-lock.js';
import { EntryNotFoundError } from '../types/errors.js';
import type { Queryable } from './pg/pool.js';
import { withTransaction } from './pg/pool.js';
import type { StringStore, StringQueryFilters } from './types.js';
// Resolved lazily (call-time, inside deleteEntry — not at module-eval time) so
// the registry↔pg-string-store import cycle resolves via live bindings, the
// same pattern already established for the M6↔registry cycle (see
// registry.ts's own comment on defaultModuleRegistry). Tests that need the
// cascade to land in their own db wire setRunStore(...) to that db first
// (mirrors the source-review disposition rules); callers that don't care
// about it are unaffected — the call is a harmless no-op against whichever
// db the registry's default RunStore happens to point at.
import { getRunStore } from './registry.js';

/**
 * Folds the previous translation record into the next one's bounded version
 * history. The history is derived exclusively from the stored record — any
 * client-supplied previousVersions on `next` is discarded — and only the
 * text/moduleId/timestamp provenance fields are ever retained.
 *
 * - Text changed: the old { text, moduleId, timestamp } is appended and the
 *   history capped at MAX_PREVIOUS_VERSIONS (oldest evicted).
 * - Text unchanged (or previous record empty/absent): history carries over.
 *
 * Transcribed verbatim from M3 (M3:21-35) — only the persistence layer changed.
 */
function withTranslationHistory(
  prev: TranslationRecord | undefined,
  next: TranslationRecord,
): TranslationRecord {
  const carried = prev?.previousVersions;
  if (!prev || prev.text === next.text || prev.text === '') {
    if (carried === next.previousVersions) return next;
    return carried ? { ...next, previousVersions: carried } : stripPreviousVersions(next);
  }
  const history = [
    ...(carried ?? []),
    { text: prev.text, moduleId: prev.moduleId, timestamp: prev.timestamp },
  ];
  return { ...next, previousVersions: history.slice(-MAX_PREVIOUS_VERSIONS) };
}

function stripPreviousVersions(record: TranslationRecord): TranslationRecord {
  if (record.previousVersions === undefined) return record;
  const rest = { ...record };
  delete rest.previousVersions;
  return rest;
}

/**
 * Review-flag invariant: `status: 'reviewed'` and `needsReview: true` are
 * contradictory, and nothing else enforces their consistency (the two fields
 * predate each other). Applied to every translation-record write:
 *  A. A patch that sets `status: 'reviewed'` without touching `needsReview`
 *     clears the flag — approving implies the review is done.
 *  B. Anything still contradictory after that resolves needsReview-wins —
 *     status downgrades to 'translated'. Re-flag actions are the only known
 *     producers of the contradiction, and erring toward "needs review" is
 *     fail-safe: a translation gets re-checked, never silently approved.
 */
function normalizeReviewFlags(
  patch: Partial<TranslationRecord> | undefined,
  merged: TranslationRecord,
): TranslationRecord {
  let result = merged;
  if (
    patch?.status === 'reviewed' &&
    patch.needsReview === undefined &&
    result.needsReview === true
  ) {
    result = { ...result, needsReview: false };
  }
  if (result.status === 'reviewed' && result.needsReview === true) {
    result = { ...result, status: 'translated' };
  }
  return result;
}

/**
 * Drops a language's persisted LQA verdict when that language's translation
 * TEXT changed in this same write and the caller didn't also supply a fresh
 * verdict for it. Without this, a verdict computed against the OLD text
 * survives unchanged and gets shown against text that no longer produced it —
 * e.g. M30's relink-retranslate rewrite (goes through `setTranslation`, which
 * has no way to pass a recomputed verdict at all) or an orphan merge landing
 * a different language's text onto a target entry via `updateEntry`. Mirrors
 * `restoreTranslation`'s existing clear-on-replace behavior, generalized to
 * every text-changing write path so the invariant lives in one place rather
 * than depending on each call site remembering to recompute or clear.
 */
function clearStaleLqaResults(
  lqaResults: Record<string, LQAResult>,
  changedLangs: ReadonlySet<string>,
  freshLangs: ReadonlySet<string>,
): Record<string, LQAResult> {
  let result = lqaResults;
  for (const lang of changedLangs) {
    if (freshLangs.has(lang)) continue;
    if (!(lang in result)) continue;
    if (result === lqaResults) result = { ...lqaResults };
    delete result[lang];
  }
  return result;
}

/**
 * Drop the removed legacy `contentType` field from older projects so it is not
 * carried in memory or re-persisted on the next write. Preserved verbatim from
 * M3.load (M3:86-88) — the `sources` origin labels now cover
 * routing/classification; the old content-type taxonomy is gone.
 */
function stripLegacy(entry: StringEntry): StringEntry {
  delete (entry as { contentType?: unknown }).contentType;
  // Pre-invariant rows could persist status:'reviewed' + needsReview:true
  // (e.g. Compare tab's old "Flag all needs review" over a reviewed cell).
  // Serve them per invariant rule B (needsReview wins — they stay in the
  // review queue, matching the re-flag intent that produced them); the next
  // write persists the healed shape.
  for (const [lang, rec] of Object.entries(entry.translations ?? {})) {
    if (rec.status === 'reviewed' && rec.needsReview === true) {
      entry.translations[lang] = { ...rec, status: 'translated' };
    }
  }
  return entry;
}

/**
 * Recursively sorts object keys (arrays keep element order) and drops
 * `undefined`-valued keys, mirroring `JSON.stringify`'s own treatment of
 * `undefined` — so two structurally-equal objects compare equal via
 * {@link entriesEqual} regardless of key insertion order or whether an
 * absent optional field is `undefined` or simply missing.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) sorted[key] = canonicalize(v);
    }
    return sorted;
  }
  return value;
}

/** Structural equality for two StringEntry values (see {@link canonicalize}). */
function entriesEqual(a: StringEntry, b: StringEntry): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

/**
 * Postgres-backed StringStore: one row per entry, the full StringEntry stored
 * in `data jsonb`, `seq bigserial` preserving insertion order. The writes
 * transcribe M3's merge/version logic verbatim into TypeScript and change
 * only the persistence layer. No `ProjectStore`/`getProjectDir` dependency —
 * strings no longer need an on-disk directory.
 *
 * Single-row hot-path writes (`updateEntry`, `setTranslation`, `deleteEntry`)
 * select+update/delete just the affected row under the per-project write lock.
 * Whole-set writes (`save`, `mutateAll`, `bulkUpdate`, `setReviewSortIndices`,
 * `bulkUpsert`) run inside a transaction so a failure rolls back atomically —
 * restoring the crash-atomicity the on-disk `atomicWrite` gave the file store.
 */
export class PgStringStore implements StringStore {
  private readonly db: Queryable;
  // Serializes writes per project so a concurrent read-modify-write (e.g. M21
  // glossary-sync vs. an in-flight setTranslation) can never interleave and
  // clobber the other's update — the same guarantee M3's lock gave the file store.
  // DEPLOY INVARIANT: in-process only — correct at exactly ONE server replica.
  // See the KeyedAsyncLock doc (utils/keyed-lock.ts) before scaling out.
  private readonly writeLock = new KeyedAsyncLock();

  constructor(db: Queryable) {
    this.db = db;
  }

  async load(projectId: string): Promise<StringEntry[]> {
    const { rows } = await this.db.query<{ data: StringEntry }>(
      'select data from strings where project_id = $1 order by seq',
      [projectId],
    );
    return rows.map((r) => stripLegacy(r.data));
  }

  async getById(projectId: string, id: string): Promise<StringEntry> {
    const { rows } = await this.db.query<{ data: StringEntry }>(
      'select data from strings where project_id = $1 and id = $2',
      [projectId, id],
    );
    if (rows.length === 0) {
      throw new EntryNotFoundError(id);
    }
    return stripLegacy(rows[0]!.data);
  }

  async query(projectId: string, filters: StringQueryFilters): Promise<StringEntry[]> {
    const entries = await this.load(projectId);
    return entries.filter((entry) => matchesFilters(entry, filters));
  }

  /**
   * Full-list overwrite under the per-project write lock. Replaces the whole
   * set in one transaction (delete-all then re-insert in array order, fresh
   * `seq`). Unlike M3's `persist`, there is NO `loadProject` project-existence
   * pre-check: the route handlers already validate the project before reaching
   * the store, and strings no longer own an on-disk dir to validate against.
   */
  async save(projectId: string, entries: StringEntry[]): Promise<void> {
    await this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, (tx) => this.replaceAll(tx, projectId, entries)),
    );
  }

  /**
   * Locked load→mutate→reconcile for callers that read and rewrite the whole
   * entry list (M21's glossary-id assignment is the sole caller). The entries
   * are loaded inside the per-project write lock, handed to `fn` to mutate in
   * place (or return a replacement list), then the full set is replaced under
   * the same lock+transaction — so a concurrent locked write can never land
   * between the load and the save and be overwritten.
   */
  async mutateAll(
    projectId: string,
    fn: (entries: StringEntry[]) => StringEntry[] | void | Promise<StringEntry[] | void>,
  ): Promise<void> {
    await this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const entries = await this.loadTx(tx, projectId);
        const result = await fn(entries);
        await this.replaceAll(tx, projectId, result ?? entries);
      }),
    );
  }

  async updateEntry(
    projectId: string,
    id: string,
    // `sourceText` (and the `id` derived from it) are import-only: a string's
    // source is set at CSV import and never edited afterwards. Both are excluded
    // here and re-pinned below so this generic update API can never rewrite an
    // entry's source. `bulkUpsert` (the import path) is the sole source writer.
    partial: Partial<Omit<StringEntry, 'id' | 'createdAt' | 'sourceText'>>,
    // Optional and default-false so existing callers (including the AI
    // translation path, which goes through `setTranslation` instead) are
    // unaffected. Manual-editor callers pass `{ recordManualEdits: true }` to
    // audit text changes into `manual_edits` — see `recordManualEdits`.
    opts?: { recordManualEdits?: boolean },
  ): Promise<StringEntry> {
    return this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const current = await this.selectOne(projectId, id, tx);
        if (!current) {
          throw new EntryNotFoundError(id);
        }

        // Merge nested maps instead of replacing them wholesale so that a
        // partial update for one language does not wipe out other languages.
        // Incoming translation records fold the stored record into their
        // bounded version history when the text changes.
        let mergedTranslations = current.translations;
        const changedTextLangs = new Set<string>();
        if (partial.translations) {
          mergedTranslations = { ...current.translations };
          for (const [lang, record] of Object.entries(partial.translations)) {
            const prev = current.translations[lang];
            if (record.text !== prev?.text) changedTextLangs.add(lang);
            mergedTranslations[lang] = normalizeReviewFlags(
              record,
              withTranslationHistory(prev, record),
            );
          }
        }
        const mergedLqaResults = partial.lqaResults
          ? { ...current.lqaResults, ...partial.lqaResults }
          : current.lqaResults;
        const updated: StringEntry = {
          ...current,
          ...partial,
          translations: mergedTranslations,
          lqaResults: clearStaleLqaResults(
            mergedLqaResults,
            changedTextLangs,
            new Set(Object.keys(partial.lqaResults ?? {})),
          ),
          id: current.id,
          // Defense-in-depth: re-pin source even if a non-typed (`as`/JS) caller
          // smuggles `sourceText` into `partial`. Source is import-only.
          sourceText: current.sourceText,
          createdAt: current.createdAt,
          updatedAt: Date.now(),
        };

        await this.updateOne(projectId, id, updated, tx);
        if (opts?.recordManualEdits) {
          await this.recordManualEdits(tx, projectId, id, current, partial.translations);
        }
        return updated;
      }),
    );
  }

  /**
   * Atomically merges a single translation record into an entry's translations
   * map. Single-row: selects+updates just this entry under the write lock so
   * concurrent jobs for different target languages on the same entry never
   * overwrite each other (the hot-path win over a full-list rewrite).
   */
  async setTranslation(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    record: TranslationRecord,
    opts?: { preserveReviewedIfSameText?: boolean },
  ): Promise<StringEntry> {
    return this.writeLock.withLock(projectId, async () => {
      const current = await this.selectOne(projectId, entryId);
      if (!current) {
        throw new EntryNotFoundError(entryId);
      }
      // Preserve a human 'reviewed' decision when a run re-produces byte-
      // identical text. Read the CURRENT record inside the write lock (not the
      // caller's run-start snapshot) so a mid-run approval is honoured. Only
      // status/needsReview are kept; moduleId/timestamp/runId/history all still
      // come from the incoming record. Identical text means withTranslationHistory
      // folds no history, so this is a pure metadata preservation.
      let recordToStore = record;
      const previousRecord = current.translations[targetLanguage];
      if (opts?.preserveReviewedIfSameText) {
        if (previousRecord?.status === 'reviewed' && previousRecord.text === record.text) {
          recordToStore = { ...record, status: 'reviewed', needsReview: false };
        }
      }
      // This method has no way to accept a freshly-computed verdict alongside
      // the text (callers like M9 always recompute via a separate lqaGate
      // call right after), so any text change unconditionally drops the old
      // verdict rather than leaving it to survive against the new text — see
      // clearStaleLqaResults.
      const lqaResults = clearStaleLqaResults(
        current.lqaResults,
        new Set(recordToStore.text !== previousRecord?.text ? [targetLanguage] : []),
        new Set(),
      );
      const updated: StringEntry = {
        ...current,
        translations: {
          ...current.translations,
          // M9 constructs fresh records, so the version history must be
          // captured here — the previous text is folded into the new
          // record's bounded history under the same write lock.
          [targetLanguage]: normalizeReviewFlags(
            recordToStore,
            withTranslationHistory(previousRecord, recordToStore),
          ),
        },
        lqaResults,
        updatedAt: Date.now(),
      };
      await this.updateOne(projectId, entryId, updated);
      return updated;
    });
  }

  /**
   * Restores (or clears) a single language's translation record without
   * folding the value being replaced into version history — deliberately NOT
   * `withTranslationHistory`, since a revert is undoing a run, not making a new
   * edit worth remembering. `record: null` deletes the language key entirely
   * (the pair had no translation before the run being reverted). Also drops
   * `lqaResults[targetLanguage]`: that verdict was computed against the text
   * being discarded, so it would otherwise survive stale against whatever text
   * ends up in its place. Single-row, under the same per-project write lock
   * as `setTranslation`.
   */
  async restoreTranslation(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    record: TranslationRecord | null,
  ): Promise<StringEntry> {
    return this.writeLock.withLock(projectId, async () => {
      const current = await this.selectOne(projectId, entryId);
      if (!current) {
        throw new EntryNotFoundError(entryId);
      }
      const translations = { ...current.translations };
      if (record) {
        translations[targetLanguage] = record;
      } else {
        delete translations[targetLanguage];
      }
      const lqaResults = { ...current.lqaResults };
      delete lqaResults[targetLanguage];
      const updated: StringEntry = { ...current, translations, lqaResults, updatedAt: Date.now() };
      await this.updateOne(projectId, entryId, updated);
      return updated;
    });
  }

  /**
   * Atomic read-modify-write of a SINGLE language's LQA verdict. Reads the
   * entry inside the per-project write lock, computes `next = fn(current
   * verdict for `targetLanguage`)`, and writes back with ONLY
   * `lqaResults[targetLanguage]` replaced — every other language and every
   * other field is preserved. `fn` receives the FRESH per-language verdict
   * (or `undefined` when none exists), never a caller's pre-lock snapshot, so
   * a judge pass that appends its issues merges into the current gate result
   * rather than reverting a sibling/concurrent verdict written since the
   * caller's batch snapshot was taken. Single-row, same lock as
   * `setTranslation`.
   */
  async mutateLqaResult(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    fn: (current: LQAResult | undefined) => LQAResult,
  ): Promise<StringEntry> {
    return this.writeLock.withLock(projectId, async () => {
      const current = await this.selectOne(projectId, entryId);
      if (!current) {
        throw new EntryNotFoundError(entryId);
      }
      const next = fn(current.lqaResults?.[targetLanguage]);
      const updated: StringEntry = {
        ...current,
        lqaResults: { ...current.lqaResults, [targetLanguage]: next },
        updatedAt: Date.now(),
      };
      await this.updateOne(projectId, entryId, updated);
      return updated;
    });
  }

  /**
   * Flips STATUS-ONLY fields (`status`/`needsReview`) on a single language's
   * translation record under the per-project write lock, re-reading the entry
   * inside the lock. Deliberately NEVER carries `text` (or any other provenance
   * field): the current stored text is preserved verbatim, so this can never
   * revert a concurrent text write the way passing a whole snapshot record
   * through `updateEntry` would. When the language has no stored record, this
   * is a no-op (nothing to flip). The review-flag invariant
   * (`normalizeReviewFlags`) is applied, matching every other record write.
   */
  async setTranslationStatus(
    projectId: string,
    entryId: string,
    targetLanguage: string,
    patch: { status?: TranslationRecord['status']; needsReview?: boolean },
  ): Promise<StringEntry> {
    return this.writeLock.withLock(projectId, async () => {
      const current = await this.selectOne(projectId, entryId);
      if (!current) {
        throw new EntryNotFoundError(entryId);
      }
      const currentRecord = current.translations[targetLanguage];
      // Nothing to flip on a language that was never translated — a status-only
      // record with no text would be misclassified downstream. Leave as-is.
      if (!currentRecord) return current;
      // Merge only the status fields onto the CURRENT record; `text` and all
      // other fields (moduleId, timestamp, runId, previousVersions) come from
      // the fresh stored record, never from a caller snapshot.
      const merged: TranslationRecord = { ...currentRecord, ...patch };
      const updated: StringEntry = {
        ...current,
        translations: {
          ...current.translations,
          [targetLanguage]: normalizeReviewFlags(patch, merged),
        },
        updatedAt: Date.now(),
      };
      await this.updateOne(projectId, entryId, updated);
      return updated;
    });
  }

  async deleteEntry(projectId: string, id: string): Promise<void> {
    await this.writeLock.withLock(projectId, async () => {
      const { rows } = await this.db.query(
        'select 1 from strings where project_id = $1 and id = $2',
        [projectId, id],
      );
      if (rows.length === 0) {
        throw new EntryNotFoundError(id);
      }
      await this.db.query('delete from strings where project_id = $1 and id = $2', [projectId, id]);
      // Content-addressed ids mean a re-import of the same source text
      // restores this exact id — without this, it would silently inherit the
      // deleted entry's judge verdict / source-review finding.
      await getRunStore().deleteSidecarsForEntry(projectId, id);
    });
  }

  /**
   * Updates a specific set of entries by ID with a shared partial update.
   * Used by bulk category edits and similar bulk operations. Runs in a
   * transaction (multi-row update); returns only the updated entries.
   */
  async bulkUpdate(
    projectId: string,
    ids: string[],
    // `sourceText` is import-only (see updateEntry) and excluded here too.
    partial: Partial<Omit<StringEntry, 'id' | 'createdAt' | 'sourceText' | 'translations'>> & {
      translations?: Record<string, Partial<TranslationRecord>>;
    },
    // See updateEntry — optional, default false, same audit semantics applied
    // per touched entry.
    opts?: { recordManualEdits?: boolean },
  ): Promise<StringEntry[]> {
    return this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const { rows } = await tx.query<{ id: string; data: StringEntry }>(
          'select id, data from strings where project_id = $1 and id = any($2) order by seq',
          [projectId, ids],
        );
        const updated: StringEntry[] = [];
        for (const { id, data } of rows) {
          // Deep-merge translations: preserve existing language records and
          // merge individual record fields so that a per-language flag update
          // does not wipe out fields (text, status, etc.) on other languages.
          let mergedTranslations = data.translations;
          const changedTextLangs = new Set<string>();
          if (partial.translations) {
            mergedTranslations = { ...data.translations };
            for (const [lang, rec] of Object.entries(partial.translations)) {
              const prev = data.translations[lang];
              // The bulk-patch schema (routes/strings.ts:55, translationRecordPatchSchema)
              // makes `text` optional, unlike the single-PUT schema (:45, required). If
              // there's no prior record for this language and the patch supplies no
              // non-empty text, don't create a text-less record here — downstream
              // matchers key on status alone (e.g. 'translated'/'reviewed') and would
              // misclassify it as translated. A flag-only patch on an *existing* record
              // still applies normally below.
              if (!prev && !rec.text) continue;
              if (rec.text !== undefined && rec.text !== prev?.text) changedTextLangs.add(lang);
              mergedTranslations[lang] = normalizeReviewFlags(
                rec,
                withTranslationHistory(prev, { ...prev, ...rec }),
              );
            }
          }
          // No caller currently sends `partial.lqaResults` through this bulk path
          // (the route schema has no field for it), so any changed-text language
          // is always stale here — see clearStaleLqaResults.
          const lqaResults = clearStaleLqaResults(
            partial.lqaResults ?? data.lqaResults,
            changedTextLangs,
            new Set(Object.keys(partial.lqaResults ?? {})),
          );
          const merged: StringEntry = {
            ...data,
            ...partial,
            translations: mergedTranslations,
            lqaResults,
            id: data.id,
            // Source is import-only; re-pin against non-typed callers.
            sourceText: data.sourceText,
            createdAt: data.createdAt,
            updatedAt: Date.now(),
          };
          await tx.query('update strings set data = $3 where project_id = $1 and id = $2', [
            projectId,
            id,
            JSON.stringify(merged),
          ]);
          if (opts?.recordManualEdits) {
            await this.recordManualEdits(tx, projectId, id, data, partial.translations);
          }
          updated.push(merged);
        }
        return updated;
      }),
    );
  }

  /**
   * Assigns each entry's `reviewSortIndex` from a per-id map (single
   * transaction). Used by the local word-similarity pre-sort. Unlike bulkUpdate
   * this applies a *distinct* value per entry; entries absent from the map are
   * left untouched. Returns the number of entries whose index was set.
   */
  async setReviewSortIndices(
    projectId: string,
    indexById: ReadonlyMap<string, number>,
  ): Promise<number> {
    return this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const ids = [...indexById.keys()];
        const { rows } = await tx.query<{ id: string; data: StringEntry }>(
          'select id, data from strings where project_id = $1 and id = any($2)',
          [projectId, ids],
        );
        let count = 0;
        for (const { id, data } of rows) {
          const idx = indexById.get(id);
          if (idx !== undefined) {
            // Route the raw row through the same read-time healing every other
            // read path applies (stripLegacy), so re-persisting it here can't
            // write a pre-invariant contradictory record back to disk.
            const entry = stripLegacy(data);
            entry.reviewSortIndex = idx;
            await tx.query('update strings set data = $3 where project_id = $1 and id = $2', [
              projectId,
              id,
              JSON.stringify(entry),
            ]);
            count++;
          }
        }
        return count;
      }),
    );
  }

  /**
   * Atomically upserts a batch of entries (data-loss protection). Merges
   * imported entries with existing; preserves existing translations. Returns
   * the merged FULL entry list and a count of ghost entries blocked.
   *
   * `on conflict (project_id, id) do update set data = excluded.data` keeps an
   * existing row's `seq` (so it stays in place) while a genuinely new row gets a
   * fresh, higher `seq` — reproducing M3's "existing first, new appended" order.
   *
   * **Diff-only writes (perf):** only ids that are genuinely NEW or whose fully
   * merged row differs from what's stored are written. An id that resolves
   * unchanged (e.g. re-importing a CSV where most rows are identical to the
   * last import) is left untouched — no INSERT/UPDATE for it — so a small
   * incremental re-import into a large project costs O(changed), not
   * O(existing). Equality is structural ({@link entriesEqual}), not reference:
   * a merged candidate that ends up byte-identical to `prev` is treated as
   * unchanged even though a new object was allocated to compute it.
   *
   * **Per-field CSV-reimport merge table** (existing id; `prev` = stored row,
   * `entry` = incoming row from {@link CSVImporter.importCSV}'s `parseRow`).
   * The merge base is `{...prev, ...entry, ...overrides}`: any field `entry`
   * doesn't carry at all (parseRow never sets it) is inherited unchanged from
   * `prev` for free; a field parseRow DOES always set — even to an import-time
   * default/empty placeholder — needs an explicit override back to `prev`
   * below, since its mere presence in `entry` would otherwise clobber a
   * curated value with that placeholder. CSV legitimately updates only the
   * fields it actually carries (source metadata + translations); everything
   * else is user/system curation that must survive a re-import:
   *
   * | field                 | on re-import of an existing id                                     |
   * |-----------------------|----------------------------------------------------------------------|
   * | sourceText            | overwritten by import (identical in practice — id is a hash of sourceText, so a real change yields a new id, not a match here) |
   * | sources               | overwritten by import (CSV "Source" column)                          |
   * | needsTranslation      | overwritten by import (CSV "Need translation?" column)               |
   * | context               | overwritten only when the CSV carries a non-empty Context cell; an empty/missing cell preserves the stored value (clearing context is UI-only) |
   * | sortIndex             | overwritten by import (current CSV row position)                    |
   * | assignedGlossaryIds   | overwritten by import for the term-matched portion (M20 re-derives it from source text on every import pass, run before bulkUpsert), UNIONED with prev's manualGlossaryIds so a manual override survives the pass that never saw it |
   * | manualGlossaryIds     | **preserved from prev** — parseRow never sets this; a manual override survives import as-is (see the assignedGlossaryIds row above for how it's re-applied) |
   * | translations          | merged: a csv-import-sourced language record is gap-filled/refreshed by the incoming row; any other-sourced record (manual, DeepL, judge-corrected, etc.) is preserved as-is (unchanged logic) |
   * | categories            | **preserved from prev** — parseRow always sets `[]` (CSV carries no categories column) |
   * | metadata              | **preserved from prev** — parseRow always sets `{}` (CSV carries no metadata column) |
   * | overflowRatio         | **preserved from prev** — parseRow always sets the project's global default, never a per-entry curated value |
   * | lqaResults            | **preserved from prev** — AI review verdicts against the existing translation text; CSV carries none |
   * | createdAt             | **preserved from prev** — true creation time; parseRow always stamps `now` |
   * | flaggedNew            | **preserved/OR'd**: true if either side says true, else carries `prev`'s exact value forward unchanged (not forced to a fresh `false`) — a still-pending flag survives, a user-cleared flag is never resurrected, and a genuinely-untouched row stays byte-identical to `prev` for the diff above |
   * | orphanedAt            | **cleared on re-import** (both modes): an id that reappears in a CSV is live again — deliberate exception to the "preserved automatically" pattern |
   * | updatedAt             | bumped to `Date.now()` only when the merged row actually differs from `prev`; an unchanged row keeps its old `updatedAt` and isn't written at all |
   * | ignoreOverflow, ignored, promptOptions, sourceReview, reviewSortIndex, achievementType, achievementId | **preserved automatically** — parseRow never sets these keys at all, so the `{...prev, ...entry}` base has nothing from `entry` to clobber `prev`'s value with |
   */
  async bulkUpsert(
    projectId: string,
    incoming: StringEntry[],
  ): Promise<{ entries: StringEntry[]; ghostsBlocked: number }> {
    return this.writeLock.withLock(projectId, () =>
      withTransaction(this.db, async (tx) => {
        const existing = await this.loadTx(tx, projectId);
        const existingMap = new Map(existing.map((e) => [e.id, e]));
        let ghostsBlocked = 0;
        // ids whose row must actually be written this pass — see "Diff-only
        // writes" above. An id resolving unchanged is left in `existingMap`
        // (so it's still returned) but never added here.
        const toWrite: string[] = [];

        for (const entry of incoming) {
          // Defense-in-depth: silently drop ghost entries that slipped past the
          // importer. A ghost entry has no source text, demands translation, and
          // carries no translations — it can never be acted on and would pollute
          // the string table.
          if (
            !entry.sourceText &&
            entry.needsTranslation &&
            Object.keys(entry.translations).length === 0
          ) {
            ghostsBlocked++;
            continue;
          }

          const prev = existingMap.get(entry.id);
          if (prev) {
            // Merge translations: incoming fills gaps and refreshes csv-import
            // entries. Translations from other sources (DeepL, manual, etc.)
            // are preserved.
            const mergedTranslations = { ...prev.translations };
            for (const [lang, record] of Object.entries(entry.translations)) {
              const prevRecord = prev.translations[lang];
              if (!prevRecord || prevRecord.moduleId === 'csv-import') {
                mergedTranslations[lang] = record;
              }
            }
            // entry.assignedGlossaryIds is the pre-bulkUpsert M20 pass's
            // matched-only result — it never saw prev.manualGlossaryIds
            // (that pass runs on a bare freshly-parsed entry). Union it back
            // in here so a manual assignment doesn't transiently vanish
            // across a CSV re-import.
            const assignedGlossaryIdsUnion = Array.from(
              new Set([...(entry.assignedGlossaryIds ?? []), ...(prev.manualGlossaryIds ?? [])]),
            );
            // Base on `prev` first so any field `entry` doesn't carry at all
            // (ignoreOverflow, ignored, promptOptions, sourceReview,
            // reviewSortIndex, achievementType, achievementId) survives untouched; `entry`'s
            // own values then win for the fields CSV legitimately supplies,
            // and the curated fields below are explicitly pinned back to
            // `prev` since parseRow always sets them to an import-time
            // default/empty placeholder — see the class-doc table above.
            const candidate: StringEntry = {
              ...prev,
              ...entry,
              translations: mergedTranslations,
              // CSV only updates context when the file actually carries a
              // value — an empty/missing Context cell never erases curated
              // context. Clearing context is UI-only.
              context: entry.context || prev.context,
              assignedGlossaryIds:
                assignedGlossaryIdsUnion.length > 0 ? assignedGlossaryIdsUnion : undefined,
              categories: prev.categories,
              metadata: prev.metadata,
              overflowRatio: prev.overflowRatio,
              lqaResults: prev.lqaResults,
              createdAt: prev.createdAt,
              // `flaggedNew` is a review flag the user dismisses explicitly
              // (see routes/strings.ts "Clear new flags"), not a live
              // recomputation — re-importing the same row (never "new" again,
              // so `entry.flaggedNew` is unset here) must not silently clear
              // a still-pending flag. When neither side says true, carry
              // `prev`'s exact value forward (rather than normalizing to a
              // fresh `false`) so an untouched row stays byte-identical to
              // `prev` for the diff-only check below.
              flaggedNew:
                entry.flaggedNew === true || prev.flaggedNew === true ? true : prev.flaggedNew,
              updatedAt: prev.updatedAt,
            };
            // Re-imported ⇒ live again: an orphaned entry that reappears in a
            // CSV drops its stamp (both modes). `delete` (not `= undefined`)
            // so the persisted JSON carries no key; for never-orphaned rows
            // this is a no-op and the row stays byte-identical to `prev` for
            // the diff-only check below.
            delete candidate.orphanedAt;
            if (entriesEqual(candidate, prev)) {
              // Nothing actually changed — keep the stored row exactly as-is.
              existingMap.set(entry.id, prev);
            } else {
              candidate.updatedAt = Date.now();
              existingMap.set(entry.id, candidate);
              toWrite.push(entry.id);
            }
          } else {
            existingMap.set(entry.id, entry);
            toWrite.push(entry.id);
          }
        }

        // Upsert only the changed/new entries: existing rows keep their seq
        // via `do update`, new rows append with a fresh seq. Rows that
        // resolved unchanged above issue no query at all.
        for (const id of toWrite) {
          const data = existingMap.get(id)!;
          await tx.query(
            `insert into strings (project_id, id, tenant_id, data) values ($1, $2, current_setting('app.user_id'), $3)
             on conflict (project_id, id) do update set data = excluded.data`,
            [projectId, id, JSON.stringify(data)],
          );
        }

        // Re-read ordered by seq so the returned list reflects the persisted
        // "existing-first, new-appended" order.
        const merged = await this.loadTx(tx, projectId);
        return { entries: merged, ghostsBlocked };
      }),
    );
  }

  async markOrphaned(projectId: string, ids: string[], timestamp: number): Promise<number> {
    if (ids.length === 0) return 0;
    return this.writeLock.withLock(projectId, async () => {
      const { rows } = await this.db.query<{ id: string }>(
        `update strings
         set data = jsonb_set(data, '{orphanedAt}', to_jsonb($3::bigint))
         where project_id = $1 and id = any($2)
         returning id`,
        [projectId, ids, timestamp],
      );
      return rows.length;
    });
  }

  // --- internal persistence helpers (the only part that differs from M3) ---

  /** Ordered load on a specific connection (used inside a transaction). */
  private async loadTx(tx: Queryable, projectId: string): Promise<StringEntry[]> {
    const { rows } = await tx.query<{ data: StringEntry }>(
      'select data from strings where project_id = $1 order by seq',
      [projectId],
    );
    return rows.map((r) => stripLegacy(r.data));
  }

  /**
   * Single-row select; null when absent (callers raise EntryNotFoundError).
   * `db` defaults to `this.db`; `updateEntry` passes its transaction so the
   * read and the write it feeds share one connection.
   */
  private async selectOne(
    projectId: string,
    id: string,
    db: Queryable = this.db,
  ): Promise<StringEntry | null> {
    const { rows } = await db.query<{ data: StringEntry }>(
      'select data from strings where project_id = $1 and id = $2',
      [projectId, id],
    );
    return rows.length === 0 ? null : stripLegacy(rows[0]!.data);
  }

  /**
   * Single-row data overwrite (the affected row already exists). `db`
   * defaults to `this.db`; `updateEntry` passes its transaction (see
   * `selectOne`).
   */
  private async updateOne(
    projectId: string,
    id: string,
    entry: StringEntry,
    db: Queryable = this.db,
  ): Promise<void> {
    await db.query('update strings set data = $3 where project_id = $1 and id = $2', [
      projectId,
      id,
      JSON.stringify(entry),
    ]);
  }

  /**
   * Inserts one `manual_edits` audit row per language in `translations` whose
   * `text` is present and differs from `current`'s stored text for that
   * language — status/flag/metadata-only changes (text `undefined`, or equal
   * to what's already stored) insert nothing, and neither does a
   * never-translated language given empty text (no prior record + falsy
   * `text` — mirrors bulkUpdate's merge no-op skip so it never audits a
   * change bulkUpdate itself treated as a no-op). Only called when the
   * caller opted in via `{ recordManualEdits: true }` on
   * `updateEntry`/`bulkUpdate`.
   * Runs on the same transaction/connection as the entry write (`tx`) so the
   * audit row and the entry update commit atomically. `created_by` is
   * stamped from the GUC (`current_setting('app.user_id')`) — never passed as
   * a param, mirroring `bulkUpsert`'s tenant_id stamp above.
   */
  private async recordManualEdits(
    tx: Queryable,
    projectId: string,
    entryId: string,
    current: StringEntry,
    translations: Record<string, Partial<TranslationRecord>> | undefined,
  ): Promise<void> {
    if (!translations) return;
    for (const [lang, record] of Object.entries(translations)) {
      if (record.text === undefined) continue;
      const previous = current.translations[lang];
      const beforeText = previous?.text;
      // Mirror bulkUpdate's merge no-op skip (`!prev && !rec.text`, above): a
      // never-translated language given empty text is not a real edit —
      // recording it would insert a phantom audit row (before=null, after='').
      if (!previous && !record.text) continue;
      if (record.text === beforeText) continue;
      await tx.query(
        `insert into manual_edits (id, project_id, entry_id, language, before_text, after_text, created_by)
         values ($1, $2, $3, $4, $5, $6, current_setting('app.user_id'))`,
        [randomUUID(), projectId, entryId, lang, beforeText ?? null, record.text],
      );
    }
  }

  /** Replace the whole project set in array order (fresh seq). Caller supplies a tx. */
  private async replaceAll(
    tx: Queryable,
    projectId: string,
    entries: StringEntry[],
  ): Promise<void> {
    await tx.query('delete from strings where project_id = $1', [projectId]);
    for (const entry of entries) {
      await tx.query(
        `insert into strings (project_id, id, tenant_id, data) values ($1, $2, current_setting('app.user_id'), $3)`,
        [projectId, entry.id, JSON.stringify(entry)],
      );
    }
  }

  /**
   * Relink-tab candidates: live (non-excluded) entries ranked by pg_trgm
   * `similarity(data->>'sourceText', query)` descending, most-similar
   * first (migration 0018 creates the extension + a GIN trigram index on the
   * same expression, so this is index-backed). Capped at 200 so an
   * enormous project doesn't ship its whole string table to the client — the
   * UI's search box further narrows client-side on top of this ranking.
   *
   * Falls back to unranked stored order when `similarity()` doesn't exist
   * (Postgres error 42883 `undefined_function`) — the migration's guard
   * silently skips `create extension` in environments where pg_trgm can't be
   * installed (see 0018), so this degrades the same way rather than 500ing.
   */
  async rankBySourceSimilarity(
    projectId: string,
    query: string,
    excludeIds: string[],
  ): Promise<Array<{ id: string; sourceText: string }>> {
    try {
      const { rows } = await this.db.query<{ id: string; source_text: string }>(
        `select id, data->>'sourceText' as source_text
         from strings
         where project_id = $1 and not (id = any($2))
           and (data->>'orphanedAt') is null
         order by similarity(data->>'sourceText', $3) desc, seq asc
         limit 200`,
        [projectId, excludeIds, query],
      );
      return rows.map((r) => ({ id: r.id, sourceText: r.source_text }));
    } catch (err) {
      if (!isUndefinedFunctionError(err)) throw err;
      const excluded = new Set(excludeIds);
      const entries = await this.load(projectId);
      return entries
        .filter((e) => !excluded.has(e.id) && e.orphanedAt == null)
        .map((e) => ({ id: e.id, sourceText: e.sourceText }));
    }
  }
}

/** True for Postgres SQLSTATE 42883 (undefined_function) — e.g. a missing pg_trgm. */
function isUndefinedFunctionError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '42883'
  );
}

// --- pure query matchers: transcribed verbatim from M3:394-427 ---

function matchesFilters(entry: StringEntry, filters: StringQueryFilters): boolean {
  if (filters.category && !entry.categories.includes(filters.category)) return false;
  if (filters.source && !(entry.sources ?? []).includes(filters.source)) return false;
  if (filters.runId && !Object.values(entry.translations).some((r) => r.runId === filters.runId))
    return false;
  if (!matchesTranslationStatus(entry, filters)) return false;
  if (!matchesUntranslated(entry, filters)) return false;
  if (
    filters.lqaFailed &&
    !Object.values(entry.lqaResults).some((r) => !r.passed || (!entry.ignoreOverflow && r.overflow))
  )
    return false;
  return true;
}

function matchesTranslationStatus(entry: StringEntry, filters: StringQueryFilters): boolean {
  if (!filters.language || !filters.translationStatus) return true;
  const rec = entry.translations[filters.language];
  return rec?.status === filters.translationStatus;
}

function matchesUntranslated(entry: StringEntry, filters: StringQueryFilters): boolean {
  if (filters.untranslatedForLanguage) {
    const rec = entry.translations[filters.untranslatedForLanguage];
    if (rec && (rec.status === 'translated' || rec.status === 'reviewed')) return false;
  }
  if (filters.untranslatedOnly) {
    const hasAnyTranslation = Object.values(entry.translations).some(
      (r) => r.status === 'translated' || r.status === 'reviewed',
    );
    if (hasAnyTranslation) return false;
  }
  return true;
}
