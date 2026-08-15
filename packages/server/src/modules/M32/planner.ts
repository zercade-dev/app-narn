/**
 * Run-level planning: sees the whole run before dispatch, assigns each job
 * group to the cheapest adequate bucket against a working copy of quota
 * headroom, and decides UP FRONT what defers (with a resume estimate) when
 * the run does not fit today's remaining free capacity. Re-planning after a
 * surprise (429, cooldown, drained bucket) is the same pure call on the
 * remaining groups with fresh BucketViews.
 */
import type { BucketView, JobGroup, RunPlan } from './types.js';
import { bucketResumeAt, selectBucket } from './selector.js';

export interface PlanOptions {
  now: number;
  reserveRequests?: number;
  priorityClass?: 'translate' | 'background';
}

export function defaultReserve(totalJobs: number): number {
  return Math.min(20, Math.max(2, Math.ceil(totalJobs * 0.03)));
}

/** Tier/language/credential eligibility ignoring transient quota state. */
function everServable(bucket: BucketView, group: JobGroup): boolean {
  if (bucket.disabledReason !== undefined) return false;
  if (bucket.qualityTier < group.band) return false;
  if (group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)) return false;
  return true;
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
  }));
  const ordered = [...groups].sort((a, b) => {
    if (a.band !== b.band) return b.band - a.band;
    if (a.jobs.length !== b.jobs.length) return b.jobs.length - a.jobs.length;
    return a.targetLanguage < b.targetLanguage ? -1 : 1;
  });
  const plan: RunPlan = { assignments: [], deferred: [], blocked: [] };
  for (const group of ordered) {
    const selection = selectBucket(group, working, opts.now, {
      reserveRequests: background ? 0 : reserve,
    });
    if (selection) {
      const { bucket, batchSize, estimatedRequests } = selection;
      plan.assignments.push({
        group,
        bucketKey: bucket.bucketKey,
        // The instance Freeway actually dispatches to, not the bare base —
        // see BucketView.dispatchModuleId.
        moduleId: bucket.dispatchModuleId ?? bucket.moduleId,
        modelId: bucket.modelId,
        batchSize,
        estimatedRequests,
      });
      bucket.remainingRequests = Math.max(0, bucket.remainingRequests - estimatedRequests);
      // The minute figure needs the same working-copy spend as the day
      // figure, or every group in this plan reads the same static rpm
      // headroom and the planner bursts them all into one minute — exactly
      // the failure this file exists to prevent.
      if (bucket.remainingMinuteRequests !== undefined) {
        bucket.remainingMinuteRequests = Math.max(
          0,
          bucket.remainingMinuteRequests - estimatedRequests,
        );
      }
      // An account-wide pool is spent by whichever of its models is used, so
      // the same requests come off every sibling's working headroom too —
      // otherwise the plan promises each model the whole shared allowance.
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
      // share only its per-minute allowance, in which case poolKey above
      // stays undefined (see BucketView.poolRemainingMinuteRequests) — so
      // this folds independently across every bucket of the same provider
      // rather than piggybacking on the poolKey loop.
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
        let chars = 0;
        for (const job of group.jobs) chars += job.sourceText.length;
        bucket.remainingChars = Math.max(0, bucket.remainingChars - chars);
      }
      continue;
    }
    // Estimated against the WORKING copies, so headroom this plan already
    // committed to earlier groups isn't offered to this one as stock.
    const everCandidates = working.filter((b) => everServable(b, group));
    if (everCandidates.length === 0) {
      plan.blocked.push(group);
      continue;
    }
    const resumeAt = Math.min(...everCandidates.map((b) => bucketResumeAt(b, group)));
    plan.deferred.push({ group, resumeAt });
  }
  return plan;
}
