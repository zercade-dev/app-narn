/**
 * Chooses the concrete bucket for one job group. Filtering enforces the
 * quality floor and live quota state. Ranking is reservoir-last FIRST — a
 * monthly character budget (classical MT) sorts behind every daily-request
 * bucket, because only the daily allowance perishes — and within each class it
 * minimizes the share of each bucket's REMAINING stock a group consumes
 * (falling back to expected requests per job between buckets that are equally
 * unstressed), tie-breaking toward buckets whose quota expires soonest so
 * daily allowances never rot unused; a reserve keeps top-tier headroom for
 * escalation retries.
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

/**
 * Whether a bucket has the STOCK to serve this group, ignoring transient
 * cooldown — i.e. everything {@link isEligible} checks except the clock. A
 * bucket that has stock and is merely cooling becomes usable when the cooldown
 * ends, NOT at its window reset, which is what the deferral estimates need to
 * distinguish (a 70-second pool cool must not park a run until tomorrow).
 */
export function hasStock(bucket: BucketView, group: JobGroup): boolean {
  if (bucket.remainingChars !== undefined && bucket.remainingChars < groupChars(group)) {
    return false;
  }
  return effectiveRemainingRequests(bucket) >= 1;
}

/**
 * Whether the bucket has spendable rpm/tpm headroom in the CURRENT minute.
 * Deliberately separate from {@link hasStock}: minute exhaustion is the same
 * shape as a cooldown, not stock exhaustion — the bucket refills on its own
 * within seconds, so {@link bucketResumeAt} must defer to `minuteResetAt`,
 * never fall through to the day-scale `nextResetAt`.
 */
export function hasMinuteHeadroom(bucket: BucketView): boolean {
  const rpm = Math.min(
    bucket.remainingMinuteRequests ?? Infinity,
    bucket.poolRemainingMinuteRequests ?? Infinity,
  );
  if (rpm < 1) return false;
  // tpm is best-effort: spend is only known after the call, so this bounds a
  // runaway but cannot stop one oversized batch overshooting the ceiling.
  return (bucket.remainingMinuteTokens ?? Infinity) > 0;
}

/**
 * Earliest instant this bucket could serve the group: cooling and
 * minute-exhaustion are both transient (whichever clock ends later wins);
 * when its DAY-scale stock is gone, the window reset it refills at (a
 * cooldown or a spent minute outlasting that reset still wins — a spent
 * minute must never park a run until tomorrow).
 */
export function bucketResumeAt(bucket: BucketView, group: JobGroup): number {
  return Math.max(
    bucket.cooldownUntil ?? 0,
    hasMinuteHeadroom(bucket) ? 0 : (bucket.minuteResetAt ?? 0),
    hasStock(bucket, group) ? 0 : bucket.nextResetAt,
  );
}

export function isEligible(bucket: BucketView, group: JobGroup, now: number): boolean {
  if (bucket.disabledReason !== undefined) return false;
  if (bucket.cooldownUntil !== undefined && bucket.cooldownUntil > now) return false;
  if (bucket.qualityTier < group.band) return false;
  if (group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)) return false;
  if (!hasMinuteHeadroom(bucket)) return false;
  return hasStock(bucket, group);
}

/** A monthly character budget is a reservoir (1), a daily request window is not (0). */
function isReservoir(bucket: BucketView): number {
  return bucket.remainingChars !== undefined ? 1 : 0;
}

/**
 * Ranks the eligible buckets cheapest-first, where "cheap" is measured
 * RELATIVE to each bucket's own remaining stock. Daily request quotas perish
 * daily while a monthly character budget does not, so reservoir buckets sort
 * BEHIND every request-window bucket regardless of cost — and that class key
 * must stay first, because a reservoir reports MAX_SAFE_INTEGER remaining
 * requests and would otherwise win everything on a relative score of zero.
 *
 * Within each class the primary key is the share of the bucket's remaining
 * stock this group would consume, quantized to permille. Absolute request
 * count is nearly "prefer the largest batch", and in the shipped free-tier
 * pool the largest-batch models are also the tightest daily allowances, so
 * ranking on it alone drains the scarcest buckets on routine work. Quantizing
 * is what keeps that correction narrow: buckets that are abundant relative to
 * the work all score zero and fall through to the request-efficiency key, so
 * scarcity only overrides efficiency once a bucket would give up a measurable
 * slice of what it has left. Rounding also keeps the comparator a valid total
 * order, which an epsilon tolerance would not.
 *
 * Remaining keys: expected requests per job, then soonest reset so daily
 * allowances do not rot unused, then lowest adequate tier, then key.
 */
export function rankCandidates(buckets: BucketView[], group: JobGroup, now: number): BucketView[] {
  const eligible = buckets.filter((b) => isEligible(b, group, now));
  const costs = new Map(eligible.map((b) => [b.bucketKey, requestCost(b, group)]));
  const scarcity = new Map(
    eligible.map((b) => [
      b.bucketKey,
      Math.round((costs.get(b.bucketKey)!.estimatedRequests / effectiveRemainingRequests(b)) * 1000),
    ]),
  );
  return [...eligible].sort((a, b) => {
    if (isReservoir(a) !== isReservoir(b)) return isReservoir(a) - isReservoir(b);
    const sa = scarcity.get(a.bucketKey)!;
    const sb = scarcity.get(b.bucketKey)!;
    if (sa !== sb) return sa - sb;
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

/**
 * The best strictly-higher-tier bucket to retry a gate-failed group on. The
 * caller drives it through `retryWithFeedback`, so targets are assumed to
 * implement feedback retry. Reservoir-last ranking applies here too: a
 * char-window MT bucket can only become `better[0]` when no request-window
 * candidate of a higher tier exists at all.
 */
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
