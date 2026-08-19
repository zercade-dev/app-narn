/**
 * M29 — CategoryGenEngine
 *
 * Non-blocking background generation of AI category suggestions. Where the
 * direct path ran a single blocking LLM call behind a modal spinner, this models
 * category generation as a run persisted via the RunStore and executed off the request
 * thread, so the Activity tab gets progress/cancel/history for free and the user
 * can navigate away and review the suggestions when the run completes.
 *
 * Progress is reported per provider chunk (the classifier batches entries by
 * CHUNK_SIZE): each settled chunk advances `completed`, and `total` is the
 * number of chunks (learned from the first chunk callback). The resulting
 * `CategorySuggestion[]` is persisted to a category-suggestions sidecar via the
 * RunStore.
 *
 * Shares the run/status/cancel machinery with the other background engines via
 * the {@link BackgroundRunEngine} base (M9/run-engine.ts). It is deliberately
 * the only one that does NOT use the JobQueue: there is a single fire-and-forget
 * call whose progress streams via `onChunkDone`, so it has its own `run` rather
 * than the base's per-batch terminal flip.
 *
 * Cancel is intentionally all-or-nothing: `suggestCategories` returns the whole
 * `CategorySuggestion[]` at once (merging across its internal chunks), so there
 * is no partial result to buffer. A cancel mid-run therefore discards every
 * chunk already classified — by design, unlike M28 which can flush partials.
 * Accordingly M29 registers no detail buffer and the base `cancel`'s flush is a
 * no-op for it.
 */
import {
  CATEGORY_CHUNK_SIZE,
  type CategorySuggestion,
  FREEWAY_MODULE_ID,
  RunStatusCode,
  toErrorMessage,
  type TranslationModule,
} from '@zercade-dev/narn-shared';
import {
  contentClassifier as defaultContentClassifier,
  isCategoryCapableModule,
  type ContentClassifier,
  type SuggestCategoriesRequest,
} from './M5-content-classifier.js';
import type { GlobalConfigStore, ProjectStore, RunStore } from '../storage/types.js';
import { getGlobalConfigStore, getProjectStore } from '../storage/registry.js';
import { getCurrentTenant, runWithTenant } from '../storage/pg/tenant-context.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { isAbortError, isRateLimitError, rateLimitCooldownMs } from './M9/errors.js';
import { BackgroundRunEngine, type LoggerLike } from './M9/run-engine.js';
import { assertRunCapacity } from './M9/run-capacity.js';
import { selectFreewayBackgroundModule, type ModuleLogFn } from './M9/module-selection.js';
import {
  moduleRegistry as defaultModuleRegistry,
  type ModuleRegistry,
} from './M6-module-registry.js';
import type { BucketSourceDeps } from './M32/bucket-source.js';
import { coolBucket, recordDispatch } from './M32/bucket-source.js';
import { FREEWAY_BACKGROUND_RESERVE } from './M32/background-select.js';
import { ValidationError } from '../types/errors.js';
import {
  accumulateUsage,
  defaultPricingProvider,
  finalizeUsageCosts,
  type PricingProvider,
} from './M9/usage-pricing.js';

export interface CategoryGenEngineDeps {
  contentClassifier?: Pick<ContentClassifier, 'suggestCategories'>;
  runStore?: RunStore;
  logger?: LoggerLike;
  /** Pricing dependency (tests); defaults to the shared oracle-backed provider. */
  pricing?: PricingProvider;
  moduleRegistry?: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  projectStore?: Pick<ProjectStore, 'loadProject'>;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  /** Bucket-source overrides used when a run selects the free-tier target. */
  freeway?: BucketSourceDeps;
}

/** A module/model resolved for the run against a Freeway free-tier bucket. */
interface FreewayCategoryTarget {
  module: TranslationModule;
  moduleId: string;
  modelId: string;
  bucketKey: string;
}

