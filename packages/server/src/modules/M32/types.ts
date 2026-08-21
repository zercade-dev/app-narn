/**
 * Pure input/output shapes for the Freeway decision core. A BucketView is an
 * immutable point-in-time snapshot of one candidate (module, model) bucket —
 * assembled by the dispatch layer from the free-tier snapshot and the quota
 * ledger; nothing in M32 reads storage directly.
 */
import type { FreewayBucketStats } from '../../storage/types.js';

export type DifficultyBand = 1 | 2 | 3 | 4;

export interface BucketView {
  /** `'<baseModuleId>::<modelId>'` */
  bucketKey: string;
  /**
   * The snapshot's base module id — always, even when the workspace serves
   * this bucket through a named instance. This is what keys the quota ledger
   * (`bucketKey`), never the id to instantiate; use `dispatchModuleId` for
   * that.
   */
  moduleId: string;
  /**
   * The module/instance id to instantiate for this bucket. Differs from
   * `moduleId` (always the snapshot's base id, which keys the quota ledger)
   * when the workspace configured the provider as a named instance. Absent
   * means the base id itself serves this bucket — every dispatch site reads
   * `dispatchModuleId ?? moduleId`. `loadBucketViews` always sets it
   * explicitly; it is optional here only so the many pre-existing BucketView
   * test fixtures don't all need a mechanical update.
   */
  dispatchModuleId?: string;
  /** Free-tier snapshot provider key ('google', 'groq', 'deepl', …). */
  providerKey: string;
  modelId: string;
  qualityTier: 1 | 2 | 3 | 4;
  maxBatch: number;
  /** Snapshot charBudget (see FreeTierModel); absent → legacy flat sizing. */
  charBudget?: number;
  /** Snapshot batchCeiling (see FreeTierModel); absent → maxBatch caps. */
  batchCeiling?: number;
  weakLanguages?: string[];
  /** Snapshot langScores (see FreeTierModel); absent → unmeasured. */
  langScores?: Record<string, number>;
  /** Snapshot langPassPriors; absent → curated tier×band prior applies. */
  langPassPriors?: Record<string, number>;
  /** Snapshot blockedLanguages; never eligible for these target languages. */
  blockedLanguages?: string[];
  /** Snapshot provider supportsMixedBatch, threaded for the M9 packer. */
  mixedBatch?: boolean;
  /**
   * Day-scale request stock: headroom in the rpd window. For char-only
   * providers the monthly window governs remainingChars instead, and
   * remainingRequests carries a large sentinel.
   */
  remainingRequests: number;
  /** DeepL-style char headroom; undefined for request-limited providers. */
  remainingChars?: number;
  /** Set when the provider has a shared day-scale pool; equals providerKey. */
  poolKey?: string;
  /** Shared-pool day headroom: sharedLimits rpd minus the provider-wide spend. */
  poolRemainingRequests?: number;
  /** rpm headroom for the current minute. Undefined when the model declares no rpm. */
  remainingMinuteRequests?: number;
  /** tpm headroom for the current minute. Undefined when the model declares no tpm. */
  remainingMinuteTokens?: number;
  /** Epoch ms when the current minute window rolls over. Undefined when neither rpm nor tpm applies. */
  minuteResetAt?: number;
  /** Shared-pool rpm headroom, when the provider declares sharedLimits rpm. */
  poolRemainingMinuteRequests?: number;
  /** Epoch ms when the day-scale window above (rpd, or the monthly char window) resets. */
  nextResetAt: number;
  cooldownUntil?: number;
  disabledReason?: string;
  stats: FreewayBucketStats;
}

export interface FreewayJob {
  entryId: string;
  /**
   * Must be a normalized language code matching the free-tier snapshot's
   * weakLanguages entries and the hardness sets: weak-language checks are
   * exact-match, while hardness falls back to the base subtag.
   */
  targetLanguage: string;
  sourceText: string;
  /** Placeholders/masks detected in the source (masking density signal). */
  maskCount: number;
  hasLengthLimit: boolean;
  glossaryTermCount: number;
  tone?: string;
}

export interface JobGroup {
  targetLanguage: string;
  band: DifficultyBand;
  jobs: FreewayJob[];
}

export interface Assignment {
  group: JobGroup;
  bucketKey: string;
  /** The module/instance id to instantiate — the winning bucket's `dispatchModuleId` (falling back to its base `moduleId`), never the bare base when an instance actually serves it. */
  moduleId: string;
  modelId: string;
  batchSize: number;
  estimatedRequests: number;
  /**
   * Set when this assignment relaxed the group's band floor one tier below
   * because the soonest band-qualified bucket was more than
   * FREEWAY_DEGRADE_WAIT_MS away (see planner.ts's deferral tail /
   * Addendum G). `fromTier` is the group's own band; `toTier` is exactly
   * one below it; `waitedAlternativeMs` is how long the band-qualified
   * bucket would have taken to come back.
   */
  degraded?: { fromTier: number; toTier: number; waitedAlternativeMs: number };
}

export interface RunPlan {
  assignments: Assignment[];
  /** Groups that do not fit today's quota; resumeAt = soonest useful reset. */
  deferred: { group: JobGroup; resumeAt: number }[];
  /** Groups no bucket can EVER serve (no eligible tier/provider at all). */
  blocked: JobGroup[];
}
