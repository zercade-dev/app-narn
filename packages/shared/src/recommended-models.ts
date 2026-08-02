/**
 * Standalone registry of "recommended for this app" model ids per provider.
 * Deliberately independent of any scoring machinery: a pure id-set membership
 * test drives a picker badge + a group-above sort. Unknown models get no badge.
 *
 * Ids are curated from provider model specs/descriptions (no per-model live
 * testing). Validate that each id still EXISTS in the provider's live model
 * list before a release with `scripts/validate-recommended-models.ts` (uses the
 * local keys in `scripts/.env` + OpenRouter's public catalog). The `copilot`
 * ids ship UNVALIDATED — no local GITHUB_TOKEN — and are best-effort.
 */
export type RecommendedProvider =
  'anthropic' | 'openai' | 'google' | 'deepseek' | 'openrouter' | 'copilot';

export const RECOMMENDED_MODELS: Record<RecommendedProvider, readonly string[]> = {
  anthropic: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-5.1', 'gpt-5-mini', 'gpt-5'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  // OpenRouter ids are namespaced `vendor/model`.
  openrouter: [
    'anthropic/claude-sonnet-5',
    'openai/gpt-5.1',
    'google/gemini-2.5-pro',
    'deepseek/deepseek-chat',
  ],
  // UNVALIDATED (no local GITHUB_TOKEN): best-effort Copilot catalog ids.
  copilot: ['claude-sonnet-4.5', 'gpt-5', 'gemini-2.5-pro'],
};

const RECOMMENDED_LOWER: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(RECOMMENDED_MODELS).map(([provider, ids]) => [
    provider,
    new Set(ids.map((id) => id.trim().toLowerCase())),
  ]),
);

/** Curated ids for a provider (empty for unknown providers / generic-ai). */
export function recommendedModelsFor(provider: string | undefined): readonly string[] {
  if (!provider) return [];
  return RECOMMENDED_MODELS[provider as RecommendedProvider] ?? [];
}

/** Case-insensitive, trimmed membership test. Unknown provider ⇒ false. */
export function isRecommendedModel(provider: string | undefined, modelId: string): boolean {
  if (!provider || typeof modelId !== 'string') return false;
  const set = RECOMMENDED_LOWER[provider];
  return set ? set.has(modelId.trim().toLowerCase()) : false;
}
