/**
 * Bucket choice for a whole background engine run (AI review, source review,
 * glossary/category generation). Background work is not planned group-by-group
 * the way a translation run is: the engine binds ONE (module, model) target at
 * run start and keeps it, so this wraps the per-group selector with a synthetic
 * single-job group and an explicit reserve that keeps top-tier free headroom
 * for interactive translation. Pure — callers supply the bucket views.
 */
import { selectBucket, type Selection } from './selector.js';
import type { BucketView, DifficultyBand, JobGroup } from './types.js';

/**
 * Selection-time headroom fence, not a spend cap: a top-tier bucket is passed
 * over for background work when it is already within this many day-scale
 * requests of empty, so the last of the escalation headroom is left for
 * interactive translation. It cannot bound what the run then spends — the
 * engine's item count is unknown here, and a long run on the chosen bucket can
 * still drain it. Engines pass this explicitly rather than letting a planner
 * size a reserve from the background run's own job count.
 */
export const FREEWAY_BACKGROUND_RESERVE = 20;

/** Engine work is judgment-heavy, so it defaults to the second-hardest band. */
const DEFAULT_BACKGROUND_BAND: DifficultyBand = 3;

/**
 * Neutral target language for the synthetic group. A background run's real
 * languages are not known when its module is resolved (items are built after
 * selection), and no snapshot model lists English as weak, so scoring English
 * keeps language-specific penalties (weak-language exclusion, hardness) out of
 * a decision that cannot honestly make them.
 */
const NEUTRAL_LANGUAGE = 'en';

/**
 * One synthetic job: the group only has to be well-formed enough for the
 * selector's cost model. Its empty source text means char-limited (classical
 * MT) buckets are not filtered out here on volume — they drop out at the
 * caller's capability check, which no classical-MT module passes.
 */
function backgroundGroup(band: DifficultyBand): JobGroup {
  return {
    targetLanguage: NEUTRAL_LANGUAGE,
    band,
    jobs: [
      {
        entryId: 'background',
        targetLanguage: NEUTRAL_LANGUAGE,
        sourceText: '',
        maskCount: 0,
        hasLengthLimit: false,
        glossaryTermCount: 0,
      },
    ],
  };
}

/**
 * Pick one bucket for a whole background engine run (judge / source review /
 * glossary / category). Returns undefined when nothing is eligible — the caller
 * then fails the run through its own module-unavailable path rather than
 * falling back to a paid module.
 *
 * Prefers a bucket with spendable minute headroom, but does not require one.
 * Unlike a translation run, this binds ONE bucket at start and has no
 * park/resume path — a translation burst that has spent every eligible
 * bucket's current minute would otherwise fail the whole run at start with
 * "module unavailable", a failure that could not happen before minute
 * pacing existed and that clears itself within seconds. So when nothing
 * clears the paced selection, this retries the same ranking with the minute
 * fields blanked out (day-scale/tier/cooldown/weak-language eligibility
 * still applies in full) and returns whichever bucket that selects instead.
 */
export function selectBackgroundBucket(
  buckets: BucketView[],
  now: number,
  opts?: { band?: DifficultyBand },
): Selection | undefined {
  const group = backgroundGroup(opts?.band ?? DEFAULT_BACKGROUND_BAND);
  const selectOpts = { reserveRequests: FREEWAY_BACKGROUND_RESERVE };
  const paced = selectBucket(group, buckets, now, selectOpts);
  if (paced) return paced;
  const withoutMinuteLimits = buckets.map((b) => ({
    ...b,
    remainingMinuteRequests: undefined,
    remainingMinuteTokens: undefined,
    poolRemainingMinuteRequests: undefined,
  }));
  const relaxed = selectBucket(group, withoutMinuteLimits, now, selectOpts);
  if (!relaxed) return undefined;
  // Return the caller's own bucket object, not the blanked-out clone: the
  // caller identifies buckets by reference (it removes the tried one from
  // its candidate list), and nothing about the relaxation changes the cost
  // model (batchSize/estimatedRequests never read the minute fields).
  const original = buckets.find((b) => b.bucketKey === relaxed.bucket.bucketKey);
  return original ? { ...relaxed, bucket: original } : undefined;
}
