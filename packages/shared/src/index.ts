export type {
  Project,
  ProjectModuleConfigEntry,
  GlobalModuleConfigEntry,
  GlobalConfig,
  WorkspaceSettings,
  BatchGroupingDimension,
  AiRunModuleSelection,
} from './types/project.js';
export type {
  StageDetailFieldId,
  StageDetailTranslation,
  StageDetailField,
  StageDetails,
} from './types/stage-details.js';
export {
  STAGE_DETAIL_FIELD_IDS,
  emptyStageDetails,
  isStaleTranslation,
} from './types/stage-details.js';
export type { ModuleInstance } from './types/module-instances.js';
export {
  MODULE_INSTANCE_SEPARATOR,
  MODULE_INSTANCE_SLUG_PATTERN,
  isValidInstanceSlug,
  buildModuleInstanceId,
  parseModuleInstanceId,
  isModuleInstanceId,
  deriveInstanceCredentialKey,
  DEFAULT_INSTANCE_SLUG,
  isDefaultInstanceId,
} from './types/module-instances.js';
export type {
  StringEntry,
  TranslationRecord,
  TranslationVersion,
  SourceReviewFinding,
  SourceReviewFindingType,
  SourceReviewResult,
} from './types/string-entry.js';
export { DEFAULT_OVERFLOW_RATIO, MAX_PREVIOUS_VERSIONS } from './types/string-entry.js';
export {
  ACHIEVEMENT_SOURCE_LABELS,
  isAchievementSourceLabel,
  isAchievementSource,
} from './achievement-sources.js';
export { isExcludedFromAi } from './entry-exclusion.js';
export {
  SOURCE_LABELS,
  getSourceLabel,
  getSourceLabelDef,
  isKnownSourceLabel,
} from './source-labels.js';
export type { SourceLabelDef, SourceDisplayLocale } from './source-labels.js';
export type { OrphanEntry } from './types/orphan.js';
export type { ProjectRole, ProjectAccess, Capability } from './types/access.js';
export { can } from './types/access.js';
export type { Language } from './types/language.js';
export {
  LANGUAGE_REGISTRY,
  PSEUDO_LANGUAGE_CODE,
  PSEUDO_MODULE_ID,
  FREEWAY_MODULE_ID,
} from './types/language.js';
export type {
  TranslationModule,
  TranslationJob,
  TranslationResult,
  TranslationUsage,
  ModuleBatchMode,
  ModuleManifest,
  ModuleCapability,
  CostTier,
  PromptOptions,
  AchievementPromptContext,
  CredentialProvider,
  ConfigSchemaField,
  SourceReviewItem,
  SourceReviewItemResult,
  SourceReviewOptions,
  BatchDispatchOptions,
} from './types/module.js';
export {
  MissingCredentialError,
  VaultLockedError,
  RateLimitError,
  AuthError,
} from './types/errors.js';
export type {
  LQAResult,
  LQAIssue,
  TagNode,
  LQASeverity,
  KnownLQAIssueType,
  LQACheckConfig,
  ProjectLQAConfig,
} from './types/lqa.js';
export type { Glossary, GlossaryTerm, GlossarySummary } from './types/glossary.js';
export type {
  RoutingRule,
  RoutingRuleGroup,
  RoutingDecision,
  ControlledFailureReason,
} from './types/routing.js';
export { CONTROLLED_FAILURE_HINTS, controlledFailureHint } from './types/routing.js';
export type { ModelInfo, ModelBilling, ReasoningEffort } from './types/models.js';
export type {
  ProjectTemplate,
  ProjectTemplateConfig,
  TemplateApplyWarning,
} from './types/template.js';
export {
  RunStatusCode,
  runTypeLabel,
  isTranslationRunKind,
  hasRunDetailsKind,
} from './types/runs.js';
export type {
  RunStatus,
  RunErrorEntry,
  RunUsageEntry,
  RunRequest,
  RunEntryLanguagePair,
  RunKind,
  RunType,
  JudgeRunSummary,
  SourceReviewRunSummary,
  GlossaryGenRunSummary,
  RelinkRetranslateRunSummary,
  ChatKindLabel,
  ChatRunSummary,
  JudgeVerdictRecord,
  JudgeLogEntry,
  RunDetailEntry,
  RunDetailRetry,
  RunCharTotals,
  RunDetails,
  RunDetailPreviousValue,
} from './types/runs.js';
export { TM_MODULE_ID } from './types/tm.js';
export type { TmMatchPolicy, TmFingerprint, TmVariant, TmSegment } from './types/tm.js';
export type { NotificationRecord, NotificationSeverity } from './types/notification.js';
export {
  LANGUAGE_COLUMN_ALIASES,
  SOURCE_COLUMN_NAMES,
  NEEDS_TRANSLATION_COLUMN_NAMES,
  CONTEXT_COLUMN_NAMES,
  buildKnownHeadersSet,
} from './csv-headers.js';
export { parseGameCSV, buildCsvColumnMap, findRawNewlineLanguages } from './game-csv.js';
export type { ParsedGameCSV } from './game-csv.js';

