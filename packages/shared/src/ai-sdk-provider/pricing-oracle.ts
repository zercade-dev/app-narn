import type { ModelBilling } from '../types/models.js';
import providerPricingJson from './pricing-data/provider-pricing.json' with { type: 'json' };

/**
 * @server-only This module holds an in-memory cache that is only meaningful in
 * a long-running Node.js process. It must not be imported by the frontend
 * bundle. Import it only from server-side resolver modules (e.g.
 * `reasoning-resolvers.ts`).
 */

/**
 * Pricing oracle: derives per-model billing data from a static, checked-in
 * JSON snapshot (`./pricing-data/provider-pricing.json`) rather than a live
 * network feed. The snapshot is scraped per-provider (DeepSeek, Google,
 * OpenAI, Anthropic — see each provider's `sourceUrl` in the JSON) by
 * `scripts/update-provider-pricing.ts` and refreshed out-of-band; this module
 * only reads the bundled result.
 *
 * All 4 providers' `models` arrays are flattened into single id-keyed caches
 * (billing / capability tags / context length) at module load, since
 * `lookupBilling` and friends take only a model id, no provider argument.
 * Model-id namespaces don't collide across these providers (`gpt-`/`o`-
 * prefixed, `claude-`-prefixed, `gemini-`-prefixed, `deepseek-`-prefixed), so
 * a flat merge is safe. Lookups normalize model ids (stripping provider
 * prefixes and variant suffixes, and remapping a small set of deprecated
 * Anthropic ids — see `normalizeModelId`) so provider-native ids match the
 * JSON's ids.
 *
 * There is no network call and thus no failure mode to degrade from: an id
 * that isn't in the snapshot simply yields `undefined` billing (no badge, no
 * error). Pricing must never block model listing.
 *
 * Note: this file also still exports `billingFromOpenRouterPricing` and the
 * `OpenRouterPricing` shape it accepts. That helper is UNRELATED to this
 * module's own pricing snapshot — it's used by `reasoning-resolvers.ts`'s
 * `resolveGenericModels()` for the "generic-ai" module's OpenRouter-as-a-
 * runtime-backend path (a user pointing their own OpenAI-compatible instance
 * at `openrouter.ai`, a BYOK backend choice, not this oracle's data source).
 */

/**
 * Baseline model used to derive the relative price multiplier.
 *
 * The multiplier is `inputCostPerMillion / BASELINE_INPUT_COST_PER_MILLION`,
 * so the baseline model reads as `1×`. GPT-4.1 is a stable, widely-referenced
 * mid-tier model; its prompt price was $2.00 per 1M tokens (0.000002
 * USD/token) as of 2026. The constant is documented here rather than read
 * from the pricing snapshot so the multiplier stays defined even if a future
 * refresh drops the baseline model from the catalog.
 */
export const BASELINE_MODEL_ID = 'gpt-4.1';
export const BASELINE_INPUT_COST_PER_MILLION = 2.0;
/**
 * Output-price baseline from the same model ($8.00 per 1M tokens), so
 * `outputMultiplier` uses the same baseline convention as `multiplier` and
 * the baseline model reads as `1×` for both.
 */
export const BASELINE_OUTPUT_COST_PER_MILLION = 8.0;

/**
 * Shape of an OpenRouter `pricing` block (USD per token, as decimal
 * strings). Only used by {@link billingFromOpenRouterPricing} below — kept
 * for the unrelated "generic-ai pointed at openrouter.ai" runtime-backend
 * path in `reasoning-resolvers.ts` (see module doc comment above).
 */
interface OpenRouterPricing {
  /** USD per prompt (input) token, as a decimal string. */
  prompt?: string;
  /** USD per completion (output) token, as a decimal string. */
  completion?: string;
  /** USD per cached prompt token read back from the provider cache, as a decimal string. */
  input_cache_read?: string;
  /** USD per prompt token written to the provider cache, as a decimal string. */
  input_cache_write?: string;
}

/** Normalized-id → billing map. `null` means "not yet loaded". */
let pricingCache: Map<string, ModelBilling> | null = null;
/** Normalized-id → display capability tags (thinking/tools/vision/audio). */
let capabilityCache: Map<string, string[]> | null = null;
/** Normalized-id → context-window size in tokens. */
let contextLengthCache: Map<string, number> | null = null;

