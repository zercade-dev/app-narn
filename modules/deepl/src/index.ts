/**
 * DeepL translation module.
 *
 * Implements the TranslationModule interface using the official deepl-node SDK.
 *  - Batches translation jobs into groups of MAX_BATCH (50) entries per request.
 *  - pushGlossary (free tier) accumulates all glossary terms into a single
 *    multilingual remote glossary named FREE_GLOSSARY_NAME (DeepL Multilingual
 *    Glossary API). On each push the existing glossary is deleted and recreated
 *    with the full accumulated term set, so the remote reflects the latest set
 *    of *additions* across every push. The pool is additive: it merges each push
 *    into `freeTermPool` so that multiple host glossaries (the free tier permits
 *    only one remote glossary) collapse into one. Because the pool is in-memory,
 *    a fresh instance (restart / new vault session) first SEEDS it from the
 *    existing remote glossary's entries (`seedFreePoolFromRemote`) BEFORE merging
 *    the current push — otherwise recreating the glossary would erase every term
 *    pushed by earlier instances. Seeding runs once per
 *    instance; the push's own terms overwrite matching keys, so incoming values
 *    win. A term removed/renamed upstream is NOT evicted (seeding pulls the
 *    remote's current terms back in) — the eviction gap is deliberate; a full
 *    erase & recreate is available via pushGlossary's `replace` option. (Pro
 *    tier merges the same way: each pair glossary's remote entries are fetched
 *    and merged under the incoming push's terms before recreation, so pushing
 *    glossary B no longer wipes glossary A's terms for the same language pair.)
 *    A lazy `listMultilingualGlossaries()` call on first use detects a pre-existing
 *    glossary (e.g. one created manually or from a previous server session) and
 *    registers its ID for reuse.
 *
 * Credentials are resolved from `config.apiKey` (a per-project override that
 * takes precedence) and otherwise from the M16 credential vault via
 * `config.credentials.get('DEEPL_API_KEY')`. This module never reads
 * `process.env` — secrets come from the password-encrypted vault, not the
 * environment.
 *
 * The free vs. pro API *endpoint* is determined automatically by the SDK based
 * on the auth key format (free keys end with `:fx`). The `tier` config option is
 * separate and load-bearing: it selects the glossary strategy — `'free'` merges
 * everything into one multilingual glossary, `'pro'` maintains one glossary per
 * language pair (see `translate`/`pushGlossary`).
 */

import * as deepl from 'deepl-node';
import type {
  BatchDispatchOptions,
  CredentialProvider,
  Glossary,
  GlossaryTerm,
  ModelInfo,
  TranslationJob,
  TranslationModule,
  TranslationResult,
} from '@zercade-dev/narn-shared';
import {
  AuthError,
  MASK_TOKEN_SOURCE,
  MissingCredentialError,
  RateLimitError,
  acquireRateLimit,
  cancelledResult,
  chunkArray,
  debug,
  reportRateLimitHit,
  toErrorMessage,
} from '@zercade-dev/narn-shared';

const MAX_BATCH = 50;
const FREE_GLOSSARY_NAME = 'narn.zercade.dev.glossary';

const DEEPL_TIER_MODELS: ModelInfo[] = [
  { id: 'latency_optimized', name: 'Latency Optimized', supportedReasoningEfforts: [] },
  { id: 'quality_optimized', name: 'Quality Optimized', supportedReasoningEfforts: [] },
  {
    id: 'prefer_quality_optimized',
    name: 'Prefer Quality Optimized',
    supportedReasoningEfforts: [],
  },
];
const GLOSSARY_NAME_PREFIX = 'narn.zercade.dev.glossary.';

// Compiled from the canonical shared mask-token grammar so the deepl encoder,
// pseudo, and M17 can never drift apart on what counts as a mask token. Its own
// `/g` instance (one per module) — fresh each load — used only via
// `String.replace`, which resets `lastIndex`, so sharing it is safe.
const MASK_RE = new RegExp(MASK_TOKEN_SOURCE, 'g');
const X_TAG_RE = /<x id="(\d+)"\s*\/>/g;

/**
 * XML-escape the characters DeepL's `tagHandling: 'xml'` parser would otherwise
 * treat as markup. Source game text routinely contains raw `<`, `>` and `&`
 * (e.g. "HP < 50 & MP > 0"); left unescaped they make DeepL reject the whole
 * batch with "Tag handling parsing failed … mismatched tag". Escape `&` first so
 * the `<`/`>` passes can't re-escape an ampersand we just introduced.
 */
