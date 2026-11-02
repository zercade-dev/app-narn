/**
 * Run-level planning: sees the whole run before dispatch, assigns each job
 * group to the adequate bucket that consumes the smallest share of its own
 * remaining stock, against a working copy of quota headroom, and decides UP
 * FRONT what defers (with a resume estimate) when
 * the run does not fit today's remaining free capacity. Re-planning after a
 * surprise (429, cooldown, drained bucket) is the same pure call on the
 * remaining groups with fresh BucketViews.
 */
import type { FreewayPriority } from '@zercade-dev/narn-shared';
import type { Assignment, BucketView, DifficultyBand, JobGroup, RunPlan } from './types.js';
import {
  bucketResumeAt,
  deferralReason,
  rankCandidates,
  selectBucket,
  type Selection,
} from './selector.js';
import {
  effectiveRemainingRequests,
  effectiveSpeedMsPerString,
  langQualityClass,
  passRateClass,
  projectedRequestTokens,
  requestCost,
  speedBand,
} from './scoring.js';
import type { FreewayCooldownReason } from '../../storage/types.js';
import { getPlanHorizonMinutes } from '../../config/env.js';

export interface PlanOptions {
  now: number;
  reserveRequests?: number;
  priorityClass?: 'translate' | 'background';
  belowTarget?: 'ask' | 'allow';
  /** Translation speed/quality priority; omitted keeps the background and Addendum G ordering. */
  priority?: FreewayPriority;
}

export function defaultReserve(totalJobs: number): number {
  return Math.min(20, Math.max(2, Math.ceil(totalJobs * 0.03)));
}

/**
 * Waits at or under this threshold defer without relaxing the quality floor.
 * Longer waits allow the below-target decision, or the legacy one-tier
 * degrade when no decision mode is supplied (Addendum G).
 */
export const FREEWAY_DEGRADE_WAIT_MS = 15 * 60_000;

/**
 * How many minutes of a bucket's per-minute allowance one plan may commit.
 *
 * A plan sees the whole run, but `spendAssignment` charges minute headroom as
 * though every request in it fired at the same instant. For a run that will
 * genuinely span ten minutes that reads a 5-rpm bucket as worth five requests
 * — so the highest-quality buckets, which are exactly the scarce ones, get
 * skipped in favour of whatever still has minute headroom this second. The
 * horizon budgets the allowance over the run's real span instead; the rate
 * governor enforces the pacing at dispatch time. Day, pool and character
 * limits are untouched and still bind.
 */
export const PLAN_HORIZON_MINUTES = (() => {
  const n = Number.parseInt(getPlanHorizonMinutes(), 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
})();

/** A bucket's minute budget for one plan: this window's headroom plus the horizon's worth. */
function horizonBudget(
  remaining: number | undefined,
  declared: number | undefined,
): number | undefined {
  if (remaining === undefined) return undefined;
  if (declared === undefined) return remaining;
  return remaining + declared * (PLAN_HORIZON_MINUTES - 1);
}

/** Tier/language/credential eligibility ignoring transient quota state. */
function everServable(bucket: BucketView, group: JobGroup): boolean {
  if (bucket.disabledReason !== undefined) return false;
  if (bucket.qualityTier < group.band) return false;
  if (bucket.blockedLanguages?.includes(group.targetLanguage)) return false;
  if (group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)) return false;
  return true;
}

export function isTooSlow(bucket: BucketView): boolean {
  return speedBand(effectiveSpeedMsPerString(bucket)) === 'too-slow';
}

/** Highest available tier below the target, with normal ranking within that tier. */
function legacyBelowTargetBucket(
  group: JobGroup,
  buckets: BucketView[],
  now: number,
): Selection | undefined {
  for (const tier of [3, 2, 1] as const) {
    if (tier >= group.band) continue;
    const selection = selectBucket(
      group,
      buckets.filter((bucket) => bucket.qualityTier === tier),
      now,
      { tierFloor: tier },
    );
    if (selection) return selection;
  }
  return undefined;
}

/**
 * The lower-tier bucket to use below target. Too slow candidates only count
 * when nothing else can serve. Quality and Balanced take the highest tier;
 * Speed also considers one tier below it. The priority's own ranking then
 * picks among those. Without a priority the legacy ordering applies.
 */
