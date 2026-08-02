/**
 * LLM-as-judge types — post-translation review of restored translations
 * (M25 judge engine; `judgeTranslations` on AI SDK modules).
 */
import type { GlossaryTerm } from './glossary.js';
import type { PromptOptions, TranslationUsage } from './module.js';

/** One (entry, targetLanguage) pair submitted for review. */
export interface JudgeItem {
  entryId: string;
  targetLanguage: string;
  sourceText: string;
  /** The restored (unmasked) translation under review. */
  translatedText: string;
  sourceLanguage?: string;
  context?: string;
  promptOptions?: PromptOptions;
  /** Glossary terms for the target language; the prompt builder filters to source matches. */
  glossary?: GlossaryTerm[];
  /**
   * When true, the judge is instructed to ALWAYS return a `suggestion` (a
   * corrected translation), even on a passing verdict. Used by the on-demand
   * "generate suggestion" action when a finding has issues but no suggestion;
   * the default report-only path omits it so passing verdicts stay suggestion-free.
   */
  forceSuggestion?: boolean;
  /**
   * Optional free-text guidance from the human reviewer, used by the on-demand
   * forced-suggestion path ("re-request review with guidance"). Appended to the
   * judge prompt as an authoritative instruction for the suggestion's content;
   * never set on the batch report-only path.
   */
  userGuidance?: string;
  /**
   * Language code (LANGUAGE_REGISTRY) the AI should write its findings and
   * explanations in. Affects only the natural-language output (issue details),
   * never the scoring logic. Omitted or `'en'` keeps the default English output.
   */
  responseLanguage?: string;
  /**
   * Opt-in quality checks (typo/grammar/clarity/unsafe) examining the
   * translated text itself, on top of the always-on accuracy/fluency/
   * terminology/tone/mistranslation rubric. All default to off/absent.
   * `terminology` is accepted for UI/wire parity with source review's
   * checks but is a no-op here — judge always checks glossary-term
   * consistency regardless of this flag.
   */
  checks?: JudgeChecks;
}

/** See {@link JudgeItem.checks}. */
export interface JudgeChecks {
  typo?: boolean;
  grammar?: boolean;
  terminology?: boolean;
  clarity?: boolean;
  unsafe?: boolean;
}

export type JudgeIssueType =
  | 'accuracy'
  | 'fluency'
  | 'terminology'
  | 'tone'
  | 'mistranslation'
  | 'typo'
  | 'grammar'
  | 'clarity'
  | 'unsafe';

export interface JudgeIssue {
  type: JudgeIssueType;
  detail: string;
}

export interface JudgeVerdict {
  entryId: string;
  targetLanguage: string;
  verdict: 'pass' | 'fail';
  /** 0–100; higher is better. */
  score: number;
  issues: JudgeIssue[];
  suggestion?: string;
  /**
   * Set when `suggestion` drops a formatting token (escape sequence, markup
   * tag, or placeholder) present in the reviewed translation. Report-only — the
   * suggestion stays appliable; the UI warns and a future batch-accept filters
   * flagged suggestions out.
   */
  suggestionDropsFormatting?: boolean;
  /** Set instead of a verdict when the judge call failed for this item. */
  error?: string;
  /** Per-call usage attached to the first verdict of each provider call. */
  usage?: TranslationUsage;
}
