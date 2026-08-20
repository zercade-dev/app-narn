/**
 * AI glossary generator.
 *
 * Asks an LLM module to analyse the project's SOURCE entries and suggest
 * glossaries — each a named group of recurring custom terms and proper nouns
 * (names). Report-only: it returns suggestions for the user to review/accept in
 * the UI; it never writes glossaries itself and never translates.
 *
 * Module selection mirrors M26 SourceReviewEngine.selectModule: an explicit
 * `moduleId` wins, otherwise the cheapest enabled module that implements
 * `suggestGlossaries`. Per-run `model`/`reasoningEffort` overrides are applied
 * through the same resolveEffectiveModuleConfig → createWithConfig path.
 */
import type {
  BatchGroupingDimension,
  EntryContextField,
  EntryContextSource,
  GlobalConfig,
  GlossarySuggestItem,
  GlossarySuggestion,
  Project,
  ProjectModuleConfigEntry,
  TranslationModule,
  TranslationUsage,
} from '@zercade-dev/narn-shared';
import {
  batchGroupKey,
  collectEntryContext,
  FREEWAY_MODULE_ID,
  GLOSSARY_SUGGEST_CHUNK_SIZE,
  groupAndPack,
  isExcludedFromAi,
  PSEUDO_LANGUAGE_CODE,
  resolveBatchGrouping,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import { moduleRegistry } from './M6-module-registry.js';
import {
  getGlobalConfigStore,
  getGlossaryStore,
  getProjectStore,
  getStringStore,
} from '../storage/registry.js';
import { logger } from './M15-console-logger.js';
import {
  selectCapableModule,
  selectFreewayBackgroundModule,
  type ModuleLogFn,
} from './M9/module-selection.js';
import { isRateLimitError, rateLimitCooldownMs } from './M9/errors.js';
import { coolBucket, recordDispatch } from './M32/bucket-source.js';
import { FREEWAY_BACKGROUND_RESERVE } from './M32/background-select.js';
import { resolveEffectiveModuleConfig } from './M19-global-config-store.js';

/** Cap the number of distinct source entries sent in one generate request. */
const MAX_SOURCE_ENTRIES = 2000;
/** Cap the number of excluded source values sent in the prompt. */
const MAX_EXCLUDED_SOURCES = 2000;

export class GlossaryGenerateNotPossibleError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'GlossaryGenerateNotPossibleError';
  }
}

export interface GenerateGlossaryRequest {
  /** Explicit module selection; otherwise the cheapest suggest-capable module. */
  moduleId?: string;
  /** Per-run model override. */
  model?: string;
  /** Per-run reasoning-effort override (module config key `reasoningEffort`). */
  reasoningEffort?: string;
  /**
   * Entries to analyse; defaults to all (needsTranslation, non-ignored) entries
   * in the project. Applied before `skipCategories`.
   */
  entryIds?: string[];
  /**
   * Glossary ids to exclude — their source values are sent as "already known"
   * so the model doesn't re-suggest terms already captured.
   */
  excludeGlossaryIds?: string[];
  /** Which per-entry context fields to add to the prompt. Empty/absent = none. */
  contextFields?: EntryContextField[];
  /** Active languages whose translated/reviewed translations to include. */
  contextLanguages?: string[];
  /** Per-run override of the resolved ignoreBatchSizeLimit (send all in one call). */
  ignoreBatchSizeLimit?: boolean;
  /**
   * Per-run grouping of source entries before suggesting (default 'none' — no
   * grouping). 'category' groups entries by their category footprint so each
   * LLM call holds related entries. Not inherited from project/workspace.
   */
  batchGrouping?: BatchGroupingDimension;
  /**
   * Per-run override of how many distinct source strings each provider call
   * holds. `0` means unlimited (every analysed entry in one call). Mutually
   * exclusive with `batchGrouping`/`ignoreBatchSizeLimit` — the dialog sends
   * one or the other. When present, forces related-entry footprint grouping
   * off for this run.
   */
  customBatchSize?: number;
  /**
   * Per-run filter: source entries carrying ANY of these categories are
   * excluded from the source list sent to the LLM entirely (never analyzed,
   * never billed). Entries with no categories are unaffected. Not inherited
   * from project/workspace.
   */
  skipCategories?: string[];
  /**
   * Per-run allowlist of EXACT source text values to focus generation on —
   * only entries whose trimmed `sourceText` matches one of these values
   * (verbatim, case-sensitive) are analysed. Combines with `entryIds` (both
   * are AND'd): useful when the caller knows the strings it cares about but
   * not their entry ids (e.g. a pasted list), or wants to further narrow an
   * `entryIds` selection. Empty/absent = no restriction. Not inherited from
   * project/workspace.
   */
  focusSourceTexts?: string[];
  /**
   * When true, the suggest call also EXTRACTS each suggested term's
   * translations (from the entries' existing translations sent as context)
   * for the context languages — see GlossarySuggestOptions.translationLanguages.
   * No-op unless `contextLanguages` selects at least one real active language.
   */
  includeTranslations?: boolean;
}