export { PROJECT_ICONS, DEFAULT_PROJECT_ICON } from './types/project.js';
export type {
  JudgeItem,
  JudgeIssue,
  JudgeIssueType,
  JudgeChecks,
  JudgeVerdict,
} from './types/judge.js';
export {
  JUDGE_SYSTEM_PROMPT,
  buildJudgePrompt,
  parseJudgeResponse,
  suggestionDropsFormatting,
} from './ai-sdk-provider/judge.js';
export {
  SOURCE_REVIEW_SYSTEM_PROMPT,
  buildSourceReviewPrompt,
  parseSourceReviewResponse,
  enabledChecks,
} from './ai-sdk-provider/source-review.js';
export type { SourceReviewChecks } from './ai-sdk-provider/source-review.js';
export {
  GLOSSARY_SUGGEST_SYSTEM_PROMPT,
  buildGlossarySuggestPrompt,
  parseGlossarySuggestResponse,
  createGlossarySuggestionMerger,
} from './ai-sdk-provider/glossary-suggest.js';
export type {
  GlossarySuggestItem,
  GlossarySuggestOptions,
  GlossarySuggestion,
  GlossarySuggestResult,
} from './types/glossary-suggest.js';
export type {
  EntryContext,
  EntryContextField,
  EntryContextOptions,
  EntryContextRecord,
  EntryContextSource,
} from './types/entry-context.js';
export { collectEntryContext } from './ai-sdk-provider/entry-context.js';
export { chunkArray } from './chunk.js';
export { batchGroupKey, groupByKey, packGroups, groupAndPack } from './batching/group-and-pack.js';
export type { GroupableEntry } from './batching/group-and-pack.js';
export { resolveBatchGrouping } from './batching/resolve-grouping.js';
export type { ResolvedBatchGrouping } from './batching/resolve-grouping.js';
export { toErrorMessage } from './error-utils.js';
export { acquireRateLimit, reportRateLimitHit, resetRateLimiters } from './rate-limiter.js';
export { acquireConcurrencySlot, resetConcurrencyLimiters } from './concurrency-limiter.js';
export { LANG_NAMES } from './lang.js';
export {
  LENGTH_LIMITS,
  TOO_LONG_ISSUE_TYPE,
  getLengthLimit,
  utf8ByteLength,
  exceedsLengthLimit,
  hasTooLongIssue,
} from './length-limits.js';
export type { LengthLimit } from './length-limits.js';
export {
  resolveAchievementMaxBytes,
  DEFAULT_ACHIEVEMENT_NAME_MAX_BYTES,
  DEFAULT_ACHIEVEMENT_DESCRIPTION_MAX_BYTES,
} from './achievement-budget.js';
export { maskSecret } from './mask.js';
export { escapeRegExp, buildTermBoundaryRegex, termMatchesText } from './term-match.js';
export { debug } from './debug.js';
export { tokenize, computeSimilarityOrder } from './similarity/index.js';
export { isComplete, projectTargetLanguages } from './glossary-completeness.js';

