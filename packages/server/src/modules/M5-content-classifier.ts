import type { StringEntry } from '@zercade-dev/narn-shared';
import {
  generateCategorySuggestions,
  parseModuleInstanceId,
  deriveInstanceCredentialKey,
  resolveBatchGrouping,
  collectEntryContext,
  groupAndPack,
  batchGroupKey,
  CATEGORY_CHUNK_SIZE,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_TOKENS,
  resolveUseStructuredOutput,
  coerceBoolean,
  isExcludedFromAi,
  type BatchGroupingDimension,
  type CategorySuggestion,
  type GenerateCategorySuggestionsResult,
  type ProviderType,
} from '@zercade-dev/narn-shared';
import type { EntryContextField } from '@zercade-dev/narn-shared';
import { ValidationError } from '../types/errors.js';
import type {
  GlobalConfigStore,
  GlossaryStore,
  ProjectStore,
  StringStore,
} from '../storage/types.js';
import {
  getGlobalConfigStore,
  getGlossaryStore,
  getProjectStore,
  getStringStore,
} from '../storage/registry.js';
import { resolveEffectiveModuleConfig } from './M19-global-config-store.js';
import { credentialStore as defaultCredentialStore } from './M16-credential-store.js';
import { logger as defaultLogger } from './M15-console-logger.js';
import type { ModuleLogFn } from './M9/module-selection.js';

const MAX_CATEGORY_LENGTH = 64;

/**
 * Maps each structured-generation-capable LLM module id to its AI SDK provider
 * and the vault credential key it reads. Only these modules can generate
 * category suggestions; translation-only providers (deepl) and the
 * runtime-token Copilot module are deliberately excluded. generic-ai routes to
 * `openai-compatible` and uses the shared GENERIC_API_KEY vault slot.
 */
const CATEGORY_CAPABLE_MODULES: Record<string, { provider: ProviderType; credentialKey: string }> =
  {
    openai: { provider: 'openai', credentialKey: 'OPENAI_API_KEY' },
    anthropic: { provider: 'anthropic', credentialKey: 'ANTHROPIC_API_KEY' },
    google: { provider: 'google', credentialKey: 'GOOGLE_API_KEY' },
    deepseek: { provider: 'deepseek', credentialKey: 'DEEPSEEK_API_KEY' },
    openrouter: { provider: 'openrouter', credentialKey: 'OPENROUTER_API_KEY' },
    groq: { provider: 'groq', credentialKey: 'GROQ_API_KEY' },
    'generic-ai': { provider: 'openai-compatible', credentialKey: 'GENERIC_API_KEY' },
  };

export interface SuggestCategoriesRequest {
  /** Module to run the suggestion with; must be category-capable. */
  moduleId: string;
  /** Per-run model override; falls back to the module's configured/default. */
  model?: string;
  /** Per-run reasoning-effort override. */
  reasoningEffort?: string;
  /** Entries to classify; defaults to all entries in the project. */
  entryIds?: string[];
  /**
   * When true, the existing project category vocabulary is included so the
   * model can also assign entries into current categories, not only invent new
   * ones.
   */
  includeExisting?: boolean;
  /** Soft target for how many categories the model proposes. */
  maxCategories?: number;
  /** Which per-entry context fields to add to the prompt. Empty/absent = none. */
  contextFields?: EntryContextField[];
  /** Active languages whose translated/reviewed translations to include. */
  contextLanguages?: string[];
  /** Per-run override of the resolved ignoreBatchSizeLimit (send all in one call). */
  ignoreBatchSizeLimit?: boolean;
  /**
   * Per-run grouping of source entries before suggesting (default 'none').
   * 'glossary' groups entries by their assigned-glossary footprint. Not
   * inherited from project/workspace.
   */
  batchGrouping?: BatchGroupingDimension;
  /**
   * Per-run override of how many entries each provider call holds. `0` means
   * unlimited (every scoped entry in one call). Mutually exclusive with
   * `batchGrouping`/`ignoreBatchSizeLimit` — the dialog sends one or the other.
   * When present, forces related-entry footprint grouping off for this run
   * (category grouping is circular for this feature anyway — see below).
   */
  customBatchSize?: number;
  /**
   * Per-run filter: entries carrying ANY of these categories are excluded
   * from classification entirely. Entries with no categories are unaffected.
   * Not inherited from project/workspace.
   */
  skipCategories?: string[];
  /**
   * Glossary ids to exclude from classification: entries whose source text
   * exactly matches one of those glossaries' terms are treated as already-known
   * terminology and left out of the request entirely (mirrors
   * `GenerateGlossaryRequest.excludeGlossaryIds` in glossary-generator.ts).
   */
  excludeGlossaryIds?: string[];
}

