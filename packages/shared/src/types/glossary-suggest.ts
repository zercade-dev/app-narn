/**
 * Types for AI glossary suggestion — grouping recurring custom terms and proper
 * nouns from a project's source texts into suggested glossaries.
 */
import type { EntryContext } from './entry-context.js';
import type { TranslationUsage } from './module.js';

/** One source entry offered to the model for glossary suggestion. */
export interface GlossarySuggestItem {
  /** Index within the batch (not echoed back; the response is keyed by source). */
  i: number;
  /** Source text to analyse. */
  s: string;
  /** Optional enriched context for this source entry (rendered as hints). */
  ctx?: EntryContext;
}

/** Options for a glossary-suggestion call. */
export interface GlossarySuggestOptions {
  /**
   * Source values from already-known (enabled) glossaries the user chose to
   * exclude — the model is told to ignore these so it doesn't re-suggest terms
   * already captured. Empty when nothing is excluded.
   */
  excludedSources: string[];
  /**
   * Optional progress callback invoked after each internal batch settles with
   * the cumulative count of source items processed so far (monotonically
   * non-decreasing, ending at the total item count). Lets a caller (the M28
   * background engine) report real per-batch progress instead of a single
   * 0→100% jump when the whole-set call returns.
   */
  onProgress?: (processed: number) => void;
  /**
   * When set (> 0), overrides the internal batch size so the whole item set is
   * sent in one provider call. Used by the "send everything at once" option.
   */
  chunkSize?: number;
  /**
   * Pre-formed batches (one LLM call each), used verbatim instead of size-chunking.
   * Set by callers that group items by category/glossary before suggesting.
   * When absent/empty, items are size-chunked as before.
   */
  batches?: GlossarySuggestItem[][];
  /**
   * Active target languages whose translations to EXTRACT for each suggested
   * term (from the entries' existing translations sent as `ctx.translations`).
   * Empty/absent = no extraction (today's behavior). Set by the server from
   * the request's `includeTranslations` flag + context languages.
   */
  translationLanguages?: string[];
  /**
   * Invoked with each provider call's usage AS THAT CALL RETURNS, before the
   * next one is sent. The same entries are still accumulated into the returned
   * `usages`, so an absent callback changes nothing — but a caller debiting a
   * free-tier ledger needs them per call: the returned array never arrives when
   * a later chunk rethrows a 429, and by then the earlier calls have already
   * spent quota on the bucket that served them.
   */
  onUsage?: (usage: TranslationUsage) => void;
}

/** One suggested glossary returned by the model. */
export interface GlossarySuggestion {
  /** Human-readable glossary name (e.g. "Character Names", "Game Mechanics"). */
  name: string;
  /** Exact source values that belong to this glossary. */
  sources: string[];
  /**
   * Optional per-term translator note, keyed by the exact source value (as it
   * appears in {@link sources}). A short hint about the term's meaning, usage,
   * gender, or part of speech; carried onto the created {@link GlossaryTerm.notes}
   * and used as translation guidance when filling the term's translations.
   */
  termNotes?: Record<string, string>;
  /**
   * Optional per-term extracted translations, keyed by the exact source value
   * (as in {@link sources}), then by language code. Values are copied verbatim
   * from the existing entry translations provided as prompt context — the
   * model is instructed to never invent or machine-translate them. Carried
   * onto the created {@link GlossaryTerm.translations} on accept.
   */
  termTranslations?: Record<string, Record<string, string>>;
  /** Optional rationale / note shown to the user. */
  notes?: string;
}

/**
 * Result of a glossary-suggestion call: the suggestions plus the module's
 * per-provider-call usage (one entry per internal batch/chunk request), so the
 * caller can accumulate it into a run's billing (see M9/usage-pricing.ts).
 */
export interface GlossarySuggestResult {
  suggestions: GlossarySuggestion[];
  usages: TranslationUsage[];
}
