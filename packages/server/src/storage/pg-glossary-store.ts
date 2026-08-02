/**
 * PgGlossaryStore — Postgres adapter for the former M8 GlossaryManager.
 *
 * CRUD for project-scoped glossary terms. Supports multiple named glossary
 * "folders" per project, persisted as one `glossaries` row per (project_id, id)
 * holding the whole glossary as `data` jsonb. Read-only glossaries (the static
 * global ones) are served directly from the global-glossaries registry and
 * never written to a project's rows; their per-project enabled toggle lives in
 * a single `glossary_overrides` row.
 *
 * Transcribed verbatim from M8, swapping file I/O for whole-row upserts:
 * `loadGlossaryRow`/`saveGlossary` replace the per-`{id}.json` read/atomicWrite.
 * The legacy `glossary.json` → `glossaries/default.json` migration M8 ran on
 * first access is intentionally dropped (no legacy file exists at runtime).
 */
import { randomUUID } from 'node:crypto';
import type {
  Glossary,
  GlossarySummary,
  GlossaryTerm,
  TranslationModule,
} from '@zercade-dev/narn-shared';
import { PSEUDO_LANGUAGE_CODE, isComplete, projectTargetLanguages } from '@zercade-dev/narn-shared';
import { KeyedAsyncLock } from '../utils/keyed-lock.js';
import {
  GlossaryNotFoundError,
  GlossaryTermNotFoundError,
  ReadOnlyGlossaryError,
} from '../types/errors.js';
import {
  globalGlossaryIds,
  getGlobalGlossary,
  listGlobalGlossaries,
} from '../data/global-glossaries/index.js';
import type { Queryable } from './pg/pool.js';
import { withTransaction } from './pg/pool.js';
import type { GlossaryStore, IncompleteGlossary } from './types.js';
// Resolve the project store lazily (call-time, inside pushToDeepL) so the
// registry↔store import cycle is safe and a per-test setProjectStore() is honored.
import { getProjectStore } from './registry.js';

export interface PgGlossaryStoreDeps {
  deepLModuleProvider?: (
    config: Record<string, unknown> | undefined,
    sessionId: string | undefined,
  ) => TranslationModule | undefined;
}

/**
 * Optional per-(run,language) memo a caller builds once (via
 * {@link createGlossaryTermsCache}) and passes into every `getTermsForLanguage`
 * call for that run — one call per translated entry in M9/M10/M25 — so the
 * `listGlossaries` summaries, the `glossary_overrides` row, and each distinct
 * glossary's full row are read from Postgres at most ONCE per run instead of
 * once per entry (the N+1 this cache exists to collapse). Omitting `cache`
 * entirely preserves the exact prior per-call behavior — this is purely
 * additive/backward-compatible.
 */
export interface GlossaryTermsCache {
  summaries?: GlossarySummary[];
  overrides?: Record<string, boolean>;
  glossariesById: Map<string, Glossary>;
}

/** Creates an empty {@link GlossaryTermsCache} for a caller to reuse across entries. */
export function createGlossaryTermsCache(): GlossaryTermsCache {
  return { glossariesById: new Map() };
}

export class PgGlossaryStore implements GlossaryStore {
  private readonly db: Queryable;
  private readonly deepLModuleProvider: (
    config: Record<string, unknown> | undefined,
    sessionId: string | undefined,
  ) => TranslationModule | undefined;
  // Serializes writes per resource (glossary or overrides row) to prevent lost
  // updates between read-modify-write callers. Mirrors M1 / M3 / M8.
  private readonly writeLock = new KeyedAsyncLock();

  constructor(db: Queryable, deps: PgGlossaryStoreDeps = {}) {
    this.db = db;
    this.deepLModuleProvider = deps.deepLModuleProvider ?? (() => undefined);
  }

  /**
   * Whole-row fetch for a project-local glossary; null when no row exists.
   * Filters by `project_id` only — membership RLS scopes the row to the tenant;
   * `db` defaults to `this.db` (the read-modify-write callers pass their tx).
   */
  private async loadGlossaryRow(
    projectId: string,
    glossaryId: string,
    db: Queryable = this.db,
  ): Promise<Glossary | null> {
    const { rows } = await db.query<{ data: Glossary }>(
      'select data from glossaries where project_id = $1 and id = $2',
      [projectId, glossaryId],
    );
    return rows[0]?.data ?? null;
  }

