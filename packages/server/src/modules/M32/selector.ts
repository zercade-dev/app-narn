/**
 * Chooses the concrete bucket for one job group. Filtering enforces the
 * quality floor and live quota state; ranking minimizes expected requests
 * per job (the scarce currency), tie-breaking toward buckets whose quota
 * expires soonest so daily allowances never rot unused; a reserve keeps
 * top-tier headroom for escalation retries.
 */
import type { BucketView, JobGroup } from './types.js';
import { requestCost } from './scoring.js';

export interface Selection {
  bucket: BucketView;
  batchSize: number;
  estimatedRequests: number;
}

function groupChars(group: JobGroup): number {
  let total = 0;
  for (const job of group.jobs) total += job.sourceText.length;
  return total;
}

/**
 * The request stock a bucket can actually spend: a provider with an
 * account-wide pool caps every one of its buckets, so the usable figure is the
 * tighter of this model's own headroom and the pool's. Every surface that
 * reports or reasons about remaining requests must use this, or a drained pool
 * reads as full on each sibling.
 */
export function effectiveRemainingRequests(
  bucket: Pick<BucketView, 'remainingRequests' | 'poolRemainingRequests'>,
): number {
  return Math.min(bucket.remainingRequests, bucket.poolRemainingRequests ?? Infinity);
}

export function isEligible(bucket: BucketView, group: JobGroup, now: number): boolean {
  if (bucket.disabledReason !== undefined) return false;
  if (bucket.cooldownUntil !== undefined && bucket.cooldownUntil > now) return false;
  if (bucket.qualityTier < group.band) return false;
  if (group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)) return false;
  if (bucket.remainingChars !== undefined) {
    if (bucket.remainingChars < groupChars(group)) return false;
  }
  return effectiveRemainingRequests(bucket) >= 1;
}

/** A monthly character budget is a reservoir (1), a daily request window is not (0). */
function isReservoir(bucket: BucketView): number {
  return bucket.remainingChars !== undefined ? 1 : 0;
}

/**
 * Ranks the eligible buckets cheapest-first. Daily request quotas perish
 * daily while a monthly character budget does not, so reservoir buckets sort
 * BEHIND every request-window bucket regardless of cost: use-it-or-lose-it
 * headroom is spent first, and the reservoir covers what's left once the daily
 * buckets are exhausted or cooling. Within each class the order is expected
 * requests per job, then soonest reset, then tier, then key.
 */
export function rankCandidates(buckets: BucketView[], group: JobGroup, now: number): BucketView[] {
  const eligible = buckets.filter((b) => isEligible(b, group, now));
  const costs = new Map(eligible.map((b) => [b.bucketKey, requestCost(b, group)]));
  return [...eligible].sort((a, b) => {
    if (isReservoir(a) !== isReservoir(b)) return isReservoir(a) - isReservoir(b);
    const ca = costs.get(a.bucketKey)!;
    const cb = costs.get(b.bucketKey)!;
    if (ca.requestsPerJob !== cb.requestsPerJob) return ca.requestsPerJob - cb.requestsPerJob;
    if (a.nextResetAt !== b.nextResetAt) return a.nextResetAt - b.nextResetAt;
    if (a.qualityTier !== b.qualityTier) return a.qualityTier - b.qualityTier;
    return a.bucketKey < b.bucketKey ? -1 : 1;
  });
}

function toSelection(bucket: BucketView, group: JobGroup): Selection {
  const cost = requestCost(bucket, group);
  return { bucket, batchSize: cost.batchSize, estimatedRequests: cost.estimatedRequests };
}

export function selectBucket(
  group: JobGroup,
  buckets: BucketView[],
  now: number,
  opts?: { reserveRequests?: number },
): Selection | undefined {
  const ranked = rankCandidates(buckets, group, now);
  if (ranked.length === 0) return undefined;
  const reserve = opts?.reserveRequests ?? 0;
  const winner = ranked[0];
  if (reserve > 0 && winner.qualityTier === 4 && group.band < 4) {
    const cost = requestCost(winner, group);
    if (effectiveRemainingRequests(winner) - cost.estimatedRequests < reserve) {
      const fallback = ranked.find((b) => b.qualityTier !== 4);
      if (fallback) return toSelection(fallback, group);
    }
  }
  return toSelection(winner, group);
}

export function selectEscalation(
  failedBucketKey: string,
  group: JobGroup,
  buckets: BucketView[],
  now: number,
): Selection | undefined {
  const failedTier = buckets.find((b) => b.bucketKey === failedBucketKey)?.qualityTier ?? 0;
  const better = rankCandidates(buckets, group, now).filter(
    (b) => b.qualityTier > failedTier && b.bucketKey !== failedBucketKey,
  );
  return better.length > 0 ? toSelection(better[0], group) : undefined;
}
