/**
 * M26 — SourceReviewEngine
 *
 * Report-only LLM review of the SOURCE language text (not a translation
 * review): typos, grammar, inconsistent terminology, and clarity. Modeled as a
 * run persisted via the RunStore and executed on M9's JobQueue pattern, so the Activity
 * tab gets progress/cancel/history/cost for free. Findings are stored on each
 * entry's `sourceReview` and a per-item sidecar (`source-review-<runId>.json`).
 *
 * Shares the run/queue/sidecar/cancel machinery with the other background
 * engines via the {@link BackgroundRunEngine} base (M9/run-engine.ts); this
 * subclass keeps only the source-review scope, batch body, and persistence.
 */
import {
  FREEWAY_MODULE_ID,
  type GlobalConfig,
  type Project,
  RunStatusCode,
  type SourceReviewChecks,
  type SourceReviewFinding,
  type SourceReviewItem,
  type SourceReviewItemResult,
  type SourceReviewOptions,
  type StringEntry,
  type TranslationModule,
  type BatchDispatchOptions,
  type BatchGroupingDimension,
  isExcludedFromAi,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import {
  moduleRegistry as defaultModuleRegistry,
  type ModuleRegistry,
} from './M6-module-registry.js';
import type {
  GlobalConfigStore,
  ProjectStore,
  RunStore,
  SourceReviewRecord,
  StringStore,
} from '../storage/types.js';
import { getGlobalConfigStore, getProjectStore, getStringStore } from '../storage/registry.js';
import { getCurrentTenant, runWithTenant } from '../storage/pg/tenant-context.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { defaultPricingProvider, type PricingProvider } from './M9/usage-pricing.js';
import {
  selectCapableModule,
  selectFreewayBackgroundModule,
  type ModuleLogFn,
} from './M9/module-selection.js';
import { FREEWAY_BACKGROUND_RESERVE } from './M32/background-select.js';
import type { BucketSourceDeps } from './M32/bucket-source.js';
import {
  batchPayloadChars,
  createReviewBatchSizer,
  sourceReviewLengthProxy,
} from './M32/review-batch.js';
import type { BucketView } from './M32/types.js';
import {
  BackgroundRunEngine,
  sanitizeLLMText,
  type FreewayBatchBinding,
  type LoggerLike,
} from './M9/run-engine.js';
import { assertRunCapacity } from './M9/run-capacity.js';

/** Items reviewed per provider call — the default for a non-Freeway module, and
 *  the resolver's own fallback when a Freeway run has no bucket yet. */
const SOURCE_REVIEW_BATCH_SIZE = 12;

/** The review categories (canonical definition lives in `@zercade-dev/narn-shared`). */
export type { SourceReviewChecks };

export interface SourceReviewRequest {
  /** Entries to review; defaults to all entries that `needsTranslation`. */
  entryIds?: string[];
  checks: SourceReviewChecks;
  /** Items per provider call; defaults to {@link SOURCE_REVIEW_BATCH_SIZE}. */
  batchSize?: number;
  /** Explicit module selection; otherwise the cheapest review-capable module. */
  moduleId?: string;
  /** Per-run model override. */
  model?: string;
  /** Per-run reasoning-effort override (module config key `reasoningEffort`). */
  reasoningEffort?: string;
  /**
   * Optional language code the AI should write its finding `detail` text in.
   * Omitted/English → unchanged (English) output. Review logic is unaffected.
   */
  responseLanguage?: string;
  /** When true, capture the module's prompt/response log to a sidecar. */
  verbose?: boolean;
  /**
   * Per-run override for related-entry batch grouping. Absent ⇒ the project /
   * workspace setting is used.
   */
  batchGrouping?: BatchGroupingDimension;
  /** Per-run override for the ignore-batch-size-limit toggle. */
  ignoreBatchSizeLimit?: boolean;
  /**
   * Per-run override of how many items each provider call holds. `0` means
   * unlimited (the whole review scope in one call). Mutually exclusive with
   * `batchGrouping`/`ignoreBatchSizeLimit` — the dialog sends one or the other.
   */
  customBatchSize?: number;
}

export class SourceReviewNotPossibleError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'SourceReviewNotPossibleError';
  }
}

export interface SourceReviewEngineDeps {
  concurrency?: number;
  moduleRegistry?: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  stringStore?: Pick<StringStore, 'load' | 'updateEntry'>;
  projectStore?: Pick<ProjectStore, 'loadProject'>;
  runStore?: RunStore;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  logger?: LoggerLike;
  pricing?: PricingProvider;
  /** Bucket-source overrides used when a run selects the free-tier target. */
  freeway?: BucketSourceDeps;
}