  private async readEnabledOverrides(
    projectId: string,
    db: Queryable = this.db,
  ): Promise<Record<string, boolean>> {
    const { rows } = await db.query<{ overrides: Record<string, boolean> }>(
      'select overrides from glossary_overrides where project_id = $1',
      [projectId],
    );
    return rows[0]?.overrides ?? {};
  }

  private async writeEnabledOverride(
    projectId: string,
    glossaryId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.writeLock.withLock(`overrides:${projectId}`, () =>
      withTransaction(this.db, async (tx) => {
        const overrides = await this.readEnabledOverrides(projectId, tx);
        overrides[glossaryId] = enabled;
        await tx.query(
          `insert into glossary_overrides (project_id, tenant_id, overrides) values ($1, current_setting('app.user_id'), $2)
           on conflict (project_id) do update set overrides = excluded.overrides`,
          [projectId, JSON.stringify(overrides)],
        );
      }),
    );
  }

  /**
   * Public read access to the per-project global-glossary enabled overrides
   * (used by the template store to snapshot them).
   */
  async getEnabledOverrides(projectId: string): Promise<Record<string, boolean>> {
    return this.readEnabledOverrides(projectId);
  }

  /**
   * Merges the given enabled overrides into the project's overrides row.
   * Used when applying a project template; unknown glossary ids are kept
   * (callers report them as warnings rather than failing).
   */
  async setEnabledOverrides(projectId: string, overrides: Record<string, boolean>): Promise<void> {
    if (Object.keys(overrides).length === 0) return;
    await this.writeLock.withLock(`overrides:${projectId}`, () =>
      withTransaction(this.db, async (tx) => {
        const current = await this.readEnabledOverrides(projectId, tx);
        await tx.query(
          `insert into glossary_overrides (project_id, tenant_id, overrides) values ($1, current_setting('app.user_id'), $2)
           on conflict (project_id) do update set overrides = excluded.overrides`,
          [projectId, JSON.stringify({ ...current, ...overrides })],
        );
      }),
    );
  }

  async listGlossaries(
    projectId: string,
    // Lets a caller that already fetched the overrides row (e.g.
    // `getTermsForLanguage` with a `GlossaryTermsCache`) pass it in, so this
    // doesn't re-read `glossary_overrides` on top of the caller's own read.
    // Omitted ⇒ unchanged behavior (fetched here).
    presetOverrides?: Record<string, boolean>,
  ): Promise<GlossarySummary[]> {
    const summaries: GlossarySummary[] = [];
    const { rows } = await this.db.query<{ data: Glossary }>(
      'select data from glossaries where project_id = $1',
      [projectId],
    );
    for (const row of rows) {
      const g = row.data;
      if (g === null) continue;
      // Skip project-local copies of global glossaries — the global registry
      // version takes precedence.
      if (globalGlossaryIds.has(g.id)) continue;
      try {
        summaries.push({
          id: g.id,
          projectId: g.projectId,
          name: g.name,
          readOnly: g.readOnly,
          enabled: g.enabled,
          termCount: g.terms.length,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        });
      } catch {
        /* skip a row that parsed but is missing expected fields */
      }
    }
    // Append global read-only glossaries last, applying any per-project enabled overrides.
    const overrides = presetOverrides ?? (await this.readEnabledOverrides(projectId));
    for (const g of listGlobalGlossaries(projectId)) {
      summaries.push({
        id: g.id,
        projectId,
        name: g.name,
        readOnly: g.readOnly,
        enabled: g.id in overrides ? overrides[g.id] : g.enabled,
        termCount: g.terms.length,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      });
    }
    return summaries.sort((a, b) => a.createdAt - b.createdAt);
  }

