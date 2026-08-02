/**
 * Canonical reasoning effort levels — the single source of truth, re-exported
 * by `routing.ts` for callers that import it alongside the routing types.
 *
 * 'minimal' gives every provider tier a slot; 'max' and 'disabled' are
 * universal members so per-module subsets remain valid.
 *
 * 'enabled' is a plain on-switch (thinking on, no graded level) for models that
 * support reasoning but reject the graded effort parameter — e.g. Anthropic
 * Claude Haiku, which accepts adaptive thinking but errors on `effort`. Such
 * models advertise only ['disabled', 'enabled'].
 */
export type ReasoningEffort =
  'disabled' | 'enabled' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ModelBilling {
  /** Input cost in USD per 1 million tokens (or equivalent unit). */
  inputCostPerMillion?: number;
  /** Output cost in USD per 1 million tokens (or equivalent unit). */
  outputCostPerMillion?: number;
  /**
   * Cost in USD per 1 million tokens read from the provider's prompt cache
   * (cache-read / cache-hit price). Present only when the provider exposes it.
   */
  cachedInputCostPerMillion?: number;
  /**
   * Cost in USD per 1 million tokens written to the provider's prompt cache
   * (cache-write price). Present only when the provider exposes it.
   */
  cacheWriteCostPerMillion?: number;
  /**
   * Relative input-price multiplier (input cost normalized against a baseline
   * model so the baseline reads as `1×`). Set by the Copilot SDK adapter and
   * by the pricing oracle for AI-SDK providers.
   */
  multiplier?: number;
  /**
   * Relative output-price multiplier, normalized against the same baseline
   * model as `multiplier`. Present only when output price data is available.
   */
  outputMultiplier?: number;
}

export interface ModelInfo {
  /** Provider-native model identifier, e.g. "claude-opus-4-5". */
  id: string;
  /** Human-readable display name. Falls back to `id` when absent. */
  name?: string;
  /** Optional billing data when the provider exposes it. */
  billing?: ModelBilling;
  /**
   * Subset of ReasoningEffort values supported by this model.
   * `undefined` or empty array means the model has no reasoning mode.
   * Ordering must match ascending effort (disabled first, max last).
   */
  supportedReasoningEfforts?: ReasoningEffort[];
  /**
   * Default reasoning effort to pre-select in the UI.
   * Must be a member of `supportedReasoningEfforts` when both are set.
   */
  defaultReasoningEffort?: ReasoningEffort;
  /**
   * Provider-reported capability tags for the model, surfaced for display only
   * (e.g. `thinking`, `tools`, `vision`, `audio`). Sources vary by provider:
   * Ollama's `/api/show` `capabilities`, Copilot's `capabilities.supports`.
   * The bundled per-provider pricing snapshot (`pricing-oracle.ts`) also has a
   * `capabilityTags` slot reserved for the 4 AI-SDK cloud providers, though no
   * scraper populates it yet. `undefined` when none are known.
   *
   * Named `capabilityTags` (not `capabilities`) to avoid colliding with
   * provider-native `capabilities` objects (e.g. Copilot's `ModelInfo`) that
   * flow through the same JSON untyped.
   */
  capabilityTags?: string[];
  /**
   * Context-window size in tokens, when discovery can determine it. For Ollama
   * this is the configured `num_ctx` from `/api/show` `parameters` (the window
   * the model is actually run with, matching `ollama ps`), falling back to the
   * architecture max `model_info."<arch>.context_length"` when `num_ctx` is
   * unset. For the 4 AI-SDK cloud providers, sourced from the bundled
   * per-provider pricing snapshot (`pricing-oracle.ts`) when scraped for that
   * model. Also sourced from vLLM's `/v1/models` `max_model_len`, and from
   * OpenRouter's `context_length` when `generic-ai` is pointed at
   * `openrouter.ai` as a runtime backend. `undefined` when not reported (e.g.
   * plain OpenAI).
   */
  contextLength?: number;
  /**
   * On-disk size of a local model in bytes, from Ollama's `/api/tags` `size`.
   * Local models only (`undefined` for cloud providers).
   */
  sizeBytes?: number;
  /**
   * Parameter-count label for a local model, e.g. `"4.0B"`, from Ollama's
   * `/api/tags` `details.parameter_size`. Local models only.
   */
  parameterSize?: string;
  /**
   * Quantization level for a local model, e.g. `"Q8_0"`, from Ollama's
   * `/api/tags` `details.quantization_level`. Local models only.
   */
  quantizationLevel?: string;
}
