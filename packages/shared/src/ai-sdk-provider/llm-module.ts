/**
 * Shared judge / source-review feature bodies behind a transport SEAM.
 *
 * The LLM-as-judge and source-language-review features have one identical shape
 * across every provider: chunk the items, build a prompt, issue ONE provider
 * call per batch, parse it, attach the batch-total usage to the first result,
 * and recursively halve a batch whose response won't parse (down to a singleton
 * error result) so one bad batch never aborts a run. The ONLY things that differ
 * between the AI-SDK cloud providers (anthropic/openai/google/deepseek/generic-ai)
 * and GitHub Copilot are:
 *
 *   1. the GENERATE call (AI-SDK `generateText` through the closure's
 *      concurrency/rate-limit gate, vs Copilot's `client.complete` on a CLI
 *      session) — injected as {@link FeatureTransport};
 *   2. the rawUsage → {@link TranslationUsage} MAPPING (AI-SDK returns
 *      `undefined` when the provider reported no token counts; Copilot always
 *      reports a token-XOR-characters object) — injected as
 *      {@link JudgeFeatureDeps.mapUsage};
 *   3. the verbose request/response and parse-failed LOG lines (different
 *      message prefixes / fields, and Copilot has no `finishReason`) — injected
 *      as the optional {@link JudgeFeatureDeps.onRequest}/`onResponse`/`onParseFailed`
 *      hooks (each owns its own verbose gate + message shape; the shared body
 *      only decides WHEN to call them).
 *
 * Everything else — the split-and-retry orchestration (shared `splitAndRetry`,
 * injected to avoid a cycle with core.ts), the prompt builders/parsers, and the
 * "usage rides on the first result" contract — lives here once so the two call
 * sites cannot drift.
 */
import { buildJudgePrompt, parseJudgeResponse } from './judge.js';
import { buildSourceReviewPrompt, parseSourceReviewResponse } from './source-review.js';
import { chunkArray } from '../chunk.js';
import type {
  TranslationUsage,
  SourceReviewOptions,
  SourceReviewItem,
  SourceReviewItemResult,
} from '../types/module.js';
import type { JudgeItem, JudgeVerdict } from '../types/judge.js';

/**
 * The minimal result a feature `generate` call returns. `usage` is the
 * provider's RAW usage block (shape differs per provider — the injected
 * `mapUsage` normalizes it); `finishReason` is AI-SDK-only (Copilot has none)
 * and feeds the parse-failed diagnostics, so it is optional.
 */
export interface FeatureGenerateResult {
  text: string;
  usage?: unknown;
  finishReason?: string;
}

/**
 * The transport SEAM: one bare "system + user in, text + raw-usage out" call.
 * The AI-SDK default binds `generateText` (through the module's
 * concurrency/rate-limit gate and per-feature response schema); Copilot binds
 * `client.complete` on a CLI session. `signal` is forwarded so a cancelled run
 * stops issuing provider work.
 */
export type FeatureTransport = (args: {
  system: string;
  user: string;
  signal?: AbortSignal;
}) => Promise<FeatureGenerateResult>;

/** Structured log sink shared by the provider layer: `(level, message, meta?)`. */
type ModuleLogger = (
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
) => void;

/**
 * The shared `splitAndRetry` signature (the function lives in core.ts; it is
 * injected here rather than imported to avoid a circular import — core.ts
 * imports this module's feature bodies).
 */
export type SplitAndRetry = <TItem, TResult>(
  batch: TItem[],
  runOnce: (batch: TItem[]) => Promise<TResult[] | null>,
  makeErrors: (batch: TItem[], message: string) => TResult[],
  log: ModuleLogger,
  logPrefix: string,
  parseFailMessage: string,
  signal?: AbortSignal,
  retryTransient?: boolean,
) => Promise<TResult[]>;

/**
 * Attach a per-call (batch-total) usage to the FIRST result only, leaving the
 * rest untouched. Centralizes the "usage rides on the first result" contract
 * shared by translation, judge, and source-review batch handling. A `usage` of
 * `undefined` (AI-SDK with no provider-reported tokens) returns the list
 * unchanged — so the first result keeps no `usage` key, matching the prior
 * inline behavior at every call site.
 */
export function attachUsageToFirst<T extends object>(
  results: T[],
  usage: TranslationUsage | undefined,
): T[] {
  if (!usage) return results;
  return results.map((r, i) => (i === 0 ? { ...r, usage } : r));
}

/** Shared deps for the judge feature body. */
export interface JudgeFeatureDeps {
  generate: FeatureTransport;
  /**
   * RAW provider usage → {@link TranslationUsage}. Receives the call's raw
   * `usage` and the batch it covers (so a character-fallback mapper can sum the
   * batch's source chars). May return `undefined` (AI-SDK with no token counts);
   * `attachUsageToFirst` then leaves the verdicts unchanged.
   */
  mapUsage: (rawUsage: unknown, batch: JudgeItem[]) => TranslationUsage | undefined;
  log: ModuleLogger;
  /** Per-feature batch size for this call (already resolved by the caller). */
  maxBatch: number;
  signal?: AbortSignal;
  /** `splitAndRetry` log prefix, e.g. `[copilot] judge` or `[openai] judge`. */
  logPrefix: string;
  /** Singleton parse-fail message recorded on the error verdict (test-pinned per provider). */
  parseFailMessage: string;
  /**
   * Whether `splitAndRetry` retries a transient error once at the same size
   * before splitting. Both call sites pass `true`.
   */
  retryTransient: boolean;
  /** Shared `splitAndRetry` (injected to avoid a cycle with core.ts). */
  splitAndRetry: SplitAndRetry;
  /** Verbose request hook — the caller owns its own verbose gate + log shape. */
  onRequest?: (batch: JudgeItem[], prompt: { system: string; user: string }) => void;
  /** Verbose response hook. */
  onResponse?: (batch: JudgeItem[], res: FeatureGenerateResult) => void;
  /** Parse-failed hook (always on — the response could not be parsed). */
  onParseFailed?: (batch: JudgeItem[], res: FeatureGenerateResult) => void;
}

