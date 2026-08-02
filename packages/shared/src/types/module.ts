import type { Glossary, GlossaryTerm } from './glossary.js';
import type { ReasoningEffort } from './routing.js';
import type { ModelInfo } from './models.js';
import type { LengthLimit } from '../length-limits.js';
import type { SourceReviewFinding, SourceReviewFindingType } from './string-entry.js';
import type { JudgeItem, JudgeVerdict } from './judge.js';
import type {
  GlossarySuggestItem,
  GlossarySuggestOptions,
  GlossarySuggestResult,
} from './glossary-suggest.js';

/**
 * Narrow credential-lookup contract exposed to translation modules.
 *
 * `get(key)` returns the value of the requested credential. Implementations
 * (e.g. the server's CredentialStore) MUST throw `MissingCredentialError`
 * when the credential is unset so modules can surface a typed failure
 * instead of an opaque string error.
 */
export interface CredentialProvider {
  get(key: string): string;
}

export type ModuleCapability = 'translate' | 'glossary-push' | 'batch';

export type CostTier = 'free' | 'low' | 'medium' | 'high';

export type ModuleBatchMode = 'language' | 'entry';

/**
 * Achievement-specific prompt context passed to LLM modules for entries
 * tagged `achievementType` (name or description). `maxBytes` comes from the
 * same `resolveAchievementMaxBytes` budget the M10 `achievement-length-limit`
 * check gates against, so the model is never told a different limit than the
 * one enforced.
 */
export interface AchievementPromptContext {
  type: 'name' | 'description';
  /** Hard UTF-8 byte budget for the translated text (same source as the LQA check). */
  maxBytes: number;
  /** The linked counterpart entry (name↔description), when achievementId pairs one. */
  counterpart?: {
    type: 'name' | 'description';
    sourceText: string;
    /** Counterpart's existing translation in the job's target language (translated/reviewed only). */
    translatedText?: string;
  };
}

/** Narrative / structured metadata passed alongside the translation prompt. */
export interface PromptOptions {
  character?: string;
  tone?: string;
  gender?: string;
  /** Free-form additional notes that the module may embed in its prompt. */
  notes?: string;
  reasoningEffort?: ReasoningEffort;
  achievement?: AchievementPromptContext;
}

export interface TranslationJob {
  entryId: string;
  sourceText: string;
  targetLanguage: string;
  /** Source language code (BCP-47). Useful for NMT APIs that require it explicitly. */
  sourceLanguage?: string;
  context?: string;
  glossary?: GlossaryTerm[];
  glossaryId?: string;
  promptOptions?: PromptOptions;
  /**
   * Existing translation of the same source into another language, passed to
   * LLM modules as prompt context. Non-LLM modules ignore it.
   */
  reference?: { language: string; text: string };
  /**
   * Existing source → translation pairs in the job's target language,
   * demonstrating the desired style/pattern ("translate these the way I
   * translated those"). Attached by M9 when the run was started with
   * exampleEntryIds; rendered as few-shot prompt context by LLM modules.
   * Non-LLM modules ignore it.
   */
  examples?: Array<{ sourceText: string; translatedText: string }>;
  /**
   * Hard output length limit for the target language (see length-limits.ts).
   * Set by M9 when the entry's previous translation was flagged `too-long`,
   * so LLM modules embed an explicit "stay within this budget" instruction.
   * Non-LLM modules ignore it.
   */
  lengthLimit?: LengthLimit;
  /**
   * Engine-authored task instruction rendered as a trusted `Task:` line in the
   * user prompt (same-language, mixed-target, and copilot builders) when every
   * job of a provider call carries the identical value; ignored otherwise.
   * MUST never carry user-, import-, or model-authored free text directly —
   * embed such data JSON-stringified inside an engine-owned template (M30's
   * edit-transfer instruction is the canonical use).
   */
  taskInstruction?: string;
}

/**
 * Provider-reported billing figures shared by {@link TranslationUsage} (the
 * per-call estimate a module returns) and `RunUsageEntry` (the per-(module,
 * model) aggregation persisted on a run). Defined once so the field meanings
 * stay in sync; all figures are optional because providers report subsets.
 */
export interface ProviderUsageBilling {
  /** Model id the usage applies to (enables pricing lookups downstream). */
  model?: string;
  /** Input (prompt) tokens billed by the provider, when reported. */
  inputTokens?: number;
  /** Output (completion) tokens billed by the provider, when reported. */
  outputTokens?: number;
  /**
   * Reasoning ("thinking") tokens, a SUBSET of `outputTokens` already counted
   * within it. Reported by thinking models (e.g. Gemini 2.5) and never appear
   * as response text — which is why output tokens can dwarf output characters.
   */
  reasoningTokens?: number;
  /** Billed characters for character-priced providers (e.g. DeepL). */
  characters?: number;
  /**
   * Input tokens read from the provider's prompt cache (a SUBSET of
   * `inputTokens`, never additional tokens on top of it), when reported.
   * Billed at `ModelBilling.cachedInputCostPerMillion` when known, else at the
   * standard input rate — see M9/usage-pricing.ts's `costFromTokens`.
   */
  cachedInputTokens?: number;
  /**
   * Input tokens newly written to the provider's prompt cache (a SUBSET of
   * `inputTokens`), when reported. Mutually exclusive with `cachedInputTokens`
   * on any single call — a call either creates a cache entry or reads one,
   * never both. Billed at `ModelBilling.cacheWriteCostPerMillion` when known,
   * else at the standard input rate.
   */
  cacheWriteTokens?: number;
}

