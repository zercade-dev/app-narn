/**
 * Shared base for the background "run" engines that wrap an LLM pass behind the
 * RunStore run lifecycle (progress / cancel / history / cost) and the M9 JobQueue:
 *
 *  - M25 JudgeEngine        (LLM-as-judge over a completed translation run)
 *  - M26 SourceReviewEngine (LLM review of the source text)
 *  - M28 GlossaryGenEngine  (LLM glossary suggestion)
 *  - M29 CategoryGenEngine  (LLM category suggestion)
 *
 * All four shared, almost line-for-line, the same machinery: the
 * `runs`/`controllers`/detail-buffer maps; `getStatus`; `cancel` (mark Cancelled
 * → abort → drain queue → finalize cost → flush detail → delete buffers →
 * persist); the run-status construction; the terminal flip in a batch's
 * `finally`; and `recordFailure` / `emitProgress`. Subclasses keep only their
 * own scope/selection (`enqueue`), per-batch body, and `saveDetail` hook.
 *
 * Buffer / cancel contract (the once-fixed race, audit server-pipeline-2):
 * detail buffers are SHARED BY REFERENCE with the in-flight batch tasks. Both
 * terminal paths ({@link finalizeTerminal} and {@link cancel}) therefore (a)
 * abort + `queue.cancelRun` and await the cost finalize FIRST, giving any
 * settled-but-mid-loop task the chance to observe `Cancelled` and stop pushing,
 * then (b) flush from the LIVE buffer, and only AFTER the flush delete the
 * buffer from the map. A record pushed before the flush is always persisted; a
 * push after `Cancelled` is a no-op by the subclass's per-item guard.
 */
