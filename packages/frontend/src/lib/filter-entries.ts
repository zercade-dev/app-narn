import {
  hasTooLongIssue,
  type StringEntry,
  type TranslationRecord,
} from '@zercade-dev/narn-shared';

export interface EntryFilters {
  search: string;
  untranslatedOnly: boolean;
  /** Show only entries where at least one active-language translation has an overflow condition */
  overflowOnly: boolean;
  /** Show only entries where at least one translation exceeds the language's hard length limit (`too-long` LQA issue) */
  tooLong: boolean;
  lqaFailed: boolean;
  /** Show only entries where at least one active-language translation awaits review (status ≠ 'reviewed', or needsReview=true). */
  needsReview: boolean;
  /** Show only entries where at least one active-language translation text equals the source text */
  sameAsSource: boolean;
  /** Show only entries where placeholders in the source text are missing from at least one translation */
  placeholderMismatch: boolean;
  /** Show only entries flagged as newly-added by the most recent CSV import (`StringEntry.flaggedNew`) */
  flaggedNewOnly: boolean;
  activeLanguages: string[];
  /** Filter to entries carrying any of these source origin labels (raw stored values). */
  sources: string[];
  categories: string[];
  /** Filter to entries assigned any of these glossary ids (OR-within-dimension — mirrors `categories`). */
  glossaryIds: string[];
  /**
   * Show only entries where at least one language's translation record was
   * served by a Freeway model below this quality tier
   * (`TranslationRecord.freewayTier !== undefined && freewayTier < freewayTierBelow`).
   * `null` = inactive (the default) — mirrors `runId`'s "empty string means
   * off" idiom but with `null` since 0 is not a valid tier.
   */
  freewayTierBelow: number | null;
  /** Filter to entries whose `metadata.tone` matches any of these values (OR-within-dimension — mirrors `categories`). */
  tones: string[];
  visibleLanguages: string[];
  /** Show only entries with at least one translation produced by this run id ('' = all runs) */
  runId: string;
  /**
   * Display order for entries. 'import' keeps the natural import order
   * (sortIndex / array order); 'custom' applies the Source-review pre-sort
   * order (reviewSortIndex). Display-only — never mutates import order.
   */
  orderMode: 'import' | 'custom';
  /**
   * How the active filter dimensions below combine. 'AND' (default) requires
   * every active dimension to match; 'OR' requires at least one active
   * dimension to match. Inactive dimensions never affect the result in either
   * mode. Does not apply to the hard eligibility gates (e.g.
   * `needsTranslation`), which always exclude regardless of this setting.
   */
  filterMode: 'AND' | 'OR';
}

/**
 * Pure filter function for string entries.
 *
 * Extracted from the zustand string-store so the rules can be exercised
 * independently of store state.
 */
export function filterEntries(entries: StringEntry[], filters: EntryFilters): StringEntry[] {
  const needle = filters.search.trim().toLowerCase();
  return entries.filter((entry) => matchesEntry(entry, filters, needle));
}

/**
 * Stable sort by the Source-review pre-sort order (`reviewSortIndex`). Entries
 * without an index sort after all indexed entries, preserving their existing
 * relative order. Display-only — returns a new array, never mutates the input.
 *
 * Mirrors the server-side `orderEntries()` comparator in
 * `packages/server/src/modules/review-order.ts`; kept in sync but not imported
 * (the frontend never depends on server code).
 */
export function orderByReviewSort(entries: StringEntry[]): StringEntry[] {
  return [...entries].sort(
    (a, b) =>
      (a.reviewSortIndex ?? Number.POSITIVE_INFINITY) -
      (b.reviewSortIndex ?? Number.POSITIVE_INFINITY),
  );
}

/**
 * Combines the tri-state per-dimension results according to `mode`, evaluating
 * each dimension lazily and stopping as soon as the outcome is decided —
 * rather than eagerly computing all of them up front. Each evaluator returns
 * `null` (dimension inactive — never affects the outcome), `true` (active and
 * matched), or `false` (active and did not match).
 *
 * Anything other than the literal `'OR'` is treated as AND — not just the
 * literal `'AND'` — so a `filters` object from a caller that predates
 * `filterMode` (a stale persisted blob, an un-migrated test fixture, ...) and
 * therefore has `filterMode: undefined` degrades to the safe, pre-existing
 * "every active dimension must match" behaviour instead of silently passing
 * every entry.
 *
 * - AND (default / anything but 'OR'): passes when no ACTIVE dimension
 *   explicitly rejects the entry — stops at the first `false`, exactly like
 *   the pre-existing chain of `if (!matchesX()) return false;` early-returns
 *   this replaced. `null`s never exclude.
 * - 'OR': passes as soon as one ACTIVE dimension matches — stops at the first
 *   `true`. If no dimension is active at all, there is nothing to OR against,
 *   so it passes through (matching AND's behaviour in that same all-inactive
 *   case).
 */
