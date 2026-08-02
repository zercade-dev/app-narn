/**
 * Pure confidence scoring: combines a bundled model profile with the runtime
 * run context (task, entry count, prompt size, reasoning effort). No I/O, no
 * state — safe to call per table row on every render.
 */
import type { ReasoningEffort } from '../types/models.js';
import type {
  AiTask,
  ConfidenceReason,
  ConfidenceResult,
  ConfidenceTier,
  ModelConfidenceProfile,
} from './types.js';

/**
 * Fixed per-task prompt overhead (system prompt, glossary, examples) in
 * tokens, added by `useConfidenceContext` on top of the chars/4 source
 * estimate. Order-of-magnitude values, not measurements.
 */
export const PROMPT_OVERHEAD_TOKENS: Record<AiTask, number> = {
  translate: 1_500,
  judge: 1_200,
  'source-review': 1_000,
  'glossary-gen': 800,
  'category-gen': 800,
};

/** Exponent of the smooth batch-pressure falloff past the reliable knee. */
export const BATCH_FALLOFF_EXPONENT = 0.6;

/** Fraction of the usable window under which prompts incur no penalty. */
const CONTEXT_PRESSURE_KNEE = 0.6;

/** Multiplier applied when the prompt estimate exceeds the usable window. */
const CONTEXT_OVERFLOW_PENALTY = 0.05;

function tierFor(score: number): ConfidenceTier {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'low';
  return 'very-low';
}

export interface ScoreModelConfidenceInput {
  profile: ModelConfidenceProfile;
  task: AiTask;
  entryCount: number;
  promptTokensEstimate?: number;
  /** Resolved by the caller: user-selected effort ?? the model's default. */
  effort?: ReasoningEffort;
  /** Advertised window from ModelInfo, used when the profile has no effective window. */
  contextLength?: number;
}

/** Returns null when the profile carries no rating for the requested task. */
export function scoreModelConfidence(input: ScoreModelConfidenceInput): ConfidenceResult | null {
  const { profile, task, entryCount, promptTokensEstimate, effort, contextLength } = input;
  const base = profile.tasks[task];
  if (base === undefined) return null;

  const reasons: ConfidenceReason[] = [];
  if (base < 0.5) reasons.push({ code: 'weak-task-fit' });

  let batchPenalty = 1;
  if (entryCount > profile.reliableBatchEntries) {
    batchPenalty = (profile.reliableBatchEntries / entryCount) ** BATCH_FALLOFF_EXPONENT;
    reasons.push({
      code: 'batch-exceeds-reliable',
      params: { entryCount, reliable: profile.reliableBatchEntries },
    });
  }

  let contextPenalty = 1;
  const usableContext = profile.effectiveContextTokens ?? contextLength;
  if (promptTokensEstimate !== undefined && usableContext !== undefined && usableContext > 0) {
    const ratio = promptTokensEstimate / usableContext;
    if (ratio >= 1) {
      contextPenalty = CONTEXT_OVERFLOW_PENALTY;
      reasons.push({
        code: 'prompt-exceeds-context',
        params: { tokens: promptTokensEstimate, context: usableContext },
      });
    } else if (ratio > CONTEXT_PRESSURE_KNEE) {
      // Linear falloff from 1 at the knee to CONTEXT_PRESSURE_KNEE at ratio 1.
      contextPenalty = 1 - (ratio - CONTEXT_PRESSURE_KNEE);
      reasons.push({
        code: 'prompt-near-context',
        params: { tokens: promptTokensEstimate, context: usableContext },
      });
    }
  }

  const effortModifier =
    (effort !== undefined ? profile.effortModifiers?.[effort] : undefined) ?? 1;
  if (effort !== undefined && effortModifier < 1) {
    reasons.push({ code: 'effort-reduces-quality', params: { effort } });
  }

  const score = Math.round(
    Math.min(100, Math.max(0, base * 100 * batchPenalty * contextPenalty * effortModifier)),
  );
  return { score, tier: tierFor(score), reasons };
}
