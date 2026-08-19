/**
 * AI category classification — a focused, self-contained structured-generation
 * helper used by the server's content-classifier (M5) to suggest categories for
 * a project's source strings and assign entries to them.
 *
 * It deliberately mirrors the report-only judge / source-review helpers in this
 * provider layer (a single `generateText` call per chunk plus manual JSON
 * parsing) rather than depending on `generateObject`, so it adds no new
 * dependency and reuses the same provider/credential plumbing as translation.
 *
 * The contract is intentionally narrow: callers resolve the provider, model,
 * api key, and (optional) base URL, and this helper performs the bounded LLM
 * call(s) and returns validated suggestions. No persistence happens here — the
 * caller reviews/accepts and assigns via the normal add-category path.
 */
import { createModelForProvider } from './model-factory.js';
import { validateBaseURL } from './config-coerce.js';
import { buildProviderOptions } from './provider-options.js';
import {
  rethrowIfAuthOrRateLimit,
  runGenerateTextOnce,
  throwIfAllChunksFailed,
  extractSafeErrorMetadata,
  toTranslationUsage,
} from './core.js';
import {
  retryOnceOnTransient,
  combineAbortSignals,
  RequestTimeoutError,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from './transient.js';
import { toErrorMessage } from '../error-utils.js';
import { extractJsonBetween } from './json.js';
import type { ProviderType } from './types.js';
import { chunkArray } from '../chunk.js';
import type { EntryContext } from '../types/entry-context.js';
import type { TranslationUsage } from '../types/module.js';

/** Hard cap on category-name length, matching M5's per-entry validation. */
const MAX_CATEGORY_LENGTH = 64;
/** Upper bound on suggested categories so a noisy model can't explode the UI. */
const MAX_SUGGESTED_CATEGORIES = 40;
/**
 * Entries per provider call when batching is enabled. Large projects are chunked
 * across calls (one progress step per chunk). Exported so the generation UI can
 * pre-compute how many batches a run will produce without re-hardcoding the size.
 */
export const CATEGORY_CHUNK_SIZE = 80;
/** @deprecated internal alias for {@link CATEGORY_CHUNK_SIZE}. */
const DEFAULT_CHUNK_SIZE = CATEGORY_CHUNK_SIZE;

/**
 * Native structured-output schema for the category response, mirroring what
 * {@link parseCategoryResponse} reads back: `{ categories: [{ category, entryIds }] }`.
 * Bound on the model (via {@link createModelForProvider}) only when the caller
 * opts in with `useStructuredOutput`, exactly like the judge / source-review /
 * glossary schemas. Unlike those array-rooted schemas this is OBJECT-rooted, so
 * it is the one feature OpenAI's strict `json_schema` could accept directly;
 * parsing still runs as the actual extractor + fallback.
 */
export const CATEGORY_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          // Batch-local numeric index (see buildCategoryPrompt/parseCategoryResponse),
          // not the raw entryId — keeps a large response far more compact.
          entryIds: { type: 'array', items: { type: 'integer' } },
        },
        required: ['category', 'entryIds'],
      },
    },
  },
  required: ['categories'],
};

/** One source entry presented to the model for classification. */
export interface CategoryEntryInput {
  /** Stable entry id; echoed back in suggestions so the caller can assign. */
  entryId: string;
  /** Source-language text the model classifies. */
  sourceText: string;
  /** Optional enriched context for this entry (rendered as hints). */
  ctx?: EntryContext;
}

/** One entry the model assigned to a category, with its source text for preview. */
export interface CategorySuggestionEntry {
  id: string;
  /** Source-language text of the entry, for the review preview. */
  sourceText: string;
}

/** A single suggested category and the entries the model assigned to it. */
export interface CategorySuggestion {
  category: string;
  entryIds: string[];
  /**
   * The resolved entries (id + source text) behind `entryIds`, in the same
   * order, so the review UI can preview the actual strings that will be set in
   * the category — not just the count. Parallel to `entryIds`. Optional:
   * `generateCategorySuggestions` always populates it, but the assign path
   * (which only needs the ids) and legacy sidecar data may omit it.
   */
  entries?: CategorySuggestionEntry[];
}

