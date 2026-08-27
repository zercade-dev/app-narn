/**
 * The request-economics core: free tiers are request-count-limited, so the
 * router optimizes expected REQUESTS per gate-passed string, not token cost.
 * A weak model that fails the LQA gate costs a full extra request per retry
 * (plus batch splits), so a stronger model is often cheaper in the scarce
 * currency even though both are free.
 */
import type { BucketView, DifficultyBand, JobGroup } from './types.js';
import { getShrinkMaxRequests } from '../../config/env.js';
import { languageHardness } from './difficulty.js';
import { PRIOR_STRENGTH, isGatePassRecord } from './stats.js';

/**
 * First-attempt gate-pass priors by quality tier (row) and difficulty band
 * (column, band-1..4). Corrected at runtime by live per-language evidence,
 * weighted against this prior by sample count. The TIER-3 row is seeded from
 * judged benchmark runs over the bundled free models; every other row remains
 * a curated estimate.
 */
const PASS_PRIORS: Record<1 | 2 | 3 | 4, [number, number, number, number]> = {
  4: [0.99, 0.985, 0.97, 0.95],
  3: [0.99, 0.98, 0.955, 0.925],
  2: [0.96, 0.93, 0.87, 0.78],
  1: [0.96, 0.94, 0.85, 0.75],
};

const MIN_PASS = 0.3;
const MAX_PASS = 0.995;

/**
 * How much harder a band is than band 1 for a given tier, per the curated
 * matrix. A measured per-language prior is a band-agnostic compliance rate
 * over the benchmark corpus; multiplying by this factor re-imposes the band
 * shape without re-imposing the language guesses the measurement replaces.
 */
export function bandFactor(tier: 1 | 2 | 3 | 4, band: DifficultyBand): number {
  return PASS_PRIORS[tier][band - 1] / PASS_PRIORS[tier][0];
}

/**
 * The first-attempt estimate, before any live per-language evidence. When the
 * bucket carries a measured pass prior for this exact language (from the
 * benchmark snapshot — no fallback across compound codes like zh-hans/
 * zh-hant), that measured rate replaces the curated tier×band estimate
 * outright, scaled by `bandFactor` to keep the band shape; the curated
 * weak-language and language-hardness multipliers are guesses the
 * measurement supersedes, so neither applies. Otherwise this is the curated
 * tier×band prior, penalized for a curated weak language and for language
 * hardness. Unclamped either way — the clamp belongs to the posterior in
 * `effectivePassRate`, not to its input.
 */
export function priorPassRate(bucket: BucketView, language: string, band: DifficultyBand): number {
  const measured = bucket.langPassPriors?.[language];
  if (measured !== undefined) return measured * bandFactor(bucket.qualityTier, band);
  let rate = PASS_PRIORS[bucket.qualityTier][band - 1];
  if (bucket.weakLanguages?.includes(language)) rate *= 0.85;
  return rate * (1 - 0.01 * languageHardness(language));
}

/**
 * The posterior mean of a Beta-Binomial whose prior is worth PRIOR_STRENGTH
 * pseudo-observations of `priorPassRate`. With no evidence this is exactly the
 * prior; evidence takes over in proportion to how much of it there is, so a
 * single unlucky string barely moves the estimate while a sustained pattern
 * moves it decisively — and, unlike the fixed blend this replaced, a large
 * sample can overrule the prior outright.
 *
 * Counts arrive already decayed: `loadBucketViews` ages them into the view,
 * which is what keeps this a pure function of the snapshot.
 */
export function effectivePassRate(
  bucket: BucketView,
  language: string,
  band: DifficultyBand,
): number {
  const prior = priorPassRate(bucket, language, band);
  const record = bucket.stats.gatePassStats?.[language];
  const evidence = isGatePassRecord(record) ? record : { s: 0, n: 0 };
  const rate = (PRIOR_STRENGTH * prior + evidence.s) / (PRIOR_STRENGTH + evidence.n);
  return Math.min(MAX_PASS, Math.max(MIN_PASS, rate));
}

/** 0 healthy, 1 degraded, 2 bad — the three tiers `batchSizeFor` sizes batches by. */
export type PassRateClass = 0 | 1 | 2;

/**
 * Which of `batchSizeFor`'s three tiers a pass rate falls in: 0 healthy (full
 * batch), 1 degraded (half), 2 bad (quarter). Lower is better, so it sorts
 * directly.
 *
 * Ranking and batch sizing MUST agree on where the cut points are, which is why
 * this is one function both call rather than two copies of the same two
 * comparisons. See the ranking key in selector.ts for why ranking needs it at
 * all: relative-headroom ordering divides the request-cost penalty by remaining
 * stock, which scales the gate-pass signal down by the abundance ratio until a
 * bucket with a depressed effective pass rate on a large allowance can outrank
 * a healthy one.
 */
