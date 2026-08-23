/**
 * Chooses the concrete bucket for one job group. Filtering enforces the
 * quality floor and live quota state. Ranking is reservoir-last FIRST — a
 * monthly character budget (classical MT) sorts behind every daily-request
 * bucket, because only the daily allowance perishes — then, within a
 * reservoir class, buckets are split by effective pass-rate class so a
 * degraded bucket can never win on abundance alone; only within one pass-rate
 * class does it minimize the share of each bucket's REMAINING stock a group
 * consumes (falling back to expected requests per job between buckets that
 * are equally unstressed), tie-breaking toward buckets whose quota expires
 * soonest; a reserve keeps top-tier headroom for escalation retries.
 */
import type { BucketView, JobGroup } from './types.js';
import {
  effectiveRemainingRequests,
  langQualityClass,
  passRateClass,
  requestCost,
} from './scoring.js';

export { effectiveRemainingRequests };

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
 * A nominal anti-dribble floor: below this many minute-tokens the remainder
 * is too thin to bother admitting a bucket for, even though it is not
 * literally zero.
 */
export const MIN_MINUTE_TOKENS_FLOOR = 200;

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
  return (bucket.remainingMinuteTokens ?? Infinity) >= MIN_MINUTE_TOKENS_FLOOR;
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

/**
 * Every {@link isEligible} criterion except the minute check, factored out
 * into its own function — rather than inlined into {@link isEligible} and
 * duplicated — so the minute check and the rest of this list cannot drift
 * apart as either gains a criterion. Both {@link isEligible} (AND the minute
 * check) and {@link findMinuteStarvedEscalation} (to tell true minute
 * starvation apart from a bucket that is ALSO cooling or day-exhausted,
 * which just happens to have a spent minute too — the common case right
 * after a gate failure, since dispatch activity tends to spend both
 * together) compose it.
 */
export function isEligibleIgnoringMinute(
  bucket: BucketView,
  group: JobGroup,
  now: number,
): boolean {
  if (bucket.disabledReason !== undefined) return false;
  if (bucket.cooldownUntil !== undefined && bucket.cooldownUntil > now) return false;
  if (bucket.qualityTier < group.band) return false;
  if (bucket.blockedLanguages?.includes(group.targetLanguage)) return false;
  if (group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)) return false;
  return hasStock(bucket, group);
}

