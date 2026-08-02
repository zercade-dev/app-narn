/**
 * Model confidence profiles — the bundled, LLM-authored capability snapshot.
 *
 * REGENERATION: see `docs/model-confidence.md`. Authored 2026-07-07 by Claude
 * from the provider pricing snapshot's model list. Keyed by model id, NOT
 * module id, so any module (present or future) whose models carry these ids is
 * scored automatically. Models deliberately absent: non-chat models (tts,
 * image, embedding, live, robotics, computer-use variants) and local/Ollama
 * models — they have no profile and therefore show no score.
 */
import type { ModelConfidenceProfile } from './types.js';

export const MODEL_CONFIDENCE_SCHEMA_VERSION = 1;
export const MODEL_CONFIDENCE_GENERATED_AT = '2026-07-07';

export const MODEL_CONFIDENCE_PROFILES: readonly ModelConfidenceProfile[] = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  {
    ids: ['claude-fable-5', 'claude-mythos-5'],
    tasks: {
      translate: 0.97,
      judge: 0.97,
      'source-review': 0.96,
      'glossary-gen': 0.95,
      'category-gen': 0.95,
    },
    reliableBatchEntries: 800,
    effectiveContextTokens: 180_000,
    effortModifiers: { minimal: 0.92, low: 0.95 },
    notes: 'Frontier tier; strongest instruction-following on large batches.',
  },
  {
    ids: ['claude-opus-4-8'],
    tasks: {
      translate: 0.95,
      judge: 0.95,
      'source-review': 0.94,
      'glossary-gen': 0.93,
      'category-gen': 0.93,
    },
    reliableBatchEntries: 600,
    effectiveContextTokens: 180_000,
    effortModifiers: { minimal: 0.9, low: 0.93 },
  },
  {
    ids: ['claude-opus-4-7'],
    tasks: {
      translate: 0.93,
      judge: 0.93,
      'source-review': 0.92,
      'glossary-gen': 0.91,
      'category-gen': 0.91,
    },
    reliableBatchEntries: 500,
    effectiveContextTokens: 180_000,
  },
  {
    ids: ['claude-opus-4-6'],
    tasks: {
      translate: 0.92,
      judge: 0.92,
      'source-review': 0.91,
      'glossary-gen': 0.9,
      'category-gen': 0.9,
    },
    reliableBatchEntries: 450,
    effectiveContextTokens: 180_000,
  },
  {
    ids: ['claude-opus-4-5'],
    tasks: {
      translate: 0.9,
      judge: 0.9,
      'source-review': 0.89,
      'glossary-gen': 0.88,
      'category-gen': 0.88,
    },
    reliableBatchEntries: 400,
    effectiveContextTokens: 180_000,
  },
  {
    ids: ['claude-sonnet-5'],
    tasks: {
      translate: 0.92,
      judge: 0.9,
      'source-review': 0.9,
      'glossary-gen': 0.89,
      'category-gen': 0.9,
    },
    reliableBatchEntries: 500,
    effectiveContextTokens: 180_000,
    effortModifiers: { minimal: 0.88, low: 0.92 },
  },
  {
    ids: ['claude-sonnet-4-6'],
    tasks: {
      translate: 0.88,
      judge: 0.86,
      'source-review': 0.86,
      'glossary-gen': 0.85,
      'category-gen': 0.87,
    },
    reliableBatchEntries: 350,
    effectiveContextTokens: 180_000,
  },
  {
    ids: ['claude-sonnet-4-5'],
    tasks: {
      translate: 0.85,
      judge: 0.83,
      'source-review': 0.83,
      'glossary-gen': 0.82,
      'category-gen': 0.84,
    },
    reliableBatchEntries: 300,
    effectiveContextTokens: 180_000,
  },
  {
    ids: ['claude-haiku-4-5', 'claude-haiku-4-5-20251001'],
    tasks: {
      translate: 0.75,
      judge: 0.68,
      'source-review': 0.7,
      'glossary-gen': 0.72,
      'category-gen': 0.75,
    },
    reliableBatchEntries: 150,
    effectiveContextTokens: 180_000,
    effortModifiers: { disabled: 0.85 },
    notes: 'Fast and cheap; quality drops on large or nuance-heavy batches.',
  },
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  {
    ids: ['gpt-5.5-pro'],
    tasks: {
      translate: 0.96,
      judge: 0.96,
      'source-review': 0.95,
      'glossary-gen': 0.94,
      'category-gen': 0.94,
    },
    reliableBatchEntries: 700,
    effectiveContextTokens: 220_000,
  },
  {
    ids: ['gpt-5.5'],
    tasks: {
      translate: 0.94,
      judge: 0.93,
      'source-review': 0.93,
      'glossary-gen': 0.92,
      'category-gen': 0.92,
    },
    reliableBatchEntries: 600,
    effectiveContextTokens: 220_000,
    effortModifiers: { minimal: 0.9, low: 0.93 },
  },
  {
    ids: ['gpt-5.4-pro'],
    tasks: {
      translate: 0.93,
      judge: 0.92,
      'source-review': 0.92,
      'glossary-gen': 0.91,
      'category-gen': 0.91,
    },
    reliableBatchEntries: 500,
    effectiveContextTokens: 220_000,
  },
  {
    ids: ['gpt-5.4'],
    tasks: {
      translate: 0.9,
      judge: 0.89,
      'source-review': 0.89,
      'glossary-gen': 0.88,
      'category-gen': 0.88,
    },
    reliableBatchEntries: 450,
    effectiveContextTokens: 220_000,
    effortModifiers: { minimal: 0.88, low: 0.92 },
  },
  {
    ids: ['gpt-5.4-mini'],
    tasks: {
      translate: 0.78,
      judge: 0.72,
      'source-review': 0.74,
      'glossary-gen': 0.76,
      'category-gen': 0.78,
    },
    reliableBatchEntries: 200,
    effectiveContextTokens: 200_000,
    effortModifiers: { minimal: 0.85, low: 0.9 },
  },
  {
    ids: ['gpt-5.4-nano'],
    tasks: {
      translate: 0.62,
      judge: 0.55,
      'source-review': 0.58,
      'glossary-gen': 0.6,
      'category-gen': 0.65,
    },
    reliableBatchEntries: 80,
    effectiveContextTokens: 120_000,
    notes: 'Nano tier: fine for short, simple strings; unreliable beyond small batches.',
  },
  // Common GitHub Copilot catalog ids (Copilot ships no bundled list; these
  // ids arrive via live discovery and overlap the OpenAI naming).
  {
    ids: ['gpt-4.1'],
    tasks: {
      translate: 0.8,
      judge: 0.75,
      'source-review': 0.76,
      'glossary-gen': 0.78,
      'category-gen': 0.8,
    },
    reliableBatchEntries: 250,
    effectiveContextTokens: 600_000,
  },
  {
    ids: ['gpt-4o'],
    tasks: {
      translate: 0.76,
      judge: 0.7,
      'source-review': 0.72,
      'glossary-gen': 0.74,
      'category-gen': 0.76,
    },
    reliableBatchEntries: 200,
    effectiveContextTokens: 100_000,
  },
  // ── Google ─────────────────────────────────────────────────────────────────
  {
    ids: ['gemini-3.1-pro-preview'],
    tasks: {
      translate: 0.92,
      judge: 0.91,
      'source-review': 0.9,
      'glossary-gen': 0.89,
      'category-gen': 0.9,
    },
    reliableBatchEntries: 500,
    effectiveContextTokens: 600_000,
    effortModifiers: { minimal: 0.88, low: 0.92 },
  },
  {
    ids: ['gemini-3.5-flash'],
    tasks: {
      translate: 0.86,
      judge: 0.83,
      'source-review': 0.83,
      'glossary-gen': 0.84,
      'category-gen': 0.86,
    },
    reliableBatchEntries: 300,
    effectiveContextTokens: 500_000,
    effortModifiers: { minimal: 0.85, low: 0.9 },
  },
  {
    ids: ['gemini-3-flash-preview'],
    tasks: {
      translate: 0.82,
      judge: 0.78,
      'source-review': 0.78,
      'glossary-gen': 0.8,
      'category-gen': 0.82,
    },
    reliableBatchEntries: 250,
    effectiveContextTokens: 500_000,
  },
  {
    ids: ['gemini-3.1-flash-lite'],
    tasks: {
      translate: 0.7,
      judge: 0.62,
      'source-review': 0.64,
      'glossary-gen': 0.66,
      'category-gen': 0.7,
    },
    reliableBatchEntries: 120,
    effectiveContextTokens: 250_000,
    notes: 'Lite tier: keep runs small; weak on judge/review nuance.',
  },
  {
    ids: ['gemini-2.5-pro'],
    tasks: {
      translate: 0.88,
      judge: 0.86,
      'source-review': 0.85,
      'glossary-gen': 0.85,
      'category-gen': 0.86,
    },
    reliableBatchEntries: 400,
    effectiveContextTokens: 500_000,
  },
  {
    ids: ['gemini-2.5-flash'],
    tasks: {
      translate: 0.75,
      judge: 0.7,
      'source-review': 0.72,
      'glossary-gen': 0.74,
      'category-gen': 0.76,
    },
    reliableBatchEntries: 150,
    effectiveContextTokens: 500_000,
    effortModifiers: { minimal: 0.8, low: 0.85, medium: 0.9 },
    notes: 'Falls off sharply on large batches; prefer smaller runs or a pro-tier model.',
  },
  {
    ids: ['gemini-2.5-flash-lite', 'gemini-2.5-flash-lite-preview-09-2025'],
    tasks: {
      translate: 0.62,
      judge: 0.55,
      'source-review': 0.58,
      'glossary-gen': 0.6,
      'category-gen': 0.64,
    },
    reliableBatchEntries: 100,
    effectiveContextTokens: 250_000,
  },
  {
    ids: ['gemini-2.0-flash'],
    tasks: {
      translate: 0.65,
      judge: 0.58,
      'source-review': 0.6,
      'glossary-gen': 0.62,
      'category-gen': 0.66,
    },
    reliableBatchEntries: 120,
    effectiveContextTokens: 250_000,
  },
  {
    ids: ['gemini-2.0-flash-lite'],
    tasks: {
      translate: 0.55,
      judge: 0.48,
      'source-review': 0.5,
      'glossary-gen': 0.52,
      'category-gen': 0.58,
    },
    reliableBatchEntries: 80,
    effectiveContextTokens: 200_000,
  },
  // ── DeepSeek ───────────────────────────────────────────────────────────────
  {
    ids: ['deepseek-v4-pro'],
    tasks: {
      translate: 0.86,
      judge: 0.84,
      'source-review': 0.82,
      'glossary-gen': 0.82,
      'category-gen': 0.84,
    },
    reliableBatchEntries: 300,
    effectiveContextTokens: 120_000,
  },
  {
    ids: ['deepseek-v4-flash'],
    tasks: {
      translate: 0.76,
      judge: 0.7,
      'source-review': 0.7,
      'glossary-gen': 0.72,
      'category-gen': 0.76,
    },
    reliableBatchEntries: 200,
    effectiveContextTokens: 120_000,
  },
  {
    ids: ['deepseek-chat'],
    tasks: {
      translate: 0.7,
      judge: 0.62,
      'source-review': 0.64,
      'glossary-gen': 0.66,
      'category-gen': 0.7,
    },
    reliableBatchEntries: 150,
    effectiveContextTokens: 60_000,
  },
  {
    ids: ['deepseek-reasoner'],
    tasks: {
      translate: 0.74,
      judge: 0.84,
      'source-review': 0.8,
      'glossary-gen': 0.75,
      'category-gen': 0.75,
    },
    reliableBatchEntries: 120,
    effectiveContextTokens: 60_000,
    notes: 'Reasoning model: strong at judge/review, slow for bulk translation.',
  },
];

/** Lowercased id → profile, built once at module load. */
const profileByModelId: ReadonlyMap<string, ModelConfidenceProfile> = (() => {
  const map = new Map<string, ModelConfidenceProfile>();
  for (const profile of MODEL_CONFIDENCE_PROFILES) {
    for (const id of profile.ids) map.set(id, profile);
  }
  return map;
})();

/**
 * Exact (case-insensitive, trimmed) lookup. Returns undefined for unknown
 * models — the UI must then show no score. Deliberately NO fuzzy matching.
 * Tolerates a missing/non-string id (partial ModelInfo objects occur in
 * discovery edge cases and test fixtures): unknown ⇒ no score, never a throw.
 */
export function findConfidenceProfile(modelId: string): ModelConfidenceProfile | undefined {
  if (typeof modelId !== 'string') return undefined;
  return profileByModelId.get(modelId.trim().toLowerCase());
}