export interface GenerateGlossaryResult {
  suggestions: GlossarySuggestion[];
  /** Number of distinct source entries analysed (the prompt scope size). */
  analyzed: number;
  /** Per-provider-call usage collected across every suggest batch (for billing). */
  usages: TranslationUsage[];
  /** The resolved module id the suggest call actually ran against. */
  moduleId: string;
}

/**
 * Resolve the suggest-capable module (mirrors M26 selectModule). When the
 * selected instance is configured verbose AND a logSink is supplied, the module
 * is rebuilt with the verbose log routed to that sink (for sidecar capture).
 *
 * The `freeway` target resolves to a concrete free-tier bucket instead —
 * resolved once at the start of a run, and again (at most once) when a rate
 * limit outlives the retries in {@link generateGlossary}. Callers that can
 * bound the run's scope pass the reserve it should fence.
 */
async function selectSuggestModule(
  project: Project,
  global: GlobalConfig,
  sessionId: string | undefined,
  request: GenerateGlossaryRequest,
  logSink?: ModuleLogFn,
  reserveRequests?: number,
): Promise<{ module: TranslationModule; moduleId: string; bucketKey?: string }> {
  const requestedId = request.moduleId;
  const baseOpts = {
    ...(requestedId !== undefined ? { requestedId } : {}),
    ...(request.model ? { requestedModel: request.model } : {}),
    ...(request.reasoningEffort ? { requestedEffort: request.reasoningEffort } : {}),
    capability: (m: TranslationModule) => typeof m.suggestGlossaries === 'function',
    notPossible: (msg: string) => new GlossaryGenerateNotPossibleError(msg),
    // Only surfaced when a specific module was requested (selectCapableModule
    // picks this over noneAvailableMessage iff requestedId is set), so guard the
    // interpolation rather than render `module "undefined"`.
    requestedFailLabel: requestedId
      ? `module "${requestedId}" cannot generate glossaries`
      : 'no enabled glossary-generation-capable module available',
    noneAvailableMessage: 'no enabled glossary-generation-capable module available',
  };
  if (requestedId === FREEWAY_MODULE_ID) {
    const selection = await selectFreewayBackgroundModule(
      moduleRegistry,
      project,
      global,
      sessionId,
      {
        ...baseOpts,
        ...(logSink ? { logSink } : {}),
        ...(reserveRequests !== undefined ? { reserveRequests } : {}),
        noneAvailableMessage: 'no free-tier model is currently available to generate glossaries',
      },
    );
    return {
      module: selection.module,
      moduleId: selection.moduleId,
      bucketKey: selection.bucketKey,
    };
  }
  const selected = selectCapableModule(moduleRegistry, project, global, sessionId, baseOpts);
  const projectEntries = project.moduleConfigs as Record<
    string,
    ProjectModuleConfigEntry | undefined
  >;
  const effective = resolveEffectiveModuleConfig(
    selected.moduleId,
    global,
    projectEntries[selected.moduleId],
  );
  const verbose = (effective.config as { verbose?: unknown }).verbose === true;
  if (verbose && logSink) {
    const rebuilt = selectCapableModule(moduleRegistry, project, global, sessionId, {
      ...baseOpts,
      requestedId: selected.moduleId,
      verbose: true,
      logSink,
    });
    return { module: rebuilt.module, moduleId: selected.moduleId };
  }
  return { module: selected.module, moduleId: selected.moduleId };
}