/**
 * A parsed-but-unresolved category group from a single chunk response: just the
 * model's category name and the (validated) entry ids. The source-text preview
 * (`entries`) is filled in at merge time from the original input entries.
 * @internal
 */
export interface ParsedCategoryGroup {
  category: string;
  entryIds: string[];
}

/**
 * Result of a category-suggestion call: the suggestions plus the module's
 * per-chunk usage (one entry per settled provider call), so the caller can
 * accumulate it into a run's billing (see M9/usage-pricing.ts).
 */
export interface GenerateCategorySuggestionsResult {
  suggestions: CategorySuggestion[];
  usages: TranslationUsage[];
}

export interface GenerateCategorySuggestionsOptions {
  provider: ProviderType;
  modelId: string;
  apiKey: string;
  baseURL?: string;
  /**
   * Allow an `http:` (non-TLS) `baseURL` pointing at a non-loopback host — e.g. a
   * LAN Ollama / LM-Studio endpoint like `http://192.168.x.x:11434`. Mirrors the
   * translate/judge paths' `validateBaseURL(..., true)` opt-in; the caller (M5)
   * sources this from the resolved module config. Off by default (loopback and
   * https never need it).
   */
  allowInsecureHttp?: boolean;
  reasoningEffort?: string;
  maxOutputTokens?: number;
  /**
   * Opt into the provider's native structured-output mechanism (binding
   * {@link CATEGORY_RESPONSE_SCHEMA}) so malformed JSON is far less likely. Mirrors
   * the module closure's `useStructuredOutput`; a no-op for providers without a
   * clean native path (e.g. anthropic). The caller (M5) sources this from the
   * resolved module config.
   */
  useStructuredOutput?: boolean;
  /**
   * AI SDK's own internal retry count for each chunk's call (default 2, i.e. 3
   * attempts). Absent leaves the SDK default untouched; mirrors the module
   * closure's `config.maxRetries` passthrough. The caller (M5) sources this
   * from a Freeway dispatch's `freewayModuleOverrides` when the run is bound
   * to a free-tier bucket — the engine owns retry/failover policy there, so
   * the SDK's own retries would only burn quota the engine's cool+reroute
   * already supersedes.
   */
  maxRetries?: number;
  /** Entries to classify. */
  entries: CategoryEntryInput[];
  /**
   * Existing project category vocabulary. When non-empty, the model is asked to
   * also reuse these (assigning entries into them) rather than only inventing
   * new ones.
   */
  existingCategories?: string[];
  /** Soft target for the number of categories the model proposes. */
  maxCategories?: number;
  /** Entries per provider call. Defaults to {@link DEFAULT_CHUNK_SIZE}. */
  chunkSize?: number;
  /** Per-request timeout (ms) injected by the host from workspace settings. */
  requestTimeoutMs?: number;
  signal?: AbortSignal;
  log?: (level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>) => void;
  /** When true, log each chunk's request prompt and raw response via `log` at
   *  info level (for verbose-run sidecar capture). Mirrors the module path's
   *  logVerbose. Off by default. */
  verbose?: boolean;
  /**
   * Invoked after each chunk's provider call settles (success, parse-failure,
   * or skipped error alike), with the number of chunks completed so far and the
   * total. Lets a caller report real progress for a long-running background run.
   */
  onChunkDone?: (done: number, total: number) => void;
  /** Pre-formed batches (one LLM call each); used verbatim instead of size-chunking. */
  batches?: CategoryEntryInput[][];
}

const SYSTEM_PROMPT =
  'You are a localization content categorizer. You group short source strings ' +
  'into a small set of meaningful, reusable thematic categories (for example: ' +
  '"UI Button", "Dialogue", "Achievement", "Item Name", "Lore"). Categories must ' +
  'be concise human-readable labels. Respond with ONLY a JSON object — no prose, ' +
  'no markdown fences.';