/**
 * Deprecated/legacy Anthropic model ids that no longer appear in the current
 * pricing snapshot (Anthropic's own pricing page only lists the current
 * lineup) get remapped to the current-generation model that occupies the
 * same price tier, so cost display still resolves for callers still
 * configured with an old id. Only kept where the mapping target actually
 * exists in `provider-pricing.json` today — a mapping to a model the
 * snapshot doesn't carry would still miss, so there's no value keeping it.
 */
const ANTHROPIC_MODEL_MAPPING: Record<string, string> = {
  'claude-3-5-sonnet': 'claude-sonnet-4-6',
};

function mapAnthropicModelId(normalized: string): string {
  return ANTHROPIC_MODEL_MAPPING[normalized] ?? normalized;
}

/**
 * Normalize a model id for cross-provider matching: lowercase, drop any
 * provider prefix (`openai/gpt-4o` → `gpt-4o`), variant suffix
 * (`some-model:free` → `some-model`), and Anthropic date suffixes
 * (`claude-3-5-sonnet-20241022` → `claude-3-5-sonnet`).
 *
 * Anthropic's live API and the pricing snapshot both use hyphenated minor
 * versions (`claude-opus-4-8`), so — unlike the old OpenRouter-backed
 * version of this function — no dot-conversion is needed; ids pass straight
 * through as pricing-snapshot keys. Only a small table of deprecated legacy
 * ids (see {@link ANTHROPIC_MODEL_MAPPING}) gets remapped to a current id.
 */
