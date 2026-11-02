/**
 * Pure resolution layer: turns router-produced freeway RoutingDecisions into
 * concrete (module, model) assignments against a set of BucketViews, and
 * re-validates one already-assigned group at dispatch time when its bucket
 * may have moved since the run was planned. No I/O, no clock reads — `now`
 * is always a caller-supplied parameter so both entry points are
 * deterministic and unit-testable without a fake timer.
 */
import type { RoutingDecision } from '@zercade-dev/narn-shared';
import type { FreewayPriority } from '@zercade-dev/narn-shared';
import { getLengthLimit } from '@zercade-dev/narn-shared';
import { difficultyBand, groupJobs } from './difficulty.js';
import { chooseBelowTargetBucket, isTooSlow, planRun, tooSlowAlternative } from './planner.js';
import { bucketResumeAt, deferralReason, isEligible, selectBucket } from './selector.js';
import type { FreewayCooldownReason } from '../../storage/types.js';
import type { Assignment, BucketView, DifficultyBand, FreewayJob, JobGroup } from './types.js';

/**
 * Placeholder-density fallback: `{{mustache}}`, `{unity}`, `%s`/`%d`
 * printf-style tokens. M17's own mask helpers (`maskText` and friends) need a
 * glossary term list and a full tag-tree parse to run, and their token
 * grammar (`{t:N}`/`{v:N}`/`{g:N}`/`{e:N}`) is a *different* placeholder
 * format from the one this heuristic counts — there is no clean, side-effect-free
 * M17 export that just counts these generic placeholder shapes, so this
 * regex is the intentional fallback.
 */
const PLACEHOLDER_RE = /\{\{?[^}]*\}\}?|%[sd]/g;

export interface FreewayResolution {
  /** Rewritten concrete decisions, grouped per assignment (one array per assignment). */
  assignedGroups: Array<{
    decisions: RoutingDecision[];
    bucketKey: string;
    batchSize: number;
    /** Set when the plan relaxed this group's band floor — see {@link Assignment.degraded}. */
    degraded?: Assignment['degraded'];
  }>;
  /** Pairs that wait for quota, with the plan's resume estimate. */
  deferred: {
    pairs: Array<{ entryId: string; targetLanguage: string }>;
    resumeAt: number;
    reason?: FreewayCooldownReason;
  } | null;
  /** Pairs that need consent before using a currently available lower tier. */
  needsConfirmation: Array<{
    pairs: Array<{ entryId: string; targetLanguage: string }>;
    resumeAt: number | null;
    bestTier: number;
    bestModelId: string;
    neededTier: number;
    bestIsTooSlow?: true;
  }>;
  /** Pairs no bucket can ever serve (surface as controlled failures). */
  blocked: Array<{ entryId: string; targetLanguage: string }>;
}

export type RevalidateResult =
  | { kind: 'keep' }
  | {
      kind: 'reroute';
      bucketKey: string;
      modelId: string;
      moduleId: string;
      batchSize: number;
      /**
       * The rerouted bucket's own quality tier — see Addendum H's
       * freewayTier/freewayBucketKey stamp (the reroute's own `bucketKey`
       * above is the companion key value).
       */
      qualityTier: number;
      /** Set when the reroute went below the group's floor under the run's permission. */
      degraded?: Assignment['degraded'];
    }
  | { kind: 'defer'; resumeAt: number; reason?: FreewayCooldownReason }
  | { kind: 'blocked' };

function pairKey(entryId: string, targetLanguage: string): string {
  return `${entryId}\0${targetLanguage}`;
}

/** Map one freeway RoutingDecision to a FreewayJob (difficulty inputs). */
export function toFreewayJob(decision: RoutingDecision): FreewayJob {
  const sourceText = decision.entry.sourceText;
  const maskCount = (sourceText.match(PLACEHOLDER_RE) ?? []).length;
  return {
    entryId: decision.entry.id,
    // Project code passed verbatim: base-subtag normalization is a hardness/
    // weak-language concern (handled inside M32/difficulty.ts), not a job field.
    targetLanguage: decision.targetLanguage,
    sourceText,
    maskCount,
    hasLengthLimit: getLengthLimit(decision.targetLanguage) !== undefined,
    // v1: glossary pressure is not measured at plan time.
    glossaryTermCount: 0,
    tone: decision.entry.metadata?.tone,
  };
}

/** Tier/language/credential eligibility ignoring transient quota state (mirrors planner.ts's private check, kept local so this file has no reach into planner internals). */
function everServable(bucket: BucketView, group: JobGroup): boolean {
  if (bucket.disabledReason !== undefined) return false;
  if (bucket.qualityTier < group.band) return false;
  if (bucket.blockedLanguages?.includes(group.targetLanguage)) return false;
  if (group.band >= 3 && bucket.weakLanguages?.includes(group.targetLanguage)) return false;
  return true;
}

