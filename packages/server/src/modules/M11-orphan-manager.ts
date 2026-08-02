import type { OrphanEntry, StringEntry } from '@zercade-dev/narn-shared';
import type { ImportDiff } from './M2-csv-importer.js';
import type { StringStore } from '../storage/types.js';
import { getStringStore } from '../storage/registry.js';
import { logger } from './M15-console-logger.js';
import { lqaGate } from './M10-lqa-gate.js';
import { EntryNotFoundError, ValidationError } from '../types/errors.js';

function countTranslations(entry: StringEntry): number {
  let count = 0;
  for (const rec of Object.values(entry.translations)) {
    if (rec?.text && rec.text.length > 0) count += 1;
  }
  return count;
}

/**
 * How an orphan's translations are folded onto the relink target:
 * `'empty-only'` (the original, still-default behavior) only fills target
 * slots that have no translation yet; `'all'` unconditionally takes the
 * orphan's translation for every language the orphan has, overwriting
 * whatever the target already had.
 */
export type RelinkOverrideMode = 'all' | 'empty-only';

export class OrphanManager {
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _ss?: StringStore;
  private get ss(): StringStore {
    return this._ss ?? getStringStore();
  }

  constructor(ss?: StringStore) {
    this._ss = ss;
  }

  /**
   * Maps each entry to an `OrphanEntry` (adding its translation count) and
   * sorts descending by `translationCount` so the most-translated orphans
   * surface first (highest effort to recreate). Shared by {@link detectOrphans}
   * and {@link listOrphans}, which differ only in how they pick the entries.
   */
  private toSortedOrphans(entries: StringEntry[]): OrphanEntry[] {
    return entries
      .map((e) => ({ ...e, translationCount: countTranslations(e) }))
      .sort((a, b) => b.translationCount - a.translationCount);
  }

  /**
   * Returns orphan entries derived from an import diff. An orphan is an entry
   * present in `existingEntries` whose ID appears in `diff.removed` (i.e. it
   * was not produced by the most recent CSV import).
   *
   * Sort: descending by `translationCount` so the most-translated orphans
   * surface first (highest effort to recreate).
   */
  detectOrphans(diff: ImportDiff, existingEntries: StringEntry[]): OrphanEntry[] {
    const byId = new Map(existingEntries.map((e) => [e.id, e]));
    const matched: StringEntry[] = [];
    for (const id of diff.removed) {
      const entry = byId.get(id);
      if (!entry) continue;
      matched.push(entry);
    }
    const orphans = this.toSortedOrphans(matched);
    logger.info('orphan:detected', { count: orphans.length });
    return orphans;
  }

  /**
   * Returns orphan entries: the union of entries whose ids are in `orphanIds`
   * (add-only imports' in-memory diff, may be empty after a restart) and
   * entries with a persisted `orphanedAt` stamp (full-replace imports, which
   * survive restarts).
   */
  async listOrphans(projectId: string, orphanIds: string[]): Promise<OrphanEntry[]> {
    const entries = await this.ss.load(projectId);
    const idSet = new Set(orphanIds);
    return this.toSortedOrphans(entries.filter((e) => idSet.has(e.id) || e.orphanedAt != null));
  }

  async deleteOrphan(projectId: string, entryId: string): Promise<void> {
    await this.ss.deleteEntry(projectId, entryId);
    logger.info('orphan:deleted', { projectId, entryId });
  }

  /**
   * Moves translations from an orphaned entry onto a different (live) entry
   * and removes the orphan.
   *
   * `overrideMode` (default `'empty-only'`, the original behavior) controls how
   * each orphan translation is folded onto the target: `'empty-only'` only
   * fills a target slot that has no translation yet; `'all'` unconditionally
   * takes the orphan's translation for every language the orphan has,
   * overwriting whatever the target already had for that language.
   */
  async relinkOrphan(
    projectId: string,
    orphanId: string,
    newSourceId: string,
    overrideMode: RelinkOverrideMode = 'empty-only',
  ): Promise<StringEntry> {
    if (orphanId === newSourceId) {
      throw new ValidationError('orphanId and newSourceId must differ');
    }
    const entries = await this.ss.load(projectId);
    const orphan = entries.find((e) => e.id === orphanId);
    if (!orphan) throw new EntryNotFoundError(orphanId);
    const target = entries.find((e) => e.id === newSourceId);
    if (!target) throw new EntryNotFoundError(newSourceId);

    const mergedTranslations = { ...target.translations };
    // Languages whose translation text this merge actually overwrites — the
    // incoming text comes from the ORPHAN's translation of a DIFFERENT
    // source string, so the pair is tracked to recompute LQA below.
    const overwrittenLanguages: string[] = [];
    for (const [lang, rec] of Object.entries(orphan.translations)) {
      const existing = mergedTranslations[lang];
      if (overrideMode === 'all' || !existing?.text) {
        mergedTranslations[lang] = rec;
        overwrittenLanguages.push(lang);
      }
    }

    // Recompute LQA for every overwritten language against the TARGET's own
    // (unchanged) sourceText — mirrors every other translation-writing path
    // (M9, the strings PUT route's buildTranslationLqa). Without this, the
    // target's pre-merge lqaResults for that language — computed against
    // text that this merge just replaced — would keep being shown (or a slot
    // would go unchecked) against text they no longer describe.
    const lqaResults: StringEntry['lqaResults'] = {};
    for (const lang of overwrittenLanguages) {
      const text = mergedTranslations[lang]?.text;
      if (text) {
        lqaResults[lang] = await lqaGate.check(target, text, lang, { projectId });
      }
    }

    const updated = await this.ss.updateEntry(projectId, newSourceId, {
      translations: mergedTranslations,
      ...(Object.keys(lqaResults).length > 0 ? { lqaResults } : {}),
    });
    await this.ss.deleteEntry(projectId, orphanId);
    logger.info('orphan:linked', { projectId, orphanId, newSourceId, overrideMode });
    return updated;
  }
}

export const orphanManager = new OrphanManager();
