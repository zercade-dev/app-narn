/**
 * Shared constants + pure helpers for the Comparison tab, extracted from
 * ComparisonTab.tsx so the tab component and its presentational sub-components
 * (toolbar, grid) can share them without a circular import. Pure — no React, no
 * state, no side effects.
 *
 * NOTE: the persisted-state key strings below are the on-disk (localStorage)
 * contract — changing their values would silently reset users' saved prefs, so
 * they must stay byte-identical to the originals.
 */
import type { StringEntry, TagNode } from '@zercade-dev/narn-shared';

export const HEADER_HEIGHT = 40;

export const COMPARE_LANG_KEY = 'translator-compare-lang';
export const COMPARE_REF_LANG_KEY = 'translator-compare-ref-lang';
export const COMPARE_PAGE_SIZE_KEY = 'translator-compare-page-size';
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
export const DEFAULT_PAGE_SIZE = 50;
// Upper bound on the rich-mode tag-parse cache. Caps the per-insert Map copy
// cost (otherwise paging through a large project in rich mode is O(n²)) and the
// memory held; oldest entries are evicted FIFO once the cap is exceeded.
export const PARSE_CACHE_MAX = 1000;

/** Insert into the parse cache with FIFO eviction once {@link PARSE_CACHE_MAX} is reached. */
export function withParsed(
  prev: ReadonlyMap<string, TagNode[]>,
  key: string,
  nodes: TagNode[],
): ReadonlyMap<string, TagNode[]> {
  const next = new Map(prev);
  next.set(key, nodes);
  while (next.size > PARSE_CACHE_MAX) {
    const oldest = next.keys().next().value;
    if (oldest === undefined) break;
    next.delete(oldest);
  }
  return next;
}

/**
 * An entry "needs attention" for the selected target language when the
 * translation text is missing or its LQA result is flagged as failed.
 */
export function entryNeedsAttention(entry: StringEntry, lang: string): boolean {
  const rec = entry.translations[lang];
  if (!rec?.text) return true;
  const lqa = entry.lqaResults[lang];
  if (lqa && lqa.passed === false) return true;
  if (lqa && lqa.overflow && !entry.ignoreOverflow) return true;
  return false;
}

/** Entry has any LQA issue (blocking failures or overflow). */
export function entryHasLqaIssue(entry: StringEntry, lang: string): boolean {
  if (!lang) return false;
  const lqa = entry.lqaResults[lang];
  if (!lqa) return false;
  return lqa.passed === false || lqa.overflow === true;
}

/**
 * Entry has a translation awaiting human review for `lang`: any stored record
 * whose status isn't 'reviewed', or one explicitly flagged `needsReview` by the
 * automated pipeline. Entries with no record are NOT matched (the untranslated
 * filter covers those).
 */
export function entryNeedsReview(entry: StringEntry, lang: string): boolean {
  if (!lang) return false;
  const rec = entry.translations[lang];
  if (!rec) return false;
  return rec.status !== 'reviewed' || rec.needsReview === true;
}

/** Entry's translator context is empty or whitespace-only. */
export function entryHasEmptyContext(entry: StringEntry): boolean {
  return !entry.context || entry.context.trim() === '';
}

/** Translated / reviewed counts shown in the target-language column header. */
export interface ReviewStats {
  translatedCount: number;
  reviewedCount: number;
}

/** Live "X/Y" bulk-translate progress numbers surfaced in the toolbar. */
export interface BulkTranslateProgress {
  completed: number;
  failed: number;
  total: number;
}