/**
 * Provider-reported usage for a translation call.
 *
 * Attribution: when one provider call covers several jobs, the module attaches
 * the call's TOTAL usage to the FIRST result of that call and leaves the other
 * results without `usage`. Consumers must therefore SUM usage across results
 * (never treat it as per-entry); per-(module, model) aggregation is unaffected
 * by which result carries the figures.
 */
export interface TranslationUsage extends ProviderUsageBilling {
  /**
   * Character accounting for the call, summed like tokens (the batch total
   * rides on the FIRST result). These power the per-run details view in the
   * Activity tab and are distinct from `characters` (provider-billed):
   * - `promptChars`   — full request text sent (system + user prompt, i.e.
   *   everything: instructions, context, format scaffolding, glossary).
   * - `sourceChars`   — just the source texts within that request.
   * - `responseChars` — full raw response text received.
   * - `outputChars`   — just the parsed/used translation strings.
   * Non-LLM providers (no prompt) approximate `promptChars`≈`sourceChars` and
   * `responseChars`≈`outputChars`.
   */
  promptChars?: number;
  sourceChars?: number;
  responseChars?: number;
  outputChars?: number;
}

export interface TranslationResult {
  entryId: string;
  targetLanguage: string;
  translatedText: string;
  /** Raw backend response (for debugging / audit). Modules must redact secrets. */
  rawResponse?: unknown;
  /** Resolved glossary ID used for this translation (e.g. remote DeepL glossary). */
  usedGlossaryId?: string;
  /** Module-reported usage estimate for the provider call (see TranslationUsage). */
  usage?: TranslationUsage;
  error?: string;
}

/** One source entry submitted for a source-language AI review. */
export interface SourceReviewItem {
  /** Index within the batch (echoed back by the model). */
  i: number;
  /** Source text to review (never translated). */
  s: string;
  /** Optional context note for the entry. */
  ctx?: string;
  /** The entry this item belongs to; carried through to the result. */
  entryId: string;
}

/** Per-item result of a source-language AI review. */
export interface SourceReviewItemResult {
  entryId: string;
  findings: SourceReviewFinding[];
  /**
   * Optional unified corrected source for the whole item — the exact replacement
   * value only, no commentary. Absent when the source is clean.
   */
  suggestion?: string;
  /** Per-call usage attached to the FIRST result of each provider call (see TranslationUsage). */
  usage?: TranslationUsage;
  /**
   * Set instead of findings when the review call failed for this item (API
   * error or unparseable response). Lets the engine record a failure rather
   * than persisting an empty "clean" review.
   */
  error?: string;
}

/** Options for a source-language AI review call. */
export interface SourceReviewOptions {
  /** Which finding categories to ask for; only enabled ones are requested/kept. */
  checks: Partial<Record<SourceReviewFindingType, boolean>>;
  /**
   * Optional language code (from `LANGUAGE_REGISTRY`) the AI should write its
   * natural-language finding `detail` text in. Omitted/English/unknown → the
   * model's default (English). Review/flagging logic is unaffected.
   */
  responseLanguage?: string;
  /**
   * Optional source-language code; when set the prompt states it so grammar/
   * typo review is grounded for non-English projects. Registry-known codes
   * render as "Spanish (es)", unknown codes as-is.
   */
  sourceLanguage?: string;
}

/**
 * Optional dispatch controls shared by the batched provider methods
 * (`translate`, `judgeTranslations`, `reviewSource`).
 */
export interface BatchDispatchOptions {
  /**
   * When `true`, the provider sends the whole input as a SINGLE call instead of
   * re-chunking it at `maxBatchSize`. Engines set this when the user enables
   * "ignore batch size limit", so a pre-grouped related-entry batch reaches the
   * model intact. Failure-splitting still recovers if that one large call fails
   * to parse. Non-LLM / independent modules may ignore this flag.
   */
  ignoreSizeLimit?: boolean;
  /**
   * Optional per-job progress hook: invoked with each `TranslationResult` as
   * soon as it is known — including mid-batch, when a failed dispatch batch is
   * internally split into smaller retries (per-language, then per-job). Lets
   * a caller (e.g. M9) report progress per translation instead of waiting for
   * the whole `translate()` call to resolve. A module that doesn't call it is
   * unaffected: the caller still gets the complete result array from the
   * resolved promise, exactly as before this option existed.
   */
  onJobComplete?: (result: TranslationResult) => void | Promise<void>;
}

