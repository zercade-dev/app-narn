/**
 * M30 — RelinkRetranslateEngine
 *
 * Relink tab: after a relink merges an orphan's translations onto a
 * live target entry, the target's OWN source text usually differs slightly
 * from the orphan's (that's why the orphan existed — a CSV re-import edited
 * the source and produced a new entry id, orphaning the old one). This engine
 * optionally asks an LLM to bring each already-existing target-language
 * translation back in sync with that edit: given the orphan's OLD source text
 * and the target's NEW source text as a before/after reference, it asks the
 * model to replicate whatever changed between them onto each translation.
 *
 * Reuses the module's standard `translate()` capability rather than a bespoke
 * provider method — the before/after diff instruction rides in
 * `TranslationJob.taskInstruction`, which every LLM module's prompt builder
 * (same-language, mixed-target, and copilot) renders as a trusted `Task:`
 * line whenever every job of the call carries the identical value (true
 * here — see `buildEditTransferContext`, which builds ONE shared string for
 * every job); non-LLM modules ignore `taskInstruction`, so the module
 * selection below restricts to modules exposing `retryWithFeedback` (the AI
 * SDK provider layer's marker for "this module reads context/history",
 * absent on classical-MT/QA modules like deepl/pseudo).
 *
 * Modeled as a run persisted via the RunStore so it shows up in the Activity
 * tab with progress/cancel/history/cost for free, exactly like M25/M26/M28/M29
 * — all extend the shared {@link BackgroundRunEngine} base (M9/run-engine.ts).
 * Shape follows M26 SourceReviewEngine most closely (uses the shared
 * `enqueueBatched`/`runBatchWithUsage` orchestration); the scope here is
 * always one entry × its translated languages, dispatched as a single
 * provider batch (`customBatchSizeOverride: 0`) so the model sees every
 * language's before/after edit-transfer in one call rather than split
 * across chunked requests.
 */
import {
  type BatchDispatchOptions,
  type GlobalConfig,
  type LQAResult,
  type Project,
  type RunCharTotals,
  type RunDetailEntry,
  type RunDetailPreviousValue,
  type RunDetails,
  type StringEntry,
  type TranslationJob,
  type TranslationModule,
  type TranslationResult,
  RunStatusCode,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import {
  moduleRegistry as defaultModuleRegistry,
  type ModuleRegistry,
} from './M6-module-registry.js';
import type {
  GlobalConfigStore,
  ProjectStore,
  RelinkRetranslateRecord,
  RunStore,
  StringStore,
} from '../storage/types.js';
import { getGlobalConfigStore, getProjectStore, getStringStore } from '../storage/registry.js';
import { getCurrentTenant, runWithTenant } from '../storage/pg/tenant-context.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { lqaGate } from './M10-lqa-gate.js';
import { defaultPricingProvider, type PricingProvider } from './M9/usage-pricing.js';
import { selectCapableModule, type ModuleLogFn } from './M9/module-selection.js';
import { BackgroundRunEngine, type LoggerLike } from './M9/run-engine.js';
import { assertRunCapacity } from './M9/run-capacity.js';

export class RelinkRetranslateNotPossibleError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'RelinkRetranslateNotPossibleError';
  }
}

export interface RelinkRetranslateRequest {
  /** The relink target entry — already carries the merged translations. */
  entryId: string;
  /** The orphan's source text before the edit (the "before" reference). */
  oldSourceText: string;
  /**
   * The orphan's translations by language, captured BEFORE the relink
   * persisted (the true previous-source translations). Optional for
   * back-compat; without it the prompt lists only the entry's current texts.
   */
  previousTranslations?: Record<string, string>;
  /**
   * The target entry's translations by language captured BEFORE the relink
   * merged the orphan's texts in. Optional; defaults to the post-merge texts.
   */
  currentTranslations?: Record<string, string>;
  /** Explicit module selection; otherwise the cheapest AI-capable module. */
  moduleId?: string;
  /** Per-run model override. */
  model?: string;
  /** Per-run reasoning-effort override (falls back to the module config's effort). */
  reasoningEffort?: string;
  /** When true, capture the module's prompt/response log to a sidecar. */
  verbose?: boolean;
}

interface RelinkRetranslateItem {
  /** Index within the batch (kept for parity with the other item shapes). */
  i: number;
  entryId: string;
  targetLanguage: string;
}