function combineDimensions(evaluators: Array<() => boolean | null>, mode: 'AND' | 'OR'): boolean {
  const isOr = mode === 'OR';
  let sawActive = false;
  for (const evaluate of evaluators) {
    const result = evaluate();
    if (result === null) continue;
    sawActive = true;
    if (isOr) {
      if (result === true) return true;
    } else if (result === false) {
      return false;
    }
  }
  return isOr ? !sawActive : true;
}

function matchesEntry(entry: StringEntry, filters: EntryFilters, needle: string): boolean {
  // Hard eligibility gates — always exclude, regardless of filterMode. These
  // are not user-facing filter dimensions (there's no UI control for them),
  // so they never participate in the AND/OR combination below.
  if (entry.needsTranslation === false) return false;
  // `ignored` entries are deliberately NOT filtered out here (unlike
  // `needsTranslation` above): they stay visible in every view, surfaced via a
  // badge on the row (see StringTableRow), instead of silently vanishing —
  // which would read as data loss. `ignored` only affects AI dispatch.

  // Wrapped in thunks so combineDimensions only pays for the matches* work it
  // actually needs to decide the outcome (most entries settle on an early
  // dimension) instead of always evaluating all twelve — filterEntries runs on
  // every render over the full entry list.
  const dimensions: Array<() => boolean | null> = [
    () => matchesSearch(entry, needle),
    () => matchesSources(entry, filters),
    () => matchesCategories(entry, filters),
    () => matchesTones(entry, filters),
    () => matchesGlossaries(entry, filters),
    () => matchesUntranslated(entry, filters),
    () => matchesOverflow(entry, filters),
    () => matchesTooLong(entry, filters),
    () => matchesLqaFailed(entry, filters),
    () => matchesNeedsReview(entry, filters),
    () => matchesSameAsSource(entry, filters),
    () => matchesPlaceholderMismatch(entry, filters),
    () => matchesRunId(entry, filters),
    () => matchesFlaggedNew(entry, filters),
    () => matchesFreewayTier(entry, filters),
  ];
  return combineDimensions(dimensions, filters.filterMode);
}

/**
 * True when the entry has at least one translation produced by `runId`.
 * Exported so the compare tab (which filters with its own local state rather
 * than the shared {@link EntryFilters}) shares the same run-match semantics.
 */
export function entryMatchesRun(entry: StringEntry, runId: string): boolean {
  return Object.values(entry.translations).some((r) => r.runId === runId);
}

/** `null` when no run is selected (dimension inactive); else the run-match result. */
function matchesRunId(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.runId) return null;
  return entryMatchesRun(entry, filters.runId);
}

/** `null` when the search box is empty (dimension inactive); else the search-match result. */
function matchesSearch(entry: StringEntry, needle: string): boolean | null {
  if (!needle) return null;
  return entryMatchesSearch(entry, needle);
}

/**
 * `null` when `selected` is empty (dimension inactive); else OR-within-dimension
 * match — true when `entryValues` contains any of the `selected` values.
 * Shared by the sources/categories/glossaryIds list-filter dimensions below,
 * which differ only in which fields they read.
 */
function matchesAnyOf(
  selected: string[] | undefined,
  entryValues: string[] | undefined,
): boolean | null {
  const sel = selected ?? [];
  if (sel.length === 0) return null;
  const values = entryValues ?? [];
  return sel.some((v) => values.includes(v));
}

/** `null` when no source labels are selected; else OR-within-dimension match on raw source labels. */
function matchesSources(entry: StringEntry, filters: EntryFilters): boolean | null {
  return matchesAnyOf(filters.sources, entry.sources);
}

/** `null` when no categories are selected; else OR-within-dimension match (entry carries ANY of them). */
function matchesCategories(entry: StringEntry, filters: EntryFilters): boolean | null {
  return matchesAnyOf(filters.categories, entry.categories);
}

/** `null` when no tones are selected; else OR-within-dimension match against the entry's single tone value. */
function matchesTones(entry: StringEntry, filters: EntryFilters): boolean | null {
  return matchesAnyOf(filters.tones, entry.metadata?.tone ? [entry.metadata.tone] : []);
}

/**
 * `null` when no glossaries are selected; else OR-within-dimension match
 * (entry carries ANY of the selected glossary ids), against
 * `StringEntry.assignedGlossaryIds`.
 */
function matchesGlossaries(entry: StringEntry, filters: EntryFilters): boolean | null {
  return matchesAnyOf(filters.glossaryIds, entry.assignedGlossaryIds);
}

/**
 * True when the lowercased `needle` appears in the entry's source text or any
 * of its translations. Exported so the compare tab (which filters with its own
 * local state rather than the shared {@link EntryFilters}) shares the same
 * free-text search semantics. `needle` is expected to be pre-lowercased.
 */
