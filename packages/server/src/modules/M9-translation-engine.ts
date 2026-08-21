/**
 * M9 — TranslationEngine
 *
 * Orchestrates translation runs: routes each (entry, targetLanguage) pair,
 * queues jobs with bounded concurrency, calls modules with 429-aware retry,
 * persists results via M3, and emits structured log events for the UI.
 *
 * The engine is fully dependency-injectable for unit tests; defaults bind
 * to the live M1/M3/M6/M15 singletons.
 */
import { randomUUID } from 'node:crypto';
import {
  type GlobalConfig,
  type GlossaryTerm,
  type ModuleBatchMode,
  type AchievementPromptContext,
  type Project,
  type ProjectModuleConfigEntry,
  RunStatusCode,
  type RoutingDecision,
  type ControlledFailureReason,
  controlledFailureHint,
  FREEWAY_MODULE_ID,
  PSEUDO_MODULE_ID,
  type StringEntry,
  type TmFingerprint,
  type TmMatchPolicy,
  TM_MODULE_ID,
  type TranslationJob,
  type TranslationModule,
  type TranslationResult,
  type RunStatus,
  type RunRequest,
  type RunEntryLanguagePair,
  type RunDetails,
  type RunDetailEntry,
  type RunDetailPreviousValue,
  type RunCharTotals,
  getLengthLimit,
  hasTooLongIssue,
  resolveBatchGrouping,
  resolveEndpointType,
  unloadLocalModel,
  type EndpointType,
  type BatchDispatchOptions,
  type BatchGroupingDimension,
  resetRateLimiters,
  toErrorMessage,
  projectTargetLanguages,
  effectivePromptOptions,
  isExcludedFromAi,
  isParseFailureMessage,
} from '@zercade-dev/narn-shared';
import { router as defaultRouter, type Router } from './M7-router.js';
import {
  moduleRegistry as defaultModuleRegistry,
  type ModuleRegistry,
} from './M6-module-registry.js';
import type {
  FreewayBucketState,
  GlobalConfigStore,
  ProjectStore,
  RunStore,
  StringStore,
  TranslationMemory,
} from '../storage/types.js';
import {
  getFreewayLedgerStore,
  getGlobalConfigStore,
  getGlossaryStore,
  getProjectStore,
  getRunStore,
  getStringStore,
  getTranslationMemory,
} from '../storage/registry.js';
import {
  getCurrentTenant,
  runWithTenant,
  type TenantContext,
} from '../storage/pg/tenant-context.js';
import { listQuotaParkedRuns } from '../storage/quota-parked-runs.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { credentialStore, sanitizeLogObject } from './M16-credential-store.js';
import { lqaGate } from './M10-lqa-gate.js';
import {
  maskText,
  maskApprovedForMemory,
  restoreText,
  restoreFinal,
  verifyMaskedTranslation,
  maskDiagnosticsToIssues,
} from './M17-translation-masker.js';
import { resolveEffectiveModuleConfig } from './M19-global-config-store.js';
import { needsTranslation, runTrivialMatchers } from './trivial-matchers.js';
import { metricsCollector } from './metrics-collector.js';
import {
  buildTmFingerprint,
  formatTmHints,
  appendTmHints,
  MAX_TM_HINTS,
  type TmLookupResult,
} from './M23-translation-memory.js';
import { JobQueue } from './M9/queue.js';
import { awaitAllWithTimeout, SettledTracker } from './M9/run-settled.js';
import { emitRunProgress, recordRunFailure } from './M9/run-status-helpers.js';
import { assertRunCapacity, sweepOrphanedRuns } from './M9/run-capacity.js';
import { PreviewNotPossibleError } from '../types/errors.js';
import {
  isAbortError,
  isModelUnavailableError,
  isRateLimitError,
  isRunCancellingAuthError,
  isTransientProviderError,
  rateLimitCooldownMs,
  retryAfterMsOf,
  withRateLimitRetry,
} from './M9/errors.js';
import { chunkPackedDecisions, groupDecisions, packAssignedGroups } from './M9/packing.js';
import {
  type BucketSourceDeps,
  coolBucket,
  defaultInstanceIdsFor,
  defaultModuleStatus,
  freewayBucketBaseModuleId,
  freewayCredentialKey,
  freewayModuleOverrides,
  loadBucketViews,
  recordDispatch,
  recordGateOutcomes,
  resetBucketFlap,
  resolveDispatchModuleId,
  resolveFreewayProbeCredential,
} from './M32/bucket-source.js';
import { resolveFreewayDecisions, revalidateGroup, toFreewayJob } from './M32/resolve.js';
import {
  effectiveRemainingRequests,
  findMinuteStarvedEscalation,
  selectEscalationCandidates,
} from './M32/selector.js';
import { charCappedBatch } from './M32/scoring.js';
import { difficultyBand } from './M32/difficulty.js';
import type { Assignment, BucketView, DifficultyBand, JobGroup } from './M32/types.js';
import { syncAuthoritativeUsage } from './M32/probes.js';
import { maybeSweepExpiredFreewayWindows } from './freeway-minute-sweep.js';
import {
  buildAchievementPairMap,
  buildAchievementPromptContext,
  buildExamplesByLanguage,
  deriveAvailableModuleIds,
  type ExamplesByLanguage,
  glossaryEntryKey,
  jobReference,
  rateLimitConfig,
} from './M9/engine-helpers.js';
import { resolveRoutingRules } from './M9/resolve-routing.js';
import {
  accumulateUsage,
  defaultPricingProvider,
  finalizeUsageCosts,
  type PricingProvider,
} from './M9/usage-pricing.js';
import { getTranslationConcurrency } from '../config/env.js';

export type { PricingProvider } from './M9/usage-pricing.js';

export type GlossaryProvider = (
  projectId: string,
  targetLanguage: string,
  entry?: StringEntry,
) => Promise<GlossaryTerm[]>;

export type LqaGate = (
  entry: StringEntry,
  result: TranslationResult,
  projectId?: string,
  targetLanguage?: string,
  extraIssues?: import('@zercade-dev/narn-shared').LQAIssue[],
) => Promise<import('@zercade-dev/narn-shared').LQAResult | undefined>;