/**
 * Per-run accumulator behind the standard `details-<runId>.json` sidecar
 * (the same shape M9 persists — entries, char totals, previousValues — so the
 * Activity tab's "Show details" and "Revert" work identically for relink
 * runs). Populated during the run, flushed and dropped in {@link saveDetail}.
 * Retries stay empty: relink has no LQA retry pass, and batch-level 429
 * retries are not per-pair. `pairKeys` dedupes per (entry, language) in case
 * a split-retry re-delivers a result for an already-recorded pair.
 */
interface RelinkDetailsAcc {
  pairKeys: Set<string>;
  entries: RunDetailEntry[];
  previousValues: RunDetailPreviousValue[];
  chars: RunCharTotals;
}

/**
 * Builds the before/after edit-transfer instruction carried on each
 * TranslationJob's `taskInstruction` — the engine-authored, trusted-`Task:`-
 * line channel (see that field's doc comment; this is its canonical use),
 * rather than the untrusted per-item `context`, so it needs no new provider
 * method.
 *
 * ONE shared string for ALL of the entry's jobs, carrying every language's
 * data, for two reasons:
 * - Every prompt builder renders `taskInstruction` as the `Task:` line ONLY
 *   when every job of the call carries the IDENTICAL value (`hasUniformTask`
 *   in prompt-builder.ts) — a per-language string would fail that check and
 *   silently drop the instruction for every language in the batch, not just
 *   some.
 * - With `empty-only` relinks the post-merge text is NOT necessarily the
 *   previous-source translation (a kept current text was mislabeled as
 *   "from the PREVIOUS source"). The orphan's own translations — captured by
 *   the route BEFORE the relink persists — are the true previous-source
 *   reference, and the target's pre-relink texts are the current state.
 */
function buildEditTransferContext(opts: {
  oldSourceText: string;
  newSourceText: string;
  /** Orphan-entry translations by language (the PREVIOUS source's), pre-relink. */
  previousTranslations: Record<string, string>;
  /** Target-entry translations by language as stored when the run was prepared. */
  currentTranslations: Record<string, string>;
}): string {
  const previous = Object.keys(opts.previousTranslations).length
    ? `Translations of the PREVIOUS source, by language: ${JSON.stringify(opts.previousTranslations)}. `
    : '';
  return (
    `The source text for this string was edited. Previous source: ${JSON.stringify(opts.oldSourceText)}. ` +
    `New source: ${JSON.stringify(opts.newSourceText)}. ` +
    previous +
    `Translations currently stored on the entry, by language: ${JSON.stringify(opts.currentTranslations)}. ` +
    `For each requested target language, update that language's existing translation (preferring its ` +
    `PREVIOUS-source translation as the base when one is listed) to reflect the same edit that was made ` +
    `between the previous and new source text — preserve everything about the existing translation's ` +
    `wording and style except for the part that corresponds to the change, and return the updated ` +
    `translation only.`
  );
}

/**
 * Recomputes (and persists) the LQA verdict for one (entry, targetLanguage)
 * pair right after its translation text changes. Mirrors M9's `LqaGate`
 * dependency shape (`M9-translation-engine.ts`): the class itself defaults
 * this to a no-op — unit tests instantiate the engine directly with mock
 * stores and don't need a database — while the exported singleton below
 * wires the real check-and-persist implementation. Without this, a stale
 * verdict computed against the PRE-retranslate text (e.g. a number-parity
 * finding whose flagged number was only in the old text) would keep being
 * shown against text it no longer describes, since `setTranslation` alone
 * never touches `lqaResults`.
 */
type RelinkLqaGate = (
  entry: StringEntry,
  translatedText: string,
  projectId: string,
  targetLanguage: string,
) => Promise<LQAResult | undefined>;

export interface RelinkRetranslateEngineDeps {
  concurrency?: number;
  moduleRegistry?: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  stringStore?: Pick<StringStore, 'getById' | 'setTranslation'>;
  projectStore?: Pick<ProjectStore, 'loadProject'>;
  runStore?: RunStore;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  logger?: LoggerLike;
  pricing?: PricingProvider;
  lqaGate?: RelinkLqaGate;
}

