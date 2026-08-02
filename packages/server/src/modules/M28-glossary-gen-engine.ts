/**
 * M28 — GlossaryGenEngine
 *
 * AI glossary generation as a non-blocking background run. Asks an LLM module to
 * suggest glossaries (named groups of recurring custom terms and proper nouns)
 * from the project's source text, the same work `generateGlossary` does inline —
 * but modeled as a run persisted via the RunStore and executed on M9's JobQueue, so the
 * Activity tab gets progress/cancel/history for free and the user can close the
 * dialog or navigate away while it runs. The suggestions are stored in a
 * per-run sidecar (`glossary-suggestions-<runId>.json`) so they survive after
 * the dialog closes; the UI loads them on completion and runs the existing
 * review/accept/apply flow unchanged.
 *
 * Shares the run/queue/sidecar/cancel machinery with the other background
 * engines via the {@link BackgroundRunEngine} base (M9/run-engine.ts). The
 * underlying `suggestGlossaries` call merges glossary names across its own
 * internal chunks and so needs the whole entry set, but it reports per-batch
 * progress through an `onProgress` callback, so `completed` advances steadily as
 * each chunk settles rather than jumping 0→total at the end. The terminal flip
 * is still custom (one queued task, plus the "mark Failed if the sidecar write
 * fails" rule) rather than the base's per-batch `finalizeTerminal`.
 */
import { type GlossarySuggestion, RunStatusCode, toErrorMessage } from '@zercade-dev/narn-shared';
import type { RunStore } from '../storage/types.js';
import { getCurrentTenant, runWithTenant } from '../storage/pg/tenant-context.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { isAbortError } from './M9/errors.js';
import { BackgroundRunEngine, type LoggerLike } from './M9/run-engine.js';
import { assertRunCapacity } from './M9/run-capacity.js';
import { type ModuleLogFn } from './M9/module-selection.js';
import {
  accumulateUsage,
  defaultPricingProvider,
  finalizeUsageCosts,
  type PricingProvider,
} from './M9/usage-pricing.js';
import {
  assertSuggestModuleAvailable,
  countGlossarySourceEntries,
  generateGlossary,
  GlossaryGenerateNotPossibleError,
  type GenerateGlossaryRequest,
} from './glossary-generator.js';

export { GlossaryGenerateNotPossibleError };

export interface GlossaryGenEngineDeps {
  concurrency?: number;
  runStore?: RunStore;
  logger?: LoggerLike;
  /** Override the generator (tests); defaults to the real {@link generateGlossary}. */
  generate?: typeof generateGlossary;
  /** Override the entry counter (tests); defaults to {@link countGlossarySourceEntries}. */
  countEntries?: typeof countGlossarySourceEntries;
  /** Override the module-availability check (tests); defaults to the real one. */
  assertModule?: typeof assertSuggestModuleAvailable;
  /** Pricing dependency (tests); defaults to the shared oracle-backed provider. */
  pricing?: PricingProvider;
}

export class GlossaryGenEngine extends BackgroundRunEngine<GlossarySuggestion> {
  protected readonly logPrefix = 'glossary-gen';
  private readonly generate: typeof generateGlossary;
  private readonly countEntries: typeof countGlossarySourceEntries;
  private readonly assertModule: typeof assertSuggestModuleAvailable;

  constructor(deps: GlossaryGenEngineDeps = {}) {
    super({
      concurrency: deps.concurrency ?? 2,
      // Raw injected store (tests); the base's lazy getter resolves the live
      // registry store via getRunStore() when this is absent.
      ...(deps.runStore ? { runStore: deps.runStore } : {}),
      logger: deps.logger ?? defaultLogger,
      pricing: deps.pricing ?? defaultPricingProvider,
    });
    this.generate = deps.generate ?? generateGlossary;
    this.countEntries = deps.countEntries ?? countGlossarySourceEntries;
    this.assertModule = deps.assertModule ?? assertSuggestModuleAvailable;
  }

  protected override saveDetail(
    projectId: string,
    runId: string,
    records: GlossarySuggestion[],
  ): Promise<void> {
    return this.runStore.saveGlossarySuggestions(projectId, runId, records);
  }