export function passRateClass(passRate: number): PassRateClass {
  if (passRate >= 0.9) return 0;
  if (passRate >= 0.75) return 1;
  return 2;
}

/**
 * Pseudo-observations the static snapshot score is worth when live AI-review
 * evidence is blended over it. Deliberately heavier than the gate estimator's
 * PRIOR_STRENGTH: gate outcomes arrive per translated string in the hundreds,
 * while judge verdicts are far rarer and each one can move a class boundary
 * that reorders TRANSLATION routing. With the 3-day half-life and the
 * MAX_SAMPLES cap that already govern these records, a bad patch of verdicts
 * decays out instead of cementing.
 */
export const JUDGE_PRIOR_STRENGTH = 20;

/**
 * Score used as the prior for a (bucket, language) the snapshot never measured.
 * The neutral middle of the "usable/unmeasured" class, so an unmeasured pair
 * with no evidence classifies exactly as it did before this blend existed.
 */
const UNMEASURED_SCORE = 75;

/**
 * Coarse judged-quality class for (bucket, language): 0 publishable (score
 * ≥85), 1 usable / unmeasured (≥70 or no benchmark data), 2 measurably poor
 * (<70). Three classes on purpose: quality only overrides the economics keys
 * when the measured gap is real; ties fall through to scarcity as before.
 * The score itself is a live blend: the static snapshot score (or
 * UNMEASURED_SCORE when the snapshot has none) is a JUDGE_PRIOR_STRENGTH-
 * pseudo-observation prior, corrected by live per-language AI-review verdicts
 * in proportion to how many there are — the same Beta-Binomial shape
 * effectivePassRate uses for gate outcomes, applied to the judge score
 * statistic instead. With neither a static score nor any verdicts, the pair
 * still classifies as unmeasured (1), exactly as it did before this blend
 * existed. Exact-code lookup on both halves — zh-hans evidence never speaks
 * for zh-hant, in the live record just as in the static snapshot.
 */