/**
 * Collect the source values of the given glossaries, so the model can be told
 * to ignore terms already captured. De-duplicated; bounded for prompt size.
 */
async function collectExcludedSources(projectId: string, glossaryIds: string[]): Promise<string[]> {
  const seen = new Set<string>();
  for (const id of glossaryIds) {
    try {
      const glossary = await getGlossaryStore().getGlossary(projectId, id);
      for (const term of glossary.terms) {
        const source = term.source.trim();
        if (source) seen.add(source);
      }
    } catch {
      // unknown glossary id — skip
    }
  }
  return Array.from(seen).slice(0, MAX_EXCLUDED_SOURCES);
}

/**
 * Build the de-duplicated, context-enriched item list a glossary-suggest call
 * receives. One item per distinct trimmed source (entry id is the source hash,
 * so distinct source = distinct entry); the first occurrence of a trim-collision
 * wins. Pure + exported for unit testing.
 */
export function buildGlossarySuggestItems(
  entries: ReadonlyArray<EntryContextSource & { sourceText: string }>,
  opts: { fields: EntryContextField[]; languages: string[]; maxItems: number },
): GlossarySuggestItem[] {
  const seen = new Set<string>();
  const items: GlossarySuggestItem[] = [];
  for (const entry of entries) {
    const source = entry.sourceText.trim();
    if (!source || seen.has(source)) continue;
    seen.add(source);
    const ctx = collectEntryContext(entry, { fields: opts.fields, languages: opts.languages });
    items.push({ i: items.length, s: source, ...(ctx ? { ctx } : {}) });
    if (items.length >= opts.maxItems) break;
  }
  return items;
}

/**
 * Run AI glossary generation and return the suggestions (no persistence — the
 * UI creates the glossaries on accept).
 */