export function isEligible(bucket: BucketView, group: JobGroup, now: number): boolean {
  if (!hasMinuteHeadroom(bucket)) return false;
  return isEligibleIgnoringMinute(bucket, group, now);
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
 * Within each reservoir class, buckets are first split by pass-rate class
 * (below); within one pass-rate class the primary key is the percentage of a
 * bucket's remaining stock this group would consume. Absolute request count
 * is nearly "prefer the largest batch", and in the shipped free-tier pool the
 * largest-batch models are also the tightest daily allowances, so ranking on
 * it alone drains the scarcest buckets on routine work.
 *
 * Rounding to whole percent bounds the correction: a bucket with room to spare
 * for this group scores zero and falls through to the request-efficiency key,
 * so two comfortably-stocked buckets are still ordered by batch economics
 * alone. Rounding also keeps the comparator a valid total order, which an
 * epsilon tolerance would not.
 *
 * One trade: a nearly-spent bucket now sorts LAST even when its window resets
 * soonest, so the reset key can no longer stop a small perishing allowance
 * going unused. That costs nothing while demand is low enough for the abundant
 * buckets to cover the work, and when demand is high they drain and the scarce
 * bucket is reached anyway.
 *
 * The pass-rate class is why that key sits above scarcity. It classifies
 * `effectivePassRate` — the tier/band prior, adjusted for a curated
 * weak-language penalty, then weighted against live per-language evidence by
 * how much of that evidence exists — which is M32's whole quality signal and
 * reaches ranking only by inflating `estimatedRequests`: a depressed rate both
 * shrinks `batchSizeFor` and divides the batch count. Dividing by remaining
 * stock scales that signal down by the abundance ratio, which runs 14x to
 * 720x across the shipped snapshot, so on cost alone a bucket with a
 * depressed effective rate on a large allowance outranks a healthier one on a
 * smaller allowance. This fires before any live feedback exists, too: an
 * unmeasured bucket listed in `weakLanguages` for this language at band 1–2
 * stays eligible (only band ≥ 3 excludes it) and lands a class worse purely
 * on its curated prior — once a bucket has a MEASURED `langPassPriors` entry
 * for the language, `priorPassRate` uses that rate outright and the curated
 * weak-language multiplier no longer applies, so this only degrades buckets
 * with no live-benchmark evidence for the language. The class key stops all
 * of that structurally: a worse-class bucket can never win on abundance.
 * Within one class nothing changes, and when every candidate ties on class,
 * ordering falls through to the next key, so a hard language does not
 * deadlock.
 *
 * `langQualityClass` (below) sits directly beneath pass-rate class and above
 * scarcity, for the same structural reason but a different signal: it reads
 * JUDGED per-language benchmark scores (`langScores`) rather than the
 * estimated gate-pass rate `passRateClass` reads, so a bucket that has never
 * failed a live gate check for this language can still be outranked here
 * once the benchmark has judged its actual output poor. A bucket with no
 * `langScores` entry for the language lands in class 1 alongside merely
 * adequate ones, so missing benchmark data is neutral — it neither penalizes
 * nor rewards a candidate, and a bucket only gains ground on this key against
 * a rival with a worse MEASURED score. Ties, including the common
 * both-unmeasured case, fall through to scarcity exactly as before.
 *
 * Remaining keys: scarcity percent, then expected requests per job, then
 * soonest reset, then lowest adequate tier, then key.
 */
export function rankCandidates(buckets: BucketView[], group: JobGroup, now: number): BucketView[] {
  const eligible = buckets.filter((b) => isEligible(b, group, now));
  const costs = new Map(eligible.map((b) => [b.bucketKey, requestCost(b, group)]));
  const scarcity = new Map(
    eligible.map((b) => [
      b.bucketKey,
      Math.round((costs.get(b.bucketKey)!.estimatedRequests / effectiveRemainingRequests(b)) * 100),
    ]),
  );
  const classes = new Map(
    eligible.map((b) => [b.bucketKey, passRateClass(costs.get(b.bucketKey)!.passRate)]),
  );
  const langClasses = new Map(
    eligible.map((b) => [b.bucketKey, langQualityClass(b, group.targetLanguage)]),
  );
  return [...eligible].sort((a, b) => {
    if (isReservoir(a) !== isReservoir(b)) return isReservoir(a) - isReservoir(b);
    const qa = classes.get(a.bucketKey)!;
    const qb = classes.get(b.bucketKey)!;
    if (qa !== qb) return qa - qb;
    const la = langClasses.get(a.bucketKey)!;
    const lb = langClasses.get(b.bucketKey)!;
    if (la !== lb) return la - lb;
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
 * Every strictly-higher-tier bucket that could retry a gate-failed group,
 * best first. The caller drives the retry through `retryWithFeedback` and is
 * the only layer that can test whether a candidate's MODULE implements it
 * (DeepL does not) — so this returns the ranked ladder and the caller takes
 * the first capable rung, rather than this function guessing at capability.
 * Reservoir-last ranking applies here too.
 */
export function selectEscalationCandidates(
  failedBucketKey: string,
  group: JobGroup,
  buckets: BucketView[],
  now: number,
): Selection[] {
  const failedTier = buckets.find((b) => b.bucketKey === failedBucketKey)?.qualityTier ?? 0;
  return rankCandidates(buckets, group, now)
    .filter((b) => b.qualityTier > failedTier && b.bucketKey !== failedBucketKey)
    .map((b) => toSelection(b, group));
}

/**
 * The higher-tier bucket that WOULD have served this group if its current
 * minute were not spent — for diagnostics only. Escalation deliberately does
 * not dispatch into a spent minute (a 429 without a Retry-After cools the
 * bucket until the next DAY boundary, and the alternative here is a working
 * same-module corrective retry), so this exists purely so the log can name the
 * bucket the caller actually lost.
 *
 * Ranked rather than found: with more than one starved candidate, snapshot
 * iteration order would name an arbitrary bucket while the log implies "the one
 * that would have served this".
 *
 * `isEligibleIgnoringMinute` gates it in addition to the tier check — a bucket
 * that is ALSO cooling or day-exhausted commonly has a spent minute too, since
 * dispatch activity right before a gate failure spends both together, and
 * reporting "clears in ~60s" about a bucket cooled until tomorrow is worse than
 * staying silent.
 *
 * The minute-blanked clones exist only to reach the comparator and never leave
 * this function: the returned value is the caller's own BucketView, so its real
 * `minuteResetAt` and minute counters are what gets reported.
 */
export function findMinuteStarvedEscalation(
  failedBucketKey: string,
  group: JobGroup,
  buckets: BucketView[],
  now: number,
): BucketView | undefined {
  const failedTier = buckets.find((b) => b.bucketKey === failedBucketKey)?.qualityTier ?? 0;
  const starved = buckets.filter(
    (b) =>
      b.qualityTier > failedTier &&
      b.bucketKey !== failedBucketKey &&
      !hasMinuteHeadroom(b) &&
      isEligibleIgnoringMinute(b, group, now),
  );
  if (starved.length === 0) return undefined;
  const blanked = starved.map((b) => ({
    ...b,
    remainingMinuteRequests: undefined,
    remainingMinuteTokens: undefined,
    poolRemainingMinuteRequests: undefined,
  }));
  const best = rankCandidates(blanked, group, now)[0];
  if (best === undefined) return undefined;
  return starved.find((b) => b.bucketKey === best.bucketKey);
}
