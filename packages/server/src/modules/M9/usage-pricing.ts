/**
 * Run-usage pricing: converts a run's aggregated per-(moduleId, model) token
 * and character usage into estimated USD via the shared pricing oracle.
 * Used by both M9 (translation runs) and M25 (AI-review runs) at run
 * completion/cancel so the Runs tab can show a cost for either kind.
 */
import {
  type ModelBilling,
  type RunStatus,
  type RunUsageEntry,
  type TranslationUsage,
  ensurePricingFeed,
  lookupBilling,
} from '@zercade-dev/narn-shared';

/**
 * Pricing dependency used to convert aggregated token usage into USD.
 * Defaults to the shared pricing oracle (a bundled static per-provider
 * pricing snapshot); injectable for tests. `lookup` returning `undefined`
 * means "pricing unknown" — the run
 * then keeps `estimatedCostUsd` unset rather than reporting $0.
 */
export interface PricingProvider {
  ensure(): Promise<void>;
  lookup(model: string): ModelBilling | undefined;
}

export const defaultPricingProvider: PricingProvider = {
  ensure: ensurePricingFeed,
  lookup: lookupBilling,
};

/**
 * Rough characters-per-token ratio used to estimate cost for providers that
 * report billed characters but no token counts on a model that IS token-priced
 * (notably Copilot, which exposes the model name but no token usage). ~4 chars
 * per token is the conventional English approximation; the resulting figure is
 * an estimate, surfaced as such in the UI. Providers that report characters
 * with NO model (e.g. DeepL, genuinely character-priced and absent from the
 * token-pricing feed) keep their characters-only display.
 */
const CHARS_PER_TOKEN = 4;

/**
 * Folds a provider call's per-(module, model) token usage into the run's
 * `usageByModule` aggregate. One entry per (moduleId, model); input/output/
 * reasoning tokens and billed characters accumulate. Usages carrying none of
 * input tokens, output tokens, or characters are skipped (figures are only ever
 * attributed to the FIRST result of a call — see TranslationUsage), so a
 * character-priced provider (DeepL) is still aggregated.
 *
 * Shared by the translation engine (M9 `recordUsage`, which additionally folds
 * the character-detail accounting) and the background AI-review engines
 * (M25/M26), whose per-item results each carry an optional `usage`; pass
 * `results.map((r) => r.usage)`. `reasoningTokens`/`characters` are a no-op for
 * the review engines, which report neither.
 */
export function accumulateUsage(
  status: RunStatus,
  moduleId: string,
  usages: Iterable<TranslationUsage | undefined>,
): void {
  for (const usage of usages) {
    if (
      !usage ||
      (usage.inputTokens === undefined &&
        usage.outputTokens === undefined &&
        usage.characters === undefined)
    ) {
      continue;
    }
    status.usageByModule ??= [];
    let entry = status.usageByModule.find(
      (e) => e.moduleId === moduleId && e.model === usage.model,
    );
    if (!entry) {
      entry = { moduleId, ...(usage.model !== undefined ? { model: usage.model } : {}) };
      status.usageByModule.push(entry);
    }
    if (usage.inputTokens !== undefined) {
      entry.inputTokens = (entry.inputTokens ?? 0) + usage.inputTokens;
    }
    if (usage.outputTokens !== undefined) {
      entry.outputTokens = (entry.outputTokens ?? 0) + usage.outputTokens;
    }
    if (usage.reasoningTokens !== undefined) {
      entry.reasoningTokens = (entry.reasoningTokens ?? 0) + usage.reasoningTokens;
    }
    if (usage.cachedInputTokens !== undefined) {
      entry.cachedInputTokens = (entry.cachedInputTokens ?? 0) + usage.cachedInputTokens;
    }
    if (usage.cacheWriteTokens !== undefined) {
      entry.cacheWriteTokens = (entry.cacheWriteTokens ?? 0) + usage.cacheWriteTokens;
    }
    if (usage.characters !== undefined) {
      entry.characters = (entry.characters ?? 0) + usage.characters;
    }
  }
}

/**
 * Cost from billed input/output tokens; undefined when neither prices.
 *
 * Input cost splits into up to three billed components when the entry
 * carries a cache breakdown: the cached-read portion at
 * `cachedInputCostPerMillion`, the cache-write portion at
 * `cacheWriteCostPerMillion`, and everything else at the standard
 * `inputCostPerMillion`. Either cache rate falls back to the standard input
 * rate when the pricing snapshot doesn't have it, so a model with no cache
 * pricing data is billed exactly as before (never undercharged, never
 * silently ignored). `cachedInputTokens`/`cacheWriteTokens` default to 0 when
 * absent, so an entry with no cache data at all reduces to the original flat
 * `inputTokens * inputCostPerMillion` formula bit-for-bit.
 */