// AI SDK provider exports
export type {
  EndpointType,
  ProviderType,
  AISDKModuleConfig,
  ModuleFactoryConfig,
} from './ai-sdk-provider/types.js';
export type { OllamaFootprint } from './ai-sdk-provider/reasoning-resolvers.js';
export { IncompleteEntryError } from './ai-sdk-provider/types.js';
export {
  createAISDKModule,
  createProviderModule,
  createDefaultModuleLogger,
  splitAndRetry,
  cancelledResult,
  resolveBatchSize,
  toAuthError,
  toRateLimitError,
  rethrowIfAuthOrRateLimit,
  throwIfAllChunksFailed,
  AUTH_401_MESSAGE_RE,
  RATE_LIMIT_MESSAGE_RE,
  unwrapRetryError,
  charCounts,
  runJudgeFeature,
  runSourceReviewFeature,
  attachUsageToFirst,
  validateBaseURL,
  coerceBoolean,
  coerceBooleanDefaultTrue,
  LOOPBACK_HOSTS,
  buildBatchPrompt,
  parseBatchResponse,
  filterGlossaryForSource,
  buildMixedTargetBatchPrompt,
  parseMixedTargetBatchResponse,
  groupJobsByEntry,
  buildProviderOptions,
  createModelForProvider,
  credentialKeyForProvider,
  defaultModelForProvider,
  deriveCostTierFromModel,
  OPENAI_COST_PATTERNS,
  ANTHROPIC_COST_PATTERNS,
  GOOGLE_COST_PATTERNS,
  DEEPSEEK_COST_PATTERNS,
  PROVIDER_COST_PATTERNS,
  GENERIC_API_KEY,
  resolveAnthropicModels,
  resolveOpenAIModels,
  resolveGoogleModels,
  resolveDeepSeekModels,
  resolveGenericModels,
  resolveOpenRouterModels,
  inspectOllamaFootprint,
  isOllamaBaseURL,
  unloadOllamaModel,
  resolveEndpointType,
  unloadLMStudioModel,
  unloadLocalModel,
  ensurePricingFeed,
  lookupBilling,
  renderGlossary,
  renderContext,
  needsEscapeRule,
  buildCategoryPrompt,
  parseCategoryResponse,
  generateCategorySuggestions,
  CATEGORY_CHUNK_SIZE,
  isTransientError,
  isAbortLikeError,
  transientRetryDelayMs,
  sleep,
  retryOnceOnTransient,
  combineAbortSignals,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  GLOSSARY_SUGGEST_CHUNK_SIZE,
  RequestTimeoutError,
  resolveUseStructuredOutput,
  streamChatText,
} from './ai-sdk-provider/index.js';
export type { ChatTurn, StreamChatTextDeps } from './ai-sdk-provider/index.js';
export type {
  CategoryEntryInput,
  CategorySuggestion,
  CategorySuggestionEntry,
  GenerateCategorySuggestionsOptions,
  GenerateCategorySuggestionsResult,
} from './ai-sdk-provider/index.js';
export type { CharCounts } from './ai-sdk-provider/index.js';
export type {
  FeatureGenerateResult,
  FeatureTransport,
  JudgeFeatureDeps,
  SourceReviewFeatureDeps,
  SplitAndRetry,
} from './ai-sdk-provider/index.js';
export { MASK_TOKEN_SOURCE } from './masking/tokens.js';
export {
  CORE_SYSTEM_PROMPT,
  BATCH_SYSTEM_PROMPT,
  ESCAPE_SEQUENCE_RULE,
  REFERENCE_CONTEXT_RULE,
  ACHIEVEMENT_CONTEXT_RULE,
  MASK_TOKEN_RULE,
  needsMaskRule,
  languageLabel,
  renderTargetLanguagesLine,
  GLOSSARY_SEMANTICS_RULE,
  renderLengthLimitRule,
  effectivePromptOptions,
} from './ai-sdk-provider/prompt-builder.js';

export type {
  AiTask,
  ModelConfidenceProfile,
  ConfidenceTier,
  ConfidenceReason,
  ConfidenceReasonCode,
  ConfidenceResult,
  ModelConfidenceContext,
} from './model-confidence/types.js';
export {
  MODEL_CONFIDENCE_PROFILES,
  MODEL_CONFIDENCE_SCHEMA_VERSION,
  MODEL_CONFIDENCE_GENERATED_AT,
  findConfidenceProfile,
} from './model-confidence/profiles.js';
export {
  scoreModelConfidence,
  PROMPT_OVERHEAD_TOKENS,
  BATCH_FALLOFF_EXPONENT,
} from './model-confidence/score.js';
export type { ScoreModelConfidenceInput } from './model-confidence/score.js';

export {
  RECOMMENDED_MODELS,
  isRecommendedModel,
  recommendedModelsFor,
} from './recommended-models.js';
export type { RecommendedProvider } from './recommended-models.js';

export type {
  FreewayWindowKind,
  FreeTierLimit,
  FreeTierModel,
  FreeTierProvider,
  FreeTierSnapshot,
} from './freeway/free-tier-snapshot.js';
export {
  getFreeTierSnapshot,
  freeTierProvider,
  freeTierModel,
} from './freeway/free-tier-snapshot.js';
export { windowStart, nextReset } from './freeway/windows.js';