export function chooseBelowTargetBucket(
  group: JobGroup,
  buckets: BucketView[],
  now: number,
  priority?: FreewayPriority,
): Selection | undefined {
  if (priority === undefined) return legacyBelowTargetBucket(group, buckets, now);
  const eligible = rankCandidates(
    buckets.filter((bucket) => bucket.qualityTier < group.band),
    group,
    now,
    { tierFloor: 1 },
  );
  const notTooSlow = eligible.filter((bucket) => !isTooSlow(bucket));
  const pool = notTooSlow.length > 0 ? notTooSlow : eligible;
  if (pool.length === 0) return undefined;
  const topTier = Math.max(...pool.map((bucket) => bucket.qualityTier));
  const lowest = priority === 'speed' ? topTier - 1 : topTier;
  const window = pool.filter((bucket) => bucket.qualityTier >= lowest);
  const selection = selectBucket(
    group,
    window,
    now,
    // Below target, Balanced takes the faster band within the chosen tier, so it
    // ranks like Speed over a window of one tier.
    { tierFloor: 1, priority: priority === 'quality' ? 'quality' : 'speed' },
  );
  if (!selection || priority !== 'speed') return selection;

  // The window trades a tier for a faster band. Once the band is settled, a
  // lower tier that is no faster and no better judged is a pure loss, so take
  // the highest tier that matches the winner's band and quality classes.
  const winner = selection.bucket;
  const winnerBand = speedBand(effectiveSpeedMsPerString(winner));
  const classesOf = (bucket: BucketView): string => {
    const cost = requestCost(bucket, group);
    return [
      bucket.remainingChars !== undefined ? 1 : 0,
      passRateClass(cost.passRate),
      langQualityClass(bucket, group.targetLanguage),
    ].join('/');
  };
  const winnerClasses = classesOf(winner);
  const peers = rankCandidates(window, group, now, { tierFloor: 1, priority: 'speed' }).filter(
    (bucket) =>
      speedBand(effectiveSpeedMsPerString(bucket)) === winnerBand &&
      classesOf(bucket) === winnerClasses &&
      effectiveRemainingRequests(bucket) >= requestCost(bucket, group).estimatedRequests,
  );
  const best = peers.reduce(
    (top, bucket) => (bucket.qualityTier > top.qualityTier ? bucket : top),
    winner,
  );
  if (best.bucketKey === winner.bucketKey) return selection;
  return selectBucket(group, [best], now, { tierFloor: 1, priority: 'speed' });
}

export type TooSlowAlternative =
  | { kind: 'defer'; resumeAt: number; reason?: FreewayCooldownReason }
  | { kind: 'degrade'; selection: Selection };

/**
 * The shared last-resort rule for a group whose selection is a Too slow model
 * (only meaningful once a priority is set). A faster at-target bucket back
 * within the short wait beats it; otherwise, with permission to go below
 * target, a faster lower-tier bucket does. Undefined means use the Too slow
 * selection. Used at plan time and when re-validating at dispatch.
 */
export function tooSlowAlternative(
  group: JobGroup,
  buckets: BucketView[],
  now: number,
  opts: { priority: FreewayPriority; allowBelowTarget: boolean },
): TooSlowAlternative | undefined {
  const faster = buckets.filter((b) => everServable(b, group) && !isTooSlow(b));
  if (faster.length > 0) {
    const soonest = Math.min(...faster.map((b) => bucketResumeAt(b, group)));
    if (soonest - now <= FREEWAY_DEGRADE_WAIT_MS) {
      const reason = deferralReason(faster, group, soonest);
      return { kind: 'defer', resumeAt: soonest, ...(reason ? { reason } : {}) };
    }
  }
  if (opts.allowBelowTarget) {
    const below = chooseBelowTargetBucket(group, buckets, now, opts.priority);
    if (below && !isTooSlow(below.bucket)) return { kind: 'degrade', selection: below };
  }
  return undefined;
}

/**
 * Records a winning selection onto the plan and spends the working-copy
 * headroom it consumes — day/minute/pool/char figures alike — exactly once,
 * whether the selection came from the group's own band floor or a lower tier.
 */