  /**
   * Starts a glossary-generation run over the project's distinct source entries.
   * Resolves immediately with the new run id; the suggest call runs on the queue
   * and the result lands in the suggestions sidecar when the run completes.
   * Throws {@link GlossaryGenerateNotPossibleError} synchronously when no
   * suggest-capable module is available (so the route can answer 409).
   */
  async enqueue(
    projectId: string,
    request: GenerateGlossaryRequest = {},
    sessionId?: string,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT (→ 429). No-op when
    // the cap is unset (single-user/local unchanged).
    await assertRunCapacity(this.runStore);
    // Fail fast before creating a run so the route can answer 409 rather than
    // the user only learning of the missing module once the queued run fails.
    await this.assertModule(projectId, request, sessionId);

    // Capture the tenant on the request thread (context active here) so the
    // detached `processRun` body — scheduled on the JobQueue and run AFTER this
    // request returns — re-establishes it (each detached run body is its own
    // tenant-context seam) and its run-store writes stay tenant-scoped.
    const tenant = getCurrentTenant();

    const total = await this.countEntries(
      projectId,
      request.skipCategories,
      request.entryIds,
      request.focusSourceTexts,
    );

    const status = await this.createRunStatus(projectId, total, {
      kind: 'glossary-gen',
      glossaryGenSummary: { analyzed: 0, suggested: 0 },
    });
    const runId = status.runId;
    if (total === 0) {
      // Nothing to analyse — record an empty suggestions sidecar so the UI's
      // completion path loads `[]` rather than erroring on a missing file. This
      // empty branch intentionally bypasses controller/buffer registration (no
      // run task is queued), so there is nothing for a racing cancel to flush.
      status.finishedAt = Date.now();
      // Best-effort empty sidecar, but warn on failure rather than dropping it
      // silently (a "completed" empty run that can't load `[]` looks like an
      // error).
      await this.runStore.saveGlossarySuggestions(projectId, runId, []).catch((err: unknown) => {
        this.logger.warn('glossary-gen:save-empty-suggestions-failed', {
          runId,
          error: toErrorMessage(err),
        });
      });
      await this.runStore.updateRun(projectId, status);
      return { runId, total: 0, status: RunStatusCode.Completed };
    }

    const suggestions = this.startRun(runId, projectId, total);
    // Always allocate a sink; generateGlossary routes the provider's verbose
    // output here when the selected instance's config has verbose:true, so a
    // non-verbose run leaves the buffer empty and flushLogs is a no-op.
    const { logSink, logs } = this.buildLogSink();
    this.registerLogs(runId, logs);
    // Route the detached task through the base `trackTask` so the run's
    // settled deferred (armed above in startRun) resolves only AFTER processRun's
    // `finally` store write completes — not on the cancel signal. Otherwise a
    // drain during account deletion could return while this task is still about to
    // write the run row (post-teardown orphan).
    const body = () =>
      this.trackTask(runId, () =>
        this.processRun(runId, projectId, request, sessionId, suggestions, logSink),
      );
    this.queue.add(runId, tenant ? () => runWithTenant(tenant, body) : body);

    return { runId, total, status: RunStatusCode.Running };
  }