// LLM-produced finding/suggestion text is sanitized via the shared
// `sanitizeLLMText` (control chars / whitespace) before persisting, but NOT
// truncated: a finding's `detail` is the user-facing AI explanation, so capping
// it cut longer findings off mid-way in the source-review UI. The UI renders
// the full text (expandable when long); see SourceAiReviewTab.

function sanitizeFinding(finding: SourceReviewFinding): SourceReviewFinding {
  return {
    type: finding.type,
    detail: sanitizeLLMText(finding.detail),
  };
}

export class SourceReviewEngine extends BackgroundRunEngine<SourceReviewRecord> {
  protected readonly logPrefix = 'source-review';
  private readonly moduleRegistry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _stringStore?: Pick<StringStore, 'load' | 'updateEntry'>;
  private get stringStore(): Pick<StringStore, 'load' | 'updateEntry'> {
    return this._stringStore ?? getStringStore();
  }
  // Resolve the project store lazily so a later setProjectStore() (e.g. per-test
  // injection) is honored even by the module-level singleton.
  private readonly _projectStore?: Pick<ProjectStore, 'loadProject'>;
  private get projectStore(): Pick<ProjectStore, 'loadProject'> {
    return this._projectStore ?? getProjectStore();
  }
  // Resolve the global-config store lazily so a later setGlobalConfigStore()
  // (e.g. per-test injection) is honored even by the module-level singleton.
  private readonly _globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  private get globalConfigStore(): Pick<GlobalConfigStore, 'load'> {
    return this._globalConfigStore ?? getGlobalConfigStore();
  }
  /** Injected Freeway bucket-source overrides (ledger / status / cloud mode). */
  private readonly freewayOverrides: BucketSourceDeps;

  constructor(deps: SourceReviewEngineDeps = {}) {
    super({
      concurrency: deps.concurrency ?? 2,
      // Raw injected store (tests); the base's lazy getter resolves the live
      // registry store via getRunStore() when this is absent.
      ...(deps.runStore ? { runStore: deps.runStore } : {}),
      logger: deps.logger ?? defaultLogger,
      pricing: deps.pricing ?? defaultPricingProvider,
    });
    this.moduleRegistry = deps.moduleRegistry ?? defaultModuleRegistry;
    this.freewayOverrides = deps.freeway ?? {};
    this._stringStore = deps.stringStore;
    this._projectStore = deps.projectStore;
    this._globalConfigStore = deps.globalConfigStore;
  }

  protected override async saveDetail(
    projectId: string,
    runId: string,
    records: SourceReviewRecord[],
  ): Promise<void> {
    // Flush the verbose log sidecar (best-effort) before the review sidecar so
    // both writes complete before the run is reported terminal.
    await this.flushLogs(projectId, runId);
    await this.runStore.saveSourceReview(projectId, runId, records);
  }

  /**
   * Picks the review module/model. Precedence: an explicit request override,
   * then the project's saved {@link Project.sourceReviewConfig}, then the
   * cheapest enabled module that implements `reviewSource`. Reasoning-effort
   * falls back the same way. The free-tier target resolves to a concrete bucket
   * instead (see below). Throws SourceReviewNotPossibleError when nothing can
   * review.
   */
  private async selectModule(
    project: Project,
    global: GlobalConfig,
    sessionId: string | undefined,
    request: SourceReviewRequest,
    logSink?: ModuleLogFn,
    reserveRequests?: number,
  ): Promise<{
    module: TranslationModule;
    moduleId: string;
    bucketKey?: string;
    bucket?: BucketView;
  }> {
    const saved = project.sourceReviewConfig;
    const requestedId = request.moduleId ?? saved?.moduleId;
    const requestedModel = request.model ?? saved?.model;
    const requestedEffort = request.reasoningEffort ?? saved?.reasoningEffort;
    const options = {
      ...(requestedEffort ? { requestedEffort } : {}),
      ...(request.verbose ? { verbose: true } : {}),
      ...(logSink ? { logSink } : {}),
      capability: (m: TranslationModule) => typeof m.reviewSource === 'function',
      notPossible: (msg: string) => new SourceReviewNotPossibleError(msg),
      noneAvailableMessage: 'no enabled source-review-capable module available',
    };
    if (requestedId === FREEWAY_MODULE_ID) {
      // Resolved at run start, and again — at most once per batch — when a rate
      // limit outlives the retries: the run then hops to whatever bucket is
      // still healthy rather than failing while the pool has capacity. Callers
      // that can bound the run's scope pass the reserve it should fence.
      return selectFreewayBackgroundModule(this.moduleRegistry, project, global, sessionId, {
        ...options,
        deps: this.freewayOverrides,
        ...(reserveRequests !== undefined ? { reserveRequests } : {}),
        noneAvailableMessage: 'no free-tier model is currently available to review source text',
      });
    }
    return selectCapableModule(this.moduleRegistry, project, global, sessionId, {
      ...options,
      requestedFailLabel: `module "${requestedId}" cannot review source text`,
      ...(requestedId !== undefined ? { requestedId } : {}),
      ...(requestedModel ? { requestedModel } : {}),
    });
  }