/**
 * Resolve all freeway decisions of a run against the given bucket views.
 *
 * `opts.minBand` raises every group's band floor to at least that value (the
 * run's `freewayMinTier`), so content whose difficulty alone would settle for a
 * cheap bucket is planned against a stronger one. It only ever raises: a group
 * whose natural band is already higher keeps it. `opts.belowTarget` controls
 * whether a long wait asks for consent or allows a lower tier; when omitted,
 * planning retains the legacy one-tier degrade.
 */
export function resolveFreewayDecisions(
  decisions: RoutingDecision[],
  buckets: BucketView[],
  now: number,
  opts?: { minBand?: DifficultyBand; belowTarget?: 'ask' | 'allow'; priority?: FreewayPriority },
): FreewayResolution {
  const jobs = decisions.map(toFreewayJob);
  const groups = groupJobs(jobs).map((group) =>
    opts?.minBand !== undefined && group.band < opts.minBand
      ? { ...group, band: opts.minBand }
      : group,
  );
  // reserveRequests omitted: planRun falls back to its own defaultReserve().
  const plan = planRun(groups, buckets, {
    now,
    priorityClass: 'translate',
    belowTarget: opts?.belowTarget,
    priority: opts?.priority,
  });

  const decisionByPair = new Map<string, RoutingDecision>();
  for (const decision of decisions) {
    decisionByPair.set(pairKey(decision.entry.id, decision.targetLanguage), decision);
  }
  const decisionsForGroup = (group: JobGroup): RoutingDecision[] =>
    group.jobs.map((job) => {
      const decision = decisionByPair.get(pairKey(job.entryId, job.targetLanguage));
      if (!decision) {
        throw new Error(
          `freeway resolve: no RoutingDecision found for entry ${job.entryId} / ${job.targetLanguage}`,
        );
      }
      return decision;
    });

  const assignedGroups = plan.assignments.map((assignment) => {
    // Looked up by bucketKey rather than trusting `assignment.group.band` as
    // the tier: a winning bucket only has to meet-or-exceed the group's band
    // (or, for a degraded assignment, sit below it — see Assignment.degraded),
    // so its OWN qualityTier is the only value that is
    // always the tier that will actually serve.
    const bucket = buckets.find((b) => b.bucketKey === assignment.bucketKey);
    return {
      decisions: decisionsForGroup(assignment.group).map((decision) => ({
        ...decision,
        moduleId: assignment.moduleId,
        modelOverride: assignment.modelId,
        freewayTier: bucket?.qualityTier,
        freewayBucketKey: assignment.bucketKey,
      })),
      bucketKey: assignment.bucketKey,
      batchSize: assignment.batchSize,
      ...(assignment.degraded ? { degraded: assignment.degraded } : {}),
    };
  });

  const deferredPairs: Array<{ entryId: string; targetLanguage: string }> = [];
  let resumeAt: number | undefined;
  let deferredReason: FreewayCooldownReason | undefined;
  for (const deferred of plan.deferred) {
    deferredReason ??= deferred.reason;
    for (const job of deferred.group.jobs) {
      deferredPairs.push({ entryId: job.entryId, targetLanguage: job.targetLanguage });
    }
    resumeAt = resumeAt === undefined ? deferred.resumeAt : Math.min(resumeAt, deferred.resumeAt);
  }

  const blocked: Array<{ entryId: string; targetLanguage: string }> = [];
  for (const group of plan.blocked) {
    for (const job of group.jobs) {
      blocked.push({ entryId: job.entryId, targetLanguage: job.targetLanguage });
    }
  }

  return {
    assignedGroups,
    deferred:
      resumeAt === undefined
        ? null
        : {
            pairs: deferredPairs,
            resumeAt,
            ...(deferredReason ? { reason: deferredReason } : {}),
          },
    needsConfirmation: plan.needsConfirmation.map(
      ({ group, bestTier, bestModelId, resumeAt, bestIsTooSlow }) => ({
        pairs: group.jobs.map(({ entryId, targetLanguage }) => ({ entryId, targetLanguage })),
        resumeAt,
        bestTier,
        bestModelId,
        neededTier: group.band,
        ...(bestIsTooSlow ? { bestIsTooSlow } : {}),
      }),
    ),
    blocked,
  };
}

/**
 * Re-validate one assigned group at dispatch time; re-select when its bucket
 * died. `opts.degradedFloor` re-validates against a relaxed band instead of
 * the group's natural one — set it to a degraded assignment's `toTier` (see
 * {@link Assignment.degraded}) so a bucket the plan already accepted one tier
 * below the floor isn't bounced back to deferred here purely because this
 * function would otherwise recompute the group's TRUE (higher) floor from
 * the job content and find the same bucket newly ineligible. This only
 * widens what counts as acceptable; the usual ranking (pass-rate class,
 * scarcity) still chooses among the eligible buckets, so an eligible
 * natural-floor bucket competes but is not guaranteed to win.
 *
 * `opts.minBand` is the run's own tier floor (`freewayMinTier`) and is a
 * separate axis from `degradedFloor`: it RAISES the band the group is
 * re-validated at, mirroring what planning did, so a bucket under the floor
 * cannot be kept or rerouted onto here. When a degrade already settled this
 * group one tier below its planning band, `degradedFloor` still wins — the plan
 * accepted that tier for this batch, and a floored group relaxes under Addendum
 * G exactly like a naturally-hard one.
 *
 * `opts.allowBelowTarget` also accepts lower tiers for this group, including
 * on a reroute. A reroute prefers a currently eligible bucket at the floor;
 * weak-language exclusions still apply at the original band.
 */
