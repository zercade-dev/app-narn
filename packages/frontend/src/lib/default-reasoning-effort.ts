/**
 * Best-effort lookup used at first-enable time (enabling a module/instance
 * that has never been configured before): if the model that will end up
 * selected for it advertises an explicit "disabled" reasoning-effort value
 * (see `ModelInfo.supportedReasoningEfforts` in
 * `@zercade-dev/narn-shared`), default `config.reasoningEffort` to
 * `'disabled'` instead of leaving it unset — so a reasoning-capable model
 * doesn't silently start "thinking" (and billing for it) before the user has
 * made a deliberate choice.
 *
 * Reuses the exact same capability data `ModuleReasoningEffortSelect` reads
 * (`ModelInfo.supportedReasoningEfforts`, fetched via the module's
 * `/modules/:id/models` route) and the same cheapest-model fallback
 * `useAutoSelectModel` uses to seed the model field on first discovery, so the
 * effort we default here matches the model that will actually end up selected.
 */
import type { ModelInfo } from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';
import { pickCheapestModel } from './pick-cheapest-model.js';

/**
 * @param moduleId Module (or instance) id whose `/models` route is queried.
 * @param preferredModel A model id already set on the config (if any) — used
 *   in preference to the cheapest discovered model, mirroring
 *   `useAutoSelectModel`'s preferred-vs-cheapest precedence.
 * @returns `'disabled'` when the resolved model supports it, otherwise
 *   `undefined` — including on any fetch failure (vault locked, network
 *   error, module without a live model list), so callers leave `config`
 *   exactly as it was.
 */
export async function resolveDefaultReasoningEffort(
  moduleId: string,
  preferredModel?: string,
): Promise<'disabled' | undefined> {
  let models: ModelInfo[];
  try {
    models = await apiRequest<ModelInfo[]>(`/modules/${encodeURIComponent(moduleId)}/models`);
  } catch {
    return undefined;
  }
  if (!Array.isArray(models) || models.length === 0) return undefined;
  const choice = preferredModel
    ? (models.find((m) => m.id === preferredModel) ?? pickCheapestModel(models))
    : pickCheapestModel(models);
  return choice?.supportedReasoningEfforts?.includes('disabled') ? 'disabled' : undefined;
}