/** Shared deps for the source-review feature body (mirrors {@link JudgeFeatureDeps}). */
export interface SourceReviewFeatureDeps {
  generate: FeatureTransport;
  mapUsage: (rawUsage: unknown, batch: SourceReviewItem[]) => TranslationUsage | undefined;
  log: ModuleLogger;
  maxBatch: number;
  signal?: AbortSignal;
  logPrefix: string;
  parseFailMessage: string;
  retryTransient: boolean;
  splitAndRetry: SplitAndRetry;
  /** The reindexed batch (dense 0-based `i`) is passed so the caller can log it. */
  onRequest?: (reindexed: SourceReviewItem[], prompt: { system: string; user: string }) => void;
  onResponse?: (batch: SourceReviewItem[], res: FeatureGenerateResult) => void;
  onParseFailed?: (batch: SourceReviewItem[], res: FeatureGenerateResult) => void;
}

/**
 * LLM-as-judge review (report-only), shared across providers. Batches several
 * items per provider call; a failed call yields per-item error verdicts instead
 * of throwing so one bad batch never aborts a judge run. The caller injects the
 * transport, the usage mapping, and the verbose/parse-fail log shapes.
 *
 * NOTE: the `items.length === 0` short-circuit also lives at each call site
 * (before it acquires the client/session), so an empty batch never touches the
 * provider; this guard is the in-body backstop.
 */
export async function runJudgeFeature(
  items: JudgeItem[],
  deps: JudgeFeatureDeps,
): Promise<JudgeVerdict[]> {
  if (items.length === 0) return [];

  const errorVerdicts = (batch: JudgeItem[], message: string): JudgeVerdict[] =>
    batch.map((item) => ({
      entryId: item.entryId,
      targetLanguage: item.targetLanguage,
      verdict: 'fail' as const,
      score: 0,
      issues: [],
      error: message,
    }));

  // One provider call for a batch. Returns parsed verdicts on success, or null
  // when the response can't be parsed — splitAndRetry then splits and retries.
  // API/transport errors propagate so splitAndRetry can record them.
  const judgeOnce = async (batch: JudgeItem[]): Promise<JudgeVerdict[] | null> => {
    const { system, user } = buildJudgePrompt(batch);
    deps.onRequest?.(batch, { system, user });

    const res = await deps.generate({ system, user, signal: deps.signal });

    deps.onResponse?.(batch, res);

    const parsed = parseJudgeResponse(res.text, batch);
    if (!parsed) {
      deps.onParseFailed?.(batch, res);
      return null;
    }
    // Per the TranslationUsage contract the batch-total usage rides on the
    // first verdict only.
    return attachUsageToFirst(parsed, deps.mapUsage(res.usage, batch));
  };

  const verdicts: JudgeVerdict[] = [];
  for (const batch of chunkArray(items, deps.maxBatch)) {
    verdicts.push(
      ...(await deps.splitAndRetry(
        batch,
        judgeOnce,
        errorVerdicts,
        deps.log,
        deps.logPrefix,
        deps.parseFailMessage,
        deps.signal,
        deps.retryTransient,
      )),
    );
  }
  return verdicts;
}

/**
 * Source-language AI review (report-only), shared across providers. Reviews the
 * source text only — never translates. Batches several items per provider call;
 * a failed call yields per-item error results (empty findings) instead of
 * throwing so one bad batch never aborts a review run. The batch is re-indexed
 * so `i` is dense and 0-based for the prompt/parse contract regardless of the
 * caller's original indices.
 */
export async function runSourceReviewFeature(
  items: SourceReviewItem[],
  opts: SourceReviewOptions,
  deps: SourceReviewFeatureDeps,
): Promise<SourceReviewItemResult[]> {
  if (items.length === 0) return [];

  const errorResults = (batch: SourceReviewItem[], message: string): SourceReviewItemResult[] =>
    batch.map((item) => ({ entryId: item.entryId, findings: [], error: message }));

  const reviewOnce = async (
    batch: SourceReviewItem[],
  ): Promise<SourceReviewItemResult[] | null> => {
    const reindexed = batch.map((item, i) => ({ ...item, i }));
    const { system, user } = buildSourceReviewPrompt(
      reindexed,
      opts.checks,
      opts.responseLanguage,
      opts.sourceLanguage,
    );
    deps.onRequest?.(reindexed, { system, user });

    const res = await deps.generate({ system, user, signal: deps.signal });

    deps.onResponse?.(batch, res);

    const parsed = parseSourceReviewResponse(res.text, reindexed, opts.checks);
    if (!parsed) {
      deps.onParseFailed?.(batch, res);
      return null;
    }
    // Per the TranslationUsage contract the batch-total usage rides on the
    // first result only.
    return attachUsageToFirst(parsed, deps.mapUsage(res.usage, batch));
  };

  const results: SourceReviewItemResult[] = [];
  for (const batch of chunkArray(items, deps.maxBatch)) {
    results.push(
      ...(await deps.splitAndRetry(
        batch,
        reviewOnce,
        errorResults,
        deps.log,
        deps.logPrefix,
        deps.parseFailMessage,
        deps.signal,
        deps.retryTransient,
      )),
    );
  }
  return results;
}