function spendAssignment(
  plan: RunPlan,
  working: BucketView[],
  group: JobGroup,
  selection: Selection,
  degraded?: Assignment['degraded'],
): void {
  const { bucket, batchSize, estimatedRequests } = selection;
  let groupChars = 0;
  for (const job of group.jobs) groupChars += job.sourceText.length;
  plan.assignments.push({
    group,
    bucketKey: bucket.bucketKey,
    // The instance Freeway actually dispatches to, not the bare base —
    // see BucketView.dispatchModuleId.
    moduleId: bucket.dispatchModuleId ?? bucket.moduleId,
    modelId: bucket.modelId,
    batchSize,
    estimatedRequests,
    ...(degraded ? { degraded } : {}),
  });
  bucket.remainingRequests = Math.max(0, bucket.remainingRequests - estimatedRequests);
  // The minute figure needs the same working-copy spend as the day figure,
  // or every group in this plan reads the same static rpm headroom and the
  // planner bursts them all into one minute — exactly the failure this file
  // exists to prevent.
  if (bucket.remainingMinuteRequests !== undefined) {
    bucket.remainingMinuteRequests = Math.max(
      0,
      bucket.remainingMinuteRequests - estimatedRequests,
    );
  }
  // Tokens are per-bucket, with no pool-wide sibling fold: a shared rpm pool
  // caps request counts across a provider's models, but each model still has
  // its own tokens-per-minute ceiling.
  if (bucket.remainingMinuteTokens !== undefined) {
    const avgChars = group.jobs.length === 0 ? 0 : groupChars / group.jobs.length;
    const requestChars = Math.round(avgChars * Math.min(batchSize, group.jobs.length));
    bucket.remainingMinuteTokens = Math.max(
      0,
      bucket.remainingMinuteTokens -
        projectedRequestTokens(bucket, requestChars) * estimatedRequests,
    );
  }
  // An account-wide pool is spent by whichever of its models is used, so the
  // same requests come off every sibling's working headroom too — otherwise
  // the plan promises each model the whole shared allowance.
  if (bucket.poolKey !== undefined) {
    for (const sibling of working) {
      if (sibling.poolKey !== bucket.poolKey) continue;
      if (sibling.poolRemainingRequests === undefined) continue;
      sibling.poolRemainingRequests = Math.max(
        0,
        sibling.poolRemainingRequests - estimatedRequests,
      );
    }
  }
  // A shared rpm pool doesn't require a shared rpd pool — a provider can
  // share only its per-minute allowance, in which case poolKey above stays
  // undefined (see BucketView.poolRemainingMinuteRequests) — so this folds
  // independently across every bucket of the same provider rather than
  // piggybacking on the poolKey loop.
  if (bucket.poolRemainingMinuteRequests !== undefined) {
    for (const sibling of working) {
      if (sibling.providerKey !== bucket.providerKey) continue;
      if (sibling.poolRemainingMinuteRequests === undefined) continue;
      sibling.poolRemainingMinuteRequests = Math.max(
        0,
        sibling.poolRemainingMinuteRequests - estimatedRequests,
      );
    }
  }
  if (bucket.remainingChars !== undefined) {
    bucket.remainingChars = Math.max(0, bucket.remainingChars - groupChars);
  }
}

