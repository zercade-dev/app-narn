/**
 * The first run's quick test: instead of everything, the guide translates
 * three entries first, so the person sees a result in seconds. Which entries,
 * the table filters it sets, and the event that asks the string table to
 * translate them (through the same request as the dialog's Start).
 */
import { PSEUDO_LANGUAGE_CODE, type RunStatus, type StringEntry } from '@zercade-dev/narn-shared';
import type { EntryFilters } from '../filter-entries.js';
import { isTranslationRun } from '../run-kind.js';
import type { QuickTest } from '../../stores/guide-store.js';
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

/**
 * The languages the guide translates into: the project's targets without the
 * source and without the Pseudo-test QA language (pseudo text says nothing
 * about whether a real translation is there).
 */
export function realTargetLanguages(
  project: { sourceLanguage: string; activeLanguages: string[] } | undefined,
): string[] {
  if (!project) return [];
  return project.activeLanguages.filter(
    (lang) => lang !== project.sourceLanguage && lang !== PSEUDO_LANGUAGE_CODE,
  );
}

/**
 * The first QUICK_TEST_SIZE entries, in import order, that still need a
 * translation in one of `targetLanguages` (Pseudo-test never counts): a test
 * of entries the file already translates would translate nothing.
 */
export function quickTestEntryIds(entries: StringEntry[], targetLanguages: string[]): string[] {
  return untranslatedEntryIds(entries, targetLanguages).slice(0, QUICK_TEST_SIZE);
}

const isUntranslated = (e: StringEntry, targetLanguages: string[]): boolean =>
  isTranslatableEntry(e) &&
  targetLanguages.some((lang) => lang !== PSEUDO_LANGUAGE_CODE && !e.translations[lang]?.text);

/** Translatable entries still missing a translation in at least one of `targetLanguages` (Pseudo-test aside). */
export function untranslatedEntryIds(entries: StringEntry[], targetLanguages: string[]): string[] {
  return importOrder(entries.filter((e) => isUntranslated(e, targetLanguages))).map((e) => e.id);
}

/** Whether {@link untranslatedEntryIds} would list anything (without sorting). */
export function hasUntranslatedEntry(entries: StringEntry[], targetLanguages: string[]): boolean {
  return entries.some((e) => isUntranslated(e, targetLanguages));
}

/**
 * The run a pending quick test produced: the recorded one, else the first
 * translation run of its project listed after the request (any run not in
 * `runsBefore`). Read straight from the run list, so a run that is already
 * finished the first time it is listed still counts, before anything records it.
 */
export function quickTestRunId(
  quickTest: QuickTest | null,
  runs: readonly RunStatus[],
): string | null {
  if (!quickTest) return null;
  if (quickTest.runId !== null) return quickTest.runId;
  const before = quickTest.runsBefore;
  if (!before) return null;
  const fresh = runs.find(
    (r) => r.projectId === quickTest.projectId && isTranslationRun(r) && !before.includes(r.runId),
  );
  return fresh?.runId ?? null;
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
