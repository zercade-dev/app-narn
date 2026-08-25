/**
 * M25 — JudgeEngine
 *
 * Report-only LLM-as-judge pass over everything a completed translation run
 * produced. Modeled as a run persisted via the RunStore and executed on M9's JobQueue
 * pattern, so the Runs tab gets progress/cancel/history for free. Verdicts
 * are stored as LQA issues with `checkId: 'llm-judge'` on the entry's
 * existing lqaResults (warning severity — the gate's pass/fail is untouched).
 *
 * The shared run/queue/sidecar/cancel machinery lives in the
 * {@link BackgroundRunEngine} base (M9/run-engine.ts); this subclass keeps only
 * the judge-specific scope, batch body, and persistence.
 */
import {
  FREEWAY_MODULE_ID,
  type GlobalConfig,
  type GlossaryTerm,
  type JudgeItem,
  type JudgeChecks,
  type JudgeVerdict,
  type JudgeVerdictRecord,
  type LQAIssue,
  type LQAResult,
  type Project,
  type RunRequest,
  RunStatusCode,
  type RunStatus,
  type RoutingRule,
  type RunEntryLanguagePair,
  type StringEntry,
  type TranslationModule,
  type BatchDispatchOptions,
  type BatchGroupingDimension,
  suggestionDropsFormatting,
  projectTargetLanguages,
  effectivePromptOptions,
  isExcludedFromAi,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import { router as defaultRouter, type Router } from './M7-router.js';
import {
  moduleRegistry as defaultModuleRegistry,
  type ModuleRegistry,
} from './M6-module-registry.js';
import type { GlobalConfigStore, ProjectStore, RunStore, StringStore } from '../storage/types.js';
import {
  getGlobalConfigStore,
  getGlossaryStore,
  getProjectStore,
  getStringStore,
} from '../storage/registry.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import { getCurrentTenant, runWithTenant } from '../storage/pg/tenant-context.js';
import { defaultPricingProvider, type PricingProvider } from './M9/usage-pricing.js';
import {
  selectCapableModule,
  selectFreewayBackgroundModule,
  type ModuleLogFn,
} from './M9/module-selection.js';
import { DEFAULT_BACKGROUND_BAND, FREEWAY_BACKGROUND_RESERVE } from './M32/background-select.js';
import type { BucketSourceDeps } from './M32/bucket-source.js';
import { batchSizeFor, effectivePassRate } from './M32/scoring.js';
import type { BucketView, JobGroup } from './M32/types.js';
import {
  BackgroundRunEngine,
  sanitizeLLMText,
  type FreewayBatchBinding,
  type LoggerLike,
} from './M9/run-engine.js';
import { assertRunCapacity } from './M9/run-capacity.js';
import { resolveRoutingRules } from './M9/resolve-routing.js';

export const LLM_JUDGE_CHECK_ID = 'llm-judge';

/** Items judged per provider call — the default for a non-Freeway module, and
 *  the resolver's own fallback when a Freeway run has no bucket yet. */
const JUDGE_BATCH_SIZE = 10;

/**
 * Sizing scores against neutral English even for a judge run that knows its
 * real languages. The per-language signal is restricted to EXCLUDING a weak
 * bucket (see the selector's language filter); letting it also shrink batches
 * would make a soft quality number move throughput, which is a different and
 * riskier kind of change. Exclusion and sizing stay independent.
 */
const NEUTRAL_SIZING_LANGUAGE = 'en';

export class JudgeNotPossibleError extends Error {
  // 409 by default; a missing source run is a not-found condition (404). Mapped
  // centrally by the error handler.
  readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = 'JudgeNotPossibleError';
    this.statusCode = message === 'source run not found' ? 404 : 409;
  }
}

/**
 * Reconstructs a review scope for a run that has no recorded `request`
 * (legacy runs created before the field was persisted on the direct path).
 * Once the original request is gone the best available approximation of "what
 * this run touched" is every entry, across the project's non-source active
 * languages. `enqueue`'s (entry, language) loop is the authoritative filter —
 * it skips pairs that have no stored translation — so we deliberately leave
 * `entryIds` unfiltered here rather than duplicating that check.
 */
function reconstructScope(project: Project, entries: StringEntry[]): RunRequest {
  const targetLanguages = project.activeLanguages.filter((lang) => lang !== project.sourceLanguage);
  return { entryIds: entries.map((e) => e.id), targetLanguages, reTranslate: false };
}

/**
 * Per-run module/model selection for an AI review, chosen in the AI-review
 * dialog. Both fields are optional; an absent field falls back to the project's
 * `judgeConfig` and then the cheapest judge-capable module.
 */