function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Inverse of {@link escapeXml}; unescape `&amp;` last to avoid double-decoding. */
function unescapeXml(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * Protect placeholders and literal markup before DeepL. Mask tokens
 * ({t|v|g|e}:n) become balanced `<x id="N"/>` tags DeepL passes through
 * untouched; every other `<`, `>`, `&` in the source is XML-escaped so it can
 * never break DeepL's XML tag parser.
 */
function encodePlaceholders(texts: string[]): {
  encoded: string[];
  placeholderMaps: string[][];
} {
  const placeholderMaps: string[][] = [];

  const encoded = texts.map((text) => {
    const map: string[] = [];
    // Escape first — mask tokens contain none of &<> so they survive intact —
    // then swap the surviving mask tokens for the protective <x/> tags.
    const enc = escapeXml(text).replace(MASK_RE, (match) => {
      const idx = map.length;
      map.push(match);
      return `<x id="${idx}"/>`;
    });
    placeholderMaps.push(map);
    return enc;
  });
  return { encoded, placeholderMaps };
}

/** Restore mask tokens from `<x id="N"/>` tags, then unescape literal markup. */
function decodePlaceholders(text: string, map: string[]): string {
  const restored = text.replace(X_TAG_RE, (_, i) => map[parseInt(i, 10)] ?? '');
  return unescapeXml(restored);
}

/**
 * Normalize a source language code for the DeepL API.
 * Chinese variants (zh-hans, zh-hant) must use the generic ZH code as source
 * because DeepL only accepts ZH-HANS / ZH-HANT as target languages.
 */
function toDeepLSourceCode(code: string): string {
  const lower = code.toLowerCase();
  if (lower === 'zh-hans' || lower === 'zh-hant') return 'zh';
  const hyphen = lower.indexOf('-');
  if (hyphen === -1) return lower;
  return `${lower.slice(0, hyphen)}-${lower.slice(hyphen + 1).toUpperCase()}`;
}

/**
 * Normalize a target language code for the DeepL API.
 * Uses ZH-HANS for Simplified Chinese and ZH-HANT for Traditional Chinese.
 * When the code is bare `en`, returns the supplied `englishVariant` (defaults
 * to `'en-US'` so the DeepL-deprecated plain `en` code is never sent).
 */
function toDeepLTargetCode(code: string, englishVariant: 'en-US' | 'en-GB' = 'en-US'): string {
  const lower = code.toLowerCase();
  if (lower === 'en') return englishVariant;
  const hyphen = lower.indexOf('-');
  if (hyphen === -1) return lower;
  return `${lower.slice(0, hyphen)}-${lower.slice(hyphen + 1).toLowerCase()}`;
}

// Languages DeepL's multilingual glossary API does not support, tracked as two
// separate sets because DeepL's glossary source vs target support genuinely
// differs per language. They happen to hold the same values today but are kept
// distinct so each side can change independently without disturbing the other.
const GLOSSARY_SKIP_TARGETS = new Set(['zh-hant', 'th']);
const GLOSSARY_SKIP_SOURCES = new Set(['zh-hant', 'th']);
// Glossaries use generic language codes; 'en' must not be expanded to 'en-US'
// (which toDeepLTargetCode does for translation) when English appears as a target.
const GLOSSARY_TARGET_REMAPS: Record<string, string> = { en: 'en', 'zh-hans': 'zh', 'pt-br': 'pt' };
// Source language codes that must be normalised before being sent to the glossary API.
// DeepL does not accept regional variants (e.g. pt-BR) as source_lang for glossaries.
const GLOSSARY_SOURCE_REMAPS: Record<string, string> = { 'pt-br': 'pt' };

/**
 * Resolve a glossary source language code, or `undefined` when the language is
 * unsupported by DeepL's glossary API (logging the skip). Applies the glossary
 * source remaps before falling back to the general source normalisation.
 */
function resolveGlossarySourceCode(source: string): string | undefined {
  const lower = source.toLowerCase();
  if (GLOSSARY_SKIP_SOURCES.has(lower)) {
    debug('deepl', `Glossary does not support source language "${source}" — skipping.`);
    return undefined;
  }
  return GLOSSARY_SOURCE_REMAPS[lower] ?? toDeepLSourceCode(source);
}

/**
 * Resolve a glossary target language code, or `undefined` when the language is
 * unsupported by DeepL's glossary API (logging the skip). Applies the glossary
 * target remaps before falling back to the general target normalisation.
 *
 * No englishVariant is taken: GLOSSARY_TARGET_REMAPS remaps bare `en`→`en`
 * first, so `en` never reaches toDeepLTargetCode to be expanded to en-US —
 * glossary language codes must stay generic.
 */
function resolveGlossaryTargetCode(target: string): string | undefined {
  const lower = target.toLowerCase();
  if (GLOSSARY_SKIP_TARGETS.has(lower)) {
    debug('deepl', `Glossary does not support target language "${target}" — skipping.`);
    return undefined;
  }
  return GLOSSARY_TARGET_REMAPS[lower] ?? toDeepLTargetCode(target);
}

/**
 * Build the canonical `"src->tgt"` lookup key for a pro-mode pair glossary, or
 * `undefined` when either side is unsupported. The single source of truth for
 * the key shape so `pushGlossary` (creation) and `translateBatch` (lookup) can
 * never drift apart on remap rules.
 */
function pairGlossaryKey(source: string, target: string): string | undefined {
  const srcCode = resolveGlossarySourceCode(source);
  if (srcCode === undefined) return undefined;
  const tgtCode = resolveGlossaryTargetCode(target);
  if (tgtCode === undefined) return undefined;
  return `${srcCode}->${tgtCode}`;
}

/** True for a remote glossary this app created (either tier's naming). */
function isManagedGlossaryName(name: string): boolean {
  return name === FREE_GLOSSARY_NAME || name.startsWith(GLOSSARY_NAME_PREFIX);
}

/**
 * Collect [source, translation] glossary pairs for a single (source→`target`)
 * bucket, dropping any term whose `target` translation is missing/empty so an
 * `undefined` value can never reach DeepL's GlossaryEntries.
 */
function collectEntries(terms: GlossaryTerm[], target: string): [string, string][] {
  const pairs: [string, string][] = [];
  for (const t of terms) {
    const v = t.translations[target];
    if (!v) continue;
    pairs.push([t.source, v]);
  }
  return pairs;
}

/**
 * Convert the accumulated term pool into DeepL multilingual glossary dictionaries.
 * Skips unsupported target languages and remaps language codes as required by the API.
 */
function buildGlossaryDicts(
  termPool: Map<string, { source: string; target: string; entries: Map<string, string> }>,
): deepl.MultilingualGlossaryDictionaryEntries[] {
  // Merge by remapped (source,target): the pool is keyed on raw variant codes
  // (e.g. pt-br->en, zh-hans->de), but distinct keys can collapse to the same
  // pair after remapping (pt-br→pt, zh-hans→zh). DeepL rejects duplicate
  // dictionaries for one pair in a single createMultilingualGlossary call, so
  // fold colliding keys into one dictionary instead of emitting two.
  const merged = new Map<
    string,
    { sourceLangCode: string; targetLangCode: string; entries: Map<string, string> }
  >();
  for (const { source, target, entries } of termPool.values()) {
    const sourceLangCode = resolveGlossarySourceCode(source);
    if (sourceLangCode === undefined) continue;
    const targetLangCode = resolveGlossaryTargetCode(target);
    if (targetLangCode === undefined) continue;
    const dictKey = `${sourceLangCode}->${targetLangCode}`;
    const dict = merged.get(dictKey) ?? {
      sourceLangCode,
      targetLangCode,
      entries: new Map<string, string>(),
    };
    for (const [k, v] of entries) dict.entries.set(k, v);
    merged.set(dictKey, dict);
  }
  return [...merged.values()].map((d) => ({
    sourceLangCode: d.sourceLangCode,
    targetLangCode: d.targetLangCode,
    entries: new deepl.GlossaryEntries({ entries: Object.fromEntries(d.entries) }),
  }));
}

export interface DeepLConfig {
  apiKey?: string;
  /**
   * Controls the glossary strategy and is shown in the config UI.
   * When 'free', all pushGlossary calls are merged into a single remote
   * multilingual glossary (DeepL Free tier's single-glossary limit).
   * When 'pro', one glossary per language pair is maintained.
   * The SDK also uses this to determine the API endpoint (free keys end with :fx).
   */
  tier?: 'free' | 'pro';
  /**
   * Which English regional variant to send to the DeepL API when the project
   * target language is bare `en`. DeepL deprecated the plain `en` code in 2024;
   * only `en-US` and `en-GB` are accepted. Defaults to `'en-US'`.
   */
  englishVariant?: 'en-US' | 'en-GB';
  /**
   * DeepL translation model to request via `modelType`. One of the ids returned
   * by `listModels()` (`latency_optimized` / `quality_optimized` /
   * `prefer_quality_optimized`). Defaults to `'quality_optimized'`.
   */
  model?: deepl.ModelType;
  /**
   * Global client-side rate limit (requests/second) injected by the host from
   * the workspace settings; applied per outbound HTTP request. 0/unset = off.
   */
  requestsPerSecond?: number;
  /** Credential provider injected by the host (e.g. CredentialStore adapter). */
  credentials?: CredentialProvider;
}

/**
 * Generic wrapper for a non-auth, non-rate-limit `deepl.DeepLError`.
 *
 * The `deepl-node` SDK does not surface the underlying HTTP status code on the
 * thrown error object (it maps status → error subclass internally and discards
 * the numeric code), so a meaningful status cannot be attached here. The two
 * statuses that matter to the engine — 401/403 (auth/quota) and 429 (rate
 * limit) — are mapped to the shared `AuthError`/`RateLimitError` *before* this
 * wrapper is reached (see `mapDeepLError`); anything left has an unknown status,
 * which is why this class deliberately carries no `status` field.
 */
export class DeepLApiError extends Error {
  constructor(message: string) {
    super(`DeepL API error: ${message}`);
    this.name = 'DeepLApiError';
  }
}

/**
 * Translate a thrown `deepl-node` error into the shared error vocabulary the
 * translation engine understands.
 *
 *  - `AuthorizationError` (HTTP 403) and `QuotaExceededError` (HTTP 456, an
 *    exhausted/over-quota key) become a shared `AuthError`. These are not
 *    retryable and affect every job using the key, so the engine cancels the
 *    whole run instead of grinding through each entry with the dead key.
 *  - `TooManyRequestsError` (HTTP 429) becomes a `RateLimitError`. The SDK does
 *    not expose the upstream `Retry-After` header on the error object (it
 *    handles back-off internally and discards the value), so no `retryAfterMs`
 *    is available — the engine applies its default 429 back-off.
 *  - Any other `DeepLError` becomes a generic `DeepLApiError`.
 *  - Non-DeepL errors (e.g. axios network failures, abort/cancel) are passed
 *    through unchanged so callers can inspect them by identity; their messages
 *    are transport-level, not a DeepL server body, so there is no key/body to
 *    redact at this boundary — the leak-prone path is the `DeepLError` branch
 *    above.
 *
 * Each DeepL error's surfaced message is passed through `toErrorMessage`,
 * matching every other provider's module boundary, so URLs and key/Bearer/
 * hex-token patterns in the underlying SDK message are redacted before the
 * engine records it.
 */
function mapDeepLError(e: unknown): unknown {
  if (e instanceof deepl.AuthorizationError) {
    return new AuthError(`DeepL authorization failed: ${toErrorMessage(e)}`, 403);
  }
  if (e instanceof deepl.QuotaExceededError) {
    return new AuthError(`DeepL quota exceeded: ${toErrorMessage(e)}`, 403);
  }
  if (e instanceof deepl.TooManyRequestsError) {
    // deepl-node surfaces no precise Retry-After on the error; omit retryAfterMs.
    const backoff = reportRateLimitHit('deepl');
    if (backoff.changed) {
      debug('deepl', 'rate-limit:backoff', {
        previousIntervalMs: backoff.previousIntervalMs,
        newIntervalMs: backoff.newIntervalMs,
      });
    }
    return new RateLimitError('DeepL rate limit');
  }
  if (e instanceof deepl.DeepLError) {
    return new DeepLApiError(toErrorMessage(e));
  }
  // Non-DeepL (e.g. an axios ConnectionError, or an abort/cancel error): pass it
  // through unchanged. The engine inspects these by identity (e.g. cancellation),
  // and a transport-level message carries no DeepL server body / key to redact —
  // the leak-prone path is the `DeepLError` branch above, which IS routed through
  // toErrorMessage. (Cancellation is handled via `signal?.aborted`, not here.)
  return e;
}

export function createDeepLModule(config: DeepLConfig = {}): TranslationModule {
  // Default to 'free' when tier is not explicitly set — mirrors the manifest
  // schema default so projects without a DeepL config use the correct
  // single-multilingual-glossary strategy instead of the pro pair-glossary path.
  const tier = config.tier ?? 'free';
  const englishVariant = config.englishVariant ?? 'en-US';
  // Which DeepL model to request; mirrors the configSchema/manifest default.
  const modelType: deepl.ModelType = config.model ?? 'quality_optimized';

  // Accumulate terms across pushGlossary calls into the single multilingual glossary.
  const freeTermPool = new Map<
    string,
    { source: string; target: string; entries: Map<string, string> }
  >();
  // Multilingual glossary ID (one object holds all lang-pair dicts).
  let freeGlossaryId: string | undefined;
  // Remapped `"src->tgt"` pairs the current free multilingual glossary actually
  // covers (a dictionary exists for the pair). DeepL rejects a translate request
  // that attaches a glossary_id whose glossary has no dictionary for that
  // request's (source, target) — and a glossary requires an explicit source. So
  // the free glossary is attached ONLY for pairs in this set (see translateBatch);
  // attaching it to every request (incl. unsupported targets / source-less
  // requests) made DeepL reject the whole call. Populated from a detected
  // pre-existing glossary's dictionaries and rebuilt on each push.
  const freeGlossaryPairs = new Set<string>();
  let freeGlossariesInitialized = false;
  // Whether freeTermPool has been seeded from the remote glossary this instance.
  // The pool is in-memory only: without seeding, a fresh instance (restart / new
  // vault session) would recreate the remote glossary with only the currently
  // pushed terms, erasing everything pushed before.
  let freePoolSeeded = false;
  // Non-free mode: one v2 glossary per lang pair ("src->tgt" → glossaryId).
  const pairGlossaries = new Map<string, string>();
  let pairGlossariesInitialized = false;

  function resolveApiKey(): string {
    if (config.apiKey) return config.apiKey;
    if (config.credentials) return config.credentials.get('DEEPL_API_KEY');
    throw new MissingCredentialError('DEEPL_API_KEY');
  }

  // Memoize the SDK client so repeated translate/pushGlossary calls reuse one
  // instance. Keyed on the resolved key so a later credential change (e.g.
  // config.apiKey or a re-keyed vault) rebuilds the client.
  let cachedClient: deepl.DeepLClient | undefined;
  let cachedKey: string | undefined;
  function getClient(): deepl.DeepLClient {
    const key = resolveApiKey();
    if (!cachedClient || cachedKey !== key) {
      cachedClient = new deepl.DeepLClient(key);
      cachedKey = key;
    }
    return cachedClient;
  }

  /** Global client-side rate limit: one slot per outbound DeepL HTTP request. */
  function awaitRateLimit(): Promise<void> {
    return acquireRateLimit('deepl', config.requestsPerSecond);
  }

  /**
   * Lazily populate `freeGlossaryId` from the remote listing so that a
   * pre-existing `narn.zercade.dev.glossary` (created manually or by a
   * previous server session) is detected without an extra API call on every
   * translate/push.
   */
  async function initFreeGlossary(client: deepl.DeepLClient): Promise<void> {
    if (freeGlossariesInitialized) return;
    freeGlossariesInitialized = true;
    try {
      await awaitRateLimit();
      const list = await client.listMultilingualGlossaries();
      const existing = list.find((g) => g.name === FREE_GLOSSARY_NAME);
      if (existing) {
        freeGlossaryId = existing.glossaryId;
        // Capture the pre-existing glossary's covered pairs so a translate that
        // reuses it (without a prior push this session) only attaches it for
        // pairs it actually has a dictionary for.
        for (const d of existing.dictionaries ?? []) {
          freeGlossaryPairs.add(`${d.sourceLangCode.toLowerCase()}->${d.targetLangCode.toLowerCase()}`);
        }
      }
    } catch {
      // Proceed without a cached ID — will be set after the next push.
    }
  }

  /**
   * Seed freeTermPool from the existing remote multilingual glossary so pushes
   * stay additive across instances. Runs at most once per instance, BEFORE the
   * push's own terms are merged (so incoming values win per source term). A
   * fetch failure throws (mapped): silently proceeding would recreate the
   * glossary without the unread terms — the exact clobber this prevents.
   */
  async function seedFreePoolFromRemote(client: deepl.DeepLClient): Promise<void> {
    if (freePoolSeeded) return;
    freePoolSeeded = true;
    if (!freeGlossaryId) return;
    for (const pair of freeGlossaryPairs) {
      const [source, target] = pair.split('->') as [string, string];
      try {
        await awaitRateLimit();
        const dict = await client.getMultilingualGlossaryDictionaryEntries(
          freeGlossaryId,
          source,
          target,
        );
        const pool = freeTermPool.get(pair) ?? {
          source,
          target,
          entries: new Map<string, string>(),
        };
        for (const [k, v] of Object.entries(dict.entries.entries())) {
          if (!pool.entries.has(k)) pool.entries.set(k, v);
        }
        freeTermPool.set(pair, pool);
      } catch (e) {
        freePoolSeeded = false; // retryable on the next push
        throw mapDeepLError(e);
      }
    }
  }

  async function initPairGlossaries(client: deepl.DeepLClient): Promise<void> {
    if (pairGlossariesInitialized) return;
    pairGlossariesInitialized = true;
    try {
      await awaitRateLimit();
      const list = await client.listGlossaries();
      for (const g of list) {
        if (g.name.startsWith(GLOSSARY_NAME_PREFIX)) {
          const key = `${g.sourceLang.toLowerCase()}->${g.targetLang.toLowerCase()}`;
          pairGlossaries.set(key, g.glossaryId);
        }
      }
    } catch {
      // Proceed without cached IDs — will be set after the next pushGlossary.
    }
  }

  /**
   * Replace-mode sweep: delete every narn-managed remote glossary on BOTH API
   * surfaces (multilingual + v2 pair), regardless of the configured tier, so a
   * past tier switch cannot strand remnants — then reset all in-memory glossary
   * state. Failures surface (mapped) rather than half-succeeding silently: a
   * partially erased remote with a green "pushed" toast would defeat the
   * feature's purpose. After the sweep the cleaned state is authoritative, so
   * the init flags are set to skip re-listing.
   */
  async function eraseManagedGlossaries(client: deepl.DeepLClient): Promise<void> {
    try {
      await awaitRateLimit();
      const multilingual = await client.listMultilingualGlossaries();
      for (const g of multilingual) {
        if (!isManagedGlossaryName(g.name)) continue;
        await awaitRateLimit();
        await client.deleteMultilingualGlossary(g.glossaryId);
      }
      await awaitRateLimit();
      const pairs = await client.listGlossaries();
      for (const g of pairs) {
        if (!isManagedGlossaryName(g.name)) continue;
        await awaitRateLimit();
        await client.deleteGlossary(g.glossaryId);
      }
    } catch (e) {
      throw mapDeepLError(e);
    }
    freeTermPool.clear();
    freeGlossaryId = undefined;
    freeGlossaryPairs.clear();
    freeGlossariesInitialized = true;
    // The remote is now empty, so there is nothing to seed — skip the seed
    // fetch so an erase & push carries only the freshly-pushed terms.
    freePoolSeeded = true;
    pairGlossaries.clear();
    pairGlossariesInitialized = true;
  }

  // No `signal` param: deepl-node's TranslateTextOptions exposes no abortSignal,
  // so an in-flight single batch cannot be cancelled mid-request. Cancellation is
  // therefore enforced only between batches in `translate` (the correct contract
  // given the SDK limitation).
  async function translateBatch(
    client: deepl.DeepLClient,
    jobs: TranslationJob[],
    sourceLanguage: string | undefined,
    targetLanguage: string,
    context?: string,
  ): Promise<TranslationResult[]> {
    const texts = jobs.map((j) => j.sourceText);
    const srcLang = sourceLanguage
      ? (toDeepLSourceCode(sourceLanguage) as deepl.SourceLanguageCode)
      : null;
    const tgtLang = toDeepLTargetCode(targetLanguage, englishVariant) as deepl.TargetLanguageCode;

    // Select the glossary based on the operating mode.
    let glossaryId: string | undefined;
    if (tier === 'free') {
      // Only attach the single multilingual glossary when it actually covers
      // this request's (source → target) pair. DeepL requires an explicit source
      // language alongside a glossary and rejects the request when the glossary
      // has no dictionary for the pair (e.g. an unsupported target such as
      // zh-hant/th, or a language never pushed) — which previously failed the
      // whole call. A source-less request can never resolve a pair, so it is
      // sent glossary-free rather than being rejected by DeepL.
      if (freeGlossaryId && sourceLanguage) {
        const key = pairGlossaryKey(sourceLanguage, targetLanguage);
        // `freeGlossaryPairs` stores lowercased keys; a regional source code
        // (e.g. fr-CA) uppercases its suffix via toDeepLSourceCode, so compare
        // case-insensitively to avoid silently dropping a covered glossary.
        if (key !== undefined && freeGlossaryPairs.has(key.toLowerCase()))
          glossaryId = freeGlossaryId;
      }
    } else if (sourceLanguage) {
      const key = pairGlossaryKey(sourceLanguage, targetLanguage);
      if (key !== undefined) glossaryId = pairGlossaries.get(key);
    }

    const { encoded: encodedTexts, placeholderMaps } = encodePlaceholders(texts);

    const options: deepl.TranslateTextOptions = {
      tagHandling: 'xml',
      nonSplittingTags: ['x', 'color'],
      modelType,
      preserveFormatting: true,
    };
    if (glossaryId) options.glossary = glossaryId;
    if (context) options.context = context;

    debug('deepl', tier, encodedTexts, srcLang, tgtLang, options);

    let results: deepl.TextResult[];
    try {
      await awaitRateLimit();
      const raw = await client.translateText(encodedTexts, srcLang, tgtLang, options);
      results = Array.isArray(raw) ? raw : [raw];
    } catch (e) {
      throw mapDeepLError(e);
    }
    debug('deepl', 'translateText results', results);
    // DeepL preserves a strict 1:1 input↔output mapping. Surface any contract
    // violation loudly instead of silently dropping trailing jobs (the result
    // map keys off `results`, so a short response would otherwise omit entries
    // with no diagnostic).
    if (results.length !== encodedTexts.length) {
      throw new DeepLApiError(
        `expected ${encodedTexts.length} results, received ${results.length}`,
      );
    }
    return results.map((r, i) => {
      const translatedText = decodePlaceholders(r.text, placeholderMaps[i] ?? []);
      const sourceChars = jobs[i].sourceText.length;
      // DeepL has no LLM prompt; the request is the source text plus the
      // optional shared context, and the response is the translation. Reported
      // per result (the host sums across results).
      return {
        entryId: jobs[i].entryId,
        targetLanguage,
        translatedText,
        rawResponse: r,
        usedGlossaryId: glossaryId,
        // DeepL bills per character and reports the billed count per text.
        // deepl-node types `billedCharacters` as a required number, so the
        // `typeof === 'number'` guard is defensive against a missing/non-numeric
        // value (e.g. a future or mocked SDK shape that omits the field): it
        // falls back to the source-character count so billing is never silently
        // zeroed for a translated entry (DeepL bills on the source). A genuine
        // `0` billed count passes the guard and is preserved as-is.
        usage: {
          characters: typeof r.billedCharacters === 'number' ? r.billedCharacters : sourceChars,
          promptChars: sourceChars + (context?.length ?? 0),
          sourceChars,
          responseChars: translatedText.length,
          outputChars: translatedText.length,
        },
      };
    });
  }

  return {
    id: 'deepl',
    name: 'DeepL',
    version: '1.0.0',
    capabilities: ['translate', 'glossary-push', 'batch'],
    costTier: 'low',
    configSchema: {
      apiKey: { type: 'string', format: 'password' },
      tier: { type: 'string', enum: ['free', 'pro'], default: 'free' },
      model: {
        type: 'string',
        enum: ['latency_optimized', 'quality_optimized', 'prefer_quality_optimized'],
        default: 'quality_optimized',
      },
      englishVariant: {
        type: 'string',
        enum: ['en-US', 'en-GB'],
        default: 'en-US',
        description:
          'English variant sent as the target language when the project language is English.',
        projectOnly: true,
      },
    },

    listModels: async () => DEEPL_TIER_MODELS,

    async translate(
      jobs: TranslationJob[],
      signal?: AbortSignal,
      options?: BatchDispatchOptions,
    ): Promise<TranslationResult[]> {
      if (jobs.length === 0) return [];
      const client = getClient();
      if (tier === 'free') {
        await initFreeGlossary(client);
      } else {
        await initPairGlossaries(client);
      }

      // Group by target language, then source language, then context, then chunk ≤50.
      const byTarget = new Map<string, TranslationJob[]>();
      for (const job of jobs) {
        const list = byTarget.get(job.targetLanguage) ?? [];
        list.push(job);
        byTarget.set(job.targetLanguage, list);
      }

      // A single translate() call fans out into several billed sub-requests
      // (per target / source / context, chunked ≤50). Results are placed back at
      // each job's INPUT position so the returned array matches the input order
      // (the engine maps a dispatch batch's results back positionally for jobs it
      // hasn't already seen via onJobComplete).
      const indexOf = new Map<TranslationJob, number>();
      jobs.forEach((job, i) => indexOf.set(job, i));
      const results: TranslationResult[] = new Array(jobs.length);

      // Per-sub-request error isolation (real-money fix): a late 429 / tag
      // failure in one sub-request must NOT discard the already-billed results of
      // earlier successful sub-requests — else the engine re-sends (and DeepL
      // re-bills) the whole batch on "Retry failed". So a failed sub-request
      // yields PER-ENTRY error results for only its own jobs and the loop
      // continues; auth failures (bad/exhausted key — every job is doomed) still
      // throw so the engine cancels the run. If EVERY sub-request failed there is
      // nothing billed to protect, so the original error is rethrown to preserve
      // the engine's whole-batch error/rate-limit-retry handling.
      let sawSuccess = false;
      let firstError: unknown;

      for (const [targetLanguage, targetJobs] of byTarget) {
        const bySource = new Map<string | undefined, TranslationJob[]>();
        for (const job of targetJobs) {
          const list = bySource.get(job.sourceLanguage) ?? [];
          list.push(job);
          bySource.set(job.sourceLanguage, list);
        }
        for (const [sourceLanguage, srcJobs] of bySource) {
          const byContext = new Map<string, TranslationJob[]>();
          for (const job of srcJobs) {
            const ctxKey = job.context ?? '';
            const list = byContext.get(ctxKey) ?? [];
            list.push(job);
            byContext.set(ctxKey, list);
          }
          for (const [ctxKey, ctxJobs] of byContext) {
            const context = ctxKey || undefined;
            for (const batch of chunkArray(ctxJobs, MAX_BATCH)) {
              // Once the run is cancelled, stop issuing (billed) DeepL requests
              // and report the remaining jobs as cancelled — matching the AI SDK
              // layer's cancellation contract.
              if (signal?.aborted) {
                for (const job of batch) results[indexOf.get(job)!] = cancelledResult(job);
                continue;
              }
              try {
                const batchResults = await translateBatch(
                  client,
                  batch,
                  sourceLanguage,
                  targetLanguage,
                  context,
                );
                sawSuccess = true;
                for (let k = 0; k < batch.length; k++) {
                  const r = batchResults[k];
                  results[indexOf.get(batch[k])!] = r;
                  // Report each completed job as it lands so the engine can
                  // persist it immediately (and never re-fail it if a later
                  // sub-request throws).
                  await options?.onJobComplete?.(r);
                }
              } catch (e) {
                // A bad/exhausted key dooms every job — surface it so the engine
                // cancels the whole run instead of grinding through each entry.
                if (e instanceof AuthError) throw e;
                if (firstError === undefined) firstError = e;
                const message = e instanceof Error ? e.message : `${e}`;
                for (const job of batch) {
                  results[indexOf.get(job)!] = {
                    entryId: job.entryId,
                    targetLanguage,
                    translatedText: '',
                    error: message,
                  };
                }
              }
            }
          }
        }
      }

      // Every sub-request failed (nothing billed to keep): rethrow the first
      // error so the engine's existing whole-batch handling (rate-limit retry,
      // failure recording) still applies — unchanged from the pre-fix contract.
      if (!sawSuccess && firstError !== undefined) throw firstError;

      return results;
    },

    async pushGlossary(
      glossary: Glossary,
      sourceLanguage?: string,
      opts?: { replace?: boolean },
    ): Promise<void> {
      const client = getClient();
      if (opts?.replace) await eraseManagedGlossaries(client);

      // The source field of a GlossaryTerm is always the English (EN) source text.
      const SOURCE_LANG = 'en';
      // Group terms by all (sourceLang, targetLang) combinations.
      const pairs = new Map<string, { source: string; target: string; terms: GlossaryTerm[] }>();
      for (const term of glossary.terms) {
        // Collect all language variants: EN source + all translations (deduped).
        const allVariantsMap = new Map([[SOURCE_LANG, term.source]]);
        for (const [lang, text] of Object.entries(term.translations)) {
          if (lang.toLowerCase() !== SOURCE_LANG) allVariantsMap.set(lang, text);
        }
        const allVariants = [...allVariantsMap.entries()];

        // Free mode allows all permutations (unless sourceLanguage restricts it).
        // Pro mode defaults to SOURCE_LANG when sourceLanguage is unspecified so that
        // only en→X pair-glossaries are created (game localisation always goes FROM English).
        const langFilter =
          tier === 'free'
            ? sourceLanguage?.toLowerCase()
            : (sourceLanguage ?? SOURCE_LANG).toLowerCase();
        for (const [srcLang, srcText] of allVariants) {
          if (!srcText?.trim()) continue;
          if (langFilter && srcLang.toLowerCase() !== langFilter) continue;
          for (const [tgtLang, tgtText] of allVariants) {
            if (srcLang === tgtLang || !tgtText?.trim()) continue;
            const key = `${srcLang}->${tgtLang}`;
            const bucket = pairs.get(key) ?? { source: srcLang, target: tgtLang, terms: [] };
            bucket.terms.push({
              id: term.id,
              source: srcText,
              translations: { [tgtLang]: tgtText },
            });
            pairs.set(key, bucket);
          }
        }
      }

      if (tier === 'free') {
        // Free mode: accumulate all pairs into a single multilingual glossary.
        // Additive-only by design (see the file header): merging — never
        // replacing — lets several host glossaries share the free tier's one
        // remote glossary.

        // Detect any pre-existing remote glossary (handles server restarts and
        // manually-created glossaries), then seed the in-memory pool from its
        // current entries BEFORE merging this push's own terms — otherwise a
        // fresh instance would recreate the remote with only this push's terms,
        // erasing everything pushed earlier. Seeding runs first so the push's
        // own terms (below) overwrite matching keys — incoming values win.
        await initFreeGlossary(client);
        await seedFreePoolFromRemote(client);

        for (const [key, { source, target, terms }] of pairs) {
          const pool = freeTermPool.get(key) ?? {
            source,
            target,
            entries: new Map<string, string>(),
          };
          for (const [source, v] of collectEntries(terms, target)) {
            pool.entries.set(source, v);
          }
          freeTermPool.set(key, pool);
        }

        // Delete the current multilingual glossary so we can recreate it with
        // the fully merged term set.
        if (freeGlossaryId) {
          try {
            await awaitRateLimit();
            await client.deleteMultilingualGlossary(freeGlossaryId);
          } catch {
            // Ignore — may have already been deleted remotely.
          }
          freeGlossaryId = undefined;
        }

        // Build one dictionary entry per accumulated language pair and push.
        const dicts = buildGlossaryDicts(freeTermPool);
        if (dicts.length === 0) return;
        try {
          await awaitRateLimit();
          const info = await client.createMultilingualGlossary(FREE_GLOSSARY_NAME, dicts);
          freeGlossaryId = info.glossaryId;
          // The recreated glossary now covers exactly the pushed dictionaries
          // (the additive pool is a superset of any prior remote), so rebuild the
          // covered-pair set from them — translateBatch attaches the glossary only
          // for pairs listed here.
          freeGlossaryPairs.clear();
          for (const d of dicts) {
            freeGlossaryPairs.add(
              `${d.sourceLangCode.toLowerCase()}->${d.targetLangCode.toLowerCase()}`,
            );
          }
        } catch (e) {
          throw mapDeepLError(e);
        }
      } else {
        // Non-free mode: create/update one v2 glossary per language pair.
        await initPairGlossaries(client);

        for (const [, { source, target, terms }] of pairs) {
          const resolvedSrc = resolveGlossarySourceCode(source);
          if (resolvedSrc === undefined) continue;
          const resolvedTgt = resolveGlossaryTargetCode(target);
          if (resolvedTgt === undefined) continue;
          const srcCode = resolvedSrc as deepl.SourceLanguageCode;
          const tgtCode = resolvedTgt as deepl.TargetLanguageCode;
          // Key shape must match pairGlossaryKey (the translateBatch lookup) so a
          // glossary created here is found at translate time.
          const pairKey = `${srcCode}->${tgtCode}`;
          const glossaryName = `${GLOSSARY_NAME_PREFIX}${srcCode}-${tgtCode}`;

          // Merge the remote pair glossary's current entries under the incoming
          // ones so pushing glossary B no longer erases glossary A's terms from
          // the same language pair. Incoming values win per source term. A
          // failed fetch aborts (mapped) rather than silently clobbering.
          const existingId = pairGlossaries.get(pairKey);
          const mergedEntries = new Map<string, string>();
          if (existingId) {
            try {
              await awaitRateLimit();
              const remote = await client.getGlossaryEntries(existingId);
              for (const [k, v] of Object.entries(remote.entries())) mergedEntries.set(k, v);
            } catch (e) {
              throw mapDeepLError(e);
            }
            try {
              await awaitRateLimit();
              await client.deleteGlossary(existingId);
            } catch {
              // Ignore — may have already been deleted remotely.
            }
            pairGlossaries.delete(pairKey);
          }

          // Merge the incoming terms over the remote ones. collectEntries drops
          // missing values so a future change can never push `undefined` into
          // GlossaryEntries.
          for (const [k, v] of collectEntries(terms, target)) mergedEntries.set(k, v);
          if (mergedEntries.size === 0) continue;
          const entries = new deepl.GlossaryEntries({
            entries: Object.fromEntries(mergedEntries),
          });

          try {
            await awaitRateLimit();
            const info = await client.createGlossary(glossaryName, srcCode, tgtCode, entries);
            pairGlossaries.set(pairKey, info.glossaryId);
          } catch (e) {
            throw mapDeepLError(e);
          }
        }
      }
    },
  };
}

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-deepl`). The relative `../manifest.json` resolves
// from both src/index.ts and the flat dist/index.js to modules/deepl/manifest.json.
export { default as manifest } from '../manifest.json' with { type: 'json' };

export default createDeepLModule;
