import { generateText } from 'ai';
import type { LanguageModel } from 'ai';

/**
 * Default per-request output-token cap. 0 means "unlimited": the resolved
 * value is omitted from the generateText() call entirely (see
 * {@link resolveMaxOutputTokens}) so each provider falls back to its own
 * (typically model-specific) maximum instead of truncating a large
 * structured-output response — e.g. a category-classifier response listing
 * many entry ids — at an arbitrary ceiling. Override via
 * AISDKModuleConfig.maxOutputTokens (or the workspace-wide global-config
 * `maxOutputTokens` setting, which is injected into every module config) to
 * impose a smaller cap.
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 0;
/**
 * Default max items per provider call for glossary suggestion when batching is
 * enabled (overridable downward by a module's `maxBatchSize`). Exported so the
 * generation UI can pre-estimate how many batches a run will produce without
 * re-hardcoding the size. Glossary progress advances per batch of this many
 * distinct source strings.
 */
export const GLOSSARY_SUGGEST_CHUNK_SIZE = 60;
import {
  buildBatchPrompt,
  parseBatchResponse,
  buildMixedTargetBatchPrompt,
  parseMixedTargetBatchResponse,
  extractJsonPayload,
  TRANSLATION_RESPONSE_SCHEMA,
  MIXED_TARGET_RESPONSE_SCHEMA,
} from './prompt-builder.js';
import { buildProviderOptions } from './provider-options.js';
import { attachUsageToFirst } from './llm-module.js';
import { createFeatureMethods, type AISDKModuleContext } from './module-features.js';
import {
  createModelForProvider,
  credentialKeyForProvider,
  defaultModelForProvider,
  deriveCostTierFromModel,
  resolveUseStructuredOutput,
  GENERIC_API_KEY,
  PROVIDER_COST_PATTERNS,
} from './model-factory.js';
import { validateBaseURL } from './config-coerce.js';
import {
  chunkArray,
  toErrorMessage,
  MissingCredentialError,
  RateLimitError,
  AuthError,
  acquireRateLimit,
  acquireConcurrencySlot,
  reportRateLimitHit,
} from '../index.js';
import type {
  TranslationModule,
  TranslationJob,
  TranslationResult,
  TranslationUsage,
  ModuleManifest,
  BatchDispatchOptions,
} from '../types/module.js';
import {
  IncompleteEntryError,
  type AISDKModuleConfig,
  type ProviderType,
  type ModuleFactoryConfig,
} from './types.js';
import {
  isTransientError,
  sleep,
  transientRetryDelayMs,
  combineAbortSignals,
  RequestTimeoutError,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from './transient.js';

export type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]['providerOptions']>;

/**
 * Resolves the effective maxOutputTokens for a generateText() call from a
 * per-call override, falling back to {@link DEFAULT_MAX_OUTPUT_TOKENS}.
 * generateText() rejects a literal 0 (must be a positive integer or absent),
 * so the 0 ("unlimited") sentinel maps to `undefined` here — the caller
 * spreads it in conditionally, omitting the field so the provider applies
 * its own maximum.
 */
function resolveMaxOutputTokens(override: number | undefined): number | undefined {
  const resolved = override ?? DEFAULT_MAX_OUTPUT_TOKENS;
  return resolved > 0 ? resolved : undefined;
}

type ErrorWithHeaders = {
  responseHeaders?: Record<string, string | number | undefined>;
  response?: {
    status?: number | string;
    headers?: Record<string, string | number | undefined>;
  };
  headers?: Record<string, string | number | undefined>;
  status?: number | string;
  statusCode?: number | string;
  name?: unknown;
  stack?: unknown;
};

function normalizeHeaders(
  headers?: Record<string, string | number | undefined>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!headers) return normalized;
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    normalized[key.toLowerCase()] = String(value);
  }
  return normalized;
}

// Helper: extract safe provider diagnostics from an unknown error without leaking secrets.
// Exported so the standalone category-classifier (which doesn't use the
// createAISDKModule closure) can enrich its failure logs with the same
// provider-status/request-id/retry-after/stack-top breadcrumbs.
export function extractSafeErrorMetadata(err: unknown): Record<string, unknown> {
  if (typeof err !== 'object' || err === null) return {};
  const asRecord = err as ErrorWithHeaders;
  // Merge the candidate header locations into one map. normalizeHeaders
  // lowercases keys (deduping case variants); later spreads win, so the
  // precedence is responseHeaders > response.headers > headers.
  const headers = {
    ...normalizeHeaders(asRecord.headers),
    ...normalizeHeaders(asRecord.response?.headers),
    ...normalizeHeaders(asRecord.responseHeaders),
  };

  const retryAfter =
    headers['retry-after'] ?? headers['x-ratelimit-reset-requests'] ?? headers['x-ratelimit-reset'];
  const providerRequestId =
    headers['x-request-id'] ??
    headers['request-id'] ??
    headers['anthropic-request-id'] ??
    headers['openai-request-id'];
  const providerStatus = asRecord.status ?? asRecord.statusCode ?? asRecord.response?.status;
  const stackTopRaw =
    typeof asRecord.stack === 'string' && asRecord.stack.length > 0
      ? asRecord.stack.split('\n')[0]?.trim()
      : undefined;

  const meta: Record<string, unknown> = {};
  if (typeof asRecord.name === 'string' && asRecord.name.length > 0) meta.errorName = asRecord.name;
  if (providerStatus !== undefined) meta.providerStatus = providerStatus;
  if (providerRequestId !== undefined) meta.providerRequestId = providerRequestId;
  if (retryAfter !== undefined) meta.retryAfter = retryAfter;
  if (stackTopRaw) meta.stackTop = toErrorMessage(stackTopRaw);

  return meta;
}

/**
 * Parses a Retry-After-style header value into milliseconds. Accepts plain
 * seconds ("30"), Go/OpenAI-style durations ("250ms", "1m30s"), and HTTP
 * dates. Returns undefined for anything unparsable.
 * @internal exported for unit-testing
 */
export function parseRetryAfterMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.ceil(parseFloat(v) * 1000);
  const ms = v.match(/^(\d+(?:\.\d+)?)ms$/i);
  if (ms) return Math.ceil(parseFloat(ms[1]));
  const dur = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
  if (dur && (dur[1] !== undefined || dur[2] !== undefined || dur[3] !== undefined)) {
    const hours = Number(dur[1] ?? 0);
    const minutes = Number(dur[2] ?? 0);
    const seconds = parseFloat(dur[3] ?? '0');
    return Math.ceil((hours * 3600 + minutes * 60 + seconds) * 1000);
  }
  const date = Date.parse(v);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

