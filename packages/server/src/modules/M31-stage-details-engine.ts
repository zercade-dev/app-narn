/**
 * M31 — StageDetailsEngine
 *
 * Non-blocking background translation of a project's three stage-detail fields
 * (`name`, `gameplayDetails`, `stageDescription`) into the requested target
 * languages. Modeled as a run persisted via the RunStore and executed off the
 * request thread, so the Activity tab gets progress/cancel/history/cost for free
 * and the results land directly on the project's `stageDetails` (there is no
 * run-detail sidecar — see {@link saveDetail}).
 *
 * Unlike the string-translation hot path (M9), stage details are NOT string
 * entries: each field is a single source string with its own per-language
 * translations, so the engine sends one `module.translate` call per language
 * (jobs = the in-scope fields) and writes the results back onto the project.
 * A per-language failure is recorded and the run continues; every language
 * failing marks the run Failed, a partial success Completes with the errors kept.
 *
 * Shares the run/status/cancel/progress machinery with the other background
 * engines via the {@link BackgroundRunEngine} base (M9/run-engine.ts). Like M29
 * it does NOT use the JobQueue: it is a single fire-and-forget `run` that loops
 * the languages sequentially, so it has its own `run` rather than the base's
 * per-batch terminal flip.
 */
import {
  type AiRunModuleSelection,
  type GlobalConfig,
  type Project,
  type ProjectModuleConfigEntry,
  PSEUDO_LANGUAGE_CODE,
  PSEUDO_MODULE_ID,
  RunStatusCode,
  type StageDetailFieldId,
  STAGE_DETAIL_FIELD_IDS,
  type TranslationJob,
  type TranslationModule,
  isStaleTranslation,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import {
  moduleRegistry as defaultModuleRegistry,
  type ModuleRegistry,
} from './M6-module-registry.js';
import type { GlobalConfigStore, ProjectStore, RunStore } from '../storage/types.js';
import { getGlobalConfigStore, getProjectStore } from '../storage/registry.js';
import { resolveEffectiveModuleConfig } from './M19-global-config-store.js';
import { getCurrentTenant, runWithTenant } from '../storage/pg/tenant-context.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { isAbortError } from './M9/errors.js';
import { BackgroundRunEngine, type LoggerLike } from './M9/run-engine.js';
import { assertRunCapacity } from './M9/run-capacity.js';
import { selectCapableModule, type ModuleLogFn } from './M9/module-selection.js';
import {
  accumulateUsage,
  defaultPricingProvider,
  finalizeUsageCosts,
  type PricingProvider,
} from './M9/usage-pricing.js';

/** Per-field prompt context, guiding the model on register/length for each field. */
const FIELD_CONTEXT: Record<StageDetailFieldId, string> = {
  name: 'The in-game stage name. Short, evocative, a title — not a sentence.',
  gameplayDetails: 'A short gameplay summary shown to players. One or two sentences.',
  stageDescription:
    'The long, store-style stage description. Multiple sentences; keep paragraph breaks.',
};

export interface StageDetailsRunRequest {
  /** Target languages; defaults to the project's `activeLanguages`. */
  languages?: string[];
  /** Fields to translate; defaults to all three. */
  fields?: StageDetailFieldId[];
  /** When true, skip (field, language) pairs that already have a fresh translation. */
  staleOnly?: boolean;
  /** Explicit module selection; otherwise the persisted config, otherwise auto-pick. */
  moduleId?: string;
  /** Per-run model override. */
  model?: string;
  /** Per-run reasoning-effort override. */
  reasoningEffort?: string;
}

export interface StageDetailsEngineDeps {
  runStore?: RunStore;
  logger?: LoggerLike;
  pricing?: PricingProvider;
  registry?: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  projectStore?: Pick<ProjectStore, 'loadProject' | 'updateProject'>;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
}

/** Resolved requested module/model/effort for a run (from request, else config). */
interface RequestedSelection {
  requestedId?: string;
  requestedModel?: string;
  requestedEffort?: string;
}

export class StageDetailsEngine extends BackgroundRunEngine<never> {
  protected readonly logPrefix = 'stage-details';
  private readonly registry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  // Resolve the stores lazily so a later per-test injection (or a live registry
  // swap) is honored even by the module-level singleton — an eager
  // `?? getProjectStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _projectStore?: Pick<ProjectStore, 'loadProject' | 'updateProject'>;
  private get projectStore(): Pick<ProjectStore, 'loadProject' | 'updateProject'> {
    return this._projectStore ?? getProjectStore();
  }
  private readonly _globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  private get globalConfigStore(): Pick<GlobalConfigStore, 'load'> {
    return this._globalConfigStore ?? getGlobalConfigStore();
  }

  constructor(deps: StageDetailsEngineDeps = {}) {
    super({
      // Concurrency is unused (a single fire-and-forget run, not the JobQueue),
      // but the base constructor requires it.
      concurrency: 1,
      ...(deps.runStore ? { runStore: deps.runStore } : {}),
      logger: deps.logger ?? defaultLogger,
      pricing: deps.pricing ?? defaultPricingProvider,
    });
    this.registry = deps.registry ?? defaultModuleRegistry;
    this._projectStore = deps.projectStore;
    this._globalConfigStore = deps.globalConfigStore;
  }

  // M31 persists translations directly into the project's `stageDetails` (per
  // language, in `run`), NOT a run-detail sidecar; the base flush path is unused
  // (no detail buffer is registered), but the base requires the hook to exist.
  protected override saveDetail(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Starts a stage-details translation run. Returns the new run id and initial
   * status immediately; the LLM work runs in the background. Resolves the target
   * languages and fields, persists any explicit module/model/effort selection to
   * `project.stageDetailsConfig`, then fires the run body through `trackTask`
   * with tenant capture (mirrors M29's enqueue shape).
   */
  async enqueue(
    projectId: string,
    request: StageDetailsRunRequest,
    sessionId: string | undefined,
  ): Promise<{ runId: string; status: RunStatusCode }> {
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT (→ 429). No-op when
    // the cap is unset (single-user/local unchanged).
    await assertRunCapacity(this.runStore);

    const project = await this.projectStore.loadProject(projectId);

    // Requested selection: an explicit request override wins over the saved
    // config; when the request carries one, persist it so it becomes the default.
    const saved = project.stageDetailsConfig;
    const requested: RequestedSelection = {
      ...((request.moduleId ?? saved?.moduleId) !== undefined
        ? { requestedId: request.moduleId ?? saved?.moduleId }
        : {}),
      ...((request.model ?? saved?.model) !== undefined
        ? { requestedModel: request.model ?? saved?.model }
        : {}),
      ...((request.reasoningEffort ?? saved?.reasoningEffort) !== undefined
        ? { requestedEffort: request.reasoningEffort ?? saved?.reasoningEffort }
        : {}),
    };
    if (
      request.moduleId !== undefined ||
      request.model !== undefined ||
      request.reasoningEffort !== undefined
    ) {
      const config: AiRunModuleSelection = {
        ...(requested.requestedId !== undefined ? { moduleId: requested.requestedId } : {}),
        ...(requested.requestedModel !== undefined ? { model: requested.requestedModel } : {}),
        ...(requested.requestedEffort !== undefined
          ? { reasoningEffort: requested.requestedEffort }
          : {}),
      };
      await this.projectStore.updateProject(projectId, { stageDetailsConfig: config });
    }

    const languages = request.languages ?? project.activeLanguages;
    // Base field set (all three unless narrowed), then drop fields with no
    // source text — an empty field has nothing to translate.
    const requestedFields = request.fields ?? [...STAGE_DETAIL_FIELD_IDS];
    const fields = requestedFields.filter(
      (id) => (project.stageDetails?.[id]?.sourceText ?? '') !== '',
    );

    const status = await this.createRunStatus(projectId, languages.length, {
      kind: 'stage-details',
      status: RunStatusCode.Running,
    });
    const runId = status.runId;

    const controller = new AbortController();
    this.controllers.set(runId, controller);
    const { logSink, logs } = this.buildLogSink();
    this.registerLogs(runId, logs);
    this.logger.info('stage-details:queued', { runId, projectId, languages: languages.length });
    // Warm the pricing feed in the background (mirrors the base startRun, which
    // this engine doesn't call — see saveDetail) so finalizeUsageCosts() at run
    // completion finds a loaded cache instead of paying a cold fetch serially.
    if (this.pricing) void this.pricing.ensure().catch(() => {});

    // Capture the tenant on the request thread so the fire-and-forget run body —
    // which executes AFTER this request returns — re-establishes it and its
    // store writes stay tenant-scoped.
    const tenant = getCurrentTenant();
    const body = () =>
      this.run(
        runId,
        projectId,
        languages,
        fields,
        request.staleOnly === true,
        requested,
        sessionId,
        controller.signal,
        logSink,
      );
    const tracked = () => this.trackTask(runId, body);
    void (tenant ? runWithTenant(tenant, tracked) : tracked());

    return { runId, status: RunStatusCode.Running };
  }

  /**
   * Resolves the module for one language: the synthetic pseudo-test language
   * always routes to the pseudo module; a real language uses the requested
   * id/model/effort but explicitly EXCLUDES pseudo from the capability set, so an
   * explicit pseudo request for a real language fails that language (notPossible)
   * and the free pseudo module never wins the cheapest-first auto-pick.
   */
  private selectModuleForLanguage(
    project: Project,
    global: GlobalConfig,
    sessionId: string | undefined,
    lang: string,
    requested: RequestedSelection,
    logSink: ModuleLogFn,
  ): { module: TranslationModule; moduleId: string; model?: string } {
    if (lang === PSEUDO_LANGUAGE_CODE) {
      return selectCapableModule(this.registry, project, global, sessionId, {
        requestedId: PSEUDO_MODULE_ID,
        logSink,
        capability: () => true,
        notPossible: (msg) => new Error(msg),
        requestedFailLabel: 'cannot translate stage details',
        noneAvailableMessage: 'No translate-capable module is enabled',
      });
    }
    const selected = selectCapableModule(this.registry, project, global, sessionId, {
      ...(requested.requestedId !== undefined ? { requestedId: requested.requestedId } : {}),
      ...(requested.requestedModel ? { requestedModel: requested.requestedModel } : {}),
      ...(requested.requestedEffort ? { requestedEffort: requested.requestedEffort } : {}),
      logSink,
      capability: (m) => typeof m.translate === 'function' && m.id !== PSEUDO_MODULE_ID,
      notPossible: (msg) => new Error(msg),
      requestedFailLabel: 'cannot translate stage details',
      noneAvailableMessage: 'No translate-capable module is enabled',
    });
    // The effective model this run will use: an explicit per-run override, else
    // the module's resolved config default (may be absent for a classical-MT
    // module like DeepL). Surfaced so an auto-pick run can persist it as the
    // chat default (see run()); `selectCapableModule` itself returns only the id.
    const projectEntry = (
      project.moduleConfigs as Record<string, ProjectModuleConfigEntry | undefined>
    )[selected.moduleId];
    const model =
      requested.requestedModel ??
      (resolveEffectiveModuleConfig(selected.moduleId, global, projectEntry).config.model as
        string | undefined);
    return { ...selected, ...(model ? { model } : {}) };
  }

  private async run(
    runId: string,
    projectId: string,
    languages: string[],
    fields: StageDetailFieldId[],
    staleOnly: boolean,
    requested: RequestedSelection,
    sessionId: string | undefined,
    signal: AbortSignal,
    logSink: ModuleLogFn,
  ): Promise<void> {
    const status = this.runs.get(runId);
    if (!status) return;
    try {
      const project = await this.projectStore.loadProject(projectId);
      if (!project.stageDetails) {
        throw new Error('project has no stage details to translate');
      }
      const global = await this.globalConfigStore.load();

      // On an auto-pick run (no explicit/persisted module) the chat panel would
      // otherwise have no `stageDetailsConfig` to point at, so it can't tell
      // which AI to use. Persist the FIRST resolved real-language selection as
      // the default (once, and only if no config exists yet) — pseudo-only runs
      // never reach this because pseudo languages are skipped below.
      const isAutoPick = requested.requestedId === undefined;
      let autoPickPersisted = false;

      for (const lang of languages) {
        if (signal.aborted || status.status !== RunStatusCode.Running) return;

        // Resolve the module for this language; a resolution failure fails only
        // this language and the run continues to the next.
        let selected: { module: TranslationModule; moduleId: string; model?: string };
        try {
          selected = this.selectModuleForLanguage(
            project,
            global,
            sessionId,
            lang,
            requested,
            logSink,
          );
        } catch (err) {
          this.recordFailure(
            status,
            { entryId: `stage:${lang}`, targetLanguage: lang },
            toErrorMessage(err),
          );
          this.emitProgress(status);
          continue;
        }
        const { module, moduleId } = selected;

        // First successful real-language resolution on an auto-pick run: seed
        // `stageDetailsConfig` so the chat assistant knows which module/model to
        // use. Reload-then-write (mirrors the translation writes) and skip if a
        // config already exists — an explicit-request run persists in enqueue().
        if (isAutoPick && !autoPickPersisted && lang !== PSEUDO_LANGUAGE_CODE) {
          autoPickPersisted = true;
          const forCfg = await this.projectStore.loadProject(projectId);
          if (!forCfg.stageDetailsConfig) {
            const config: AiRunModuleSelection = {
              moduleId,
              ...(selected.model ? { model: selected.model } : {}),
            };
            await this.projectStore.updateProject(projectId, { stageDetailsConfig: config });
          }
        }

        // Build one job per in-scope field, reloading the latest source so a
        // concurrent PATCH edit is reflected. Under staleOnly, skip a field whose
        // translation for this language is already fresh.
        const latest = await this.projectStore.loadProject(projectId);
        const details = latest.stageDetails;
        if (!details) {
          throw new Error('project has no stage details to translate');
        }
        const jobs: TranslationJob[] = [];
        for (const fieldId of fields) {
          const field = details[fieldId];
          if (field.sourceText === '') continue;
          if (staleOnly && field.translations[lang] && !isStaleTranslation(field, lang)) continue;
          jobs.push({
            entryId: `stage:${fieldId}`,
            sourceText: field.sourceText,
            targetLanguage: lang,
            sourceLanguage: latest.sourceLanguage,
            context:
              FIELD_CONTEXT[fieldId] +
              (field.maxLength ? ` Hard limit: at most ${field.maxLength} characters.` : ''),
          });
        }
        if (jobs.length === 0) {
          // Nothing to translate for this language (all fresh under staleOnly).
          status.completed++;
          this.emitProgress(status);
          continue;
        }

        let results;
        try {
          results = await module.translate(jobs, signal);
        } catch (err) {
          if (isAbortError(err) || signal.aborted) return;
          this.recordFailure(
            status,
            { entryId: `stage:${lang}`, targetLanguage: lang },
            toErrorMessage(err),
          );
          this.emitProgress(status);
          continue;
        }

        // Fold usage BEFORE the cancel check: the provider call already happened
        // (and cost money) regardless of whether a cancel raced in.
        accumulateUsage(
          status,
          moduleId,
          results.map((r) => r.usage).filter((u): u is NonNullable<typeof u> => Boolean(u)),
        );

        // A cancel that landed while the call was in flight wins: don't persist.
        // (cast: cancel() mutates status.status out of band, which control-flow
        // analysis can't see from the top-of-loop Running guard — see the base.)
        if (signal.aborted || (status.status as RunStatusCode) === RunStatusCode.Cancelled) return;

        // Reload before writing so a concurrent PATCH edit is not clobbered
        // wholesale (last-write-wins per field is accepted single-user semantics).
        const forWrite = await this.projectStore.loadProject(projectId);
        const writeDetails = forWrite.stageDetails;
        if (!writeDetails) {
          throw new Error('project has no stage details to translate');
        }
        const byEntry = new Map(results.map((r) => [r.entryId, r]));
        // Tracks whether ANY field for this language was actually written below —
        // a language whose fields all came back with `result.error` (e.g. every
        // field failed to parse from the provider response) must NOT count as
        // completed just because the call itself didn't throw.
        let anyFieldWritten = false;
        for (const fieldId of fields) {
          const result = byEntry.get(`stage:${fieldId}`);
          if (!result || result.error) {
            if (result?.error) {
              this.recordFailure(
                status,
                { entryId: `stage:${fieldId}`, targetLanguage: lang },
                result.error,
              );
            }
            continue;
          }
          writeDetails[fieldId].translations[lang] = {
            text: result.translatedText,
            moduleId,
            timestamp: Date.now(),
          };
          anyFieldWritten = true;
        }
        await this.projectStore.updateProject(projectId, { stageDetails: writeDetails });
        if (anyFieldWritten) status.completed++;
        this.emitProgress(status);
      }

      if (this.pricing) await finalizeUsageCosts(status, this.pricing);

      // A run where every language failed ⇒ Failed; a partial (or all-fresh) ⇒
      // Completed with the per-language errors kept.
      const allFailed = status.total > 0 && status.completed === 0;
      await this.flushLogs(projectId, runId);
      status.status = allFailed ? RunStatusCode.Failed : RunStatusCode.Completed;
      status.finishedAt = Date.now();
      this.logger.info('stage-details:done', {
        runId,
        projectId,
        completed: status.completed,
        failed: status.failed,
        status: status.status,
      });
    } catch (err) {
      if (isAbortError(err) || signal.aborted) {
        // Cancellation already set the terminal state in `cancel`.
        return;
      }
      status.status = RunStatusCode.Failed;
      status.finishedAt = Date.now();
      const message = toErrorMessage(err);
      status.errors.push({ message, timestamp: Date.now() });
      await this.flushLogs(projectId, runId);
      this.logger.error('stage-details:failed', { runId, projectId, error: message });
    } finally {
      this.controllers.delete(runId);
      this.clearExtraBuffers(runId);
      await this.runStore.updateRun(projectId, status).catch((e) => {
        this.logger.error('stage-details:store-update-failed', {
          runId,
          error: e instanceof Error ? e.message : `${e}`,
        });
      });
    }
  }
}

export const stageDetailsEngine = new StageDetailsEngine();
