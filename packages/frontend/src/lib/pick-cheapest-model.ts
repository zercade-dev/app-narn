import type { ModelInfo } from '@zercade-dev/narn-shared';

/**
 * Relative cost of a model, lower is cheaper. Prefers an absolute USD price
 * (`inputCostPerMillion`) when the provider exposes it, otherwise the relative
 * `multiplier` (e.g. Copilot SDK). Models with no billing data sort last so a
 * priced model always wins over an unpriced one.
 *
 * Within a single selector all models come from the same provider, so the units
 * are consistent — we never compare a USD price against a multiplier.
 */
function modelCost(model: ModelInfo): number {
  const billing = model.billing;
  if (!billing) return Number.POSITIVE_INFINITY;
  if (typeof billing.inputCostPerMillion === 'number') return billing.inputCostPerMillion;
  if (typeof billing.multiplier === 'number') return billing.multiplier;
  return Number.POSITIVE_INFINITY;
}

/**
 * Picks the cheapest model from a discovered list, used to seed the model field
 * on first successful discovery when the user has not chosen one yet.
 *
 * When no model carries billing data (e.g. a local Ollama endpoint), falls back
 * to the first discovered model so the field is still populated with something
 * usable rather than left blank.
 */
export function pickCheapestModel(models: readonly ModelInfo[]): ModelInfo | undefined {
  if (models.length === 0) return undefined;
  let best = models[0];
  let bestCost = modelCost(best);
  for (let i = 1; i < models.length; i++) {
    const cost = modelCost(models[i]);
    if (cost < bestCost) {
      best = models[i];
      bestCost = cost;
    }
  }
  return best;
}
