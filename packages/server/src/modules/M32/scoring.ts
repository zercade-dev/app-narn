/**
 * The request-economics core: free tiers are request-count-limited, so the
 * router optimizes expected REQUESTS per gate-passed string, not token cost.
 * A weak model that fails the LQA gate costs a full extra request per retry
 * (plus batch splits), so a stronger model is often cheaper in the scarce
 * currency even though both are free.
 */
import type { BucketView, DifficultyBand, JobGroup } from './types.js';
import { languageHardness } from './difficulty.js';

/**
 * Curated first-attempt gate-pass priors by quality tier (row) and difficulty
 * band (column, band-1..4). Corrected at runtime by live per-language EMAs.
 */
const PASS_PRIORS: Record<1 | 2 | 3 | 4, [number, number, number, number]> = {
  4: [0.99, 0.985, 0.97, 0.95],
  3: [0.985, 0.97, 0.94, 0.9],
  2: [0.96, 0.93, 0.87, 0.78],
  1: [0.96, 0.94, 0.85, 0.75],
};

const EMA_BLEND = 0.5;
const MIN_PASS = 0.3;
const MAX_PASS = 0.995;

export function effectivePassRate(
  bucket: BucketView,
  language: string,
  band: DifficultyBand,
): number {
  let rate = PASS_PRIORS[bucket.qualityTier][band - 1];
  if (bucket.weakLanguages?.includes(language)) rate *= 0.85;
  rate *= 1 - 0.01 * languageHardness(language);
  const ema = bucket.stats.gatePassByLanguage?.[language];
  if (typeof ema === 'number') rate = rate * (1 - EMA_BLEND) + ema * EMA_BLEND;
  return Math.min(MAX_PASS, Math.max(MIN_PASS, rate));
}

export function batchSizeFor(bucket: BucketView, passRate: number): number {
  if (passRate >= 0.9) return bucket.maxBatch;
  if (passRate >= 0.75) return Math.max(1, Math.floor(bucket.maxBatch / 2));
  return Math.max(1, Math.floor(bucket.maxBatch / 4));
}

export function estimatedRequests(jobCount: number, batchSize: number, passRate: number): number {
  return Math.ceil(Math.ceil(jobCount / batchSize) / passRate);
}

export function requestCost(
  bucket: BucketView,
  group: JobGroup,
): { batchSize: number; estimatedRequests: number; requestsPerJob: number; passRate: number } {
  const passRate = effectivePassRate(bucket, group.targetLanguage, group.band);
  const batchSize = batchSizeFor(bucket, passRate);
  if (group.jobs.length === 0) {
    return { batchSize, estimatedRequests: 0, requestsPerJob: 0, passRate };
  }
  const est = estimatedRequests(group.jobs.length, batchSize, passRate);
  return { batchSize, estimatedRequests: est, requestsPerJob: est / group.jobs.length, passRate };
}