export function langQualityClass(
  bucket: Pick<BucketView, 'langScores' | 'stats'>,
  language: string,
): 0 | 1 | 2 {
  const staticScore = bucket.langScores?.[language];
  // Exact-code lookup on both halves — zh-hans evidence never speaks for
  // zh-hant, in the live record just as in the snapshot.
  const record = bucket.stats.judgeScoreStats?.[language];
  const evidence = isGatePassRecord(record) ? record : undefined;
  if (staticScore === undefined && evidence === undefined) return 1;
  const prior = staticScore ?? UNMEASURED_SCORE;
  if (evidence === undefined || evidence.n === 0) {
    return prior >= 85 ? 0 : prior >= 70 ? 1 : 2;
  }
  const live =
    (JUDGE_PRIOR_STRENGTH * prior + 100 * evidence.s) / (JUDGE_PRIOR_STRENGTH + evidence.n);
  return live >= 85 ? 0 : live >= 70 ? 1 : 2;
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
 * A group should fit within this share of a bucket's remaining day stock
 * before batches grow past the comfort size: free requests are the scarce
 * currency, so a group that would eat more than a quarter of what's left
 * packs more strings per request instead.
 */
const SPEND_SHARE = 0.25;
/**
 * Remaining stock at or above this many times the comfort-size request count
 * reads as abundant: requests are nearly free there, so a half-size batch
 * buys parse/gate reliability at negligible quota cost.
 */
const ABUNDANCE_FACTOR = 40;
/** Never shrink a comfort batch below this many strings. */
const SHRINK_FLOOR = 4;
/**
 * Largest group, in comfort-size requests, that the abundance shrink may still
 * halve. Above this the shrink is refused: `ABUNDANCE_FACTOR` measures whether
 * requests are cheap in QUOTA, and on an abundant bucket they are — but every
 * request is also a provider round trip on the wall clock, and doubling a
 * ten-request group costs far more time than the reliability is worth. Small
 * groups keep the benefit, where it is nearly free in both currencies.
 */
export const SHRINK_MAX_REQUESTS = (() => {
  const n = Number.parseInt(getShrinkMaxRequests(), 10);
  return Number.isFinite(n) && n > 0 ? n : 4;
})();

function passRateDivisor(passRate: number): number {
  switch (passRateClass(passRate)) {
    case 0:
      return 1;
    case 1:
      return 2;
    default:
      return 4;
  }
}

/**
 * The char-derived per-request cap for THESE jobs on THIS bucket — how many
 * of them fit one reliable request, ignoring scarcity/abundance/pass-rate.
 * Those size the PLANNED batch; this caps what a bucket can physically take
 * when a batch sized for another bucket lands on it mid-dispatch.
 */
export function charCappedBatch(
  bucket: Pick<BucketView, 'maxBatch' | 'charBudget' | 'batchCeiling'>,
  jobs: readonly { sourceText: string }[],
): number {
  if (bucket.charBudget === undefined || jobs.length === 0) return bucket.maxBatch;
  let totalChars = 0;
  for (const job of jobs) totalChars += job.sourceText.length;
  const avgChars = Math.max(1, Math.round(totalChars / jobs.length));
  return Math.min(
    Math.max(1, Math.floor(bucket.charBudget / avgChars)),
    bucket.batchCeiling ?? bucket.maxBatch,
  );
}

/**
 * Strings per request for this bucket and group. Without a curated
 * charBudget the size is the flat maxBatch (scaled by pass-rate class), as
 * before. With one, the size is length-aware and scarcity-aware: the char
 * budget bounds how many of THESE strings fit reliably in one request, the
 * comfort size (maxBatch) is the unpressured default, scarcity grows batches
 * toward the char-derived ceiling so a tight daily allowance covers more of
 * the run, and abundance shrinks them for reliability since retries are
 * nearly free there — but only up to {@link SHRINK_MAX_REQUESTS} comfort-size
 * requests, past which halving would trade too many extra provider round
 * trips for that reliability. The pass-rate divisor stacks on top in every
 * case.
 */
export function batchSizeFor(bucket: BucketView, group: JobGroup, passRate: number): number {
  const divisor = passRateDivisor(passRate);
  if (bucket.charBudget === undefined) {
    return Math.max(1, Math.floor(bucket.maxBatch / divisor));
  }
  const ceiling = bucket.batchCeiling ?? bucket.maxBatch;
  const jobs = group.jobs.length;
  let base: number;
  if (jobs === 0) {
    base = Math.min(bucket.maxBatch, ceiling);
  } else {
    const sizeByChars = charCappedBatch(bucket, group.jobs);
    const comfort = Math.min(bucket.maxBatch, sizeByChars);
    const remaining = effectiveRemainingRequests(bucket);
    const requestsAtComfort = Math.ceil(jobs / comfort);
    const affordable = Math.max(1, Math.floor(remaining * SPEND_SHARE));
    if (requestsAtComfort > affordable) {
      base = Math.min(Math.max(comfort, Math.ceil(jobs / affordable)), sizeByChars);
    } else if (remaining >= ABUNDANCE_FACTOR * requestsAtComfort && requestsAtComfort <= SHRINK_MAX_REQUESTS) {
      base = Math.max(Math.min(SHRINK_FLOOR, comfort), Math.floor(comfort / 2));
    } else {
      base = comfort;
    }
  }
  return Math.max(1, Math.floor(base / divisor));
}

export function estimatedRequests(jobCount: number, batchSize: number, passRate: number): number {
  return Math.ceil(Math.ceil(jobCount / batchSize) / passRate);
}

export function requestCost(
  bucket: BucketView,
  group: JobGroup,
): { batchSize: number; estimatedRequests: number; requestsPerJob: number; passRate: number } {
  const passRate = effectivePassRate(bucket, group.targetLanguage, group.band);
  const batchSize = batchSizeFor(bucket, group, passRate);
  if (group.jobs.length === 0) {
    return { batchSize, estimatedRequests: 0, requestsPerJob: 0, passRate };
  }
  const est = estimatedRequests(group.jobs.length, batchSize, passRate);
  return { batchSize, estimatedRequests: est, requestsPerJob: est / group.jobs.length, passRate };
}

/** Prompt scaffolding tokens per request beyond the strings themselves. */
const REQUEST_TOKEN_OVERHEAD = 120;
/** Bounds for the observed output-per-input token ratio. */
const MIN_OUT_RATIO = 0.5;
const MAX_OUT_RATIO = 12;
/** Ratio assumed until the day window has a meaningful input sample. */
const DEFAULT_OUT_RATIO = 2;
const OUT_RATIO_MIN_SAMPLE = 500;

/**
 * Projected TOTAL tokens (input + output) of one request of avgRequestChars
 * source payload on this bucket. Output dominates real token spend on
 * reasoning models (observed 2–10× input), so minute-token budgeting from
 * input alone overshoots provider TPM ceilings; the bucket's own day-window
 * tallies calibrate the ratio without per-model curation. A bucket with no
 * observed tally yet (fixture or brand-new day window) reads as zero input,
 * which is the same cold-start branch as a thin sample.
 */
export function projectedRequestTokens(
  bucket: Pick<BucketView, 'dayInputTokens' | 'dayOutputTokens'>,
  avgRequestChars: number,
): number {
  const estInput = Math.ceil(avgRequestChars / 4) + REQUEST_TOKEN_OVERHEAD;
  const dayInputTokens = bucket.dayInputTokens ?? 0;
  const dayOutputTokens = bucket.dayOutputTokens ?? 0;
  const outRatio =
    dayInputTokens >= OUT_RATIO_MIN_SAMPLE
      ? Math.min(MAX_OUT_RATIO, Math.max(MIN_OUT_RATIO, dayOutputTokens / dayInputTokens))
      : DEFAULT_OUT_RATIO;
  return Math.ceil(estInput * (1 + outRatio));
}
