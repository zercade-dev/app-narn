/**
 * The first run's quick test: instead of everything, the guide translates
 * three entries first, so the person sees a result in seconds. Which entries,
 * the table filters it sets, and the event that asks the string table to
 * translate them (through the same request as the dialog's Start).
 */
import type { StringEntry } from '@zercade-dev/narn-shared';
import type { EntryFilters } from '../filter-entries.js';
import { DEFAULT_STRING_FILTERS } from '../../stores/string-store.js';

export const QUICK_TEST_SIZE = 3;

/** Window event the string table answers by translating `detail.entryIds`. */
export const GUIDE_TRANSLATE_EVENT = 'guide:translate';

export interface GuideTranslateDetail {
  entryIds: string[];
}

/** Has source text, needs translation, and is not orphaned. */
export const isTranslatableEntry = (e: StringEntry): boolean =>
  !e.orphanedAt && e.needsTranslation !== false && (e.sourceText ?? '').trim() !== '';

/**
 * Main entries first, then the client collection; each in import order
 * (`sortIndex`, rows without one after the rest in their listed order).
 */
function importOrder(entries: StringEntry[]): StringEntry[] {
  const rank = (e: StringEntry): number => (e.collection === 'client' ? 1 : 0);
  return entries
    .map((entry, at) => ({ entry, at }))
    .sort(
      (a, b) =>
        rank(a.entry) - rank(b.entry) ||
        (a.entry.sortIndex ?? Infinity) - (b.entry.sortIndex ?? Infinity) ||
        a.at - b.at,
    )
    .map((x) => x.entry);
}

/** Every entry that can be translated (has source text, needs translation), in import order. */
export function translatableEntryIds(entries: StringEntry[]): string[] {
  return importOrder(entries.filter(isTranslatableEntry)).map((e) => e.id);
}

/** First QUICK_TEST_SIZE main entries with non-empty sourceText and needsTranslation !== false, in import (sortIndex) order. */
export function quickTestEntryIds(entries: StringEntry[]): string[] {
  return translatableEntryIds(entries).slice(0, QUICK_TEST_SIZE);
}

const isUntranslated = (e: StringEntry, targetLanguages: string[]): boolean =>
  isTranslatableEntry(e) && targetLanguages.some((lang) => !e.translations[lang]?.text);

/** Translatable entries still missing a translation in at least one of `targetLanguages`. */
export function untranslatedEntryIds(entries: StringEntry[], targetLanguages: string[]): string[] {
  return importOrder(entries.filter((e) => isUntranslated(e, targetLanguages))).map((e) => e.id);
}

/** Whether {@link untranslatedEntryIds} would list anything (without sorting). */
export function hasUntranslatedEntry(entries: StringEntry[], targetLanguages: string[]): boolean {
  return entries.some((e) => isUntranslated(e, targetLanguages));
}

/** Filters the guide sets at the translate step: DEFAULT_STRING_FILTERS with untranslatedOnly false, orderMode 'import', keeping activeLanguages. */
export function quickTestFilters(current: EntryFilters): EntryFilters {
  return {
    ...DEFAULT_STRING_FILTERS,
    untranslatedOnly: false,
    orderMode: 'import',
    activeLanguages: current.activeLanguages,
  };
}

/** Asks the string table to translate `entryIds`, as the dialog's Start does with its defaults. */
export function requestGuideTranslation(entryIds: string[]): void {
  globalThis.dispatchEvent(
    new CustomEvent<GuideTranslateDetail>(GUIDE_TRANSLATE_EVENT, { detail: { entryIds } }),
  );
}