export class RelinkRetranslateEngine extends BackgroundRunEngine<RelinkRetranslateRecord> {
  protected readonly logPrefix = 'relink-retranslate';
  private readonly details = new Map<string, RelinkDetailsAcc>();
  private readonly moduleRegistry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  // Resolve dependent stores lazily so a later per-test injection is honored
  // even by the module-level singleton — a bare `?? getXStore()` constructor
  // default would capture the store at import time and defeat the test seam.
  private readonly _stringStore?: Pick<StringStore, 'getById' | 'setTranslation'>;
  private get stringStore(): Pick<StringStore, 'getById' | 'setTranslation'> {
    return this._stringStore ?? getStringStore();
  }
  private readonly _projectStore?: Pick<ProjectStore, 'loadProject'>;
  private get projectStore(): Pick<ProjectStore, 'loadProject'> {
    return this._projectStore ?? getProjectStore();
  }
  private readonly _globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  private get globalConfigStore(): Pick<GlobalConfigStore, 'load'> {
    return this._globalConfigStore ?? getGlobalConfigStore();
  }
  // No-op by default (mirrors M9's `defaultLqaGate`) — the exported singleton
  // below overrides this with the real check-and-persist implementation.
  private readonly lqaGate: RelinkLqaGate;

  constructor(deps: RelinkRetranslateEngineDeps = {}) {
    super({
      concurrency: deps.concurrency ?? 2,
      ...(deps.runStore ? { runStore: deps.runStore } : {}),
      logger: deps.logger ?? defaultLogger,
      pricing: deps.pricing ?? defaultPricingProvider,
    });
    this.moduleRegistry = deps.moduleRegistry ?? defaultModuleRegistry;
    this.lqaGate = deps.lqaGate ?? (async () => undefined);
    this._stringStore = deps.stringStore;
    this._projectStore = deps.projectStore;
    this._globalConfigStore = deps.globalConfigStore;
  }

  protected override async saveDetail(
    projectId: string,
    runId: string,
    records: RelinkRetranslateRecord[],
  ): Promise<void> {
    await this.flushLogs(projectId, runId);
    await this.runStore.saveRelinkRetranslate(projectId, runId, records);
    const acc = this.details.get(runId);
    this.details.delete(runId);
    if (!acc) return;
    const detail: RunDetails = {
      runId,
      entries: acc.entries,
      retries: [],
      chars: acc.chars,
      previousValues: acc.previousValues,
    };
    // Best-effort like M9: a failed detail write never fails the run.
    await this.runStore.saveRunDetails(projectId, runId, detail).catch((err: unknown) => {
      this.logger.warn(`${this.logPrefix}:details-save-failed`, {
        runId,
        error: toErrorMessage(err),
      });
    });
  }

  /**
   * Picks the retranslate module/model. Precedence: an explicit request
   * override, then the cheapest enabled module capable of `retryWithFeedback`
   * (the AI SDK provider layer's marker for "reads context", present on every
   * LLM module and absent on classical-MT/QA modules). Throws
   * RelinkRetranslateNotPossibleError when nothing qualifies.
   */
  private selectModule(
    project: Project,
    global: GlobalConfig,
    sessionId: string | undefined,
    request: RelinkRetranslateRequest,
    logSink?: ModuleLogFn,
  ): { module: TranslationModule; moduleId: string } {
    return selectCapableModule(this.moduleRegistry, project, global, sessionId, {
      ...(request.moduleId !== undefined ? { requestedId: request.moduleId } : {}),
      ...(request.model ? { requestedModel: request.model } : {}),
      ...(request.reasoningEffort ? { requestedEffort: request.reasoningEffort } : {}),
      ...(request.verbose ? { verbose: true } : {}),
      ...(logSink ? { logSink } : {}),
      capability: (m) => typeof m.retryWithFeedback === 'function',
      notPossible: (msg) => new RelinkRetranslateNotPossibleError(msg),
      requestedFailLabel: `module "${request.moduleId}" cannot AI-retranslate`,
      noneAvailableMessage: 'no enabled AI-capable module available to retranslate',
    });
  }