interface LoggerLike {
  warn(message: string, metadata?: Record<string, unknown>): void;
}

interface CredentialStoreLike {
  get(key: string, sessionId: string | undefined): string;
  /**
   * Non-throwing lookup used to resolve a named instance's per-instance vault
   * key (falling back to the base key when absent). Optional so test mocks that
   * only implement `get` keep working — the instance path falls back to `get`.
   */
  getOptional?(key: string, sessionId: string | undefined): string | undefined;
}

/**
 * Discriminates the positional-StringStore back-compat constructor arg from a
 * deps bag. `StringStore` is an interface (not a class), so `instanceof` is
 * unavailable — duck-type on its `load` method, which a deps bag never carries.
 */
function isStringStore(deps: ContentClassifierDeps | StringStore): deps is StringStore {
  return typeof (deps as Partial<StringStore>).load === 'function';
}

export interface ContentClassifierDeps {
  store?: StringStore;
  projectStore?: Pick<ProjectStore, 'loadProject' | 'updateProject'>;
  globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  glossaryStore?: Pick<GlossaryStore, 'getGlossary'>;
  credentialStore?: CredentialStoreLike;
  logger?: LoggerLike;
  /**
   * Seam for tests: the bounded LLM call. Defaults to the shared
   * `generateCategorySuggestions` helper.
   */
  generate?: typeof generateCategorySuggestions;
}

/**
 * M5 ContentClassifier — owns category writes.
 *
 * Persistence is delegated to M3 StringStore; this module enforces
 * classification semantics (trim, length, dedupe) so route handlers
 * do not reach into StringStore for these fields directly.
 *
 * It also owns AI category generation: resolving the effective module config
 * (provider, model, reasoning-effort, credentials) and calling the shared
 * structured-generation helper to suggest categories + entry assignments. The
 * suggestions are returned for user review; accepting them assigns categories
 * through the same `addCategory` path used by the manual routes.
 */
export class ContentClassifier {
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _store?: StringStore;
  private get store(): StringStore {
    return this._store ?? getStringStore();
  }
  // Resolve the project store lazily so a later setProjectStore() (e.g. per-test
  // injection) is honored even by the module-level singleton.
  private readonly _projectStore?: Pick<ProjectStore, 'loadProject' | 'updateProject'>;
  private get projectStore(): Pick<ProjectStore, 'loadProject' | 'updateProject'> {
    return this._projectStore ?? getProjectStore();
  }
  // Resolve the global-config store lazily so a later setGlobalConfigStore()
  // (e.g. per-test injection) is honored even by the module-level singleton.
  private readonly _globalConfigStore?: Pick<GlobalConfigStore, 'load'>;
  private get globalConfigStore(): Pick<GlobalConfigStore, 'load'> {
    return this._globalConfigStore ?? getGlobalConfigStore();
  }
  // Resolve the glossary store lazily (same rationale as the stores above).
  private readonly _glossaryStore?: Pick<GlossaryStore, 'getGlossary'>;
  private get glossaryStore(): Pick<GlossaryStore, 'getGlossary'> {
    return this._glossaryStore ?? getGlossaryStore();
  }
  private readonly credentialStore: CredentialStoreLike;
  private readonly logger: LoggerLike;
  private readonly generate: typeof generateCategorySuggestions;

  constructor(deps: ContentClassifierDeps | StringStore = {}) {
    // Back-compat: the historical constructor took a StringStore positionally
    // (see isStringStore — `instanceof` no longer works on the interface).
    const resolved: ContentClassifierDeps = isStringStore(deps) ? { store: deps } : deps;
    this._store = resolved.store;
    this._projectStore = resolved.projectStore;
    this._globalConfigStore = resolved.globalConfigStore;
    this._glossaryStore = resolved.glossaryStore;
    this.credentialStore = resolved.credentialStore ?? defaultCredentialStore;
    this.logger = resolved.logger ?? defaultLogger;
    this.generate = resolved.generate ?? generateCategorySuggestions;
  }

  /**
   * Single source of truth for the category constraint: trims the raw value and
   * returns it, or `null` when it is empty or longer than
   * {@link MAX_CATEGORY_LENGTH}. The throw-vs-skip policy stays per-caller —
   * `addCategory` maps `null` to a {@link ValidationError}, `assignCategories`
   * skips it.
   */
  private normalizeCategory(raw: string): string | null {
    const normalized = raw.trim();
    if (normalized.length === 0 || normalized.length > MAX_CATEGORY_LENGTH) return null;
    return normalized;
  }