export interface TranslationModule {
  id: string;
  name: string;
  version: string;
  capabilities: ModuleCapability[];
  costTier: CostTier;
  configSchema: Record<string, unknown>;
  translate(
    jobs: TranslationJob[],
    signal?: AbortSignal,
    options?: BatchDispatchOptions,
  ): Promise<TranslationResult[]>;
  pushGlossary?(
    glossary: Glossary,
    sourceLanguage?: string,
    opts?: { replace?: boolean },
  ): Promise<void>;
  destroy?(): Promise<void>;
  /**
   * Optional session-reuse retry: re-attempts a gate-failed translation with a
   * corrective follow-up on the same conversation session.
   *
   * `previousAttempt` MUST be the first pass in the SAME masked form the module
   * sees for `job.sourceText` — i.e. the raw module output BEFORE mask-restore
   * and constant-glossary substitution, not the caller's restored/unmasked text.
   * The retry replays it as the assistant turn against a prompt built from the
   * MASKED `job.sourceText`; handing back restored text makes the conversation
   * self-inconsistent (assistant answered a different, unmasked prompt), so the
   * model answers unmasked too — tripping mask-integrity verification and
   * bypassing the constant-glossary restore. Callers (M9) pass `translatedMasked`.
   */
  retryWithFeedback?(
    job: TranslationJob,
    previousAttempt: string,
    feedbackMessage: string,
    signal?: AbortSignal,
  ): Promise<TranslationResult>;
  /**
   * Optional LLM-as-judge review of restored translations (report-only).
   * Provided by the shared AI SDK layer; absent on non-LLM modules.
   */
  judgeTranslations?(
    items: JudgeItem[],
    signal?: AbortSignal,
    options?: BatchDispatchOptions,
  ): Promise<JudgeVerdict[]>;
  /**
   * Optional source-language AI review of the source text itself (report-only,
   * never translates). Provided by the shared AI SDK layer; absent on non-LLM
   * modules. Returns one result per input item.
   */
  reviewSource?(
    items: SourceReviewItem[],
    opts: SourceReviewOptions,
    signal?: AbortSignal,
    options?: BatchDispatchOptions,
  ): Promise<SourceReviewItemResult[]>;
  /**
   * Optional AI glossary suggestion: groups recurring custom terms and proper
   * nouns from the source texts into suggested glossaries. Report-only (never
   * translates). Provided by the shared AI SDK layer; absent on non-LLM modules.
   * Returns the suggestions plus the module's per-call usage (for billing).
   */
  suggestGlossaries?(
    items: GlossarySuggestItem[],
    opts: GlossarySuggestOptions,
    signal?: AbortSignal,
  ): Promise<GlossarySuggestResult>;
  /**
   * Optional liveness check. Resolves with ok=true when the provider is
   * reachable and responding. Callers should treat absence of this method as
   * "health check not supported" rather than an error.
   */
  healthCheck?(): Promise<{ ok: boolean; latencyMs?: number }>;
  /**
   * Optional dynamic model list. When present, the UI replaces the static
   * `suggestions`/`enum` model field with a live-populated selector.
   * Implementations must proxy provider API calls through their
   * CredentialProvider so no secrets leak to the client.
   */
  listModels?(): Promise<ModelInfo[]>;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  /** Relative path to the module entry file (resolved against the manifest directory). */
  entry: string;
  capabilities: ModuleCapability[];
  costTier: CostTier;
  configSchema: Record<string, unknown>;
  requiredEnvVars?: string[];
  /**
   * Whether named instances (`<base>:<slug>` copies) may be created for this
   * module. Absent is treated as `true`; set `false` to opt a module out (e.g.
   * deepl, whose glossary push is per-account and not instance-safe).
   */
  instanceable?: boolean;
  /**
   * Whether this module must be EXCLUDED when the server runs in multi-tenant
   * cloud mode (`isCloudMode()`). Absent/`false` = loaded everywhere. Set `true`
   * for a module that cannot safely share the single cloud process across
   * tenants — e.g. copilot, whose bundled CLI keeps one process-global
   * `COPILOT_HOME` (session/cache state + a keytar plaintext-token fallback on a
   * headless host) that would bleed between tenants. The local single-user app
   * loads it normally.
   */
  cloudDisabled?: boolean;
}

/**
 * Per-field config schema entry. Modules declare these inside their
 * `configSchema` map; the UI uses them to render the correct control.
 *
 * `suggestions` enables a select-or-type combobox (used by Copilot's `model`).
 */
export interface ConfigSchemaField {
  type?: 'string' | 'boolean';
  format?: 'password' | 'text';
  enum?: string[];
  suggestions?: Array<string | { label: string; value: string }>;
  default?: unknown;
  description?: string;
  /**
   * When true, the field is visible only in per-project settings and is
   * hidden from the global module config panel.
   */
  projectOnly?: boolean;
}
