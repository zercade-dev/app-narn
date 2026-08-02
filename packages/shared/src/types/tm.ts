/**
 * Translation memory (TM) types shared between the server store (M23) and the
 * frontend TM browser.
 *
 * Segments are keyed by `sourceHash:targetLanguage` where `sourceHash` is a
 * SHA-256 over the MASKED source text (M17 placeholder form, `{t:n}`/`{v:n}`/
 * `{g:n}`), so strings that differ only in inline tags, runtime variables or
 * constant glossary terms still share a segment. Note this is deliberately
 * NOT `StringEntry.id`, which hashes the raw source text.
 */

/** Synthetic module id recorded on translations applied from the TM. */
export const TM_MODULE_ID = 'tm-exact';

/**
 * Per-project TM match policy.
 * - `strict`   — masked-source hash + full fingerprint must match.
 * - `relaxed`  — ignores categories/metadata; still requires sources + context.
 * - `source-only` — hash alone; intended for explicit bulk bootstrap.
 * - `disabled` — translation memory is off for the project (the default): no
 *   auto-apply, no hints, and nothing the project translates is written to the
 *   (global) TM.
 */
export type TmMatchPolicy = 'strict' | 'relaxed' | 'source-only' | 'disabled';

/**
 * Normalized context fingerprint captured alongside each stored variant.
 * All string fields are trimmed and casefolded; empty and absent are stored
 * alike as `''`. Sources and categories are deduplicated, normalized and sorted.
 */
export interface TmFingerprint {
  /** Origin labels from `StringEntry.sources`, deduplicated, normalized and sorted. */
  sources: string[];
  categories: string[];
  context: string;
  /** From `StringEntry.metadata`. */
  character: string;
  tone: string;
  gender: string;
  /** From the routing rule's `promptOptions`. */
  promptCharacter: string;
  promptTone: string;
  promptGender: string;
  promptNotes: string;
  /** `'ignore'` when overflow is suppressed, else the overflow ratio (2 d.p.). */
  overflowRegime: string;
}

/** One stored translation for a (masked source, target language) segment. */
export interface TmVariant {
  id: string;
  /** Translated text in MASKED form (placeholders intact). */
  translatedText: string;
  /** Module that produced the translation. */
  moduleId: string;
  /**
   * LQA verdict at write time. The engine only records passing results;
   * a `false` variant (hand-seeded / legacy) is never auto-applied or
   * surfaced as a hint, and is evicted first when a segment exceeds its
   * variant cap.
   */
  lqaPassed: boolean;
  timestamp: number;
  fingerprint: TmFingerprint;
}

/** A TM segment: all stored variants for one masked source + target language. */
export interface TmSegment {
  /** `${sourceHash}:${targetLanguage}` — stable identifier used by the API. */
  key: string;
  sourceHash: string;
  targetLanguage: string;
  /** Masked source text, kept for display in the TM browser. */
  sourceMasked: string;
  variants: TmVariant[];
}