/**
 * Builds the system/user prompt for one chunk of entries. The user message asks
 * for a JSON object `{ "categories": [{ "category": string, "entryIds": number[] }] }`.
 * Entries are identified by their position within `entries` (a small, batch-local
 * index) rather than their raw `entryId` hash — mirrors the judge/source-review
 * prompts' numeric `i` field, and keeps a response listing many ids far more
 * compact. `parseCategoryResponse` maps each index back to the real entryId.
 * @internal exported for unit-testing
 */
export function buildCategoryPrompt(
  entries: CategoryEntryInput[],
  existingCategories: string[],
  maxCategories: number,
): { system: string; user: string } {
  const lines = entries.map((e, i) => {
    // Bound each source snippet so one giant string can't dominate the prompt.
    const text = e.sourceText.replace(/\s+/g, ' ').trim().slice(0, 300);
    let line = `- id=${i}: ${JSON.stringify(text)}`;
    const ctx = e.ctx;
    if (ctx?.context) line += ` | ctx: ${JSON.stringify(ctx.context)}`;
    // Untrusted CSV-origin labels (source column headers, assigned category
    // names): JSON-stringify them exactly like sourceText/ctx.context above so
    // a label crafted with embedded instructions/newlines/quotes can't inject
    // into the prompt (F:366) — same untrusted-data treatment, not joined raw.
    if (ctx?.sources?.length) line += ` | src: ${JSON.stringify(ctx.sources)}`;
    if (ctx?.categories?.length) line += ` | cat: ${JSON.stringify(ctx.categories)}`;
    if (ctx?.translations) {
      for (const [lang, translated] of Object.entries(ctx.translations)) {
        line += ` | ${lang}: ${JSON.stringify(translated)}`;
      }
    }
    return line;
  });

  const ctxNote = entries.some((e) => e.ctx)
    ? '\nEach line may include extra context after the source: "ctx" (note), ' +
      '"src" (origin labels), "cat" (assigned categories), and language codes ' +
      '(existing translations). Use these only as hints.\n'
    : '';

  // Existing category names are also untrusted (persisted from prior AI/user
  // input); JSON-stringify each one for the same reason as ctx.sources/categories
  // above — an unescaped name could otherwise inject prompt instructions (F:366).
  const existingList = existingCategories.map((c) => `- ${JSON.stringify(c)}`).join('\n');
  const existingBlock =
    existingCategories.length > 0
      ? `\nExisting categories you SHOULD reuse where a strong fit exists (assign entries into ` +
        `them rather than inventing near-duplicates):\n${existingList}\nIf none of these fit an ` +
        `entry well, invent a new, concise category for it instead.\n`
      : '';

  const user =
    `Group the following ${entries.length} source string(s) into at most ` +
    `${maxCategories} categories. Every category name must be at most ` +
    `${MAX_CATEGORY_LENGTH} characters. An entry may belong to more than one ` +
    `category. Only omit an entry if it doesn't fit any conceivable category ` +
    `— existing or newly invented.\n` +
    existingBlock +
    ctxNote +
    `\nStrings:\n${lines.join('\n')}\n\n` +
    `Respond with ONLY a JSON object of this exact shape:\n` +
    `{"categories":[{"category":"<name>","entryIds":[<id>, ...]}, ...]}\n` +
    `"entryIds" lists the numeric id values (the id=N labels) from the input lines.`;

  return { system: SYSTEM_PROMPT, user };
}

/**
 * Parses + validates a model response for one chunk. `batch` is the SAME array
 * passed to {@link buildCategoryPrompt} for this chunk — each response
 * `entryIds` entry is the batch-local numeric index `buildCategoryPrompt` sent,
 * which is mapped back to the real `entryId` here. Drops out-of-range/non-integer
 * indices, empty/over-long category names, and empty groups. Returns null when
 * the payload can't be parsed at all so the caller can decide.
 * @internal exported for unit-testing
 */
