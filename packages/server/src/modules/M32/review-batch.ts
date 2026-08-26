/**
 * The batch-size resolver both AI-review engines hand to `enqueueBatched` —
 * M25 (judge) and M26 (source review) — plus the "these batches are already
 * sized, don't re-chunk them" signal that has to travel with it.
 *
 * Shared rather than duplicated because the two engines differ in exactly one
 * thing: the LENGTH PROXY they measure a payload with. Everything else (the
 * precedence, the neutral sizing language, the synthetic `JobGroup`, and the
 * pre-sized latch) has to stay identical on both paths — a divergence there is
 * a silent throughput or quota-accounting bug on one engine and not the other.
 */
import { DEFAULT_BACKGROUND_BAND } from './background-select.js';
import { batchSizeFor, effectivePassRate } from './scoring.js';
import type { BucketView, JobGroup } from './types.js';

/**
 * Sizing scores against neutral English even for a judge run that knows its
 * real languages. The per-language signal is restricted to EXCLUDING a weak
 * bucket (see the selector's language filter); letting it also shrink batches
 * would make a soft quality number move throughput, which is a different and
 * riskier kind of change. Exclusion and sizing stay independent. Source review
 * has no target language at all (it reviews source text, never a translation),
 * so the same constant is the only honest choice there.
 */
const NEUTRAL_SIZING_LANGUAGE = 'en';

/**
 * The judge's length proxy: the judge sends BOTH halves of the pair, so
 * measuring the bare source undercounts the payload by roughly half.
 *
 * Exported rather than written inline at M25's sizer because the minute-token
 * projection at dispatch ({@link batchPayloadChars} feeding
 * `RunBatchOptions.batchChars`) must measure a batch with the SAME proxy the
 * sizer measured it with. If the two ever disagreed about what a batch costs,
 * the pre-dispatch gate would be wrong in a way nothing surfaces — it would
 * pause, or decline to pause, against a payload the run never sends.
 */
export function judgeLengthProxy(item: { sourceText: string; translatedText: string }): string {
  return item.sourceText + item.translatedText;
}

/**
 * Source review's length proxy. Not a proxy at all, strictly speaking: an item
 * has no translation, so its source text IS the whole payload rather than a
 * stand-in for something larger. It lives here beside the judge's for the same
 * sizing/projection reason.
 */
export function sourceReviewLengthProxy(item: { s: string }): string {
  return item.s;
}

/**
 * Characters one packed batch will send, summed with the run's own length
 * proxy — the figure `RunBatchOptions.batchChars` wants for its minute-token
 * projection. The same proxy and the same plain sum `charCappedBatch` sizes
 * with, so the projection and the sizing cannot drift apart.
 */
export function batchPayloadChars<TItem>(
  batch: readonly TItem[],
  lengthProxy: (item: TItem) => string,
): number {
  let total = 0;
  for (const item of batch) total += lengthProxy(item).length;
  return total;
}

/** The `batchSize` resolver plus the pre-sized signal, bound to one run. */
export interface ReviewBatchSizer<TItem> {
  /** The `EnqueueBatchedOptions.batchSize` resolver; called once per run. */
  resolve: (items: TItem[]) => number;
  /**
   * True once {@link resolve} has actually sized the batches to a bucket — the
   * `EnqueueBatchedOptions.batchesPreSized` signal. False for an explicit size
   * and for a non-Freeway run, whose batches are only ever a flat constant the
   * provider is still free to re-chunk against its own configured maxBatchSize.
   */
  bucketSized: () => boolean;
}

/**
 * Builds a run's batch-size resolver. Precedence, highest first:
 *
 *  1. `customBatchSize` — handled upstream in `run-engine.ts`, before this
 *     resolver ever runs.
 *  2. `explicitSize` — a size the caller actually typed (M26's plain "Batch
 *     size" field). A deliberate user choice, never something bucket sizing is
 *     free to override.
 *  3. Bucket sizing — a Freeway-routed run with no explicit size. Replaces the
 *     FLAT CONSTANT's role only.
 *  4. `fallbackSize` — the engine's flat constant, for every non-Freeway module
 *     (which has no bucket) and for a Freeway run whose bucket never resolved.
 *
 * `bucket` is a getter because the run's bucket is only known after
 * `selectModule` runs inside `enqueueBatched`, which is after this sizer is
 * constructed.
 */
export function createReviewBatchSizer<TItem extends { entryId: string }>(opts: {
  bucket: () => BucketView | undefined;
  explicitSize?: number | undefined;
  fallbackSize: number;
  /**
   * The text whose length stands in for the item's whole provider payload.
   * `charCappedBatch` sums this alone, so an engine that sends more than it
   * measures (the judge sends source AND translation) must return both here or
   * it undercounts the payload by roughly half.
   */
  lengthProxy: (item: TItem) => string;
}): ReviewBatchSizer<TItem> {
  let sizedToBucket = false;
  return {
    resolve: (items: TItem[]): number => {
      if (opts.explicitSize !== undefined) return opts.explicitSize;
      const bucket = opts.bucket();
      // A fixed constant either overruns a char-tight bucket's per-call budget
      // on prose, or spends several times the daily requests a high-capacity /
      // low-rpd bucket needed. With no bucket there is nothing to size against.
      if (!bucket) return opts.fallbackSize;
      const group: JobGroup = {
        targetLanguage: NEUTRAL_SIZING_LANGUAGE,
        band: DEFAULT_BACKGROUND_BAND,
        jobs: items.map((item) => ({
          entryId: item.entryId,
          targetLanguage: NEUTRAL_SIZING_LANGUAGE,
          sourceText: opts.lengthProxy(item),
          maskCount: 0,
          hasLengthLimit: false,
          glossaryTermCount: 0,
        })),
      };
      sizedToBucket = true;
      return batchSizeFor(
        bucket,
        group,
        effectivePassRate(bucket, NEUTRAL_SIZING_LANGUAGE, DEFAULT_BACKGROUND_BAND),
      );
    },
    bucketSized: () => sizedToBucket,
  };
}