function normalizeModelId(id: string): string {
  const withoutPrefix = id.includes('/') ? id.slice(id.lastIndexOf('/') + 1) : id;
  const withoutVariant = withoutPrefix.split(':')[0];
  // Strip Anthropic date suffixes: either -YYYYMMDD (e.g., -20241022) or -YYYY-MM-DD (e.g., -2024-10-22)
  const withoutDate = withoutVariant.replace(/-\d{8}$|-\d{4}-\d{2}-\d{2}$/, '');
  const normalized = withoutDate.trim().toLowerCase();

  return mapAnthropicModelId(normalized);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Map an OpenRouter `pricing` block (USD per token) to `ModelBilling`: cost
 * fields are scaled to USD per 1M tokens and the multipliers are derived
 * from the input/output costs relative to the documented baselines.
 *
 * Returns `undefined` when neither price is a finite number.
 *
 * Kept for `reasoning-resolvers.ts`'s `resolveGenericModels()` OpenRouter
 * runtime-backend path (see module doc comment above) — this pricing
 * oracle's own snapshot-backed billing goes through {@link billingFromPricingModel}
 * instead.
 */
export function billingFromOpenRouterPricing(
  pricing: OpenRouterPricing | undefined,
): ModelBilling | undefined {
  const promptPerToken = pricing?.prompt == null ? Number.NaN : Number(pricing.prompt);
  const completionPerToken = pricing?.completion == null ? Number.NaN : Number(pricing.completion);
  const cacheReadPerToken =
    pricing?.input_cache_read == null ? Number.NaN : Number(pricing.input_cache_read);
  const cacheWritePerToken =
    pricing?.input_cache_write == null ? Number.NaN : Number(pricing.input_cache_write);
  // Domain guard, not just validity: OpenRouter's router meta-models
  // (openrouter/auto, openrouter/fusion, …) report the sentinel "-1" for
  // dynamically-priced routing — a negative "price" is unknown, not a cost
  // (it would otherwise surface as -1000000.00/MTok in the picker). "0" is
  // legitimate (free-tier models) and stays accepted.
  const isPrice = (perToken: number): boolean => Number.isFinite(perToken) && perToken >= 0;
  const hasInput = isPrice(promptPerToken);
  const hasOutput = isPrice(completionPerToken);
  const hasCacheRead = isPrice(cacheReadPerToken);
  const hasCacheWrite = isPrice(cacheWritePerToken);

  if (!hasInput && !hasOutput && !hasCacheRead && !hasCacheWrite) return undefined;

  const billing: ModelBilling = {};
  if (hasInput) {
    billing.inputCostPerMillion = promptPerToken * 1e6;
    billing.multiplier = round2(billing.inputCostPerMillion / BASELINE_INPUT_COST_PER_MILLION);
  }
  if (hasOutput) {
    billing.outputCostPerMillion = completionPerToken * 1e6;
    billing.outputMultiplier = round2(
      billing.outputCostPerMillion / BASELINE_OUTPUT_COST_PER_MILLION,
    );
  }
  if (hasCacheRead) billing.cachedInputCostPerMillion = cacheReadPerToken * 1e6;
  if (hasCacheWrite) billing.cacheWriteCostPerMillion = cacheWritePerToken * 1e6;
  return billing;
}

/** One model entry as it appears in `provider-pricing.json`'s `models` arrays. */
export interface PricingDataModel {
  id: string;
  /** USD per 1M input tokens — already in USD/1M, no per-token scaling needed. */
  inputCostPerMillion?: number;
  /** USD per 1M output tokens. */
  outputCostPerMillion?: number;
  /** USD per 1M tokens read from the provider's prompt cache. */
  cachedInputCostPerMillion?: number;
  /** USD per 1M tokens written to the provider's prompt cache. */
  cacheWriteCostPerMillion?: number;
  /** Maximum context window in tokens. */
  contextLength?: number;
  /**
   * Display capability tags (`tools`/`vision`/`audio` — `thinking` is derived
   * separately, at runtime, from `supportedReasoningEfforts`). Populated for
   * DeepSeek/OpenAI/Google (scraped or OpenRouter-gap-filled); Anthropic's
   * come from a live API call instead, not this snapshot.
   */
  capabilityTags?: string[];
}

/** One provider's slice of `provider-pricing.json`. */
export interface PricingDataProvider {
  sourceUrl?: string;
  models: PricingDataModel[];
}

/** Full shape of `provider-pricing.json`. */
export interface PricingData {
  generatedAt?: string;
  providers: Record<string, PricingDataProvider>;
}

/**
 * Map a pricing-snapshot model entry to `ModelBilling`. Unlike the old
 * OpenRouter-derived {@link billingFromOpenRouterPricing}, the snapshot's
 * cost fields are already USD-per-1M-tokens, so no `* 1e6` scaling is
 * applied — only the multiplier derivation (reusing the same baseline
 * constants and {@link round2} helper) is shared with that function.
 *
 * Returns `undefined` when none of the cost fields are finite numbers.
 */
function billingFromPricingModel(model: PricingDataModel): ModelBilling | undefined {
  const input = model.inputCostPerMillion;
  const output = model.outputCostPerMillion;
  const cacheRead = model.cachedInputCostPerMillion;
  const cacheWrite = model.cacheWriteCostPerMillion;
  const hasInput = typeof input === 'number' && Number.isFinite(input);
  const hasOutput = typeof output === 'number' && Number.isFinite(output);
  const hasCacheRead = typeof cacheRead === 'number' && Number.isFinite(cacheRead);
  const hasCacheWrite = typeof cacheWrite === 'number' && Number.isFinite(cacheWrite);

  if (!hasInput && !hasOutput && !hasCacheRead && !hasCacheWrite) return undefined;

  const billing: ModelBilling = {};
  if (hasInput) {
    billing.inputCostPerMillion = input;
    billing.multiplier = round2(input / BASELINE_INPUT_COST_PER_MILLION);
  }
  if (hasOutput) {
    billing.outputCostPerMillion = output;
    billing.outputMultiplier = round2(output / BASELINE_OUTPUT_COST_PER_MILLION);
  }
  if (hasCacheRead) billing.cachedInputCostPerMillion = cacheRead;
  if (hasCacheWrite) billing.cacheWriteCostPerMillion = cacheWrite;
  return billing;
}

interface FeedCaches {
  billing: Map<string, ModelBilling>;
  capabilities: Map<string, string[]>;
  contextLengths: Map<string, number>;
}

function emptyCaches(): FeedCaches {
  return {
    billing: new Map(),
    capabilities: new Map(),
    contextLengths: new Map(),
  };
}

/** Flatten every provider's `models` array into one set of id-keyed caches. */
function buildCachesFromPricingData(data: PricingData | undefined): FeedCaches {
  const caches = emptyCaches();
  const providers = data?.providers ?? {};
  for (const provider of Object.values(providers)) {
    for (const model of provider?.models ?? []) {
      if (!model?.id) continue;
      const id = normalizeModelId(model.id);
      const billing = billingFromPricingModel(model);
      if (billing) caches.billing.set(id, billing);
      if (Array.isArray(model.capabilityTags) && model.capabilityTags.length > 0) {
        caches.capabilities.set(id, model.capabilityTags);
      }
      const ctx = model.contextLength;
      if (typeof ctx === 'number' && Number.isFinite(ctx) && ctx > 0) {
        caches.contextLengths.set(id, Math.floor(ctx));
      }
    }
  }
  return caches;
}

// Eagerly load the bundled pricing snapshot at module-init time — it's
// static JSON shipped with the package, so there's no network round trip to
// defer. `ensurePricingFeed()` below is kept only so existing call sites
// (`await ensurePricingFeed()`) keep compiling and behaving correctly.
{
  const bundled = buildCachesFromPricingData(providerPricingJson as unknown as PricingData);
  pricingCache = bundled.billing;
  capabilityCache = bundled.capabilities;
  contextLengthCache = bundled.contextLengths;
}

/**
 * No-op: the pricing snapshot is bundled JSON, loaded eagerly into the
 * in-memory caches at module-init time (see above) — there is no feed to
 * fetch. Kept as an async function so existing call sites that
 * `await ensurePricingFeed()` before calling the lookups below keep working
 * unchanged.
 */
export async function ensurePricingFeed(): Promise<void> {
  // Intentionally empty.
}

/**
 * Look up billing for a model id from the bundled pricing snapshot.
 *
 * Returns `undefined` when the caches are unloaded (see
 * {@link __resetPricingCacheForTests}) or no normalized id matches.
 */
export function lookupBilling(modelId: string): ModelBilling | undefined {
  if (!pricingCache) return undefined;
  return pricingCache.get(normalizeModelId(modelId));
}

/**
 * Look up display capability tags for a model id from the bundled pricing
 * snapshot. Same contract as {@link lookupBilling}. Populated for
 * DeepSeek/OpenAI/Google (scraped `tools`, OpenRouter-gap-filled
 * `vision`/`audio` where no official per-model source exists); Anthropic's
 * snapshot entries carry none — its tags come from a live API call in
 * `reasoning-resolvers.ts` instead.
 */
export function lookupCapabilityTags(modelId: string): string[] | undefined {
  if (!capabilityCache) return undefined;
  return capabilityCache.get(normalizeModelId(modelId));
}

/**
 * The pricing snapshot carries no output-modality data (unlike OpenRouter's
 * `architecture.output_modalities`), so there is nothing to positively
 * detect a non-text (image/audio-only) model from. Always returns `false` —
 * a name-pattern-based replacement filter for OpenAI/DeepSeek is tracked as
 * a separate, later change to `reasoning-resolvers.ts`, out of scope here.
 * Signature is kept so existing callers keep compiling unchanged.
 */
export function modelEmitsNonTextOnly(_modelId: string): boolean {
  return false;
}

/**
 * Look up the context-window size (in tokens) for a model id from the
 * bundled pricing snapshot. Same contract as {@link lookupBilling}.
 */
export function lookupContextLength(modelId: string): number | undefined {
  if (!contextLengthCache) return undefined;
  return contextLengthCache.get(normalizeModelId(modelId));
}

/**
 * Test-only: seed the caches as "loaded" from a `provider-pricing.json`-
 * shaped fixture (default: no providers) so tests get deterministic lookups
 * without depending on the bundled snapshot's real contents.
 */
export function __primePricingCacheForTests(data: PricingData = { providers: {} }): void {
  const caches = buildCachesFromPricingData(data);
  pricingCache = caches.billing;
  capabilityCache = caches.capabilities;
  contextLengthCache = caches.contextLengths;
}

/** Test-only: reset the caches back to their unloaded state. */
export function __resetPricingCacheForTests(): void {
  pricingCache = null;
  capabilityCache = null;
  contextLengthCache = null;
}
