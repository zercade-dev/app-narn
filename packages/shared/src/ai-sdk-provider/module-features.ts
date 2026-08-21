import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import {
  buildGlossarySuggestPrompt,
  parseGlossarySuggestResponse,
  GLOSSARY_SUGGEST_RESPONSE_SCHEMA,
  createGlossarySuggestionMerger,
} from './glossary-suggest.js';
import { judgeResponseSchema } from './judge.js';
import { sourceReviewResponseSchema } from './source-review.js';
import {
  runJudgeFeature,
  runSourceReviewFeature,
  type FeatureGenerateResult,
} from './llm-module.js';
import {
  resolveAnthropicModels,
  resolveOpenAIModels,
  resolveGoogleModels,
  resolveDeepSeekModels,
  resolveGenericModels,
  resolveAnthropicCompatibleModels,
  resolveOpenRouterModels,
  resolveGroqModels,
} from './reasoning-resolvers.js';
// Shared, already-top-level helpers that stay owned by core.ts (translate path
// also uses several of them). Importing them here forms a module cycle with
// core.ts, which is safe: every reference below is inside a function body, so
// the bindings are resolved at call time — long after both modules finish
// evaluating — not during module init.
import {
  toTranslationUsage,
  resolveBatchSize,
  splitAndRetry,
  throwIfAllChunksFailed,
  extractSafeErrorMetadata,
  rethrowIfAuthOrRateLimit,
  DEFAULT_MAX_OUTPUT_TOKENS,
  GLOSSARY_SUGGEST_CHUNK_SIZE,
  type TokenUsageInput,
} from './core.js';
import { chunkArray, toErrorMessage, MissingCredentialError } from '../index.js';
import { retryOnceOnTransient } from './transient.js';
import type {
  TranslationModule,
  TranslationUsage,
  BatchDispatchOptions,
  SourceReviewItem,
  SourceReviewItemResult,
  SourceReviewOptions,
} from '../types/module.js';
import type { JudgeItem, JudgeVerdict } from '../types/judge.js';
import type {
  GlossarySuggestItem,
  GlossarySuggestOptions,
  GlossarySuggestResult,
} from '../types/glossary-suggest.js';
import type { ModelInfo } from '../types/models.js';
import type { AISDKModuleConfig, ProviderType } from './types.js';

/**
 * Structured log sink shared by the AI SDK provider layer and the module
 * factories: `(level, message, meta?) => void`. Matches `AISDKModuleConfig.log`.
 * (Mirrors the same private type in core.ts.)
 */
type ModuleLogger = (
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) => void;

/** The closure's verbose request/response logger. */
type LogVerbose = (prefix: string, phase: string, payload: Record<string, unknown>) => void;

/** The closure's credential-bound model builder. */
type BuildModel = (responseFormatSchema?: Record<string, unknown>) => LanguageModel;

/** The closure's gated single provider call (concurrency + rate-limit + timeout). */
type RunGenerateText = (
  model: LanguageModel,
  body: { system?: string } & (
    | { prompt: string; messages?: never }
    | { messages: NonNullable<Parameters<typeof generateText>[0]['messages']>; prompt?: never }
  ),
  signal?: AbortSignal,
) => ReturnType<typeof generateText>;

/**
 * The exact set of `createAISDKModule`-closure dependencies the extracted
 * feature methods (judge / source-review / glossary-suggest / health-check /
 * list-models) reference. Threaded explicitly so those self-contained AI-helper
 * calls can live in this sibling file WITHOUT touching the translate hot path
 * that still owns the closure. Nothing here reaches translate-path state.
 */
export interface AISDKModuleContext {
  provider: ProviderType;
  config: AISDKModuleConfig;
  modelId: string;
  buildModel: BuildModel;
  runGenerateText: RunGenerateText;
  log: ModuleLogger;
  logVerbose: LogVerbose;
  resolveApiKey: () => string;
}

/**
 * Build the feature-method half of the module returned by `createAISDKModule`.
 * These are lifted verbatim out of that closure; the only change is that the
 * previously closed-over dependencies now arrive via `ctx` (destructured to the
 * same names, so the bodies are unchanged). Behavior, log strings, chunk sizes,
 * split/parse/usage logic, error handling, and return shapes are identical.
 */