export class CategoryGenEngine extends BackgroundRunEngine<CategorySuggestion> {
  protected readonly logPrefix = 'category-gen';
  private readonly contentClassifier: Pick<ContentClassifier, 'suggestCategories'>;
  private readonly moduleRegistry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  // Resolve the project/global-config stores lazily so a later
  // setProjectStore()/setGlobalConfigStore() (e.g. per-test injection) is
  // honored even by the module-level singleton — a bare `?? getX()`
  // constructor default would capture the store at import time.
  private readonly _projectStore?: Pick<ProjectStore, 'loadProject'>;
  private get projectStore(): Pick<ProjectStore, 'loadProject'> {
    return this._projectStore ?? getProjectStore();
  }
  private readonly _globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  private get globalConfigStore(): Pick<GlobalConfigStore, 'load'> {
    return this._globalConfigStore ?? getGlobalConfigStore();
  }
  /** Injected Freeway bucket-source overrides (ledger / status / cloud mode). */
  private readonly freewayOverrides: BucketSourceDeps;

  constructor(deps: CategoryGenEngineDeps = {}) {
    super({
      // Concurrency is unused (M29 runs a single fire-and-forget call, not the
      // JobQueue), but the base constructor requires it.
      concurrency: 1,
      // Raw injected store (tests); the base's lazy getter resolves the live
      // registry store via getRunStore() when this is absent.
      ...(deps.runStore ? { runStore: deps.runStore } : {}),
      logger: deps.logger ?? defaultLogger,
      pricing: deps.pricing ?? defaultPricingProvider,
    });
    this.contentClassifier = deps.contentClassifier ?? defaultContentClassifier;
    this.moduleRegistry = deps.moduleRegistry ?? defaultModuleRegistry;
    this._projectStore = deps.projectStore;
    this._globalConfigStore = deps.globalConfigStore;
    this.freewayOverrides = deps.freeway ?? {};
  }

  /**
   * The reserve a free-tier resolution should fence: this run's own scope
   * bounds how many provider calls it can make, sized from the requested
   * entry count against the effective per-call batch cap (mirrors
   * generateGlossary's reserve). A whole-project run (no `entryIds`) has no
   * such bound, so the flat default (via selectFreewayBackgroundModule's own
   * unset-reserve behavior) stands alone.
   */
  private freewayReserveRequests(request: SuggestCategoriesRequest): number | undefined {
    if (!request.entryIds || request.entryIds.length === 0) return undefined;
    const customBatchSize = request.customBatchSize;
    const cap =
      customBatchSize !== undefined && customBatchSize > 0 ? customBatchSize : CATEGORY_CHUNK_SIZE;
    return Math.max(FREEWAY_BACKGROUND_RESERVE, Math.ceil(request.entryIds.length / cap));
  }

  /**
   * Resolves the free-tier target for a `'freeway'` category-gen run: the
   * adequate bucket whose base module can generate categories (see
   * {@link isCategoryCapableModule}), built with the run's per-run overrides.
   * Called once at run start and again — at most once — when a rate limit
   * outlives the retry in `run()`.
   */
  private async selectFreewayTarget(
    projectId: string,
    request: SuggestCategoriesRequest,
    sessionId: string | undefined,
    logSink: ModuleLogFn,
  ): Promise<FreewayCategoryTarget> {
    const [project, global] = await Promise.all([
      this.projectStore.loadProject(projectId),
      this.globalConfigStore.load(),
    ]);
    const reserveRequests = this.freewayReserveRequests(request);
    return selectFreewayBackgroundModule(this.moduleRegistry, project, global, sessionId, {
      capability: (m) => isCategoryCapableModule(m.id),
      notPossible: (msg) => new ValidationError(msg),
      noneAvailableMessage: 'no free-tier model is currently available to generate categories',
      logSink,
      deps: this.freewayOverrides,
      ...(reserveRequests !== undefined ? { reserveRequests } : {}),
    });
  }

  // M29 persists its all-or-nothing result directly in `run`; the base flush
  // path is unused (no detail buffer is registered), but the base requires the
  // hook to exist.
  protected override saveDetail(
    projectId: string,
    runId: string,
    records: CategorySuggestion[],
  ): Promise<void> {
    return this.runStore.saveCategorySuggestions(projectId, runId, records);
  }