/**
 * Message vocabulary that signals an HTTP 429 when no structured status is
 * available. Beyond the literal 429/"rate limit" phrasings, providers surface
 * the condition as quota language: Google returns "You exceeded your current
 * quota" / "Quota exceeded for metric ..." (gRPC RESOURCE_EXHAUSTED) with no
 * "rate limit" wording at all — those free-tier 429s went unclassified and
 * skipped every Retry-After cool-down until this vocabulary covered them.
 * Mirrored by the engine's `isRateLimitError` in M9/errors.ts (single source
 * of truth, imported there).
 */
export const RATE_LIMIT_MESSAGE_RE =
  /\b429\b|rate.?limit|too.?many.?requests|resource[\s_-]?exhausted|quota\s+exceeded|exceeded\s+your[\s\w]*\s+quota/i;

/**
 * The AI SDK's internal retry loop (generateText maxRetries) wraps the final
 * provider failure in an `AI_RetryError` whose own shape carries no HTTP
 * status or headers — the real 429/401 (an AI_APICallError with statusCode +
 * responseHeaders) sits in `lastError` / `errors`. Unwrap it so the
 * classifiers below inspect the provider error itself; any other error is
 * returned unchanged.
 * @internal exported for unit-testing
 */
export function unwrapRetryError(err: unknown): unknown {
  if (err === null || typeof err !== 'object') return err;
  const rec = err as { name?: unknown; lastError?: unknown; errors?: unknown };
  if (rec.name !== 'AI_RetryError' && rec.name !== 'RetryError') return err;
  if (rec.lastError !== null && typeof rec.lastError === 'object') return rec.lastError;
  if (Array.isArray(rec.errors) && rec.errors.length > 0) return rec.errors[rec.errors.length - 1];
  return err;
}

/**
 * Google (Gemini) puts the 429 cool-down in the message body ("Please retry
 * in 43.121803681s.") rather than a Retry-After header. Parsed as a fallback
 * when no header-derived delay is available.
 * @internal exported for unit-testing
 */
export function parseRetryDelayFromMessage(message: string): number | undefined {
  const m = message.match(/retry(?:ing)?\s+(?:in|after)\s+(\d+(?:\.\d+)?)\s*s(?:econds?)?\b/i);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : undefined;
}

/**
 * Recasts a provider error as a shared RateLimitError (carrying the parsed
 * Retry-After delay) when it is a 429/rate-limit failure, so M9's retry loop
 * can honor the provider cool-down. Returns undefined for other errors.
 * Unwraps the AI SDK's AI_RetryError envelope first — the status/headers live
 * on the wrapped provider error — and falls back to the in-message cool-down
 * ("Please retry in Ns") when no Retry-After header is present.
 * @internal exported for unit-testing
 */
export function toRateLimitError(err: unknown): RateLimitError | undefined {
  if (err instanceof RateLimitError) return err;
  const cause = unwrapRetryError(err);
  const meta = extractSafeErrorMetadata(cause);
  // The OUTER message ("Failed after 3 attempts. Last error: ...") embeds the
  // inner one, so a single test on it covers both wrapped and bare errors.
  const message = toErrorMessage(err);
  const is429 = String(meta.providerStatus) === '429' || RATE_LIMIT_MESSAGE_RE.test(message);
  if (!is429) return undefined;
  const retryAfterMs =
    parseRetryAfterMs(typeof meta.retryAfter === 'string' ? meta.retryAfter : undefined) ??
    parseRetryDelayFromMessage(message);
  return new RateLimitError(message, retryAfterMs);
}

/**
 * Message patterns that signal an HTTP 401 (invalid/missing credential) when no
 * structured status is available — common provider phrasings ("Unauthorized",
 * OpenAI's "Incorrect API key provided", Anthropic's "authentication_error",
 * DeepL's "Authorization failed"). The qualifier before key/token/credential
 * keeps it from matching benign mentions of "key"/"token". Mirrored by the
 * engine's `isAuthError` in M9/errors.ts.
 */
export const AUTH_401_MESSAGE_RE =
  /\b401\b|unauthorized|authentication[\s_-]*(?:error|failed|required)|authoriz(?:ation|ed)[\s_-]*(?:error|failed)|(?:invalid|incorrect|expired|revoked|missing|bad)[\s_-]*(?:(?:x-)?api[\s_-]*key|access[\s_-]*key|api[\s_-]*token|token|credential|key\b)/i;

/**
 * Recasts a provider error as a shared AuthError when it is a 401 (invalid
 * credential) or 403 (forbidden) failure. Auth failures are not retryable and
 * affect every job using the credential, so the engine cancels the whole run
 * rather than letting each entry fail in turn. Detection uses the provider's
 * HTTP status when available and falls back to the error message text.
 * Returns undefined for other errors.
 * @internal exported for unit-testing
 */
export function toAuthError(err: unknown): AuthError | undefined {
  if (err instanceof AuthError) return err;
  // Same AI_RetryError unwrap as toRateLimitError: a 401/403 that exhausted
  // the SDK's internal retries hides its status on the wrapped error.
  const meta = extractSafeErrorMetadata(unwrapRetryError(err));
  const status = String(meta.providerStatus ?? '');
  const message = toErrorMessage(err);
  const is403 = status === '403' || /\b403\b|forbidden|permission[\s_-]*denied/i.test(message);
  const is401 = status === '401' || AUTH_401_MESSAGE_RE.test(message);
  if (!is401 && !is403) return undefined;
  return new AuthError(message, is403 && !is401 ? 403 : 401);
}

/**
 * If `err` is a rate-limit (429) or auth (401/403) failure, recast it to the
 * shared typed error and rethrow so the engine can honor the cool-down or cancel
 * the run; otherwise return so the caller can flatten it to a per-entry error.
 * Rate-limit is checked before auth (a 429 carries the Retry-After the engine
 * needs, and never co-occurs with a 401/403 on the same response), mirroring the
 * inline rethrow order each feature path used before.
 * @internal exported for unit-testing
 */
export function rethrowIfAuthOrRateLimit(err: unknown): void {
  const rateLimit = toRateLimitError(err);
  if (rateLimit) throw rateLimit;
  const authErr = toAuthError(err);
  if (authErr) throw authErr;
}

/**
 * Convert the AI SDK `usage` block of a generateText call into a
 * TranslationUsage. Returns `undefined` unless at least one token count is a
 * finite number, so results without provider-reported usage stay unchanged.
 *
 * Usage attribution: callers attach this (per-call TOTAL) usage to the FIRST
 * result of the call — see the TranslationUsage doc in types/module.ts.
 */