export function createFeatureMethods(
  ctx: AISDKModuleContext,
): Pick<
  TranslationModule,
  'judgeTranslations' | 'reviewSource' | 'suggestGlossaries' | 'healthCheck' | 'listModels'
> {
  const { provider, config, modelId, buildModel, runGenerateText, log, logVerbose, resolveApiKey } =
    ctx;

  /**
   * One feature-transport call (judge/review): build the model bound to the
   * feature's native response schema, run it through the module's standard
   * request shape + concurrency/rate-limit gate, and surface the AI-SDK
   * `{ text, usage, finishReason }`. `finishReason` feeds the parse-failed
   * diagnostics; the raw `usage` is normalized by the shared `mapUsage` below.
   */
  function makeFeatureTransport(responseFormatSchema: Record<string, unknown>) {
    const languageModel = buildModel(responseFormatSchema);
    return (args: {
      system: string;
      user: string;
      signal?: AbortSignal;
    }): Promise<FeatureGenerateResult> =>
      runGenerateText(languageModel, { system: args.system, prompt: args.user }, args.signal);
  }

  /**
   * LLM-as-judge review (report-only). Delegates the chunk/split/parse/usage
   * orchestration to the shared `runJudgeFeature` behind the AI-SDK transport;
   * a failed batch yields per-item error verdicts instead of throwing so one
   * bad batch never aborts a judge run. The AI-SDK `mapUsage` returns undefined
   * when the provider reported no token counts (so the first verdict then keeps
   * no `usage`), matching the prior inline behavior.
   */
  async function judgeTranslations(
    items: JudgeItem[],
    signal?: AbortSignal,
    options?: BatchDispatchOptions,
  ): Promise<JudgeVerdict[]> {
    if (items.length === 0) return [];

    // Parse failures often clear when the batch is smaller — less output to
    // truncate, fewer items to mis-count. The shared body halves down to
    // singletons before giving up; a single item that still won't parse becomes
    // an error verdict.
    return runJudgeFeature(items, {
      generate: makeFeatureTransport(judgeResponseSchema(items[0]?.checks)),
      mapUsage: (usage) => toTranslationUsage(usage as TokenUsageInput, modelId),
      log,
      maxBatch: resolveBatchSize(
        items.length,
        options?.ignoreSizeLimit ?? false,
        config.maxBatchSize,
        {
          default: 10,
          cap: 10,
        },
      ),
      signal,
      logPrefix: `[${provider}] judge`,
      parseFailMessage: 'parseJudgeResponse: malformed JSON from provider',
      retryTransient: true,
      splitAndRetry,
      onRequest: (batch, { system, user }) =>
        logVerbose('judge', 'request', {
          maxOutputTokens: config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          system,
          user,
          count: batch.length,
        }),
      onResponse: (batch, { text, usage, finishReason }) =>
        logVerbose('judge', 'response', { text, usage, finishReason, count: batch.length }),
      onParseFailed: (batch, { text, finishReason }) =>
        // `finishReason: 'length'` means the model hit maxOutputTokens and the
        // JSON was truncated; otherwise it deviated from the format. The tail
        // shows which, without dumping the whole (possibly large) response.
        log('warn', `[${provider}] judge:parse-failed`, {
          count: batch.length,
          finishReason,
          outputChars: text.length,
          outputTail: text.slice(-200),
        }),
    });
  }

  /**
   * Source-language AI review (report-only). Reviews the source text only —
   * never translates. Delegates to the shared `runSourceReviewFeature` behind
   * the AI-SDK transport; a failed batch yields per-item error results (empty
   * findings) instead of throwing so one bad batch never aborts a review run.
   * Note: the engine already chunks by its own batch size before calling this,
   * so the re-index (`i`) is per-call.
   */
  async function reviewSource(
    items: SourceReviewItem[],
    opts: SourceReviewOptions,
    signal?: AbortSignal,
    options?: BatchDispatchOptions,
  ): Promise<SourceReviewItemResult[]> {
    if (items.length === 0) return [];

    // Parse failures often clear when the batch is smaller; the shared body
    // halves down to singletons before giving up. A single item that still
    // won't parse becomes an error result (not a silent clean review) so the
    // engine records it as failed.
    return runSourceReviewFeature(items, opts, {
      generate: makeFeatureTransport(sourceReviewResponseSchema(opts.checks)),
      mapUsage: (usage) => toTranslationUsage(usage as TokenUsageInput, modelId),
      log,
      maxBatch: resolveBatchSize(
        items.length,
        options?.ignoreSizeLimit ?? false,
        config.maxBatchSize,
        {
          default: 10,
          cap: 12,
        },
      ),
      signal,
      logPrefix: `[${provider}] source-review`,
      parseFailMessage: 'parseSourceReviewResponse: malformed JSON from provider',
      retryTransient: true,
      splitAndRetry,
      onRequest: (reindexed, { system, user }) =>
        logVerbose('source-review', 'request', {
          maxOutputTokens: config.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          system,
          user,
          count: reindexed.length,
        }),
      onResponse: (batch, { text, usage, finishReason }) =>
        logVerbose('source-review', 'response', { text, usage, finishReason, count: batch.length }),
      onParseFailed: (batch, { text, finishReason }) =>
        log('warn', `[${provider}] source-review:parse-failed`, {
          count: batch.length,
          finishReason,
          outputChars: text.length,
          outputTail: text.slice(-200),
        }),
    });
  }

  /**
   * AI glossary suggestion (report-only). Groups recurring custom terms and
   * proper nouns from the source texts into suggested glossaries. For large
   * projects the items are chunked and suggestions merged by glossary name
   * (case-insensitive), de-duplicating sources across chunks. A chunk whose
   * response can't be parsed is skipped (its terms simply aren't suggested)
   * rather than failing the whole call.
   */
  async function suggestGlossaries(
    items: GlossarySuggestItem[],
    opts: GlossarySuggestOptions,
    signal?: AbortSignal,
  ): Promise<GlossarySuggestResult> {
    if (items.length === 0) return { suggestions: [], usages: [] };
    const languageModel = buildModel(GLOSSARY_SUGGEST_RESPONSE_SCHEMA);

    // Merge across chunks: shared helper (also used by the copilot module) —
    // glossary name (case-insensitive) → ordered, de-duped sources, with
    // first-wins notes/termNotes/termTranslations.
    const merger = createGlossarySuggestionMerger();

    // Larger chunks than translation/review since each item is just a short
    // source string and the response is compact; keep it bounded for big projects.
    // A positive opts.chunkSize (the "send everything at once" path) overrides
    // the default cap so the whole item set goes in one call.
    const maxBatch =
      opts.chunkSize && opts.chunkSize > 0
        ? opts.chunkSize
        : Math.min(config.maxBatchSize ?? GLOSSARY_SUGGEST_CHUNK_SIZE, GLOSSARY_SUGGEST_CHUNK_SIZE);
    // Track request-level failures so a run where EVERY chunk failed surfaces an
    // error instead of returning [] — which the UI reports as "the AI found no
    // new terms", hiding a bad key / invalid request / network error.
    let lastError: unknown;
    let anyRequestSucceeded = false;
    // Cumulative count of items whose batch has settled, reported after each
    // batch so the caller can render granular progress (the batches run
    // sequentially, so this advances steadily rather than jumping at the end).
    let processed = 0;
    // Per-provider-call usage, one entry per settled (non-throwing) batch — for
    // the caller (M28) to accumulate into the run's billing.
    const usages: TranslationUsage[] = [];
    const batchList = opts.batches?.length ? opts.batches : chunkArray(items, maxBatch);
    for (const batch of batchList) {
      if (signal?.aborted) break;
      const { system, user } = buildGlossarySuggestPrompt(
        batch,
        opts.excludedSources,
        opts.translationLanguages ?? [],
      );

      logVerbose('glossary-suggest', 'request', { system, user, count: batch.length });

      let text: string | undefined;
      try {
        const res = await retryOnceOnTransient(
          () => runGenerateText(languageModel, { system, prompt: user }, signal),
          signal,
        );
        text = res.text;
        anyRequestSucceeded = true;
        const usage = toTranslationUsage(res.usage, modelId);
        if (usage) {
          usages.push(usage);
          // Hand this call's usage over immediately: a caller debiting a
          // free-tier ledger must be able to charge the bucket that served
          // THIS call, before a later chunk's 429 aborts the whole return.
          opts.onUsage?.(usage);
        }
        logVerbose('glossary-suggest', 'response', {
          text,
          usage: res.usage,
          count: batch.length,
        });
      } catch (err) {
        if (signal?.aborted) break;
        log('warn', `[${provider}] glossary-suggest:error`, {
          error: toErrorMessage(err),
          count: batch.length,
          ...extractSafeErrorMetadata(err),
        });
        // Rate limits (429) and auth failures (bad/expired key) affect every
        // chunk identically, so surface them immediately rather than silently
        // returning no terms — matching the translate/judge paths.
        rethrowIfAuthOrRateLimit(err);
        lastError = err;
      }

      const parsed =
        text !== undefined ? parseGlossarySuggestResponse(text, opts.translationLanguages) : null;
      if (text !== undefined && !parsed) {
        log('warn', `[${provider}] glossary-suggest:parse-failed`, {
          count: batch.length,
          outputTail: text.slice(-200),
        });
      }

      if (parsed) {
        for (const suggestion of parsed) merger.add(suggestion);
      }

      // The batch has settled (succeeded, failed non-fatally, or parse-failed):
      // count its items toward progress so the caller's bar advances per batch.
      // Aborts `break` out above and are deliberately not counted.
      processed += batch.length;
      opts.onProgress?.(processed);
    }

    // Every request failed (none returned text) and we were not cancelled:
    // the empty result is a failure, not a genuine "no terms found". Throw so
    // the route reports an error instead of an empty suggestion list.
    throwIfAllChunksFailed(anyRequestSucceeded, lastError, signal);

    return {
      suggestions: merger.result(),
      usages,
    };
  }

  async function healthCheck(): Promise<{ ok: boolean; latencyMs?: number }> {
    const start = Date.now();
    try {
      // Deliberately bypasses callProvider/runGenerateText: no schema, no
      // rate-limit/concurrency gate, so a health check can probe even while a
      // translate run saturates the pool (fine for a localhost single-user app).
      const languageModel = buildModel();
      await generateText({
        model: languageModel,
        prompt: 'Say "ok" in Spanish. Reply with exactly one word.',
        maxOutputTokens: 10,
        // A black-holing endpoint would otherwise hang this call (and the
        // route awaiting it) forever — no signal/timeout was wired in before.
        abortSignal: AbortSignal.timeout(10_000),
      });
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: Date.now() - start };
    }
  }

  async function listModels(): Promise<ModelInfo[]> {
    let apiKey: string;
    try {
      apiKey = resolveApiKey();
    } catch (err) {
      if (err instanceof MissingCredentialError) {
        console.error(
          `[${provider}] Failed to list models: Missing required credential ${err.message}`,
        );
        return [];
      }
      throw err;
    }

    const opts = { apiKey, baseURL: config.baseURL, endpointType: config.endpointType };

    switch (provider) {
      case 'anthropic':
        return resolveAnthropicModels(opts);
      case 'openai':
        return resolveOpenAIModels(opts);
      case 'google':
        return resolveGoogleModels(opts);
      case 'deepseek':
        return resolveDeepSeekModels(opts);
      case 'openai-compatible':
        return resolveGenericModels(opts);
      case 'anthropic-compatible':
        return resolveAnthropicCompatibleModels(opts);
      case 'openrouter':
        return resolveOpenRouterModels({ apiKey: opts.apiKey });
      case 'groq':
        return resolveGroqModels({ apiKey: opts.apiKey });
      default:
        return [];
    }
  }

  return { judgeTranslations, reviewSource, suggestGlossaries, healthCheck, listModels };
}