  async addCategory(projectId: string, entryId: string, category: string): Promise<StringEntry> {
    // Keep the empty-vs-over-length distinction for the user-facing message,
    // while sourcing the actual constraint from normalizeCategory.
    if (category.trim().length === 0) {
      throw new ValidationError('Category must not be empty');
    }
    const normalized = this.normalizeCategory(category);
    if (normalized === null) {
      throw new ValidationError(`Category must be at most ${MAX_CATEGORY_LENGTH} characters`);
    }
    const existing = await this.store.getById(projectId, entryId);
    if (existing.categories.includes(normalized)) {
      return existing;
    }
    return this.store.updateEntry(projectId, entryId, {
      categories: [...existing.categories, normalized],
    });
  }

  async removeCategory(projectId: string, entryId: string, category: string): Promise<StringEntry> {
    const existing = await this.store.getById(projectId, entryId);
    if (!existing.categories.includes(category)) {
      return existing;
    }
    return this.store.updateEntry(projectId, entryId, {
      categories: existing.categories.filter((c) => c !== category),
    });
  }

  /**
   * Deletes an entire category: strips it from every entry that carries it and
   * removes its description from the project's `categoryDescriptions` side-map.
   * Returns the number of entries modified. A category that no entry carries (and
   * has no description) is a no-op returning 0.
   */
  async deleteCategory(projectId: string, category: string): Promise<number> {
    const entries = await this.store.load(projectId);
    let removed = 0;
    for (const entry of entries) {
      if (!entry.categories.includes(category)) continue;
      await this.store.updateEntry(projectId, entry.id, {
        categories: entry.categories.filter((c) => c !== category),
      });
      removed++;
    }
    const project = await this.projectStore.loadProject(projectId);
    const descriptions = project.categoryDescriptions;
    if (descriptions && Object.prototype.hasOwnProperty.call(descriptions, category)) {
      const next = { ...descriptions };
      delete next[category];
      await this.projectStore.updateProject(projectId, { categoryDescriptions: next });
    }
    return removed;
  }