export async function generateGlossary(
  projectId: string,
  request: GenerateGlossaryRequest = {},
  sessionId?: string,
  signal?: AbortSignal,
  /**
   * Invoked after each internal batch settles with the cumulative count of
   * distinct source items analysed so far, so the M28 engine can report real
   * per-batch progress (matches the run's `total`, which is this same count).
   */
  onProgress?: (processed: number) => void,
  /**
   * Optional log sink for verbose capture: when the selected module instance's
   * config has `verbose: true`, the module is rebuilt with this sink so its
   * prompt/response log flows into the run's judge-logs sidecar.
   */
  logSink?: ModuleLogFn,
): Promise<GenerateGlossaryResult> {
  const [project, global, allEntries] = await Promise.all([
    getProjectStore().loadProject(projectId),
    getGlobalConfigStore().load(),
    getStringStore().load(projectId),
  ]);
  // Entries flagged `needsTranslation: false` are template/variable strings,
  // not real text — never suggest glossary terms from them. `ignored` entries
  // are excluded from every AI dispatch, glossary generation included.
  const entries = allEntries.filter((e) => e.needsTranslation !== false && !isExcludedFromAi(e));

  const excludedSources = await collectExcludedSources(projectId, request.excludeGlossaryIds ?? []);

  // Request-scoped filters (entryIds allowlist, then focusSourceTexts, then
  // skipCategories) apply on top of the basic-eligibility filters above,
  // mirroring M5's suggestCategories order.
  let scoped = entries;
  if (request.entryIds && request.entryIds.length > 0) {
    const wanted = new Set(request.entryIds);
    scoped = scoped.filter((e) => wanted.has(e.id));
  }
  if (request.focusSourceTexts && request.focusSourceTexts.length > 0) {
    const focus = new Set(
      request.focusSourceTexts.map((s) => s.trim()).filter((s) => s.length > 0),
    );
    scoped = scoped.filter((e) => focus.has(e.sourceText.trim()));
  }
  const skip = new Set(request.skipCategories ?? []);
  if (skip.size > 0) {
    scoped = scoped.filter((e) => !e.categories.some((c) => skip.has(c)));
  }

  const languages = (request.contextLanguages ?? []).filter((l) =>
    project.activeLanguages.includes(l),
  );
  // Extraction targets: the (already active-filtered) context languages minus
  // the synthetic pseudo-test language, which is never a real translation
  // target. Empty (→ omitted) unless the run asked for translations.
  const translationLanguages = request.includeTranslations
    ? languages.filter((l) => l !== PSEUDO_LANGUAGE_CODE)
    : [];
  // No early return here on an empty `scoped`: it always yields empty `items`
  // below too (buildItems/groupAndPack on an empty list produce nothing), so
  // the items.length===0 check further down already covers this case — and
  // module selection (needed either way for the returned moduleId) has to run
  // after items are sized for the free-tier reserve, not before.

  const { ignoreSizeLimit } = resolveBatchGrouping(project, global.settings);
  const customBatchSize = request.customBatchSize;
  const ignore =
    customBatchSize !== undefined
      ? customBatchSize === 0
      : (request.ignoreBatchSizeLimit ?? ignoreSizeLimit);
  const dimension = customBatchSize !== undefined ? 'none' : (request.batchGrouping ?? 'none');
  const cap =
    customBatchSize !== undefined && customBatchSize > 0
      ? customBatchSize
      : GLOSSARY_SUGGEST_CHUNK_SIZE;

  const buildItems = (es: typeof entries) =>
    buildGlossarySuggestItems(es, {
      fields: request.contextFields ?? [],
      languages,
      maxItems: MAX_SOURCE_ENTRIES,
    });

  let items;
  let batches;
  if (dimension !== 'none' || customBatchSize !== undefined) {
    // Group entries by footprint BEFORE dedup (items don't carry entryId). With
    // dimension='none' (the Custom-cap case) every entry shares the same key, so
    // this degrades to plain `cap`-sized chunking. `scoped` already excludes any
    // `skipCategories` matches.
    const entryBatches = groupAndPack(scoped, cap, ignore, (e) => batchGroupKey(e, dimension));
    batches = entryBatches.map(buildItems).filter((b) => b.length > 0);
    items = batches.flat();
  } else {
    items = buildItems(scoped);
    batches = undefined;
  }

  // The reserve a free-tier resolution should fence: this call's own scope
  // bounds how many provider calls it can make, sized from the real item
  // count (known only now that items are built) rather than a flat default.
  const reserveRequests = Math.max(
    FREEWAY_BACKGROUND_RESERVE,
    batches ? batches.length : ignore ? 1 : Math.ceil(items.length / cap),
  );
  let { module, moduleId, bucketKey } = await selectSuggestModule(
    project,
    global,
    sessionId,
    request,
    logSink,
    reserveRequests,
  );

  if (items.length === 0) return { suggestions: [], analyzed: 0, usages: [], moduleId };

  // A free-tier run binds to the resolved bucket for debiting/cooling; an
  // ordinary module selection leaves this undefined, so none of the ledger
  // traffic below ever runs for it. A re-route reassigns it, and the `onUsage`
  // debit below reads it at call time — so post-hop calls spend the NEW bucket.
  let binding = bucketKey !== undefined ? { bucketKey } : undefined;

  const suggestOptions = {
    excludedSources,
    ...(translationLanguages.length > 0 ? { translationLanguages } : {}),
    ...(onProgress ? { onProgress } : {}),
    ...(batches ? { batches } : ignore && items.length > 0 ? { chunkSize: items.length } : {}),
    // Debit each provider call against the bucket serving it AS IT RETURNS —
    // the returned `usages` never arrive when a later chunk rate-limits, so a
    // post-hoc debit both loses the calls made before the 429 and charges the
    // re-routed bucket for quota the struck one actually spent. Best-effort:
    // a ledger write must never fail a call whose provider work succeeded.
    ...(binding
      ? {
          onUsage: (usage: TranslationUsage) => {
            const bucket = binding?.bucketKey;
            if (bucket === undefined) return;
            void recordDispatch(bucket, Date.now(), {
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              chars: usage.characters ?? usage.sourceChars ?? 0,
            }).catch(() => undefined);
          },
        }
      : {}),
  };
  let result: Awaited<ReturnType<NonNullable<TranslationModule['suggestGlossaries']>>>;
  for (let hop = 0; ; hop++) {
    try {
      result = await module.suggestGlossaries!(items, suggestOptions, signal);
      break;
    } catch (err) {
      // One re-route hop: a free-tier call whose bucket rate-limited it moves
      // to a sibling bucket instead of failing while a healthy one idles. Only
      // for a Freeway-bound call, only on a rate limit, and only once — a
      // second exhaustion fails exactly as it always has.
      if (binding && isRateLimitError(err)) {
        // A call that threw still spent a request against the bucket.
        await recordDispatch(binding.bucketKey, Date.now(), {
          inputTokens: 0,
          outputTokens: 0,
          chars: 0,
        }).catch(() => undefined);
        await coolBucket(
          binding.bucketKey,
          Date.now(),
          rateLimitCooldownMs(err),
          undefined,
          'pool',
        ).catch(() => undefined);
        if (hop === 0) {
          try {
            const next = await selectSuggestModule(
              project,
              global,
              sessionId,
              request,
              logSink,
              reserveRequests,
            );
            if (next.bucketKey !== undefined) {
              logger.info('glossary-gen:freeway-rerouted', {
                projectId,
                from: binding.bucketKey,
                to: next.bucketKey,
                reason: 'rate-limit',
              });
              module = next.module;
              moduleId = next.moduleId;
              binding = { bucketKey: next.bucketKey };
              continue;
            }
          } catch (selectErr) {
            logger.warn('glossary-gen:freeway-reroute-select-failed', {
              projectId,
              error: toErrorMessage(selectErr),
            });
          }
        }
      }
      throw err;
    }
  }

  return {
    suggestions: result.suggestions,
    analyzed: items.length,
    usages: result.usages,
    moduleId,
  };
}