  async getGlossary(
    projectId: string,
    glossaryId = 'default',
    db: Queryable = this.db,
    // Lets a caller that already fetched the overrides row (e.g.
    // `getTermsForLanguage` with a `GlossaryTermsCache`) pass it in, so a
    // global-glossary lookup doesn't re-read `glossary_overrides` every time.
    // Omitted ⇒ unchanged behavior (fetched here).
    presetOverrides?: Record<string, boolean>,
  ): Promise<Glossary> {
    // Global glossaries are served directly from the registry, with per-project enabled overrides applied.
    if (globalGlossaryIds.has(glossaryId)) {
      const global = getGlobalGlossary(glossaryId, projectId);
      if (global) {
        const overrides = presetOverrides ?? (await this.readEnabledOverrides(projectId, db));
        if (glossaryId in overrides) global.enabled = overrides[glossaryId];
        return global;
      }
    }
    const glossary = await this.loadGlossaryRow(projectId, glossaryId, db);
    if (glossary !== null) {
      return glossary;
    }
    if (glossaryId !== 'default') {
      throw new GlossaryNotFoundError(glossaryId);
    }
    // Return empty default (without writing — matches legacy behaviour)
    const now = Date.now();
    return {
      id: 'default',
      name: 'Default',
      projectId,
      terms: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  async createGlossary(
    projectId: string,
    name: string,
    opts: { readOnly?: boolean; id?: string } = {},
  ): Promise<Glossary> {
    const id = opts.id ?? randomUUID();
    const now = Date.now();
    const glossary: Glossary = {
      id,
      projectId,
      name,
      readOnly: opts.readOnly,
      enabled: opts.readOnly ? false : true,
      terms: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.db.query(
      `insert into glossaries (project_id, id, tenant_id, data) values ($1, $2, current_setting('app.user_id'), $3)
       on conflict (project_id, id) do update set data = excluded.data`,
      [projectId, id, JSON.stringify(glossary)],
    );
    return glossary;
  }

  async updateGlossary(
    projectId: string,
    glossaryId: string,
    patch: { name?: string; enabled?: boolean },
  ): Promise<Glossary> {
    // Global (read-only) glossaries: only `enabled` can be changed, stored as
    // a per-project override rather than mutating the shared registry template.
    if (globalGlossaryIds.has(glossaryId)) {
      if (patch.name !== undefined) throw new ReadOnlyGlossaryError(glossaryId);
      if (patch.enabled !== undefined) {
        await this.writeEnabledOverride(projectId, glossaryId, patch.enabled);
      }
      return this.getGlossary(projectId, glossaryId);
    }
    return this.writeLock.withLock(`glossary:${projectId}:${glossaryId}`, async () => {
      const glossary = await this.getGlossary(projectId, glossaryId);
      if (glossary.readOnly) throw new ReadOnlyGlossaryError(glossaryId);
      if (patch.name !== undefined) glossary.name = patch.name;
      if (patch.enabled !== undefined) glossary.enabled = patch.enabled;
      glossary.updatedAt = Date.now();
      await this.writeGlossaryRow(projectId, glossaryId, glossary);
      return glossary;
    });
  }

  async deleteGlossary(projectId: string, glossaryId: string): Promise<void> {
    const glossary = await this.getGlossary(projectId, glossaryId);
    if (glossary.readOnly) throw new ReadOnlyGlossaryError(glossaryId);
    await this.db.query('delete from glossaries where project_id = $1 and id = $2', [
      projectId,
      glossaryId,
    ]);
  }

  /**
   * Whole-row upsert preserving the passed `data` as-is (no updatedAt touch).
   * `db` defaults to `this.db`; the read-modify-write callers pass their tx so
   * the read and the write share one tenant transaction.
   */
  private async writeGlossaryRow(
    projectId: string,
    glossaryId: string,
    glossary: Glossary,
    db: Queryable = this.db,
  ): Promise<void> {
    await db.query(
      `insert into glossaries (project_id, id, tenant_id, data) values ($1, $2, current_setting('app.user_id'), $3)
       on conflict (project_id, id) do update set data = excluded.data`,
      [projectId, glossaryId, JSON.stringify(glossary)],
    );
  }

  private async saveGlossary(
    projectId: string,
    glossaryId: string,
    glossary: Glossary,
    db: Queryable = this.db,
  ): Promise<void> {
    glossary.updatedAt = Date.now();
    await this.writeGlossaryRow(projectId, glossaryId, glossary, db);
  }

  async addTerm(
    projectId: string,
    termOrGlossaryId: Omit<GlossaryTerm, 'id'> | string,
    termArg?: Omit<GlossaryTerm, 'id'>,
  ): Promise<GlossaryTerm> {
    // Overload: addTerm(projectId, term) — default glossary (backward compat)
    // Overload: addTerm(projectId, glossaryId, term) — specific glossary
    const glossaryId = typeof termOrGlossaryId === 'string' ? termOrGlossaryId : 'default';
    const term = typeof termOrGlossaryId === 'string' ? termArg! : termOrGlossaryId;

    return this.writeLock.withLock(`glossary:${projectId}:${glossaryId}`, () =>
      withTransaction(this.db, async (tx) => {
        const glossary = await this.getGlossary(projectId, glossaryId, tx);
        if (glossary.readOnly) throw new ReadOnlyGlossaryError(glossaryId);
        const newTerm: GlossaryTerm = { id: randomUUID(), ...term };
        glossary.terms.push(newTerm);
        await this.saveGlossary(projectId, glossaryId, glossary, tx);
        return newTerm;
      }),
    );
  }

  async updateTerm(
    projectId: string,
    termIdOrGlossaryId: string,
    partialOrTermId: Partial<GlossaryTerm> | string,
    partialArg?: Partial<GlossaryTerm>,
  ): Promise<GlossaryTerm> {
    // Overload: updateTerm(projectId, termId, partial) — default glossary (backward compat)
    // Overload: updateTerm(projectId, glossaryId, termId, partial) — specific glossary
    const glossaryId = typeof partialOrTermId === 'string' ? termIdOrGlossaryId : 'default';
    const termId = typeof partialOrTermId === 'string' ? partialOrTermId : termIdOrGlossaryId;
    const partial =
      typeof partialOrTermId === 'string'
        ? partialArg!
        : (partialOrTermId as Partial<GlossaryTerm>);

    return this.writeLock.withLock(`glossary:${projectId}:${glossaryId}`, () =>
      withTransaction(this.db, async (tx) => {
        const glossary = await this.getGlossary(projectId, glossaryId, tx);
        if (glossary.readOnly) throw new ReadOnlyGlossaryError(glossaryId);
        const index = glossary.terms.findIndex((t) => t.id === termId);
        if (index === -1) {
          throw new GlossaryTermNotFoundError(termId);
        }
        const merged: GlossaryTerm = {
          ...glossary.terms[index],
          ...partial,
          id: glossary.terms[index].id,
        };
        glossary.terms[index] = merged;
        await this.saveGlossary(projectId, glossaryId, glossary, tx);
        return merged;
      }),
    );
  }

  async deleteTerm(
    projectId: string,
    termIdOrGlossaryId: string,
    termIdArg?: string,
  ): Promise<void> {
    // Overload: deleteTerm(projectId, termId) — default glossary (backward compat)
    // Overload: deleteTerm(projectId, glossaryId, termId) — specific glossary
    const glossaryId = termIdArg ? termIdOrGlossaryId : 'default';
    const termId = termIdArg ?? termIdOrGlossaryId;

    return this.writeLock.withLock(`glossary:${projectId}:${glossaryId}`, () =>
      withTransaction(this.db, async (tx) => {
        const glossary = await this.getGlossary(projectId, glossaryId, tx);
        if (glossary.readOnly) throw new ReadOnlyGlossaryError(glossaryId);
        const before = glossary.terms.length;
        glossary.terms = glossary.terms.filter((t) => t.id !== termId);
        if (glossary.terms.length === before) {
          throw new GlossaryTermNotFoundError(termId);
        }
        await this.saveGlossary(projectId, glossaryId, glossary, tx);
      }),
    );
  }

  async pushToDeepL(
    projectId: string,
    glossaryId = 'default',
    sessionId?: string,
    opts?: { replace?: boolean },
  ): Promise<{ pushed: number }> {
    const [glossary, project] = await Promise.all([
      this.getGlossary(projectId, glossaryId),
      getProjectStore().loadProject(projectId),
    ]);

    if (glossary.enabled === false) {
      throw new Error('Cannot push a disabled glossary to DeepL');
    }

    const moduleConfig = (
      project.moduleConfigs?.['deepl'] as { config?: Record<string, unknown> } | undefined
    )?.config;
    const deepl = this.deepLModuleProvider(moduleConfig, sessionId);
    if (!deepl) {
      throw new Error('DeepL module not loaded');
    }
    if (typeof deepl.pushGlossary !== 'function') {
      throw new Error('DeepL module does not support pushGlossary');
    }
    await deepl.pushGlossary(glossary, project.sourceLanguage, opts);
    // Record the successful push so the UI can flag stale DeepL copies after
    // later edits/imports. Only project-local writable glossaries persist this;
    // global read-only glossaries are never written. Written directly (no
    // updatedAt bump) so `updatedAt > pushedToDeepLAt` is false right after a push.
    if (!globalGlossaryIds.has(glossaryId) && !glossary.readOnly) {
      await this.writeLock.withLock(`glossary:${projectId}:${glossaryId}`, async () => {
        // null when the glossary row doesn't exist (empty default) — nothing to record.
        const fresh = await this.loadGlossaryRow(projectId, glossaryId);
        if (fresh) {
          fresh.pushedToDeepLAt = Date.now();
          await this.writeGlossaryRow(projectId, glossaryId, fresh);
        }
      });
    }
    return { pushed: glossary.terms.length };
  }

  async getTermsForLanguage(
    projectId: string,
    targetLanguage: string,
    glossaryIds?: string[],
    projectTargetLangs?: string[],
    // Optional per-(run,language) memo (see {@link GlossaryTermsCache}) — pass
    // the SAME cache instance across every entry in a run so the summaries
    // list, the overrides row, and each glossary's terms are fetched at most
    // once instead of once per entry. Omitted ⇒ unchanged, uncached behavior
    // (backward-compatible for every existing caller).
    cache?: GlossaryTermsCache,
  ): Promise<GlossaryTerm[]> {
    // `listGlossaries` unconditionally appends the static global glossaries, so
    // `summaries` is never empty.
    let summaries: GlossarySummary[];
    if (cache) {
      if (!cache.summaries) {
        // Prefetch overrides once and hand them to `listGlossaries` too, so
        // the whole cached lifetime reads `glossary_overrides` exactly once
        // (not once for the summaries + once again per global-glossary term
        // lookup below).
        if (!cache.overrides) cache.overrides = await this.readEnabledOverrides(projectId);
        cache.summaries = await this.listGlossaries(projectId, cache.overrides);
      }
      summaries = cache.summaries;
    } else {
      summaries = await this.listGlossaries(projectId);
    }
    // When glossaryIds is a non-empty array, filter to those IDs only.
    // When glossaryIds is an empty array, return nothing (no glossary configured).
    // When glossaryIds is undefined, use all summaries (legacy / unset default).
    //
    // For an explicit id list, drop disabled glossaries: `forcedGlossaryIds`
    // and stale `assignedGlossaryIds` are not filtered for `enabled` upstream,
    // so a disabled-but-referenced glossary would otherwise still feed
    // adherence / spellcheck-ignore / masking. The undefined (legacy) path
    // keeps every summary so opt-in global glossaries (enabled:false by
    // default) are unaffected.
    const effectiveSummaries =
      glossaryIds === undefined
        ? summaries
        : glossaryIds.length > 0
          ? summaries.filter((s) => glossaryIds.includes(s.id) && s.enabled !== false)
          : [];

    // Read-only glossaries (global reference glossaries, or any project
    // glossary created with `readOnly: true`) auto-ignore incomplete
    // NON-CONSTANT terms — ones missing a translation for one of the
    // project's configured target languages — so they never reach the
    // translation/LQA/judge reference path. Constant (do-not-translate) terms
    // are exempt: they routinely carry no/sparse translations by design (the
    // masking guarantee below already handles "no translation for THIS
    // language" and must not regress for read-only glossaries).
    // `projectTargetLangs` lets a caller that already loaded the project
    // (M9/M10/M25 all do, right before calling this) pass it through instead
    // of triggering a second `loadProject`; only fetched lazily here (and only
    // once per call, not per term) when a read-only glossary is actually
    // present and no caller value was supplied. If the lazy load itself fails,
    // fail OPEN (treat every term as complete) rather than losing every
    // already-collected term from earlier, successfully-processed summaries.
    let targetLangs = projectTargetLangs;
    const resolveTargetLangs = async (): Promise<string[]> => {
      if (targetLangs === undefined) {
        try {
          const project = await getProjectStore().loadProject(projectId);
          targetLangs = projectTargetLanguages(project);
        } catch {
          targetLangs = [];
        }
      }
      return targetLangs;
    };

    const allTerms: GlossaryTerm[] = [];
    for (const summary of effectiveSummaries) {
      let g: Glossary;
      if (cache) {
        const cached = cache.glossariesById.get(summary.id);
        if (cached) {
          g = cached;
        } else {
          // Fetched once per run (not once per glossary-per-entry): a global
          // summary's `getGlossary` would otherwise re-read `glossary_overrides`
          // on every call.
          if (!cache.overrides) cache.overrides = await this.readEnabledOverrides(projectId);
          g = await this.getGlossary(projectId, summary.id, this.db, cache.overrides);
          cache.glossariesById.set(summary.id, g);
        }
      } else {
        g = await this.getGlossary(projectId, summary.id);
      }
      // Resolved once per glossary (not per term) — cheap enough that every
      // read-only summary pays for it, but avoids re-awaiting per term.
      const readOnlyTargetLangs = summary.readOnly ? await resolveTargetLangs() : undefined;
      for (const t of g.terms) {
        if (readOnlyTargetLangs && !t.constant && !isComplete(t, readOnlyTargetLangs)) continue;
        const v = t.translations[targetLanguage];
        // A constant (do-not-translate) term must surface even without a target
        // translation so TranslationMasker can mask it; otherwise the raw term is
        // sent to the model. Non-constant terms still require a non-empty value.
        if (t.constant || (typeof v === 'string' && v.length > 0)) {
          allTerms.push(t);
        }
      }
    }
    return allTerms;
  }

  /**
   * Pre-translation completeness check: for the project's OWN (non-readOnly),
   * enabled glossaries, find every term — constant (do-not-translate) ones
   * included — that lacks a translation for any of the given target languages.
   * The synthetic pseudo-test language is excluded. Returns one entry per
   * incomplete glossary; an empty array means every active project glossary is
   * complete for these languages.
   */
  async findIncompleteGlossaries(
    projectId: string,
    targetLanguages: string[],
  ): Promise<IncompleteGlossary[]> {
    const langs = targetLanguages.filter((l) => l && l !== PSEUDO_LANGUAGE_CODE);
    if (langs.length === 0) return [];
    const summaries = await this.listGlossaries(projectId);
    const incomplete: IncompleteGlossary[] = [];
    for (const summary of summaries) {
      // Only the project's own, active glossaries are expected to be complete;
      // read-only global reference glossaries and disabled ones are skipped.
      if (summary.readOnly || summary.enabled === false) continue;
      const g = await this.getGlossary(projectId, summary.id);
      const missingLanguages = new Set<string>();
      let missingTermCount = 0;
      for (const t of g.terms) {
        const gaps = langs.filter((lang) => {
          const v = t.translations[lang];
          return !(typeof v === 'string' && v.length > 0);
        });
        if (gaps.length > 0) {
          missingTermCount++;
          for (const lang of gaps) missingLanguages.add(lang);
        }
      }
      if (missingLanguages.size > 0) {
        incomplete.push({
          glossaryId: summary.id,
          glossaryName: summary.name,
          missingLanguages: [...missingLanguages],
          missingTermCount,
        });
      }
    }
    return incomplete;
  }
}