  /**
   * Starts a category-generation run. Returns the new run id and initial status
   * immediately; the LLM work runs in the background. A bad module / missing
   * model is not validated here — it surfaces as a Failed run (its error message
   * is recorded on the run and shown in the Activity tab), since the frontend
   * only offers category-capable modules.
   */
  async enqueue(
    projectId: string,
    request: SuggestCategoriesRequest,
    sessionId: string | undefined,
  ): Promise<{ runId: string; status: RunStatusCode }> {
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT (→ 429). No-op when
    // the cap is unset (single-user/local unchanged).
    await assertRunCapacity(this.runStore);
    // The run still goes through the background `run()` even for an empty scope
    // so a misconfigured module surfaces as a Failed run (the module-capability
    // check lives inside `suggestCategories`, not here — see the contract above).
    //
    // Seed `total: 0` so the run starts as an honest indeterminate (animated)
    // bar; the REAL unit count arrives with the first `onChunkDone` callback in
    // `run()`. This matters most when batching is off (M5 sends a single provider
    // call → one `onChunkDone(1, 1)` at the very end): a non-zero entry-count
    // seed would otherwise leave the bar frozen at `0 / N` for the whole run,
    // looking stuck until completion. Force Running despite the 0 total so a
    // single persisted write reflects the real state (createRunStatus would
    // otherwise derive Completed from total === 0).
    const status = await this.createRunStatus(projectId, 0, {
      kind: 'category-gen',
      status: RunStatusCode.Running,
    });
    const runId = status.runId;

    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const { logSink, logs } = this.buildLogSink();
    this.registerLogs(runId, logs);
    this.logger.info('category-gen:queued', { runId, projectId });
    // Warm the pricing feed in the background (mirrors the base startRun(),
    // which this engine doesn't call — see saveDetail's comment) so
    // finalizeUsageCosts() at run completion overlaps the classify call
    // instead of paying a cold fetch serially after it.
    if (this.pricing) void this.pricing.ensure().catch(() => {});

    // Capture the tenant on the request thread (context active here) so the
    // fire-and-forget `run` body — which executes AFTER this request returns —
    // re-establishes it (each detached run body is its own tenant-context
    // seam) and its run-store writes stay tenant-scoped.
    const tenant = getCurrentTenant();

    // Fire-and-forget: the LLM call(s) run off the request thread so the route
    // returns immediately. All terminal states are handled inside `run`.
    // M29 never calls the base `startRun` (it uses createRunStatus directly), so
    // no settled deferred exists for its run yet. Route the fire-and-forget body
    // through the base `trackTask`, which arms the deferred AND resolves it only
    // AFTER `run`'s `finally` store write completes — so a drain during account
    // deletion awaits this task's real settlement instead of finding nothing to
    // wait on (post-teardown orphan otherwise).
    const body = () => this.run(runId, projectId, request, sessionId, controller.signal, logSink);
    const tracked = () => this.trackTask(runId, body);
    void (tenant ? runWithTenant(tenant, tracked) : tracked());

    return { runId, status: RunStatusCode.Running };
  }