  private async processRun(
    runId: string,
    projectId: string,
    request: GenerateGlossaryRequest,
    sessionId: string | undefined,
    suggestions: GlossarySuggestion[],
    logSink: ModuleLogFn | undefined,
  ): Promise<void> {
    const status = this.runs.get(runId);
    if (!status || status.status === RunStatusCode.Cancelled) return;
    const signal = this.controllers.get(runId)?.signal;

    try {
      const result = await this.generate(
        projectId,
        request,
        sessionId,
        signal,
        (processed) => {
          // Per-batch progress: advance `completed` as each internal chunk of the
          // suggest call settles, so the UI's bar fills steadily instead of sitting
          // at 0% until the whole-set call returns. Skip once terminal/aborted.
          if (status.status !== RunStatusCode.Running || signal?.aborted) return;
          status.completed = Math.min(processed, status.total);
          this.emitProgress(status);
        },
        logSink,
      );
      // Buffer the produced suggestions BEFORE the cancel/abort check so a result
      // that the (whole-set) suggest call returned — `suggestGlossaries` aborts
      // by returning partial results rather than throwing — is always persisted,
      // even if a cancel raced in while generate() was resolving. cancel() flushes
      // the same buffer.
      suggestions.push(...result.suggestions);
      // Same rationale as the suggestions buffer: the provider calls already
      // happened (and cost money) by the time generate() resolves, regardless of
      // whether a cancel raced in — so fold the usage in before the cancel check.
      accumulateUsage(status, result.moduleId, result.usages);
      status.glossaryGenSummary = {
        analyzed: result.analyzed,
        suggested: result.suggestions.length,
      };
      if ((status.status as RunStatusCode) === RunStatusCode.Cancelled || signal?.aborted) {
        // A cancel that raced ahead of this call already ran its own
        // finalizeUsageCosts + store persist (see cancel()) using whatever
        // usageByModule existed at that moment — before accumulateUsage above
        // folded in THIS call's real, already-billed usage. The `finally`
        // block below is gated on Running and won't re-run for a cancelled
        // status, so without this, the corrected usage would stay in memory
        // only (a live getStatus() poll would see it) but never reach the
        // store. Recompute cost from the now-complete data and persist the
        // correction; best-effort like every other terminal persist here.
        if (this.pricing) await finalizeUsageCosts(status, this.pricing);
        await this.runStore.updateRun(projectId, status).catch((err: unknown) => {
          this.logger.warn('glossary-gen:cancelled-usage-update-failed', {
            runId,
            error: toErrorMessage(err),
          });
        });
        return;
      }
      // Keep completed consistent with what was actually analyzed (entries can be
      // removed between the count and the run), capped at the reported total.
      status.completed = Math.min(result.analyzed, status.total);
      this.logger.info('glossary-gen:done', {
        runId,
        analyzed: result.analyzed,
        suggested: result.suggestions.length,
      });
    } catch (err) {
      if (isAbortError(err) || signal?.aborted) return;
      const message = toErrorMessage(err);
      // Keep completed + failed === total (the base engines' convention) even
      // when the run failed after partial onProgress updates, so the Activity
      // tab never renders a >100% progress bar.
      status.completed = 0;
      status.failed = status.total;
      status.errors.push({ message, timestamp: Date.now() });
      this.logger.warn('glossary-gen:failed', { runId, error: message });
    } finally {
      // Gated on Running: a cancelled run skips this block entirely, so its
      // partial verbose log is dropped (the base `cancel` clears the buffer).
      // M29 mirrors this convention — verbose logs are flushed only on a
      // terminal, non-cancelled run.
      if (status.status === RunStatusCode.Running) {
        // Finalize usage cost FIRST, mirroring finalizeTerminal()'s ordering —
        // before flushing any detail, so a run that fails after partial usage
        // still reports the cost of what was actually billed.
        if (this.pricing) await finalizeUsageCosts(status, this.pricing);
        // Flush the verbose log sidecar (best-effort, no-op when buffer is empty).
        // Done before the suggestions sidecar so both writes complete before the
        // run is reported terminal.
        await this.flushLogs(projectId, runId);
        // Persist the suggestions sidecar before the run flips terminal, so a
        // reader that sees "completed" can always load it. If the write fails,
        // mark the run Failed rather than reporting a "completed" run whose
        // suggestions can't be read (which would silently look like "no results").
        let flushed = true;
        try {
          await this.runStore.saveGlossarySuggestions(projectId, runId, suggestions);
        } catch (err) {
          // Control flow is unchanged (the run is still marked Failed below),
          // but log the underlying write error rather than discarding it — the run
          // would otherwise report a bare "failed to persist suggestions" with no cause.
          flushed = false;
          this.logger.warn('glossary-gen:save-suggestions-failed', {
            runId,
            error: toErrorMessage(err),
          });
        }
        if (!flushed && status.failed === 0) {
          // Same completed + failed === total invariant as the catch path above.
          status.completed = 0;
          status.failed = status.total;
          status.errors.push({ message: 'failed to persist suggestions', timestamp: Date.now() });
        }
        status.status = status.failed > 0 ? RunStatusCode.Failed : RunStatusCode.Completed;
        status.finishedAt = Date.now();
        this.controllers.delete(runId);
        this.queue.cancelRun(runId);
        this.detailBuffers.delete(runId);
        this.clearExtraBuffers(runId); // drops the verbose log buffer
        // Best-effort terminal persist — warn rather than swallow so a failed
        // write of the final run status is visible in the logs.
        await this.runStore.updateRun(projectId, status).catch((err: unknown) => {
          this.logger.warn('glossary-gen:finalize-store-update-failed', {
            runId,
            error: toErrorMessage(err),
          });
        });
      }
    }
  }
}

export const glossaryGenEngine = new GlossaryGenEngine();