  async getCategories(projectId: string): Promise<string[]> {
    const entries = await this.store.load(projectId);
    const set = new Set<string>();
    for (const entry of entries) {
      for (const c of entry.categories) {
        set.add(c);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Counts the entries {@link suggestCategories} would actually classify for
   * `request`: the (optionally `entryIds`-scoped) entries with non-empty source
   * text, excluding entries flagged `needsTranslation: false` or `ignored`
   * (template/variable strings and AI-dispatch-excluded entries — see
   * `suggestCategories`). Used by the M29 background engine to detect an empty
   * scope up front so a no-op run reports a definite `total` of 0 instead of an
   * indeterminate bar. Mirrors the scoping in `suggestCategories` exactly.
   */
  async countCategorySourceEntries(
    projectId: string,
    request: Pick<SuggestCategoriesRequest, 'entryIds'>,
  ): Promise<number> {
    const allEntries = await this.store.load(projectId);
    let scoped = allEntries.filter((e) => e.needsTranslation !== false && !isExcludedFromAi(e));
    if (request.entryIds && request.entryIds.length > 0) {
      const wanted = new Set(request.entryIds);
      scoped = scoped.filter((e) => wanted.has(e.id));
    }
    return scoped.filter((e) => e.sourceText.trim().length > 0).length;
  }

  /**
   * Collect the trimmed source values of the given glossaries, so entries that
   * are themselves already-glossaried terminology can be left out of
   * classification (mirrors `collectExcludedSources` in glossary-generator.ts).
   * Unknown glossary ids are skipped rather than failing the whole request.
   */
  private async collectExcludedGlossarySources(
    projectId: string,
    glossaryIds: string[],
  ): Promise<Set<string>> {
    const seen = new Set<string>();
    for (const id of glossaryIds) {
      try {
        const glossary = await this.glossaryStore.getGlossary(projectId, id);
        for (const term of glossary.terms) {
          const source = term.source.trim();
          if (source) seen.add(source);
        }
      } catch {
        // unknown glossary id — skip
      }
    }
    return seen;
  }

  /**
   * Runs the bounded AI category generation over the project's source strings
   * and returns suggested `{ category, entryIds, entries }` groups for user
   * review. No persistence happens here — accepting a suggestion goes through
   * {@link assignCategories}.
   *
   * `opts.signal` cancels the in-flight provider calls; `opts.onChunkDone` is
   * invoked after each chunk settles with `(done, total)` so a caller (the M28
   * background engine) can report real per-chunk progress.
   */
  async suggestCategories(
    projectId: string,
    request: SuggestCategoriesRequest,
    sessionId: string | undefined,
    opts?: {
      signal?: AbortSignal;
      onChunkDone?: (done: number, total: number) => void;
      /** Verbose log sink (from the M29 run); used only when the selected
       *  instance's config has verbose:true. */
      logSink?: ModuleLogFn;
    },
  ): Promise<GenerateCategorySuggestionsResult> {
    // Resolve through the base module id so a named instance (e.g.
    // `openai:my-key`) of a category-capable base is accepted, not just the bare
    // base id. The instance's slug is used to derive its per-instance vault key.
    const instance = parseModuleInstanceId(request.moduleId);
    const baseModuleId = instance?.baseModuleId ?? request.moduleId;
    const capability = CATEGORY_CAPABLE_MODULES[baseModuleId];
    if (!capability) {
      throw new ValidationError(`module "${request.moduleId}" cannot generate categories`);
    }

    const allEntries = await this.store.load(projectId);
    // Entries flagged `needsTranslation: false` are template/variable strings
    // (e.g. CSV placeholders), not real text — never classify them. `ignored`
    // entries are excluded from every AI dispatch, category generation included.
    let scoped = allEntries.filter((e) => e.needsTranslation !== false && !isExcludedFromAi(e));
    if (request.entryIds && request.entryIds.length > 0) {
      const wanted = new Set(request.entryIds);
      scoped = scoped.filter((e) => wanted.has(e.id));
    }
    if (request.skipCategories && request.skipCategories.length > 0) {
      const skip = new Set(request.skipCategories);
      scoped = scoped.filter((e) => !e.categories.some((c) => skip.has(c)));
    }
    if (request.excludeGlossaryIds && request.excludeGlossaryIds.length > 0) {
      const excludedSources = await this.collectExcludedGlossarySources(
        projectId,
        request.excludeGlossaryIds,
      );
      if (excludedSources.size > 0) {
        scoped = scoped.filter((e) => !excludedSources.has(e.sourceText.trim()));
      }
    }

    const project = await this.projectStore.loadProject(projectId);
    const global = await this.globalConfigStore.load();

    const languages = (request.contextLanguages ?? []).filter((l) =>
      project.activeLanguages.includes(l),
    );
    const fields = request.contextFields ?? [];
    const entries = scoped
      .filter((e) => e.sourceText.trim().length > 0)
      .map((e) => {
        const ctx = collectEntryContext(e, { fields, languages });
        return { entryId: e.id, sourceText: e.sourceText, ...(ctx ? { ctx } : {}) };
      });
    if (entries.length === 0) return { suggestions: [], usages: [] };
    const projectEntry = project.moduleConfigs[request.moduleId];
    const effective = resolveEffectiveModuleConfig(request.moduleId, global, projectEntry);

    const cfg = effective.config as {
      model?: unknown;
      reasoningEffort?: unknown;
      baseURL?: unknown;
      allowInsecureHttp?: unknown;
      useStructuredOutput?: unknown;
      verbose?: unknown;
    };
    const modelId =
      request.model || (typeof cfg.model === 'string' && cfg.model ? cfg.model : undefined);
    if (!modelId) {
      throw new ValidationError(`no model configured for module "${request.moduleId}"`);
    }
    // Truthiness (not nullish): an empty-string override must fall back to the
    // configured/default effort, never reach buildProviderOptions as ''.
    const reasoningEffort =
      request.reasoningEffort ||
      (typeof cfg.reasoningEffort === 'string' ? cfg.reasoningEffort : undefined);
    const baseURL = typeof cfg.baseURL === 'string' ? cfg.baseURL : undefined;
    // Mirror validate-module-config.ts / the translate path: coerce the same
    // `allowInsecureHttp` opt-in from the resolved config so a LAN `http:` LLM
    // endpoint (Ollama/LM Studio) category-gen can use is validated identically.
    const allowInsecureHttp = coerceBoolean(cfg.allowInsecureHttp);
    // Honor the module's structured-output flag with the same resolution
    // createAISDKModule applies on the translation/judge/etc. paths: strict
    // `=== true` for a set value (a stringy or legacy value is treated as off),
    // per-provider default for an unset one (ON for google). generic-ai is
    // pinned to openai-compatible here, so its "openai-format-only" guard does
    // not apply.
    const useStructuredOutput = resolveUseStructuredOutput(
      cfg.useStructuredOutput,
      capability.provider,
    );
    const verbose = cfg.verbose === true;
    const useVerboseSink = verbose && !!opts?.logSink;

    // Credentials come from the per-session vault (M16), never process.env.
    // For a named instance, try its per-instance derived key first and fall back
    // to the base module's key (mirrors M6's buildCredentialProvider), so an
    // instance can either carry its own key or share the base module's.
    // openai-compatible (generic-ai) targets local endpoints (Ollama/LM Studio)
    // that need no key — the model factory falls back to a placeholder — so a
    // missing key there is not fatal whether or not a baseURL is configured.
    let apiKey = '';
    try {
      if (instance) {
        const derivedKey = deriveInstanceCredentialKey(capability.credentialKey, instance.slug);
        const perInstance = this.credentialStore.getOptional?.(derivedKey, sessionId);
        apiKey = perInstance ?? this.credentialStore.get(capability.credentialKey, sessionId);
      } else {
        apiKey = this.credentialStore.get(capability.credentialKey, sessionId);
      }
    } catch (err) {
      if (capability.provider !== 'openai-compatible') throw err;
    }

    const existingCategories = request.includeExisting ? await this.getCategories(projectId) : [];

    // Category grouping would be circular here (categories are this run's output),
    // so the project/workspace grouping dimension is intentionally not applied.
    // The per-run batchGrouping request field is the only grouping axis for
    // category generation. The per-run override wins over the resolved
    // project/workspace ignoreBatchSizeLimit. `customBatchSize` takes priority
    // over `batchGrouping`/`ignoreBatchSizeLimit` and forces dimension='none'.
    const { ignoreSizeLimit } = resolveBatchGrouping(project, global.settings);
    const customBatchSize = request.customBatchSize;
    const ignore =
      customBatchSize !== undefined
        ? customBatchSize === 0
        : (request.ignoreBatchSizeLimit ?? ignoreSizeLimit);
    const dimension = customBatchSize !== undefined ? 'none' : (request.batchGrouping ?? 'none');
    const cap =
      customBatchSize !== undefined && customBatchSize > 0 ? customBatchSize : CATEGORY_CHUNK_SIZE;

    let batches;
    if (dimension !== 'none' || customBatchSize !== undefined) {
      const byId = new Map(scoped.map((e) => [e.id, e]));
      batches = groupAndPack(entries, cap, ignore, (e) =>
        batchGroupKey(byId.get(e.entryId) ?? {}, dimension),
      );
    }

    return this.generate({
      provider: capability.provider,
      modelId,
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      ...(allowInsecureHttp ? { allowInsecureHttp: true } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(useStructuredOutput ? { useStructuredOutput: true } : {}),
      entries,
      existingCategories,
      ...(batches
        ? { batches }
        : ignore && entries.length > 0
          ? { chunkSize: entries.length }
          : {}),
      ...(request.maxCategories ? { maxCategories: request.maxCategories } : {}),
      requestTimeoutMs: global.settings?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      maxOutputTokens: global.settings?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      ...(opts?.signal ? { signal: opts.signal } : {}),
      ...(opts?.onChunkDone ? { onChunkDone: opts.onChunkDone } : {}),
      ...(useVerboseSink ? { verbose: true } : {}),
      log: (level, message, meta) => {
        if (useVerboseSink) {
          opts!.logSink!(level, message, meta);
        } else if (level === 'warn') {
          this.logger.warn(message, meta);
        }
      },
    });
  }

  /**
   * Applies accepted suggestions by adding each category to its assigned
   * entries. Entry/category writes are deduped and merged per entry, so an
   * entry already carrying a category is left untouched. Unknown entry ids are
   * skipped. Returns the list of entries that were actually modified.
   */
  async assignCategories(
    projectId: string,
    suggestions: CategorySuggestion[],
  ): Promise<StringEntry[]> {
    // Collapse to one set of categories to add per entry id.
    const byEntry = new Map<string, Set<string>>();
    for (const { category, entryIds } of suggestions) {
      const normalized = this.normalizeCategory(category);
      if (normalized === null) continue;
      for (const entryId of entryIds) {
        const set = byEntry.get(entryId) ?? new Set<string>();
        set.add(normalized);
        byEntry.set(entryId, set);
      }
    }

    const updated: StringEntry[] = [];
    for (const [entryId, categories] of byEntry) {
      let existing: StringEntry;
      try {
        existing = await this.store.getById(projectId, entryId);
      } catch {
        continue; // unknown/removed entry — skip rather than fail the batch
      }
      const toAdd = [...categories].filter((c) => !existing.categories.includes(c));
      if (toAdd.length === 0) continue;
      const result = await this.store.updateEntry(projectId, entryId, {
        categories: [...existing.categories, ...toAdd],
      });
      updated.push(result);
    }
    return updated;
  }
}

export const contentClassifier = new ContentClassifier();