  /**
   * Starts a source-review run over `entryIds` (default: all entries that need
   * translation). The scope is ordered by `reviewSortIndex` (undefined last) so
   * the similarity pre-sort groups related strings into the same batch.
   */
  async enqueue(
    projectId: string,
    request: SourceReviewRequest,
    sessionId?: string,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT (→ 429). No-op when
    // the cap is unset (single-user/local unchanged).
    await assertRunCapacity(this.runStore);
    // Capture the tenant on the request thread (context active here) so each
    // detached `processBatch` body — scheduled on the JobQueue in `dispatch` and
    // run AFTER this request returns — re-establishes it (each detached run
    // body is its own tenant-context seam) so its run-store/string-store
    // writes stay tenant-scoped.
    const tenant = getCurrentTenant();

    // Captured by `buildItems` below (enqueueBatched calls it with the project
    // it already loaded via `loadContext`) so `dispatch` can read
    // `sourceLanguage` without a second `loadProject` call per batch —
    // `enqueueBatched` resolves `buildItems` strictly before invoking `dispatch`.
    let loadedProject!: Project;
    // Set by `selectModule` below, which `enqueueBatched` resolves strictly
    // before it invokes `dispatch`: the free-tier bucket the run spends
    // against, or undefined for an ordinary module.
    let freeway: FreewayBatchBinding | undefined;
    // Builds a batch's re-route: on a rate-limit exhaustion it re-selects, then
    // moves BOTH the run (so batches that start later begin on the new bucket)
    // and that batch's OWN selection copy. Per batch, because a sibling batch
    // between retries must keep dispatching through the module whose bucket its
    // debits are keyed to. Left undefined for an ordinary module.
    let makeFreewayReroute:
      | ((selection: {
          module: TranslationModule;
          moduleId: string;
        }) => () => Promise<FreewayBatchBinding | undefined>)
      | undefined;
    // The run's current selection; each batch copies it when it starts.
    let target: { module: TranslationModule; moduleId: string } | undefined;
    // The bucket the run is currently on, for batch sizing. Set by selectModule
    // and replaced by a mid-run re-route; undefined for non-Freeway runs. The
    // reassignment on a hop is correct future-proofing, not something THIS run
    // currently observes mid-flight: the batch-size resolver below runs once,
    // before dispatch, and every batch is packed from that one result — a hop
    // changes which bucket later batches debit against, never their size.
    let bucket: BucketView | undefined;

    // The reserve the free-tier selector should fence: an ESTIMATE computed
    // before the bucket (and therefore the real per-call size) is known, so an
    // explicit entry scope, sized at `itemsPerCall` below, bounds how many
    // provider calls this run can make — fenced at the larger of that and the
    // flat default. A char-tight bucket can size batches below `itemsPerCall`
    // when no explicit request size was given, so the run can end up making
    // more calls than this estimate assumed; an exact fence isn't possible this
    // early. The needsTranslation fallback scope isn't knowable from the
    // request, so there the flat fence stands alone.
    const scopedEntries = request.entryIds?.length;
    const itemsPerCall =
      request.customBatchSize !== undefined && request.customBatchSize > 0
        ? request.customBatchSize
        : request.batchSize && request.batchSize > 0
          ? request.batchSize
          : SOURCE_REVIEW_BATCH_SIZE;
    const reserveRequests = scopedEntries
      ? Math.max(FREEWAY_BACKGROUND_RESERVE, Math.ceil(scopedEntries / itemsPerCall))
      : undefined;

    // Precedence: `customBatchSize` (handled upstream in run-engine.ts, before
    // this resolver ever runs) → an explicit `request.batchSize` (the AI-review
    // dialog's plain "Batch size" field — the dialog omits it at its own default
    // so a Freeway run isn't pinned to that default on every start, but a value
    // the user actually changed still arrives here) → bucket sizing for a
    // Freeway-routed run with no explicit size (the bucket is known only after
    // `selectModule`, hence the getter) → the flat `SOURCE_REVIEW_BATCH_SIZE`.
    //
    // Source review reviews source text only — an item has no translation, so
    // its payload is honest as-is: `sourceReviewLengthProxy` IS the real
    // payload, not a proxy standing in for something larger. Shared with the
    // per-batch `batchChars` below so sizing and the minute-token projection
    // measure the same payload.
    const sizer = createReviewBatchSizer<SourceReviewItem>({
      bucket: () => bucket,
      explicitSize: request.batchSize && request.batchSize > 0 ? request.batchSize : undefined,
      fallbackSize: SOURCE_REVIEW_BATCH_SIZE,
      lengthProxy: sourceReviewLengthProxy,
    });

    return this.enqueueBatched<SourceReviewItem>({
      projectId,
      loadContext: async () => ({
        project: await this.projectStore.loadProject(projectId),
        global: await this.globalConfigStore.load(),
      }),
      selectModule: async (project, global, logSink) => {
        const selected = await this.selectModule(
          project,
          global,
          sessionId,
          request,
          logSink,
          reserveRequests,
        );
        target = { module: selected.module, moduleId: selected.moduleId };
        if (selected.bucketKey !== undefined) {
          freeway = { bucketKey: selected.bucketKey, deps: this.freewayOverrides };
          bucket = selected.bucket;
          makeFreewayReroute = (selection) => async () => {
            try {
              // The struck bucket is cooled before this runs, so the selector
              // offers a different one (or nothing, and the batch fails).
              const next = await this.selectModule(
                project,
                global,
                sessionId,
                request,
                logSink,
                reserveRequests,
              );
              if (next.bucketKey === undefined) return undefined;
              const binding = { bucketKey: next.bucketKey, deps: this.freewayOverrides };
              target = { module: next.module, moduleId: next.moduleId };
              freeway = binding;
              bucket = next.bucket;
              selection.module = next.module;
              selection.moduleId = next.moduleId;
              return binding;
            } catch (err) {
              // Nothing eligible — or the re-selection itself failed (a vault
              // re-lock mid-run, say), which is worth telling apart from a
              // genuinely empty pool. Either way the batch fails as it did
              // before the hop existed.
              this.logger.warn(`${this.logPrefix}:freeway-reroute-select-failed`, {
                projectId,
                error: toErrorMessage(err),
              });
              return undefined;
            }
          };
        }
        return selected;
      },
      buildItems: async (project) => {
        loadedProject = project;
        const allEntries = await this.stringStore.load(projectId);
        // `ignored` entries are excluded from every AI dispatch, source review
        // included, in both the explicit-scope and needsTranslation-fallback branches.
        let scoped: StringEntry[];
        if (request.entryIds && request.entryIds.length > 0) {
          const wanted = new Set(request.entryIds);
          scoped = allEntries.filter((e) => wanted.has(e.id) && !isExcludedFromAi(e));
        } else {
          scoped = allEntries.filter((e) => e.needsTranslation && !isExcludedFromAi(e));
        }

        // Stored (import) order. Related-entry batch grouping is applied by the
        // base; the word-similarity pre-sort (reviewSortIndex) is now a UI-only
        // display sort, no longer a batch input.
        const entriesById = new Map(scoped.map((e) => [e.id, e]));
        const items: SourceReviewItem[] = scoped.map((entry, i) => ({
          i,
          s: entry.sourceText,
          ...(entry.context ? { ctx: entry.context } : {}),
          entryId: entry.id,
        }));
        return { items, entriesById };
      },
      summary: {
        kind: 'source-review',
        sourceReviewSummary: { reviewed: 0, flagged: 0, findings: 0 },
      },
      batchSize: sizer.resolve,
      // A bucket-sized batch is already final: the provider must send it whole
      // rather than re-chunking it at its own review cap, which would turn one
      // planned free-tier request into several (and the ledger, debiting once
      // per engine batch, would under-count them). Never set for an explicit
      // request size or a non-Freeway run — those batches are a flat constant
      // the module's own `maxBatchSize` is still entitled to bound.
      batchesPreSized: sizer.bucketSized,
      // Per-run override (AI-review dialog) → project → workspace → none.
      ...(request.batchGrouping !== undefined
        ? { batchGroupingOverride: request.batchGrouping }
        : {}),
      ...(request.ignoreBatchSizeLimit !== undefined
        ? { ignoreBatchSizeLimitOverride: request.ignoreBatchSizeLimit }
        : {}),
      ...(request.customBatchSize !== undefined
        ? { customBatchSizeOverride: request.customBatchSize }
        : {}),
      dispatch: ({ runId, module, moduleId, entriesById, records, batches, dispatchOptions }) => {
        const project = loadedProject;
        for (const batch of batches) {
          const body = () => {
            // Read when the batch actually starts (so it begins on whatever
            // bucket the run is on by then) and COPIED, so this batch's module
            // and its debited bucket only ever move together — a sibling's hop
            // cannot swap the module out from under it mid-retry.
            // `selectModule` always sets `target`; the fallback keeps this
            // independent of that ordering.
            const selection = target ? { ...target } : { module, moduleId };
            return this.processBatch(
              runId,
              projectId,
              selection,
              batch,
              {
                checks: request.checks,
                sourceLanguage: project.sourceLanguage,
                ...(request.responseLanguage ? { responseLanguage: request.responseLanguage } : {}),
              },
              entriesById,
              records,
              dispatchOptions,
              freeway,
              makeFreewayReroute?.(selection),
            );
          };
          this.queue.add(runId, tenant ? () => runWithTenant(tenant, body) : body);
        }
      },
    });
  }

