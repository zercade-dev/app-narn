export {
  createAISDKModule,
  createProviderModule,
  createDefaultModuleLogger,
  splitAndRetry,
  cancelledResult,
  resolveBatchSize,
  toAuthError,
  toRateLimitError,
  unwrapRetryError,
  parseRetryDelayFromMessage,
  decodeLeakedHtmlEntities,
  RATE_LIMIT_MESSAGE_RE,
  rethrowIfAuthOrRateLimit,
  throwIfAllChunksFailed,
  AUTH_401_MESSAGE_RE,
  charCounts,
  DEFAULT_MAX_OUTPUT_TOKENS,
  GLOSSARY_SUGGEST_CHUNK_SIZE,
  MIXED_PARSE_FAILURE_MESSAGE,
  PARSE_FAILURE_MESSAGE,
  isParseFailureMessage,
} from './core.js';
export type { CharCounts } from './core.js';
export { runJudgeFeature, runSourceReviewFeature, attachUsageToFirst } from './llm-module.js';
export type {
  FeatureGenerateResult,
  FeatureTransport,
  JudgeFeatureDeps,
  SourceReviewFeatureDeps,
  SplitAndRetry,
} from './llm-module.js';
export {
  validateBaseURL,
  coerceBoolean,
  coerceBooleanDefaultTrue,
  LOOPBACK_HOSTS,
} from './config-coerce.js';
export { runCountingProviderCalls } from './provider-call-counter.js';
export {
  buildBatchPrompt,
  parseBatchResponse,
  filterGlossaryForSource,
  buildMixedTargetBatchPrompt,
  parseMixedTargetBatchResponse,
  groupJobsByEntry,
  renderGlossary,
  renderContext,
  needsEscapeRule,
} from './prompt-builder.js';
export { buildProviderOptions } from './provider-options.js';
export {
  createModelForProvider,
  credentialKeyForProvider,
  resolveUseStructuredOutput,
  schemaUsesAdditionalProperties,
  defaultModelForProvider,
  deriveCostTierFromModel,
  OPENAI_COST_PATTERNS,
  ANTHROPIC_COST_PATTERNS,
  GOOGLE_COST_PATTERNS,
  DEEPSEEK_COST_PATTERNS,
  PROVIDER_COST_PATTERNS,
  GENERIC_API_KEY,
} from './model-factory.js';
export {
  resolveAnthropicModels,
  resolveOpenAIModels,
  resolveGoogleModels,
  resolveDeepSeekModels,
  resolveGenericModels,
  resolveOpenRouterModels,
  resolveGroqModels,
  inspectOllamaFootprint,
  isOllamaBaseURL,
  unloadOllamaModel,
  resolveEndpointType,
  unloadLMStudioModel,
  unloadLocalModel,
} from './reasoning-resolvers.js';
export type { OllamaFootprint } from './reasoning-resolvers.js';
export { streamChatText } from './chat-stream.js';
export type { ChatTurn, StreamChatTextDeps } from './chat-stream.js';
export { ensurePricingFeed, lookupBilling } from './pricing-oracle.js';
export type {
  EndpointType,
  ProviderType,
  AISDKModuleConfig,
  ModuleFactoryConfig,
} from './types.js';
export { JUDGE_SYSTEM_PROMPT, buildJudgePrompt, parseJudgeResponse } from './judge.js';
export {
  SOURCE_REVIEW_SYSTEM_PROMPT,
  buildSourceReviewPrompt,
  parseSourceReviewResponse,
  enabledChecks,
} from './source-review.js';
export type { SourceReviewChecks } from './source-review.js';
export {
  GLOSSARY_SUGGEST_SYSTEM_PROMPT,
  buildGlossarySuggestPrompt,
  parseGlossarySuggestResponse,
  createGlossarySuggestionMerger,
} from './glossary-suggest.js';
export {
  collectEntryContext,
  MAX_CONTEXT_CHARS,
  MAX_TRANSLATION_CHARS,
  MAX_CONTEXT_LABELS,
} from './entry-context.js';
export {
  buildCategoryPrompt,
  parseCategoryResponse,
  generateCategorySuggestions,
  CATEGORY_CHUNK_SIZE,
} from './category-classifier.js';
export type {
  CategoryEntryInput,
  CategorySuggestion,
  CategorySuggestionEntry,
  GenerateCategorySuggestionsOptions,
  GenerateCategorySuggestionsResult,
} from './category-classifier.js';
export {
  DEFAULT_REQUEST_TIMEOUT_MS,
  RequestTimeoutError,
  isAbortLikeError,
  isTransientError,
  transientRetryDelayMs,
  sleep,
  retryOnceOnTransient,
  combineAbortSignals,
} from './transient.js';