/**
 * Verifies a suggest-capable module can be resolved for the request, without
 * running generation — used by the M28 engine to fail fast at enqueue time so
 * the route can answer 409 (rather than the user only learning of the missing
 * module after a queued run flips to Failed). Throws
 * {@link GlossaryGenerateNotPossibleError} when no capable module is available.
 */
export async function assertSuggestModuleAvailable(
  projectId: string,
  request: GenerateGlossaryRequest = {},
  sessionId?: string,
): Promise<void> {
  const [project, global] = await Promise.all([
    getProjectStore().loadProject(projectId),
    getGlobalConfigStore().load(),
  ]);
  // Throws GlossaryGenerateNotPossibleError if nothing can suggest glossaries.
  await selectSuggestModule(project, global, sessionId, request);
}

/**
 * Counts the distinct, non-empty source entries that {@link generateGlossary}
 * would analyse for a project — used by the M28 engine to size a run's `total`
 * before the (whole-set) suggest call runs. Bounded the same way the generator
 * caps its prompt scope. Mirrors generateGlossary's exclusion of entries
 * flagged `needsTranslation: false` or `ignored`, and its `entryIds`/
 * `focusSourceTexts`/`skipCategories` scoping.
 */
export async function countGlossarySourceEntries(
  projectId: string,
  skipCategories?: string[],
  entryIds?: string[],
  focusSourceTexts?: string[],
): Promise<number> {
  const entries = await getStringStore().load(projectId);
  const skip = new Set(skipCategories ?? []);
  const wanted = entryIds && entryIds.length > 0 ? new Set(entryIds) : null;
  const focus =
    focusSourceTexts && focusSourceTexts.length > 0
      ? new Set(focusSourceTexts.map((s) => s.trim()).filter((s) => s.length > 0))
      : null;
  const seen = new Set<string>();
  let count = 0;
  for (const entry of entries) {
    if (entry.needsTranslation === false) continue;
    if (isExcludedFromAi(entry)) continue;
    if (wanted && !wanted.has(entry.id)) continue;
    if (focus && !focus.has(entry.sourceText.trim())) continue;
    if (skip.size > 0 && entry.categories.some((c) => skip.has(c))) continue;
    const source = entry.sourceText.trim();
    if (!source || seen.has(source)) continue;
    seen.add(source);
    count++;
    if (count >= MAX_SOURCE_ENTRIES) break;
  }
  return count;
}