interface LoggerLike {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

export interface TranslationEngineDeps {
  concurrency?: number;
  glossaryProvider?: GlossaryProvider;
  lqaGate?: LqaGate;
  router?: Router;
  /**
   * `getMetadata` is optional so the existing DI test registries keep
   * type-checking; the live registry always provides it and the Freeway
   * bucket source needs it for per-module credential status.
   */
  moduleRegistry?: Pick<ModuleRegistry, 'getModule' | 'createWithConfig'> &
    Partial<Pick<ModuleRegistry, 'getMetadata'>>;
  stringStore?: Pick<
    StringStore,
    'load' | 'updateEntry' | 'setTranslation' | 'setTranslationStatus'
  >;
  projectStore?: Pick<ProjectStore, 'loadProject'>;
  runStore?: RunStore;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  tmStore?: Pick<TranslationMemory, 'lookup' | 'record'>;
  logger?: LoggerLike;
  pricing?: PricingProvider;
  /** Base delay for 429 exponential backoff (default 1s); tests inject a small value. */
  retryBaseDelayMs?: number;
  /**
   * Period of the quota auto-resume sweep, in ms. Opt-in: absent or `0` arms no
   * timer at all, so a DI-constructed engine (every unit test) never leaks one.
   * The process-wide {@link translationEngine} opts in with
   * {@link TranslationEngine.QUOTA_SWEEP_INTERVAL_MS}.
   */
  quotaSweepIntervalMs?: number;
  /**
   * Cross-tenant scan for runs the store has parked on free quota, consulted
   * once per process by the sweep (see {@link TranslationEngine.sweepQuotaResumes}).
   * Test seam only: the default is the real storage helper.
   */
  listParkedRuns?: typeof listQuotaParkedRuns;
  /**
   * Overrides for the Freeway bucket source (quota ledger, module status,
   * cloud-mode flag). Only `ledger`/`cloudMode` are normally injected: the
   * engine builds its own session-scoped `moduleStatus` unless one is given.
   */
  freeway?: BucketSourceDeps;
}

/**
 * Why {@link TranslationEngine.resumeWithModule} refused, so the route can
 * answer each case precisely instead of with one generic failure. Run-STATE
 * refusals are a conflict with what the run is doing (the route answers 409);
 * MODULE-choice refusals mean the request named something unusable (400):
 * - `not-found` — no such run in memory or in the store (404; unreachable
 *   behind the route's own visibility check).
 * - `not-parked` — the run is not `Paused` waiting on free quota.
 * - `not-drained` — paused with work still outstanding beyond the parked pairs;
 *   re-dispatching would start a second pass over a live run.
 * - `project-busy` — the run had to be adopted from the store (restart path)
 *   but another run is already active/starting for the project.
 * - `unknown-module` — no module registered under that id.
 * - `module-unavailable` — registered but disabled, or with no credentials in
 *   the requesting session.
 * - `module-not-eligible` — registered and usable, but not a legal target for a
 *   real translation pass (pseudo-localization, or no `translate` capability).
 */
export type ResumeWithModuleResult =
  | { ok: true; status: RunStatus }
  | {
      ok: false;
      reason:
        | 'not-found'
        | 'not-parked'
        | 'not-drained'
        | 'project-busy'
        | 'unknown-module'
        | 'module-unavailable'
        | 'module-not-eligible';
    };

/**
 * `waitingForQuota.skipReason` set when the auto-resume declines because the
 * run's session can no longer see any free-tier bucket — re-planning then would
 * classify every parked pair as permanently unservable and fail it.
 */
const NO_BUCKETS_SKIP_REASON = 'no-free-buckets-for-session';

/**
 * Cooldown applied to a Freeway bucket whose provider call failed for a reason
 * that is neither a rate limit nor a bad credential — a 5xx, a timeout, or a
 * model the provider has since retired ("this model is unavailable for free").
 * Such a bucket answers nothing but keeps getting picked, draining a run's
 * batches one 404 at a time, so it is sidelined for a while. Deliberately
 * short: a transient outage heals long before the daily reset, and a genuinely
 * retired model simply gets re-cooled on the next run (the snapshot refresh is
 * the real fix for that).
 */
const FREEWAY_PROVIDER_ERROR_COOLDOWN_MS = 15 * 60_000;

const defaultGlossaryProvider: GlossaryProvider = async () => [];
const defaultLqaGate: LqaGate = async () => undefined;

/**
 * Hint reason for a TM hit rejected by the current LQA gate. Issue types are
 * check-controlled (trusted) descriptors; details are deliberately omitted so
 * the hint tells the model what to avoid without echoing LLM output.
 */
function tmRejectionReason(lqa: import('@zercade-dev/narn-shared').LQAResult): string {
  const types = Array.from(new Set(lqa.issues.map((i) => i.type))).slice(0, 5);
  return types.length > 0
    ? `failed the current quality checks: ${types.join(', ')}`
    : 'failed the current quality checks';
}

type GlossaryGroup = {
  constantTerms: GlossaryTerm[];
  nonConstantTerms: GlossaryTerm[];
  glossaryById: Map<string, GlossaryTerm>;
};

/**
 * One aggregated controlled pre-dispatch failure: all (entry, targetLanguage)
 * pairs that failed for the same (targetLanguage, reason). Logged as a single
 * `translation:failed` trace with a `count` and fix `hint`.
 */
type ControlledFailureGroup = {
  reason: ControlledFailureReason;
  targetLanguage: string;
  /** The routed module id (null for `no-route`); attached to the trace when set. */
  moduleId: string | null;
  count: number;
  /**
   * The entry ids that failed for this (targetLanguage, reason). Carried on the
   * single aggregated `translation:failed` trace so the UI can still offer a
   * per-entry Retry / Retry-all (the recovery list is reconstructed from the log
   * stream, which otherwise lost the per-entry ids when the logs were collapsed).
   */
  entryIds: string[];
};

/**
 * Human-readable headroom for a Freeway "why routed" detail line: chars for a
 * `monthly_chars`-governed bucket (DeepL), else requests — clamped by the
 * provider's shared-pool headroom, which is what the selector actually spends
 * against (reporting a per-model 50 while the account-wide pool is drained
 * would be a lie). Falls back to "quota unknown" when the bucket isn't in the
 * loaded view (shouldn't happen for a bucket the resolver just assigned, but
 * the detail log must never throw).
 */
function formatBucketHeadroom(view: BucketView | undefined): string {
  if (!view) return 'quota unknown';
  if (view.remainingChars !== undefined) {
    return `${view.remainingChars} chars left this month`;
  }
  return `${effectiveRemainingRequests(view)} requests left today`;
}

/**
 * The run's Freeway tier floor as a band, or undefined when it set none. The
 * value is range-checked at the route (2-4); a persisted value outside that
 * range is treated as no floor rather than cast into the band arithmetic, so
 * the run plans at its natural band instead of an undefined one.
 */
function freewayMinBand(request: RunRequest | undefined): DifficultyBand | undefined {
  const tier = request?.freewayMinTier;
  if (tier === undefined) return undefined;
  return tier === 2 || tier === 3 || tier === 4 ? tier : undefined;
}

/**
 * The band options one `revalidateGroup` call needs, or undefined when neither
 * applies. The two floors are independent and must both survive: `degradedFloor`
 * relaxes the band a degrade already settled on, `minBand` raises it to the
 * run's requested tier — collapsing them would silently drop one.
 */
function freewayBandOpts(
  degradedFloor: DifficultyBand | undefined,
  minBand: DifficultyBand | undefined,
): { degradedFloor?: DifficultyBand; minBand?: DifficultyBand } | undefined {
  if (degradedFloor === undefined && minBand === undefined) return undefined;
  return {
    ...(degradedFloor !== undefined ? { degradedFloor } : {}),
    ...(minBand !== undefined ? { minBand } : {}),
  };
}

/** `HH:MM` in the server's local time, for the "resumes ~HH:MM" detail line. */
function formatResumeTime(resumeAt: number): string {
  const d = new Date(resumeAt);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** One-liner for a Freeway batch parked on quota, at either the plan-time or dispatch-time deferral site. */
function formatDeferralDetail(pairCount: number, resumeAt: number): string {
  return `${pairCount} pairs waiting for quota — resumes ~${formatResumeTime(resumeAt)}`;
}

/** One-liner for a batch dispatching on a bucket one tier below its band floor (Addendum G). */
function formatDegradedDetail(degraded: NonNullable<Assignment['degraded']>): string {
  const mins = Math.round(degraded.waitedAlternativeMs / 60_000);
  return `tier ${degraded.fromTier} bucket ~${mins}m out — degraded to tier ${degraded.toTier} instead of waiting`;
}

/** One-liner for a dispatch-time Freeway failover (see {@link TranslationEngine.dispatchFreewayBatch}'s `onReroute`). */
function formatRerouteDetail(info: {
  from: string;
  to: string;
  reason: 'rate-limit' | 'auth' | 'provider-error';
  retryAfterMs?: number;
}): string {
  if (info.reason === 'rate-limit') {
    const secs = info.retryAfterMs !== undefined ? Math.round(info.retryAfterMs / 1000) : undefined;
    return secs !== undefined
      ? `429 on ${info.from} — cooled ${secs}s, rerouted to ${info.to}`
      : `429 on ${info.from} — cooled, rerouted to ${info.to}`;
  }
  if (info.reason === 'provider-error') {
    return `${info.from} is not answering — cooled, rerouted to ${info.to}`;
  }
  return `credential rejected on ${info.from} — rerouted to ${info.to}`;
}

/** One-liner for a parse-failure split (see {@link TranslationEngine.dispatchFreewayBatch}'s `onSplit`). */
function formatSplitDetail(info: { bucketKey: string; size: number }): string {
  return `${info.size} strings came back malformed on ${info.bucketKey} — retrying in halves`;
}

/** One-liner for a proactive re-chunk (see {@link TranslationEngine.dispatchFreewayBatch}'s `onRechunk`). */
function formatRechunkDetail(info: { bucketKey: string; size: number; parts: number }): string {
  return `batch of ${info.size} re-chunked into ${info.parts} requests for ${info.bucketKey}`;
}

/** One-liner for a mixed chunk unpacked back into single-language parts (see `onUnpack`). */
function formatUnpackDetail(info: {
  bucketKey: string;
  languages: number;
  reason: 'parse-failure' | 'rate-limit' | 'provider-error' | 'auth';
}): string {
  return `unpacking ${info.languages} languages after ${info.reason} on ${info.bucketKey}`;
}

/** One-liner for a mixed-target pack (see {@link TranslationEngine.resolveFreewayGroups}). */
function formatPackDetail(languages: readonly string[], chunks: number, bucketKey: string): string {
  return `packed ${languages.length} languages (${languages.join(', ')}) into ${chunks} request${
    chunks === 1 ? '' : 's'
  } on ${bucketKey}`;
}

/** Token/character tallies of one provider call, for the Freeway quota ledger. */
function freewayUsageOf(results: readonly (TranslationResult | undefined)[]): {
  inputTokens?: number;
  outputTokens?: number;
  chars?: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  let chars = 0;
  for (const result of results) {
    const usage = result?.usage;
    if (!usage) continue;
    inputTokens += usage.inputTokens ?? 0;
    outputTokens += usage.outputTokens ?? 0;
    // `characters` is the provider-billed count (DeepL and friends); the
    // source-text total is the honest stand-in for token-billed providers.
    chars += usage.characters ?? usage.sourceChars ?? 0;
  }
  return { inputTokens, outputTokens, chars };
}

/**
 * The bucket a Freeway-managed dispatch group is currently running on. Mutable:
 * a 429 or a bad-credential failure can move a batch to another bucket mid-flight,
 * and the dispatch pipeline must keep dispatching (and accounting) against the
 * bucket it actually used.
 */
interface FreewayBatchState {
  module: TranslationModule;
  moduleId: string;
  modelId: string | null;
  bucketKey: string;
}

/** What the Freeway dispatch attempt(s) for one batch produced. */
type FreewayDispatchOutcome =
  | { kind: 'results'; results: TranslationResult[] }
  | { kind: 'defer'; resumeAt: number; reason?: 'quota' | 'provider-error' }
  | { kind: 'blocked' }
  /** `authCancel` is true only for an auth failure that leaves no bucket at all. */
  | { kind: 'error'; error: unknown; authCancel: boolean };

/** Args for {@link TranslationEngine.dispatchFreewayBatch} and {@link TranslationEngine.dispatchFreewayInParts}. */
interface FreewayDispatchArgs {
  jobs: TranslationJob[];
  decisions: RoutingDecision[];
  state: FreewayBatchState;
  deps: BucketSourceDeps;
  createModule: (
    moduleId: string,
    modelId: string,
    bucketKey: string,
  ) => TranslationModule | undefined;
  translateOptions: BatchDispatchOptions;
  signal?: AbortSignal;
  /**
   * Reports the single failover hop's reroute, if it produces one — raw
   * facts only (which bucket, why, how long it cooled), so the caller (which
   * owns the run's detail accumulator) turns it into a "why routed" line.
   */
  onReroute?: (info: {
    from: string;
    to: string;
    reason: 'rate-limit' | 'auth' | 'provider-error';
    retryAfterMs?: number;
  }) => void;
  /** Recursion depth of the parse-failure split (0 = the original batch). */
  splitDepth?: number;
  /** Reports a parse-failure split so the caller can record a run detail. */
  onSplit?: (info: { bucketKey: string; size: number }) => void;
  /**
   * Set when the plan degraded this batch's band floor one tier (Addendum
   * G): every re-validation this hop performs must check the CURRENT bucket
   * against the accepted (relaxed) tier, not the group's natural, higher
   * one — otherwise a degraded batch that hits a 429/provider error here
   * revalidates at the natural floor, its own (degraded) bucket is excluded
   * by that stricter check, and it parks on the long-cooling top-tier
   * bucket's resumeAt — reproducing the exact stuck-waiting symptom the
   * degrade exists to remove.
   */
  degradedFloor?: DifficultyBand;
  /**
   * The run's own Freeway tier floor (`freewayMinTier`), if it set one. The
   * opposite axis to `degradedFloor`: it RAISES the band every re-validation
   * below runs at, so a failover cannot quietly drop the batch onto a bucket
   * under the tier the run asked for.
   */
  minBand?: DifficultyBand;
  /**
   * Run-scoped format-strike caps, keyed by bucketKey: the batch size a
   * bucket is known to parse reliably at after a split recovery this run.
   * Dispatch entry pre-chunks at the cap instead of re-paying the failed
   * full-size call on every subsequent batch.
   */
  splitCaps?: Map<string, number>;
  /** Reports a proactive re-chunk (strike cap or rescue-bucket char cap). */
  onRechunk?: (info: { bucketKey: string; size: number; parts: number }) => void;
  /**
   * Set on a part produced by the mixed-chunk UNPACK (see
   * {@link TranslationEngine.dispatchFreewayBatch}'s header): re-validate THIS
   * part's own (language, band) group against fresh views before spending a
   * call, instead of translating first. Two reasons, both specific to the
   * unpack: the planned bucket has just failed for the chunk (a translate-first
   * part would knowingly re-pay a failing call), and eligibility is per
   * language (blocked/weak languages, ranking), so every part must decide for
   * ITSELF rather than inherit a sibling part's failover.
   */
  revalidateFirst?: boolean;
  /** Why the mixed chunk failed — labels a `revalidateFirst` swap in the run's detail log. */
  unpackReason?: 'rate-limit' | 'auth' | 'provider-error';
  /** Reports a mixed chunk being unpacked into single-language parts. */
  onUnpack?: (info: {
    bucketKey: string;
    languages: number;
    reason: 'parse-failure' | 'rate-limit' | 'provider-error' | 'auth';
  }) => void;
}

/**
 * Hard output limit to attach to a job. Only set when the entry's current
 * translation for the language is flagged `too-long`, so re-translating it
 * explicitly asks the model for a shorter version; unflagged jobs keep the
 * baseline prompt. Exported for unit tests.
 */
export function lengthLimitForJob(
  entry: StringEntry,
  targetLanguage: string,
): TranslationJob['lengthLimit'] {
  return hasTooLongIssue(entry.lqaResults, targetLanguage)
    ? getLengthLimit(targetLanguage)
    : undefined;
}

/**
 * Corrective follow-up sent to the module after a failed LQA gate.
 * When the failure includes a `too-long` issue, an explicit shorten request
 * with the language's hard limits is appended. Exported for unit tests.
 */
export function buildLqaRetryFeedback(
  lqaResult: import('@zercade-dev/narn-shared').LQAResult,
  targetLanguage: string,
  achievement?: AchievementPromptContext,
): string {
  // The feedback is replayed to the model as a new user turn. issue.detail
  // can echo LLM-produced text, so sanitize it before interpolation: strip
  // control characters (which could forge a fake role/instruction line),
  // collapse whitespace, and cap length/count. The check-controlled `type`
  // is prepended as the stable, trusted descriptor.
  const summarizeIssue = (issue: { type: string; detail: string }): string => {
    const detail = issue.detail
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    return detail ? `${issue.type}: ${detail}` : issue.type;
  };
  let feedback = `The previous translation failed quality checks: ${lqaResult.issues
    .slice(0, 20)
    .map(summarizeIssue)
    .join('; ')}. Please correct the translation.`;
  if (lqaResult.issues.some((i) => i.type === 'too-long')) {
    const limit = getLengthLimit(targetLanguage);
    if (limit) {
      feedback +=
        ` The translation MUST NOT exceed ${limit.maxChars} characters or ` +
        `${limit.maxBytes} UTF-8 bytes — provide a shorter version that preserves ` +
        `the essential meaning, condensing rather than truncating.`;
    }
  }
  // Achievement entries: restate the hard byte budget the LQA gate enforces.
  if (achievement) {
    feedback += ` The ${achievement.type} must fit within ${achievement.maxBytes} UTF-8 bytes.`;
  }
  return feedback;
}

/** Key for the per-(entry, target language) maps in {@link RunDetailsAcc}. */
function detailKey(entryId: string, targetLanguage: string): string {
  return `${entryId}\0${targetLanguage}`;
}

/**
 * Mutable in-memory accumulator behind a run's {@link RunDetails} sidecar.
 * Entries and retries are deduplicated per (entry, target language); character
 * totals are summed across every provider call, retries included.
 */
interface RunDetailsAcc {
  entryKeys: Set<string>;
  entries: RunDetailEntry[];
  retries: Map<
    string,
    { entryId: string; sourceText: string; targetLanguage: string; count: number }
  >;
  chars: RunCharTotals;
  /**
   * Snapshot of each (entry, target language)'s translation just before this
   * run overwrote it, keyed by {@link detailKey}. Populated once per pair (see
   * {@link TranslationEngine.capturePreviousValue}); backs the run's revert action.
   */
  previousValues: Map<string, RunDetailPreviousValue>;
  /**
   * "Why routed" log for a Freeway-managed run: one line per resolution
   * assignment, reroute, escalation, or quota deferral, appended via
   * {@link TranslationEngine.recordFreewayDetail} in the order they occur.
   * Undefined until the first Freeway detail line is recorded, so a run with
   * no Freeway decisions never persists an empty log.
   */
  freeway?: string[];
  /**
   * Run-scoped format-strike caps (see {@link FreewayDispatchArgs.splitCaps}),
   * keyed by bucketKey. Lives here rather than per-batch: a Freeway run
   * dispatches its planned batches as SEPARATE `processBatchJob` calls (one
   * per chunk of an assignment, or of a packed mixed-target group — see
   * {@link TranslationEngine.resolveFreewayGroups}),
   * so only an accumulator that outlives one call lets a later batch learn
   * from an earlier one's split. In-memory only, never persisted to the
   * sidecar: losing it across a restart costs at most one re-paid failed
   * call, not correctness.
   */
  freewaySplitCaps: Map<string, number>;
}

export class TranslationEngine {
  /**
   * Grace window before a terminal run is evicted from the in-memory maps — long
   * enough that any client polling `/translate/status` sees the final status
   * first; afterwards the durable RunStore serves it.
   */
  private static readonly TERMINAL_EVICT_GRACE_MS = 5 * 60_000;
  /** Hard cap on tracked runs; the oldest-finished terminal runs are evicted past it. */
  private static readonly MAX_TRACKED_RUNS = 500;
  /** Default period of the quota auto-resume sweep (see `quotaSweepIntervalMs`). */
  static readonly QUOTA_SWEEP_INTERVAL_MS = 60_000;
  /** Floor on how often ONE run may be auto-resumed (see {@link lastQuotaResumeAttempt}). */
  private static readonly QUOTA_RESUME_MIN_INTERVAL_MS = 60_000;
  private readonly queue: JobQueue;
  private readonly runs = new Map<string, RunStatus>();
  /**
   * Per-run detail accumulator (which entries were translated, retry counts,
   * character totals), keyed by runId. Populated during the run and flushed to
   * a `details-<runId>.json` sidecar on completion/cancel (see {@link persistDetails}).
   * In-memory only — lost on restart, like the run controllers below.
   */
  private readonly details = new Map<string, RunDetailsAcc>();
  private readonly controllers = new Map<string, AbortController>();
  // Per-run "settled" deferreds + in-flight detached-task counts. A
  // settled deferred (armed when a run's tasks are dispatched, resolved once the
  // run is terminal AND no detached task is still running) lets cloud account
  // deletion await a run's REAL completion — past every late store write in a
  // job's `finally` — before teardownTenant removes project_members. New surface
  // only: the translate/dispatch hot path is byte-identical; these are
  // populated/resolved at existing lifecycle points. See {@link cancelAllForProject}.
  private readonly tracker = new SettledTracker();
  /** Session ids of queued runs (sessions are in-memory only; lost on restart). */
  private readonly queuedSessions = new Map<string, string | undefined>();
  /**
   * Session each run last DISPATCHED under. `queuedSessions` is consumed at
   * dequeue and never populated for an immediately-started run, so a later
   * in-place re-dispatch (the quota resume) would otherwise lose the session
   * and read no credentials. Fallback only: a resuming caller's own session
   * wins. In-memory, dropped with the run.
   */
  private readonly runSessions = new Map<string, string | undefined>();
  /**
   * Tenant each run last DISPATCHED under, captured inside `startRunInner` (which
   * already executes within the run's own tenant scope). The quota sweep fires
   * off ANY request context, so it has no ambient tenant to inherit — it
   * re-establishes each swept run's own captured tenant around the resume, the
   * way the deferred queue paths do. In-memory, dropped with the run.
   */
  private readonly runTenants = new Map<string, TenantContext | undefined>();
  /**
   * Epoch ms of the last quota auto-resume ATTEMPT per run. A park whose
   * `resumeAt` is immediate (the keep-arm backoff is short by design) would
   * otherwise be re-planned on every sweep tick; this floors the per-run
   * re-attempt rate at {@link TranslationEngine.QUOTA_RESUME_MIN_INTERVAL_MS}
   * independently of the tick period. Manual resumes are never throttled.
   */
  private readonly lastQuotaResumeAttempt = new Map<string, number>();
  /**
   * (entryId, targetLanguage) pairs already parked once for a transient
   * per-result error in a PARTIAL Freeway batch, keyed by runId (see the
   * Freeway transient-park branch inside `finalizeEntryResult`'s error
   * handling below). A pair's SECOND transient hit in the same run fails it
   * instead of parking again, bounding the extra spend at one retry per
   * pair. In-memory only: a restart loses the count and grants one more
   * park — harmless, since it only ever costs one wasted request.
   */
  private readonly freewayTransientParkedPairs = new Map<string, Set<string>>();
  /** Set while a sweep pass is running, so a slow pass can't overlap the next tick. */
  private quotaSweepInFlight = false;
  /**
   * Whether the store has already been scanned for parks this process (see
   * {@link adoptPersistedParks}). Set only after a scan that actually
   * completed, so a boot-time DB outage retries instead of stranding them.
   */
  private parkAdoptionDone = false;
  /** The armed sweep interval (unref'd), when the engine opted in. */
  private quotaSweepTimer?: ReturnType<typeof setInterval>;
  /**
   * Enqueue-time tenant of each queued run. A Queued run starts LATER from
   * `resume`/`maybeStartNextQueued` — paths that run OFF any request's ambient
   * tenant context (e.g. fired from the PRECEDING run's completion), so the run
   * must re-establish ITS OWN enqueue-time tenant (not the triggering run's, not
   * undefined). Captured here in `enqueue` alongside the session, read back when
   * the deferred run starts. In-memory only — lost on restart, like the session.
   */
  private readonly queuedTenants = new Map<string, TenantContext | undefined>();
  /**
   * Failed-pairs dispatch request for a `retryFailed` that was deferred because
   * the project was busy. The queued run's persisted `request` stays its ORIGINAL
   * full scope (so AI review keeps judging the whole run — see {@link retryFailed}),
   * so the retry-only request (failed pairs, `reTranslate: true`) is carried here
   * and consumed at dequeue by {@link maybeStartNextQueued}, which dispatches it
   * with `retry = true`. In-memory only; cleared on dequeue and on cancel.
   */
  private readonly queuedRetryRequests = new Map<string, RunRequest>();
  /**
   * Projects with a run currently inside `startRun`'s async loading phase.
   * The run only becomes visible to `hasActiveProjectRun` after routing, so
   * this synchronous guard closes the window where two parallel enqueues (or
   * two simultaneous completions chaining the queue) would both start.
   */
  private readonly startingProjects = new Set<string>();
  /**
   * Projects whose crash/redeploy-orphaned runs have already been reconciled
   * this process. The boot sweep runs lazily, once per project, the
   * first time a tenant enqueues for it — RunStore exposes no all-tenants run
   * listing to drive a single global sweep, so this scopes it per project under
   * the request's RLS-scoped store. Set membership makes it idempotent.
   */
  private readonly sweptProjects = new Set<string>();
  private readonly glossaryProvider: GlossaryProvider;
  private readonly lqaGate: LqaGate;
  private readonly router: Router;
  private readonly moduleRegistry: Pick<ModuleRegistry, 'getModule' | 'createWithConfig'> &
    Partial<Pick<ModuleRegistry, 'getMetadata'>>;
  /** Injected Freeway bucket-source overrides (see {@link freewayBucketDeps}). */
  private readonly freewayOverrides: BucketSourceDeps;
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _stringStore?: Pick<
    StringStore,
    'load' | 'updateEntry' | 'setTranslation' | 'setTranslationStatus'
  >;
  private get stringStore(): Pick<
    StringStore,
    'load' | 'updateEntry' | 'setTranslation' | 'setTranslationStatus'
  > {
    return this._stringStore ?? getStringStore();
  }
  // Resolve the project store lazily so a later setProjectStore() (e.g. per-test
  // injection) is honored even by the module-level singleton.
  private readonly _projectStore?: Pick<ProjectStore, 'loadProject'>;
  private get projectStore(): Pick<ProjectStore, 'loadProject'> {
    return this._projectStore ?? getProjectStore();
  }
  // Resolve the run store lazily so a later setRunStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getRunStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _runStore?: RunStore;
  private get runStore(): RunStore {
    return this._runStore ?? getRunStore();
  }
  // Resolve the global-config store lazily so a later setGlobalConfigStore()
  // (e.g. per-test injection) is honored even by the module-level singleton.
  private readonly _globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  private get globalConfigStore(): Pick<GlobalConfigStore, 'load'> {
    return this._globalConfigStore ?? getGlobalConfigStore();
  }
  // Resolve the translation memory lazily so a later setTranslationMemory()
  // (e.g. per-test injection) is honored even by the module-level singleton —
  // a bare `?? getTranslationMemory()` constructor default would capture the
  // store at import time and defeat the test seam.
  private readonly _tmStore?: Pick<TranslationMemory, 'lookup' | 'record'>;
  private get tmStore(): Pick<TranslationMemory, 'lookup' | 'record'> {
    return this._tmStore ?? getTranslationMemory();
  }
  private readonly logger: LoggerLike;
  private readonly pricing: PricingProvider;
  private readonly retryBaseDelayMs: number;
  /** Injected persisted-park scan; defaults to the real storage helper. */
  private readonly _listParkedRuns?: typeof listQuotaParkedRuns;

  constructor(deps: TranslationEngineDeps = {}) {
    const concurrency = deps.concurrency ?? Number.parseInt(getTranslationConcurrency(), 10);
    this.queue = new JobQueue(Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 3);
    this.glossaryProvider = deps.glossaryProvider ?? defaultGlossaryProvider;
    this.lqaGate = deps.lqaGate ?? defaultLqaGate;
    this.router = deps.router ?? defaultRouter;
    this.moduleRegistry = deps.moduleRegistry ?? defaultModuleRegistry;
    this._stringStore = deps.stringStore;
    this._projectStore = deps.projectStore;
    this._runStore = deps.runStore;
    this._globalConfigStore = deps.globalConfigStore;
    this._tmStore = deps.tmStore;
    this.logger = deps.logger ?? defaultLogger;
    this.pricing = deps.pricing ?? defaultPricingProvider;
    this.retryBaseDelayMs = deps.retryBaseDelayMs ?? 1000;
    this._listParkedRuns = deps.listParkedRuns;
    this.freewayOverrides = deps.freeway ?? {};
    const sweepIntervalMs = deps.quotaSweepIntervalMs ?? 0;
    if (sweepIntervalMs > 0) {
      // unref'd: a pending tick must never hold the process (or a test worker)
      // open. Stoppable via stopQuotaSweep().
      this.quotaSweepTimer = setInterval(() => {
        // A tick must never surface as an unhandled rejection: per-run failures
        // are already caught inside, this only covers the pass itself.
        void this.sweepQuotaResumes().catch((err: unknown) => {
          this.logger.warn('translation:quota-sweep-failed', { error: toErrorMessage(err) });
        });
        // Freeway's rpm/tpm minute-cell retention piggybacks on this same
        // unconditional, process-wide 60s tick rather than a route hit —
        // this is the only invocation guaranteed to run regardless of
        // whether any user-facing route is ever called, so it's what
        // actually bounds freeway_usage's growth. maybeSweepExpiredFreewayWindows
        // already never throws (it catches internally and applies its own
        // multi-hour throttle so this doesn't add real DB work every tick),
        // but this mirrors the sweepQuotaResumes call above defensively so a
        // future change to that contract can't reintroduce an unhandled
        // rejection here.
        void maybeSweepExpiredFreewayWindows().catch((err: unknown) => {
          this.logger.warn('freeway:minute-sweep-failed', { error: toErrorMessage(err) });
        });
      }, sweepIntervalMs);
      this.quotaSweepTimer.unref?.();
    }
  }

  /** Disarm the quota sweep interval (idempotent). */
  stopQuotaSweep(): void {
    if (!this.quotaSweepTimer) return;
    clearInterval(this.quotaSweepTimer);
    this.quotaSweepTimer = undefined;
  }

  async enqueue(
    projectId: string,
    entryIds: string[],
    targetLanguages: string[],
    reTranslate = false,
    sessionId?: string,
    options: {
      queue?: boolean;
      referenceLanguage?: string;
      exampleEntryIds?: string[];
      pairs?: RunEntryLanguagePair[];
      disableMemory?: boolean;
      batchGrouping?: BatchGroupingDimension;
      ignoreBatchSizeLimit?: boolean;
      splitByModel?: boolean;
      customBatchSize?: number;
      /** Freeway-only per-run tier floor (2-4) — see {@link RunRequest.freewayMinTier}. */
      freewayMinTier?: number;
    } = {},
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    // Reconcile crash/redeploy-orphaned runs for this project once per process,
    // BEFORE the capacity check so freed slots are counted. Then evict
    // long-terminal runs from the in-memory maps so the O(n) enqueue scans below
    // (hasActiveProjectRun / hasQueuedProjectRun) and memory stay bounded over the
    // process lifetime.
    await this.sweepOrphanedProjectRuns(projectId);
    this.evictTerminalRuns();
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT (→ 429). No-op when
    // the cap is unset (single-user/local unchanged).
    await assertRunCapacity(this.runStore);
    const runId = randomUUID();
    const request: RunRequest = {
      entryIds,
      targetLanguages,
      reTranslate,
      ...(options.referenceLanguage ? { referenceLanguage: options.referenceLanguage } : {}),
      ...(options.exampleEntryIds?.length ? { exampleEntryIds: options.exampleEntryIds } : {}),
      ...(options.pairs ? { pairs: options.pairs } : {}),
      ...(options.disableMemory ? { disableMemory: true } : {}),
      ...(options.batchGrouping !== undefined ? { batchGrouping: options.batchGrouping } : {}),
      ...(options.ignoreBatchSizeLimit !== undefined
        ? { ignoreBatchSizeLimit: options.ignoreBatchSizeLimit }
        : {}),
      ...(options.splitByModel ? { splitByModel: true } : {}),
      ...(options.customBatchSize !== undefined
        ? { customBatchSize: options.customBatchSize }
        : {}),
      ...(options.freewayMinTier !== undefined ? { freewayMinTier: options.freewayMinTier } : {}),
    };

    // Per-project run queue: starting a run while one is in progress (or
    // while earlier runs are still waiting) queues it instead. Routing is
    // deliberately deferred to dequeue time — module configs and routing
    // rules may change while the run waits.
    if (
      this.hasActiveProjectRun(projectId) ||
      this.hasQueuedProjectRun(projectId) ||
      this.startingProjects.has(projectId)
    ) {
      const status: RunStatus = {
        runId,
        projectId,
        createdBy: getCurrentTenant()?.userId,
        status: RunStatusCode.Queued,
        total: 0,
        completed: 0,
        failed: 0,
        startedAt: Date.now(),
        errors: [],
        request,
        queuePosition: this.nextQueuePosition(projectId),
      };
      this.runs.set(runId, status);
      this.queuedSessions.set(runId, sessionId);
      // Stash the enqueue-time tenant so the deferred start re-establishes
      // THIS run's tenant (see queuedTenants / startRun).
      this.queuedTenants.set(runId, getCurrentTenant());
      await this.runStore.updateRun(projectId, status);
      this.logger.info('translation:run-queued', {
        runId,
        projectId,
        queuePosition: status.queuePosition,
        explicitQueueRequest: options.queue === true,
      });
      return { runId, total: 0, status: RunStatusCode.Queued };
    }

    return this.startRun(
      runId,
      projectId,
      request,
      sessionId,
      undefined,
      false,
      getCurrentTenant(),
    );
  }

  /**
   * Re-attempts exactly the (entry, language) pairs that errored in a prior run,
   * folding the results back INTO that same run rather than spawning a new one.
   * The re-attempted pairs are moved back to "pending" (their prior error
   * records dropped and the failed tally reduced) while the run's original
   * `total`, `completed`, accumulated usage, and persisted `request` are
   * preserved — so the run stays a single judgeable unit and repeated retries
   * don't multiply into per-retry runs for AI review to wade through. A pair is
   * re-attempted even if it now has stale text (forced via `reTranslate`), and
   * the source run's reference language and batch settings (`batchGrouping`,
   * `customBatchSize`, `ignoreBatchSizeLimit`) are reused, so by default a
   * retry re-sends the failed pairs at the SAME batch size the original run
   * used — no automatic shrinking. The provider modules no longer auto-split a
   * failing batch into smaller pieces (see core.ts/copilot
   * `sameLanguageBatch`/`dispatchBatch`); this retry path is how the user
   * re-attempts a failed batch, at the same size unless they change the
   * project/workspace batch setting themselves first.
   *
   * Returns null when the run is unknown, is not in a terminal state (an
   * in-progress or queued run is left untouched), or recorded no retryable
   * failures.
   */
  async retryFailed(
    projectId: string,
    runId: string,
    sessionId?: string,
  ): Promise<{ runId: string; total: number; status: RunStatusCode } | null> {
    const source = this.runs.get(runId) ?? (await this.runStore.getRun(projectId, runId));
    if (!source) return null;

    // Only a terminal run can be retried in place; re-entering a run that is
    // still running/paused/queued would corrupt its live accounting.
    if (
      source.status === RunStatusCode.Running ||
      source.status === RunStatusCode.Paused ||
      source.status === RunStatusCode.Queued
    ) {
      return null;
    }

    const seen = new Set<string>();
    const pairs: RunEntryLanguagePair[] = [];
    for (const err of source.errors) {
      if (!err.stringId || !err.targetLang) continue;
      const key = `${err.stringId} ${err.targetLang}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ entryId: err.stringId, targetLanguage: err.targetLang });
    }
    if (pairs.length === 0) return null;

    const entryIds = [...new Set(pairs.map((p) => p.entryId))];
    const targetLanguages = [...new Set(pairs.map((p) => p.targetLanguage))];
    // Dispatch request: restricts this pass to exactly the failed pairs and
    // forces re-translation. The source run's persisted `request` (its full
    // original scope) is deliberately NOT overwritten, so AI review keeps
    // re-deriving and judging the whole run.
    const retryRequest: RunRequest = {
      entryIds,
      targetLanguages,
      reTranslate: true,
      pairs,
      ...(source.request?.referenceLanguage
        ? { referenceLanguage: source.request.referenceLanguage }
        : {}),
      ...(source.request?.exampleEntryIds?.length
        ? { exampleEntryIds: source.request.exampleEntryIds }
        : {}),
      ...(source.request?.batchGrouping !== undefined
        ? { batchGrouping: source.request.batchGrouping }
        : {}),
      ...(source.request?.customBatchSize !== undefined
        ? { customBatchSize: source.request.customBatchSize }
        : {}),
      ...(source.request?.ignoreBatchSizeLimit !== undefined
        ? { ignoreBatchSizeLimit: source.request.ignoreBatchSizeLimit }
        : {}),
    };

    // Make the source run the live in-memory record we mutate (it may have come
    // from disk after a restart), then re-run it in place.
    this.runs.set(runId, source);

    // Per-project run guard: a retry must not jump ahead of an active/starting
    // run (that would break the one-active-run-per-project invariant and wipe the
    // live run's rate-limiter backoff via startRun's resetRateLimiters), nor sit
    // ahead of earlier-queued runs. Defer it into the queue instead. The failed-
    // pairs dispatch request is carried in queuedRetryRequests (consumed at
    // dequeue with retry=true); the source run's persisted `request` stays its
    // ORIGINAL full scope so AI review still judges the whole run.
    if (
      this.hasActiveProjectRun(projectId) ||
      this.hasQueuedProjectRun(projectId) ||
      this.startingProjects.has(projectId)
    ) {
      this.queuedRetryRequests.set(runId, retryRequest);
      source.status = RunStatusCode.Queued;
      source.queuePosition = this.nextQueuePosition(projectId);
      this.queuedSessions.set(runId, sessionId);
      this.queuedTenants.set(runId, getCurrentTenant());
      await this.runStore.updateRun(projectId, source);
      this.logger.info('translation:retry-queued', {
        runId,
        projectId,
        queuePosition: source.queuePosition,
      });
      return { runId, total: source.total, status: RunStatusCode.Queued };
    }

    return this.startRun(
      runId,
      projectId,
      retryRequest,
      sessionId,
      source,
      true,
      // Retry runs on the request thread — re-establish the active tenant
      // around startRunInner (a harmless re-entry of the same context).
      getCurrentTenant(),
    );
  }

  /**
   * Approves the given (entry, target language) translations. This is the ONLY
   * path that writes to the (global) translation memory — translations are no
   * longer auto-recorded during a run, so the memory holds only human-approved
   * variants. For each pair it:
   *   1. marks the translation `reviewed` and clears `needsReview`, and
   *   2. records the approved text to the TM in masked form, re-deriving the
   *      mask (M17) and context fingerprint (M7 routing → promptOptions) exactly
   *      as the engine would at translation time.
   *
   * Pairs without a stored translation are skipped. The TM write is skipped for
   * projects whose match policy is `disabled`, and is best-effort: a failed
   * write is logged but never undoes the review-status update. Returns the
   * number of pairs approved. Needs no vault session (no LLM calls).
   */
  async approveTranslations(
    projectId: string,
    pairs: RunEntryLanguagePair[],
  ): Promise<{ approved: number }> {
    const project = await this.projectStore.loadProject(projectId);
    const tmPolicy: TmMatchPolicy = project.tmPolicy ?? 'disabled';
    // Resolve this tenant's effective routing once (owner→project rules,
    // collaborator→their collab doc) and thread it through this flow.
    const rules = await resolveRoutingRules(project);
    const availableModules = this.deriveAvailableModuleIds(rules);
    const entries = await this.stringStore.load(projectId);
    const byId = new Map(entries.map((e) => [e.id, e]));

    let approved = 0;
    for (const { entryId, targetLanguage } of pairs) {
      const entry = byId.get(entryId);
      const record = entry?.translations[targetLanguage];
      if (!entry || !record?.text) continue;

      // Mark reviewed (idempotent — re-approving simply re-affirms and re-records).
      // Flip STATUS-ONLY under the write lock: `record` is a run-start snapshot,
      // so passing `{ ...record }` through updateEntry could restore stale text
      // (and history-fold the current text) if a concurrent edit landed since
      // the snapshot. setTranslationStatus never carries text — the current
      // stored text survives. It returns the fresh entry, from which we re-read
      // the CURRENT text/moduleId for the TM record below (never the snapshot).
      const flipped = await this.stringStore.setTranslationStatus(
        projectId,
        entryId,
        targetLanguage,
        {
          status: 'reviewed',
          needsReview: false,
        },
      );
      approved++;

      if (tmPolicy === 'disabled') continue;
      const currentRecord = flipped.translations[targetLanguage] ?? record;
      try {
        const decision = this.router.route(entry, targetLanguage, rules, availableModules);
        const glossary = await this.glossaryProvider(projectId, targetLanguage, entry);
        const constantTerms = glossary.filter((term) => term.constant);
        // Mask source and approved text jointly so the stored translation carries
        // SOURCE-plan slot ids — the ids the engine restores against at apply time.
        // Masking them independently numbers ids by each text's own token order, so
        // a human variant that reorders indexed tokens would restore them swapped.
        // Use the CURRENT text (`currentRecord.text`), not the snapshot, so a
        // mid-review edit isn't recorded to the TM as the stale variant.
        const remapped = maskApprovedForMemory(entry.sourceText, currentRecord.text, constantTerms);
        if (!remapped) {
          this.logger.warn('translation:tm-approve-skip-token-mismatch', {
            entryId,
            targetLanguage,
          });
          continue;
        }
        const { maskedSource, maskedTranslation } = remapped;
        await this.tmStore.record({
          maskedSource,
          targetLanguage,
          translatedText: maskedTranslation,
          moduleId: currentRecord.moduleId,
          // Human approval is the authority here: store the variant as usable
          // regardless of the original automated LQA verdict.
          lqaPassed: true,
          fingerprint: buildTmFingerprint(entry, decision.promptOptions),
        });
      } catch (err) {
        this.logger.warn('translation:tm-approve-write-failed', {
          entryId,
          targetLanguage,
          error: err instanceof Error ? err.message : `${err}`,
        });
      }
    }
    return { approved };
  }

  /**
   * Dry-run translation-memory preview: for the given (entry × targetLanguage)
   * pairs, runs the SAME masking + `tmStore.lookup()` the engine performs in a
   * real run (M17 mask → M7 routing fingerprint → M23 lookup) WITHOUT
   * translating, persisting, or queuing anything. Returns how many pairs would
   * auto-apply a stored variant from memory (i.e. `autoApply !== null`) and the
   * total number of pairs considered.
   *
   * Source-language pairs and pairs whose source short-circuits (trivial matcher
   * or fully-masked) are excluded from `total` exactly as the engine excludes
   * them from the TM consult — so the count reflects what a real run would do.
   * The project's stored `tmPolicy` is honoured (a `disabled` project always
   * reports 0). No vault session needed (no LLM calls).
   */
  async memoryPreview(
    projectId: string,
    entryIds: string[],
    targetLanguages: string[],
  ): Promise<{ memoryCount: number; total: number }> {
    const project = await this.projectStore.loadProject(projectId);
    const tmPolicy: TmMatchPolicy = project.tmPolicy ?? 'disabled';
    // This tenant's effective routing (owner→project, collaborator→collab doc).
    const rules = await resolveRoutingRules(project);
    const availableModules = this.deriveAvailableModuleIds(rules);
    const allEntries = await this.stringStore.load(projectId);
    const wanted = new Set(entryIds);
    // `ignored` entries never reach a real run (see startRunInner) — excluded
    // here too so the preview's total matches what a real run would consider.
    const entries = allEntries.filter((e) => wanted.has(e.id) && !isExcludedFromAi(e));

    let memoryCount = 0;
    let total = 0;
    for (const entry of entries) {
      for (const targetLanguage of targetLanguages) {
        if (targetLanguage === project.sourceLanguage) continue;

        // Trivial matchers short-circuit before the TM consult — exclude them.
        if (runTrivialMatchers(entry.sourceText, project.sourceLanguage, targetLanguage) !== null) {
          continue;
        }

        const decision = this.router.route(entry, targetLanguage, rules, availableModules);
        const glossary = await this.glossaryProvider(projectId, targetLanguage, entry);
        const constantTerms = glossary.filter((term) => term.constant);
        const { masked, trivial } = maskText(entry.sourceText, constantTerms);
        // Fully-masked entries are produced locally and never consult the TM.
        if (trivial) continue;

        total++;
        const tmFingerprint = buildTmFingerprint(entry, decision.promptOptions);
        const lookup = await this.tmLookupSafe(
          masked,
          targetLanguage,
          tmFingerprint,
          tmPolicy,
          entry,
        );
        if (lookup.autoApply !== null) memoryCount++;
      }
    }
    return { memoryCount, total };
  }

  /**
   * Dry-run "which local Ollama models would this run touch" preview: routes
   * every (entry × targetLanguage) pair exactly as {@link startRunInner} does,
   * resolves each routed instance's `baseURL` and effective model
   * (`modelOverride ?? instanceConfig.model`), keeps only the instances whose
   * baseURL points at a local Ollama endpoint, and returns the DISTINCT set —
   * deduplicated by (baseURL, model). Used by the Translate dialog to decide
   * whether to offer the "run one local model at a time" option (only shown
   * when ≥2 distinct local models are affected).
   *
   * Returns `[]` cleanly when nothing routes to a local Ollama model (or only
   * one does). Honours `reTranslate` like a real run does NOT — the preview
   * deliberately considers every requested pair (the dialog already scopes the
   * entry list), so the split decision matches the worst case. No vault session
   * needed (no LLM calls, no persistence, no queuing).
   */
  async localModelPreview(
    projectId: string,
    entryIds: string[],
    targetLanguages: string[],
  ): Promise<
    Array<{ instanceId: string; baseURL: string; model: string; endpointType: EndpointType }>
  > {
    const project = await this.projectStore.loadProject(projectId);
    const global = await this.globalConfigStore.load();
    const projectEntries = project.moduleConfigs as Record<
      string,
      ProjectModuleConfigEntry | undefined
    >;
    // This tenant's effective routing (owner→project, collaborator→collab doc).
    const rules = await resolveRoutingRules(project);
    const availableModules = this.deriveAvailableModuleIds(rules);
    const allEntries = await this.stringStore.load(projectId);
    const wanted = new Set(entryIds);
    // `ignored` entries never reach a real run (see startRunInner) — excluded
    // here too so this preview's routed set matches startRunInner's exactly.
    const entries = allEntries.filter((e) => wanted.has(e.id) && !isExcludedFromAi(e));

    // Dedupe by (baseURL, model): the same instance configured with a
    // per-rule modelOverride counts as a distinct local model phase.
    const byKey = new Map<
      string,
      { instanceId: string; baseURL: string; model: string; endpointType: EndpointType }
    >();
    for (const entry of entries) {
      for (const targetLanguage of targetLanguages) {
        if (targetLanguage === project.sourceLanguage) continue;
        const decision = this.router.route(entry, targetLanguage, rules, availableModules);
        if (decision.moduleId === null) continue;
        const local = this.resolveLocalModel(decision, global, projectEntries);
        if (!local) continue;
        byKey.set(`${local.baseURL}\0${local.model}`, local);
      }
    }
    return [...byKey.values()];
  }

  /**
   * Resolve the (baseURL, effective model, endpoint kind) a routed decision
   * would run against, but ONLY when it is a local endpoint — Ollama or LM
   * Studio (both support unload-between-models); a generic/`unknown` endpoint
   * returns null. The endpoint kind comes from the explicit `endpointType`
   * config (falling back to the baseURL heuristic). The effective model is the
   * rule's `modelOverride` if set, else the instance's configured `model`.
   * Shared by {@link localModelPreview} and the split-by-model run partitioning
   * so both classify identically.
   */
  private resolveLocalModel(
    decision: RoutingDecision,
    global: GlobalConfig,
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>,
  ): { instanceId: string; baseURL: string; model: string; endpointType: EndpointType } | null {
    if (decision.moduleId === null) return null;
    const effective = resolveEffectiveModuleConfig(
      decision.moduleId,
      global,
      projectEntries[decision.moduleId],
    );
    const baseURL = effective.config.baseURL;
    if (typeof baseURL !== 'string' || !baseURL) return null;
    const endpointType = resolveEndpointType({
      endpointType: effective.config.endpointType,
      baseURL,
    });
    if (endpointType === 'unknown') return null;
    const configModel = typeof effective.config.model === 'string' ? effective.config.model : '';
    const model = decision.modelOverride ?? configModel;
    return { instanceId: decision.moduleId, baseURL, model, endpointType };
  }

  /**
   * Ad-hoc, NON-persisting "back-translation" preview. Translates an arbitrary
   * piece of text from one language to another and returns the result without
   * touching the StringStore, the run queue, or translation memory. Used by the
   * Review tab to show a reference back-translation of the current target text
   * into the source language; the result is display-only and is never written
   * onto any entry.
   *
   * The module is picked with the same Router/config resolution the engine uses
   * for real jobs (so the user's routing rules and module settings apply), but
   * the source/target are swapped and nothing is saved.
   */
  async previewTranslate(
    projectId: string,
    entryId: string,
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    sessionId: string | undefined,
  ): Promise<{ text: string; moduleId: string }> {
    const project = await this.projectStore.loadProject(projectId);
    const allEntries = await this.stringStore.load(projectId);
    const entry = allEntries.find((e) => e.id === entryId);
    if (!entry) {
      throw new PreviewNotPossibleError(`entry-not-found: ${entryId}`);
    }
    // `ignored` entries are excluded from every AI dispatch — this reference
    // preview calls a real module.translate(), same as a real run.
    if (isExcludedFromAi(entry)) {
      throw new PreviewNotPossibleError(`entry-ignored: ${entryId}`);
    }

    const global = await this.globalConfigStore.load();
    const projectEntries = project.moduleConfigs as Record<
      string,
      ProjectModuleConfigEntry | undefined
    >;

    // Routing rules are configured around real target languages and typically
    // exclude the project's source language, so routing for the back-translation
    // direction often yields no module. Try routing first (to honour any rule
    // the user did set up), then fall back to any enabled module so the
    // reference is still produced.
    // This tenant's effective routing (owner→project, collaborator→collab doc).
    const rules = await resolveRoutingRules(project);
    const decision = this.router.route(
      entry,
      targetLanguage,
      rules,
      this.deriveAvailableModuleIds(rules),
    );
    const routedEffective =
      decision.moduleId !== null
        ? resolveEffectiveModuleConfig(decision.moduleId, global, projectEntries[decision.moduleId])
        : null;
    const routedEnabled =
      routedEffective !== null && routedEffective.enabled && routedEffective.active !== false;
    const moduleId = routedEnabled
      ? (decision.moduleId as string)
      : this.firstEnabledModuleId(global, projectEntries);
    if (!moduleId) {
      throw new PreviewNotPossibleError('no-enabled-module');
    }

    const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntries[moduleId]);

    const moduleLog = (
      level: 'info' | 'warn' | 'error',
      message: string,
      metadata?: Record<string, unknown>,
    ) => this.logger[level](message, metadata);

    // Rule-level model/effort overrides only apply when we actually used the
    // routed module; the fallback module runs with its own configured settings.
    const ruleOverrides: Record<string, unknown> = {};
    if (routedEnabled) {
      if (decision.modelOverride) ruleOverrides.model = decision.modelOverride;
      if (decision.reasoningEffortOverride)
        ruleOverrides.reasoningEffort = decision.reasoningEffortOverride;
    }

    const module = this.moduleRegistry.createWithConfig(
      moduleId,
      {
        ...effective.config,
        ...this.rateLimitConfig(global),
        ...ruleOverrides,
        log: moduleLog,
      },
      sessionId,
    );
    if (!module) {
      throw new PreviewNotPossibleError('module-not-found');
    }

    // Deliberately bypass masking, glossary, and translation memory: this is a
    // throwaway reference translation, not a stored result, so the simplest
    // possible single job keeps it cheap and side-effect free. The counterpart
    // pair map is skipped here (empty Map) — a preview only needs its own byte
    // budget, not another entry's stored translation.
    const previewAchievement = routedEnabled
      ? buildAchievementPromptContext(entry, targetLanguage, project, new Map())
      : undefined;
    const job: TranslationJob = {
      entryId: entry.id,
      sourceText,
      sourceLanguage,
      targetLanguage,
      glossary: [],
      glossaryId: 'project',
      ...(routedEnabled
        ? {
            promptOptions: previewAchievement
              ? {
                  ...effectivePromptOptions(entry, decision.promptOptions),
                  achievement: previewAchievement,
                }
              : effectivePromptOptions(entry, decision.promptOptions),
          }
        : {}),
      context: entry.context,
    };
    const [result] = await module.translate([job]);
    if (result?.error) {
      // An actual provider/module failure (rate-limit, auth, malformed output,
      // network) is not a user-actionable "cannot produce a reference"
      // condition — let it surface as a generic 500 (redacted body), preserving
      // the original route behavior. Only the structural conditions below are
      // mapped to 422.
      throw new Error(result.error);
    }
    if (!result || !result.translatedText) {
      throw new PreviewNotPossibleError('translation-failed');
    }
    return { text: result.translatedText, moduleId };
  }

  /**
   * First module that is enabled-and-active for this project, considering both
   * project overrides and global config. Used as the back-translation fallback
   * when no routing rule matches the requested direction.
   */
  private firstEnabledModuleId(
    global: GlobalConfig,
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>,
  ): string | undefined {
    const candidateIds = new Set<string>([
      ...Object.keys(global.moduleConfigs),
      ...Object.keys(projectEntries),
    ]);
    for (const id of candidateIds) {
      const effective = resolveEffectiveModuleConfig(id, global, projectEntries[id]);
      if (effective.enabled && effective.active !== false && this.moduleRegistry.getModule(id)) {
        return id;
      }
    }
    return undefined;
  }

  /**
   * Route the request and dispatch its jobs. `existing` is supplied when a
   * previously queued run is being started; its RunStatus object is mutated
   * in place so pollers holding the runId observe the transition.
   */
  private async startRun(
    runId: string,
    projectId: string,
    request: RunRequest,
    sessionId: string | undefined,
    existing?: RunStatus,
    retry = false,
    // The enqueue-time tenant. `startRunInner` reads/writes the project,
    // strings, run, and TM stores AND kicks off its JobQueue tasks synchronously
    // — re-establishing the tenant around the WHOLE call scopes every one of
    // those (the queued task continuations inherit it via AsyncLocalStorage). The
    // immediate paths (`enqueue`/`retryFailed`) pass the still-active request
    // tenant (a harmless re-entry of the same context); the deferred paths
    // (`resume`/`maybeStartNextQueued`), which run off any request context, pass
    // the run's OWN tenant captured at enqueue — without this they would inherit
    // the triggering run's context (or none) and write under the wrong tenant.
    tenant?: TenantContext,
    // Forces every decision of this pass onto ONE module, replacing whatever
    // the routing rules chose (see {@link resumeWithModule}). Absent for every
    // normal dispatch.
    moduleOverride?: string,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    // A fresh run should not inherit rate-limiter backoff state earned by a
    // previous, unrelated run against the same provider.
    resetRateLimiters();
    this.startingProjects.add(projectId);
    try {
      const inner = () =>
        this.startRunInner(runId, projectId, request, sessionId, existing, retry, moduleOverride);
      return await (tenant ? runWithTenant(tenant, inner) : inner());
    } finally {
      this.startingProjects.delete(projectId);
      // A run whose jobs finish *inside* this start window (e.g. an instant
      // module reply) reaches finalize -> startNextQueued() while
      // `startingProjects` still guards this project, so that drain no-ops and
      // the NEXT queued run is stranded (observed with 2+ queued runs draining
      // back-to-back behind a held run; a targeted e2e spec reproduces it).
      // Re-drain once the guard has cleared. maybeStartNextQueued is a no-op
      // when a run is active or already starting, so this is safe and
      // idempotent for the normal (slow-module) path.
      this.startNextQueued(projectId);
    }
  }

  private async startRunInner(
    runId: string,
    projectId: string,
    request: RunRequest,
    sessionId: string | undefined,
    existing?: RunStatus,
    retry = false,
    moduleOverride?: string,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    const {
      entryIds,
      targetLanguages,
      reTranslate,
      referenceLanguage,
      exampleEntryIds,
      pairs,
      disableMemory,
    } = request;
    // Cancel-vs-dequeue race: if a Queued run is cancelled at the exact
    // moment maybeStartNextQueued has dequeued it (removed from queuedSessions)
    // but not yet flipped it Running, `cancel` sets the shared `existing` status
    // object Cancelled. Without a guard, this path would then resurrect it to
    // Running (below) and re-run the whole run — double billing. The guard is
    // placed AFTER the awaits below, immediately before the Running flip, so it
    // catches a cancel landing during any of loadProject / stringStore.load /
    // resolveRoutingRules (there is no await between the guard and the flip, so
    // the check→flip is atomic w.r.t. a concurrent cancel).
    const project = await this.projectStore.loadProject(projectId);
    const allEntries = await this.stringStore.load(projectId);
    // One-per-run index of achievement-linked entries (keyed by achievementId),
    // so each job can attach its counterpart's source + usable translation.
    const achievementPairMap = buildAchievementPairMap(allEntries);
    const wanted = new Set(entryIds);
    // Translate-with-examples: resolve the requested example entries ONCE per
    // run into per-language pairs. `wanted` doubles as the overlap exclusion —
    // an entry being translated must not anchor itself.
    const examplesByLanguage = buildExamplesByLanguage(
      allEntries,
      exampleEntryIds,
      wanted,
      targetLanguages,
    );
    if (exampleEntryIds?.length) {
      this.logger.info('translation:examples-resolved', {
        runId,
        projectId,
        requested: exampleEntryIds.length,
        resolvedLanguages: examplesByLanguage ? [...examplesByLanguage.keys()] : [],
      });
    }
    // Entries in their stored (import) order. Related-entry batch grouping (by
    // glossary/category) is applied later in groupDecisions; the word-similarity
    // pre-sort (reviewSortIndex) is now a UI-only display sort, not a batch input.
    // `ignored` entries are excluded from every AI dispatch, translation included.
    const entries = allEntries.filter((e) => wanted.has(e.id) && !isExcludedFromAi(e));

    // "Retry failed" restricts the run to exactly the (entry, language) pairs
    // that errored, rather than the full entryIds × targetLanguages product.
    const pairAllow = pairs ? new Set(pairs.map((p) => `${p.entryId}\0${p.targetLanguage}`)) : null;

    // Router only checks `.id`; pass a minimal projection of available module
    // ids. The set is the same for every (entry, language) pair in this run, so
    // derive it once rather than re-wrapping the array on each iteration.
    // Anything a rule names but the registry lacks is caught at job-execution
    // time. Resolve the RUN CREATOR's effective routing once (owner→project
    // rules, collaborator→their personal collab doc): the engine body re-
    // establishes the enqueue-time tenant, so this agrees at enqueue and drain.
    const rules = await resolveRoutingRules(project);
    const availableModules = this.deriveAvailableModuleIds(rules);
    const decisions: RoutingDecision[] = [];
    for (const entry of entries) {
      for (const targetLanguage of targetLanguages) {
        if (targetLanguage === project.sourceLanguage) continue;
        if (pairAllow && !pairAllow.has(`${entry.id}\0${targetLanguage}`)) continue;
        if (!needsTranslation(entry, targetLanguage, reTranslate)) continue;
        decisions.push(this.router.route(entry, targetLanguage, rules, availableModules));
      }
    }

    if (moduleOverride) {
      // Rewrite every decision onto the chosen module: the rule that produced
      // it (and any model override it carried) belonged to a different target —
      // typically the virtual `freeway` one this pass is bypassing — so the
      // module's own configured model applies. The pairs then take the ordinary
      // direct-dispatch path, never the freeway resolution.
      for (let i = 0; i < decisions.length; i++) {
        const rewritten: RoutingDecision = {
          ...decisions[i],
          moduleId: moduleOverride,
          ruleId: null,
        };
        delete rewritten.modelOverride;
        decisions[i] = rewritten;
      }
    }

    // The cancel-vs-dequeue race: a concurrent cancel during the awaits above
    // flipped this dequeued Queued run to Cancelled on its shared status
    // object — do NOT resurrect it to Running or begin work. cancel() of a
    // Queued run does not chain the queue (wasActive=false), so keep the
    // project's queue draining here and let the run stay terminal.
    if (existing && existing.status === RunStatusCode.Cancelled) {
      this.startNextQueued(projectId);
      return { runId, total: existing.total, status: RunStatusCode.Cancelled };
    }

    const status: RunStatus = existing ?? {
      runId,
      projectId,
      createdBy: getCurrentTenant()?.userId,
      status: RunStatusCode.Running,
      total: decisions.length,
      completed: 0,
      failed: 0,
      startedAt: Date.now(),
      errors: [],
      // Record the request so the run stays judgeable (AI review re-derives
      // its scope from here). Queued runs already carry it from `enqueue`.
      request,
    };
    if (retry) {
      // In-place retry (see {@link retryFailed}): move the pairs about to be
      // re-attempted back to "pending" by dropping their prior error records
      // and reducing the failed tally, while preserving the run's original
      // total/completed/startedAt and accumulated usage. The remaining errors
      // (pairs that no longer route to a job — e.g. a deleted entry) stay
      // failed, so `completed + failed` still settles back to `total` once the
      // re-attempts finish and the existing finalize path fires.
      const retryKeys = new Set(decisions.map((d) => `${d.entry.id} ${d.targetLanguage}`));
      const errorsBefore = status.errors.length;
      status.errors = status.errors.filter(
        (e) => !(e.stringId && e.targetLang && retryKeys.has(`${e.stringId} ${e.targetLang}`)),
      );
      status.failed = Math.max(0, status.failed - (errorsBefore - status.errors.length));
      status.status = RunStatusCode.Running;
      delete status.finishedAt;
      delete status.queuePosition;
      // A prior AI-review score is stale once translations change; drop it so
      // the run reads as needing re-review with the retried results included.
      delete status.aiScore;
    } else {
      status.status = RunStatusCode.Running;
      status.total = decisions.length;
      status.startedAt = Date.now();
      delete status.queuePosition;
    }
    this.runs.set(runId, status);
    this.runSessions.set(runId, sessionId);
    // This body already executes inside the run's own tenant scope (startRun
    // wraps it), so the ambient tenant IS the run's — capture it for the
    // request-less quota sweep.
    this.runTenants.set(runId, getCurrentTenant());
    // A retry adds to the existing run detail (entries, retry counts, character
    // totals); a fresh run starts from an empty accumulator.
    if (retry) {
      await this.hydrateDetails(projectId, runId);
    } else {
      this.initDetails(runId);
    }
    this.controllers.set(runId, new AbortController());
    await this.runStore.updateRun(projectId, status);
    // Warm the pricing feed in the background so cost finalization at run
    // completion can resolve synchronously from the cache.
    void this.pricing.ensure().catch(() => {});

    if (decisions.length === 0) {
      status.status = RunStatusCode.Completed;
      status.finishedAt = Date.now();
      this.emitProgress(runId, status);
      await this.persistDetails(projectId, runId);
      await this.runStore.updateRun(projectId, status);
      this.startNextQueued(projectId);
      return { runId, total: 0, status: RunStatusCode.Completed };
    }

    this.logger.info('translation:queued', {
      runId,
      projectId,
      total: decisions.length,
    });

    const isBatch = (moduleId: string | null) =>
      moduleId !== null &&
      (this.moduleRegistry.getModule(moduleId)?.capabilities ?? []).includes('batch');

    const global = await this.globalConfigStore.load();
    const projectEntries = project.moduleConfigs as Record<
      string,
      ProjectModuleConfigEntry | undefined
    >;

    // Routing pre-pass: detect controlled pre-dispatch failures (no-route /
    // module-disabled / module-not-found) up front. Each per-entry failure is
    // recorded in run status (the UI's per-entry error list stays complete), but
    // the logs are aggregated — one `translation:failed` trace per
    // (targetLanguage, reason) with a count + fix hint, vs one line per entry
    // (hundreds for a 146-entry × N-language run). Only routable decisions reach
    // the normal grouping/dispatch path below.
    const { routable, controlled } = this.partitionControlledFailures(
      status,
      decisions,
      global,
      projectEntries,
    );
    this.logAggregatedControlledFailures(runId, status, controlled);
    if (routable.length === 0) {
      // Every decision was a controlled failure: nothing will dispatch, so the
      // per-job `finalizeTranslationTerminal` never fires — settle the run here.
      await this.finalizeTranslationTerminal(status, projectId, runId);
      return { runId, total: decisions.length, status: status.status };
    }

    const resolveBatchMode = (moduleId: string): ModuleBatchMode => {
      const projectEntry = projectEntries[moduleId];
      const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntry);
      const mode = effective.config.batchMode;
      return mode === 'entry' ? 'entry' : 'language';
    };
    // Per-module batch-size cap for the grouping path = the provider's configured
    // maxBatchSize (default 20 in the AI SDK translate path).
    const resolveMaxBatch = (moduleId: string): number => {
      const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntries[moduleId]);
      const v = (effective.config as { maxBatchSize?: unknown }).maxBatchSize;
      return typeof v === 'number' && v > 0 ? v : 20;
    };

    // Related-entry grouping config: per-run override (from the Translate
    // dialog) → per-project → workspace → none. A `customBatchSize` override
    // (the dialog's "Custom" choice) takes priority over `batchGrouping` — the
    // two are mutually exclusive on the wire.
    const resolvedGrouping = resolveBatchGrouping(project, global.settings);
    const batchGroupingDimension =
      request.customBatchSize !== undefined
        ? 'none'
        : (request.batchGrouping ?? resolvedGrouping.dimension);
    const batchIgnoreSizeLimit =
      request.customBatchSize !== undefined
        ? request.customBatchSize === 0
        : (request.ignoreBatchSizeLimit ?? resolvedGrouping.ignoreSizeLimit);

    // Freeway decisions carry the virtual `freeway` target, not a real module:
    // they are resolved to concrete (module, model, batch size) assignments
    // against live quota below. Everything else groups exactly as before.
    const freewayDecisions = routable.filter((d) => d.moduleId === FREEWAY_MODULE_ID);
    const directDecisions =
      freewayDecisions.length === 0
        ? routable
        : routable.filter((d) => d.moduleId !== FREEWAY_MODULE_ID);
    /** Freeway-managed batches, mapped to the bucket their jobs were planned on. */
    const freewayBucketKeys = new Map<RoutingDecision[], string>();
    /** Freeway-managed batches whose band floor the plan relaxed one tier. */
    const freewayDegraded = new Map<RoutingDecision[], Assignment['degraded']>();

    const groups = groupDecisions(directDecisions, isBatch, resolveBatchMode, {
      dimension: batchGroupingDimension,
      ignoreSizeLimit: batchIgnoreSizeLimit,
      resolveCap: resolveMaxBatch,
      customBatchSize: request.customBatchSize,
    });
    // When grouping is active, groupDecisions has already arranged each batch
    // exactly; tell the provider not to re-chunk it (which would tear a footprint
    // apart). The same applies when a custom batch size was set — groupDecisions
    // has already chunked to the exact requested size (or left a partition
    // uncapped for `customBatchSize: 0`). Off otherwise, preserving the legacy
    // provider chunking.
    const batchDispatchOptions: BatchDispatchOptions | undefined =
      batchGroupingDimension !== 'none' || request.customBatchSize !== undefined
        ? { ignoreSizeLimit: true }
        : undefined;
    // Legacy entry-mode groups (the truly-default path: no grouping dimension,
    // no per-run custom size) are now packed by `packEntryGroups` up to a cap
    // measured in SOURCE ENTRIES, not (entry, language) pairs — see M9/packing.ts.
    // The provider's own `maxBatchSize` chunking is job-count-based, so without
    // `ignoreSizeLimit` it could re-slice a group that merges MULTIPLE entries
    // and tear one of them across two calls. That only matters when the group
    // actually spans more than one entry — a single entry's own (entry,
    // language) jobs exceeding maxBatchSize is fine to split across calls as
    // usual (no other entry's boundary is at risk there), and that legacy,
    // still-tested behaviour must be preserved: unconditionally forcing
    // ignoreSizeLimit would silently disable a module's configured
    // maxBatchSize for the common single-entry case too.
    const dispatchOptionsFor = (group: RoutingDecision[]): BatchDispatchOptions | undefined => {
      // A Freeway batch was already sized to the chosen model's own maxBatch;
      // letting the provider re-chunk it would spend more free requests than
      // the plan budgeted for.
      if (freewayBucketKeys.has(group)) return { ignoreSizeLimit: true };
      if (batchDispatchOptions) return batchDispatchOptions;
      const moduleId = group[0]?.moduleId;
      if (moduleId === null || moduleId === undefined || resolveBatchMode(moduleId) !== 'entry') {
        return undefined;
      }
      const distinctEntries = new Set(group.map((d) => d.entry.id)).size;
      return distinctEntries > 1 ? { ignoreSizeLimit: true } : undefined;
    };
    // `disableMemory` skips the TM auto-apply path for this run only: coerce the
    // effective policy to `disabled` so every entry is sent to the model. The
    // project's stored `tmPolicy` is untouched (this is per-run, not persisted).
    const tmPolicy: TmMatchPolicy = disableMemory ? 'disabled' : (project.tmPolicy ?? 'disabled');

    if (freewayDecisions.length > 0) {
      groups.push(
        ...(await this.resolveFreewayGroups({
          runId,
          status,
          decisions: freewayDecisions,
          global,
          projectEntries,
          sessionId,
          isBatch,
          resolveBatchMode,
          bucketKeys: freewayBucketKeys,
          degraded: freewayDegraded,
        })),
      );
      if (groups.length === 0) {
        // Every pair was blocked or parked for quota: no dispatch group will
        // run, so the per-job `finalizeTranslationTerminal` never fires —
        // settle (or park) the run here, exactly like the all-controlled case.
        await this.finalizeTranslationTerminal(status, projectId, runId);
        return { runId, total: decisions.length, status: status.status };
      }
    }

    // Arm this run's settled deferred before any group task is queued so a
    // drain arriving mid-flight always finds it (both dispatch paths below wrap
    // their bodies in `trackTask`, which resolves it once every task has settled).
    this.tracker.arm(runId);

    // The task that processes one dispatch group. Single-decision groups are a
    // batch of 1 — the batch pipeline IS the pipeline (the separate single-job
    // path was deleted; its divergence caused the stale-result-after-cancel race).
    const makeGroupTask =
      (group: RoutingDecision[]): (() => Promise<void>) =>
      () =>
        this.processBatchJob(
          runId,
          projectId,
          group,
          project.sourceLanguage,
          project.moduleConfigs,
          sessionId,
          tmPolicy,
          referenceLanguage,
          examplesByLanguage,
          dispatchOptionsFor(group),
          project,
          achievementPairMap,
          freewayBucketKeys.get(group),
          freewayDegraded.get(group),
        );

    // Split-by-model: when the user asked for it AND the run touches ≥2 distinct
    // local Ollama models, process each model's groups fully before the next and
    // unload the previous model from VRAM between phases. Otherwise dispatch every
    // group together (the original behaviour).
    if (request.splitByModel) {
      const phases = this.partitionGroupsByLocalModel(groups, global, projectEntries);
      if (phases.localPhases.length >= 2) {
        void this.dispatchGroupsByModelSequentially(runId, phases, makeGroupTask);
        return { runId, total: decisions.length, status: RunStatusCode.Running };
      }
    }

    // Each queued task body runs LATER from `pump()` — possibly invoked
    // from a SIBLING run's `.finally()`, i.e. under whatever tenant just
    // finished. Re-establish THIS run's tenant around every body so its
    // run-store/string-store/TM writes stay tenant-scoped regardless of which
    // run's `pump()` dequeues it (mirrors M25's dispatch). The run's own tenant
    // is the one `startRun` re-established here (`getCurrentTenant()`); the
    // enqueue-time `queuedTenants` entry has already been consumed/cleared by
    // `resume`/`maybeStartNextQueued` before this point.
    const tenant = this.queuedTenants.get(runId) ?? getCurrentTenant();
    for (const group of groups) {
      const body = this.trackTask(runId, makeGroupTask(group));
      this.queue.add(runId, tenant ? () => runWithTenant(tenant, body) : body);
    }

    return { runId, total: decisions.length, status: RunStatusCode.Running };
  }

  /**
   * Partition dispatch groups for split-by-model: each distinct local Ollama
   * (baseURL, model) becomes its own phase (its groups processed together but
   * isolated from other local models), and every group that does NOT route to a
   * local Ollama model is collected into one shared `nonLocal` bucket. A group
   * is homogeneous in (moduleId, modelOverride) — `groupDecisions` keys batches
   * on both and single-job groups hold one decision — so classifying by the
   * first decision is exact.
   */
  private partitionGroupsByLocalModel(
    groups: RoutingDecision[][],
    global: GlobalConfig,
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>,
  ): {
    localPhases: Array<{
      baseURL: string;
      model: string;
      endpointType: EndpointType;
      groups: RoutingDecision[][];
    }>;
    nonLocal: RoutingDecision[][];
  } {
    const localByKey = new Map<
      string,
      { baseURL: string; model: string; endpointType: EndpointType; groups: RoutingDecision[][] }
    >();
    const nonLocal: RoutingDecision[][] = [];
    for (const group of groups) {
      const first = group[0];
      const local = first ? this.resolveLocalModel(first, global, projectEntries) : null;
      if (!local) {
        nonLocal.push(group);
        continue;
      }
      const key = `${local.baseURL}\0${local.model}`;
      const phase = localByKey.get(key);
      if (phase) {
        phase.groups.push(group);
      } else {
        localByKey.set(key, {
          baseURL: local.baseURL,
          model: local.model,
          endpointType: local.endpointType,
          groups: [group],
        });
      }
    }
    return { localPhases: [...localByKey.values()], nonLocal };
  }

  /**
   * Drive the split-by-model phases for one run. Each local-model phase is
   * dispatched in full, awaited to completion, then the model is unloaded from
   * VRAM before the next phase begins — so only one local model is resident at a
   * time. The non-local groups (paid/cloud modules, trivial routes) run last in
   * a single phase with no unload. Runs as the run's single record: the per-job
   * `finalizeTranslationTerminal` only fires once `completed + failed === total`,
   * which cannot happen until the final phase drains, so intermediate phases do
   * not prematurely complete the run.
   */
  private async dispatchGroupsByModelSequentially(
    runId: string,
    phases: {
      localPhases: Array<{
        baseURL: string;
        model: string;
        endpointType: EndpointType;
        groups: RoutingDecision[][];
      }>;
      nonLocal: RoutingDecision[][];
    },
    makeGroupTask: (group: RoutingDecision[]) => () => Promise<void>,
  ): Promise<void> {
    try {
      for (const phase of phases.localPhases) {
        this.logger.info('translation:split-phase-start', {
          runId,
          baseURL: phase.baseURL,
          model: phase.model,
          groups: phase.groups.length,
        });
        await this.runGroupsPhase(runId, phase.groups, makeGroupTask);
        // Free VRAM before the next model loads. Best-effort: a failed unload
        // (endpoint down, already evicted) never blocks the next phase.
        await unloadLocalModel({
          endpointType: phase.endpointType,
          baseURL: phase.baseURL,
          modelId: phase.model,
        });
        this.logger.info('translation:split-phase-unloaded', {
          runId,
          baseURL: phase.baseURL,
          model: phase.model,
        });
      }
      if (phases.nonLocal.length > 0) {
        await this.runGroupsPhase(runId, phases.nonLocal, makeGroupTask);
      }
    } catch (err) {
      this.logger.error('translation:split-dispatch-failed', {
        runId,
        error: err instanceof Error ? err.message : `${err}`,
      });
    }
  }

  /**
   * Enqueue every group in a phase and resolve once all of them have settled.
   * Each group still runs through the bounded-concurrency {@link JobQueue}
   * (sequential phases only gate when the NEXT model starts, not the parallelism
   * within a phase). A per-group deferred settles in the task's own `finally`,
   * so a cancelled run — whose queued tasks are dropped and whose in-flight tasks
   * return early — still resolves the phase rather than hanging.
   */
  private async runGroupsPhase(
    runId: string,
    groups: RoutingDecision[][],
    makeGroupTask: (group: RoutingDecision[]) => () => Promise<void>,
  ): Promise<void> {
    if (groups.length === 0) return;
    const signal = this.controllers.get(runId)?.signal;
    // If the run was already cancelled before this phase, its tasks would be
    // dropped by the queue and never settle — skip enqueuing so we don't await
    // forever.
    if (signal?.aborted || this.runs.get(runId)?.status === RunStatusCode.Cancelled) return;

    // As in startRunInner's dispatch, wrap each queued body in THIS run's
    // tenant so a body started from a sibling run's `pump()` `.finally()` still
    // writes under its own tenant.
    const tenant = this.queuedTenants.get(runId) ?? getCurrentTenant();
    const allSettled = Promise.all(
      groups.map((group) => {
        // Track the detached task for the settled-deferred drain.
        const task = this.trackTask(runId, makeGroupTask(group));
        return new Promise<void>((resolve) => {
          const body = async (): Promise<void> => {
            try {
              await task();
            } finally {
              resolve();
            }
          };
          this.queue.add(runId, tenant ? () => runWithTenant(tenant, body) : body);
        });
      }),
    );
    if (!signal) {
      await allSettled;
      return;
    }
    // Cancelling a run aborts its controller and drops its queued tasks, so the
    // wrappers above for not-yet-started tasks never resolve. Race the phase
    // against the abort signal so the dispatch loop unblocks on cancel instead
    // of hanging on those orphaned promises (in-flight tasks still settle their
    // own wrappers, and the unload step still runs).
    await new Promise<void>((resolve) => {
      const onAbort = () => resolve();
      signal.addEventListener('abort', onAbort, { once: true });
      void allSettled.finally(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      });
    });
  }

  getStatus(runId: string): RunStatus | undefined {
    return this.runs.get(runId);
  }

  // Deliberate mirror of M9/run-engine.ts:cancel — apply behavioral fixes to both.
  async cancel(runId: string): Promise<void> {
    const status = this.runs.get(runId);
    if (!status) return;
    if (
      status.status !== RunStatusCode.Running &&
      status.status !== RunStatusCode.Paused &&
      status.status !== RunStatusCode.Queued
    ) {
      return;
    }
    const wasActive = status.status !== RunStatusCode.Queued;
    status.status = RunStatusCode.Cancelled;
    status.finishedAt = Date.now();
    this.controllers.get(runId)?.abort();
    this.controllers.delete(runId);
    this.queue.cancelRun(runId);
    this.queuedSessions.delete(runId);
    this.queuedTenants.delete(runId);
    // A cancelled queued-retry must not leak its carried failed-pairs request.
    this.queuedRetryRequests.delete(runId);
    this.emitProgress(runId, status);
    await finalizeUsageCosts(status, this.pricing);
    // Persist whatever detail accumulated before the cancel so the partial
    // run's translated entries and character usage are still inspectable.
    await this.persistDetails(status.projectId, runId);
    await this.runStore.updateRun(status.projectId, status);
    // cancel() only SIGNALS; a detached job may still be mid-flight and will
    // resolve the deferred when it settles. Resolve here too for the case where
    // nothing is in flight (a Queued run, or one whose jobs already drained).
    this.maybeResolveSettled(runId);
    // Cancelling the active (running/paused) run frees the project's slot.
    if (wasActive) this.startNextQueued(status.projectId);
  }

  /**
   * Drain surface (mirrors the base BackgroundRunEngine). Bracket a
   * detached group task with the in-flight count so a run's settled deferred only
   * resolves after EVERY task has run its `finally` (past every late store write).
   */
  private trackTask(runId: string, body: () => Promise<void>): () => Promise<void> {
    return async () => {
      this.taskStarted(runId);
      try {
        await body();
      } finally {
        this.taskEnded(runId);
      }
    };
  }

  private taskStarted(runId: string): void {
    this.tracker.taskStarted(runId);
  }

  private taskEnded(runId: string): void {
    this.tracker.taskEnded(runId);
    this.maybeResolveSettled(runId);
  }

  /**
   * Resolve a run's settled deferred once it is TERMINAL (no longer Running/
   * Paused/Queued) AND no detached task is still executing — the invariant that
   * no further run-store write will occur for the run. Idempotent; a no-op while
   * the run is still active or a task is in flight.
   */
  private maybeResolveSettled(runId: string): void {
    const status = this.runs.get(runId);
    // The status predicate stays in the engine — TranslationEngine additionally
    // counts Queued as non-terminal (the base engine has no per-project queue).
    // The tracker owns only the drained-and-terminal resolve mechanics.
    const nonTerminal =
      status?.status === RunStatusCode.Running ||
      status?.status === RunStatusCode.Paused ||
      status?.status === RunStatusCode.Queued;
    this.tracker.maybeResolve(runId, nonTerminal);
  }

  /**
   * Cancel every non-terminal run this engine holds for `projectId` and
   * await their REAL settlement (each run's detached jobs finishing their
   * `finally`), bounded by `timeoutMs`. Used by cloud account deletion so no run
   * store write lands after `teardownTenant` removes `project_members`.
   *
   * Cancels QUEUED runs first, then active (Running/Paused) ones: cancelling an
   * active run fires `startNextQueued`, and draining the queue first guarantees it
   * finds no queued successor to promote into a NEW writer. Never throws: on
   * timeout it returns `timedOut: true` and leaves the straggler to teardown's
   * convergence-loop backstop.
   */
  async cancelAllForProject(
    projectId: string,
    opts?: { timeoutMs?: number },
  ): Promise<{ cancelled: string[]; timedOut: boolean }> {
    const queued: string[] = [];
    const active: string[] = [];
    for (const [runId, status] of this.runs) {
      if (status.projectId !== projectId) continue;
      if (status.status === RunStatusCode.Queued) queued.push(runId);
      else if (status.status === RunStatusCode.Running || status.status === RunStatusCode.Paused) {
        active.push(runId);
      }
    }
    const targets = [...queued, ...active];
    // Capture settled promises BEFORE cancelling (cancel may resolve+drop a
    // deferred synchronously when nothing is in flight).
    const promises = this.tracker.capturePromises(targets);
    for (const runId of targets) {
      await this.cancel(runId).catch(() => {});
    }
    const timedOut = await awaitAllWithTimeout(promises, opts?.timeoutMs);
    return { cancelled: targets, timedOut };
  }

  /**
   * Cancel the run when `err` (a thrown error or a module's per-result `error`
   * string) signals a 401/403 auth failure. The credential is invalid for every
   * job in the run, so there is no point letting the remaining entries make the
   * same doomed call — we stop the run immediately (status → Cancelled, in-flight
   * jobs aborted, queued jobs dropped). Idempotent: `cancel()` no-ops once the
   * run is already Cancelled, so concurrent jobs that all see the auth error
   * cancel exactly once. Returns true when an auth failure was detected.
   */
  private async maybeCancelForAuth(
    runId: string,
    moduleId: string | null,
    err: unknown,
  ): Promise<boolean> {
    // Gate run-cancellation on a STRUCTURED auth signal (typed AuthError /
    // 401|403 statusCode) or, for downgraded per-result error STRINGS, an
    // explicit 401/403 status token — NOT the broad forbidden/permission-denied
    // message vocabulary, which also matches per-entry content refusals.
    if (!isRunCancellingAuthError(err)) return false;
    const status = this.runs.get(runId);
    if (status && status.status !== RunStatusCode.Cancelled) {
      this.logger.error('translation:auth-cancel', {
        runId,
        moduleId,
        error: err instanceof Error ? err.message : `${err}`,
      });
      await this.cancel(runId);
    }
    return true;
  }

  /**
   * Pause a running run: no new jobs are dequeued for it, in-flight jobs
   * finish normally. Returns false when the run is not currently running.
   */
  async pause(runId: string): Promise<boolean> {
    const status = this.runs.get(runId);
    if (!status || status.status !== RunStatusCode.Running) return false;
    status.status = RunStatusCode.Paused;
    this.queue.pauseRun(runId);
    this.emitProgress(runId, status);
    await this.runStore.updateRun(status.projectId, status);
    return true;
  }

  /**
   * Resume a paused run, start a queued run immediately ("start now"), or —
   * after a server restart — adopt a queued run persisted by the RunStore and
   * start it. Returns the run's status, or null when nothing was resumable.
   *
   * `sessionId` is the RESUMING caller's session. It matters for the
   * quota-resume path, which starts a fresh translation pass: credentials are
   * read per session, and the run's own enqueue-time session may be long gone
   * (a next-day resume is a different session entirely), so the caller's
   * current one is both fresher and more correct than the captured one.
   */
  async resume(projectId: string, runId: string, sessionId?: string): Promise<RunStatus | null> {
    const status = this.runs.get(runId);
    if (status) {
      if (status.status === RunStatusCode.Paused) {
        const waiting = status.waitingForQuota;
        // Only a DRAINED run re-plans here (see isParkedForQuota): a user-paused
        // run that still has in-flight or queued work must take the legacy
        // resume path, or startRun would run a second dispatch pass over it.
        if (waiting && this.isParkedForQuota(status)) {
          // Parked for free quota: re-plan exactly those pairs against fresh
          // bucket views (they may resolve to different modules this time).
          return await this.resumeWaitingForQuota(
            projectId,
            runId,
            status,
            waiting.pairs,
            sessionId,
          );
        }
        status.status = RunStatusCode.Running;
        this.queue.resumeRun(runId);
        this.emitProgress(runId, status);
        await this.runStore.updateRun(projectId, status);
        return status;
      }
      if (status.status === RunStatusCode.Queued) {
        // Per-project run guard: "start now" must not jump ahead of a run that is
        // already active/starting for this project (that would create a 2nd active
        // run), and must not race the dequeue path into double-starting the SAME
        // run (both calling startRun while its status is still Queued → double
        // billing). Leave THIS run queued; it starts via maybeStartNextQueued once
        // the active run finishes.
        if (this.hasActiveProjectRun(projectId) || this.startingProjects.has(projectId)) {
          return status;
        }
        const sessionId = this.queuedSessions.get(runId);
        // Re-establish THIS run's enqueue-time tenant (resume may be driven
        // off a request, but the run's own captured tenant is authoritative).
        const tenant = this.queuedTenants.get(runId) ?? getCurrentTenant();
        // Mirror maybeStartNextQueued: a deferred retry stashed its failed-pairs
        // request here; consume it so resume dispatches the failed pairs (retry
        // = true), not the run's full original scope. Also prevents a leaked map
        // entry when this branch (not maybeStartNextQueued) starts the run.
        const retryReq = this.queuedRetryRequests.get(runId);
        this.queuedSessions.delete(runId);
        this.queuedTenants.delete(runId);
        this.queuedRetryRequests.delete(runId);
        await this.startRun(
          runId,
          projectId,
          retryReq ?? status.request ?? { entryIds: [], targetLanguages: [], reTranslate: false },
          sessionId,
          status,
          retryReq ? true : false,
          tenant,
        );
        return status;
      }
      return null;
    }
    // Restart path: the in-memory engine lost the run, but the RunStore
    // persisted it — adopt and start it. The enqueue-time tenant did not survive
    // the restart (in-memory only); resume is on a request thread, so
    // re-establish the active request tenant.
    const persisted = await this.runStore.getRun(projectId, runId);
    const persistedWaiting = persisted?.waitingForQuota;
    if (persisted && persistedWaiting && this.isParkedForQuota(persisted)) {
      // A run parked for free quota outlives the process by design (a park can
      // last until tomorrow's reset), so a restart must not strand it: adopt the
      // persisted status back into memory and re-plan exactly its parked pairs.
      // Per-project run guard (see the in-memory branches): never start it
      // alongside a run already active/starting for the project.
      if (this.hasActiveProjectRun(projectId) || this.startingProjects.has(projectId)) {
        return persisted;
      }
      // Same collateral-failure guard the sweep applies: with zero visible
      // buckets a re-plan would fail every parked pair instead of waiting.
      // Leave the run parked (and say why) rather than adopting it.
      if (!(await this.hasAnyFreewayBucket(projectId, sessionId))) {
        await this.markQuotaResumeSkipped(projectId, persisted, NO_BUCKETS_SKIP_REASON);
        return persisted;
      }
      this.runs.set(runId, persisted);
      return await this.resumeWaitingForQuota(
        projectId,
        runId,
        persisted,
        persistedWaiting.pairs,
        sessionId,
      );
    }
    if (persisted && persisted.status === RunStatusCode.Queued && persisted.request) {
      // Per-project run guard (see the in-memory branch above): don't adopt-start
      // this persisted run ahead of a run already active/starting for the project.
      if (this.hasActiveProjectRun(projectId) || this.startingProjects.has(projectId)) {
        return persisted;
      }
      this.runs.set(runId, persisted);
      await this.startRun(
        runId,
        projectId,
        persisted.request,
        undefined,
        persisted,
        false,
        getCurrentTenant(),
      );
      return persisted;
    }
    return null;
  }

  /**
   * Resume a run parked on `waitingForQuota`: re-dispatch exactly the parked
   * (entry, language) pairs as an in-place retry — the same shape
   * {@link retryFailed} uses — so the run keeps its original `total`,
   * `completed`/`failed` tallies and usage while its freeway decisions are
   * re-resolved against whatever quota is available now. The field is cleared
   * first: a re-plan that STILL finds no quota parks the pairs again.
   */
  private async resumeWaitingForQuota(
    projectId: string,
    runId: string,
    status: RunStatus,
    pairs: RunEntryLanguagePair[],
    sessionId?: string,
  ): Promise<RunStatus> {
    const parked = [...pairs];
    const park = {
      resumeAt: status.waitingForQuota?.resumeAt ?? Date.now(),
      pairs: parked,
      reason: status.waitingForQuota?.reason,
    };
    delete status.waitingForQuota;
    this.queue.resumeRun(runId);
    const request = this.parkedRetryRequest(status, parked);
    try {
      await this.startRun(
        runId,
        projectId,
        request,
        // The resuming caller's session first (freshest credentials), then the
        // session this run last dispatched under; `queuedSessions` is consumed
        // at dequeue, so it is empty for a run that started immediately.
        sessionId ?? this.runSessions.get(runId) ?? this.queuedSessions.get(runId),
        status,
        true,
        this.queuedTenants.get(runId) ?? getCurrentTenant(),
      );
    } catch (err) {
      // The park was cleared for a dispatch that never happened — put it back
      // rather than leaving the run stuck with neither work nor parked pairs.
      await this.restoreQuotaPark(projectId, status, park);
      throw err;
    }
    return status;
  }

  /**
   * The in-place retry request for a set of parked pairs: the run keeps its
   * original `total`/`completed`/`failed` and usage while exactly these pairs
   * are re-dispatched (the shape {@link retryFailed} uses). The run's own
   * request supplies the per-run knobs that must survive the re-dispatch.
   */
  private parkedRetryRequest(status: RunStatus, parked: RunEntryLanguagePair[]): RunRequest {
    const source = status.request;
    return {
      entryIds: [...new Set(parked.map((p) => p.entryId))],
      targetLanguages: [...new Set(parked.map((p) => p.targetLanguage))],
      reTranslate: true,
      pairs: parked,
      ...(source?.referenceLanguage ? { referenceLanguage: source.referenceLanguage } : {}),
      ...(source?.exampleEntryIds?.length ? { exampleEntryIds: source.exampleEntryIds } : {}),
      ...(source?.disableMemory ? { disableMemory: true } : {}),
      ...(source?.batchGrouping !== undefined ? { batchGrouping: source.batchGrouping } : {}),
      ...(source?.customBatchSize !== undefined ? { customBatchSize: source.customBatchSize } : {}),
      ...(source?.ignoreBatchSizeLimit !== undefined
        ? { ignoreBatchSizeLimit: source.ignoreBatchSizeLimit }
        : {}),
    };
  }

  /**
   * True when a run is parked on free quota AND drained — its parked pairs
   * account for everything still missing (`completed + failed + parked >=
   * total`). A `Paused` run that fails the drained test is a run the USER
   * paused with work still outstanding: re-dispatching it would start a second
   * pass over live work, so every auto/explicit re-plan path gates on this.
   */
  private isParkedForQuota(status: RunStatus): boolean {
    const waiting = status.waitingForQuota;
    if (status.status !== RunStatusCode.Paused || !waiting || waiting.pairs.length === 0) {
      return false;
    }
    return status.completed + status.failed + waiting.pairs.length >= status.total;
  }

  /**
   * Auto-resume pass over the runs parked on free quota: every drained
   * `Paused` run whose `resumeAt` has arrived is re-planned against fresh
   * bucket views. Armed as an unref'd interval when the engine opts in (see
   * `quotaSweepIntervalMs`), and directly callable (tests, manual triggers).
   *
   * Three properties matter here:
   * - **Tenancy.** The pass runs off any request, so each resume is wrapped in
   *   the run's OWN captured tenant — never an ambient one, never another
   *   run's.
   * - **No spinning.** A park whose `resumeAt` is immediate is re-attempted at
   *   most once per {@link TranslationEngine.QUOTA_RESUME_MIN_INTERVAL_MS},
   *   whatever the tick period.
   * - **No collateral failures.** When the run's session can no longer see ANY
   *   free-tier bucket (its credentials went away with a relocked vault or an
   *   expired session), re-planning would classify every pair as
   *   permanently-unservable and FAIL it. The run is left parked instead — a
   *   manual resume (or resume-with-module) under a live session recovers it.
   *
   * The pass also adopts the parks a restart left behind (see
   * {@link adoptPersistedParks}), so a park never depends on the process that
   * created it still being alive.
   *
   * `opts` is the vault-unlock nudge's entry point:
   * - `fallbackSessionId` — a session to stand in for runs whose OWN captured
   *   session did not survive the restart. Applied only to a run of the
   *   CALLING tenant (a session must never cross tenants) that has no session
   *   of its own.
   * - `force` — skip the per-run re-attempt throttle for this pass (an unlock
   *   is a real state change, not a tick). Applied to the CALLING tenant's own
   *   runs only: another tenant's park learned nothing from this unlock, so it
   *   keeps its ordinary throttle. The `resumeAt` requirement always holds: a
   *   park that is not due yet is never re-planned.
   *
   * @returns how many runs were actually re-dispatched.
   */
  async sweepQuotaResumes(
    now: number = Date.now(),
    opts?: { fallbackSessionId?: string; force?: boolean },
  ): Promise<number> {
    if (this.quotaSweepInFlight) return 0;
    this.quotaSweepInFlight = true;
    try {
      await this.adoptPersistedParks();
      // Read the ambient tenant HERE, not inside `attempt`: the attempt runs
      // inside runWithTenant(tenant, …), which re-scopes the ambient tenant to
      // the RUN's own — the guards below would then compare the run against
      // itself and always pass.
      const callerTenant = getCurrentTenant();
      const due = [...this.runs.values()].filter((status) => {
        // `force` is news about the CALLER's own state (their vault just
        // unlocked), so it may only waive the throttle on the caller's own
        // runs. Another tenant's park keeps its ordinary throttle — same
        // both-sides-known guard the fallback session uses below.
        const owner = this.runTenants.get(status.runId) ?? this.queuedTenants.get(status.runId);
        const forceThisRun =
          opts?.force === true &&
          owner?.userId !== undefined &&
          owner.userId === callerTenant?.userId;
        return this.isQuotaResumeDue(status, now, forceThisRun);
      });
      let resumed = 0;
      for (const status of due) {
        const { runId, projectId } = status;
        // Per-project dispatch guard. It matters most for adopted parks:
        // `resume`'s own guard only covers a run IT adopts, so without this a
        // park adopted here could start alongside a run that began before the
        // adoption — and a restart can hand back SEVERAL parks for one
        // project, which would then all start at once. Deliberately not
        // stamped as an attempt: the project frees up on its own and the next
        // tick should retry immediately.
        if (this.hasDispatchingProjectRun(projectId, runId)) continue;
        this.lastQuotaResumeAttempt.set(runId, now);
        const tenant = this.runTenants.get(runId) ?? this.queuedTenants.get(runId);
        const attempt = async (): Promise<boolean> => {
          const ownSession = this.runSessions.get(runId) ?? this.queuedSessions.get(runId);
          // A fallback session (the vault-unlock nudge) may only stand in for a
          // run whose own captured session did not survive the restart AND
          // whose tenant is the calling one — a session must never cross
          // tenants. Both sides must be KNOWN and equal: a run with no captured
          // tenant is not "everyone's", it is unattributable, so it gets
          // nothing. (Local mode still matches: both are 'local'.)
          const fallbackApplies =
            opts?.fallbackSessionId !== undefined &&
            ownSession === undefined &&
            tenant?.userId !== undefined &&
            tenant.userId === callerTenant?.userId;
          const sessionId = ownSession ?? (fallbackApplies ? opts?.fallbackSessionId : undefined);
          if (!(await this.hasAnyFreewayBucket(projectId, sessionId))) {
            this.logger.info('translation:quota-sweep-skipped', {
              runId,
              reason: NO_BUCKETS_SKIP_REASON,
            });
            // Record WHY on the run itself: a skipped run stays parked
            // indefinitely (and keeps blocking its project's queue), so the
            // reason must be visible to the user, not just in the log.
            await this.markQuotaResumeSkipped(projectId, status, NO_BUCKETS_SKIP_REASON);
            return false;
          }
          // The run's own captured session is the right one when it has one
          // (there is no requesting caller) — passing it explicitly is what
          // resumeWaitingForQuota would fall back to anyway; only the nudge's
          // fallback adds anything.
          // Null means nothing was resumable after all (e.g. the run went
          // terminal between the scan and here) — not a re-dispatch.
          return (await this.resume(projectId, runId, sessionId)) !== null;
        };
        try {
          if (await (tenant ? runWithTenant(tenant, attempt) : attempt())) resumed++;
        } catch (err) {
          this.logger.warn('translation:quota-sweep-failed', {
            runId,
            error: toErrorMessage(err),
          });
        }
      }
      return resumed;
    } finally {
      this.quotaSweepInFlight = false;
    }
  }

  /**
   * Adopt the free-quota parks that only the RunStore knows about — once per
   * process, at the head of the first sweep pass.
   *
   * A park outlives the process by design (it can last until tomorrow's
   * reset), but the sweep walks in-memory runs, so after a restart the park
   * exists only in the store and the run would sit paused until a manual
   * resume. The scan is cross-tenant (a system read on the raw pool — see
   * `storage/quota-parked-runs.ts`), so each adopted run also gets its OWN
   * tenant re-established here; every later touch runs inside it.
   *
   * Once, not every tick: from the adoption on, the ordinary in-memory pass
   * owns these runs (throttle, skip reasons, resume), and a run already in
   * memory is never overwritten by its persisted copy.
   */
  private async adoptPersistedParks(): Promise<void> {
    if (this.parkAdoptionDone) return;
    try {
      const parked = await (this._listParkedRuns ?? listQuotaParkedRuns)();
      let adopted = 0;
      for (const row of parked) {
        if (this.runs.has(row.runId)) continue;
        if (!this.isParkedForQuota(row.status)) continue;
        this.runs.set(row.runId, row.status);
        this.runTenants.set(row.runId, { userId: row.tenantId });
        adopted++;
      }
      if (adopted > 0) {
        this.logger.info('translation:quota-park-adopted', { count: adopted });
      }
      this.parkAdoptionDone = true;
    } catch (err) {
      // The flag stays unset deliberately: a failed scan (the DB briefly down
      // at boot) retries on the next tick rather than silently stranding the
      // parks for the life of the process.
      this.logger.warn('translation:quota-park-adopt-failed', { error: toErrorMessage(err) });
    }
  }

  /**
   * Stamp `waitingForQuota.skipReason` on a run the auto-resume declined to
   * re-plan and persist it, so an indefinitely-parked run can explain itself.
   * Best-effort: a failed write never propagates into the sweep.
   */
  private async markQuotaResumeSkipped(
    projectId: string,
    status: RunStatus,
    reason: string,
  ): Promise<void> {
    const waiting = status.waitingForQuota;
    if (!waiting || waiting.skipReason === reason) return;
    waiting.skipReason = reason;
    await this.runStore.updateRun(projectId, status).catch((err: unknown) => {
      this.logger.warn('translation:quota-skip-persist-failed', {
        runId: status.runId,
        error: toErrorMessage(err),
      });
    });
  }

  /**
   * Undo a park-clearing re-dispatch that never got off the ground: `startRun`
   * threw, so the run is neither running nor parked — an invisible, permanently
   * stuck state. Put the pairs back (dropping any stale skip reason but
   * restoring the prior `reason` label verbatim), re-pause the run and
   * persist, then let the caller rethrow.
   */
  private async restoreQuotaPark(
    projectId: string,
    status: RunStatus,
    park: {
      resumeAt: number;
      pairs: RunEntryLanguagePair[];
      reason?: 'quota' | 'provider-error';
    },
  ): Promise<void> {
    status.waitingForQuota = {
      resumeAt: park.resumeAt,
      pairs: park.pairs,
      ...(park.reason ? { reason: park.reason } : {}),
    };
    status.status = RunStatusCode.Paused;
    this.queue.pauseRun(status.runId);
    await this.runStore.updateRun(projectId, status).catch((err: unknown) => {
      this.logger.warn('translation:quota-park-restore-failed', {
        runId: status.runId,
        error: toErrorMessage(err),
      });
    });
  }

  /**
   * A parked run the sweep may re-plan right now (see {@link sweepQuotaResumes}).
   * `force` waives only the per-run re-attempt throttle (the vault-unlock
   * nudge: a fresh session is new information, not another tick) — never the
   * park's own `resumeAt`, which is what the free quota actually requires. The
   * caller decides `force` per run, since an unlock only speaks for the
   * unlocking tenant's own parks.
   */
  private isQuotaResumeDue(status: RunStatus, now: number, force = false): boolean {
    if (!this.isParkedForQuota(status)) return false;
    if ((status.waitingForQuota?.resumeAt ?? 0) > now) return false;
    if (force) return true;
    const last = this.lastQuotaResumeAttempt.get(status.runId);
    return last === undefined || now - last >= TranslationEngine.QUOTA_RESUME_MIN_INTERVAL_MS;
  }

  /**
   * Whether this project/session can see any free-tier bucket at all. Zero
   * buckets means a re-plan would mark every pair permanently unservable
   * (`freeway-no-buckets`), which is right for a real "nothing can ever serve
   * this" but wrong for "this session lost its credentials" — so the sweep
   * checks first and leaves such runs parked.
   */
  private async hasAnyFreewayBucket(
    projectId: string,
    sessionId: string | undefined,
  ): Promise<boolean> {
    const global = await this.globalConfigStore.load();
    const project = await this.projectStore.loadProject(projectId);
    const projectEntries = project.moduleConfigs as Record<
      string,
      ProjectModuleConfigEntry | undefined
    >;
    const deps = this.freewayBucketDeps(global, projectEntries, sessionId);
    const buckets = await loadBucketViews(Date.now(), deps);
    return buckets.length > 0;
  }

  /**
   * Escape hatch for a run parked on free quota: re-dispatch exactly its parked
   * pairs onto ONE explicitly chosen module, bypassing Freeway entirely (the
   * user is knowingly spending their own paid quota rather than waiting for the
   * free pool). Same in-place retry shape as {@link resumeWaitingForQuota}, so
   * the run keeps its identity, tallies and usage.
   *
   * Refuses (with a reason, never a throw) for anything but a drained parked
   * run and a registered, enabled, credentialed module — see
   * {@link ResumeWithModuleResult}.
   */
  async resumeWithModule(
    projectId: string,
    runId: string,
    moduleId: string,
    sessionId?: string,
  ): Promise<ResumeWithModuleResult> {
    // Restart-safe: fall back to the persisted row, which is adopted below.
    const inMemory = this.runs.get(runId);
    const status = inMemory ?? (await this.runStore.getRun(projectId, runId));
    if (!status) return { ok: false, reason: 'not-found' };
    const waiting = status.waitingForQuota;
    if (status.status !== RunStatusCode.Paused || !waiting || waiting.pairs.length === 0) {
      return { ok: false, reason: 'not-parked' };
    }
    if (!this.isParkedForQuota(status)) return { ok: false, reason: 'not-drained' };
    // Adoption (restart) path only: an in-memory parked run IS its project's
    // active run, so the guard would always trip for it. A run being adopted,
    // though, must not start alongside a run already active/starting there.
    if (
      !inMemory &&
      (this.hasActiveProjectRun(projectId) || this.startingProjects.has(projectId))
    ) {
      return { ok: false, reason: 'project-busy' };
    }
    const availability = await this.moduleAvailability(projectId, moduleId, sessionId);
    if (availability !== 'ok') return { ok: false, reason: availability };

    const parked = [...waiting.pairs];
    const park = { resumeAt: waiting.resumeAt, pairs: parked, reason: waiting.reason };
    this.runs.set(runId, status);
    delete status.waitingForQuota;
    this.queue.resumeRun(runId);
    try {
      await this.startRun(
        runId,
        projectId,
        this.parkedRetryRequest(status, parked),
        sessionId ?? this.runSessions.get(runId) ?? this.queuedSessions.get(runId),
        status,
        true,
        this.queuedTenants.get(runId) ?? this.runTenants.get(runId) ?? getCurrentTenant(),
        moduleId,
      );
    } catch (err) {
      // See resumeWaitingForQuota: a dispatch that threw must leave the run
      // parked, not park-less and idle.
      await this.restoreQuotaPark(projectId, status, park);
      if (!inMemory) {
        // The adoption above put a run into memory that was not there before;
        // a failed start must not leave it there, where it would count toward
        // hasActiveProjectRun and wedge the project's queue. Unwind fully — the
        // restored store row is what a later resume re-adopts.
        this.queue.cancelRun(runId);
        this.forgetRun(runId);
      }
      throw err;
    }
    return { ok: true, status };
  }

  /**
   * Is `moduleId` a usable dispatch target for this project/session? Mirrors
   * the credential/enablement view the freeway bucket source uses (effective
   * config for enablement, registry metadata for credentials), including its
   * `getModule` fallback for injected registries without `getMetadata`, and
   * additionally refuses modules that must never receive a real translation
   * pass.
   */
  private async moduleAvailability(
    projectId: string,
    moduleId: string,
    sessionId: string | undefined,
  ): Promise<'ok' | 'unknown-module' | 'module-unavailable' | 'module-not-eligible'> {
    const module = this.moduleRegistry.getModule(moduleId);
    if (!module) return 'unknown-module';
    // The pseudo module is bound two-way to the synthetic `pseudo-test`
    // language (M7 special-cases it so real translations are never
    // overwritten). Choosing it here would write pseudo text over the run's
    // REAL target languages, which is exactly the invariant M7 protects.
    if (moduleId === PSEUDO_MODULE_ID || module.id === PSEUDO_MODULE_ID) {
      return 'module-not-eligible';
    }
    if (!module.capabilities.includes('translate')) return 'module-not-eligible';
    const global = await this.globalConfigStore.load();
    const project = await this.projectStore.loadProject(projectId);
    const projectEntry = (
      project.moduleConfigs as Record<string, ProjectModuleConfigEntry | undefined>
    )[moduleId];
    const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntry);
    if (!effective.enabled || effective.active === false) return 'module-unavailable';
    if (!this.moduleRegistry.getMetadata) return 'ok';
    const metadata = this.moduleRegistry.getMetadata(moduleId, sessionId, false, global);
    if (!metadata || metadata.credentialStatus !== 'ok') return 'module-unavailable';
    return 'ok';
  }

  /**
   * Reorder the project's pending queue. `runIds` lists the desired order;
   * queued runs not mentioned keep their relative order after the listed
   * ones. Returns the queued runs in their new order.
   */
  async reorderQueue(projectId: string, runIds: string[]): Promise<RunStatus[]> {
    const queued = this.queuedRunsForProject(projectId);
    const byId = new Map(queued.map((s) => [s.runId, s]));
    const ordered: RunStatus[] = [];
    for (const id of runIds) {
      const s = byId.get(id);
      if (!s) continue;
      ordered.push(s);
      byId.delete(id);
    }
    const rest = [...byId.values()].sort((a, b) => (a.queuePosition ?? 0) - (b.queuePosition ?? 0));
    ordered.push(...rest);
    for (let i = 0; i < ordered.length; i++) {
      ordered[i].queuePosition = i + 1;
      await this.runStore.updateRun(projectId, ordered[i]);
    }
    return ordered;
  }

  hasInProgressProjectRun(projectId: string): boolean {
    return this.hasActiveProjectRun(projectId);
  }

  /** A run is "active" while it is running with jobs left, or paused. */
  private hasActiveProjectRun(projectId: string): boolean {
    for (const status of this.runs.values()) {
      if (status.projectId !== projectId) continue;
      if (status.status === RunStatusCode.Paused) return true;
      if (status.status !== RunStatusCode.Running) continue;
      if (status.completed + status.failed >= status.total) continue;
      return true;
    }
    return false;
  }

  /**
   * Is some OTHER run for this project mid-dispatch right now (starting, or
   * running with work left)? The quota sweep's guard: a parked run counts as
   * "active" by {@link hasActiveProjectRun}, so two sibling parks would block
   * each other forever under that test — what actually must not overlap is a
   * second DISPATCH pass over the same project.
   */
  private hasDispatchingProjectRun(projectId: string, exceptRunId: string): boolean {
    if (this.startingProjects.has(projectId)) return true;
    for (const status of this.runs.values()) {
      if (status.projectId !== projectId || status.runId === exceptRunId) continue;
      if (status.status !== RunStatusCode.Running) continue;
      if (status.completed + status.failed >= status.total) continue;
      return true;
    }
    return false;
  }

  private hasQueuedProjectRun(projectId: string): boolean {
    for (const status of this.runs.values()) {
      if (status.projectId === projectId && status.status === RunStatusCode.Queued) return true;
    }
    return false;
  }

  /** All Queued runs for a project, in insertion order (callers apply their own ordering). */
  private queuedRunsForProject(projectId: string): RunStatus[] {
    return [...this.runs.values()].filter(
      (s) => s.projectId === projectId && s.status === RunStatusCode.Queued,
    );
  }

  // Two near-simultaneous enqueues for the same project can each read `runs`
  // before the other persists, so both compute the same position. The
  // tiebreak in maybeStartNextQueued falls back to startedAt, so impact is
  // cosmetic ordering only.
  private nextQueuePosition(projectId: string): number {
    let max = 0;
    for (const status of this.runs.values()) {
      if (status.projectId !== projectId || status.status !== RunStatusCode.Queued) continue;
      if (status.queuePosition !== undefined && status.queuePosition > max) {
        max = status.queuePosition;
      }
    }
    return max + 1;
  }

  /** Fire-and-forget wrapper so completion paths never await queue chaining. */
  private startNextQueued(projectId: string): void {
    void this.maybeStartNextQueued(projectId).catch((err) => {
      this.logger.error('translation:queue-start-failed', {
        projectId,
        error: err instanceof Error ? err.message : `${err}`,
      });
    });
  }

  private async maybeStartNextQueued(projectId: string): Promise<void> {
    if (this.hasActiveProjectRun(projectId) || this.startingProjects.has(projectId)) return;
    const queued = this.queuedRunsForProject(projectId).sort(
      (a, b) =>
        (a.queuePosition ?? Number.MAX_SAFE_INTEGER) -
          (b.queuePosition ?? Number.MAX_SAFE_INTEGER) || a.startedAt - b.startedAt,
    );
    const next = queued[0];
    if (!next) return;
    const sessionId = this.queuedSessions.get(next.runId);
    // This drain runs OFF any request context (fired via startNextQueued
    // from the preceding run's completion). Re-establish THIS run's enqueue-time
    // tenant for both the defensive failed-write and its startRun.
    const tenant = this.queuedTenants.get(next.runId);
    this.queuedSessions.delete(next.runId);
    this.queuedTenants.delete(next.runId);
    if (!next.request) {
      // Defensive: a queued run without its request cannot be routed.
      next.status = RunStatusCode.Failed;
      next.finishedAt = Date.now();
      const persist = () => this.runStore.updateRun(projectId, next).catch(() => {});
      await (tenant ? runWithTenant(tenant, persist) : persist());
      await this.maybeStartNextQueued(projectId);
      return;
    }
    // A deferred `retryFailed` carries its failed-pairs dispatch request here so
    // the run's persisted `request` (its original full scope, judged by AI review)
    // is left untouched. When present, dispatch it with retry=true so this pass
    // re-translates exactly the failed pairs — matching the immediate retryFailed
    // path. Otherwise dispatch the run's own request as a normal (non-retry) start.
    const retryReq = this.queuedRetryRequests.get(next.runId);
    this.queuedRetryRequests.delete(next.runId);
    try {
      await this.startRun(
        next.runId,
        projectId,
        retryReq ?? next.request,
        sessionId,
        next,
        retryReq ? true : false,
        tenant,
      );
    } catch (err) {
      this.logger.error('translation:queue-start-failed', {
        runId: next.runId,
        projectId,
        error: err instanceof Error ? err.message : `${err}`,
      });
      next.status = RunStatusCode.Failed;
      next.finishedAt = Date.now();
      const persist = () => this.runStore.updateRun(projectId, next).catch(() => {});
      await (tenant ? runWithTenant(tenant, persist) : persist());
      await this.maybeStartNextQueued(projectId);
    }
  }

  /**
   * The Router signature requires `availableModules`. We extract the set of
   * module ids referenced by the rules themselves so routing can fall through
   * when a rule's moduleId is unknown; `processBatchJob` does the authoritative
   * check against the live registry.
   *
   * The pseudo module is always included: it is statically compiled in, needs
   * no credentials, and is hard-bound to the synthetic `pseudo-test` language,
   * so `pseudo-test` jobs must route without requiring a user-defined rule
   * (just enable the module + add the language). If the module is not actually
   * enabled, `processBatchJob` still reports `module-disabled` authoritatively.
   */
  private deriveAvailableModuleIds(rules: { moduleId: string }[]): { id: string }[] {
    return deriveAvailableModuleIds(rules);
  }

  /**
   * The entry's existing translation in `referenceLanguage`, attached to jobs
   * as LLM prompt context. Undefined when no reference language was requested,
   * it equals the job's target, or the entry has no text in it.
   */
  private jobReference(
    entry: StringEntry,
    targetLanguage: string,
    referenceLanguage?: string,
  ): TranslationJob['reference'] {
    return jobReference(entry, targetLanguage, referenceLanguage);
  }

  /**
   * Bucket-source dependencies for this run. The injected overrides win (tests
   * supply a fake ledger); otherwise the engine builds the session-scoped
   * `moduleStatus` view the bucket source expects — enablement from the run's
   * effective module config, credentials from the registry's metadata for THIS
   * session. Fail-closed: an id the registry does not know contributes no
   * bucket. The `getModule` fallback exists only for injected registries that
   * do not implement `getMetadata` (the DI test seam); the live registry always
   * does.
   */
  private freewayBucketDeps(
    global: GlobalConfig,
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>,
    sessionId: string | undefined,
  ): BucketSourceDeps {
    if (this.freewayOverrides.moduleStatus) return this.freewayOverrides;
    return {
      ...this.freewayOverrides,
      moduleStatus: (moduleId: string) => {
        const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntries[moduleId]);
        const enabled = effective.enabled && effective.active !== false;
        if (!this.moduleRegistry.getMetadata) {
          return this.moduleRegistry.getModule(moduleId)
            ? { credentialed: true, enabled }
            : undefined;
        }
        const metadata = this.moduleRegistry.getMetadata(moduleId, sessionId, false, global);
        if (!metadata) return undefined;
        return { credentialed: metadata.credentialStatus === 'ok', enabled };
      },
    };
  }

  /**
   * Reads a Freeway probe's credential (DeepL/OpenRouter) by its manifest
   * env-var name, scoped to this run's session — the only way `syncAuthoritativeUsage`
   * is allowed to see a credential (never `process.env`). `moduleId` here is
   * always the snapshot's base module id (see {@link syncAuthoritativeUsage}'s
   * callers), but the credential the probe needs may live on whichever
   * instance Freeway actually dispatches through: instance credentials are
   * vault-keyed under a DERIVED name, not the bare env var. Delegates to
   * {@link resolveFreewayProbeCredential} for the actual vault walk, but
   * FIRST computes `dispatchModuleId` via {@link resolveDispatchModuleId} —
   * the same enablement- and credential-mark-aware algorithm `loadBucketViews`
   * uses (fed the SAME `deps.moduleStatus`/`deps.instanceIdsFor` and
   * `bucketStates` snapshot `resolveFreewayGroups` also hands
   * `loadBucketViews`, and the SAME `instanceOverrides[moduleId]`) — and
   * hands THAT resolved id, not the raw override, to the vault walk. This
   * matters with or without an override set: `resolveFreewayProbeCredential`
   * on its own walks candidates by credential PRESENCE only, so an instance
   * that is disabled or credential-marked but still holds a vaulted key
   * (e.g. `<base>:default` after the workspace was pointed at another
   * instance, or simply left disabled) would otherwise be probed even though
   * dispatch skips it. Seeding the walk with `dispatchModuleId` instead
   * guarantees the probe always reads the SAME account dispatch actually
   * uses — whether that id came from a live override, a stale override that
   * fell back to automatic, or no override at all. When no candidate is
   * usable, `dispatchModuleId` is `undefined` and the walk degrades to its
   * own automatic order, matching prior behaviour. `instanceOverrides` is
   * the workspace's saved `WorkspaceSettings.freewayInstanceOverrides` map
   * (base module id -> instance id).
   */
  private credentialForFreewayProbe(
    sessionId: string | undefined,
    deps: BucketSourceDeps,
    bucketStates: readonly FreewayBucketState[],
    instanceOverrides: Record<string, string> | undefined,
  ): (moduleId: string, envVar: string) => string | undefined {
    const moduleStatus = deps.moduleStatus ?? defaultModuleStatus;
    const instanceIdsFor = deps.instanceIdsFor ?? defaultInstanceIdsFor;
    const stateByKey = new Map(bucketStates.map((s) => [s.bucketKey, s]));
    const credentialBad = (id: string): boolean =>
      stateByKey.get(freewayCredentialKey(id))?.disabledReason !== undefined;

    return (moduleId: string, envVar: string) => {
      const { dispatchModuleId } = resolveDispatchModuleId(
        moduleId,
        instanceIdsFor(moduleId),
        moduleStatus,
        credentialBad,
        instanceOverrides?.[moduleId],
      );
      return resolveFreewayProbeCredential(
        moduleId,
        envVar,
        (vaultKey) => credentialStore.getOptional(vaultKey, sessionId),
        instanceIdsFor,
        dispatchModuleId,
      );
    };
  }

  /**
   * Resolve this run's `freeway` decisions against live quota and turn each
   * assignment into dispatch groups tagged with the bucket they were planned
   * on. Pairs no bucket can ever serve become controlled failures; pairs that
   * only lack quota right now are parked on `waitingForQuota` and excluded from
   * dispatch (they still count toward `total` — see
   * {@link finalizeTranslationTerminal}).
   */
  private async resolveFreewayGroups(args: {
    runId: string;
    status: RunStatus;
    decisions: RoutingDecision[];
    global: GlobalConfig;
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>;
    sessionId: string | undefined;
    isBatch: (moduleId: string | null) => boolean;
    resolveBatchMode: (moduleId: string) => ModuleBatchMode;
    bucketKeys: Map<RoutingDecision[], string>;
    /** Set for a batch whose band floor the plan relaxed one tier — see Addendum G. */
    degraded: Map<RoutingDecision[], Assignment['degraded']>;
  }): Promise<RoutingDecision[][]> {
    const { runId, status, decisions, isBatch, resolveBatchMode, bucketKeys, degraded } = args;
    const now = Date.now();
    const deps = this.freewayBucketDeps(args.global, args.projectEntries, args.sessionId);
    // Read once, ahead of both the probe and `loadBucketViews` below: the
    // probe's override gating needs the SAME credential-mark state
    // `loadBucketViews` will use, or the two could resolve a base module's
    // dispatch id differently (see `credentialForFreewayProbe`).
    const bucketStates = await (deps.ledger ?? getFreewayLedgerStore()).listBuckets();
    // Best-effort, time-bounded correction against provider-authoritative
    // usage (DeepL/OpenRouter) before reading the ledger for this run's
    // resolution — never lets a slow/unreachable provider stall run start,
    // and never throws (awaitAllWithTimeout treats a rejection as settled).
    await awaitAllWithTimeout(
      [
        syncAuthoritativeUsage(now, {
          ledger: deps.ledger,
          credentialFor: this.credentialForFreewayProbe(
            args.sessionId,
            deps,
            bucketStates,
            args.global.settings?.freewayInstanceOverrides,
          ),
        }),
      ],
      1500,
    );
    const buckets = await loadBucketViews(now, { ...deps, bucketStates });
    const minBand = freewayMinBand(status.request);
    const resolution = resolveFreewayDecisions(
      decisions,
      buckets,
      now,
      minBand !== undefined ? { minBand } : undefined,
    );
    this.logger.info('translation:freeway-resolved', {
      runId,
      assigned: resolution.assignedGroups.map((g) => ({
        bucketKey: g.bucketKey,
        jobs: g.decisions.length,
        batchSize: g.batchSize,
      })),
      deferred: resolution.deferred?.pairs.length ?? 0,
      blocked: resolution.blocked.length,
    });
    for (const assignment of resolution.assignedGroups) {
      const lang = assignment.decisions[0]?.targetLanguage ?? '?';
      const view = buckets.find((b) => b.bucketKey === assignment.bucketKey);
      this.recordFreewayDetail(
        runId,
        `${lang}×${assignment.decisions.length} → ${assignment.bucketKey} (batch ${assignment.batchSize}, ${formatBucketHeadroom(view)})`,
      );
    }
    if (resolution.blocked.length > 0) {
      this.recordFreewayBlocked(runId, status, resolution.blocked);
    }
    if (resolution.deferred) {
      this.deferPairsForQuota(
        status,
        resolution.deferred.pairs,
        resolution.deferred.resumeAt,
        'quota',
      );
      this.recordFreewayDetail(
        runId,
        formatDeferralDetail(resolution.deferred.pairs.length, resolution.deferred.resumeAt),
      );
    }
    const groups: RoutingDecision[][] = [];
    // Same-(bucket, band) assignments a mixed-batch-capable provider can serve
    // in one request are merged first; everything else passes through as its
    // own assignment (see packAssignedGroups).
    for (const group of packAssignedGroups(resolution.assignedGroups, buckets)) {
      // A merged group must NOT go through groupDecisions: its language-mode
      // partitioning would split the languages straight back apart.
      const batches = group.packedLanguages
        ? chunkPackedDecisions(group.decisions, group.batchSize)
        : groupDecisions(group.decisions, isBatch, resolveBatchMode, {
            customBatchSize: group.batchSize,
          });
      if (group.packedLanguages) {
        this.recordFreewayDetail(
          runId,
          formatPackDetail(group.packedLanguages, batches.length, group.bucketKey),
        );
      }
      for (const batch of batches) {
        bucketKeys.set(batch, group.bucketKey);
        if (group.degraded) degraded.set(batch, group.degraded);
        groups.push(batch);
      }
    }
    return groups;
  }

  /**
   * Record (entry, language) pairs Freeway can never serve as controlled
   * failures — same accounting and aggregated logging as the pre-dispatch
   * reasons, so the UI's per-entry error list and fix hint stay complete.
   */
  private recordFreewayBlocked(
    runId: string,
    status: RunStatus,
    pairs: RunEntryLanguagePair[],
  ): void {
    if (pairs.length === 0) return;
    const groups = new Map<string, ControlledFailureGroup>();
    for (const pair of pairs) {
      this.recordFailure(status, pair.entryId, pair.targetLanguage, 'freeway-no-buckets');
      const group = groups.get(pair.targetLanguage);
      if (group) {
        group.count++;
        group.entryIds.push(pair.entryId);
      } else {
        groups.set(pair.targetLanguage, {
          reason: 'freeway-no-buckets',
          targetLanguage: pair.targetLanguage,
          moduleId: FREEWAY_MODULE_ID,
          count: 1,
          entryIds: [pair.entryId],
        });
      }
    }
    this.logAggregatedControlledFailures(runId, status, [...groups.values()]);
  }

  /**
   * Park (entry, language) pairs until free quota returns. Merges with any
   * pairs a sibling batch already parked (dedup by pair, earliest resume wins);
   * the pairs count toward neither `completed` nor `failed`.
   *
   * `reason` labels WHY (UI only — never changes park/resume behavior). When
   * merging into an existing park, `'provider-error'` always wins over
   * `'quota'`: a sibling batch parked for a genuine provider failure must
   * never be silently downgraded to a plain quota wait by a later, milder
   * defer landing on the same run.
   */
  private deferPairsForQuota(
    status: RunStatus,
    pairs: RunEntryLanguagePair[],
    resumeAt: number,
    reason?: 'quota' | 'provider-error',
  ): void {
    if (pairs.length === 0) return;
    const existing = status.waitingForQuota;
    if (!existing) {
      status.waitingForQuota = { resumeAt, pairs: [...pairs], ...(reason ? { reason } : {}) };
      return;
    }
    const seen = new Set(existing.pairs.map((p) => `${p.entryId} ${p.targetLanguage}`));
    for (const pair of pairs) {
      const key = `${pair.entryId} ${pair.targetLanguage}`;
      if (seen.has(key)) continue;
      seen.add(key);
      existing.pairs.push(pair);
    }
    existing.resumeAt = Math.min(existing.resumeAt, resumeAt);
    if (existing.reason !== 'provider-error' && reason !== undefined) {
      existing.reason = reason;
    }
  }

  /**
   * The Freeway job group a set of decisions represents, derived from the
   * FIRST job's language and band. That derivation is only sound for a group
   * that is homogeneous in (target language, band) — true of a planner
   * assignment and of every call site here (all pass a single decision, or a
   * single-language part), but NOT of a packed mixed-target chunk. Anything
   * holding more than one language must be unpacked before it reaches this
   * (see dispatchFreewayBatch's unpack, and processBatchJob's entry-time
   * split).
   */
  private freewayJobGroup(decisions: RoutingDecision[]): JobGroup {
    const jobs = decisions.map(toFreewayJob);
    return {
      targetLanguage: jobs[0].targetLanguage,
      band: difficultyBand(jobs[0]),
      jobs,
    };
  }

  /**
   * Fresh bucket views + one re-validation of a batch's planned bucket.
   * `degradedFloor` re-validates a degraded batch (see Addendum G) against
   * the relaxed tier the plan already accepted, not the group's natural
   * (higher) floor — otherwise every degraded assignment would bounce
   * straight back to deferred the moment it reaches this coarse re-check,
   * since the bucket the plan chose is by construction below the natural floor.
   * `minBand` is the run's own tier floor and moves the OTHER way — it raises
   * the band, exactly as planning did — so the two are threaded separately and
   * never collapsed into one value.
   */
  private async revalidateFreewayBatch(
    decisions: RoutingDecision[],
    bucketKey: string,
    deps: BucketSourceDeps,
    now: number,
    degradedFloor?: DifficultyBand,
    minBand?: DifficultyBand,
  ): Promise<ReturnType<typeof revalidateGroup>> {
    const buckets = await loadBucketViews(now, deps);
    return revalidateGroup(
      { decisions, bucketKey, batchSize: decisions.length },
      buckets,
      now,
      freewayBandOpts(degradedFloor, minBand),
    );
  }

  /** Cool a bucket after a 429. Never fails the batch (a ledger write that
   * threw here would escape into the dispatch catch-all and FAIL pairs that
   * should only have been parked). `scope: 'pool'` cools the whole
   * account-wide pool a rate limit speaks for (see {@link coolBucket}). */
  private async coolFreewayBucket(
    bucketKey: string,
    now: number,
    retryAfterMs: number | undefined,
    deps: BucketSourceDeps,
    scope: 'bucket' | 'pool' = 'bucket',
    opts?: { escalateOnFlap?: boolean },
  ): Promise<void> {
    try {
      await coolBucket(bucketKey, now, retryAfterMs, deps, scope, opts);
    } catch (err) {
      this.logger.warn('translation:freeway-ledger-write-failed', {
        bucketKey,
        error: toErrorMessage(err),
      });
    }
  }

  /**
   * Mark the dispatch candidate's credential bad after an auth failure. Keyed
   * on the module id, not the bucket: a stale key on one instance must not
   * disable buckets a sibling instance could still serve. Cleared when that
   * module's credential is next written (see clearFreewayCredentialMarks).
   * Never fails the batch.
   */
  private async markFreewayCredentialBad(moduleId: string, deps: BucketSourceDeps): Promise<void> {
    try {
      await (deps.ledger ?? getFreewayLedgerStore()).setDisabled(
        freewayCredentialKey(moduleId),
        'bad credentials',
      );
      this.logger.warn('translation:freeway-credential-disabled', { moduleId });
    } catch (err) {
      this.logger.warn('translation:freeway-ledger-write-failed', {
        moduleId,
        error: toErrorMessage(err),
      });
    }
  }

  /** Ledger accounting for one provider call. Never fails the batch. */
  private async recordFreewayDispatch(
    bucketKey: string,
    results: readonly (TranslationResult | undefined)[],
    deps: BucketSourceDeps,
  ): Promise<void> {
    try {
      await recordDispatch(bucketKey, Date.now(), freewayUsageOf(results), deps);
    } catch (err) {
      this.logger.warn('translation:freeway-ledger-write-failed', {
        bucketKey,
        error: toErrorMessage(err),
      });
    }
  }

  /** Chunk bounds [start, end) covering 0..len at the given size. */
  private static partBounds(len: number, size: number): Array<[number, number]> {
    const bounds: Array<[number, number]> = [];
    for (let start = 0; start < len; start += size) {
      bounds.push([start, Math.min(start + size, len)]);
    }
    return bounds;
  }

  /**
   * Bounds [start, end) of each contiguous run of one target language. A
   * mixed-target chunk keeps its languages in blocks (assignments concatenate
   * whole and chunkPackedDecisions only slices), so this is the chunk's own
   * language segmentation — one bound for a single-language batch.
   */
  private static languageBounds(
    jobs: readonly { targetLanguage: string }[],
  ): Array<[number, number]> {
    const bounds: Array<[number, number]> = [];
    let start = 0;
    for (let i = 1; i <= jobs.length; i++) {
      if (i === jobs.length || jobs[i].targetLanguage !== jobs[start].targetLanguage) {
        bounds.push([start, i]);
        start = i;
      }
    }
    return bounds;
  }

  /**
   * {@link TranslationEngine.partBounds} applied WITHIN each language segment,
   * so a forced re-chunk (strike cap, rescue-bucket char cap) never carves a
   * mixed part out of a packed chunk — a part that spans two languages would
   * be a mixed batch nobody planned for the bucket it lands on. Degenerates to
   * exactly `partBounds(jobs.length, size)` for a single-language batch.
   */
  private static cappedLanguageBounds(
    jobs: readonly { targetLanguage: string }[],
    size: number,
  ): Array<[number, number]> {
    const bounds: Array<[number, number]> = [];
    for (const [segmentStart, segmentEnd] of TranslationEngine.languageBounds(jobs)) {
      for (const [start, end] of TranslationEngine.partBounds(segmentEnd - segmentStart, size)) {
        bounds.push([segmentStart + start, segmentStart + end]);
      }
    }
    return bounds;
  }

  /**
   * Dispatch `args.jobs` as a sequence of {@link TranslationEngine.dispatchFreewayBatch}
   * calls over the given `bounds`, in order, merging their results
   * positionally. Shared by the parse-failure split (halves), the mixed-chunk
   * unpack, and the proactive re-chunk paths (strike cap, rescue-bucket char
   * cap) — same order-preserving merge, length guard, and replay-before-bubble
   * every way.
   *
   * When the parts span MORE THAN ONE target language — the mixed-chunk unpack,
   * and a forced re-chunk of a packed chunk — every part starts from the state
   * the batch was PLANNED on, restored before each part runs. A failover is a
   * decision one part made for ITS OWN jobs, re-validated against its own
   * language; letting the next language inherit it would dispatch onto a bucket
   * nothing ever checked THAT language against (blocked/weak languages and
   * ranking are per-language). Within ONE language the failover does transfer,
   * as it always has: same language, same band (a group is homogeneous in band
   * by construction), so the sibling part's re-validation would reach the same
   * answer — and re-starting it on the bucket that just failed would only spend
   * a second doomed request. `splitCaps` stays shared either way: it is a
   * run-scoped learning, not per-part routing state.
   *
   * The state object is reused rather than cloned on purpose: `processBatchJob`
   * holds a reference to it as `currentFreewayState` and reads the LIVE
   * dispatch id off it while a call is in flight (bad-credential attribution),
   * so handing parts detached clones would silently stale that read.
   */
  private async dispatchFreewayInParts(
    args: FreewayDispatchArgs,
    bounds: ReadonlyArray<readonly [number, number]>,
    opts?: {
      /** Parts re-validate their own group before their first call (unpack only). */
      revalidateFirst?: boolean;
      /** Why the mixed chunk failed, for the parts' reroute detail lines. */
      unpackReason?: 'rate-limit' | 'auth' | 'provider-error';
    },
  ): Promise<FreewayDispatchOutcome> {
    const { jobs, decisions, state, translateOptions, signal } = args;
    const crossLanguage = new Set(jobs.map((job) => job.targetLanguage)).size > 1;
    const planned: FreewayBatchState = { ...state };
    const merged: TranslationResult[] = [];
    for (const [start, end] of bounds) {
      if (signal?.aborted) {
        return { kind: 'error', error: new Error('cancelled'), authCancel: false };
      }
      if (crossLanguage) Object.assign(state, planned);
      const part = await this.dispatchFreewayBatch({
        ...args,
        jobs: jobs.slice(start, end),
        decisions: decisions.slice(start, end),
        ...(opts?.revalidateFirst ? { revalidateFirst: true } : {}),
        ...(opts?.unpackReason ? { unpackReason: opts.unpackReason } : {}),
      });
      if (part.kind !== 'results') {
        // A non-streaming module's earlier part-results only exist in
        // `merged` — settle them before bubbling, or the caller's
        // batch-failed handling records translated pairs as failures.
        // Streaming modules already delivered them (processedIndices
        // dedupes), and the provisional-error guard keeps error results
        // from finalizing here.
        for (const r of merged) await translateOptions.onJobComplete?.(r);
        return part;
      }
      const partJobs = jobs.slice(start, end);
      if (part.results.length !== partJobs.length) {
        // Positional integrity is what the caller's targetResults mapping
        // depends on — a short part must not shift later results onto the
        // wrong entries.
        merged.push(
          ...partJobs.map((job) => ({
            entryId: job.entryId,
            targetLanguage: job.targetLanguage,
            translatedText: '',
            error: 'incomplete batch result',
          })),
        );
      } else {
        merged.push(...part.results);
      }
    }
    return { kind: 'results', results: merged };
  }

  /**
   * Dispatch one Freeway batch, with a SINGLE failover hop: a 429 cools the
   * bucket, a bad credential marks the dispatch candidate (letting a sibling
   * instance keep serving the bucket), and either way the group is
   * re-validated against fresh views and retried once on whatever bucket or
   * sibling instance comes back. A second strike parks the batch (429) or
   * lets it fail (auth) rather than spending more free requests — not
   * because every candidate is exhausted (a third sibling may still be
   * usable), but because the one-hop-per-batch budget is spent. A
   * parse-failure split (see below) restarts this hop budget at 0 for each
   * half, so a batch that keeps mis-parsing can spend more than one hop in
   * total across its parts.
   *
   * A MIXED-TARGET chunk (several languages packed onto one bucket) never
   * takes that hop as one unit: the languages were merged only because THIS
   * bucket could serve them together, so the hop-0 handler unpacks the chunk
   * into single-language parts and lets each re-enter this method with its own
   * hop budget. Each part starts from the PLANNED bucket (no part inherits a
   * sibling's failover) and runs `revalidateFirst`: it re-validates its own
   * (language, band) group against fresh views BEFORE its first call, so a
   * language is only ever dispatched to a bucket eligible for IT, and no part
   * re-pays a probing call on the bucket that just failed.
   */
  private async dispatchFreewayBatch(args: FreewayDispatchArgs): Promise<FreewayDispatchOutcome> {
    const {
      jobs,
      decisions,
      state,
      deps,
      createModule,
      translateOptions,
      signal,
      onReroute,
      splitDepth = 0,
      onSplit,
      degradedFloor,
      minBand,
      onRechunk,
      onUnpack,
      unpackReason,
    } = args;
    const strikeCap = args.splitCaps?.get(state.bucketKey);
    if (strikeCap !== undefined && strikeCap >= 1 && strikeCap < jobs.length) {
      const bounds = TranslationEngine.cappedLanguageBounds(jobs, strikeCap);
      onRechunk?.({ bucketKey: state.bucketKey, size: jobs.length, parts: bounds.length });
      return this.dispatchFreewayInParts(args, bounds);
    }
    const bandOpts = freewayBandOpts(degradedFloor, minBand);
    if (args.revalidateFirst) {
      // An unpacked part: the bucket this chunk was planned on has just failed
      // for the chunk as a whole, so decide where THIS language goes before
      // spending anything. 'keep' means the bucket is still eligible for this
      // part's own group (the strike raced a state that recovered, or the
      // cooldown does not apply to it) and the part dispatches there as
      // planned; a reroute swaps it once, here, instead of paying a call that
      // is known to be failing and reaching the same decision from the catch.
      const now = Date.now();
      const buckets = await loadBucketViews(now, deps);
      const revalidated = revalidateGroup(
        { decisions, bucketKey: state.bucketKey, batchSize: jobs.length },
        buckets,
        now,
        bandOpts,
      );
      if (revalidated.kind === 'blocked') return { kind: 'blocked' };
      if (revalidated.kind === 'defer') {
        return {
          kind: 'defer',
          resumeAt: revalidated.resumeAt,
          // Same two-valued convention as the hop-0 tail: a rate limit and an
          // auth failure both park the pairs on the OTHER buckets' quota (the
          // credential problem is surfaced by its own mark), and only a
          // provider failure is labelled as one.
          reason: unpackReason === 'provider-error' ? 'provider-error' : 'quota',
        };
      }
      if (revalidated.kind === 'reroute') {
        const next = createModule(revalidated.moduleId, revalidated.modelId, revalidated.bucketKey);
        if (!next) {
          return {
            kind: 'error',
            error: new Error(`freeway: no module for ${revalidated.bucketKey}`),
            authCancel: false,
          };
        }
        onReroute?.({
          from: state.bucketKey,
          to: revalidated.bucketKey,
          reason: unpackReason ?? 'provider-error',
        });
        state.module = next;
        state.moduleId = revalidated.moduleId;
        state.modelId = revalidated.modelId;
        state.bucketKey = revalidated.bucketKey;
        for (const decision of decisions) {
          decision.moduleId = revalidated.moduleId;
          decision.modelOverride = revalidated.modelId;
          decision.freewayTier = revalidated.qualityTier;
        }
        // Same guard the hop-0 reroute applies: a part sized for the planned
        // bucket's char budget can physically exceed the rescue bucket's.
        const rescue = buckets.find((bucket) => bucket.bucketKey === revalidated.bucketKey);
        const rescueCap = rescue ? charCappedBatch(rescue, jobs) : jobs.length;
        if (rescueCap >= 1 && rescueCap < jobs.length) {
          const rescueBounds = TranslationEngine.cappedLanguageBounds(jobs, rescueCap);
          onRechunk?.({
            bucketKey: revalidated.bucketKey,
            size: jobs.length,
            parts: rescueBounds.length,
          });
          // The re-validation is spent: its sub-parts translate first, from the
          // rescue bucket this part just settled on.
          return this.dispatchFreewayInParts({ ...args, revalidateFirst: false }, rescueBounds);
        }
      }
    }
    for (let hop = 0; ; hop++) {
      let results: TranslationResult[] | undefined;
      try {
        results = await state.module.translate(jobs, signal, translateOptions);
        await this.recordFreewayDispatch(state.bucketKey, results, deps);
        // A module that flattens a 429 into a per-result `error` string still
        // has to trigger the failover — surface it as a throw (mirrors the
        // non-Freeway `withRateLimitRetry` path).
        const rateLimited = results.find((r) => r?.error && isRateLimitError(r.error));
        if (rateLimited?.error) throw new Error(rateLimited.error);
        // An all-errored batch is bucket-shaped, not content-shaped: a dead
        // model, an exhausted quota, or a bad credential takes out every job
        // at once, while a content refusal fails one. Surface it as a throw
        // so the same classify → cool → failover hop that handles a thrown
        // module error runs.
        const allErrored =
          results.length > 0 && results.every((r) => r?.error !== undefined && r.error !== '');
        // A parse failure is format-shaped, not bucket-shaped: the model
        // answered, its JSON just didn't parse — and smaller batches parse
        // more reliably. Cooling this bucket and failing over would spend a
        // SECOND provider's quota on a problem a half-size retry usually
        // fixes, so halve on the same bucket instead, twice at most
        // (batch → halves → quarters). A singleton that still mis-parses
        // falls through to the bucket-shaped path below.
        // Mixed-target chunks are excluded: the shared provider core already
        // regrouped the failed mixed call per language internally, so the
        // format problem is contained and halving here would re-pay a call
        // that has nothing left to demonstrate. Such a batch falls through to
        // the bucket-shaped path below (which unpacks it by language).
        if (
          allErrored &&
          splitDepth < 2 &&
          jobs.length >= 2 &&
          new Set(jobs.map((job) => job.targetLanguage)).size === 1 &&
          isParseFailureMessage(results[0]!.error!)
        ) {
          onSplit?.({ bucketKey: state.bucketKey, size: jobs.length });
          const failedBucketKey = state.bucketKey;
          const mid = Math.ceil(jobs.length / 2);
          const outcome = await this.dispatchFreewayInParts(
            { ...args, splitDepth: splitDepth + 1 },
            [
              [0, mid],
              [mid, jobs.length],
            ],
          );
          if (outcome.kind === 'results' && args.splitCaps && state.bucketKey === failedBucketKey) {
            // Only credit the failed bucket itself: `state.bucketKey` is
            // mutated in place on a reroute, so a mismatch here means a part
            // succeeded by failing over to a DIFFERENT bucket, not by
            // parsing at half size on this one — nothing was demonstrated
            // about this bucket's own reliability at `mid`.
            const prior = args.splitCaps.get(failedBucketKey);
            // Remember the size that parsed, so later batches this run
            // pre-chunk instead of re-paying the failed full-size call.
            args.splitCaps.set(failedBucketKey, Math.min(prior ?? Number.MAX_SAFE_INTEGER, mid));
          }
          return outcome;
        }
        if (allErrored) throw new Error(results[0]!.error);
        await resetBucketFlap(state.bucketKey, deps);
        return { kind: 'results', results };
      } catch (err) {
        if (isAbortError(err) || signal?.aborted) {
          return { kind: 'error', error: err, authCancel: false };
        }
        // A call that threw still spent a request against the bucket.
        if (results === undefined) await this.recordFreewayDispatch(state.bucketKey, [], deps);
        const rateLimited = isRateLimitError(err);
        const authFailure = !rateLimited && isRunCancellingAuthError(err);
        // Everything else the provider can throw — 5xx, timeout, or a model it
        // has retired ("unavailable for free") — is a SICK BUCKET, not a sick
        // batch: it earns the same single failover hop plus a cooldown, so one
        // dead model cannot drain a run while healthy buckets sit idle.
        const providerFailure = !rateLimited && !authFailure;
        const languages = new Set(jobs.map((job) => job.targetLanguage));
        // A mixed chunk that came back all-errored with a PARSE message is a
        // format problem, not a sick bucket: the shared provider core already
        // regrouped it per language internally and those calls answered — they
        // just did not parse. It still cools (the run should stop feeding a
        // bucket that is mangling output), but without the flap ladder, which
        // exists to escalate a SUSTAINED provider outage toward the day reset.
        const parseShapedMixed =
          languages.size > 1 && providerFailure && isParseFailureMessage(toErrorMessage(err));
        if (hop > 0) {
          // The failover bucket failed the same way: record its state and stop
          // spending requests — the single failover hop is used up.
          const strikeAt = Date.now();
          if (providerFailure) {
            // Cool it too (so later batches skip it) — a provider that isn't
            // answering is not a quota wait. A dead model is never coming
            // back this window, so it cools to the day reset instead of the
            // generic 15-minute provider-error window.
            await this.coolFreewayBucket(
              state.bucketKey,
              strikeAt,
              isModelUnavailableError(err) ? undefined : FREEWAY_PROVIDER_ERROR_COOLDOWN_MS,
              deps,
              'bucket',
              { escalateOnFlap: true },
            );
            // The one-hop budget is spent either way, but whether these pairs
            // FAIL depends on whether the field is actually empty. Revalidate
            // against fresh views (this cool's own write included): a
            // standing bucket — 'reroute', or 'keep' from the same stale-read
            // race the hop-0 branch guards against — parks the pairs on the
            // short floor instead of failing them; only 'blocked' (nothing
            // left, ever) earns the provider's own error. 'defer' keeps its
            // own resume estimate.
            const freshBuckets = await loadBucketViews(strikeAt, deps);
            const revalidated = revalidateGroup(
              { decisions, bucketKey: state.bucketKey, batchSize: jobs.length },
              freshBuckets,
              strikeAt,
              bandOpts,
            );
            if (revalidated.kind === 'blocked') {
              return { kind: 'error', error: err, authCancel: false };
            }
            return {
              kind: 'defer',
              resumeAt: revalidated.kind === 'defer' ? revalidated.resumeAt : strikeAt + 60_000,
              reason: 'provider-error',
            };
          }
          if (!rateLimited) {
            // A repeat auth failure marks the failover candidate's credential
            // too, then fails this batch's pairs (a bad credential is not a
            // quota wait).
            await this.markFreewayCredentialBad(state.moduleId, deps);
            return { kind: 'error', error: err, authCancel: false };
          }
          await this.coolFreewayBucket(
            state.bucketKey,
            strikeAt,
            rateLimitCooldownMs(err),
            deps,
            'pool',
          );
          const buckets = await loadBucketViews(strikeAt, deps);
          const parked = revalidateGroup(
            { decisions, bucketKey: state.bucketKey, batchSize: jobs.length },
            buckets,
            strikeAt,
            bandOpts,
          );
          if (parked.kind === 'blocked') return { kind: 'blocked' };
          // 'defer' carries the soonest useful reset. 'reroute'/'keep' (another
          // bucket could take this batch, but the one hop per batch is spent)
          // parks on a short floor instead: soon enough that the re-plan picks
          // that bucket up quickly, far enough out that a bucket whose cooldown
          // cannot be honoured (no snapshot entry ⇒ cooled until `now`) cannot
          // spin dispatch→429→park on every sweep tick.
          return {
            kind: 'defer',
            resumeAt: parked.kind === 'defer' ? parked.resumeAt : strikeAt + 60_000,
            reason: 'quota',
          };
        }
        const now = Date.now();
        if (rateLimited) {
          await this.coolFreewayBucket(
            state.bucketKey,
            now,
            rateLimitCooldownMs(err),
            deps,
            'pool',
          );
        } else if (providerFailure) {
          // A dead model is never coming back this window, so it cools to
          // the day reset instead of the generic 15-minute provider window.
          await this.coolFreewayBucket(
            state.bucketKey,
            now,
            isModelUnavailableError(err) ? undefined : FREEWAY_PROVIDER_ERROR_COOLDOWN_MS,
            deps,
            'bucket',
            { escalateOnFlap: !parseShapedMixed },
          );
        } else {
          await this.markFreewayCredentialBad(state.moduleId, deps);
        }
        // Unpack on deviation: a mixed-target chunk lives and dies on its
        // planned bucket. The re-validation below derives ONE band and ONE
        // language from the group's first job, so keeping or rerouting a mixed
        // chunk as a unit would move languages onto a bucket nothing checked
        // them against. Hand each language its own part instead: parts start
        // from the planned bucket (no part inherits another's failover) and
        // re-validate their own group before spending anything, so this
        // failure costs exactly the one call that already happened.
        if (languages.size > 1) {
          onUnpack?.({
            bucketKey: state.bucketKey,
            languages: languages.size,
            reason: parseShapedMixed
              ? 'parse-failure'
              : rateLimited
                ? 'rate-limit'
                : providerFailure
                  ? 'provider-error'
                  : 'auth',
          });
          return this.dispatchFreewayInParts(args, TranslationEngine.languageBounds(jobs), {
            revalidateFirst: true,
            unpackReason: rateLimited ? 'rate-limit' : providerFailure ? 'provider-error' : 'auth',
          });
        }
        const buckets = await loadBucketViews(now, deps);
        const revalidated = revalidateGroup(
          { decisions, bucketKey: state.bucketKey, batchSize: jobs.length },
          buckets,
          now,
          bandOpts,
        );
        // Only a reroute rescues a generic provider failure: with nothing else
        // able to serve the group, the honest outcome is the provider's own
        // error on these pairs — never a quota park (this is not a quota
        // problem) and never the 'add a free key' hint.
        if (providerFailure && revalidated.kind !== 'reroute') {
          // 'keep' here is never a genuine reprieve: the cool above just wrote
          // this bucket's cooldown, so a fresh read reporting it still
          // eligible means the read raced ahead of that write (concurrent
          // sibling batches hitting the same dead bucket within milliseconds
          // of each other). Park instead of failing the pairs — the write
          // did land, so the next planning pass sees the cooldown and routes
          // around it.
          if (revalidated.kind === 'keep') {
            return { kind: 'defer', resumeAt: now + 60_000, reason: 'provider-error' };
          }
          // 'defer' means every other candidate is merely cooling (or
          // minute-starved), not gone for good — the normal state of a
          // minute-paced saturated run. Park on the revalidation's own
          // estimate instead of failing pairs that would have rerouted
          // themselves once a sibling's cooldown clears; only a truly empty
          // field ('blocked', handled below) earns the provider's own error.
          if (revalidated.kind === 'defer') {
            return { kind: 'defer', resumeAt: revalidated.resumeAt, reason: 'provider-error' };
          }
          return { kind: 'error', error: err, authCancel: false };
        }
        // Rate-limited AND hop-0 auth-failure share this tail (auth falls
        // through here because `providerFailure` is false for it too). Both
        // are deliberately labeled 'quota', not a third reason: for the auth
        // case, markFreewayCredentialBad already sidelined the bad
        // credential above, so what the run is actually parked on now is the
        // OTHER buckets' quota/cooldowns — the credential problem itself is
        // surfaced separately (the credential mark), not through the park
        // reason. The enum stays two-valued on purpose.
        if (revalidated.kind === 'defer') {
          return { kind: 'defer', resumeAt: revalidated.resumeAt, reason: 'quota' };
        }
        if (revalidated.kind === 'blocked') {
          // An auth failure that leaves NO usable bucket at all is the classic
          // doomed-credential case the run-cancel exists for; a blocked group
          // with other buckets still standing only fails this group's pairs.
          const stranded = buckets.every((bucket) => bucket.disabledReason !== undefined);
          return authFailure && stranded
            ? { kind: 'error', error: err, authCancel: true }
            : { kind: 'blocked' };
        }
        if (revalidated.kind === 'reroute') {
          const next = createModule(
            revalidated.moduleId,
            revalidated.modelId,
            revalidated.bucketKey,
          );
          if (!next) return { kind: 'error', error: err, authCancel: false };
          onReroute?.({
            from: state.bucketKey,
            to: revalidated.bucketKey,
            reason: rateLimited ? 'rate-limit' : providerFailure ? 'provider-error' : 'auth',
            ...(rateLimited ? { retryAfterMs: retryAfterMsOf(err) } : {}),
          });
          state.module = next;
          state.moduleId = revalidated.moduleId;
          state.modelId = revalidated.modelId;
          state.bucketKey = revalidated.bucketKey;
          for (const decision of decisions) {
            decision.moduleId = revalidated.moduleId;
            decision.modelOverride = revalidated.modelId;
            decision.freewayTier = revalidated.qualityTier;
          }
          const rescue = buckets.find((b) => b.bucketKey === revalidated.bucketKey);
          const rescueCap = rescue ? charCappedBatch(rescue, jobs) : jobs.length;
          if (rescueCap >= 1 && rescueCap < jobs.length) {
            // A batch grown for the failed bucket's char budget can
            // physically exceed the rescue bucket's — dispatch it in
            // cap-sized parts instead of letting an oversized call fail
            // (or split) its way down.
            const bounds = TranslationEngine.cappedLanguageBounds(jobs, rescueCap);
            onRechunk?.({
              bucketKey: revalidated.bucketKey,
              size: jobs.length,
              parts: bounds.length,
            });
            return this.dispatchFreewayInParts(args, bounds);
          }
        } else if (authFailure) {
          // 'keep' after an auth failure normally means a SIBLING candidate now
          // resolves this same bucket: loadBucketViews skips any candidate
          // under a live credential mark, so the id that just failed does not
          // eligibly re-resolve to itself. (The one exception: markFreeway-
          // CredentialBad swallows ledger write failures, so if the mark never
          // landed the same id can come back — the guard below then sees
          // freshModuleId === state.moduleId and this hop simply retries it.)
          // Retrying `state.module` unchanged would just replay the same bad
          // credential and burn the batch's only failover hop for nothing —
          // rebuild against the fresh dispatch id instead.
          const freshBucket = buckets.find((bucket) => bucket.bucketKey === state.bucketKey);
          const freshModuleId = freshBucket?.dispatchModuleId ?? freshBucket?.moduleId;
          if (freshBucket && freshModuleId && freshModuleId !== state.moduleId) {
            const next = createModule(freshModuleId, freshBucket.modelId, state.bucketKey);
            if (!next) return { kind: 'error', error: err, authCancel: false };
            state.module = next;
            state.moduleId = freshModuleId;
            state.modelId = freshBucket.modelId;
            // Symmetric with the 'reroute' branch above: the decisions must
            // record the instance that actually ends up serving them, or
            // persistResult/retryLqaFailure attribute the translation (and
            // its LQA stats) to the credential-marked instance instead.
            for (const decision of decisions) {
              decision.moduleId = freshModuleId;
              decision.modelOverride = freshBucket.modelId;
              decision.freewayTier = freshBucket.qualityTier;
            }
          }
        }
        // Otherwise 'keep' retries the same bucket once (its state moved back
        // in our favour — e.g. a 429 elsewhere cleared before this hop ran).
      }
    }
  }

  /**
   * Every strictly-higher-tier bucket with quota for a gate-failed entry,
   * ranked best first, or an empty array when the ladder is exhausted (the
   * caller then falls back to a same-module corrective retry). The caller
   * walks the list past any candidate whose module can't take corrective
   * feedback (DeepL).
   */
  private async selectFreewayEscalation(
    failedBucketKey: string,
    decision: RoutingDecision,
    deps: BucketSourceDeps,
  ): Promise<Array<{ moduleId: string; modelId: string; bucketKey: string; qualityTier: number }>> {
    const now = Date.now();
    const buckets = await loadBucketViews(now, deps);
    const group = this.freewayJobGroup([decision]);
    const candidates = selectEscalationCandidates(failedBucketKey, group, buckets, now);
    if (candidates.length === 0) {
      // Distinguish the two ways the ladder comes back empty. Ordinary
      // exhaustion (no higher tier, a cooldown, a weak-language exclusion, or
      // no day-scale stock) is expected and stays silent. Minute starvation is
      // not: the bucket refills within seconds, the entry silently gets a
      // same-module corrective retry instead of a better model, and nothing
      // else records that it happened.
      const starved = findMinuteStarvedEscalation(failedBucketKey, group, buckets, now);
      if (starved) {
        this.logger.warn('translation:freeway-escalation-minute-starved', {
          failedBucketKey,
          starvedBucketKey: starved.bucketKey,
          minuteResetAt: starved.minuteResetAt,
        });
      }
      return [];
    }
    return candidates.map((selection) => ({
      // Dispatch through the resolved instance, not the bare base — see
      // BucketView.dispatchModuleId.
      moduleId: selection.bucket.dispatchModuleId ?? selection.bucket.moduleId,
      modelId: selection.bucket.modelId,
      bucketKey: selection.bucket.bucketKey,
      qualityTier: selection.bucket.qualityTier,
    }));
  }

  /** Fold a settled batch's gate outcomes into bucket stats: one write per bucket. */
  private async flushFreewayGateOutcomes(
    outcomes: Map<string, Array<{ language: string; passed: boolean }>>,
    deps: BucketSourceDeps,
  ): Promise<void> {
    for (const [bucketKey, entries] of outcomes) {
      if (entries.length === 0) continue;
      try {
        await recordGateOutcomes(bucketKey, Date.now(), entries, deps);
      } catch (err) {
        this.logger.warn('translation:freeway-stats-write-failed', {
          bucketKey,
          error: toErrorMessage(err),
        });
      }
    }
    outcomes.clear();
  }

  private async processBatchJob(
    runId: string,
    projectId: string,
    decisions: RoutingDecision[],
    sourceLanguage: string,
    moduleConfigs: Record<string, unknown>,
    sessionId: string | undefined,
    tmPolicy: TmMatchPolicy = 'disabled',
    referenceLanguage?: string,
    examplesByLanguage?: ExamplesByLanguage,
    dispatchOptions?: BatchDispatchOptions,
    project?: Project,
    achievementPairMap: Map<string, StringEntry[]> = new Map(),
    /** Set for a Freeway-managed batch: the bucket its jobs were planned on. */
    freewayBucketKey?: string,
    /** Set when the plan relaxed this batch's band floor one tier (Addendum G). */
    freewayDegraded?: Assignment['degraded'],
  ): Promise<void> {
    const status = this.runs.get(runId);
    if (!status || status.status === RunStatusCode.Cancelled) return;
    const signal = this.controllers.get(runId)?.signal;
    /** Gate outcomes observed on each bucket this batch touched (flushed once, at settle). */
    const freewayGateOutcomes = new Map<string, Array<{ language: string; passed: boolean }>>();
    let freewayDeps: BucketSourceDeps | undefined;

    // Per-call record of which of THIS batch's decisions have already been
    // counted (recordFailure or status.completed++). The run-global
    // completed/failed counters are shared across concurrently-running sibling
    // batches/singles of the same run, so the outer catch below must fail only
    // the decisions this call left unsettled — never a "total − completed −
    // failed" delta, which would steal in-flight sibling decisions.
    const settled = new Set<string>();
    const settleKey = (d: RoutingDecision): string => `${d.entry.id}::${d.targetLanguage}`;

    try {
      const moduleLog = (
        level: 'info' | 'warn' | 'error',
        message: string,
        metadata?: Record<string, unknown>,
      ) => this.logger[level](message, metadata);

      const first = decisions[0];
      if (!first) return;

      const { moduleId: routedModuleId } = first;
      // Null-routed decisions (router found no rule) fail authoritatively
      // here with the 'no-route' contract. Every group — including the
      // single-element groups groupDecisions emits for null-routed or
      // non-batch-capable modules — flows through this one dispatch path.
      if (routedModuleId === null) {
        for (const d of decisions) {
          this.recordFailure(status, d.entry.id, d.targetLanguage, 'no-route');
          settled.add(settleKey(d));
          this.logger.warn('translation:failed', {
            runId,
            entryId: d.entry.id,
            targetLanguage: d.targetLanguage,
            error: 'no-route',
            context: d.entry.context ?? null,
          });
        }
        this.emitProgress(runId, status);
        return;
      }
      const projectEntries = moduleConfigs as Record<string, ProjectModuleConfigEntry | undefined>;
      const global = await this.globalConfigStore.load();

      // A Freeway batch re-validates its planned bucket here: run-start
      // eligibility is deliberately coarse, and the shared free quota may have
      // moved between planning and this batch's turn in the queue. A reroute
      // rewrites the batch's target in place; a deferral parks its pairs; a
      // block fails them with the Freeway hint.
      let moduleId: string = routedModuleId;
      let bucketKey = freewayBucketKey;
      if (bucketKey !== undefined) {
        freewayDeps = this.freewayBucketDeps(global, projectEntries, sessionId);
        const revalidated = await this.revalidateFreewayBatch(
          decisions,
          bucketKey,
          freewayDeps,
          Date.now(),
          freewayDegraded?.toTier as DifficultyBand | undefined,
          freewayMinBand(status.request),
        );
        // A packed mixed-target batch is valid only on the bucket it was
        // planned for. `revalidateGroup` derives one band and one language
        // from the group's FIRST decision, so anything other than 'keep' —
        // rerouting to a substitute bucket, parking, or blaming the whole
        // batch — would decide for languages it never examined. Split into
        // single-language segments and run each through this same path, which
        // then revalidates (and reroutes/defers/blocks) per language.
        if (
          revalidated.kind !== 'keep' &&
          new Set(decisions.map((d) => d.targetLanguage)).size > 1
        ) {
          for (const [start, end] of TranslationEngine.languageBounds(decisions)) {
            const segment = decisions.slice(start, end);
            await this.processBatchJob(
              runId,
              projectId,
              segment,
              sourceLanguage,
              moduleConfigs,
              sessionId,
              tmPolicy,
              referenceLanguage,
              examplesByLanguage,
              dispatchOptions,
              project,
              achievementPairMap,
              bucketKey,
              freewayDegraded,
            );
            // The segment's own call has counted (or parked) every pair in it;
            // record that here so this call's catch-all cannot fail them twice.
            for (const d of segment) settled.add(settleKey(d));
          }
          return;
        }
        if (revalidated.kind === 'reroute') {
          this.logger.info('translation:freeway-rerouted', {
            runId,
            from: bucketKey,
            to: revalidated.bucketKey,
            reason: 'revalidate',
          });
          this.recordFreewayDetail(
            runId,
            `quota shifted on ${bucketKey} — rerouted to ${revalidated.bucketKey}`,
          );
          moduleId = revalidated.moduleId;
          bucketKey = revalidated.bucketKey;
          for (const d of decisions) {
            d.moduleId = revalidated.moduleId;
            d.modelOverride = revalidated.modelId;
            d.freewayTier = revalidated.qualityTier;
          }
        } else if (revalidated.kind === 'defer') {
          this.deferPairsForQuota(
            status,
            decisions.map((d) => ({ entryId: d.entry.id, targetLanguage: d.targetLanguage })),
            revalidated.resumeAt,
            'quota',
          );
          for (const d of decisions) settled.add(settleKey(d));
          this.logger.info('translation:freeway-deferred', {
            runId,
            bucketKey,
            pairs: decisions.length,
            resumeAt: revalidated.resumeAt,
          });
          this.recordFreewayDetail(
            runId,
            formatDeferralDetail(decisions.length, revalidated.resumeAt),
          );
          this.emitProgress(runId, status);
          return;
        } else if (revalidated.kind === 'blocked') {
          this.recordFreewayBlocked(
            runId,
            status,
            decisions.map((d) => ({ entryId: d.entry.id, targetLanguage: d.targetLanguage })),
          );
          for (const d of decisions) settled.add(settleKey(d));
          return;
        }
      }

      const projectEntry = projectEntries[moduleId];
      const effective = resolveEffectiveModuleConfig(moduleId, global, projectEntry);
      let metricsModel =
        first.modelOverride ??
        (typeof effective.config.model === 'string' ? effective.config.model : null);

      if (!effective.enabled || effective.active === false) {
        for (const d of decisions) {
          this.recordFailure(status, d.entry.id, d.targetLanguage, 'module-disabled');
          settled.add(settleKey(d));
          metricsCollector.recordFailure(moduleId, metricsModel);
          this.logger.error('translation:failed', {
            runId,
            entryId: d.entry.id,
            targetLanguage: d.targetLanguage,
            error: 'module-disabled',
            moduleId,
            context: d.entry.context ?? null,
          });
        }
        this.emitProgress(runId, status);
        return;
      }

      if (bucketKey !== undefined && freewayDegraded) {
        // Reaching here means the batch WILL dispatch ('keep' or 'reroute')
        // while its band floor is relaxed (Addendum G) — surface why a
        // lower-tier bucket serves a hard-band entry, whichever revalidation
        // branch routed it. `bucketKey` is already the post-reroute key at this
        // point, so the log names the bucket that is actually about to serve
        // the batch. After the module-disabled gate, too: a batch that fails
        // there dispatches nothing, and a degrade line for it would describe a
        // routing decision no bucket ever acted on.
        this.logger.info('translation:freeway-degraded', {
          runId,
          bucketKey,
          band: freewayDegraded.fromTier,
          fromTier: freewayDegraded.fromTier,
          toTier: freewayDegraded.toTier,
          waitedAlternativeMs: freewayDegraded.waitedAlternativeMs,
        });
        this.recordFreewayDetail(runId, formatDegradedDetail(freewayDegraded));
      }

      const batchOverrides: Record<string, unknown> = {};
      if (first.modelOverride) batchOverrides.model = first.modelOverride;
      if (first.reasoningEffortOverride)
        batchOverrides.reasoningEffort = first.reasoningEffortOverride;

      // Freeway manages a handful of dispatch settings itself, from snapshot
      // facts about the chosen model — applied after the batch overrides so
      // they win over the user's config. Empty (and therefore inert) for a
      // batch this run routed directly rather than through Freeway.
      const freewayOverrides =
        bucketKey === undefined
          ? {}
          : freewayModuleOverrides(freewayBucketBaseModuleId(bucketKey), first.modelOverride ?? '');

      const routedModule = this.moduleRegistry.createWithConfig(
        moduleId,
        {
          ...effective.config,
          ...this.rateLimitConfig(global),
          ...batchOverrides,
          ...freewayOverrides,
          log: moduleLog,
        },
        sessionId,
      );
      // Builds the module instance a Freeway failover/escalation target needs:
      // that bucket's own module config plus its model as the override, and
      // the new bucket's own Freeway-managed dispatch settings (the hop may
      // cross from a model that wants structured output to one that must not).
      // `nextModuleId` is the resolved dispatch id (base or instance) — the
      // module is actually built from it — while `nextBucketKey` (always
      // base-keyed) recovers the snapshot's base id for the overrides lookup.
      const createFreewayModule = (
        nextModuleId: string,
        modelId: string,
        nextBucketKey: string,
      ): TranslationModule | undefined => {
        const nextEffective = resolveEffectiveModuleConfig(
          nextModuleId,
          global,
          projectEntries[nextModuleId],
        );
        return this.moduleRegistry.createWithConfig(
          nextModuleId,
          {
            ...nextEffective.config,
            ...this.rateLimitConfig(global),
            model: modelId,
            ...freewayModuleOverrides(freewayBucketBaseModuleId(nextBucketKey), modelId),
            log: moduleLog,
          },
          sessionId,
        );
      };
      if (!routedModule) {
        for (const d of decisions) {
          this.recordFailure(status, d.entry.id, d.targetLanguage, 'module-not-found');
          settled.add(settleKey(d));
          metricsCollector.recordFailure(moduleId, metricsModel);
          this.logger.error('translation:failed', {
            runId,
            entryId: d.entry.id,
            targetLanguage: d.targetLanguage,
            error: 'module-not-found',
            moduleId,
            context: d.entry.context ?? null,
          });
        }
        this.emitProgress(runId, status);
        return;
      }
      // Mutable: a Freeway failover can move this batch to another bucket's
      // module mid-flight (see dispatchFreewayBatch).
      let module: TranslationModule = routedModule;

      for (const d of decisions) {
        this.logger.info('translation:start', {
          runId,
          entryId: d.entry.id,
          targetLanguage: d.targetLanguage,
          moduleId,
          context: d.entry.context ?? null,
        });
      }

      const glossaryCache = await this.fetchGlossariesForBatch(projectId, decisions);

      // --- Trivial matcher short-circuit (processBatchJob) ---
      const { trivialResults, remaining } = this.findTrivialMatches(
        decisions,
        sourceLanguage,
        glossaryCache,
      );

      for (const { decision: d, matcherId, translatedText } of trivialResults) {
        await this.persistTrivialResult(projectId, status, d, matcherId, translatedText);
        settled.add(settleKey(d));
      }

      if (remaining.length === 0) {
        return;
      }

      type MaskedEntry = {
        decision: RoutingDecision;
        masked: string;
        plan: ReturnType<typeof maskText>['plan'];
        trivial: boolean;
        nonConstantTerms: GlossaryTerm[];
        glossaryById: Map<string, GlossaryTerm>;
        tmFingerprint: TmFingerprint;
        /** "Similar prior translation" hints appended to the job context. */
        tmHints?: string;
        /** Reference translation attached to the job as LLM prompt context. */
        reference?: TranslationJob['reference'];
      };
      const maskedEntries: MaskedEntry[] = remaining.map((d) => {
        const glossary = glossaryCache.get(this.glossaryEntryKey(d.targetLanguage, d.entry));
        const { masked, plan, trivial } = maskText(
          d.entry.sourceText,
          glossary?.constantTerms ?? [],
        );
        const reference = this.jobReference(d.entry, d.targetLanguage, referenceLanguage);
        return {
          decision: d,
          masked,
          plan,
          trivial,
          nonConstantTerms: glossary?.nonConstantTerms ?? [],
          glossaryById: glossary?.glossaryById ?? new Map<string, GlossaryTerm>(),
          tmFingerprint: buildTmFingerprint(d.entry, d.promptOptions),
          ...(reference ? { reference } : {}),
        };
      });

      const nonTrivialEntries = maskedEntries.filter((e) => !e.trivial);
      const trivialEntries = maskedEntries.filter((e) => e.trivial);
      for (const e of trivialEntries) {
        const restored = restoreFinal(
          e.decision.entry.sourceText,
          e.masked,
          e.plan,
          e.glossaryById,
          e.decision.targetLanguage,
        );
        const result: TranslationResult = {
          entryId: e.decision.entry.id,
          targetLanguage: e.decision.targetLanguage,
          translatedText: restored,
        };
        // A glossary-constant short-circuit never reaches a bucket — even for
        // a Freeway-routed decision the plan already stamped — so the tier
        // must be explicitly cleared, not inherited via the spread above.
        const persistDecision: RoutingDecision = {
          ...e.decision,
          moduleId: 'glossary-constant',
          freewayTier: undefined,
        };
        await this.persistResult(
          projectId,
          e.decision.entry,
          e.decision.targetLanguage,
          result,
          persistDecision,
          runId,
        );
        await this.lqaGate(e.decision.entry, result, projectId, e.decision.targetLanguage, []);
        status.completed++;
        settled.add(settleKey(e.decision));
        this.logger.info('translation:done', {
          runId,
          entryId: e.decision.entry.id,
          targetLanguage: e.decision.targetLanguage,
          moduleId: 'glossary-constant',
          context: e.decision.entry.context ?? null,
        });
        this.emitProgress(runId, status);
      }

      if (nonTrivialEntries.length === 0) {
        return;
      }

      // --- Translation-memory consult (after masking, like trivial matchers) ---
      const tmMisses: MaskedEntry[] = [];
      for (const e of nonTrivialEntries) {
        if ((status.status as RunStatusCode) === RunStatusCode.Cancelled || signal?.aborted) {
          return;
        }
        let tmLookup = await this.tmLookupSafe(
          e.masked,
          e.decision.targetLanguage,
          e.tmFingerprint,
          tmPolicy,
          e.decision.entry,
        );
        // Never auto-apply a TM hit over an explicit reference-informed
        // request — keep the hints only.
        if (e.reference && tmLookup.autoApply) {
          tmLookup = { autoApply: null, hints: tmLookup.hints };
        }
        if (tmLookup.autoApply) {
          const tmRestored = restoreFinal(
            e.decision.entry.sourceText,
            tmLookup.autoApply.translatedText,
            e.plan,
            e.glossaryById,
            e.decision.targetLanguage,
          );
          const tmResult: TranslationResult = {
            entryId: e.decision.entry.id,
            targetLanguage: e.decision.targetLanguage,
            translatedText: tmRestored,
          };
          // Gate BEFORE persisting: a rejected hit is demoted to a hint and
          // the entry joins the module batch.
          const tmLqaResult = await this.lqaGate(
            e.decision.entry,
            tmResult,
            projectId,
            e.decision.targetLanguage,
            [],
          );
          if (!tmLqaResult || tmLqaResult.passed) {
            await this.persistResult(
              projectId,
              e.decision.entry,
              e.decision.targetLanguage,
              tmResult,
              {
                ...e.decision,
                moduleId: TM_MODULE_ID,
                // A translation-memory hit never touched a bucket either —
                // clear a tier the plan may have stamped, same as the
                // glossary-constant short-circuit above.
                freewayTier: undefined,
              },
              runId,
            );
            status.completed++;
            settled.add(settleKey(e.decision));
            this.logger.info('translation:done', {
              runId,
              entryId: e.decision.entry.id,
              targetLanguage: e.decision.targetLanguage,
              moduleId: TM_MODULE_ID,
              tmHit: true,
              context: e.decision.entry.context ?? null,
            });
            this.emitProgress(runId, status);
            continue;
          }
          this.logger.info('translation:tm-rejected', {
            runId,
            entryId: e.decision.entry.id,
            targetLanguage: e.decision.targetLanguage,
            issues: tmLqaResult.issues.length,
          });
          tmLookup = {
            autoApply: null,
            hints: [
              { variant: tmLookup.autoApply, reason: tmRejectionReason(tmLqaResult) },
              ...tmLookup.hints,
            ].slice(0, MAX_TM_HINTS),
          };
        }
        e.tmHints = formatTmHints(tmLookup.hints, (text) =>
          restoreText(text, e.plan, e.glossaryById, e.decision.targetLanguage),
        );
        tmMisses.push(e);
      }

      if (tmMisses.length === 0) {
        return;
      }

      const uncachedNonTrivialEntries = tmMisses;

      const isEntryBatchMode = effective.config.batchMode === 'entry';
      const targetLanguages = Array.from(new Set(decisions.map((d) => d.targetLanguage)));
      // A multi-language FREEWAY batch is a packed mixed-target chunk (M9's
      // packAssignedGroups merges languages only onto a bucket whose provider
      // declares supportsMixedBatch, and sizes the batch as ONE request), so it
      // dispatches mixed whatever batch mode the workspace configured — Freeway
      // owns its own dispatch shape, like the rest of freewayModuleOverrides.
      const shouldDispatchMixedTargetChunk =
        targetLanguages.length > 1 && (isEntryBatchMode || bucketKey !== undefined);
      const jobsByTargetLanguage = new Map<string, Array<{ index: number; job: TranslationJob }>>();
      const indexedJobs: Array<{ index: number; job: TranslationJob }> = [];
      for (let index = 0; index < uncachedNonTrivialEntries.length; index++) {
        const entry = uncachedNonTrivialEntries[index];
        const lengthLimit = lengthLimitForJob(entry.decision.entry, entry.decision.targetLanguage);
        const examples = examplesByLanguage?.get(entry.decision.targetLanguage);
        const achievement = project
          ? buildAchievementPromptContext(
              entry.decision.entry,
              entry.decision.targetLanguage,
              project,
              achievementPairMap,
            )
          : undefined;
        const job: TranslationJob = {
          entryId: entry.decision.entry.id,
          sourceText: entry.masked,
          sourceLanguage,
          targetLanguage: entry.decision.targetLanguage,
          glossary: entry.nonConstantTerms,
          glossaryId: entry.decision.entry.assignedGlossaryIds?.[0] ?? 'project',
          promptOptions: achievement
            ? {
                ...effectivePromptOptions(entry.decision.entry, entry.decision.promptOptions),
                achievement,
              }
            : effectivePromptOptions(entry.decision.entry, entry.decision.promptOptions),
          context: appendTmHints(entry.decision.entry.context, entry.tmHints),
          ...(entry.reference ? { reference: entry.reference } : {}),
          ...(lengthLimit ? { lengthLimit } : {}),
          ...(examples?.length ? { examples } : {}),
        };
        const indexedJob = { index, job };
        indexedJobs.push(indexedJob);
        if (!shouldDispatchMixedTargetChunk) {
          const targetJobs = jobsByTargetLanguage.get(entry.decision.targetLanguage);
          if (targetJobs) {
            targetJobs.push(indexedJob);
          } else {
            jobsByTargetLanguage.set(entry.decision.targetLanguage, [indexedJob]);
          }
        }
      }

      const dispatchBatches = shouldDispatchMixedTargetChunk
        ? [indexedJobs]
        : Array.from(jobsByTargetLanguage.values());

      const moduleResults: Array<TranslationResult | undefined> = new Array(
        uncachedNonTrivialEntries.length,
      );
      // Indices whose dispatch batch failed outright — already recorded as
      // failures, so the persistence loop below must skip them.
      const dispatchFailed = new Set<number>();
      // Indices parked for quota (or blocked) by a Freeway failover: neither
      // dispatched nor failed, so the persistence loop must skip them too.
      const deferredIndices = new Set<number>();
      /**
       * Live pointer to the in-flight Freeway dispatch's mutable state, set
       * only while a dispatchFreewayBatch call is outstanding. The outer
       * `moduleId` variable is synced from `state.moduleId` only AFTER
       * dispatchFreewayBatch RETURNS (below), but `onJobComplete` — passed
       * into that same call — can fire mid-dispatch, e.g. on the hop after a
       * reroute. Reading `state.moduleId` live through this pointer (instead
       * of the stale outer `moduleId`) is what lets a per-result auth error
       * mark the module that actually produced it, not the one the batch
       * already failed over from.
       */
      let currentFreewayState: FreewayBatchState | undefined;

      // Entries whose LQA gate failed, queued for a retryWithFeedback pass
      // after the whole batch has been persisted (the LQA corrective retry;
      // see retryLqaFailure).
      const lqaRetryQueue: Array<{
        entry: MaskedEntry;
        originalText: string;
        lqaResult: import('@zercade-dev/narn-shared').LQAResult;
      }> = [];

      // Persists + LQA-gates + records progress for ONE entry's result. Called
      // either from onJobComplete (as soon as a module reports a job mid-batch)
      // or from the fallback loop after the whole dispatch batch resolves (for
      // modules that don't report incrementally). Returns true when the run
      // was just cancelled for an auth failure — the caller must stop.
      const finalizeEntryResult = async (i: number): Promise<boolean> => {
        const e = uncachedNonTrivialEntries[i];
        const moduleResult = moduleResults[i];
        // Empty/whitespace output with no error is a failure, not a success —
        // otherwise it persists as `translated` and a reTranslate overwrites
        // good text with ''. Empty/whitespace SOURCE never reaches dispatch
        // (trivial `emptyMatcher` short-circuits it), so this is always genuine.
        const emptyOutput =
          !!moduleResult && !moduleResult.error && !moduleResult.translatedText?.trim();
        if (!moduleResult || moduleResult.error || emptyOutput) {
          // Freeway partial-batch: a transient-shaped per-result error (a
          // passing 5xx, timeout, or "high demand"/"try again later"
          // provider messaging) parks once instead of failing, so one flaky
          // call in an otherwise-healthy batch doesn't strand the pair.
          // Only a GENUINE error (not empty-output-only) qualifies, and
          // only when none of the more specific classifiers
          // — rate-limit (which never reaches here: a per-result rate limit
          // is surfaced as a throw earlier in dispatchFreewayBatch), auth,
          // or model-unavailable — claim it first, mirroring the precedence
          // every other call site in this engine follows. And only the
          // FIRST time this (entry, language) pair sees one in this run: a
          // second transient hit fails it like any other error, capping the
          // extra spend at one retry per pair. Never cools the bucket — the
          // bucket's OTHER jobs in this very batch are proof it works.
          if (
            bucketKey !== undefined &&
            freewayDeps &&
            moduleResult?.error &&
            !isRunCancellingAuthError(moduleResult.error) &&
            !isModelUnavailableError(moduleResult.error) &&
            isTransientProviderError(moduleResult.error)
          ) {
            const pairKey = `${e.decision.entry.id} ${e.decision.targetLanguage}`;
            let parkedOnce = this.freewayTransientParkedPairs.get(runId);
            if (!parkedOnce) {
              parkedOnce = new Set<string>();
              this.freewayTransientParkedPairs.set(runId, parkedOnce);
            }
            if (!parkedOnce.has(pairKey)) {
              parkedOnce.add(pairKey);
              // Labeled 'quota' (not a third reason) same as the auth-tail
              // adjudication above: this is one flaky call in an otherwise
              // healthy batch — the bucket was never cooled, so what the
              // pair is actually waiting out is quota/pacing, not a
              // provider outage.
              this.deferPairsForQuota(
                status,
                [{ entryId: e.decision.entry.id, targetLanguage: e.decision.targetLanguage }],
                Date.now() + 60_000,
                'quota',
              );
              settled.add(settleKey(e.decision));
              deferredIndices.add(i);
              this.emitProgress(runId, status);
              return false;
            }
          }
          // A module-provided error string may echo a raw credential (e.g. a
          // provider auth failure quoting the key) — sanitize before it's
          // recorded/logged (pattern-strip + live-vault value scrub), same as
          // the batch-uncaught catch below.
          const errMsg = moduleResult?.error
            ? sanitizeLogObject({ m: toErrorMessage(moduleResult.error) }).m
            : emptyOutput
              ? 'empty translation'
              : 'empty result';
          this.logger.warn('translation:failed', {
            runId,
            entryId: e.decision.entry.id,
            targetLanguage: e.decision.targetLanguage,
            moduleId,
            error: errMsg,
            context: e.decision.entry.context ?? null,
          });
          this.recordFailure(status, e.decision.entry.id, e.decision.targetLanguage, errMsg);
          settled.add(settleKey(e.decision));
          metricsCollector.recordFailure(moduleId, metricsModel);
          this.emitProgress(runId, status);
          // Per-result auth failure (modules that surface 401/403 as an error
          // string rather than throwing) — cancel the run.
          // Mixed-auth accounting: this fires on the FIRST result whose error
          // string signals auth and returns immediately; since cancel() flips
          // the whole run Cancelled (idempotent) and callers check status
          // before invoking this again, sibling results are not lost, but a
          // result[k>0]-only auth error is acted on only after earlier
          // results persisted.
          if (moduleResult?.error) {
            // A Freeway credential belongs to ONE module, not the bucket it's
            // dispatching: mark that module's credential and let the run
            // continue on a sibling instance instead of cancelling. Read the
            // LIVE dispatch id off currentFreewayState (not the outer
            // moduleId, which this call can race — see its declaration).
            if (
              bucketKey !== undefined &&
              freewayDeps &&
              isRunCancellingAuthError(moduleResult.error)
            ) {
              await this.markFreewayCredentialBad(
                currentFreewayState?.moduleId ?? moduleId,
                freewayDeps,
              );
              return false;
            }
            if (await this.maybeCancelForAuth(runId, moduleId, moduleResult.error)) {
              return true;
            }
          }
          return false;
        }

        const diagnostics = verifyMaskedTranslation(moduleResult.translatedText, e.plan);
        const maskIssues: import('@zercade-dev/narn-shared').LQAIssue[] = [];
        if (diagnostics.hasIssues) {
          metricsCollector.recordMaskMismatch(moduleId, metricsModel);
          this.logger.warn('translation:mask-mismatch', {
            runId,
            entryId: e.decision.entry.id,
            targetLanguage: e.decision.targetLanguage,
            moduleId,
            missing: diagnostics.missing,
            unknown: diagnostics.unknown,
            duplicated: diagnostics.duplicated,
          });
          maskIssues.push(...maskDiagnosticsToIssues(diagnostics));
        }

        const restored = restoreFinal(
          e.decision.entry.sourceText,
          moduleResult.translatedText,
          e.plan,
          e.glossaryById,
          e.decision.targetLanguage,
        );
        const result: TranslationResult = {
          entryId: e.decision.entry.id,
          targetLanguage: e.decision.targetLanguage,
          translatedText: restored,
          rawResponse: moduleResult.rawResponse,
        };
        // The stale-result-after-cancel race: re-check abort/cancel before
        // persisting a batch entry's result. A cancel between dispatch and
        // this finalize frees the project slot and may have started the next
        // run; a late batch result must not overwrite newer data under the
        // cancelled runId. Returning false (not an auth-cancel) leaves the
        // run terminal without counting this entry.
        if (signal?.aborted || this.runs.get(runId)?.status === RunStatusCode.Cancelled) {
          return false;
        }
        await this.persistResult(
          projectId,
          e.decision.entry,
          e.decision.targetLanguage,
          result,
          e.decision,
          runId,
        );
        const batchLqaResult = await this.lqaGate(
          e.decision.entry,
          result,
          projectId,
          e.decision.targetLanguage,
          maskIssues,
        );
        // The bucket's quality signal for this language, folded into its stats
        // once the whole batch has settled.
        if (bucketKey !== undefined && batchLqaResult) {
          const outcomes = freewayGateOutcomes.get(bucketKey);
          const outcome = { language: e.decision.targetLanguage, passed: batchLqaResult.passed };
          if (outcomes) outcomes.push(outcome);
          else freewayGateOutcomes.set(bucketKey, [outcome]);
        }
        // No TM auto-record (memory holds only approved variants). On LQA
        // failure, queue a session-reuse retry when the module supports it.
        const retryLqaResult =
          batchLqaResult && !batchLqaResult.passed && typeof module.retryWithFeedback === 'function'
            ? batchLqaResult
            : undefined;
        // Mark this decision settled unconditionally: its first pass DID persist,
        // so the outer catch must never double-fail it (load-bearing).
        settled.add(settleKey(e.decision));
        if (retryLqaResult) {
          // DEFER the completion accounting (completed++/recordSuccess/
          // translation:done) to the retry loop. Counting a retry-queued entry
          // here — before its retry runs — lets `status.completed` reach `total`
          // while retries are still in flight, so a sibling dispatch group's
          // finally finalizes the run early and the retry's usage/detail is lost.
          // Queue the MASKED first-pass output (moduleResult.translatedText),
          // NOT the restored/unmasked text: retryWithFeedback replays it as the
          // assistant turn against the MASKED prompt (see retryLqaFailure /
          // TranslationModule.retryWithFeedback contract). An unmasked previous
          // attempt makes the retry answer unmasked — tripping mask-integrity.
          lqaRetryQueue.push({
            entry: e,
            originalText: moduleResult.translatedText,
            lqaResult: retryLqaResult,
          });
        } else {
          status.completed++;
          metricsCollector.recordSuccess(moduleId, metricsModel);
          this.logger.info('translation:done', {
            runId,
            entryId: e.decision.entry.id,
            targetLanguage: e.decision.targetLanguage,
            moduleId,
            context: e.decision.entry.context ?? null,
            glossaryId: moduleResult.usedGlossaryId ?? null,
          });
        }
        this.emitProgress(runId, status);
        return false;
      };

      // Format-strike caps this RUN has learned, keyed by bucketKey (see
      // RunDetailsAcc.freewaySplitCaps): a Freeway group's planned batches
      // each run as their OWN `processBatchJob` call, so this must come from
      // the run-scoped accumulator (not a local declared here) or a bucket
      // that mis-parsed a full-size call in an earlier batch could never
      // teach a later one to pre-chunk instead of re-paying the same failure.
      // Undefined only when the run has no accumulator (e.g. after a
      // restart) — dispatchFreewayBatch treats that as "no caps known".
      const freewaySplitCaps = this.details.get(runId)?.freewaySplitCaps;
      // Maps a streamed result back to its index in uncachedNonTrivialEntries,
      // so onJobComplete (fired by the module mid-dispatch) can persist it
      // immediately instead of waiting for the whole dispatch batch to resolve.
      const keyToIndex = new Map<string, number>();
      for (let i = 0; i < uncachedNonTrivialEntries.length; i++) {
        const e = uncachedNonTrivialEntries[i];
        keyToIndex.set(`${e.decision.entry.id}::${e.decision.targetLanguage}`, i);
      }
      // Indices already finalized via onJobComplete — the fallback loop after
      // the dispatch loop must skip them to avoid double-persisting / double
      // counting status.completed.
      const processedIndices = new Set<number>();
      const onJobComplete = async (result: TranslationResult): Promise<void> => {
        if ((status.status as RunStatusCode) === RunStatusCode.Cancelled) return;
        const idx = keyToIndex.get(`${result.entryId}::${result.targetLanguage}`);
        if (idx === undefined || processedIndices.has(idx)) return;
        // A Freeway per-result ERROR is provisional: the dispatch layer may
        // still rescue those pairs (parse-failure split, all-errored
        // failover), and finalizing here would turn the rescue's streamed
        // result into a dedupe no-op. The post-dispatch loops finalize
        // whatever the OUTCOME carries — for a partial-batch error that is
        // this same error result, via the positional targetResults mapping.
        if (bucketKey !== undefined && freewayDeps && result.error) return;
        moduleResults[idx] = result;
        processedIndices.add(idx);
        await finalizeEntryResult(idx);
      };

      // A FREEWAY batch (`bucketKey !== undefined`) always has exactly ONE
      // entry in `dispatchBatches`, which is what makes the post-dispatch sync
      // below safe: it moves the outer module/moduleId/metricsModel after a
      // failover, while only the dispatched batch's own decisions are
      // re-pointed (inside dispatchFreewayBatch) — and persistResult /
      // retryLqaFailure attribute the text by `decision.moduleId`. A second
      // batch here would therefore persist a stale producer. It cannot occur:
      // a single-language Freeway group takes the `jobsByTargetLanguage` path
      // with exactly one language in it, and a PACKED mixed-target group takes
      // the `shouldDispatchMixedTargetChunk` path, which is one batch by
      // construction — packing is the only way a Freeway group holds more than
      // one language, and it merges only what one bucket serves in one
      // request. Should that ever change, attribution is not the first thing
      // that breaks (revalidateGroup still derives ONE band and language from
      // the first decision — which is why a mixed chunk must be unpacked
      // before any re-validation — and the per-group bucket/batchSize plan and
      // freewayModuleOverrides are per assignment too), so this is recorded as
      // an invariant rather than defended with a silent fix-up.
      for (const batchJobs of dispatchBatches) {
        if ((status.status as RunStatusCode) === RunStatusCode.Cancelled || signal?.aborted) break;
        let targetResults: TranslationResult[] = [];
        let batchError: unknown;
        /** Set when a Freeway failover ended in a park/block instead of results. */
        let batchAuthCancel = true;
        /**
         * Set when a degraded batch changed bucket mid-dispatch. The degrade is
         * re-stated only once the hop actually produces results — a hop that
         * ends in a park or a block served nothing, so naming its bucket would
         * credit it with text it never produced.
         */
        let degradedHop = false;
        const batchStartedAt = Date.now();
        if (bucketKey !== undefined && freewayDeps) {
          // Freeway batches never retry a 429 in place: the free quota they hit
          // is a day-scale budget, not a momentary burst, so the bucket is
          // cooled and the batch fails over to another one (once).
          const state: FreewayBatchState = { module, moduleId, modelId: metricsModel, bucketKey };
          currentFreewayState = state;
          const outcome = await this.dispatchFreewayBatch({
            jobs: batchJobs.map(({ job }) => job),
            decisions: batchJobs.map(({ index }) => uncachedNonTrivialEntries[index].decision),
            state,
            deps: freewayDeps,
            createModule: createFreewayModule,
            translateOptions: { ...dispatchOptions, onJobComplete },
            signal,
            onReroute: (info) => this.recordFreewayDetail(runId, formatRerouteDetail(info)),
            onSplit: (info) => this.recordFreewayDetail(runId, formatSplitDetail(info)),
            degradedFloor: freewayDegraded?.toTier as DifficultyBand | undefined,
            minBand: freewayMinBand(status.request),
            splitCaps: freewaySplitCaps,
            onRechunk: (info) => this.recordFreewayDetail(runId, formatRechunkDetail(info)),
            onUnpack: (info) => this.recordFreewayDetail(runId, formatUnpackDetail(info)),
          });
          currentFreewayState = undefined;
          // A same-bucket auth failover (a sibling instance took over, see
          // dispatchFreewayBatch's 'keep' handling) changes state.moduleId
          // without changing state.bucketKey — sync on EITHER moving, or the
          // next batch in this run would start back on the marked module.
          if (state.bucketKey !== bucketKey || state.moduleId !== moduleId) {
            const bucketChanged = state.bucketKey !== bucketKey;
            // A same-bucket instance swap is NOT a reroute — the bucket is
            // identical, only the credential behind it changed — so log it
            // under a distinct event (and always carry both module ids), or
            // this reads as a from===to no-op reroute in the logs.
            this.logger.info(
              bucketChanged
                ? 'translation:freeway-rerouted'
                : 'translation:freeway-instance-swapped',
              {
                runId,
                from: bucketKey,
                to: state.bucketKey,
                fromModuleId: moduleId,
                toModuleId: state.moduleId,
                reason: 'dispatch-failure',
              },
            );
            if (freewayDegraded && bucketChanged) degradedHop = true;
            module = state.module;
            moduleId = state.moduleId;
            bucketKey = state.bucketKey;
            metricsModel = state.modelId;
          }
          if (outcome.kind === 'results') {
            targetResults = outcome.results;
            if (freewayDegraded && degradedHop) {
              // The degraded batch failed over mid-dispatch and the new bucket
              // served it: name that bucket, or the earlier degrade line
              // attributes the tier relaxation to one that never produced the
              // text. `bucketKey` is already the post-hop key here.
              this.logger.info('translation:freeway-degraded', {
                runId,
                bucketKey,
                band: freewayDegraded.fromTier,
                fromTier: freewayDegraded.fromTier,
                toTier: freewayDegraded.toTier,
                waitedAlternativeMs: freewayDegraded.waitedAlternativeMs,
              });
              this.recordFreewayDetail(runId, formatDegradedDetail(freewayDegraded));
            }
            metricsCollector.recordLatency(moduleId, metricsModel, Date.now() - batchStartedAt);
          } else if (outcome.kind === 'defer' || outcome.kind === 'blocked') {
            const pairs: RunEntryLanguagePair[] = [];
            for (const { index } of batchJobs) {
              if (processedIndices.has(index)) continue;
              const e = uncachedNonTrivialEntries[index];
              pairs.push({
                entryId: e.decision.entry.id,
                targetLanguage: e.decision.targetLanguage,
              });
              settled.add(settleKey(e.decision));
              deferredIndices.add(index);
            }
            if (outcome.kind === 'defer') {
              this.deferPairsForQuota(status, pairs, outcome.resumeAt, outcome.reason);
              this.logger.info('translation:freeway-deferred', {
                runId,
                bucketKey,
                pairs: pairs.length,
                resumeAt: outcome.resumeAt,
              });
              this.recordFreewayDetail(runId, formatDeferralDetail(pairs.length, outcome.resumeAt));
              this.emitProgress(runId, status);
            } else {
              this.recordFreewayBlocked(runId, status, pairs);
            }
            continue;
          } else {
            batchError = outcome.error;
            batchAuthCancel = outcome.authCancel;
          }
        } else {
          try {
            targetResults = await withRateLimitRetry(
              async () => {
                const dispatched = await module.translate(
                  batchJobs.map(({ job }) => job),
                  signal,
                  { ...dispatchOptions, onJobComplete },
                );
                // A module that flattens a 429 into a per-result `error` string
                // rather than throwing must still trigger the engine's 429
                // back-off. Surface it as a THROW so withRateLimitRetry re-sends
                // the whole batch (already-persisted jobs are deduped by
                // processedIndices in onJobComplete, so the count stays
                // exactly-once); otherwise a batch 429 would be recorded as N
                // plain failures with no retry.
                const rateLimited = dispatched.find((r) => r?.error && isRateLimitError(r.error));
                if (rateLimited?.error) throw new Error(rateLimited.error);
                return dispatched;
              },
              {
                baseDelayMs: this.retryBaseDelayMs,
                signal,
                isCancelled: () =>
                  (status.status as RunStatusCode) === RunStatusCode.Cancelled || !!signal?.aborted,
                onRetry: (attempt, delay) => {
                  metricsCollector.record429Retry(moduleId, metricsModel);
                  // The whole batch is re-sent, so each entry in it retried.
                  for (const { index } of batchJobs) {
                    const e = uncachedNonTrivialEntries[index];
                    this.recordRetry(
                      runId,
                      e.decision.entry.id,
                      e.decision.entry.sourceText,
                      e.decision.targetLanguage,
                    );
                  }
                  this.logger.warn('translation:retry', { runId, attempt: attempt + 1, delay });
                },
              },
            );
            metricsCollector.recordLatency(moduleId, metricsModel, Date.now() - batchStartedAt);
          } catch (err) {
            batchError = err;
          }
        }

        if (batchError !== undefined) {
          if (isAbortError(batchError) || signal?.aborted) {
            return;
          }
          // A failed dispatch batch only fails its own jobs; other batches in
          // the group proceed and their results are persisted normally.
          // Sanitize before recording/logging — a provider error can echo a raw
          // credential (pattern-strip + live-vault value scrub), same rationale
          // as the batch-uncaught catch below.
          const message = sanitizeLogObject({ m: toErrorMessage(batchError) }).m;
          this.logger.warn('translation:batch-failed', {
            runId,
            moduleId,
            batchSize: batchJobs.length,
            targetLanguages: Array.from(new Set(batchJobs.map(({ job }) => job.targetLanguage))),
            error: message,
            ...(batchError instanceof Error ? { errorName: batchError.name } : {}),
          });
          for (const { index } of batchJobs) {
            // A prior call inside this same translate() invocation may already
            // have reported this job via onJobComplete before the batch as a
            // whole ultimately rejected — don't re-fail an entry that already
            // succeeded and was persisted.
            if (processedIndices.has(index)) continue;
            const e = uncachedNonTrivialEntries[index];
            this.logger.warn('translation:failed', {
              runId,
              entryId: e.decision.entry.id,
              targetLanguage: e.decision.targetLanguage,
              moduleId,
              error: message,
              batchFailure: true,
              context: e.decision.entry.context ?? null,
            });
            this.recordFailure(status, e.decision.entry.id, e.decision.targetLanguage, message);
            settled.add(settleKey(e.decision));
            metricsCollector.recordFailure(moduleId, metricsModel);
            this.emitProgress(runId, status);
            dispatchFailed.add(index);
          }
          // A 401/403 dooms every remaining batch in this run — cancel it. A
          // Freeway batch is the exception: its credential belongs to ONE
          // bucket, which the failover has already disabled, so the run only
          // cancels when that left no usable bucket at all.
          if (batchAuthCancel && (await this.maybeCancelForAuth(runId, moduleId, batchError))) {
            return;
          }
          continue;
        }

        this.recordUsage(status, moduleId, targetResults);

        for (let index = 0; index < batchJobs.length; index++) {
          const batchJob = batchJobs[index];
          if (!batchJob) continue;
          if (!processedIndices.has(batchJob.index)) {
            moduleResults[batchJob.index] = targetResults[index];
          }
        }
      }

      for (let i = 0; i < uncachedNonTrivialEntries.length; i++) {
        if ((status.status as RunStatusCode) === RunStatusCode.Cancelled) break;
        if (dispatchFailed.has(i) || processedIndices.has(i) || deferredIndices.has(i)) continue;
        const authCancelled = await finalizeEntryResult(i);
        if (authCancelled) return;
      }

      // The LQA corrective retry for batch runs: re-attempt each gate-failed
      // entry with corrective feedback. Retry-queued entries were NOT counted
      // at their first-pass site (only marked settled) — they are counted
      // here, once their retry settles, mirroring the single path:
      // `persisted` replaces the stored translation and its gate result,
      // `accepted-original` keeps the first-pass text; both are a completed
      // decision (count once). `aborted` (run cancelled) does not count — the
      // cancel path finalizes. Deferring the count until here is what keeps a
      // sibling dispatch group from finalizing the run while these retries
      // are still in flight.
      for (const item of lqaRetryQueue) {
        if ((status.status as RunStatusCode) === RunStatusCode.Cancelled || signal?.aborted) break;
        // Freeway escalation: a gate failure is a signal that this bucket's
        // model is too weak for the entry, so the corrective attempt goes to a
        // HIGHER tier with quota when one exists — a same-model retry usually
        // just spends another free request on the same mistake. Falls back to
        // the same-module retry when the ladder is exhausted (or the escalated
        // module cannot take corrective feedback).
        let retryModule = module;
        let retryDecision = item.entry.decision;
        let escalatedBucketKey: string | undefined;
        if (bucketKey !== undefined && freewayDeps) {
          const escalationCandidates = await this.selectFreewayEscalation(
            bucketKey,
            item.entry.decision,
            freewayDeps,
          );
          let escalation: (typeof escalationCandidates)[number] | undefined;
          let escalatedModule: TranslationModule | undefined;
          for (const candidate of escalationCandidates) {
            let built: TranslationModule | undefined;
            try {
              built = createFreewayModule(
                candidate.moduleId,
                candidate.modelId,
                candidate.bucketKey,
              );
            } catch {
              // An unbuildable candidate (e.g. a module factory that throws
              // on invalid config) is skipped, not terminal — try the next rung.
              continue;
            }
            if (!built) continue;
            if (typeof built.retryWithFeedback === 'function') {
              escalation = candidate;
              escalatedModule = built;
              break;
            }
            // A higher-tier bucket whose module cannot do feedback retry
            // (DeepL) is skipped, not terminal — the next rung may be capable.
            this.logger.info('translation:freeway-escalation-skipped-incapable', {
              bucketKey: candidate.bucketKey,
            });
          }
          if (escalation && escalatedModule) {
            retryModule = escalatedModule;
            retryDecision = {
              ...item.entry.decision,
              moduleId: escalation.moduleId,
              modelOverride: escalation.modelId,
              freewayTier: escalation.qualityTier,
            };
            escalatedBucketKey = escalation.bucketKey;
            this.logger.info('translation:freeway-escalated', {
              runId,
              entryId: item.entry.decision.entry.id,
              targetLanguage: item.entry.decision.targetLanguage,
              from: bucketKey,
              to: escalation.bucketKey,
            });
            this.recordFreewayDetail(
              runId,
              `${item.entry.decision.targetLanguage} gate-failed on ${bucketKey} — escalated to ${escalation.bucketKey}`,
            );
          }
        }
        const retry = await this.retryLqaFailure({
          runId,
          projectId,
          status,
          module: retryModule,
          decision: retryDecision,
          sourceLanguage,
          masked: item.entry.masked,
          plan: item.entry.plan,
          glossaryById: item.entry.glossaryById,
          nonConstantTerms: item.entry.nonConstantTerms,
          jobContext: appendTmHints(item.entry.decision.entry.context, item.entry.tmHints),
          ...(item.entry.reference ? { reference: item.entry.reference } : {}),
          ...(examplesByLanguage?.get(item.entry.decision.targetLanguage)?.length
            ? { examples: examplesByLanguage.get(item.entry.decision.targetLanguage) }
            : {}),
          originalText: item.originalText,
          lqaResult: item.lqaResult,
          metricsModel,
          signal,
          ...(project ? { project } : {}),
          achievementPairMap,
        });
        // The corrective attempt is a real provider call either way — debit the
        // bucket that served it (the escalation target, or the origin bucket
        // when the same-module retry ran).
        if (bucketKey !== undefined && freewayDeps) {
          await this.recordFreewayDispatch(escalatedBucketKey ?? bucketKey, [], freewayDeps);
        }
        if (retry.outcome === 'aborted') break;
        status.completed++;
        metricsCollector.recordSuccess(moduleId, metricsModel);
        this.logger.info('translation:done', {
          runId,
          entryId: item.entry.decision.entry.id,
          targetLanguage: item.entry.decision.targetLanguage,
          moduleId,
          lqaRetried: true,
          context: item.entry.decision.entry.context ?? null,
          glossaryId: retry.usedGlossaryId ?? null,
        });
        this.emitProgress(runId, status);
      }
    } catch (err) {
      // Catch-all for the dispatch pipeline. Without this, an
      // unexpected throw from the batch body outside the dispatch try/catch —
      // persistResult, the injected lqaGate, globalConfigStore.load,
      // fetchGlossariesForBatch, or updateEntry (→ EntryNotFoundError when an
      // entry is deleted mid-run) — would escape uncaught, be swallowed by the
      // JobQueue pump, and leave this batch's decisions uncounted so
      // completed+failed never reaches total: the run stays Running forever and
      // blocks every later run for the project. Fail only THIS call's unsettled
      // decisions (see `settled`) so the finally's finalizeTranslationTerminal
      // can settle the run.
      if (isAbortError(err) || signal?.aborted) {
        return; // finally still finalizes
      }
      const message = sanitizeLogObject({ m: toErrorMessage(err) }).m;
      const stack = err instanceof Error ? err.stack : undefined;
      for (const d of decisions) {
        if (settled.has(settleKey(d))) continue;
        this.recordFailure(status, d.entry.id, d.targetLanguage, message);
        settled.add(settleKey(d));
      }
      this.logger.error('translation:batch-uncaught', {
        runId,
        error: message,
        ...(stack ? { stack } : {}),
      });
      this.emitProgress(runId, status);
    } finally {
      // Batch settle: one stats write per bucket this batch touched.
      if (freewayGateOutcomes.size > 0) {
        await this.flushFreewayGateOutcomes(
          freewayGateOutcomes,
          freewayDeps ?? this.freewayOverrides,
        );
      }
      await this.finalizeTranslationTerminal(status, projectId, runId);
    }
  }

  /**
   * The LQA corrective retry for the dispatch pipeline (processBatchJob):
   * re-attempts a failed-gate translation via module.retryWithFeedback on the
   * same conversation session, re-verifies the mask, persists and re-gates
   * the retry result, and records it in the TM when the gate passes.
   *
   * Outcomes: 'persisted' — the retry result replaced the original;
   * 'accepted-original' — retry unavailable/failed, keep the first result;
   * 'aborted' — the run was cancelled mid-retry.
   */
  private async retryLqaFailure(args: {
    runId: string;
    projectId: string;
    status: RunStatus;
    module: TranslationModule;
    decision: RoutingDecision;
    sourceLanguage: string;
    masked: string;
    plan: ReturnType<typeof maskText>['plan'];
    glossaryById: Map<string, GlossaryTerm>;
    nonConstantTerms: GlossaryTerm[];
    jobContext: string | undefined;
    reference?: TranslationJob['reference'];
    examples?: TranslationJob['examples'];
    originalText: string;
    lqaResult: import('@zercade-dev/narn-shared').LQAResult;
    metricsModel: string | null;
    signal?: AbortSignal;
    project?: Project;
    achievementPairMap?: Map<string, StringEntry[]>;
  }): Promise<{ outcome: 'persisted' | 'accepted-original' | 'aborted'; usedGlossaryId?: string }> {
    const {
      runId,
      projectId,
      status,
      module,
      decision,
      sourceLanguage,
      masked,
      plan,
      glossaryById,
      nonConstantTerms,
      jobContext,
      reference,
      examples,
      originalText,
      lqaResult,
      metricsModel,
      signal,
      project,
      achievementPairMap,
    } = args;
    if (typeof module.retryWithFeedback !== 'function' || decision.moduleId === null) {
      return { outcome: 'accepted-original' };
    }
    const { entry, targetLanguage } = decision;
    const achievement = project
      ? buildAchievementPromptContext(
          entry,
          targetLanguage,
          project,
          achievementPairMap ?? new Map(),
        )
      : undefined;
    const feedback = buildLqaRetryFeedback(lqaResult, targetLanguage, achievement);
    metricsCollector.recordLqaRetry(decision.moduleId, metricsModel);
    this.recordRetry(runId, entry.id, entry.sourceText, targetLanguage);
    this.logger.info('translation:lqa-retry', {
      runId,
      entryId: entry.id,
      targetLanguage,
      moduleId: decision.moduleId,
      issues: lqaResult.issues.length,
    });
    try {
      const retryJob: TranslationJob = {
        entryId: entry.id,
        sourceText: masked,
        sourceLanguage,
        targetLanguage,
        glossary: nonConstantTerms,
        glossaryId: entry.assignedGlossaryIds?.[0] ?? 'project',
        promptOptions: achievement
          ? { ...effectivePromptOptions(entry, decision.promptOptions), achievement }
          : effectivePromptOptions(entry, decision.promptOptions),
        context: jobContext,
        ...(reference ? { reference } : {}),
        ...(examples?.length ? { examples } : {}),
      };
      const retryModuleResult = await module.retryWithFeedback(
        retryJob,
        originalText,
        feedback,
        signal,
      );
      this.recordUsage(status, decision.moduleId, [retryModuleResult]);
      // An errored OR empty/whitespace retry keeps the first-pass text: never
      // overwrite good output with '' (mirrors M30's error||!translatedText).
      if (retryModuleResult.error || !retryModuleResult.translatedText?.trim()) {
        return { outcome: 'accepted-original' };
      }
      const retryDiagnostics = verifyMaskedTranslation(retryModuleResult.translatedText, plan);
      if (signal?.aborted) return { outcome: 'aborted' };
      const retryMaskIssues = maskDiagnosticsToIssues(retryDiagnostics);
      const retryRestored = restoreFinal(
        entry.sourceText,
        retryModuleResult.translatedText,
        plan,
        glossaryById,
        targetLanguage,
      );
      const retryResult: TranslationResult = {
        entryId: entry.id,
        targetLanguage,
        translatedText: retryRestored,
        rawResponse: retryModuleResult.rawResponse,
      };
      await this.persistResult(projectId, entry, targetLanguage, retryResult, decision, runId);
      await this.lqaGate(entry, retryResult, projectId, targetLanguage, retryMaskIssues);
      // No TM auto-record — only approved translations are written to the memory.
      return {
        outcome: 'persisted',
        ...(retryModuleResult.usedGlossaryId !== undefined
          ? { usedGlossaryId: retryModuleResult.usedGlossaryId }
          : {}),
      };
    } catch (err) {
      if (isAbortError(err)) return { outcome: 'aborted' };
      this.logger.warn('translation:lqa-retry-failed', {
        runId,
        entryId: entry.id,
        targetLanguage,
        error: err instanceof Error ? err.message : `${err}`,
      });
      return { outcome: 'accepted-original' };
    }
  }

  /**
   * Consults the translation memory. TM failures must never fail a job, so
   * errors are logged and treated as a miss.
   */
  private async tmLookupSafe(
    maskedSource: string,
    targetLanguage: string,
    fingerprint: TmFingerprint,
    policy: TmMatchPolicy,
    entry: StringEntry,
  ): Promise<TmLookupResult> {
    // TM off for this project: report a clean miss (no auto-apply, no hints).
    if (policy === 'disabled') return { autoApply: null, hints: [] };
    try {
      return await this.tmStore.lookup({
        maskedSource,
        targetLanguage,
        fingerprint,
        policy,
        overflowLimit: entry.ignoreOverflow ? null : entry.overflowRatio,
      });
    } catch (err) {
      this.logger.warn('translation:tm-lookup-failed', {
        entryId: entry.id,
        targetLanguage,
        error: err instanceof Error ? err.message : `${err}`,
      });
      return { autoApply: null, hints: [] };
    }
  }

  private async persistResult(
    projectId: string,
    entry: StringEntry,
    targetLanguage: string,
    result: TranslationResult,
    decision: RoutingDecision,
    runId?: string,
  ): Promise<void> {
    if (decision.moduleId === null) return;
    // Snapshot this pair's translation as it stood before this write, so the
    // run's revert action can restore it later. Must happen BEFORE
    // setTranslation below overwrites it; capturePreviousValue itself dedupes
    // per pair so a later LQA-retry re-persist never overwrites the captured
    // "before this run" snapshot with an in-run intermediate value.
    this.capturePreviousValue(runId, entry, targetLanguage);
    // Use setTranslation so the read-merge-write happens atomically inside the
    // write lock. This prevents concurrent jobs for different target languages
    // on the same entry from overwriting each other's translations.
    await this.stringStore.setTranslation(
      projectId,
      entry.id,
      targetLanguage,
      {
        text: result.translatedText,
        status: 'translated',
        moduleId: decision.moduleId,
        timestamp: Date.now(),
        needsReview: true,
        ...(runId ? { runId } : {}),
        // Stamps the SERVING Freeway bucket's tier (Addendum H) — decision
        // .freewayTier is threaded through the exact same channel as
        // moduleId/modelOverride above, kept in sync on every failover/
        // degrade/escalation re-point, and explicitly cleared by every
        // short-circuit persist path that never reached a bucket at all.
        ...(decision.freewayTier !== undefined ? { freewayTier: decision.freewayTier } : {}),
      },
      // Preserve a human 'reviewed' verdict when this run re-produces the exact
      // same text (re-translate / TM auto-apply). The check runs inside the
      // write lock against the current record, so a mid-run approval survives.
      { preserveReviewedIfSameText: true },
    );
    // Every successful translation flows through here (first-pass, trivial, and
    // LQA-retry re-persist), so this is the single place to record the run's
    // translated-entry detail (deduped per entry+language).
    this.recordDetailEntry(runId, entry.id, entry.sourceText, targetLanguage);
  }

  /**
   * Fold module-reported usage from a set of results into the run's
   * per-(moduleId, model) aggregation. Modules attach batch-total usage to the
   * first result of each provider call, so summing across all results is the
   * correct (and only) way to aggregate.
   */
  private recordUsage(
    status: RunStatus,
    moduleId: string,
    results: readonly (TranslationResult | undefined)[],
  ): void {
    // Fold each call's character accounting into the run's detail totals. Done
    // separately from the token aggregation below because char-only usage (e.g.
    // the pseudo module, or any provider that reports no tokens) must still
    // count toward the character detail. recordUsage runs for first-pass AND
    // LQA-retry results, so retries are counted automatically ("incl. retries").
    const acc = this.details.get(status.runId);
    if (acc) {
      for (const result of results) {
        const usage = result?.usage;
        if (!usage) continue;
        acc.chars.inputTotal += usage.promptChars ?? 0;
        acc.chars.inputSource += usage.sourceChars ?? 0;
        acc.chars.outputTotal += usage.responseChars ?? 0;
        acc.chars.outputUsed += usage.outputChars ?? 0;
      }
    }
    // Token/character/reasoning aggregation into usageByModule is shared with
    // the AI-review engines via accumulateUsage.
    accumulateUsage(
      status,
      moduleId,
      results.map((r) => r?.usage),
    );
  }

  /** Seed the detail accumulator for a starting run. */
  private initDetails(runId: string): void {
    this.details.set(runId, {
      entryKeys: new Set(),
      entries: [],
      retries: new Map(),
      chars: { inputTotal: 0, inputSource: 0, outputTotal: 0, outputUsed: 0 },
      previousValues: new Map(),
      freewaySplitCaps: new Map(),
    });
  }

  /**
   * Seed the in-memory detail accumulator from a run's existing
   * `details-<runId>.json` sidecar so an in-place retry ADDS to — rather than
   * replaces — the entries, retry counts, character totals, and captured
   * previous values already recorded. Falls back to a fresh accumulator when
   * no sidecar exists.
   */
  private async hydrateDetails(projectId: string, runId: string): Promise<void> {
    const existing = await this.runStore.getRunDetails(projectId, runId);
    if (!existing) {
      this.initDetails(runId);
      return;
    }
    const retries = new Map<
      string,
      { entryId: string; sourceText: string; targetLanguage: string; count: number }
    >();
    for (const r of existing.retries) {
      retries.set(detailKey(r.entryId, r.targetLanguage), { ...r });
    }
    const previousValues = new Map<string, RunDetailPreviousValue>();
    for (const pv of existing.previousValues ?? []) {
      previousValues.set(detailKey(pv.entryId, pv.targetLanguage), { ...pv });
    }
    this.details.set(runId, {
      entryKeys: new Set(existing.entries.map((e) => detailKey(e.entryId, e.targetLanguage))),
      entries: [...existing.entries],
      retries,
      chars: { ...existing.chars },
      previousValues,
      freewaySplitCaps: new Map(),
      ...(existing.freeway ? { freeway: [...existing.freeway] } : {}),
    });
  }

  /**
   * Record a successfully-translated (entry, target language) for the run's
   * detail sidecar. Deduplicated per pair so an LQA-retry re-persist (which
   * calls {@link persistResult} again) does not double-count.
   */
  private recordDetailEntry(
    runId: string | undefined,
    entryId: string,
    sourceText: string,
    targetLanguage: string,
  ): void {
    if (!runId) return;
    const acc = this.details.get(runId);
    if (!acc) return;
    const key = detailKey(entryId, targetLanguage);
    if (acc.entryKeys.has(key)) return;
    acc.entryKeys.add(key);
    acc.entries.push({ entryId, sourceText, targetLanguage });
  }

  /**
   * Snapshot a (entry, target language)'s translation record as it stood
   * immediately before {@link persistResult} overwrites it, so the run's
   * revert action can restore it. Deduplicated per pair (like {@link
   * recordDetailEntry}): only the FIRST call for a pair within a run's
   * lifetime (across retries too, via {@link hydrateDetails}) captures —
   * later LQA-retry re-persists for the same pair must not clobber the
   * "before this run touched it" snapshot with an in-run intermediate value.
   * `entry` is the in-memory snapshot loaded for this job; per the single-user
   * assumption (no concurrent editors) it reflects the true pre-run state for
   * this (entry, language) pair.
   */
  private capturePreviousValue(
    runId: string | undefined,
    entry: StringEntry,
    targetLanguage: string,
  ): void {
    if (!runId) return;
    const acc = this.details.get(runId);
    if (!acc) return;
    const key = detailKey(entry.id, targetLanguage);
    if (acc.previousValues.has(key)) return;
    acc.previousValues.set(key, {
      entryId: entry.id,
      targetLanguage,
      previousValue: entry.translations[targetLanguage] ?? null,
    });
  }

  /**
   * Bump the retry count for a (entry, target language) in the run's detail
   * sidecar. Covers both 429 backoff retries and the LQA `retryWithFeedback`
   * pass; the source text is the original entry source for display.
   */
  private recordRetry(
    runId: string,
    entryId: string,
    sourceText: string,
    targetLanguage: string,
  ): void {
    const acc = this.details.get(runId);
    if (!acc) return;
    const key = detailKey(entryId, targetLanguage);
    const existing = acc.retries.get(key);
    if (existing) {
      existing.count++;
    } else {
      acc.retries.set(key, { entryId, sourceText, targetLanguage, count: 1 });
    }
  }

  /**
   * Append one "why routed" line to a Freeway run's detail log (resolution,
   * reroute, escalation, or quota deferral). No-op when the run has no
   * accumulator (e.g. after a restart) — the detail log is best-effort
   * explainability, never load-bearing for the run itself.
   */
  private recordFreewayDetail(runId: string, line: string): void {
    const acc = this.details.get(runId);
    if (!acc) return;
    (acc.freeway ??= []).push(line);
  }

  /**
   * Flush the run's accumulated detail to its sidecar and drop the in-memory
   * accumulator. Best-effort: a failed write never fails the run. No-op when
   * the run has no accumulator (e.g. after a restart).
   */
  private async persistDetails(projectId: string, runId: string): Promise<void> {
    const acc = this.details.get(runId);
    this.details.delete(runId);
    if (!acc) return;
    const detail: RunDetails = {
      runId,
      entries: acc.entries,
      retries: [...acc.retries.values()],
      chars: acc.chars,
      previousValues: [...acc.previousValues.values()],
      ...(acc.freeway ? { freeway: acc.freeway } : {}),
    };
    await this.runStore.saveRunDetails(projectId, runId, detail).catch((err) => {
      this.logger.warn('translation:details-save-failed', {
        runId,
        error: err instanceof Error ? err.message : `${err}`,
      });
    });
  }

  /**
   * Terminal flip run in `processBatchJob`'s finally (every dispatch group,
   * batch or single): when the run has drained every job (a paused run whose
   * in-flight work finished counts too), mark it Completed, stamp `finishedAt`,
   * tear down its controller/queue marker, finalize cost, flush details, persist,
   * and start the next queued run. No-op if the run already left Running/Paused
   * (e.g. cancelled) or still has jobs outstanding. Centralizing it keeps the
   * exact await ordering identical across every group task.
   */
  // Deliberate mirror of M9/run-engine.ts:finalizeTerminal — apply behavioral fixes to both.
  private async finalizeTranslationTerminal(
    status: RunStatus | undefined,
    projectId: string,
    runId: string,
  ): Promise<void> {
    if (
      !status ||
      (status.status !== RunStatusCode.Running && status.status !== RunStatusCode.Paused)
    ) {
      return;
    }
    // Pairs parked for free quota are neither completed nor failed, so they
    // are what the run is still missing — it has drained once they account for
    // the remainder.
    const waitingPairs = status.waitingForQuota?.pairs.length ?? 0;
    if (status.completed + status.failed + waitingPairs < status.total) return;
    if (waitingPairs > 0) {
      // Not done — parked. The run stays the project's active run and resumes
      // (manually or by the quota sweep) with exactly these pairs. A run the
      // USER paused mid-flight is already Paused when its last batch parks:
      // skip the redundant transition but still persist the parked pairs.
      if (status.status !== RunStatusCode.Paused) {
        status.status = RunStatusCode.Paused;
        this.queue.pauseRun(runId);
      }
      this.logger.info('translation:waiting-for-quota', {
        runId,
        pairs: waitingPairs,
        resumeAt: status.waitingForQuota?.resumeAt ?? null,
      });
      this.emitProgress(runId, status);
      // Flush the detail sidecar BEFORE the status write, exactly like the
      // completed and cancelled paths. A parked run's first pass already
      // produced entries, character totals, previous values (Revert reads
      // those) and its freeway routing lines; the resume re-seeds the
      // accumulator from this sidecar (`hydrateDetails`), so skipping it here
      // would drop all of it — and leave the details endpoint empty while the
      // run waits.
      await this.persistDetails(projectId, runId);
      await this.runStore.updateRun(projectId, status).catch((err: unknown) => {
        this.logger.warn('translation:finalize-store-update-failed', {
          runId,
          error: toErrorMessage(err),
        });
      });
      return;
    }
    status.status = RunStatusCode.Completed;
    status.finishedAt = Date.now();
    this.controllers.delete(runId);
    this.queue.cancelRun(runId); // clears any paused marker; no tasks remain
    await finalizeUsageCosts(status, this.pricing);
    await this.persistDetails(projectId, runId);
    // The final terminal-state persist is best-effort (a failed write can't
    // un-finalize the in-memory run), but a swallowed failure means the run store
    // never reflects the terminal status — surface it instead of dropping it
    // (mirrors the base BackgroundRunEngine's finalizeTerminal).
    await this.runStore.updateRun(projectId, status).catch((err: unknown) => {
      this.logger.warn('translation:finalize-store-update-failed', {
        runId,
        error: toErrorMessage(err),
      });
    });
    // The run's last natural store write is done; resolve its settled
    // deferred once no detached task is still executing (the finalizing task is
    // still counted here — its own `trackTask` finally resolves it).
    this.maybeResolveSettled(runId);
    this.startNextQueued(projectId);
    // The run just went terminal; drop any long-terminal siblings.
    this.evictTerminalRuns();
  }

  /**
   * Reconcile this project's crash/redeploy-orphaned runs the first
   * time it is touched this process. Best-effort — a transient store failure
   * never blocks the enqueue; it just leaves the sweep marked done (a boot
   * nicety, not a correctness gate). Marked before awaiting so two parallel
   * enqueues for the same project don't both sweep.
   */
  private async sweepOrphanedProjectRuns(projectId: string): Promise<void> {
    if (this.sweptProjects.has(projectId)) return;
    this.sweptProjects.add(projectId);
    try {
      const swept = await sweepOrphanedRuns(this.runStore, projectId);
      if (swept > 0) {
        this.logger.warn('translation:orphaned-runs-swept', { projectId, count: swept });
      }
    } catch (err) {
      this.logger.warn('translation:orphan-sweep-failed', {
        projectId,
        error: err instanceof Error ? err.message : `${err}`,
      });
    }
  }

  /**
   * Bound the in-memory run maps. They are a hot cache over the durable
   * RunStore, so a terminal run can be forgotten once clients have had a
   * grace window to observe its final status (the `/translate/status` poll
   * reads this map; `listRuns` reads the store). Evicts terminal runs
   * finished more than {@link TranslationEngine.TERMINAL_EVICT_GRACE_MS} ago;
   * if the map still exceeds {@link TranslationEngine.MAX_TRACKED_RUNS},
   * evicts the oldest-finished terminal runs as a backstop. NON-terminal
   * (active/queued) runs are never evicted, and an in-flight lookup for an
   * evicted run falls back to the store, so nothing is lost.
   */
  // Deliberate mirror of M9/run-engine.ts:evictTerminalRuns — apply behavioral fixes to both.
  private evictTerminalRuns(): void {
    const now = Date.now();
    const terminal: Array<{ runId: string; finishedAt: number }> = [];
    for (const [runId, status] of this.runs) {
      if (
        status.status !== RunStatusCode.Completed &&
        status.status !== RunStatusCode.Failed &&
        status.status !== RunStatusCode.Cancelled
      ) {
        continue; // active or queued — keep
      }
      const finishedAt = status.finishedAt ?? 0;
      if (now - finishedAt >= TranslationEngine.TERMINAL_EVICT_GRACE_MS) {
        this.forgetRun(runId);
      } else {
        terminal.push({ runId, finishedAt });
      }
    }
    const over = this.runs.size - TranslationEngine.MAX_TRACKED_RUNS;
    if (over > 0) {
      terminal.sort((a, b) => a.finishedAt - b.finishedAt);
      for (let i = 0; i < over && i < terminal.length; i++) {
        this.forgetRun(terminal[i].runId);
      }
    }
  }

  /** Drop every in-memory trace of a (terminal) run across the sidecar maps. */
  // Deliberate mirror of M9/run-engine.ts:forgetRun — apply behavioral fixes to both.
  private forgetRun(runId: string): void {
    this.runs.delete(runId);
    this.details.delete(runId);
    this.controllers.delete(runId);
    this.queuedSessions.delete(runId);
    this.runSessions.delete(runId);
    this.runTenants.delete(runId);
    this.lastQuotaResumeAttempt.delete(runId);
    this.freewayTransientParkedPairs.delete(runId);
    this.queuedTenants.delete(runId);
    this.queuedRetryRequests.delete(runId);
    // Resolve a dangling settled deferred before dropping it so any drain
    // still awaiting this (now-forgotten, terminal) run is never left hanging.
    this.tracker.forget(runId);
  }

  /**
   * Module-config fragment carrying the workspace-wide client-side rate
   * limit, injected into every module created for a translation job.
   */
  private rateLimitConfig(global: GlobalConfig): Record<string, unknown> {
    return rateLimitConfig(global);
  }

  private recordFailure(
    status: RunStatus,
    entryId: string,
    targetLanguage: string,
    message: string,
  ): void {
    recordRunFailure(status, { entryId, targetLanguage }, message);
  }

  /**
   * Classify a routing decision's controlled (pre-dispatch) failure reason, or
   * return null when the decision is dispatchable. These are the conditions the
   * engine can decide from routing + module config alone — no provider call:
   *
   *  - `no-route`         — the router matched no rule (`moduleId === null`).
   *  - `module-disabled`  — the routed module is disabled / inactive.
   *  - `module-not-found` — the routed module is not registered.
   *
   * The virtual `freeway` target is exempt — see the check below.
   *
   * Returns the resolved metrics model alongside the reason so the caller can
   * attribute the health-metric failure to the same `(moduleId, model)` key the
   * per-job paths used. Deterministic per run: every entry routing the same way
   * fails identically, so {@link partitionControlledFailures} can detect them up
   * front and the engine aggregates their logs instead of repeating one trace
   * per entry.
   */
  private classifyControlledFailure(
    decision: RoutingDecision,
    global: GlobalConfig,
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>,
  ): { reason: ControlledFailureReason; metricsModel: string | null } | null {
    if (decision.moduleId === null) return { reason: 'no-route', metricsModel: null };
    // `freeway` is a virtual target, not a registered module: its dispatchability
    // is decided by live quota at resolution time (which can still produce the
    // 'freeway-no-buckets' controlled failure), never by the module registry.
    if (decision.moduleId === FREEWAY_MODULE_ID) return null;
    const effective = resolveEffectiveModuleConfig(
      decision.moduleId,
      global,
      projectEntries[decision.moduleId],
    );
    const metricsModel =
      decision.modelOverride ??
      (typeof effective.config.model === 'string' ? effective.config.model : null);
    if (!effective.enabled || effective.active === false) {
      return { reason: 'module-disabled', metricsModel };
    }
    if (!this.moduleRegistry.getModule(decision.moduleId)) {
      return { reason: 'module-not-found', metricsModel };
    }
    return null;
  }

  /**
   * Split a run's decisions into dispatchable jobs and controlled pre-dispatch
   * failures (see {@link classifyControlledFailure}), recording EACH failed
   * (entry, targetLanguage) pair in run status so the UI's per-entry error list
   * stays complete. The failures are then logged in aggregate — see
   * {@link logAggregatedControlledFailures}. Only the routable decisions are
   * returned for normal dispatch.
   */
  private partitionControlledFailures(
    status: RunStatus,
    decisions: RoutingDecision[],
    global: GlobalConfig,
    projectEntries: Record<string, ProjectModuleConfigEntry | undefined>,
  ): { routable: RoutingDecision[]; controlled: ControlledFailureGroup[] } {
    const routable: RoutingDecision[] = [];
    // Keyed by `${targetLanguage}\0${reason}` so the aggregated trace is one per
    // (target language, reason); insertion order is preserved for stable logs.
    const groups = new Map<string, ControlledFailureGroup>();
    for (const decision of decisions) {
      const classified = this.classifyControlledFailure(decision, global, projectEntries);
      if (classified === null) {
        routable.push(decision);
        continue;
      }
      const { reason, metricsModel } = classified;
      this.recordFailure(status, decision.entry.id, decision.targetLanguage, reason);
      // Mirror the per-job paths: a module-attributable failure (disabled /
      // not-found) bumps that module's health metric; `no-route` has no module
      // to attribute, so it records none.
      if (decision.moduleId !== null) {
        metricsCollector.recordFailure(decision.moduleId, metricsModel);
      }
      const key = `${decision.targetLanguage}\0${reason}`;
      const group = groups.get(key);
      if (group) {
        group.count++;
        group.entryIds.push(decision.entry.id);
      } else {
        groups.set(key, {
          reason,
          targetLanguage: decision.targetLanguage,
          moduleId: decision.moduleId,
          count: 1,
          entryIds: [decision.entry.id],
        });
      }
    }
    return { routable, controlled: [...groups.values()] };
  }

  /**
   * Emit ONE `translation:failed` warn per (targetLanguage, reason) group, each
   * carrying the aggregate `count` and a how-to-fix `hint`, then persist + emit
   * progress ONCE for the whole batch — rather than once per entry. The
   * per-entry error records were already pushed by
   * {@link partitionControlledFailures}, so this only collapses the logging.
   */
  private logAggregatedControlledFailures(
    runId: string,
    status: RunStatus,
    controlled: ControlledFailureGroup[],
  ): void {
    if (controlled.length === 0) return;
    for (const group of controlled) {
      this.logger.warn('translation:failed', {
        runId,
        targetLanguage: group.targetLanguage,
        error: group.reason,
        count: group.count,
        // The per-entry ids behind this aggregate, so the UI can rebuild the
        // per-entry recovery list and Retry-all from the (collapsed) log stream.
        entryIds: group.entryIds,
        hint: controlledFailureHint(group.reason, group.targetLanguage),
        ...(group.moduleId !== null ? { moduleId: group.moduleId } : {}),
        aggregated: true,
      });
    }
    this.emitProgress(runId, status);
  }

  private emitProgress(runId: string, status: RunStatus): void {
    // `runId` always equals `status.runId` at every call site; the shared helper
    // keys off `status.runId`, keeping the `translation:progress` /
    // `translation:store-update-failed` output byte-identical.
    emitRunProgress({ logger: this.logger, runStore: this.runStore }, 'translation', status);
  }

  private glossaryEntryKey(targetLang: string, entry: StringEntry): string {
    return glossaryEntryKey(targetLang, entry);
  }

  private async fetchGlossariesForBatch(
    projectId: string,
    decisions: RoutingDecision[],
  ): Promise<Map<string, GlossaryGroup>> {
    const glossaryCache = new Map<string, GlossaryGroup>();
    for (const d of decisions) {
      const key = this.glossaryEntryKey(d.targetLanguage, d.entry);
      if (!glossaryCache.has(key)) {
        const rawTerms = await this.glossaryProvider(projectId, d.targetLanguage, d.entry);
        const constantTerms = rawTerms.filter((t) => t.constant);
        const nonConstantTerms = rawTerms.filter((t) => !t.constant);
        glossaryCache.set(key, {
          constantTerms,
          nonConstantTerms,
          glossaryById: new Map(constantTerms.map((t) => [t.id, t])),
        });
      }
    }
    return glossaryCache;
  }

  private findTrivialMatches(
    decisions: RoutingDecision[],
    sourceLanguage: string,
    glossaryCache: Map<string, GlossaryGroup>,
  ): {
    trivialResults: Array<{ decision: RoutingDecision; matcherId: string; translatedText: string }>;
    remaining: RoutingDecision[];
  } {
    const trivialResults: Array<{
      decision: RoutingDecision;
      matcherId: string;
      translatedText: string;
    }> = [];
    const remaining: RoutingDecision[] = [];

    for (const d of decisions) {
      const glossaryForTarget = glossaryCache.get(this.glossaryEntryKey(d.targetLanguage, d.entry));
      let trivialHit: [string, string] | null = runTrivialMatchers(
        d.entry.sourceText,
        sourceLanguage,
        d.targetLanguage,
      );

      if (trivialHit === null && glossaryForTarget) {
        const trimmed = d.entry.sourceText.trim();
        const allTerms = [
          ...glossaryForTarget.constantTerms,
          ...glossaryForTarget.nonConstantTerms,
        ];
        const matchingTerm = allTerms.find(
          (t) => t.source.trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (matchingTerm) {
          const targetTranslation = matchingTerm.translations[d.targetLanguage];
          if (targetTranslation) {
            trivialHit = ['trivial-glossary-exact', targetTranslation];
          }
        }
      }

      if (trivialHit !== null) {
        trivialResults.push({
          decision: d,
          matcherId: trivialHit[0],
          translatedText: trivialHit[1],
        });
      } else {
        remaining.push(d);
      }
    }
    return { trivialResults, remaining };
  }

  private async persistTrivialResult(
    projectId: string,
    status: RunStatus,
    d: RoutingDecision,
    matcherId: string,
    trivialText: string,
  ): Promise<void> {
    const result: TranslationResult = {
      entryId: d.entry.id,
      targetLanguage: d.targetLanguage,
      translatedText: trivialText,
    };
    // A built-in trivial matcher (empty/numeric/URL) never touches a bucket
    // either, so clear any tier a Freeway-routed decision was stamped with.
    const persistDecision: RoutingDecision = { ...d, moduleId: matcherId, freewayTier: undefined };
    await this.persistResult(
      projectId,
      d.entry,
      d.targetLanguage,
      result,
      persistDecision,
      status.runId,
    );
    await this.lqaGate(d.entry, result, projectId, d.targetLanguage, []);
    status.completed++;
    this.logger.info('translation:done', {
      runId: status.runId,
      entryId: d.entry.id,
      targetLanguage: d.targetLanguage,
      moduleId: matcherId,
      context: d.entry.context ?? null,
    });
    this.emitProgress(status.runId, status);
  }
}

export const translationEngine = new TranslationEngine({
  // The process-wide engine is the one that must actually auto-resume parked
  // runs; DI-constructed engines (tests) stay timer-free unless they opt in.
  quotaSweepIntervalMs: TranslationEngine.QUOTA_SWEEP_INTERVAL_MS,
  glossaryProvider: async (projectId, targetLanguage, entry?) => {
    const project = await getProjectStore().loadProject(projectId);
    const glossaryIds = entry?.assignedGlossaryIds ?? project.forcedGlossaryIds ?? [];
    return getGlossaryStore().getTermsForLanguage(
      projectId,
      targetLanguage,
      glossaryIds,
      projectTargetLanguages(project),
    );
  },
  lqaGate: async (entry, result, projectId, targetLanguage, extraIssues) => {
    if (!projectId || !targetLanguage) return undefined;
    // The pipeline merges the engine's mask diagnostics (extraIssues) itself
    // and computes `passed` as "no blocking issues" per project config.
    const lqa = await lqaGate.check(entry, result.translatedText, targetLanguage, {
      projectId,
      extraIssues,
    });
    // Pass ONLY this language's verdict. updateEntry merges it into the fresh
    // on-disk lqaResults under the write lock, so sibling languages are
    // preserved. Spreading the (start-of-run) `entry.lqaResults` snapshot here
    // would let the last language to finish clobber its siblings' fresh
    // verdicts with stale ones.
    await getStringStore().updateEntry(projectId, entry.id, {
      lqaResults: { [targetLanguage]: lqa },
    });
    // The persisted result keeps every issue, but warning-severity issues must
    // never feed retryWithFeedback(), so the engine only sees blocking ones
    // when the gate failed.
    return lqa.passed
      ? lqa
      : { ...lqa, issues: lqa.issues.filter((i) => i.severity !== 'warning') };
  },
});