  /**
   * Starts a retranslate run over every language that already has a
   * translation on `request.entryId` (post-relink). Resolves immediately with
   * the new run id; each language's `translate()` call runs on the queue.
   */
  async enqueue(
    projectId: string,
    request: RelinkRetranslateRequest,
    sessionId?: string,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT.
    await assertRunCapacity(this.runStore);
    // Capture the tenant on the request thread so the detached batch body
    // (scheduled on the JobQueue, run AFTER this request returns) re-establishes
    // it and its run-store/string-store writes stay tenant-scoped.
    const tenant = getCurrentTenant();

    // Resolved once, up front, so the run's persisted `request` scope (read
    // back by AI review — M25 JudgeEngine.enqueue) matches exactly the one
    // entry × its translated languages this run retranslates, instead of
    // JudgeEngine falling back to a whole-project scope reconstruction
    // because relink runs never recorded a `request`.
    const entry = await this.stringStore.getById(projectId, request.entryId);
    const languages = Object.entries(entry.translations)
      .filter(([, rec]) => !!rec?.text)
      .map(([lang]) => lang);

    // Captured by `buildItems` below (enqueueBatched calls it with the project
    // it already loaded via `loadContext`) so `dispatch`/`processBatch` can
    // read `sourceLanguage` without a second `loadProject` call per batch —
    // `enqueueBatched` resolves `buildItems` strictly before invoking `dispatch`.
    let loadedProject!: Project;

    return this.enqueueBatched<RelinkRetranslateItem>({
      projectId,
      loadContext: async () => ({
        project: await this.projectStore.loadProject(projectId),
        global: await this.globalConfigStore.load(),
      }),
      selectModule: (project, global, logSink) =>
        this.selectModule(project, global, sessionId, request, logSink),
      buildItems: async (project) => {
        loadedProject = project;
        const entriesById = new Map([[entry.id, entry]]);
        const items: RelinkRetranslateItem[] = languages.map((targetLanguage, i) => ({
          i,
          entryId: entry.id,
          targetLanguage,
        }));
        return { items, entriesById };
      },
      summary: {
        kind: 'relink-retranslate',
        relinkRetranslateSummary: { updated: 0, failed: 0 },
        request: { entryIds: [entry.id], targetLanguages: languages, reTranslate: false },
      },
      // One provider request per run: a relink run is always one entry × its
      // translated languages, and the model updates them most consistently
      // when it sees the whole edit-transfer at once. `0` = the enqueueBatched
      // "single batch, ignoreSizeLimit" mode: one packed batch here AND
      // dispatchOptions.ignoreSizeLimit so the provider layer's translate()
      // never re-chunks it at maxBatchSize (a multi-language batch then takes
      // the mixed-target structured-output schema in one call).
      batchSize: 1, // unused — customBatchSizeOverride wins; kept for the options type
      customBatchSizeOverride: 0,
      dispatch: ({ runId, module, moduleId, entriesById, records, batches, dispatchOptions }) => {
        this.details.set(runId, {
          pairKeys: new Set(),
          entries: [],
          previousValues: [],
          chars: { inputTotal: 0, inputSource: 0, outputTotal: 0, outputUsed: 0 },
        });
        const project = loadedProject;
        for (const batch of batches) {
          const body = () =>
            this.processBatch(
              runId,
              projectId,
              module,
              moduleId,
              batch,
              request,
              project,
              entriesById,
              records,
              dispatchOptions,
            );
          this.queue.add(runId, tenant ? () => runWithTenant(tenant, body) : body);
        }
      },
    });
  }