export function parseCategoryResponse(
  text: string,
  batch: CategoryEntryInput[],
): ParsedCategoryGroup[] | null {
  // Object-oriented payload ({...}), unlike the array payloads the other
  // helpers parse via extractJsonPayload.
  const json = extractJsonBetween(text, '{', '}');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const categories = (parsed as { categories?: unknown })?.categories;
  if (!Array.isArray(categories)) return null;

  const out: ParsedCategoryGroup[] = [];
  for (const raw of categories) {
    if (typeof raw !== 'object' || raw === null) continue;
    const name = (raw as { category?: unknown }).category;
    const ids = (raw as { entryIds?: unknown }).entryIds;
    if (typeof name !== 'string') continue;
    const category = name.trim().slice(0, MAX_CATEGORY_LENGTH);
    if (category.length === 0) continue;
    if (!Array.isArray(ids)) continue;
    const entryIds = Array.from(
      new Set(
        ids
          .filter(
            (id): id is number =>
              typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < batch.length,
          )
          .map((id) => batch[id].entryId),
      ),
    );
    if (entryIds.length === 0) continue;
    out.push({ category, entryIds });
  }
  return out;
}

/**
 * Merges per-chunk suggestions into one list keyed by case-insensitive category
 * name (first-seen casing wins), unioning their entry ids and capping the total
 * number of categories.
 */
function mergeSuggestions(
  chunks: ParsedCategoryGroup[][],
  textById: Map<string, string>,
): CategorySuggestion[] {
  const byKey = new Map<string, { category: string; ids: Set<string> }>();
  for (const chunk of chunks) {
    for (const { category, entryIds } of chunk) {
      const key = category.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        for (const id of entryIds) existing.ids.add(id);
      } else {
        byKey.set(key, { category, ids: new Set(entryIds) });
      }
    }
  }
  return Array.from(byKey.values())
    .slice(0, MAX_SUGGESTED_CATEGORIES)
    .map(({ category, ids }) => {
      const entryIds = Array.from(ids);
      return {
        category,
        entryIds,
        // Resolve each id to its source text from the original input so the
        // review UI can preview the actual strings, not just the count.
        entries: entryIds.map((id) => ({ id, sourceText: textById.get(id) ?? '' })),
      };
    });
}

/**
 * Runs the bounded LLM classification. Large projects are split into chunks of
 * {@link DEFAULT_CHUNK_SIZE} entries (one provider call each) and merged; a
 * chunk whose response can't be parsed is skipped (its entries simply receive
 * no suggestions) rather than failing the whole request.
 */