export function planRun(groups: JobGroup[], buckets: BucketView[], opts: PlanOptions): RunPlan {
  const totalJobs = groups.reduce((sum, g) => sum + g.jobs.length, 0);
  const reserve = opts.reserveRequests ?? defaultReserve(totalJobs);
  const background = opts.priorityClass === 'background';
  // Working copies: the planner spends headroom as it assigns. A background
  // run leaves the reserve untouched for interactive work — including on an
  // account-wide pool, where the reserve comes off the ONE shared budget (each
  // sibling's view carries the same pool figure, so subtracting from every view
  // takes it off the pool once, not once per model).
  const working = buckets.map((b) => ({
    ...b,
    remainingRequests: background
      ? Math.max(0, b.remainingRequests - reserve)
      : b.remainingRequests,
    poolRemainingRequests:
      background && b.poolRemainingRequests !== undefined
        ? Math.max(0, b.poolRemainingRequests - reserve)
        : b.poolRemainingRequests,
    remainingMinuteRequests: horizonBudget(b.remainingMinuteRequests, b.rpm),
    remainingMinuteTokens: horizonBudget(b.remainingMinuteTokens, b.tpm),
    poolRemainingMinuteRequests: horizonBudget(b.poolRemainingMinuteRequests, b.poolRpm),
  }));
  const ordered = [...groups].sort((a, b) => {
    if (a.band !== b.band) return b.band - a.band;
    if (a.jobs.length !== b.jobs.length) return b.jobs.length - a.jobs.length;
    return a.targetLanguage < b.targetLanguage ? -1 : 1;
  });
  const plan: RunPlan = { assignments: [], deferred: [], needsConfirmation: [], blocked: [] };
  for (const group of ordered) {
    const selection = selectBucket(group, working, opts.now, {
      reserveRequests: background ? 0 : reserve,
      priority: opts.priority,
    });
    if (selection && opts.priority !== undefined && isTooSlow(selection.bucket)) {
      const alternative = tooSlowAlternative(group, working, opts.now, {
        priority: opts.priority,
        allowBelowTarget: opts.belowTarget === 'allow',
      });
      if (alternative?.kind === 'defer') {
        plan.deferred.push({
          group,
          resumeAt: alternative.resumeAt,
          ...(alternative.reason ? { reason: alternative.reason } : {}),
        });
        continue;
      }
      if (alternative?.kind === 'degrade') {
        spendAssignment(plan, working, group, alternative.selection, {
          fromTier: group.band,
          toTier: alternative.selection.bucket.qualityTier,
          waitedAlternativeMs: null,
        });
        continue;
      }
    }
    if (selection) {
      spendAssignment(plan, working, group, selection);
      continue;
    }
    // Estimated against the WORKING copies, so headroom this plan already
    // committed to earlier groups isn't offered to this one as stock.
    const everCandidates = working.filter((b) => everServable(b, group));
    if (opts.belowTarget !== undefined) {
      const resumeAt =
        everCandidates.length === 0
          ? null
          : Math.min(...everCandidates.map((b) => bucketResumeAt(b, group)));
      if (resumeAt !== null && resumeAt - opts.now <= FREEWAY_DEGRADE_WAIT_MS) {
        const reason = deferralReason(everCandidates, group, resumeAt);
        plan.deferred.push({ group, resumeAt, ...(reason ? { reason } : {}) });
        continue;
      }

      const below = chooseBelowTargetBucket(group, working, opts.now, opts.priority);
      if (below) {
        if (opts.belowTarget === 'ask') {
          plan.needsConfirmation.push({
            group,
            bestTier: below.bucket.qualityTier,
            bestModelId: below.bucket.modelId,
            resumeAt,
            ...(opts.priority !== undefined && isTooSlow(below.bucket)
              ? { bestIsTooSlow: true as const }
              : {}),
          });
        } else {
          spendAssignment(plan, working, group, below, {
            fromTier: group.band,
            toTier: below.bucket.qualityTier,
            waitedAlternativeMs: resumeAt === null ? null : resumeAt - opts.now,
          });
        }
        continue;
      }

      const lowerCandidates = working.filter(
        (bucket) =>
          bucket.qualityTier < group.band &&
          everServable(bucket, { ...group, band: bucket.qualityTier }) &&
          !(group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)),
      );
      const candidates = [...everCandidates, ...lowerCandidates];
      if (candidates.length === 0) {
        plan.blocked.push(group);
        continue;
      }
      const soonest = Math.min(...candidates.map((bucket) => bucketResumeAt(bucket, group)));
      const reason = deferralReason(candidates, group, soonest);
      plan.deferred.push({ group, resumeAt: soonest, ...(reason ? { reason } : {}) });
      continue;
    }
    if (everCandidates.length === 0) {
      plan.blocked.push(group);
      continue;
    }
    const resumeAt = Math.min(...everCandidates.map((b) => bucketResumeAt(b, group)));
    // Addendum G: a group parked past FREEWAY_DEGRADE_WAIT_MS relaxes its
    // band floor ONE tier rather than parking for the long wait. Only a
    // bucket exactly one tier below the floor qualifies — a bucket AT the
    // floor would already have won the call above — checked explicitly
    // rather than trusted from the relaxed-band eligibility call alone,
    // because relaxing the band also relaxes the `band >= 3` weak-language
    // exclusion: a bucket this language is curated weak for at the ORIGINAL
    // floor could otherwise slip back in at (or above) that same floor once
    // the check no longer applies to the lower band.
    if (group.band > 1 && resumeAt - opts.now > FREEWAY_DEGRADE_WAIT_MS) {
      const toTier = (group.band - 1) as DifficultyBand;
      const degradeSelection = selectBucket({ ...group, band: toTier }, working, opts.now, {
        reserveRequests: background ? 0 : reserve,
      });
      if (degradeSelection && degradeSelection.bucket.qualityTier === toTier) {
        spendAssignment(plan, working, group, degradeSelection, {
          fromTier: group.band,
          toTier,
          waitedAlternativeMs: resumeAt - opts.now,
        });
        continue;
      }
      // The degrade wait qualified but no sub-tier bucket is servable RIGHT
      // NOW (e.g. the only tier-below bucket is minute-cooling at this
      // instant). Park until the sooner of the qualified wait and that
      // bucket's own resume, or the group day-parks a wait the degrade was
      // meant to avoid. Weak-language check at the ORIGINAL band, mirroring
      // the comment above.
      const subTier = working.filter(
        (b) =>
          b.disabledReason === undefined &&
          b.qualityTier === toTier &&
          !b.blockedLanguages?.includes(group.targetLanguage) &&
          !(group.band >= 3 && b.weakLanguages?.includes(group.targetLanguage)),
      );
      if (subTier.length > 0) {
        const relaxedGroup = { ...group, band: toTier };
        const subResume = Math.min(...subTier.map((b) => bucketResumeAt(b, relaxedGroup)));
        const soonest = Math.min(resumeAt, subResume);
        const reason =
          soonest === subResume
            ? deferralReason(subTier, relaxedGroup, soonest)
            : deferralReason(everCandidates, group, soonest);
        plan.deferred.push({ group, resumeAt: soonest, ...(reason ? { reason } : {}) });
        continue;
      }
    }
    const reason = deferralReason(everCandidates, group, resumeAt);
    plan.deferred.push({ group, resumeAt, ...(reason ? { reason } : {}) });
  }
  return plan;
}