export function revalidateGroup(
  group: { decisions: RoutingDecision[]; bucketKey: string; batchSize: number },
  buckets: BucketView[],
  now: number,
  opts?: {
    degradedFloor?: DifficultyBand;
    minBand?: DifficultyBand;
    allowBelowTarget?: boolean;
    priority?: FreewayPriority;
    /**
     * The run may use a lower tier (confirmed or "Always continue"). With a
     * priority set, it lets a Too slow selection give way to a faster
     * below-target bucket, reported as degraded. Unlike `allowBelowTarget`
     * it does not relax what counts as eligible.
     */
    belowTargetConsent?: boolean;
  },
): RevalidateResult {
  const jobs = group.decisions.map(toFreewayJob);
  // Groups are homogeneous by construction: every decision in it shares the
  // same target language and band, so the first job's band represents them all.
  const contentBand = difficultyBand(jobs[0]);
  const naturalBand =
    opts?.minBand !== undefined && contentBand < opts.minBand ? opts.minBand : contentBand;
  const band = opts?.degradedFloor ?? naturalBand;
  const jobGroup: JobGroup = { targetLanguage: jobs[0].targetLanguage, band, jobs };

  // The degradedFloor substitution relaxes the band>=3 weak-language
  // exclusion inside isEligible/selectBucket along with the tier floor — but
  // a language curated weak for a bucket is weak regardless of how the batch
  // got here, so the exclusion re-applies at the group's NATURAL band (the
  // same explicit re-check planRun's degrade branch performs).
  const candidates =
    naturalBand >= 3
      ? buckets.filter((b) => !b.weakLanguages?.includes(jobGroup.targetLanguage))
      : buckets;

  const current = candidates.find((bucket) => bucket.bucketKey === group.bucketKey);
  const currentGroup =
    current && opts?.allowBelowTarget && current.qualityTier < band
      ? { ...jobGroup, band: current.qualityTier }
      : jobGroup;
  if (current && isEligible(current, currentGroup, now)) {
    // A planned Too slow bucket is not kept once a faster one can serve now.
    if (opts?.priority === undefined || !isTooSlow(current)) return { kind: 'keep' };
    const faster = selectBucket(jobGroup, candidates, now, { priority: opts.priority });
    if (!faster || isTooSlow(faster.bucket)) return { kind: 'keep' };
  }

  const atTarget = selectBucket(jobGroup, candidates, now, { priority: opts?.priority });
  if (atTarget && opts?.priority !== undefined && isTooSlow(atTarget.bucket)) {
    const alternative = tooSlowAlternative(jobGroup, candidates, now, {
      priority: opts.priority,
      allowBelowTarget: opts.belowTargetConsent === true,
    });
    if (alternative?.kind === 'defer') {
      return {
        kind: 'defer',
        resumeAt: alternative.resumeAt,
        ...(alternative.reason ? { reason: alternative.reason } : {}),
      };
    }
    if (alternative?.kind === 'degrade') {
      const { bucket, batchSize } = alternative.selection;
      return {
        kind: 'reroute',
        bucketKey: bucket.bucketKey,
        modelId: bucket.modelId,
        moduleId: bucket.dispatchModuleId ?? bucket.moduleId,
        batchSize,
        qualityTier: bucket.qualityTier,
        degraded: {
          fromTier: jobGroup.band,
          toTier: bucket.qualityTier,
          waitedAlternativeMs: null,
        },
      };
    }
  }
  const selection =
    atTarget ??
    (opts?.allowBelowTarget
      ? chooseBelowTargetBucket({ ...jobGroup, band: naturalBand }, candidates, now, opts.priority)
      : undefined);
  if (selection) {
    return {
      kind: 'reroute',
      bucketKey: selection.bucket.bucketKey,
      modelId: selection.bucket.modelId,
      // Dispatch through the resolved instance, not the bare base — see
      // BucketView.dispatchModuleId.
      moduleId: selection.bucket.dispatchModuleId ?? selection.bucket.moduleId,
      batchSize: selection.batchSize,
      qualityTier: selection.bucket.qualityTier,
    };
  }

  const everGroup = opts?.allowBelowTarget ? { ...jobGroup, band: 1 as const } : jobGroup;
  const everCandidates = candidates.filter((bucket) => everServable(bucket, everGroup));
  if (everCandidates.length === 0) {
    return { kind: 'blocked' };
  }
  // A bucket that still has stock is back when its cooldown ends, not at its
  // window reset — a 70-second pool cool must not park the batch until tomorrow.
  const resumeAt = Math.min(...everCandidates.map((bucket) => bucketResumeAt(bucket, jobGroup)));
  const reason = deferralReason(everCandidates, jobGroup, resumeAt);
  return { kind: 'defer', resumeAt, ...(reason ? { reason } : {}) };
}