import { randomUUID } from 'node:crypto';
import {
  type BatchDispatchOptions,
  type BatchGroupingDimension,
  type GlobalConfig,
  type JudgeLogEntry,
  type Project,
  RunStatusCode,
  type RunStatus,
  type StringEntry,
  type TranslationModule,
  type TranslationUsage,
  batchGroupKey,
  groupAndPack,
  resetRateLimiters,
  resolveBatchGrouping,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import type { RunStore } from '../../storage/types.js';
import { getRunStore } from '../../storage/registry.js';
import { getCurrentTenant } from '../../storage/pg/tenant-context.js';
import { sanitizeLogObject } from '../M16-credential-store.js';
import {
  bucketRateLimits,
  coolBucket,
  recordDispatch,
  type BucketSourceDeps,
} from '../M32/bucket-source.js';
import {
  isAbortError,
  isRateLimitError,
  rateLimitCooldownMs,
  withRateLimitRetry,
} from './errors.js';
import type { ModuleLogFn } from './module-selection.js';
import { JobQueue } from './queue.js';
import { awaitAllWithTimeout, SettledTracker } from './run-settled.js';
import { emitRunProgress, recordRunFailure } from './run-status-helpers.js';
import { accumulateUsage, finalizeUsageCosts, type PricingProvider } from './usage-pricing.js';

export interface LoggerLike {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Sanitizes LLM-produced free text before it is persisted (inside an LQA issue,
 * a verdict record, or an entry's source-review). Always collapses control
 * characters and runs of whitespace to single spaces and trims. When `maxLen` is
 * given the result is also capped to that length; when it is omitted the cleaned
 * text is returned in full (no truncation). Shared by the AI-review engines
 * (M25/M26), which keep the cleanup but render the full AI explanation in the UI
 * rather than a sentence cut off mid-way.
 */
export function sanitizeLLMText(text: string, maxLen?: number): string {
  const cleaned = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLen === undefined ? cleaned : cleaned.slice(0, maxLen);
}

/**
 * What {@link BackgroundRunEngine.enqueueBatched} hands the subclass's `dispatch`
 * callback to wire each packed batch onto the queue. `records` is the live detail
 * buffer (shared by reference with the queued tasks); `dispatchOptions` tells the
 * provider not to re-chunk a pre-grouped batch.
 */
export interface BatchDispatchContext<TItem, TRecord> {
  runId: string;
  projectId: string;
  module: TranslationModule;
  moduleId: string;
  entriesById: Map<string, StringEntry>;
  records: TRecord[];
  batches: TItem[][];
  dispatchOptions: BatchDispatchOptions | undefined;
}

/**
 * The engine-specific bits {@link BackgroundRunEngine.enqueueBatched} needs to run
 * the shared enqueue orchestration. `TItem` must carry an `entryId` so the shared
 * related-entry grouping can key it via `entriesById`.
 */
export interface EnqueueBatchedOptions<TItem extends { entryId: string }, TRecord> {
  projectId: string;
  /** Loads the project + global config (subclass owns the stores). */
  loadContext: () => Promise<{ project: Project; global: GlobalConfig }>;
  /**
   * Selects the capable module/model; module logs are teed to `logSink`. May be
   * async: resolving a free-tier target reads the quota ledger.
   */
  selectModule: (
    project: Project,
    global: GlobalConfig,
    logSink: ModuleLogFn | undefined,
  ) =>
    | { module: TranslationModule; moduleId: string }
    | Promise<{ module: TranslationModule; moduleId: string }>;
  /** Loads + scope-filters entries and builds the per-batch items + `entriesById`. */
  buildItems: (
    project: Project,
    global: GlobalConfig,
    module: TranslationModule,
    moduleId: string,
  ) => Promise<{ items: TItem[]; entriesById: Map<string, StringEntry> }>;
  /** Extra run-status fields (`kind` + the engine's summary object). */
  summary: Partial<RunStatus> & Pick<RunStatus, 'kind'>;
  /** Max items per provider batch. */
  batchSize: number;
  /** Per-run related-entry grouping override; absent ⇒ project/workspace. */
  batchGroupingOverride?: BatchGroupingDimension;
  /** Per-run ignore-batch-size-limit override; absent ⇒ project/workspace. */
  ignoreBatchSizeLimitOverride?: boolean;
  /**
   * Per-run custom batch-size override (entries per provider call). `0` means
   * unlimited: every item is sent as one batch. A positive value caps `batches`
   * regardless of `batchSize`. When present, forces related-entry footprint
   * grouping off for this run (mutually exclusive with `batchGroupingOverride`
   * on the wire — the dialog sends one or the other).
   */
  customBatchSizeOverride?: number;
  /** Wires each packed batch onto the queue (owns any per-run side-channel). */
  dispatch: (ctx: BatchDispatchContext<TItem, TRecord>) => void;
}

/** The free-tier bucket a background run spends against, plus its test seams. */
export interface FreewayBatchBinding {
  bucketKey: string;
  deps?: BucketSourceDeps;
}

/**
 * The engine-specific bits {@link BackgroundRunEngine.runBatchWithUsage} needs to
 * run the shared per-batch envelope. `TResult` carries the per-item `usage`.
 */
export interface RunBatchOptions<TItem, TResult> {
  runId: string;
  moduleId: string;
  batch: TItem[];
  dispatchOptions: BatchDispatchOptions | undefined;
  /** Invokes the provider for the batch (judge / reviewSource). */
  call: (signal: AbortSignal | undefined) => Promise<TResult[]>;
  /** The (entryId, targetLanguage?) key recorded when the whole batch fails. */
  failureKey: (item: TItem) => { entryId: string; targetLanguage?: string };
  /** The per-result usage to fold (e.g. `(r) => r.usage`). */
  usageOf: (result: TResult) => TranslationUsage | undefined;
  /**
   * Set when the run is bound to a free-tier bucket: every provider call this
   * batch makes is debited against that bucket's quota ledger.
   */
  freeway?: FreewayBatchBinding;
  /**
   * Re-selects a free-tier bucket for this batch. Called at most ONCE per
   * batch, and only after a rate limit outlived the retries on a Freeway-bound
   * batch: the engine re-selects, rebuilds its module and swaps the reference
   * {@link RunBatchOptions.call} dispatches through, then returns the NEW
   * binding. `undefined` means nothing is eligible — the batch then fails
   * exactly as it did before the hop existed.
   */
  freewayReroute?: () => Promise<FreewayBatchBinding | undefined>;
  /** Handles one result against the live `status` (persist + push, or recordFailure). */
  onResult: (result: TResult, status: RunStatus) => Promise<void>;
  /** Post-terminal hook forwarded to {@link finalizeTerminal} (e.g. M25 stamp). */
  onComplete?: (status: RunStatus) => Promise<void>;
}

/**
 * `TRecord` is the per-item detail record the run buffers and persists to its
 * sidecar via {@link BackgroundRunEngine.saveDetail}.
 */
export abstract class BackgroundRunEngine<TRecord> {
  /**
   * Grace window before a terminal run is evicted from the in-memory maps — long
   * enough that any client polling {@link getStatus} sees the final status first;
   * afterwards the durable RunStore serves it.
   */
  private static readonly TERMINAL_EVICT_GRACE_MS = 5 * 60_000;
  /** Hard cap on tracked runs; the oldest-finished terminal runs are evicted past it. */
  private static readonly MAX_TRACKED_RUNS = 500;
  protected readonly queue: JobQueue;
  protected readonly runs = new Map<string, RunStatus>();
  protected readonly controllers = new Map<string, AbortController>();
  // Per-run detail buffers, registered in startRun so cancel() can flush whatever
  // accumulated before the interrupt (the completion path flushes the same
  // buffers). Cleared in both terminal paths. See the contract note above.
  protected readonly detailBuffers = new Map<string, TRecord[]>();
  // Per-run verbose log buffers (used by the AI-review engines M25/M26 when a run
  // is verbose). Registered in enqueue via registerLogs, flushed alongside the
  // detail sidecar, and cleared in both terminal paths. Empty for engines that
  // don't capture a log (their deletes here are harmless no-ops).
  protected readonly logBuffers = new Map<string, JudgeLogEntry[]>();
  // Per-run "settled" deferreds + in-flight detached-task counts. A
  // settled deferred (registered in startRun, resolved once the run is terminal
  // AND no detached task is still running) lets cloud account deletion await a
  // run's REAL completion — past every late store write in a task's `finally` —
  // before teardownTenant removes project_members. New surface only: the hot
  // dispatch/translate path is unchanged; these are populated/resolved at
  // existing lifecycle points (startRun / runBatchWithUsage / finalizeTerminal /
  // cancel). See {@link cancelAllForProject}.
  private readonly tracker = new SettledTracker();
  // Resolve the run store lazily so a later setRunStore() (e.g. per-test
  // injection) is honored even by these module-level engine singletons, which
  // capture their deps at import time. An eager `this.runStore = opts.runStore`
  // (with a `?? getRunStore()` constructor default) would bind the store at
  // construction and defeat the test seam, so the optional injected store is
  // stashed and the getter falls back to the live registry at call-time.
  private readonly _runStore?: RunStore;
  protected get runStore(): RunStore {
    return this._runStore ?? getRunStore();
  }
  protected readonly logger: LoggerLike;
  protected readonly pricing: PricingProvider | undefined;

  /** Log-key prefix for this engine, e.g. `judge` → `judge:progress`. */
  protected abstract readonly logPrefix: string;

  constructor(opts: {
    concurrency: number;
    /** Optional injected run store (tests); absent ⇒ the lazy `getRunStore()`. */
    runStore?: RunStore;
    logger: LoggerLike;
    /** Optional; every current subclass (M9, M25, M26, M28, M29) supplies one. */
    pricing?: PricingProvider;
  }) {
    this.queue = new JobQueue(opts.concurrency);
    this._runStore = opts.runStore;
    this.logger = opts.logger;
    this.pricing = opts.pricing;
  }

  /**
   * In-memory run status only (these engines keep run state in process and lose
   * it on restart — deliberate, single-user semantics). A run left `running` in
   * the run store after a restart is therefore invisible here; persistent status
   * polling must go through the RunStore, which is the source of truth (the
   * cancel route already does this via `runStore.forceCancel`). Kept
   * synchronous so route/test callers compile unchanged.
   */
  getStatus(runId: string): RunStatus | undefined {
    return this.runs.get(runId);
  }

  // Deliberate mirror of M9-translation-engine.ts:cancel — apply behavioral fixes to both.
  async cancel(runId: string): Promise<void> {
    const status = this.runs.get(runId);
    if (!status || status.status !== RunStatusCode.Running) return;
    status.status = RunStatusCode.Cancelled;
    status.finishedAt = Date.now();
    this.controllers.get(runId)?.abort();
    this.controllers.delete(runId);
    this.queue.cancelRun(runId);
    if (this.pricing) await finalizeUsageCosts(status, this.pricing);
    // Persist whatever detail accumulated before the cancel so the partial run's
    // per-item findings stay inspectable, rather than discarding the work the
    // pass already did. Flush from the live buffer, then drop it.
    await this.flushDetail(status.projectId, runId);
    this.detailBuffers.delete(runId);
    this.clearExtraBuffers(runId);
    await this.runStore.updateRun(status.projectId, status);
    // cancel() only SIGNALS; a detached task may still be mid-flight and
    // will resolve the deferred when it finishes. Resolve here too for the case
    // where no task was in flight (nothing left to write).
    this.maybeResolveSettled(runId);
  }

  /**
   * Drain surface. Increment the in-flight detached-task count for a run
   * (called at the top of {@link runBatchWithUsage}); the matching
   * {@link taskEnded} runs in its `finally`.
   */
  private taskStarted(runId: string): void {
    this.tracker.taskStarted(runId);
  }

  /** Decrement the in-flight task count; resolve the settled deferred if drained. */
  private taskEnded(runId: string): void {
    this.tracker.taskEnded(runId);
    this.maybeResolveSettled(runId);
  }

  /**
   * Idempotently arm a run's settled deferred (create it only if absent).
   * Called by {@link startRun} before any task is queued AND by {@link trackTask},
   * so a run whose detached task never went through `startRun` (M29 category-gen,
   * which uses {@link createRunStatus} directly) still gets a real deferred that
   * resolves on task end rather than one that never exists.
   */
  private armSettled(runId: string): void {
    this.tracker.arm(runId);
  }

  /**
   * Bracket a bespoke detached task (M28 glossary-gen, M29 category-gen)
   * with the same settled-deferred drain accounting {@link runBatchWithUsage} uses
   * for the queue-backed engines: idempotently arm the deferred, count the task in,
   * and count it out in `finally` (which resolves the deferred once the run is
   * terminal and no task is still executing — i.e. AFTER the task's own `finally`
   * store write). Used ONLY by M28/M29; the `runBatchWithUsage` engines
   * (M9/M25/M26/M30) keep their own taskStarted/taskEnded bracket and must NOT
   * route through here, or a task would be double-counted.
   */
  protected async trackTask(runId: string, body: () => Promise<void>): Promise<void> {
    this.armSettled(runId);
    this.taskStarted(runId);
    try {
      await body();
    } finally {
      this.taskEnded(runId);
    }
  }

  /**
   * Resolve a run's settled deferred once it is TERMINAL (no longer Running/
   * Paused) AND no detached task is still executing — the invariant that no
   * further store write will occur for the run. Idempotent (the deferred guards
   * double-resolve); a no-op while the run is still active or a task is in flight.
   */
  private maybeResolveSettled(runId: string): void {
    const status = this.runs.get(runId);
    // The status predicate stays in the engine (base: Running/Paused are the
    // non-terminal statuses); the tracker owns only the drained-and-terminal
    // resolve mechanics.
    const nonTerminal =
      status?.status === RunStatusCode.Running || status?.status === RunStatusCode.Paused;
    this.tracker.maybeResolve(runId, nonTerminal);
  }

  /**
   * Cancel every non-terminal run this engine holds for `projectId` and
   * await their REAL settlement (each run's detached tasks finishing their
   * `finally`), bounded by `timeoutMs`. Used by cloud account deletion so no run
   * store write lands after `teardownTenant` removes `project_members`. Never
   * throws: on timeout it returns `timedOut: true` and leaves the straggler to
   * teardown's convergence-loop backstop.
   */
  async cancelAllForProject(
    projectId: string,
    opts?: { timeoutMs?: number },
  ): Promise<{ cancelled: string[]; timedOut: boolean }> {
    // Base engines have no per-project queue: a run is only ever Running here.
    const targets: string[] = [];
    for (const [runId, status] of this.runs) {
      if (status.projectId === projectId && status.status === RunStatusCode.Running) {
        targets.push(runId);
      }
    }
    // Capture the settled promises BEFORE cancelling (cancel may resolve+drop a
    // deferred synchronously when nothing is in flight).
    const promises = this.tracker.capturePromises(targets);
    for (const runId of targets) {
      await this.cancel(runId).catch(() => {});
    }
    const timedOut = await awaitAllWithTimeout(promises, opts?.timeoutMs);
    return { cancelled: targets, timedOut };
  }

  /**
   * Bound the in-memory run maps (mirrors M9-translation-engine.ts's own copy).
   * They are a hot cache over the durable RunStore, so a terminal run can be
   * forgotten once clients have had a grace window to observe its final status
   * ({@link getStatus} reads this map; the runs HTTP routes read the store
   * instead). Evicts terminal runs finished more than {@link
   * BackgroundRunEngine.TERMINAL_EVICT_GRACE_MS} ago; if the map still exceeds
   * {@link BackgroundRunEngine.MAX_TRACKED_RUNS}, evicts the oldest-finished
   * terminal runs as a backstop. NON-terminal (active/queued) runs are never
   * evicted, and an in-flight lookup for an evicted run falls back to the
   * store, so nothing is lost.
   */
  // Deliberate mirror of M9-translation-engine.ts:evictTerminalRuns — apply behavioral fixes to both.
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
      if (now - finishedAt >= BackgroundRunEngine.TERMINAL_EVICT_GRACE_MS) {
        this.forgetRun(runId);
      } else {
        terminal.push({ runId, finishedAt });
      }
    }
    const over = this.runs.size - BackgroundRunEngine.MAX_TRACKED_RUNS;
    if (over > 0) {
      terminal.sort((a, b) => a.finishedAt - b.finishedAt);
      for (let i = 0; i < over && i < terminal.length; i++) {
        this.forgetRun(terminal[i].runId);
      }
    }
  }

  /** Drop every in-memory trace of a (terminal) run across the sidecar maps. */
  // Deliberate mirror of M9-translation-engine.ts:forgetRun — apply behavioral fixes to both.
  private forgetRun(runId: string): void {
    this.runs.delete(runId);
    this.detailBuffers.delete(runId);
    this.controllers.delete(runId);
    this.clearExtraBuffers(runId);
    // Resolve a dangling settled deferred before dropping it so any drain
    // still awaiting this (now-forgotten, terminal) run is never left hanging.
    this.tracker.forget(runId);
  }

  /**
   * Builds the initial run status and registers it in memory + the run store.
   * `extra` carries the engine-specific summary/kind fields. The run defaults to
   * Completed when `total === 0` (the caller short-circuits the empty scope) and
   * Running otherwise; pass `status` in `extra` to override (e.g. M29 forces
   * Running while its real `total` is still unknown).
   */
  protected async createRunStatus(
    projectId: string,
    total: number,
    extra: Partial<RunStatus> & Pick<RunStatus, 'kind'>,
  ): Promise<RunStatus> {
    // A fresh run should not inherit rate-limiter backoff state earned by a
    // previous, unrelated run against the same provider. Shared by every
    // BackgroundRunEngine subclass (judge, source-review, glossary-gen,
    // category-gen), mirroring M9 TranslationEngine's own startRun() reset.
    resetRateLimiters();
    const runId = randomUUID();
    const status: RunStatus = {
      runId,
      projectId,
      createdBy: getCurrentTenant()?.userId,
      status: total === 0 ? RunStatusCode.Completed : RunStatusCode.Running,
      total,
      completed: 0,
      failed: 0,
      startedAt: Date.now(),
      errors: [],
      ...extra,
    };
    // Evict long-terminal runs from the in-memory maps before registering
    // this one, so memory stays bounded over the process lifetime.
    this.evictTerminalRuns();
    this.runs.set(runId, status);
    await this.runStore.updateRun(projectId, status);
    return status;
  }

  /**
   * Registers the abort controller and detail buffer for a Running run and warms
   * the pricing feed. Call once after {@link createRunStatus} when `total > 0`,
   * before queuing the run's tasks. Returns the live buffer shared by reference
   * with the queued tasks.
   */
  protected startRun(runId: string, projectId: string, total: number): TRecord[] {
    this.controllers.set(runId, new AbortController());
    // Arm this run's settled deferred before any task is queued so a
    // drain that arrives mid-flight always finds it. Idempotent (see
    // {@link armSettled}) — trackTask's own arm is then a no-op here.
    this.armSettled(runId);
    const records: TRecord[] = [];
    this.detailBuffers.set(runId, records);
    this.logger.info(`${this.logPrefix}:queued`, { runId, projectId, total });
    // Warm the pricing feed in the background so cost finalization at run
    // completion finds a loaded cache.
    if (this.pricing) void this.pricing.ensure().catch(() => {});
    return records;
  }

  /**
   * The terminal flip shared by every batch's `finally`: when the run is still
   * Running and all items have settled, mark it Completed, finalize cost, flush
   * the detail sidecar (before flipping terminal so a reader that sees
   * "completed" can always load it), delete the buffers, persist, and run the
   * optional `onComplete` post-hook (e.g. M25's source-run stamp).
   */
  // Deliberate mirror of M9-translation-engine.ts:finalizeTranslationTerminal — apply behavioral fixes to both.
  protected async finalizeTerminal(
    status: RunStatus,
    onComplete?: (status: RunStatus) => Promise<void>,
  ): Promise<void> {
    const runId = status.runId;
    if (status.status !== RunStatusCode.Running) return;
    if (status.completed + status.failed < status.total) return;
    status.status = RunStatusCode.Completed;
    status.finishedAt = Date.now();
    this.controllers.delete(runId);
    this.queue.cancelRun(runId);
    if (this.pricing) await finalizeUsageCosts(status, this.pricing);
    await this.flushDetail(status.projectId, runId);
    this.detailBuffers.delete(runId);
    this.clearExtraBuffers(runId);
    // The final terminal-state persist is best-effort (a failed write can't
    // un-finalize the in-memory run), but a swallowed failure means the run store
    // never reflects the terminal status — surface it instead of dropping it.
    await this.runStore.updateRun(status.projectId, status).catch((err: unknown) => {
      this.logger.warn(`${this.logPrefix}:finalize-store-update-failed`, {
        runId,
        error: toErrorMessage(err),
      });
    });
    if (onComplete) await onComplete(status);
    // The run's last natural store write is done; resolve its settled
    // deferred once no detached task is still executing.
    this.maybeResolveSettled(runId);
    // The run just went terminal; drop any long-terminal siblings.
    this.evictTerminalRuns();
  }

  /**
   * Drops any per-run buffers kept alongside the detail buffer once a run is
   * terminal — currently the verbose log buffer (a no-op delete for engines that
   * never registered one). Subclasses with additional buffers override and call
   * `super.clearExtraBuffers(runId)`. Called after the detail buffer is deleted
   * in both terminal paths.
   */
  protected clearExtraBuffers(runId: string): void {
    this.logBuffers.delete(runId);
  }

  /**
   * Builds the per-run module log sink: tees each module log line to the server
   * console AND a fresh buffer (credential-redacted), plus that buffer to
   * register via {@link registerLogs} once the run starts. Always attached to
   * the module (`log` config) so a module whose CONFIG sets `verbose: true`
   * is captured too — a non-verbose module never calls it, leaving the buffer
   * empty and the sidecar flush a no-op. The per-run verbose flag only forces
   * the module's verbose on (see selectCapableModule).
   */
  protected buildLogSink(): {
    logSink: ModuleLogFn;
    logs: JudgeLogEntry[];
  } {
    const logs: JudgeLogEntry[] = [];
    const logSink: ModuleLogFn = (level, message, meta) => {
      this.logger[level](message, meta);
      logs.push({
        at: Date.now(),
        level,
        message,
        ...(meta ? { meta: sanitizeLogObject(meta) } : {}),
      });
    };
    return { logSink, logs };
  }

  /** Registers a run's verbose log buffer so the terminal paths can flush it. */
  protected registerLogs(runId: string, logs: JudgeLogEntry[]): void {
    this.logBuffers.set(runId, logs);
  }

  /**
   * Flushes a run's accumulated verbose log lines to its sidecar (best-effort),
   * if any were captured. Called by the subclass's {@link saveDetail} before the
   * detail sidecar so both writes complete before the run is reported terminal.
   */
  protected async flushLogs(projectId: string, runId: string): Promise<void> {
    const logs = this.logBuffers.get(runId);
    if (logs && logs.length > 0) {
      // The verbose-log sidecar is best-effort, but a swallowed write loses
      // the run's captured prompt/response log silently — warn rather than discard.
      await this.runStore.saveJudgeLogs(projectId, runId, logs).catch((err: unknown) => {
        this.logger.warn(`${this.logPrefix}:save-logs-failed`, {
          runId,
          error: toErrorMessage(err),
        });
      });
    }
  }

  /**
   * Finalizes a run whose scope is empty: stamps `finishedAt` and persists the
   * (already-Completed) status, then returns the terminal envelope the enqueue
   * caller hands back to its route. `createRunStatus` already set the status to
   * Completed for `total === 0`; no controller/buffer is registered, so there is
   * nothing for a racing cancel to flush. Shared by M25/M26.
   */
  protected async finishEmptyRun(
    status: RunStatus,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    status.finishedAt = Date.now();
    await this.runStore.updateRun(status.projectId, status);
    return { runId: status.runId, total: 0, status: RunStatusCode.Completed };
  }

  /**
   * The shared enqueue orchestration for the queue-backed AI-review engines
   * (M25/M26): an empty scope short-circuits to a Completed run, otherwise the run
   * starts and the subclass's `dispatch` queues each packed batch. The await
   * ordering is preserved exactly from the original per-engine `enqueue`:
   * loadContext → buildLogSink → selectModule → buildItems → createRunStatus →
   * (empty ⇒ finishEmptyRun) → startRun → registerLogs → groupAndPack → dispatch.
   */
  protected async enqueueBatched<TItem extends { entryId: string }>(
    opts: EnqueueBatchedOptions<TItem, TRecord>,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    const { projectId } = opts;
    const { project, global } = await opts.loadContext();

    // The module's log output is captured into this buffer (persisted to a
    // sidecar on completion); a module that never logs leaves it empty.
    const { logSink, logs } = this.buildLogSink();

    const { module, moduleId } = await opts.selectModule(project, global, logSink);

    const { items, entriesById } = await opts.buildItems(project, global, module, moduleId);

    const status = await this.createRunStatus(projectId, items.length, opts.summary);
    const runId = status.runId;
    if (items.length === 0) {
      return this.finishEmptyRun(status);
    }

    const records = this.startRun(runId, projectId, items.length);
    this.registerLogs(runId, logs);

    // Related-entry grouping (by glossary/category): items sharing a footprint
    // are processed together. dimension='none' degrades to plain size chunking in
    // input order. Per-run override → project → workspace → none. A
    // `customBatchSizeOverride` takes priority — it forces dimension='none' and
    // drives `ignoreSizeLimit`/the effective cap directly.
    const resolvedGrouping = resolveBatchGrouping(project, global.settings);
    const customBatchSize = opts.customBatchSizeOverride;
    const dimension =
      customBatchSize !== undefined
        ? 'none'
        : (opts.batchGroupingOverride ?? resolvedGrouping.dimension);
    const ignoreSizeLimit =
      customBatchSize !== undefined
        ? customBatchSize === 0
        : (opts.ignoreBatchSizeLimitOverride ?? resolvedGrouping.ignoreSizeLimit);
    const effectiveBatchSize =
      customBatchSize !== undefined && customBatchSize > 0 ? customBatchSize : opts.batchSize;
    const batches = groupAndPack(items, effectiveBatchSize, ignoreSizeLimit, (item) =>
      batchGroupKey(entriesById.get(item.entryId) ?? {}, dimension),
    );
    // When grouping is active, batches are already arranged; tell the provider
    // not to re-chunk them (which could tear a footprint apart). The same
    // applies when a custom batch size was set — the batches above are already
    // sized exactly as requested.
    const dispatchOptions: BatchDispatchOptions | undefined =
      dimension !== 'none' || customBatchSize !== undefined ? { ignoreSizeLimit: true } : undefined;

    opts.dispatch({
      runId,
      projectId,
      module,
      moduleId,
      entriesById,
      records,
      batches,
      dispatchOptions,
    });

    return { runId, total: items.length, status: RunStatusCode.Running };
  }

  /**
   * The shared per-batch envelope for the queue-backed AI-review engines
   * (M25/M26): the cancel guard, the provider call (with the abort/whole-batch
   * failure handling), the usage fold, the cancel-guarded per-result loop, and
   * the `finally { emitProgress; finalizeTerminal }` terminal flip.
   *
   * Await ordering and control flow are preserved from the original inline
   * `processBatch`: every early `return` (cancelled/aborted, whole-batch
   * failure, per-result cancel guard) and the single `finally` still hold. The
   * one addition is the bounded re-route hop (see
   * {@link RunBatchOptions.freewayReroute}), which is reachable only from a
   * rate-limited free-tier batch and leaves every other failure path untouched.
   *
   * This thin wrapper only brackets the detached task with {@link
   * taskStarted}/{@link taskEnded} (for the settled-deferred drain) — the
   * real per-batch work lives unchanged in {@link runBatchWithUsageInner}.
   */
  protected async runBatchWithUsage<TItem, TResult>(
    opts: RunBatchOptions<TItem, TResult>,
  ): Promise<void> {
    const runId = opts.runId;
    this.taskStarted(runId);
    try {
      await this.runBatchWithUsageInner(opts);
    } finally {
      this.taskEnded(runId);
    }
  }

  private async runBatchWithUsageInner<TItem, TResult>(
    opts: RunBatchOptions<TItem, TResult>,
  ): Promise<void> {
    const { runId, moduleId, batch } = opts;
    const status = this.runs.get(runId);
    if (!status || status.status === RunStatusCode.Cancelled) return;
    const signal = this.controllers.get(runId)?.signal;

    try {
      let results: TResult[];
      // The bucket this batch currently spends against; a re-route swaps it for
      // the next hop. Undefined for an ordinary (non-free-tier) run.
      let binding = opts.freeway;
      for (let hop = 0; ; hop++) {
        try {
          // Rate-limit-aware retry shared with M9's dispatch paths: a typed
          // 429 (RateLimitError, incl. quota-phrased ones) waits the provider
          // cool-down (clamped) and re-sends the WHOLE batch instead of
          // failing every item on the first hit. Any other error — and the
          // final exhausted attempt — falls through to the catch below
          // unchanged. CancelledError from a mid-wait cancel is named
          // 'AbortError', so the existing isAbortError guard swallows it.
          results = await withRateLimitRetry(
            async () => {
              const attempt = await opts.call(signal);
              // One provider call = one free-tier request, debited as soon as it
              // returns (a retried attempt debits again, on its own return).
              await this.recordFreewayDispatch(binding, attempt.map(opts.usageOf));
              return attempt;
            },
            {
              signal,
              isCancelled: () => (status.status as RunStatusCode) === RunStatusCode.Cancelled,
              onRetry: (attempt, delayMs) =>
                this.logger.warn(`${this.logPrefix}:rate-limited - retrying batch`, {
                  runId,
                  moduleId,
                  attempt,
                  delayMs,
                }),
            },
          );
          break;
        } catch (err) {
          if (isAbortError(err) || signal?.aborted) return;
          // A free-tier bucket that rate-limited us through every retry is out of
          // capacity, not merely unlucky: cool it so the pool stops ranking it
          // ready for the next run.
          if (isRateLimitError(err)) await this.coolFreewayBucket(binding, err);
          // One re-route hop: a free-tier run whose bucket is spent moves to a
          // sibling bucket instead of dying while healthy ones idle. Only for a
          // Freeway-bound batch, only on a rate limit, and only once — a second
          // exhaustion (or nothing eligible to move to) fails the batch exactly
          // as it always has.
          if (hop === 0 && binding && isRateLimitError(err) && opts.freewayReroute) {
            // The hop must never be able to skip the failure block below: a
            // re-selection that throws leaves these items unrecorded, and the
            // queue swallows the rejection, so the run would report them
            // complete. Engines log their own reason before returning here.
            let next: FreewayBatchBinding | undefined;
            try {
              next = await opts.freewayReroute();
            } catch {
              next = undefined;
            }
            if (next) {
              this.logger.info(`${this.logPrefix}:freeway-rerouted`, {
                runId,
                from: binding.bucketKey,
                to: next.bucketKey,
                reason: 'rate-limit',
              });
              binding = next;
              continue;
            }
          }
          // This message is persisted to the run sidecar (on the /data volume) and
          // served via the runs API, so value-scrub (live vault values) on top of
          // toErrorMessage's pattern redaction — a generic-ai custom key is value-only
          // detectable and would slip past the pattern stripper alone.
          const message = sanitizeLogObject({ m: toErrorMessage(err) }).m;
          for (const item of batch) {
            this.recordFailure(status, opts.failureKey(item), message);
          }
          this.logger.warn(`${this.logPrefix}:batch-failed`, { runId, moduleId, error: message });
          return;
        }
      }

      accumulateUsage(status, moduleId, results.map(opts.usageOf));

      for (const result of results) {
        if ((status.status as RunStatusCode) === RunStatusCode.Cancelled || signal?.aborted) {
          return;
        }
        await opts.onResult(result, status);
      }
    } finally {
      this.emitProgress(status);
      await this.finalizeTerminal(status, opts.onComplete);
    }
  }

  /**
   * Debit one provider call against the run's free-tier bucket. No-op for a run
   * that isn't bound to one. Never fails the batch: a ledger write that threw
   * here would fail items whose provider call actually succeeded.
   */
  protected async recordFreewayDispatch(
    binding: FreewayBatchBinding | undefined,
    usages: readonly (TranslationUsage | undefined)[],
  ): Promise<void> {
    if (!binding) return;
    let inputTokens = 0;
    let outputTokens = 0;
    let chars = 0;
    for (const usage of usages) {
      if (!usage) continue;
      inputTokens += usage.inputTokens ?? 0;
      outputTokens += usage.outputTokens ?? 0;
      // `characters` is the provider-billed count; the source-text total is the
      // honest stand-in for token-billed providers.
      chars += usage.characters ?? usage.sourceChars ?? 0;
    }
    try {
      await recordDispatch(
        binding.bucketKey,
        Date.now(),
        { inputTokens, outputTokens, chars },
        binding.deps,
      );
    } catch (err) {
      this.logger.warn(`${this.logPrefix}:freeway-ledger-write-failed`, {
        bucketKey: binding.bucketKey,
        error: toErrorMessage(err),
      });
    }
  }

  /**
   * Cool the run's free-tier bucket after a rate limit outlived its retries, so
   * the pool stops offering it until it recovers. Same semantics as the
   * translate path's dispatch failover: a per-minute limit sent without a
   * `Retry-After` cools for just over a minute rather than until the daily
   * reset, and the cool is pool-scoped, since a provider with an account-wide
   * allowance rate-limits every one of its models at once. No-op for a run that
   * isn't bound to a bucket; never fails the batch (the items are already
   * failing on the provider error — a ledger write must not change that).
   */
  private async coolFreewayBucket(
    binding: FreewayBatchBinding | undefined,
    err: unknown,
  ): Promise<void> {
    if (!binding) return;
    try {
      await coolBucket(
        binding.bucketKey,
        Date.now(),
        rateLimitCooldownMs(err, bucketRateLimits(binding.bucketKey)),
        binding.deps,
        'pool',
      );
    } catch (writeErr) {
      this.logger.warn(`${this.logPrefix}:freeway-ledger-write-failed`, {
        bucketKey: binding.bucketKey,
        error: toErrorMessage(writeErr),
      });
    }
  }

  /**
   * Writes the run's accumulated detail records to its sidecar via the
   * subclass's {@link saveDetail}. Best-effort and idempotent: used by both the
   * natural completion path and {@link cancel}. A run with no buffered records
   * writes an empty sidecar, which readers treat identically to a missing one.
   */
  protected async flushDetail(projectId: string, runId: string): Promise<void> {
    const records = this.detailBuffers.get(runId);
    // The per-item detail sidecar is best-effort, but a swallowed write
    // means a "completed" run can't load its findings — warn rather than discard.
    if (records)
      await this.saveDetail(projectId, runId, records).catch((err: unknown) => {
        this.logger.warn(`${this.logPrefix}:save-detail-failed`, {
          runId,
          error: toErrorMessage(err),
        });
      });
  }

  protected emitProgress(status: RunStatus): void {
    emitRunProgress({ logger: this.logger, runStore: this.runStore }, this.logPrefix, status);
  }

  protected recordFailure(
    status: RunStatus,
    item: { entryId: string; targetLanguage?: string },
    message: string,
  ): void {
    recordRunFailure(status, item, message);
  }

  /** Persist the run's per-item detail records to the right run-store sidecar. */
  protected abstract saveDetail(
    projectId: string,
    runId: string,
    records: TRecord[],
  ): Promise<void>;
}