export function entryMatchesSearch(entry: StringEntry, needle: string): boolean {
  if (entry.sourceText.toLowerCase().includes(needle)) return true;
  return Object.values(entry.translations).some((r) => r.text.toLowerCase().includes(needle));
}

/** `null` when untranslatedOnly is off; else whether `entry` is still missing a translation. */
function matchesUntranslated(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.untranslatedOnly) return null;
  if (filters.activeLanguages.length > 0) {
    // Show entries where ANY active language is missing or not yet translated/reviewed
    const allTranslated = filters.activeLanguages.every((lang) => {
      const rec = entry.translations[lang];
      return rec && (rec.status === 'translated' || rec.status === 'reviewed');
    });
    return !allTranslated;
  }
  // Fallback: show entries with no translated/reviewed record at all
  const hasTranslation = Object.values(entry.translations).some(
    (r) => r.status === 'translated' || r.status === 'reviewed',
  );
  return !hasTranslation;
}

function matchesOverflow(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.overflowOnly) return null;
  return Object.values(entry.lqaResults).some((r) => !entry.ignoreOverflow && r.overflow);
}

function matchesTooLong(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.tooLong) return null;
  const langs =
    filters.activeLanguages.length > 0 ? filters.activeLanguages : Object.keys(entry.lqaResults);
  return langs.some((lang) => hasTooLongIssue(entry.lqaResults, lang));
}

function matchesLqaFailed(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.lqaFailed) return null;
  return Object.values(entry.lqaResults).some(
    (r) => !r.passed || (!entry.ignoreOverflow && r.overflow),
  );
}

/** A stored record awaits review unless its status is 'reviewed' (an explicit needsReview flag always matches). */
function recordAwaitsReview(r: TranslationRecord): boolean {
  return r.status !== 'reviewed' || r.needsReview === true;
}

function matchesNeedsReview(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.needsReview) return null;
  if (filters.activeLanguages.length > 0) {
    return filters.activeLanguages.some((lang) => {
      const r = entry.translations[lang];
      return r !== undefined && recordAwaitsReview(r);
    });
  }
  return Object.values(entry.translations).some(recordAwaitsReview);
}

function matchesSameAsSource(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.sameAsSource) return null;
  const source = entry.sourceText;
  const langs =
    filters.activeLanguages.length > 0 ? filters.activeLanguages : Object.keys(entry.translations);
  return langs.some((lang) => {
    const rec = entry.translations[lang];
    return rec?.text === source && (rec.status === 'translated' || rec.status === 'reviewed');
  });
}

/** Matches placeholder patterns: {name}, {0}, {{var}}, %s, %d, %1$s */
const PLACEHOLDER_RE = /\{\{[^{}]*\}\}|\{[^{}]*\}|%\d+\$[sd]|%[sd]/g;

function matchesPlaceholderMismatch(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.placeholderMismatch) return null;
  const sourcePlaceholders = [...entry.sourceText.matchAll(PLACEHOLDER_RE)].map((m) => m[0]);
  if (sourcePlaceholders.length === 0) return false;
  const langs =
    filters.activeLanguages.length > 0 ? filters.activeLanguages : Object.keys(entry.translations);
  return langs.some((lang) => {
    const rec = entry.translations[lang];
    if (!rec?.text) return false;
    return sourcePlaceholders.some((p) => !rec.text.includes(p));
  });
}

/** `null` when flaggedNewOnly is off; else whether the entry was flagged new by CSV import. */
function matchesFlaggedNew(entry: StringEntry, filters: EntryFilters): boolean | null {
  if (!filters.flaggedNewOnly) return null;
  return entry.flaggedNew === true;
}

/**
 * `null` when `freewayTierBelow` is inactive (`null`); else true when ANY
 * language's translation record was served by a Freeway model below the
 * threshold tier. A record with no `freewayTier` (non-Freeway-produced, or
 * cleared on trivial/TM short-circuit or manual edit) never matches.
 *
 * Uses `== null` (not `=== null`) so a `filters` object built without the key
 * at all — `freewayTierBelow` reading as `undefined` rather than the declared
 * `null` default — is absorbed as inactive too, matching every other
 * dimension in this file (each guards with `!filters.x`/`if (!needle)`, all of
 * which treat `undefined` the same as their own "off" value). A strict
 * `=== null` check would instead treat a missing key as an ACTIVE dimension
 * that rejects every entry (`freewayTier < undefined` is always `false`).
 */
function matchesFreewayTier(entry: StringEntry, filters: EntryFilters): boolean | null {
  const threshold = filters.freewayTierBelow;
  if (threshold == null) return null;
  return Object.values(entry.translations).some(
    (r) => r.freewayTier !== undefined && r.freewayTier < threshold,
  );
}
