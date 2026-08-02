/**
 * Model confidence — types for the dev-time, LLM-authored capability profiles
 * consumed by the frontend model picker to estimate how well a model will
 * handle a given AI engine run (task + entry count + prompt size + effort).
 *
 * The dataset (`profiles.ts`) is a bundled snapshot like the provider pricing
 * snapshot: regenerated on demand by a Claude session following
 * `docs/model-confidence.md`. A model with no profile MUST show no score.
 */
import type { ReasoningEffort } from '../types/models.js';

/** The five AI engine tasks a model can be scored for (M9/M25/M26/M28/M29). */
export type AiTask = 'translate' | 'judge' | 'source-review' | 'glossary-gen' | 'category-gen';

export interface ModelConfidenceProfile {
  /** Normalized (lowercase, trimmed) model ids and aliases matched exactly. */
  ids: string[];
  /** 0–1 base quality per task. An absent task ⇒ no score for that task. */
  tasks: Partial<Record<AiTask, number>>;
  /** Entries the model handles reliably in one run (batch-pressure knee). */
  reliableBatchEntries: number;
  /** Practical usable context window in tokens (≤ the advertised window). */
  effectiveContextTokens?: number;
  /** Score multiplier per reasoning effort; absent effort ⇒ 1. */
  effortModifiers?: Partial<Record<ReasoningEffort, number>>;
  /** Short English caveat surfaced verbatim in the tooltip (not i18n'd). */
  notes?: string;
}

export type ConfidenceTier = 'high' | 'medium' | 'low' | 'very-low';

export type ConfidenceReasonCode =
  | 'batch-exceeds-reliable'
  | 'prompt-near-context'
  | 'prompt-exceeds-context'
  | 'weak-task-fit'
  | 'effort-reduces-quality';

/** Structured reason; the frontend translates `code` with `params`. */
export interface ConfidenceReason {
  code: ConfidenceReasonCode;
  params?: Record<string, string | number>;
}

export interface ConfidenceResult {
  /** 0–100 integer. */
  score: number;
  tier: ConfidenceTier;
  reasons: ConfidenceReason[];
}

/** Runtime inputs a UI surface resolves before scoring the model table. */
export interface ModelConfidenceContext {
  task: AiTask;
  entryCount: number;
  /** Rough total prompt tokens for the run (order of magnitude, not precise). */
  promptTokensEstimate?: number;
  /** User-selected effort; absent ⇒ fall back to each model's default effort. */
  effort?: ReasoningEffort;
}