export type TokenUsageInput =
  | {
      inputTokens?: number;
      outputTokens?: number;
      reasoningTokens?: number;
      outputTokenDetails?: { reasoningTokens?: number };
      inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number };
    }
  | undefined;

export function toTranslationUsage(
  usage: TokenUsageInput,
  modelId: string,
  chars?: CharCounts,
): TranslationUsage | undefined {
  const inputTokens = Number.isFinite(usage?.inputTokens) ? usage?.inputTokens : undefined;
  const outputTokens = Number.isFinite(usage?.outputTokens) ? usage?.outputTokens : undefined;
  // Reasoning ("thinking") tokens are a subset of outputTokens. AI SDK v6
  // reports them under outputTokenDetails; fall back to the deprecated flat
  // field for older shapes.
  const rawReasoning = usage?.outputTokenDetails?.reasoningTokens ?? usage?.reasoningTokens;
  const reasoningTokens = Number.isFinite(rawReasoning) ? rawReasoning : undefined;
  // Cache token breakdown (ai@7's standardized shape) — live-verified 2026-07-06
  // to be populated by all 4 AI SDK provider adapters once caching engages (see
  // scripts/probe-cache-usage.ts). Both are subsets of inputTokens.
  const rawCacheRead = usage?.inputTokenDetails?.cacheReadTokens;
  const cachedInputTokens = Number.isFinite(rawCacheRead) ? rawCacheRead : undefined;
  const rawCacheWrite = usage?.inputTokenDetails?.cacheWriteTokens;
  const cacheWriteTokens = Number.isFinite(rawCacheWrite) ? rawCacheWrite : undefined;
  if (inputTokens === undefined && outputTokens === undefined && chars === undefined) {
    return undefined;
  }
  return {
    inputTokens,
    outputTokens,
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
    ...(cachedInputTokens !== undefined ? { cachedInputTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
    model: modelId,
    ...chars,
  };
}

export interface CharCounts {
  promptChars: number;
  sourceChars: number;
  responseChars: number;
  outputChars: number;
}

/**
 * Character accounting for one provider call, feeding the per-run details view.
 * `prompt` is the full request text actually sent (instructions + context +
 * format + glossary); `outputs` are the parsed/used translation strings.
 * Exported so other module packages (e.g. copilot) can reuse the same accounting
 * instead of re-deriving it.
 */
export function charCounts(
  prompt: string,
  jobs: TranslationJob[],
  responseText: string,
  outputs: Array<string | undefined>,
): CharCounts {
  return {
    promptChars: prompt.length,
    sourceChars: jobs.reduce((n, j) => n + j.sourceText.length, 0),
    responseChars: responseText.length,
    outputChars: outputs.reduce((n: number, s) => n + (s?.length ?? 0), 0),
  };
}

/**
 * The result shape every provider reports for a job whose run was cancelled
 * before (or instead of) issuing the provider call: empty translation plus the
 * `'cancelled'` error sentinel the engine recognizes. Centralized so the inline
 * cancellation sites (and the deepl module) can never drift on the shape.
 */
export function cancelledResult(
  job: Pick<TranslationJob, 'entryId' | 'targetLanguage'>,
): TranslationResult {
  return {
    entryId: job.entryId,
    targetLanguage: job.targetLanguage,
    translatedText: '',
    error: 'cancelled',
  };
}

/**
 * The per-feature batch size: when `ignoreSizeLimit` is set the whole list runs
 * as a single batch (`Math.max(itemCount, 1)`, so an empty list still yields a
 * positive size); otherwise the configured value is used, falling back to
 * `opts.default` and capped at `opts.cap` (the judge/review methods cap the
 * user's value, translate does not — pass no `cap` to leave it uncapped).
 * Centralized so the cap/default can't drift between the translate/judge/review
 * call sites.
 */
export function resolveBatchSize(
  itemCount: number,
  ignoreSizeLimit: boolean,
  configured: number | undefined,
  opts: { default: number; cap?: number },
): number {
  if (ignoreSizeLimit) return Math.max(itemCount, 1);
  // `configured` may be a malformed persisted value (0 or NaN, e.g. from a
  // corrupted/hand-edited module config) — `?? opts.default` only substitutes
  // for `undefined`, letting 0/NaN straight through to `chunkArray`, where a
  // non-positive/NaN chunk size throws a RangeError and fails the whole run.
  // Treat any non-finite `configured` (including NaN) the same as `undefined`
  // (fall back to opts.default, still subject to the cap below); a finite but
  // non-positive value (0) is floored to 1 by the outer Math.max.
  const base = Number.isFinite(configured) ? (configured as number) : opts.default;
  return Math.max(1, Math.min(base, opts.cap ?? Infinity));
}

/**
 * Generic "parse-or-recursively-halve-to-singleton" batch handler shared by the
 * report-only judge and source-review paths. Runs `runOnce(batch)`; on a parse
 * failure (null) it halves the batch and retries each half, since smaller
 * batches truncate/mis-count less often. A singleton that still won't parse, or
 * a thrown API/transport error, becomes per-item error results via `makeErrors`
 * — so one bad batch never aborts the whole run. Honors `signal` up front.
 */
export async function splitAndRetry<TItem, TResult>(
  batch: TItem[],
  runOnce: (batch: TItem[]) => Promise<TResult[] | null>,
  makeErrors: (batch: TItem[], message: string) => TResult[],
  log: (level: 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => void,
  logPrefix: string,
  parseFailMessage: string,
  signal?: AbortSignal,
  retryTransient = false,
): Promise<TResult[]> {
  if (signal?.aborted) return makeErrors(batch, 'cancelled');
  let parsed: TResult[] | null;
  try {
    parsed = await runOnce(batch);
  } catch (err) {
    log('warn', `${logPrefix}:error`, {
      error: toErrorMessage(err),
      count: batch.length,
      ...extractSafeErrorMetadata(err),
    });
    if (signal?.aborted) return makeErrors(batch, 'cancelled');
    if (!retryTransient || !isTransientError(err)) {
      return makeErrors(batch, toErrorMessage(err));
    }
    // Transient: retry ONCE at the same size, then split smaller and recurse.
    await sleep(transientRetryDelayMs(err, 0));
    try {
      parsed = await runOnce(batch);
    } catch (err2) {
      if (signal?.aborted) return makeErrors(batch, 'cancelled');
      if (isTransientError(err2) && batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        log('warn', `${logPrefix}:transient-splitting`, { count: batch.length });
        const left = await splitAndRetry(
          batch.slice(0, mid),
          runOnce,
          makeErrors,
          log,
          logPrefix,
          parseFailMessage,
          signal,
          retryTransient,
        );
        const right = await splitAndRetry(
          batch.slice(mid),
          runOnce,
          makeErrors,
          log,
          logPrefix,
          parseFailMessage,
          signal,
          retryTransient,
        );
        return [...left, ...right];
      }
      return makeErrors(batch, toErrorMessage(err2));
    }
    // retry succeeded — fall through to the parse-or-split handling below.
  }
  if (parsed) return parsed;
  if (batch.length === 1) return makeErrors(batch, parseFailMessage);
  const mid = Math.ceil(batch.length / 2);
  log('warn', `${logPrefix}:splitting`, { count: batch.length });
  const left = await splitAndRetry(
    batch.slice(0, mid),
    runOnce,
    makeErrors,
    log,
    logPrefix,
    parseFailMessage,
    signal,
    retryTransient,
  );
  const right = await splitAndRetry(
    batch.slice(mid),
    runOnce,
    makeErrors,
    log,
    logPrefix,
    parseFailMessage,
    signal,
    retryTransient,
  );
  return [...left, ...right];
}

/**
 * One bare provider call with the layer's standard request shape — default
 * maxOutputTokens cap, abort signal, and the (already-resolved) provider-options
 * spread — WITHOUT the concurrency/rate-limit gate or schema binding the
 * `createAISDKModule` closure adds. For the standalone category-classifier, which
 * resolves its own model/key instead of using the closure; it owns the
 * maxOutputTokens-default + abortSignal + providerOptions-spread shape so it
 * lives in one place.
 */
export function runGenerateTextOnce(
  model: LanguageModel,
  body: { system?: string; prompt: string },
  opts: {
    maxOutputTokens?: number;
    // Accepts the loose shape `buildProviderOptions` returns; cast to the AI SDK
    // type internally, mirroring the closure's `providerOptionsSpread`.
    providerOptions?: Record<string, unknown>;
    signal?: AbortSignal;
    /**
     * AI SDK's own internal retry count for this call (default 2, i.e. 3
     * attempts). Absent leaves the SDK default untouched; mirrors the
     * `createAISDKModule` closure's identical `config.maxRetries` passthrough
     * (core.ts's `runGenerateText`) — set explicitly by a caller that owns
     * retry policy itself (e.g. a Freeway dispatch, which sets 0 so a
     * dead-bucket failure surfaces on the first attempt instead of being
     * burned on internal retries the engine's own failover already supersedes).
     */
    maxRetries?: number;
  },
): ReturnType<typeof generateText> {
  const maxOutputTokens = resolveMaxOutputTokens(opts.maxOutputTokens);
  return generateText({
    model,
    ...body,
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(opts.maxRetries !== undefined ? { maxRetries: opts.maxRetries } : {}),
    abortSignal: opts.signal,
    ...(opts.providerOptions ? { providerOptions: opts.providerOptions as ProviderOptions } : {}),
  });
}

/**
 * The "every chunk's provider call failed" rethrow guard shared by the
 * per-chunk loops in `suggestGlossaries` and `generateCategorySuggestions`. When
 * a run was NOT cancelled and at least one chunk threw but none succeeded, the
 * empty result is a transport/auth/network failure — not a genuine "nothing
 * found" — so the original error is rethrown for the caller to surface instead of
 * returning an empty list. A no-op otherwise.
 */
export function throwIfAllChunksFailed(
  anyRequestSucceeded: boolean,
  lastError: unknown,
  signal: AbortSignal | undefined,
): void {
  if (!anyRequestSucceeded && lastError !== undefined && !signal?.aborted) {
    // Wrap the rethrow through the shared redactor so a raw provider error
    // (e.g. an HTTP 400/transport error carrying a key fragment in its message)
    // can never escape to the caller's persisted run error / SSE log verbatim.
    // The auth/429 recasting paths are upstream of this guard and unaffected.
    throw new Error(toErrorMessage(lastError));
  }
}

/**
 * Structured log sink shared by the AI SDK provider layer and the module
 * factories: `(level, message, meta?) => void`. Matches `AISDKModuleConfig.log`.
 */
type ModuleLogger = (
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) => void;

/**
 * The default `console`-backed logger used when a module is constructed without
 * an injected `log`. Routes `info` to `console.log` and `warn`/`error` to the
 * matching console method, passing `meta ?? ''` so an absent metadata object
 * doesn't print `undefined`. Shared by `createAISDKModule` and the generic-ai
 * factory so the fallback stays byte-identical between them.
 */
export function createDefaultModuleLogger(): ModuleLogger {
  return (lvl, msg, meta) => console[lvl === 'info' ? 'log' : lvl](msg, meta ?? '');
}

/**
 * Whether the global RPS limit applies to this module. generic-ai is opt-in
 * via its `rateLimitEnabled` config (local endpoints don't need throttling);
 * every other provider is limited whenever a global RPS value is set.
 * @internal exported for unit-testing
 */
export function rateLimitApplies(
  manifestId: string,
  rateLimitEnabled: boolean | undefined,
): boolean {
  return manifestId === 'generic-ai' ? rateLimitEnabled === true : true;
}

/**
 * Thin factory for the first-party LLM provider modules (openai, anthropic,
 * google, deepseek): looks the provider's cost-pattern table up in
 * {@link PROVIDER_COST_PATTERNS} and delegates to {@link createAISDKModule}. Lets
 * each provider's `index.ts` collapse to a single line instead of re-declaring
 * the same `createAISDKModule({ ...config, provider, manifest, costPatterns })`
 * body (and, for deepseek, an inline cost table).
 */
export function createProviderModule(
  provider: ProviderType,
  manifest: ModuleManifest,
  config: ModuleFactoryConfig = {},
): TranslationModule {
  return createAISDKModule({
    ...config,
    provider,
    manifest,
    costPatterns: PROVIDER_COST_PATTERNS[provider],
  });
}

/**
 * The exact messages a malformed batch response is thrown (and recorded
 * per-result) with, plus the predicate the server's Freeway dispatch uses to
 * tell a format-shaped batch failure (split and retry on the same bucket)
 * from a bucket-shaped one (cool and fail over) — one definition so the
 * producer and that consumer cannot drift on the strings.
 */
export const PARSE_FAILURE_MESSAGE = 'parseBatchResponse: malformed JSON from provider';
export const MIXED_PARSE_FAILURE_MESSAGE =
  'parseMixedTargetBatchResponse: malformed JSON from provider';

export function isParseFailureMessage(message: string): boolean {
  // Substring match on the phrase every producer shares: core.ts prefixes it
  // with the parser name, while the copilot module (its own SDK client, not
  // this file) records it bare — both must classify as format-shaped.
  return message.includes('malformed JSON from provider');
}

export function createAISDKModule(config: AISDKModuleConfig): TranslationModule {
  const { provider, manifest, credentials } = config;
  const log = config.log ?? createDefaultModuleLogger();

  // Constrain each feature's reply via the provider's native structured-output
  // mechanism (openai/deepseek JSON mode, google responseSchema, openai-compatible
  // json_schema response_format), so the model is far less likely to return
  // malformed output. Opt-in per config, except google where an unset flag
  // defaults ON (see resolveUseStructuredOutput). Each call site passes the
  // schema matching its own output shape; model-factory enables the per-provider
  // native path and treats it as a no-op for anthropic / anthropic-compatible.
  const structuredOutput = resolveUseStructuredOutput(config.useStructuredOutput, provider);

  // Global client-side rate limit: one slot per outbound HTTP request,
  // limiter keyed by module id. Not applied to healthCheck.
  const awaitRateLimit = (): Promise<void> =>
    rateLimitApplies(manifest.id, config.rateLimitEnabled)
      ? acquireRateLimit(manifest.id, config.requestsPerSecond)
      : Promise.resolve();

  // Wrap a single provider call: hold one of the module's concurrency slots
  // (keyed by module id, so all of this module's calls share the pool) for the
  // whole request, applying the rate-limit spacing inside the slot. maxParallel
  // unset/<=0 means the slot acquire is a no-op, so non-generic-ai modules are
  // unaffected.
  async function callProvider<T>(fn: () => Promise<T>): Promise<T> {
    const release = await acquireConcurrencySlot(manifest.id, config.maxParallel);
    try {
      await awaitRateLimit();
      return await fn();
    } finally {
      release();
    }
  }

  // The model id never changes for the lifetime of this module instance, so
  // resolve it once and reuse it everywhere (translate, judge, review, etc.)
  // instead of re-deriving `config.model || defaultModelForProvider(provider)`
  // per call.
  const modelId = config.model || defaultModelForProvider(provider);

  // Provider-options (reasoning/thinking config) likewise depend only on the
  // provider, effort, and model id — all fixed for this instance — so build the
  // spread-ready options object once.
  const providerOptions = buildProviderOptions(provider, {
    reasoningEffort: config.reasoningEffort,
    modelId,
  });
  const providerOptionsSpread = providerOptions
    ? { providerOptions: providerOptions as ProviderOptions }
    : {};

  /**
   * Build a language model bound to the module's resolved credentials and (when
   * structured output is on) the given native response schema. Centralizes the
   * apiKey resolve + createModelForProvider boilerplate each feature repeated.
   */
  function buildModel(responseFormatSchema?: Record<string, unknown>): LanguageModel {
    // SSRF backstop for ALL providers: the configured credential is sent as
    // an Authorization header to this baseURL, so a malicious project/global
    // config or restored backup could point a first-party provider's baseURL at a
    // link-local/metadata host (e.g. 169.254.169.254) to exfiltrate the BYOK key.
    // generic-ai validates eagerly in its own factory, but openai/anthropic/
    // google/deepseek passed baseURL straight through — so re-run the shared guard
    // here, the single path every provider's model construction funnels through.
    // The operator-only ALLOW_INTERNAL_LLM_HOSTS env override (read inside
    // validateBaseURL) still permits an internal host; allowInsecureHttp is true
    // because the internal-host/SSRF block is independent of the TLS rule and is
    // not a config-tunable knob on the first-party providers — so a deliberate
    // plain-HTTP remote override that already worked is not newly rejected, only
    // an internal/link-local/metadata or non-http(s)/unparseable host is.
    validateBaseURL(config.baseURL, true);
    return createModelForProvider(provider, {
      apiKey: resolveApiKey(),
      modelId,
      baseURL: config.baseURL,
      responseFormatSchema: structuredOutput ? responseFormatSchema : undefined,
    });
  }

  /**
   * One provider call with the module's standard request shape: default
   * maxOutputTokens cap, abort signal, and the shared provider options spread,
   * all wrapped in the concurrency/rate-limit gate. Each feature still does its
   * own prompt building, verbose logging, and response parsing.
   */
  function runGenerateText(
    model: LanguageModel,
    body: { system?: string } & (
      | { prompt: string; messages?: never }
      | { messages: NonNullable<Parameters<typeof generateText>[0]['messages']>; prompt?: never }
    ),
    signal?: AbortSignal,
  ): ReturnType<typeof generateText> {
    const timeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const maxOutputTokens = resolveMaxOutputTokens(config.maxOutputTokens);
    return callProvider(async () => {
      // Start the per-request timeout only once the concurrency slot AND
      // rate-limit spacing have cleared, i.e. when the request is actually
      // dispatched — not when it is first enqueued. Otherwise a request queued
      // behind a slow local model burns its whole budget waiting in the slot
      // queue and aborts UNSENT. Mirrors category-classifier's fresh-per-attempt
      // combine inside its retry callback.
      const combined = combineAbortSignals(signal, timeoutMs);
      try {
        return await generateText({
          model,
          ...body,
          ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
          ...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
          abortSignal: combined,
          ...providerOptionsSpread,
        });
      } catch (err) {
        // A fired timeout (combined aborted, but the caller did NOT cancel) becomes a
        // typed transient error so the judge/review retry path retries at a smaller size.
        if (combined.aborted && !signal?.aborted) throw new RequestTimeoutError(timeoutMs);
        // Sits below every per-feature rethrowIfAuthOrRateLimit() call site (single,
        // same-language batch, mixed-target batch, retryWithFeedback, judge/review),
        // so a back-off is reported regardless of which of those a given failure
        // flows through. A no-op when no limiter exists yet (requestsPerSecond unset).
        // Deliberately reports once per failed raw call, not once per logical job: a
        // batch that 429s rethrows without splitting, so the client-side limiter
        // reports once per batch attempt (no per-split escalation to account for).
        // The quota is assumed still live until proven otherwise, the 10s floor caps
        // the cost, and resetRateLimiters() clears it at the next run — do not "fix"
        // this into a once-per-job throttle.
        if (toRateLimitError(err)) {
          const backoff = reportRateLimitHit(manifest.id);
          if (backoff.changed) {
            log('warn', `[${provider}] rate-limit:backoff`, {
              previousIntervalMs: backoff.previousIntervalMs,
              newIntervalMs: backoff.newIntervalMs,
              effectiveRequestsPerSecond: 1000 / backoff.newIntervalMs,
            });
          }
        }
        throw err;
      }
    });
  }

  /**
   * Emit one verbose request/response log line for a feature, when
   * `config.verbose` is on. Collapses the near-identical `if (config.verbose)
   * log('info', '<prefix>:<phase>', { model, reasoningEffort, ... })` blocks
   * each feature hand-wrote. `phase` is the log-message suffix
   * (`request`/`response`/`success`/...); `payload` carries the feature-specific
   * fields (system/user/text/usage/count/...). The model id is always included,
   * and reasoningEffort on the request phase.
   */
  function logVerbose(prefix: string, phase: string, payload: Record<string, unknown>): void {
    if (!config.verbose) return;
    log('info', `[${provider}] ${prefix}:${phase}`, {
      model: modelId,
      ...(phase === 'request' ? { reasoningEffort: config.reasoningEffort } : {}),
      ...payload,
    });
  }

  // Resolve API key once (used by translate and translateOne)
  function resolveApiKey(): string {
    const credKey =
      manifest.id === 'generic-ai' ? GENERIC_API_KEY : credentialKeyForProvider(provider);

    // Secrets come only from an injected `config.apiKey` or the M16 credential
    // store consulted below — never `process.env`; secrets are vault-only by
    // contract. The `deepl` module follows the same rule.
    let resolvedKey: string | undefined = config.apiKey;

    // Try to get credential from store, but don't fail if vault is locked or unavailable
    if (!resolvedKey && credentials) {
      try {
        resolvedKey = credentials.get(credKey);
      } catch (err) {
        // If credentials are unavailable (e.g., vault locked) but we have a baseURL,
        // we might not need credentials (e.g., Ollama with local access).
        // For generic-ai / openai-compatible with baseURL, missing credentials is acceptable.
        if (err instanceof MissingCredentialError) {
          // credentials are definitely missing
        } else if (
          err &&
          typeof err === 'object' &&
          (err as { name?: string }).name === 'VaultLockedError'
        ) {
          // vault is locked, but we might not need it if we have a baseURL
        } else {
          // Some other error — re-throw
          throw err;
        }
      }
    }

    if (!resolvedKey) {
      // Local providers (Ollama, LM Studio, and anthropic-format local servers)
      // do not require an API key when a custom baseURL is set. anthropic-compatible
      // must be included here too (F:362): model-factory's createModelForProvider
      // already has an `apiKey: opts.apiKey || 'sk-ant-not-needed'` fallback for
      // this provider, but it was unreachable — resolveApiKey threw before ever
      // returning the empty string that would let that fallback engage.
      if (
        (provider === 'openai-compatible' || provider === 'anthropic-compatible') &&
        config.baseURL
      ) {
        return '';
      }
      throw new MissingCredentialError(credKey);
    }
    return resolvedKey;
  }

  // Single-job translation (for fallback path). Reuses the caller's already-built
  // language model — it always binds TRANSLATION_RESPONSE_SCHEMA, the same schema
  // every translate path uses — so the split-to-singles fallback no longer
  // rebuilds the model (and re-reads the vault) once per job.
  async function translateOne(
    job: TranslationJob,
    languageModel: LanguageModel,
    signal?: AbortSignal,
  ): Promise<TranslationResult> {
    const { system, user } = buildBatchPrompt([job], job.targetLanguage);

    logVerbose('single', 'request', { system, user });

    const { text, usage } = await runGenerateText(languageModel, { system, prompt: user }, signal);

    logVerbose('single', 'response', { text, usage });

    const parsed = parseBatchResponse(text, [job]);
    if (!parsed) throw new Error(PARSE_FAILURE_MESSAGE);

    return {
      entryId: job.entryId,
      targetLanguage: job.targetLanguage,
      translatedText: parsed[0]?.trim() ?? '',
      usedGlossaryId: job.glossary && job.glossary.length > 0 ? job.glossaryId : undefined,
      usage: toTranslationUsage(
        usage,
        modelId,
        charCounts(system + user, [job], text, [parsed[0]]),
      ),
    };
  }

  /**
   * One mixed-target batch request (entry-mode dispatch from M9). Same
   * throw-on-any-failure contract as runSameLanguageBatchOnce.
   */
  async function runMixedTargetBatchOnce(
    batch: TranslationJob[],
    mixedModel: LanguageModel,
    onJobComplete: ((result: TranslationResult) => void | Promise<void>) | undefined,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    const { system, user } = buildMixedTargetBatchPrompt(batch);

    logVerbose('batch:mixed-target', 'request', { system, user, count: batch.length });

    const { text, usage } = await runGenerateText(mixedModel, { system, prompt: user }, signal);

    logVerbose('batch:mixed-target', 'success', { text, usage, count: batch.length });

    const parsed = parseMixedTargetBatchResponse(text, batch);
    if (!parsed) throw new Error(MIXED_PARSE_FAILURE_MESSAGE);

    const batchUsage = toTranslationUsage(
      usage,
      modelId,
      charCounts(system + user, batch, text, parsed),
    );
    const resultsOut = attachUsageToFirst(
      batch.map((job, i) => ({
        entryId: job.entryId,
        targetLanguage: job.targetLanguage,
        translatedText: parsed[i]?.trim() ?? '',
        usedGlossaryId: job.glossary && job.glossary.length > 0 ? job.glossaryId : undefined,
      })),
      batchUsage,
    );
    for (const r of resultsOut) await onJobComplete?.(r);
    return resultsOut;
  }

  async function handleBatch(
    batch: TranslationJob[],
    languageModel: LanguageModel,
    getMixedTargetModel: () => LanguageModel,
    onJobComplete: ((result: TranslationResult) => void | Promise<void>) | undefined,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    // Single-job optimization: skip batch parsing for single entries
    if (batch.length === 1) {
      let result: TranslationResult;
      try {
        result = await translateOne(batch[0], languageModel, signal);
      } catch (err) {
        log('warn', `[${provider}] single:error`, {
          error: toErrorMessage(err),
          ...extractSafeErrorMetadata(err),
        });
        // Rethrow rate limits (429, with Retry-After) so the engine's retry loop
        // can honor the provider cool-down, and auth (401/403) failures so it
        // cancels the run rather than retrying with the same bad key.
        rethrowIfAuthOrRateLimit(err);
        result = {
          entryId: batch[0].entryId,
          targetLanguage: batch[0].targetLanguage,
          translatedText: '',
          error: toErrorMessage(err),
        };
      }
      await onJobComplete?.(result);
      return [result];
    }

    // Detect mixed-target batch (entry mode dispatch from M9)
    const uniqueTargets = new Set(batch.map((j) => j.targetLanguage));
    if (uniqueTargets.size > 1) {
      const mixedModel = getMixedTargetModel();
      try {
        return await runMixedTargetBatchOnce(batch, mixedModel, onJobComplete, signal);
      } catch (err) {
        log('warn', `[${provider}] batch:mixed-target:error`, {
          error: toErrorMessage(err),
          count: batch.length,
          ...extractSafeErrorMetadata(err),
        });
        // 429/auth hit every job identically: rethrow typed so the engine
        // waits the set delay and re-sends the whole batch (429) or cancels
        // the run (auth) — never regroup/split for those.
        rethrowIfAuthOrRateLimit(err);
        if (isTransientError(err) && !signal?.aborted) {
          // Transient (5xx/timeout/network): one as-is retry before regrouping.
          await sleep(transientRetryDelayMs(err, 0));
          if (!signal?.aborted) {
            try {
              return await runMixedTargetBatchOnce(batch, mixedModel, onJobComplete, signal);
            } catch (err2) {
              log('warn', `[${provider}] batch:mixed-target:retry-error`, {
                error: toErrorMessage(err2),
                count: batch.length,
                ...extractSafeErrorMetadata(err2),
              });
              rethrowIfAuthOrRateLimit(err2);
            }
          }
        }
        log('warn', `[${provider}] batch:mixed-target:error - retrying per language`, {
          count: batch.length,
        });
        // Regroup the failed mixed-target batch per target language and retry
        // each as a same-language batch. A language batch that fails again is
        // recorded as failed by `sameLanguageBatch` (no further split) —
        // isolating which language(s) actually failed instead of failing
        // every language in the mixed batch over one language's problem.
        const byLanguage = new Map<string, TranslationJob[]>();
        for (const job of batch) {
          const list = byLanguage.get(job.targetLanguage) ?? [];
          list.push(job);
          byLanguage.set(job.targetLanguage, list);
        }
        const indexByJob = new Map(batch.map((j, i) => [`${j.entryId}::${j.targetLanguage}`, i]));
        const ordered = new Array<TranslationResult>(batch.length);
        for (const languageBatch of byLanguage.values()) {
          let results: TranslationResult[];
          if (signal?.aborted) {
            results = languageBatch.map(cancelledResult);
            for (const r of results) await onJobComplete?.(r);
          } else {
            results = await sameLanguageBatch(languageBatch, languageModel, onJobComplete, signal);
          }
          for (const result of results) {
            const idx = indexByJob.get(`${result.entryId}::${result.targetLanguage}`);
            if (idx !== undefined) ordered[idx] = result;
          }
        }
        return ordered;
      }
    }

    return sameLanguageBatch(batch, languageModel, onJobComplete, signal);
  }

  /**
   * One same-language batch request: prompt → provider call → parse → usage →
   * per-result onJobComplete. Throws on any failure — an API/transport error,
   * or a parse failure surfaced as Error('parseBatchResponse: …') — so
   * sameLanguageBatch can classify the failure and pick the retry strategy.
   */
  async function runSameLanguageBatchOnce(
    batch: TranslationJob[],
    languageModel: LanguageModel,
    onJobComplete: ((result: TranslationResult) => void | Promise<void>) | undefined,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    const { system, user } = buildBatchPrompt(batch, batch[0].targetLanguage);

    logVerbose('batch', 'request', { system, user, count: batch.length });

    const { text, usage } = await runGenerateText(languageModel, { system, prompt: user }, signal);

    logVerbose('batch', 'success', { text, usage, count: batch.length });

    const parsed = parseBatchResponse(text, batch);
    if (!parsed) throw new Error(PARSE_FAILURE_MESSAGE);

    // Per the TranslationUsage contract the batch-total usage rides on the
    // first result only (each halving level's sub-batch is its own provider
    // call, so per-sub-batch usage on its first result stays accurate).
    const batchUsage = toTranslationUsage(
      usage,
      modelId,
      charCounts(system + user, batch, text, parsed),
    );
    const resultsOut = attachUsageToFirst(
      batch.map((job, i) => ({
        entryId: job.entryId,
        targetLanguage: job.targetLanguage,
        translatedText: parsed[i]?.trim() ?? '',
        usedGlossaryId: job.glossary && job.glossary.length > 0 ? job.glossaryId : undefined,
      })),
      batchUsage,
    );
    for (const r of resultsOut) await onJobComplete?.(r);
    return resultsOut;
  }

  /**
   * Same-language batch with failure-class-aware recovery (also the
   * per-language retry step for a failed mixed-target batch):
   *   - 429 → rethrow the typed RateLimitError with NO split: the engine's
   *     withRateLimitRetry waits the set retry delay (provider Retry-After or
   *     backoff) and re-sends the whole batch; jobs already streamed through
   *     onJobComplete are deduped by M9's processedIndices.
   *   - 401/403 → rethrow the typed AuthError so the engine cancels the run.
   *   - other transient errors (5xx / timeout / network) → ONE as-is retry
   *     after the standard backoff, then every job in the batch is recorded
   *     as failed.
   *   - parse failures and unclassifiable errors → every job in the batch is
   *     recorded as failed immediately (no as-is retry, no split).
   *
   * No automatic batch-size reduction: a batch that still fails after the
   * as-is retry is recorded as failed at the SAME size it was attempted at,
   * rather than being recursively halved and re-dispatched. The run surfaces
   * the failed (entry, language) pairs in the Activity tab, where the user
   * retries explicitly ("Retry failed") — by default at the same batch size.
   * Freeway-routed batches are the exception, handled a layer up: the
   * server's Freeway dispatch splits a parse-failed batch in bounded halves
   * on the same bucket before any failover.
   */
  async function sameLanguageBatch(
    batch: TranslationJob[],
    languageModel: LanguageModel,
    onJobComplete: ((result: TranslationResult) => void | Promise<void>) | undefined,
    signal?: AbortSignal,
  ): Promise<TranslationResult[]> {
    if (signal?.aborted) {
      const cancelled = batch.map(cancelledResult);
      for (const r of cancelled) await onJobComplete?.(r);
      return cancelled;
    }
    let lastError: unknown;
    try {
      return await runSameLanguageBatchOnce(batch, languageModel, onJobComplete, signal);
    } catch (err) {
      lastError = err;
      const isLeaf = batch.length === 1;
      log('warn', `[${provider}] ${isLeaf ? 'single' : 'batch'}:error`, {
        ...(isLeaf
          ? { entryId: batch[0].entryId, targetLanguage: batch[0].targetLanguage }
          : { count: batch.length }),
        error: toErrorMessage(err),
        ...extractSafeErrorMetadata(err),
      });
      rethrowIfAuthOrRateLimit(err);
      if (isTransientError(err) && !signal?.aborted) {
        await sleep(transientRetryDelayMs(err, 0));
        if (!signal?.aborted) {
          try {
            return await runSameLanguageBatchOnce(batch, languageModel, onJobComplete, signal);
          } catch (err2) {
            lastError = err2;
            log('warn', `[${provider}] batch:retry-error`, {
              error: toErrorMessage(err2),
              count: batch.length,
              ...extractSafeErrorMetadata(err2),
            });
            rethrowIfAuthOrRateLimit(err2);
          }
        }
      }
    }
    // No split fallback: every job in this batch is recorded as failed at the
    // size it was attempted at (a single job is simply the batch.length===1 case).
    const results: TranslationResult[] = signal?.aborted
      ? batch.map(cancelledResult)
      : batch.map((job) => ({
          entryId: job.entryId,
          targetLanguage: job.targetLanguage,
          translatedText: '',
          error: toErrorMessage(lastError),
        }));
    for (const r of results) await onJobComplete?.(r);
    return results;
  }

  async function translate(
    jobs: TranslationJob[],
    signal?: AbortSignal,
    options?: BatchDispatchOptions,
  ): Promise<TranslationResult[]> {
    if (jobs.length === 0) return [];

    // Atomicity guard: prevent duplicate (entryId, targetLanguage) pairs from corrupting results.
    const seenPairs = new Set<string>();
    for (const job of jobs) {
      const key = `${job.entryId}::${job.targetLanguage}`;
      if (seenPairs.has(key)) {
        throw new IncompleteEntryError(job.entryId);
      }
      seenPairs.add(key);
    }

    const languageModel = buildModel(TRANSLATION_RESPONSE_SCHEMA);

    // Built lazily and memoized: most translate() calls are same-language only
    // and never need the mixed-target shape, so avoid an extra model build (and
    // vault credential read) unless a dispatched chunk actually turns out to
    // have more than one target language.
    let mixedTargetModel: LanguageModel | undefined;
    const getMixedTargetModel = (): LanguageModel => {
      if (mixedTargetModel === undefined) {
        mixedTargetModel = buildModel(MIXED_TARGET_RESPONSE_SCHEMA);
      }
      return mixedTargetModel;
    };

    const onJobComplete = options?.onJobComplete;

    // When the engine flags ignoreSizeLimit, dispatch the whole pre-grouped
    // batch in one call (a related-entry group stays intact) instead of
    // re-chunking it at maxBatchSize. translate does not cap the configured
    // value (no `cap`).
    const maxBatch = resolveBatchSize(
      jobs.length,
      options?.ignoreSizeLimit ?? false,
      config.maxBatchSize,
      {
        default: 20,
      },
    );
    const results: TranslationResult[] = [];

    for (const batch of chunkArray(jobs, maxBatch)) {
      if (signal?.aborted) {
        const cancelled = batch.map(cancelledResult);
        for (const c of cancelled) await onJobComplete?.(c);
        results.push(...cancelled);
        continue;
      }
      results.push(
        ...(await handleBatch(batch, languageModel, getMixedTargetModel, onJobComplete, signal)),
      );
    }

    return results;
  }

  async function retryWithFeedback(
    job: TranslationJob,
    previousAttempt: string,
    feedbackMessage: string,
    signal?: AbortSignal,
  ): Promise<TranslationResult> {
    const languageModel = buildModel(TRANSLATION_RESPONSE_SCHEMA);

    const { system, user } = buildBatchPrompt([job], job.targetLanguage);

    // Replay the prior attempt in the SAME shape the prompt demands (a JSON
    // array of exactly 1 string) so the conversation stays format-consistent —
    // a bare-string assistant turn teaches weaker models to answer bare.
    const assistantContent = JSON.stringify([previousAttempt]);
    const feedbackContent =
      feedbackMessage +
      '\nReply with the corrected translation in the same output format: a JSON array containing exactly 1 string.';
    const messages = [
      { role: 'user' as const, content: user },
      { role: 'assistant' as const, content: assistantContent },
      { role: 'user' as const, content: feedbackContent },
    ];

    try {
      const { text, usage } = await runGenerateText(languageModel, { system, messages }, signal);

      // Parse the JSON-array envelope exactly like the first-pass path. The
      // retry prompt (buildBatchPrompt) still asks for a JSON array, so the
      // model — especially with reasoning disabled — typically answers with
      // `["…"]`, sometimes wrapped in a ```json fence. Storing text.trim()
      // verbatim would persist that envelope (fence, brackets, double-escaped
      // \n) AS the translation. Fall back to the fence-stripped payload only
      // when the response isn't a well-formed single-item array.
      const parsedRetry = parseBatchResponse(text, [job]);
      const translatedText = (
        parsedRetry ? (parsedRetry[0] ?? '') : extractJsonPayload(text)
      ).trim();
      // The retry sends the system prompt plus the whole message history
      // (original ask + prior attempt + feedback) — all of it is input.
      const promptText = system + user + assistantContent + feedbackContent;
      return {
        entryId: job.entryId,
        targetLanguage: job.targetLanguage,
        translatedText,
        usage: toTranslationUsage(
          usage,
          modelId,
          charCounts(promptText, [job], text, [translatedText]),
        ),
      };
    } catch (err) {
      // Mirror the first-pass paths: recast a 429 to RateLimitError (so the
      // engine honors the cool-down) and a 401/403 to AuthError (so it cancels
      // the run) and rethrow, rather than flattening every error — including a
      // rate limit or bad key — into a per-entry error with no Retry-After.
      rethrowIfAuthOrRateLimit(err);
      return {
        entryId: job.entryId,
        targetLanguage: job.targetLanguage,
        translatedText: '',
        error: toErrorMessage(err),
      };
    }
  }

  const effectiveCostTier = config.costPatterns
    ? deriveCostTierFromModel(
        modelId,
        config.costPatterns,
        config.costFallback ?? manifest.costTier,
      )
    : manifest.costTier;

  // The self-contained AI-helper features (judge / source-review /
  // glossary-suggest / health-check / list-models) live in the sibling
  // module-features.ts, wired here through an explicit context carrying exactly
  // the closure deps they touch — so the translate hot path above keeps sole
  // ownership of this closure. Behavior is identical to inlining them here.
  const featureCtx: AISDKModuleContext = {
    provider,
    config,
    modelId,
    buildModel,
    runGenerateText,
    log,
    logVerbose,
    resolveApiKey,
  };
  const features = createFeatureMethods(featureCtx);

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    capabilities: manifest.capabilities,
    costTier: effectiveCostTier,
    configSchema: manifest.configSchema,
    translate,
    retryWithFeedback,
    ...features,
  };
}