  private async processBatch(
    runId: string,
    projectId: string,
    /** Held by reference: a mid-run re-route replaces the module in place. */
    selection: { module: TranslationModule; moduleId: string },
    batch: SourceReviewItem[],
    opts: SourceReviewOptions,
    entriesById: Map<string, StringEntry>,
    reviewRecords: SourceReviewRecord[],
    dispatchOptions?: BatchDispatchOptions,
    freeway?: FreewayBatchBinding,
    freewayReroute?: () => Promise<FreewayBatchBinding | undefined>,
  ): Promise<void> {
    await this.runBatchWithUsage<SourceReviewItem, SourceReviewItemResult>({
      runId,
      moduleId: selection.moduleId,
      batch,
      dispatchOptions,
      call: (signal) => selection.module.reviewSource!(batch, opts, signal, dispatchOptions),
      // What this batch costs the bucket's minute-token budget, measured with
      // the same proxy the sizer sized it with.
      batchChars: batchPayloadChars(batch, sourceReviewLengthProxy),
      failureKey: (item) => ({ entryId: item.entryId }),
      usageOf: (result) => result.usage,
      ...(freeway ? { freeway } : {}),
      ...(freewayReroute ? { freewayReroute } : {}),
      onResult: async (result, status) => {
        if (result.error) {
          this.recordFailure(status, { entryId: result.entryId }, result.error);
          return;
        }
        const entry = entriesById.get(result.entryId);
        if (!entry) {
          this.recordFailure(status, { entryId: result.entryId }, 'entry not found');
          return;
        }
        const findings = result.findings.map(sanitizeFinding);
        // Item-level unified suggestion; only meaningful when the item is
        // actually flagged, so a clean item never carries a stray correction.
        // `parseSourceReviewResponse` already drops the suggestion for clean
        // items on the AI-SDK path; this guard is defense-in-depth for any
        // `reviewSource` implementation that doesn't.
        const suggestion =
          findings.length > 0 && result.suggestion ? sanitizeLLMText(result.suggestion) : undefined;
        try {
          await this.persistReview(projectId, entry, findings, suggestion, runId);
        } catch (err) {
          this.recordFailure(
            status,
            { entryId: result.entryId },
            err instanceof Error ? err.message : `${err}`,
          );
          return;
        }
        status.completed++;
        const summary = (status.sourceReviewSummary ??= { reviewed: 0, flagged: 0, findings: 0 });
        summary.reviewed++;
        if (findings.length > 0) {
          summary.flagged++;
          summary.findings += findings.length;
        }
        reviewRecords.push({
          entryId: entry.id,
          sourceText: entry.sourceText,
          findings,
          ...(suggestion !== undefined ? { suggestion } : {}),
        });
        this.logger.info('source-review:done', {
          runId,
          entryId: entry.id,
          findings: findings.length,
        });
      },
    });
  }

  /** Stores the review result on the entry's `sourceReview` field. */
  private async persistReview(
    projectId: string,
    entry: StringEntry,
    findings: SourceReviewFinding[],
    suggestion: string | undefined,
    runId: string,
  ): Promise<void> {
    const sourceReview = {
      findings,
      ...(suggestion !== undefined ? { suggestion } : {}),
      reviewedAt: Date.now(),
      runId,
    };
    entry.sourceReview = sourceReview;
    await this.stringStore.updateEntry(projectId, entry.id, { sourceReview });
  }
}

export const sourceReviewEngine = new SourceReviewEngine();