export async function generateCategorySuggestions(
  opts: GenerateCategorySuggestionsOptions,
): Promise<GenerateCategorySuggestionsResult> {
  const {
    provider,
    modelId,
    apiKey,
    baseURL,
    reasoningEffort,
    useStructuredOutput,
    maxRetries,
    entries,
    existingCategories = [],
    maxCategories = 12,
    signal,
    log,
    verbose,
    onChunkDone,
  } = opts;

  if (entries.length === 0) return { suggestions: [], usages: [] };

  // Enforce the same baseURL guard the translation path applies. The generic-ai
  // module validates at construction, but category-gen builds its own model here
  // straight from persisted module config, so without this it was the one path
  // that could send the credential to an unvalidated / metadata endpoint (SSRF).
  validateBaseURL(baseURL, opts.allowInsecureHttp);

  // Bind the native structured-output schema only when opted in (createModelForProvider
  // treats it as a no-op for providers without a clean native path, e.g. anthropic).
  const languageModel = createModelForProvider(provider, {
    apiKey,
    modelId,
    baseURL,
    responseFormatSchema: useStructuredOutput ? CATEGORY_RESPONSE_SCHEMA : undefined,
  });
  const providerOpts = buildProviderOptions(provider, { reasoningEffort, modelId });

  // Single clamp: a positive override wins, otherwise (undefined / 0 / negative)
  // fall back to the default chunk size.
  const size = opts.chunkSize && opts.chunkSize > 0 ? opts.chunkSize : DEFAULT_CHUNK_SIZE;
  // Maps every input entry id to its source text so the merge step can attach a
  // preview to each suggested entry.
  const textById = new Map(entries.map((e) => [e.entryId, e.sourceText]));
  const chunkResults: ParsedCategoryGroup[][] = [];

  const batches = opts.batches?.length ? opts.batches : chunkArray(entries, size);
  const totalChunks = batches.length;
  let doneChunks = 0;
  // Track request-level failures so a run where EVERY chunk's provider call
  // failed surfaces an error instead of returning [] — which the UI would report
  // as "the AI found no categories", hiding a bad key / invalid request / network
  // error. Mirrors suggestGlossaries.
  let lastError: unknown;
  let anyRequestSucceeded = false;
  // Per-provider-call usage, one entry per settled (non-throwing) chunk — for
  // the caller (M29) to accumulate into the run's billing.
  const usages: TranslationUsage[] = [];
  for (const batch of batches) {
    if (signal?.aborted) break;
    const { system, user } = buildCategoryPrompt(batch, existingCategories, maxCategories);
    if (verbose) {
      log?.('info', '[category-classifier] request', {
        model: modelId,
        system,
        user,
        count: batch.length,
      });
    }
    try {
      const timeoutMs = opts.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
      const { text, usage } = await retryOnceOnTransient(async () => {
        // Fresh timeout per attempt, combined with the caller's cancel signal.
        const combined = combineAbortSignals(signal, timeoutMs);
        try {
          return await runGenerateTextOnce(
            languageModel,
            { system, prompt: user },
            {
              maxOutputTokens: opts.maxOutputTokens,
              providerOptions: providerOpts,
              signal: combined,
              ...(maxRetries !== undefined ? { maxRetries } : {}),
            },
          );
        } catch (err) {
          // A fired timeout (combined aborted, but the caller did NOT cancel) becomes a
          // typed transient error so retryOnceOnTransient retries with a fresh timeout.
          // A real cancel leaves signal aborted, so it propagates (not converted).
          if (combined.aborted && !signal?.aborted) throw new RequestTimeoutError(timeoutMs);
          throw err;
        }
      }, signal);
      if (verbose) {
        log?.('info', '[category-classifier] response', { text, count: batch.length });
      }
      anyRequestSucceeded = true;
      const translationUsage = toTranslationUsage(usage, modelId);
      if (translationUsage) usages.push(translationUsage);
      const parsed = parseCategoryResponse(text, batch);
      if (parsed === null) {
        log?.('warn', '[category-classifier] parse-failed', {
          count: batch.length,
          outputTail: text.slice(-200),
        });
        continue;
      }
      chunkResults.push(parsed);
    } catch (err) {
      if (signal?.aborted) break;
      log?.('warn', '[category-classifier] chunk-error', {
        count: batch.length,
        error: toErrorMessage(err),
        ...extractSafeErrorMetadata(err),
      });
      // Rethrow rate limits (429, mirroring suggestGlossaries) so the caller
      // surfaces the provider cool-down, and auth failures (401/403) so a bad
      // key doesn't silently drop every chunk and return []. Other errors: skip
      // the chunk; the remaining chunks still produce suggestions.
      rethrowIfAuthOrRateLimit(err);
      lastError = err;
    } finally {
      // Report progress per settled chunk (success, parse-failure, or skipped
      // error). A rethrown rate limit/auth error also runs this, which is
      // harmless: the caller has already aborted the run by then.
      doneChunks++;
      onChunkDone?.(doneChunks, totalChunks);
    }
  }

  // Every chunk's request failed (none returned text) and we were not cancelled:
  // the empty result is a failure, not a genuine "no categories found". Throw so
  // the caller reports an error instead of an empty suggestion list.
  throwIfAllChunksFailed(anyRequestSucceeded, lastError, signal);

  return { suggestions: mergeSuggestions(chunkResults, textById), usages };
}