export interface JudgeOverride {
  moduleId?: string;
  model?: string;
  /** Per-run reasoning-effort override (module config key `reasoningEffort`). */
  reasoningEffort?: string;
  /**
   * When true, the judge module logs the full prompt/params it sends and the
   * raw model response (gated on the AI SDK provider's `verbose` flag). Chosen
   * per-run in the AI-review dialog for debugging; off by default.
   */
  verbose?: boolean;
  /**
   * Language code (LANGUAGE_REGISTRY) the AI writes its findings/explanations
   * in. Chosen per-run in the AI-review dialog. Affects only the natural-language
   * output, never the scoring logic; absent or `'en'` keeps the default English.
   */
  responseLanguage?: string;
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
  /**
   * When present, restricts the review to exactly these (entryId, targetLanguage)
   * pairs instead of the source run's full scope. Used by "retry failed reviews".
   */
  pairs?: RunEntryLanguagePair[];
  /**
   * When present and non-empty, restricts the review to exactly these target
   * languages (a subset of the source run's own scope) instead of every
   * language that run covered. Used by the AI-review dialog's language
   * picker. Absent ⇒ unrestricted (today's behavior). Mutually exclusive in
   * practice with `pairs` (retry-failed sets `pairs`, the dialog sets
   * `languages` — never both).
   */
  languages?: string[];
  /**
   * Opt-in quality checks (typo/grammar/clarity/unsafe), chosen in the
   * AI-review dialog. Attached to every built `JudgeItem` unchanged; see
   * {@link JudgeItem.checks} for what each field does (including
   * `terminology`'s no-op status).
   */
  checks?: JudgeChecks;
}

export type JudgeGlossaryProvider = (
  projectId: string,
  targetLanguage: string,
  entry?: StringEntry,
) => Promise<GlossaryTerm[]>;

export interface JudgeEngineDeps {
  concurrency?: number;
  router?: Router;
  moduleRegistry?: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  stringStore?: Pick<StringStore, 'load' | 'updateEntry' | 'mutateLqaResult'>;
  projectStore?: Pick<ProjectStore, 'loadProject'>;
  runStore?: RunStore;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  glossaryProvider?: JudgeGlossaryProvider;
  logger?: LoggerLike;
  pricing?: PricingProvider;
  /** Bucket-source overrides used when a run selects the free-tier target. */
  freeway?: BucketSourceDeps;
}

const defaultGlossaryProvider: JudgeGlossaryProvider = async (projectId, targetLanguage, entry) => {
  const project = await getProjectStore().loadProject(projectId);
  const glossaryIds = entry?.assignedGlossaryIds ?? project.forcedGlossaryIds ?? [];
  return getGlossaryStore().getTermsForLanguage(
    projectId,
    targetLanguage,
    glossaryIds,
    projectTargetLanguages(project),
  );
};

// LLM-produced LQA `detail`/`suggestion` text is sanitized via the shared
// `sanitizeLLMText` (control chars / whitespace) before persisting, but NOT
// truncated: these are the user-facing AI explanation, so capping them cut the
// sentence off mid-way in the review UI. The UI renders the full text
// (expandable when long); see TranslationAiReviewTab.