  private async processBatch(
    runId: string,
    projectId: string,
    module: TranslationModule,
    moduleId: string,
    batch: RelinkRetranslateItem[],
    request: RelinkRetranslateRequest,
    project: Project,
    entriesById: Map<string, StringEntry>,
    records: RelinkRetranslateRecord[],
    dispatchOptions: BatchDispatchOptions | undefined,
  ): Promise<void> {
    const entry = entriesById.get(request.entryId);
    const oldTextByLanguage = new Map(
      batch.map((item) => [
        item.targetLanguage,
        entry?.translations[item.targetLanguage]?.text ?? '',
      ]),
    );

    // One context string shared by every job (see buildEditTransferContext).
    // Fallbacks when the route didn't capture pre-relink snapshots: current
    // texts default to the post-merge entry state, previous texts to empty.
    const currentTranslations =
      request.currentTranslations ??
      Object.fromEntries(
        Object.entries(entry?.translations ?? {}).flatMap(([lang, rec]) =>
          rec?.text ? [[lang, rec.text]] : [],
        ),
      );
    const context = buildEditTransferContext({
      oldSourceText: request.oldSourceText,
      newSourceText: entry?.sourceText ?? '',
      previousTranslations: request.previousTranslations ?? {},
      currentTranslations,
    });

    await this.runBatchWithUsage<RelinkRetranslateItem, TranslationResult>({
      runId,
      moduleId,
      batch,
      dispatchOptions,
      call: (signal) => {
        const jobs: TranslationJob[] = batch.map((item) => ({
          entryId: item.entryId,
          sourceText: entry?.sourceText ?? '',
          sourceLanguage: project.sourceLanguage,
          targetLanguage: item.targetLanguage,
          taskInstruction: context,
        }));
        return module.translate(jobs, signal, dispatchOptions);
      },
      failureKey: (item) => ({ entryId: item.entryId, targetLanguage: item.targetLanguage }),
      usageOf: (result) => result.usage,
      onResult: async (result, status) => {
        const acc = this.details.get(runId);
        if (acc && result.usage) {
          acc.chars.inputTotal += result.usage.promptChars ?? 0;
          acc.chars.inputSource += result.usage.sourceChars ?? 0;
          acc.chars.outputTotal += result.usage.responseChars ?? 0;
          acc.chars.outputUsed += result.usage.outputChars ?? 0;
        }
        const oldText = oldTextByLanguage.get(result.targetLanguage) ?? '';
        if (result.error || !result.translatedText) {
          const message = result.error ?? 'empty translation result';
          this.recordFailure(
            status,
            { entryId: result.entryId, targetLanguage: result.targetLanguage },
            message,
          );
          const summary = (status.relinkRetranslateSummary ??= { updated: 0, failed: 0 });
          summary.failed++;
          records.push({
            targetLanguage: result.targetLanguage,
            oldText,
            newText: '',
            error: message,
          });
          return;
        }
        const pairKey = `${result.entryId}\0${result.targetLanguage}`;
        if (acc && !acc.pairKeys.has(pairKey)) {
          acc.pairKeys.add(pairKey);
          acc.previousValues.push({
            entryId: result.entryId,
            targetLanguage: result.targetLanguage,
            previousValue: entry?.translations[result.targetLanguage] ?? null,
          });
          acc.entries.push({
            entryId: result.entryId,
            sourceText: entry?.sourceText ?? '',
            targetLanguage: result.targetLanguage,
          });
        }
        try {
          await this.stringStore.setTranslation(projectId, result.entryId, result.targetLanguage, {
            text: result.translatedText,
            status: 'translated',
            moduleId,
            timestamp: Date.now(),
            needsReview: true,
            runId,
          });
          // Recompute this language's LQA verdict against the text that was
          // just written — see the RelinkLqaGate doc comment above. `entry`
          // is always resolvable in practice (one entryId per run, loaded
          // into entriesById up front); the guard mirrors this method's
          // existing defensive `entry?.` usage rather than introducing a new
          // failure mode.
          if (entry) {
            await this.lqaGate(entry, result.translatedText, projectId, result.targetLanguage);
          }
        } catch (err) {
          const message = toErrorMessage(err);
          this.recordFailure(
            status,
            { entryId: result.entryId, targetLanguage: result.targetLanguage },
            message,
          );
          const summary = (status.relinkRetranslateSummary ??= { updated: 0, failed: 0 });
          summary.failed++;
          records.push({
            targetLanguage: result.targetLanguage,
            oldText,
            newText: '',
            error: message,
          });
          return;
        }
        status.completed++;
        const summary = (status.relinkRetranslateSummary ??= { updated: 0, failed: 0 });
        summary.updated++;
        records.push({
          targetLanguage: result.targetLanguage,
          oldText,
          newText: result.translatedText,
        });
        this.logger.info('relink-retranslate:done', {
          runId,
          entryId: result.entryId,
          targetLanguage: result.targetLanguage,
        });
      },
    });
  }
}

export const relinkRetranslateEngine = new RelinkRetranslateEngine({
  lqaGate: async (entry, translatedText, projectId, targetLanguage) => {
    const lqa = await lqaGate.check(entry, translatedText, targetLanguage, { projectId });
    // Pass ONLY this language's verdict — updateEntry merges it into the
    // fresh on-disk lqaResults, preserving every sibling language exactly
    // like M9's own lqaGate wiring (M9-translation-engine.ts).
    await getStringStore().updateEntry(projectId, entry.id, {
      lqaResults: { [targetLanguage]: lqa },
    });
    return lqa;
  },
});