  private async run(
    runId: string,
    projectId: string,
    request: SuggestCategoriesRequest,
    sessionId: string | undefined,
    signal: AbortSignal,
    logSink: ModuleLogFn,
  ): Promise<void> {
    const status = this.runs.get(runId);
    if (!status) return;
    try {
      // A `'freeway'` run resolves a concrete free-tier bucket BEFORE the
      // classify call — the pool id itself is never category-capable, so
      // suggestCategories needs the resolved module (and its model, via the
      // per-run `model` override) passed down as an override rather than
      // trying to resolve `request.moduleId` through the project's config.
      let moduleOverride: { module: TranslationModule; moduleId: string } | undefined;
      let bucketKey: string | undefined;
      let effectiveRequest = request;
      if (request.moduleId === FREEWAY_MODULE_ID) {
        const target = await this.selectFreewayTarget(projectId, request, sessionId, logSink);
        moduleOverride = { module: target.module, moduleId: target.moduleId };
        bucketKey = target.bucketKey;
        effectiveRequest = { ...request, model: target.modelId };
      }

      let result: Awaited<ReturnType<ContentClassifier['suggestCategories']>>;
      // One re-route hop: a free-tier call whose bucket rate-limited it moves
      // to a sibling bucket instead of failing while a healthy one idles. Only
      // for a Freeway-bound call, only on a rate limit, and only once — a
      // second exhaustion fails exactly as any provider error always has.
      for (let hop = 0; ; hop++) {
        try {
          result = await this.contentClassifier.suggestCategories(
            projectId,
            effectiveRequest,
            sessionId,
            {
              signal,
              onChunkDone: (done, total) => {
                const current = this.runs.get(runId);
                if (!current || current.status !== RunStatusCode.Running) return;
                current.total = total;
                current.completed = done;
                this.emitProgress(current);
              },
              logSink,
              ...(moduleOverride ? { moduleOverride } : {}),
            },
          );
          break;
        } catch (err) {
          if (bucketKey && isRateLimitError(err)) {
            await coolBucket(
              bucketKey,
              Date.now(),
              rateLimitCooldownMs(err),
              undefined,
              'pool',
            ).catch(() => undefined);
            if (hop === 0) {
              try {
                const next = await this.selectFreewayTarget(projectId, request, sessionId, logSink);
                moduleOverride = { module: next.module, moduleId: next.moduleId };
                bucketKey = next.bucketKey;
                effectiveRequest = { ...request, model: next.modelId };
                continue;
              } catch (selectErr) {
                this.logger.warn('category-gen:freeway-reroute-select-failed', {
                  runId,
                  projectId,
                  error: toErrorMessage(selectErr),
                });
              }
            }
          }
          throw err;
        }
      }
      const { suggestions, usages } = result;

      // Debit the bucket's ledger for a Freeway run (best-effort — a debit
      // failure must not fail an otherwise-successful run).
      if (bucketKey) {
        for (const usage of usages) {
          await recordDispatch(bucketKey, Date.now(), {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            chars: usage.characters ?? usage.sourceChars ?? 0,
          }).catch(() => undefined);
        }
      }

      // Fold usage into the run BEFORE the cancel check: the provider call(s)
      // already happened (and cost money) by the time suggestCategories()
      // resolves, regardless of whether a cancel raced in — mirrors M28's
      // processRun, which folds usage ahead of its own cancel check for the
      // same reason. Billed against the resolved module id (the concrete
      // bucket for a Freeway run, matching M28's `result.moduleId`) rather
      // than the synthetic pool id, so usage attributes to what actually ran.
      accumulateUsage(status, moduleOverride?.moduleId ?? request.moduleId, usages);
      if (this.pricing) await finalizeUsageCosts(status, this.pricing);

      // A cancel that landed while the provider call was in flight wins: don't
      // overwrite the terminal state or persist a partial result as success.
      if (signal.aborted || status.status === RunStatusCode.Cancelled) return;

      // Persist before flipping the run terminal so a reader that sees
      // "completed" can always load the suggestions. A save failure throws and
      // is caught below, marking the run Failed rather than reporting a
      // "completed" run whose suggestions silently vanished.
      await this.runStore.saveCategorySuggestions(projectId, runId, suggestions);
      // Flush the verbose log sidecar (best-effort, no-op when empty) before the
      // run flips terminal. Only reached on a non-cancelled completion — the
      // cancel/abort early-returns (above and in `catch`) skip it, so a cancelled
      // run drops its partial log. This mirrors M28 and the base `cancel`, which
      // clears the buffer without flushing; keeping the flush OUT of `finally`
      // avoids racing `cancel`'s buffer-clear.
      await this.flushLogs(projectId, runId);
      status.status = RunStatusCode.Completed;
      status.finishedAt = Date.now();
      this.logger.info('category-gen:done', {
        runId,
        projectId,
        suggestions: suggestions.length,
      });
    } catch (err) {
      if (isAbortError(err) || signal.aborted) {
        // Cancellation already set the terminal state in `cancel`; the partial
        // verbose log is intentionally dropped (no flush on this path).
        return;
      }
      status.status = RunStatusCode.Failed;
      status.finishedAt = Date.now();
      const message = toErrorMessage(err);
      status.errors.push({ message, timestamp: Date.now() });
      // A genuine failure keeps its verbose log for debugging (matches M28).
      await this.flushLogs(projectId, runId);
      this.logger.error('category-gen:failed', { runId, projectId, error: message });
    } finally {
      this.controllers.delete(runId);
      this.clearExtraBuffers(runId);
      await this.runStore.updateRun(projectId, status).catch((e) => {
        this.logger.error('category-gen:store-update-failed', {
          runId,
          error: e instanceof Error ? e.message : `${e}`,
        });
      });
    }
  }
}

export const categoryGenEngine = new CategoryGenEngine();