function costFromTokens(
  entry: RunUsageEntry,
  billing: ModelBilling | undefined,
): number | undefined {
  let inputCost: number | undefined;
  if (billing?.inputCostPerMillion !== undefined && entry.inputTokens !== undefined) {
    const cachedInputTokens = entry.cachedInputTokens ?? 0;
    const cacheWriteTokens = entry.cacheWriteTokens ?? 0;
    const uncachedTokens = Math.max(0, entry.inputTokens - cachedInputTokens - cacheWriteTokens);
    const cachedRate = billing.cachedInputCostPerMillion ?? billing.inputCostPerMillion;
    const cacheWriteRate = billing.cacheWriteCostPerMillion ?? billing.inputCostPerMillion;
    inputCost =
      (uncachedTokens * billing.inputCostPerMillion +
        cachedInputTokens * cachedRate +
        cacheWriteTokens * cacheWriteRate) /
      1e6;
  }
  const outputCost =
    billing?.outputCostPerMillion !== undefined && entry.outputTokens !== undefined
      ? (entry.outputTokens * billing.outputCostPerMillion) / 1e6
      : undefined;
  if (inputCost === undefined && outputCost === undefined) return undefined;
  return (inputCost ?? 0) + (outputCost ?? 0);
}

/**
 * Estimated cost for a character-only entry on a token-priced model: billed
 * characters are converted to an approximate token count and charged at the
 * model's input rate (the only signal available — Copilot reports source
 * characters, not output). Undefined when the model has no input pricing.
 */
function costFromCharacters(
  entry: RunUsageEntry,
  billing: ModelBilling | undefined,
): number | undefined {
  if (billing?.inputCostPerMillion === undefined || entry.characters === undefined) {
    return undefined;
  }
  const estimatedTokens = entry.characters / CHARS_PER_TOKEN;
  return (estimatedTokens * billing.inputCostPerMillion) / 1e6;
}

/**
 * Convert the run's aggregated usage into USD via the pricing provider.
 *
 * Token-priced usage uses the provider's input/output token costs, splitting
 * any cache-read/cache-write portion of the input tokens onto its own rate
 * when the pricing snapshot has one (see costFromTokens for the fallback
 * behavior when it doesn't).
 * Billed `characters` on a model with known token pricing are priced by
 * estimating tokens from characters (`CHARS_PER_TOKEN`) — a fallback for calls
 * whose token counts were unavailable (e.g. a Copilot call whose usage event
 * was not observed, which then reports characters instead of tokens).
 *
 * A single entry can carry BOTH tokens and characters when a run mixes
 * token-reporting and character-fallback calls for the same model. Because a
 * given call contributes tokens XOR characters (never both — see the copilot
 * module's `toTranslationUsage`), the two are disjoint and their costs are
 * SUMMED rather than one being dropped. Entries whose model has no known
 * pricing (or report characters with no model, e.g. DeepL) keep their figures
 * but get NO `estimatedCostUsd` (never $0 for unknown pricing);
 * `status.estimatedCostUsd` is set only when at least one entry priced.
 */
export async function finalizeUsageCosts(
  status: RunStatus,
  pricing: PricingProvider,
): Promise<void> {
  const entries = status.usageByModule;
  if (!entries || entries.length === 0) return;
  try {
    await pricing.ensure();
  } catch {
    // Pricing must never block or fail a run; tokens remain visible.
    return;
  }
  let total: number | undefined;
  for (const entry of entries) {
    if (entry.model === undefined) continue;
    const hasTokens = entry.inputTokens !== undefined || entry.outputTokens !== undefined;
    if (!hasTokens && entry.characters === undefined) continue;
    let billing: ModelBilling | undefined;
    try {
      billing = pricing.lookup(entry.model);
    } catch {
      // A throwing lookup means "pricing unknown" — never fail the run.
      continue;
    }
    // Sum both bases: token-reporting calls priced from tokens, plus any
    // character-fallback calls priced from characters. They come from
    // disjoint calls, so this never double-counts. Both helpers return
    // undefined when their base is absent, so the call is unconditional.
    const tokenCost = costFromTokens(entry, billing);
    const charCost = costFromCharacters(entry, billing);
    if (tokenCost === undefined && charCost === undefined) continue;
    const estimatedCost = (tokenCost ?? 0) + (charCost ?? 0);
    entry.estimatedCostUsd = estimatedCost;
    total = (total ?? 0) + estimatedCost;
  }
  if (total !== undefined) status.estimatedCostUsd = total;
}
