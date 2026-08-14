import type { CredentialProvider, CostTier, ModuleManifest } from '../types/module.js';

export type ProviderType =
  | 'google'
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'groq'
  | 'openai-compatible'
  | 'anthropic-compatible';

/**
 * The kind of local-LLM server backing a generic-ai (openai-compatible)
 * instance. Replaces the implicit baseURL autodetect: an explicit value is
 * authoritative for model discovery, VRAM-footprint gating, and split-by-model
 * unload. `unknown` is a generic OpenAI-compatible endpoint (e.g. vLLM).
 * Resolved (with a legacy heuristic fallback for unset configs) by
 * `resolveEndpointType` in reasoning-resolvers.ts.
 */
export type EndpointType = 'ollama' | 'lm-studio' | 'unknown';

export interface AISDKModuleConfig {
  provider: ProviderType;
  manifest: ModuleManifest;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  /**
   * generic-ai only: the local-LLM server kind, used by model discovery and the
   * split-by-model unload path. Absent for cloud providers (and for legacy
   * generic-ai instances, where {@link resolveEndpointType} falls back to the
   * baseURL heuristic).
   */
  endpointType?: EndpointType;
  reasoningEffort?: string;
  credentials?: CredentialProvider;
  log?: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
  verbose?: boolean;
  maxBatchSize?: number;
  batchMode?: 'language' | 'entry';
  /**
   * Upper bound on tokens generated per request. Caps the size of a response
   * from a misconfigured or hostile provider so it cannot exhaust memory.
   * Defaults to {@link DEFAULT_MAX_OUTPUT_TOKENS}.
   */
  maxOutputTokens?: number;
  /**
   * Global client-side rate limit (requests/second) injected by the host from
   * the workspace settings; applied per outbound HTTP request. 0/unset = off.
   */
  requestsPerSecond?: number;
  /**
   * Per-request timeout (ms) injected by the host from workspace settings. A
   * fired timeout becomes a transient RequestTimeoutError so the review paths
   * retry it at a smaller batch size. Defaults to DEFAULT_REQUEST_TIMEOUT_MS.
   */
  requestTimeoutMs?: number;
  /**
   * generic-ai only: opt-in to the global rate limit (local Ollama/LM Studio
   * endpoints don't need throttling, so it defaults to off for generic-ai).
   * All other providers are limited whenever requestsPerSecond is set.
   */
  rateLimitEnabled?: boolean;
  /**
   * Max simultaneous in-flight provider requests for this module. The gate is
   * keyed by module id, so all of the module's LLM calls — translate, retry,
   * judge, source-review, glossary — share the same slot pool. Unset / <= 0 =
   * unlimited (the default for every module except generic-ai, which defaults
   * to 1 for single local endpoints).
   */
  maxParallel?: number;
  /**
   * When true, each feature's request enables the provider's NATIVE
   * structured-output mode, constraining the reply so malformed output is far
   * less likely. Effect by provider: openai → JSON mode (`json_object`; the
   * Responses API the SDK targets rejects a root-array json_schema, so JSON mode
   * is used instead — it still forces valid JSON); google → `responseSchema`
   * (full schema); deepseek → JSON mode (`json_object`); openai-compatible →
   * json_schema `response_format` via the provider's transformRequestBody hook
   * (the original use, ideal for grammar-constrained Ollama/llama.cpp backends).
   * No-op for anthropic / anthropic-compatible, which have no clean native path
   * that preserves the manual text-parse flow. Off (default) keeps the
   * prompt-only contract.
   */
  useStructuredOutput?: boolean;
  /** When provided, overrides manifest.costTier by matching the configured model against these patterns. */
  costPatterns?: Array<{ pattern: RegExp; tier: CostTier }>;
  /** Fallback tier when no costPattern matches; defaults to manifest.costTier. */
  costFallback?: CostTier;
}

/**
 * Config accepted by the per-provider module factories (google, openai,
 * anthropic, deepseek, generic-ai): everything callers may customise on
 * AISDKModuleConfig minus the fields each factory sets itself
 * (`provider`, `manifest`, `costPatterns`).
 */
export type ModuleFactoryConfig = Omit<AISDKModuleConfig, 'provider' | 'manifest' | 'costPatterns'>;

/**
 * Thrown when a translate() call contains duplicate (entryId, targetLanguage)
 * pairs, indicating an engine bug that corrupted or split job batches.
 */
export class IncompleteEntryError extends Error {
  constructor(public readonly entryId: string) {
    super(
      `IncompleteEntryError: entry "${entryId}" has a duplicate (entryId, targetLanguage) pair in this batch`,
    );
    this.name = 'IncompleteEntryError';
  }
}