export class JudgeEngine extends BackgroundRunEngine<JudgeVerdictRecord> {
  protected readonly logPrefix = 'judge';
  private readonly router: Router;
  private readonly moduleRegistry: Pick<ModuleRegistry, 'listModules' | 'createWithConfig'>;
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _stringStore?: Pick<StringStore, 'load' | 'updateEntry' | 'mutateLqaResult'>;
  private get stringStore(): Pick<StringStore, 'load' | 'updateEntry' | 'mutateLqaResult'> {
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
  private readonly glossaryProvider: JudgeGlossaryProvider;
  /** Injected Freeway bucket-source overrides (ledger / status / cloud mode). */
  private readonly freewayOverrides: BucketSourceDeps;

  constructor(deps: JudgeEngineDeps = {}) {
    super({
      concurrency: deps.concurrency ?? 2,
      // Raw injected store (tests); the base's lazy getter resolves the live
      // registry store via getRunStore() when this is absent.
      ...(deps.runStore ? { runStore: deps.runStore } : {}),
      logger: deps.logger ?? defaultLogger,
      pricing: deps.pricing ?? defaultPricingProvider,
    });
    this.router = deps.router ?? defaultRouter;
    this.moduleRegistry = deps.moduleRegistry ?? defaultModuleRegistry;
    this._stringStore = deps.stringStore;
    this._projectStore = deps.projectStore;
    this._globalConfigStore = deps.globalConfigStore;
    this.glossaryProvider = deps.glossaryProvider ?? defaultGlossaryProvider;
    this.freewayOverrides = deps.freeway ?? {};
  }

  protected override async saveDetail(
    projectId: string,
    runId: string,
    records: JudgeVerdictRecord[],
  ): Promise<void> {
    // Flush the verbose log sidecar (best-effort) before the verdict sidecar so
    // both writes complete before the run is reported terminal.
    await this.flushLogs(projectId, runId);
    // Merge-write under the store's per-project write lock rather than a blind
    // full-array overwrite: a suggestVerdict() that landed between an item's
    // judgment and this terminal flush exists only in the stored sidecar, and a
    // plain saveVerdicts would erase it. The in-memory buffer stays
    // authoritative for verdict content; stored suggestions are carried onto
    // buffered records that lack one, and stored-only records (suggestVerdict
    // on an item outside this flush) are kept.
    await this.runStore.updateVerdicts(projectId, runId, (stored) => {
      const key = (r: JudgeVerdictRecord) => `${r.entryId} ${r.targetLanguage}`;
      const storedByKey = new Map(stored.map((r) => [key(r), r]));
      const merged = records.map((rec) => {
        const prior = storedByKey.get(key(rec));
        if (!prior || prior.suggestion === undefined || rec.suggestion !== undefined) return rec;
        return {
          ...rec,
          suggestion: prior.suggestion,
          ...(prior.suggestionDropsFormatting ? { suggestionDropsFormatting: true } : {}),
        };
      });
      const buffered = new Set(records.map(key));
      for (const s of stored) if (!buffered.has(key(s))) merged.push(s);
      return merged;
    });
  }

  /**
   * Picks the judge module/model. Precedence: the per-run `override` (chosen in
   * the AI-review dialog), then the project's `judgeConfig`, then the cheapest
   * enabled judge-capable module. The free-tier target resolves to a concrete
   * bucket instead (see below). Throws JudgeNotPossibleError when nothing can
   * judge.
   */
  private async selectJudgeModule(
    project: Project,
    global: GlobalConfig,
    sessionId: string | undefined,
    override?: JudgeOverride,
    logSink?: ModuleLogFn,
    reserveRequests?: number,
    languages?: readonly string[],
  ): Promise<{
    module: TranslationModule;
    moduleId: string;
    bucketKey?: string;
    bucket?: BucketView;
  }> {
    const requestedId = override?.moduleId ?? project.judgeConfig?.moduleId;
    const requestedModel = override?.model ?? project.judgeConfig?.model;
    const requestedEffort = override?.reasoningEffort ?? project.judgeConfig?.reasoningEffort;
    const options = {
      ...(requestedEffort ? { requestedEffort } : {}),
      ...(override?.verbose ? { verbose: true } : {}),
      ...(logSink ? { logSink } : {}),
      capability: (m: TranslationModule) => typeof m.judgeTranslations === 'function',
      notPossible: (msg: string) => new JudgeNotPossibleError(msg),
      noneAvailableMessage: 'no enabled judge-capable module available',
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
        ...(languages !== undefined ? { languages } : {}),
        noneAvailableMessage: 'no free-tier model is currently available to judge translations',
      });
    }
    return selectCapableModule(this.moduleRegistry, project, global, sessionId, {
      ...options,
      requestedFailLabel: `module "${requestedId}" cannot judge translations`,
      ...(requestedId !== undefined ? { requestedId } : {}),
      ...(requestedModel ? { requestedModel } : {}),
    });
  }

  /**
   * Re-routes one (entry, targetLanguage) through M7 to recover the rule's
   * promptOptions (voice/tone guidance) the translation was produced with. M7
   * is pure and cheap. The available-module list is the distinct module ids the
   * given rules reference, shaped as the router expects. `rules` is the review
   * runner's effective routing (owner→project rules, collaborator→their collab
   * doc), resolved ONCE per flow via {@link resolveRoutingRules} and threaded in
   * — never re-resolved per entry.
   */
  private routeEntry(entry: StringEntry, targetLanguage: string, rules: RoutingRule[]) {
    return this.router.route(
      entry,
      targetLanguage,
      rules,
      [...new Set(rules.map((r) => r.moduleId))].map((id) => ({ id })),
    );
  }

  /**
   * Starts an AI-review run, either over everything `sourceRunId` translated
   * or — when `sourceRunId` is absent (the project-scoped "review all
   * translations" route) — over every current entry/language, via the same
   * `reconstructScope` fallback already used for legacy runs with no
   * persisted `request`. Returns the new judge run. Throws
   * JudgeNotPossibleError for unusable source runs, an empty review scope, or
   * when no judge module is available.
   */
  async enqueue(
    projectId: string,
    sourceRunId: string | undefined,
    sessionId: string | undefined,
    override?: JudgeOverride,
  ): Promise<{ runId: string; total: number; status: RunStatusCode }> {
    // Per-tenant run-concurrency cap: refuse before creating the run when the
    // tenant is already at MAX_CONCURRENT_RUNS_PER_TENANT (→ 429). No-op when
    // the cap is unset (single-user/local unchanged).
    await assertRunCapacity(this.runStore);
    const sourceRun = sourceRunId ? await this.runStore.getRun(projectId, sourceRunId) : null;
    if (sourceRunId) {
      if (!sourceRun) throw new JudgeNotPossibleError('source run not found');
      if (sourceRun.kind === 'judge') {
        throw new JudgeNotPossibleError('cannot judge an AI-review run');
      }
    }

    // Capture the tenant on the request thread (context active here) so each
    // detached `processBatch` body — scheduled on the JobQueue in `dispatch` and
    // run AFTER this request returns — re-establishes it (each detached run
    // body is its own tenant-context seam) so its run-store/string-store
    // writes stay tenant-scoped.
    const tenant = getCurrentTenant();

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
    // and replaced by a mid-run re-route; undefined for non-Freeway runs.
    let bucket: BucketView | undefined;

    // The reserve the free-tier selector should fence: this run's own scope
    // bounds how many provider calls it can make, so it fences the larger of
    // that and the flat default. A run whose scope is reconstructed from the
    // whole project has no such bound, so the flat fence stands alone.
    const scope = sourceRun?.request;
    const itemsPerCall =
      override?.customBatchSize !== undefined && override.customBatchSize > 0
        ? override.customBatchSize
        : JUDGE_BATCH_SIZE;
    // A pair-restricted run (the retranslate-below-tier action, "retry failed")
    // translated far fewer pairs than its entryIds × targetLanguages product,
    // and `buildItems` reviews exactly those pairs — so size the fence on the
    // same number, or the run fences capacity it can never spend.
    const scopePairs = override?.pairs ?? scope?.pairs;

    // The languages this run will actually review, for the selector's
    // exclude-only language filter. Derived from the SAME scope the reserve is
    // sized from, so a run can never fence one set of pairs and be routed for
    // another. A run whose scope is reconstructed after selection
    // (`reconstructScope` below) has no languages to offer here and is scored
    // neutral, exactly as every background run was before: reordering the run
    // to make them available earlier would be a far larger change than the
    // routing improvement is worth.
    const judgeLanguages = scope
      ? [
          ...new Set(
            (scopePairs
              ? scopePairs.map((p) => p.targetLanguage)
              : scope.targetLanguages
            ).filter((l) => (override?.languages ? override.languages.includes(l) : true)),
          ),
        ]
      : undefined;

    const reserveRequests = scope
      ? Math.max(
          FREEWAY_BACKGROUND_RESERVE,
          Math.ceil(
            (scopePairs
              ? scopePairs.length
              : scope.entryIds.length * scope.targetLanguages.length) / itemsPerCall,
          ),
        )
      : undefined;

    return this.enqueueBatched<JudgeItem>({
      projectId,
      loadContext: async () => ({
        project: await this.projectStore.loadProject(projectId),
        global: await this.globalConfigStore.load(),
      }),
      selectModule: async (project, global, logSink) => {
        const selected = await this.selectJudgeModule(
          project,
          global,
          sessionId,
          override,
          logSink,
          reserveRequests,
          judgeLanguages,
        );
        target = { module: selected.module, moduleId: selected.moduleId };
        if (selected.bucketKey !== undefined) {
          freeway = { bucketKey: selected.bucketKey, deps: this.freewayOverrides };
          bucket = selected.bucket;
          makeFreewayReroute = (selection) => async () => {
            try {
              // The struck bucket is cooled before this runs, so the selector
              // offers a different one (or nothing, and the batch fails).
              const next = await this.selectJudgeModule(
                project,
                global,
                sessionId,
                override,
                logSink,
                reserveRequests,
                judgeLanguages,
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
        const allEntries = await this.stringStore.load(projectId);
        // Modern runs carry their request; legacy/request-less runs (e.g. created
        // before the field was persisted on the direct path) and the no-run
        // "review all translations" path (sourceRun is null) reconstruct the
        // review scope from the project's entries so AI review still works.
        let scope = sourceRun?.request;
        if (!scope) {
          scope = reconstructScope(project, allEntries);
          // Reconstruction needs something to review; a project with no entries or
          // no non-source target language yields an empty scope — fail clearly
          // rather than starting an empty run.
          if (scope.entryIds.length === 0 || scope.targetLanguages.length === 0) {
            throw new JudgeNotPossibleError(
              sourceRunId
                ? 'source run has no recorded request'
                : 'project has no translations to review',
            );
          }
        }

        // When override.languages is set, restrict to that subset of the run's
        // own target languages (used by the AI-review dialog's language
        // picker); otherwise review every language the run covered.
        const targetLanguages = override?.languages
          ? scope.targetLanguages.filter((l) => override.languages!.includes(l))
          : scope.targetLanguages;

        const wanted = new Set(scope.entryIds);
        // `ignored` entries are excluded from every AI dispatch, judging included.
        const entries = allEntries.filter((e) => wanted.has(e.id) && !isExcludedFromAi(e));
        const entriesById = new Map(entries.map((e) => [e.id, e]));

        // Restrict to exactly these (entry, language) pairs; otherwise the full
        // scope cross-product. Two independent sources, override first: the
        // AI-review dialog's "retry failed" narrows THIS review, while the run's
        // own `request.pairs` records that the run itself only ever translated
        // a subset of its product (the retranslate-below-tier action). Judging
        // the product of a pair-restricted run would write verdicts onto
        // translations that run never touched.
        const pairSource = override?.pairs ?? scope.pairs;
        const pairFilter = pairSource
          ? new Set(pairSource.map((p) => `${p.entryId} ${p.targetLanguage}`))
          : null;

        // Resolve the glossary once per (targetLanguage, glossary-id set) rather
        // than once per (entry, targetLanguage): the default glossaryProvider
        // does its own loadProject + glossary-store query on every call, so the
        // naive per-entry await here was an O(entries × languages) N+1 in the
        // request path. Entries that share the same assigned glossary ids (the
        // common case — most share the project's forcedGlossaryIds) collapse to
        // one resolve per language.
        const glossaryCache = new Map<string, Promise<GlossaryTerm[]>>();
        const glossaryFor = (
          targetLanguage: string,
          entry: StringEntry,
        ): Promise<GlossaryTerm[]> => {
          const ids = entry.assignedGlossaryIds;
          const key =
            ids !== undefined
              ? `${targetLanguage}\0${[...ids].sort().join('\0')}`
              : `${targetLanguage}\0__project__`;
          let cached = glossaryCache.get(key);
          if (!cached) {
            cached = this.glossaryProvider(projectId, targetLanguage, entry);
            glossaryCache.set(key, cached);
          }
          return cached;
        };

        // The review runner's effective routing, resolved once (owner→project
        // rules, collaborator→their collab doc) and threaded into every routeEntry.
        const routingRules = await resolveRoutingRules(project);
        const items: JudgeItem[] = [];
        for (const entry of entries) {
          for (const targetLanguage of targetLanguages) {
            if (targetLanguage === project.sourceLanguage) continue;
            if (pairFilter && !pairFilter.has(`${entry.id} ${targetLanguage}`)) continue;
            const translatedText = entry.translations[targetLanguage]?.text;
            if (!translatedText) continue;
            const decision = this.routeEntry(entry, targetLanguage, routingRules);
            const glossary = await glossaryFor(targetLanguage, entry);
            items.push({
              entryId: entry.id,
              targetLanguage,
              sourceText: entry.sourceText,
              translatedText,
              sourceLanguage: project.sourceLanguage,
              context: entry.context,
              promptOptions: effectivePromptOptions(entry, decision.promptOptions),
              glossary,
              ...(override?.responseLanguage
                ? { responseLanguage: override.responseLanguage }
                : {}),
              ...(override?.checks ? { checks: override.checks } : {}),
            });
          }
        }
        return { items, entriesById };
      },
      summary: {
        kind: 'judge',
        ...(sourceRunId ? { sourceRunId } : {}),
        judgeSummary: { judged: 0, flagged: 0 },
      },
      // Sized to the bucket the run landed on: a fixed constant either overruns
      // a char-tight bucket's per-call budget on prose, or spends several times
      // the daily requests a high-capacity/low-rpd bucket needed. Falls back to
      // the flat constant for every non-Freeway module, which has no bucket.
      //
      // `sourceText` here is a LENGTH PROXY for the whole judge payload
      // (source + translation), never a value that is sent anywhere:
      // charCappedBatch sums sourceText alone, so passing the bare source
      // would undercount the payload by roughly half.
      batchSize: (items: JudgeItem[]) => {
        if (!bucket) return JUDGE_BATCH_SIZE;
        const group: JobGroup = {
          targetLanguage: NEUTRAL_SIZING_LANGUAGE,
          band: DEFAULT_BACKGROUND_BAND,
          jobs: items.map((item) => ({
            entryId: item.entryId,
            targetLanguage: NEUTRAL_SIZING_LANGUAGE,
            sourceText: item.sourceText + item.translatedText,
            maskCount: 0,
            hasLengthLimit: false,
            glossaryTermCount: 0,
          })),
        };
        return batchSizeFor(
          bucket,
          group,
          effectivePassRate(bucket, NEUTRAL_SIZING_LANGUAGE, DEFAULT_BACKGROUND_BAND),
        );
      },
      // Per-run override (AI-review dialog) → project → workspace → none.
      ...(override?.batchGrouping !== undefined
        ? { batchGroupingOverride: override.batchGrouping }
        : {}),
      ...(override?.ignoreBatchSizeLimit !== undefined
        ? { ignoreBatchSizeLimitOverride: override.ignoreBatchSizeLimit }
        : {}),
      ...(override?.customBatchSize !== undefined
        ? { customBatchSizeOverride: override.customBatchSize }
        : {}),
      dispatch: ({ runId, module, moduleId, entriesById, records, batches, dispatchOptions }) => {
        // Mean score needs the sum; keep it engine-side and derive averageScore.
        let scoreSum = 0;
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
              entriesById,
              records,
              {
                addScore: (score: number) => {
                  scoreSum += score;
                },
                scoreTotal: () => scoreSum,
              },
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

  /**
   * Re-runs the judge on only the (entry, language) pairs that failed in a prior
   * terminal judge run. Extracts failed (entry, language) pairs from the run's
   * `errors[]` (deduplicating by stringId+targetLang), then re-enqueues a fresh
   * judge run scoped to those pairs against the original `sourceRunId`.
   * Returns null when the run is missing, non-judge/non-terminal (Running, Paused,
   * or Queued), or has no extractable failed pairs.
   */
  async retryFailed(
    projectId: string,
    judgeRunId: string,
    sessionId: string | undefined,
  ): Promise<{ runId: string; total: number; status: RunStatusCode } | null> {
    const run = this.runs.get(judgeRunId) ?? (await this.runStore.getRun(projectId, judgeRunId));
    if (!run || run.kind !== 'judge' || !run.sourceRunId) return null;

    if (
      run.status === RunStatusCode.Running ||
      run.status === RunStatusCode.Paused ||
      run.status === RunStatusCode.Queued
    ) {
      return null;
    }

    const seen = new Set<string>();
    const pairs: RunEntryLanguagePair[] = [];
    for (const err of run.errors) {
      if (!err.stringId || !err.targetLang) continue;
      const key = `${err.stringId} ${err.targetLang}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ entryId: err.stringId, targetLanguage: err.targetLang });
    }
    if (pairs.length === 0) return null;

    return this.enqueue(projectId, run.sourceRunId, sessionId, { pairs });
  }

  /**
   * On-demand single-item judge that ALWAYS produces a suggestion.
   *
   * Backs the "Generate suggestion" action: re-runs the judge module on one
   * (entry, targetLanguage) with the forced-suggestion prompt variant, then
   * persists the resulting suggestion onto the run's stored verdict (replacing
   * the matching record's `suggestion`) and returns the updated record.
   *
   * Synchronous (not queued) — it judges exactly one item — so the caller gets
   * the updated verdict back directly. Throws JudgeNotPossibleError when the
   * run/entry/translation is missing or no judge module is available.
   */
  async suggestVerdict(
    projectId: string,
    runId: string,
    entryId: string,
    targetLanguage: string,
    sessionId: string | undefined,
    instructions?: string,
  ): Promise<JudgeVerdictRecord> {
    const run = await this.runStore.getRun(projectId, runId);
    if (!run || run.kind !== 'judge') throw new JudgeNotPossibleError('judge run not found');

    const project = await this.projectStore.loadProject(projectId);
    const global = await this.globalConfigStore.load();
    // Verbose re-request: the per-run verbose choice isn't persisted
    // anywhere except its effect — the judge-logs sidecar. A run started
    // verbose has lines there; tee this single-item call into the same
    // sidecar and force the module verbose, mirroring the batch path.
    const priorLogs = await this.runStore.getJudgeLogs(projectId, runId);
    const runWasVerbose = priorLogs.length > 0;
    const { logSink, logs } = this.buildLogSink();
    const { module, moduleId, bucketKey } = await this.selectJudgeModule(
      project,
      global,
      sessionId,
      runWasVerbose ? { verbose: true } : undefined,
      runWasVerbose ? logSink : undefined,
    );

    const entries = await this.stringStore.load(projectId);
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) throw new JudgeNotPossibleError('entry not found');
    // `ignored` entries are excluded from every AI dispatch — this on-demand
    // single-item judge call is one, same as the batch path above.
    if (isExcludedFromAi(entry))
      throw new JudgeNotPossibleError(entry.ignored ? 'entry is ignored' : 'entry is orphaned');
    const translatedText = entry.translations[targetLanguage]?.text;
    if (!translatedText) throw new JudgeNotPossibleError('entry has no translation to review');

    // Recover the rule's promptOptions the translation was produced with, the
    // same way `enqueue` does, so the forced suggestion respects voice/tone.
    // This tenant's effective routing (owner→project, collaborator→collab doc).
    const routingRules = await resolveRoutingRules(project);
    const decision = this.routeEntry(entry, targetLanguage, routingRules);
    const glossary = await this.glossaryProvider(projectId, targetLanguage, entry);
    const item: JudgeItem = {
      entryId,
      targetLanguage,
      sourceText: entry.sourceText,
      translatedText,
      sourceLanguage: project.sourceLanguage,
      context: entry.context,
      promptOptions: effectivePromptOptions(entry, decision.promptOptions),
      glossary,
      forceSuggestion: true,
      ...(instructions ? { userGuidance: instructions } : {}),
    };

    let verdicts;
    try {
      verdicts = await module.judgeTranslations!([item]);
      // One provider call, debited against the run's bucket when this
      // single-item judge is running on the free-tier target.
      await this.recordFreewayDispatch(
        bucketKey !== undefined ? { bucketKey, deps: this.freewayOverrides } : undefined,
        verdicts.map((v) => v.usage),
      );
    } finally {
      if (runWasVerbose && logs.length > 0) {
        await this.runStore
          .saveJudgeLogs(projectId, runId, [...priorLogs, ...logs])
          .catch((err: unknown) => {
            this.logger.warn('judge:suggest-save-logs-failed', {
              runId,
              error: toErrorMessage(err),
            });
          });
      }
    }
    const verdict = verdicts[0];
    if (!verdict || verdict.error || verdict.suggestion === undefined) {
      throw new JudgeNotPossibleError(
        verdict?.error ?? 'judge did not return a suggestion for this item',
      );
    }
    this.logger.info('judge:suggest-done', { runId, moduleId, entryId, targetLanguage });

    // Persist the generated suggestion onto the stored verdict: under the
    // store's per-project write lock, replace the matching record's suggestion
    // (creating one if the verdict somehow isn't present) in one atomic
    // read-modify-write, so a concurrent regenerate / judge flush can't clobber
    // this write.
    const suggestion = sanitizeLLMText(verdict.suggestion);
    const dropsFormatting = suggestionDropsFormatting(translatedText, suggestion);
    // No-op suggestion: the model echoed the current translation (it judged it
    // already optimal, despite being forced to return something). Persisting it
    // would inflate the pending-suggestion count and render as an already-applied
    // suggestion. Instead persist the verdict WITHOUT a suggestion and return it
    // so the client can tell the reviewer "no change suggested".
    const noChange = suggestion.trim() === translatedText.trim();
    let result!: JudgeVerdictRecord;
    await this.runStore.updateVerdicts(projectId, runId, (records) => {
      const idx = records.findIndex(
        (r) => r.entryId === entryId && r.targetLanguage === targetLanguage,
      );
      const base: JudgeVerdictRecord =
        idx >= 0
          ? records[idx]
          : {
              entryId,
              targetLanguage,
              verdict: verdict.verdict,
              score: verdict.score,
              issues: verdict.issues.map((i) => ({
                type: i.type,
                detail: sanitizeLLMText(i.detail),
              })),
              judgedText: translatedText,
            };
      // Rebuild the record so a regenerated clean suggestion clears a stale
      // formatting flag left by a prior one (rather than carrying it forward).
      const next: JudgeVerdictRecord = {
        entryId: base.entryId,
        targetLanguage: base.targetLanguage,
        verdict: base.verdict,
        score: base.score,
        issues: base.issues,
        ...(noChange ? {} : { suggestion }),
        ...(base.judgedText !== undefined ? { judgedText: base.judgedText } : {}),
        ...(!noChange && dropsFormatting ? { suggestionDropsFormatting: true } : {}),
      };
      if (idx >= 0) records[idx] = next;
      else records.push(next);
      result = next;
      return records;
    });
    if (noChange) {
      this.logger.info('judge:suggest-no-change', { runId, moduleId, entryId, targetLanguage });
    }
    return result;
  }

  /**
   * Removes the stored suggestion (and its formatting flag) from a run's
   * verdict — the persisted counterpart of the UI's "discard suggestion".
   * Pure stored-data edit: no module call, so no vault/session needed.
   * Throws JudgeNotPossibleError when the run isn't a judge run or the
   * (entry, language) verdict doesn't exist.
   */
  async discardSuggestion(
    projectId: string,
    runId: string,
    entryId: string,
    targetLanguage: string,
  ): Promise<JudgeVerdictRecord> {
    const run = await this.runStore.getRun(projectId, runId);
    if (!run || run.kind !== 'judge') throw new JudgeNotPossibleError('judge run not found');
    // Atomic read-modify-write under the store's per-project write lock; a
    // missing verdict throws inside the mutator, rolling the tx back (no write).
    let updated!: JudgeVerdictRecord;
    await this.runStore.updateVerdicts(projectId, runId, (records) => {
      const idx = records.findIndex(
        (r) => r.entryId === entryId && r.targetLanguage === targetLanguage,
      );
      if (idx < 0) throw new JudgeNotPossibleError('verdict not found');
      const { suggestion: _suggestion, suggestionDropsFormatting: _flag, ...rest } = records[idx];
      updated = { ...rest };
      records[idx] = updated;
      return records;
    });
    this.logger.info('judge:suggestion-discarded', { runId, entryId, targetLanguage });
    return updated;
  }

  private async processBatch(
    runId: string,
    projectId: string,
    /** Held by reference: a mid-run re-route replaces the module in place. */
    selection: { module: TranslationModule; moduleId: string },
    batch: JudgeItem[],
    entriesById: Map<string, StringEntry>,
    verdictRecords: JudgeVerdictRecord[],
    scores: { addScore: (score: number) => void; scoreTotal: () => number },
    dispatchOptions?: BatchDispatchOptions,
    freeway?: FreewayBatchBinding,
    freewayReroute?: () => Promise<FreewayBatchBinding | undefined>,
  ): Promise<void> {
    // The exact (restored) text each item was judged against, so the verdict
    // record can carry it forward — the live translation may change or vanish
    // before the AI-review detail is opened.
    const judgedTextByPair = new Map(
      batch.map((item) => [`${item.entryId}::${item.targetLanguage}`, item.translatedText]),
    );

    await this.runBatchWithUsage<JudgeItem, JudgeVerdict>({
      runId,
      moduleId: selection.moduleId,
      batch,
      dispatchOptions,
      call: (signal) => selection.module.judgeTranslations!(batch, signal, dispatchOptions),
      failureKey: (item) => item,
      usageOf: (verdict) => verdict.usage,
      ...(freeway ? { freeway } : {}),
      ...(freewayReroute ? { freewayReroute } : {}),
      onComplete: (s) => this.stampSourceRun(s),
      onResult: async (verdict, status) => {
        if (verdict.error) {
          this.recordFailure(status, verdict, verdict.error);
          return;
        }
        const entry = entriesById.get(verdict.entryId);
        if (!entry) {
          this.recordFailure(status, verdict, 'entry not found');
          return;
        }
        try {
          await this.persistVerdict(projectId, entry, verdict);
        } catch (err) {
          this.recordFailure(status, verdict, err instanceof Error ? err.message : `${err}`);
          return;
        }
        status.completed++;
        const summary = (status.judgeSummary ??= { judged: 0, flagged: 0 });
        summary.judged++;
        if (verdict.verdict === 'fail' || verdict.issues.length > 0) summary.flagged++;
        scores.addScore(verdict.score);
        summary.averageScore = Math.round(scores.scoreTotal() / summary.judged);
        const judgedText = judgedTextByPair.get(`${verdict.entryId}::${verdict.targetLanguage}`);
        verdictRecords.push({
          entryId: verdict.entryId,
          targetLanguage: verdict.targetLanguage,
          verdict: verdict.verdict,
          score: verdict.score,
          issues: verdict.issues.map((i) => ({ type: i.type, detail: sanitizeLLMText(i.detail) })),
          ...(verdict.suggestion ? { suggestion: sanitizeLLMText(verdict.suggestion) } : {}),
          ...(verdict.suggestionDropsFormatting ? { suggestionDropsFormatting: true } : {}),
          ...(judgedText !== undefined ? { judgedText } : {}),
        });
        this.logger.info('judge:done', {
          runId,
          entryId: verdict.entryId,
          targetLanguage: verdict.targetLanguage,
          verdict: verdict.verdict,
          score: verdict.score,
        });
      },
    });
  }

  /**
   * Writes the completed review's average score onto the reviewed translation
   * run (`aiScore`), so the Runs tab can show the run was already reviewed.
   * Best-effort: a vanished source run or a failed write never fails the
   * judge run itself.
   */
  private async stampSourceRun(status: RunStatus): Promise<void> {
    const score = status.judgeSummary?.averageScore;
    if (!status.sourceRunId || score === undefined) return;
    try {
      const sourceRun = await this.runStore.getRun(status.projectId, status.sourceRunId);
      if (!sourceRun) return;
      sourceRun.aiScore = score;
      await this.runStore.updateRun(status.projectId, sourceRun);
    } catch (err) {
      this.logger.warn('judge:source-run-stamp-failed', {
        runId: status.runId,
        sourceRunId: status.sourceRunId,
        error: err instanceof Error ? err.message : `${err}`,
      });
    }
  }

  /**
   * Replaces previous llm-judge issues for the (entry, language) pair with
   * the new verdict's issues. Warning severity only — the judge is
   * report-only in v1 and never flips the gate's pass/fail.
   */
  private async persistVerdict(
    projectId: string,
    entry: StringEntry,
    verdict: JudgeVerdict,
  ): Promise<void> {
    // Read-modify-write ONLY the judged language's verdict under the store's
    // write lock, basing the merge on the FRESH stored verdict (`current`), not
    // the run-start `entry` snapshot. Siblings were already safe (single-key
    // write), but the SAME language would be reverted if a concurrent
    // translation re-gated it (new E/L pass/overflow) mid-judge — basing on the
    // stale snapshot dropped that. `mutateLqaResult` hands us the current
    // per-language result so the judge issues append to it instead.
    const persisted = await this.stringStore.mutateLqaResult(
      projectId,
      entry.id,
      verdict.targetLanguage,
      (current) => {
        const base: LQAResult = current ?? {
          passed: true,
          issues: [],
          overflow: false,
          overflowRatio: 0,
        };
        const issues: LQAIssue[] = base.issues.filter((i) => i.checkId !== LLM_JUDGE_CHECK_ID);
        for (const issue of verdict.issues) {
          issues.push({
            type: `judge-${issue.type}`,
            detail: sanitizeLLMText(issue.detail),
            checkId: LLM_JUDGE_CHECK_ID,
            severity: 'warning',
          });
        }
        if (verdict.suggestion && verdict.verdict === 'fail') {
          issues.push({
            type: 'judge-suggestion',
            detail: sanitizeLLMText(verdict.suggestion),
            checkId: LLM_JUDGE_CHECK_ID,
            severity: 'warning',
          });
        }
        return { ...base, issues };
      },
    );
    // Keep the in-memory snapshot consistent for any later language of the same
    // entry in this batch — mirror the persisted per-language result.
    entry.lqaResults = persisted.lqaResults;
  }
}

export const judgeEngine = new JudgeEngine();
