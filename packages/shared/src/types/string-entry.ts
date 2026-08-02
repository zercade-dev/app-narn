import type { LQAResult } from './lqa.js';
import type { PromptOptions } from './module.js';

/** Default overflow ratio applied when no per-entry or global value is configured. */
export const DEFAULT_OVERFLOW_RATIO = 1.75;

/** Maximum number of prior translation versions retained per language. */
export const MAX_PREVIOUS_VERSIONS = 5;

/** A prior translation text retained when a record's text is overwritten. */
export interface TranslationVersion {
  text: string;
  moduleId: string;
  timestamp: number;
}

export interface TranslationRecord {
  text: string;
  status: 'pending' | 'translated' | 'reviewed' | 'flagged';
  moduleId: string;
  timestamp: number;
  /** True when the translation was produced by the automated tool and awaits human review. */
  needsReview?: boolean;
  /** Id of the translation run that produced this record (absent for manual/imported edits). */
  runId?: string;
  /**
   * Bounded history of prior translation texts (oldest first, newest last,
   * capped at MAX_PREVIOUS_VERSIONS). Maintained server-side by M3 StringStore
   * whenever a record's text changes; never supplied by clients.
   */
  previousVersions?: TranslationVersion[];
}

/** Category of a source-language AI-review finding. */
export type SourceReviewFindingType = 'typo' | 'grammar' | 'terminology' | 'clarity' | 'unsafe';

/** A single issue flagged on an entry's source text by a source AI review. */
export interface SourceReviewFinding {
  type: SourceReviewFindingType;
  /** Human-readable description of the issue. */
  detail: string;
}

/** Result of the most recent source AI review for an entry, stored per entry. */
export interface SourceReviewResult {
  findings: SourceReviewFinding[];
  /**
   * Optional unified corrected source text for the whole entry — the exact
   * replacement value only, no commentary. Advisory; applying it is a separate,
   * deliberate action. Absent when the source is clean (no correction needed).
   */
  suggestion?: string;
  /** Epoch ms when the review was recorded. */
  reviewedAt: number;
  /** Id of the source-review run that produced this result. */
  runId?: string;
  /** True once the user marked this review as done in the Source AI review tab. */
  approved?: boolean;
}

export interface StringEntry {
  /** SHA-256 of raw source text (case-sensitive, no trim) */
  id: string;
  sourceText: string;
  /**
   * Origin labels from the CSV "Source" column, split by comma. The exact
   * imported text is preserved here (and in import/export); the UI translates
   * known labels for display only (see `getSourceLabel`). Drives routing and
   * achievement detection — the former `contentType` taxonomy was removed.
   */
  sources: string[];
  /**
   * For entries whose source is an "Achievement" origin label (see
   * `isAchievementSource`), whether this string is the achievement's name or its
   * description. Absent for non-achievement entries (and achievement entries not
   * yet tagged). Set manually in the multi-language text tab; reserved for
   * achievement-aware features. `null` is accepted on write to clear a prior
   * value (treated identically to absent everywhere it is read).
   */
  achievementType?: 'name' | 'description' | null;
  /**
   * Free-text group key linking one achievement's name entry and description
   * entry (same value on both). Deliberately NOT an entry-id pointer — entry
   * ids are sourceText hashes, so a pointer breaks silently when the
   * counterpart's source changes. Set in the multi-language text tab next to
   * the achievementType toggle; meaningful only on achievement-source entries.
   * User curation: preserved across CSV re-imports; `null` clears.
   */
  achievementId?: string | null;
  /** From the CSV "Need translation?" column. False means the string is a template/variable and should be hidden from the translation view. */
  needsTranslation: boolean;
  categories: string[];
  context: string;
  /** Default 1.75 (175% of source character count) — see DEFAULT_OVERFLOW_RATIO */
  overflowRatio: number;
  /** When true, overflow LQA issues are suppressed for this entry */
  ignoreOverflow?: boolean;
  /**
   * When true, this entry is excluded from every AI dispatch (translate, judge,
   * source-review, glossary-gen, category-gen). Distinct from ignoreOverflow
   * (LQA-only) and needsTranslation (template/variable detection).
   */
  ignored?: boolean;
  /**
   * Epoch ms stamped when a full-replace CSV import found this entry missing
   * from the imported file. A set value soft-deletes the entry: it is
   * excluded from every AI dispatch (see
   * `isExcludedFromAi`), hidden from the strings list, and surfaced in the
   * Relink tab until relinked or deleted. Cleared automatically when a later
   * import (either mode) carries the same id again — reappearing in a CSV
   * makes the entry live. `null` is accepted on write to clear a prior value
   * (treated identically to absent everywhere it is read).
   */
  orphanedAt?: number | null;
  metadata?: { character?: string; tone?: string; gender?: string };
  /** Narrative / structured metadata forwarded to translation modules. */
  promptOptions?: PromptOptions;
  /** key = language code */
  translations: Record<string, TranslationRecord>;
  /** key = language code */
  lqaResults: Record<string, LQAResult>;
  createdAt: number;
  updatedAt: number;
  /**
   * True when this entry was added by a CSV import that found no prior entry
   * with the same id (i.e. it's on the "added" side of the import diff, not an
   * update to an existing entry). Set once at import time and otherwise
   * persisted as-is across subsequent imports/updates — it is a review flag,
   * not a live "is this new" computation — until explicitly cleared via the
   * Multi-language Text tab's "Clear new flags" bulk action (or per-entry
   * update). Absent/false for every entry not added by a CSV import.
   */
  flaggedNew?: boolean;
  /**
   * Row order from the source CSV. Lower values are exported first.
   * When undefined, the entry is exported after all sortIndex-bearing entries
   * in its existing array order.
   */
  sortIndex?: number;
  /**
   * Order index from the local word-similarity pre-sort, used to group similar
   * terms into the same review/translation batch. Lower values come first.
   * Computed by an opt-in pre-step and persisted; absent until computed.
   */
  reviewSortIndex?: number;
  /** Most recent source-language AI-review result for this entry's source text. */
  sourceReview?: SourceReviewResult;
  /**
   * IDs of glossaries whose terms appear in this entry's source text.
   * Populated at import time. Used by the translation engine to restrict
   * glossary hints to relevant glossaries only. M20's sweep recomputes this
   * as the union of term matches and `manualGlossaryIds` below — it is never
   * purely matcher-derived once a manual assignment exists.
   */
  assignedGlossaryIds?: string[];
  /**
   * IDs of glossaries a user explicitly force-assigned to this entry (via the
   * entry-update route sending `assignedGlossaryIds`), independent of whether
   * their terms appear in the source text. M20's sweep unions this set into
   * `assignedGlossaryIds` on every pass rather than overwriting it, so a
   * deliberate override survives a subsequent sweep with zero term overlap.
   * Set only by the entry-update route mirroring a client's `assignedGlossaryIds`
   * write; M20 itself never writes to this field.
   */
  manualGlossaryIds?: string[];
}
