import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { wrapLanguageModel, defaultSettingsMiddleware } from 'ai';
import type { LanguageModel } from 'ai';
import type { ProviderType } from './types.js';
import type { CostTier } from '../types/module.js';
import { createSsrfGuardedFetch } from './config-coerce.js';

/** The `settings` object accepted by {@link defaultSettingsMiddleware}. */
type DefaultSettings = Parameters<typeof defaultSettingsMiddleware>[0]['settings'];
/** The JSON `responseFormat` variant of those settings (the `{ type:'json', … }` arm). */
type JsonResponseFormat = Extract<NonNullable<DefaultSettings['responseFormat']>, { type: 'json' }>;
/** AI SDK's JSON-schema type for `responseFormat.schema` (structurally JSONSchema7). */
type ResponseSchema = NonNullable<JsonResponseFormat['schema']>;

export const GENERIC_API_KEY = 'GENERIC_API_KEY';

/** Fixed OpenRouter endpoint. Never user-configurable — that is what keeps the
 * first-class openrouter module SSRF-safe and therefore cloud-enabled (unlike
 * generic-ai's arbitrary baseURL, which is cloudDisabled). */
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** Fixed GroqCloud endpoint. Never user-configurable — same SSRF rationale as
 * OPENROUTER_BASE_URL above. */
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/** OpenRouter's recommended app-attribution headers. */
const OPENROUTER_ATTRIBUTION_HEADERS = {
  'HTTP-Referer': 'https://github.com/zercade-dev/app-narn',
  'X-Title': 'NARN',
} as const;

// Order matters (first match wins). The cheaper `-mini`/`-nano` rows MUST precede
// the full-size rows that would otherwise also match: `gpt-5-mini`/`gpt-5-nano`
// before `gpt-5`, `gpt-4.1-mini` before `gpt-4.1`, and the `-mini` o-series row
// before the full o-series high row anchored on `/o[1-9]/`. The o-series rows are
// anchored on `o[1-9]` (at a leading or token boundary) so they don't match model
// names that merely contain an `o<digit>` substring.
export const OPENAI_COST_PATTERNS: Array<{ pattern: RegExp; tier: CostTier }> = [
  // Cheaper `-mini` / `-nano` variants, including o-series mini (o3-mini,
  // o4-mini) and gpt-5-nano (the cheapest gpt-5). These MUST precede the full
  // o-series / gpt-5 high row below, which otherwise matches them. The gpt-5.x
  // form is version-tolerant (`gpt-5`, `gpt-5.1`, `gpt-5.2`, …) so a future
  // point release's `-mini`/`-nano` variant (e.g. `gpt-5.1-codex-mini`) still
  // classifies as the cheap tier instead of falling through to the high row.
  {
    pattern:
      /gpt-4o-mini|gpt-3\.5|gpt-5(?:\.\d+)?-[a-z0-9.-]*(?:mini|nano)|gpt-4\.1-mini|(?:^|[^a-z0-9])o[1-9][a-z0-9.-]*-mini/i,
    tier: 'low',
  },
  { pattern: /gpt-4o(?!-mini)|gpt-4\.1(?!-mini)|gpt-4\b/i, tier: 'medium' },
  // Full-size high tier: gpt-5(.x) (not -mini/-nano) and the o-series (o1/o3/o4 …),
  // anchored on `o[1-9]` so a leading or token-boundary `o<digit>` is required
  // (won't match a model name that merely contains an `o<digit>` substring).
  { pattern: /gpt-5(?:\.\d+)?(?!-[a-z0-9.-]*(?:mini|nano))|(?:^|[^a-z0-9])o[1-9]/i, tier: 'high' },
];

export const ANTHROPIC_COST_PATTERNS: Array<{ pattern: RegExp; tier: CostTier }> = [
  { pattern: /haiku/i, tier: 'low' },
  { pattern: /sonnet/i, tier: 'medium' },
  { pattern: /opus/i, tier: 'high' },
  // `claude-fable-<n>` (e.g. claude-fable-5): keep this conservative — a
  // dedicated row rather than folding it into an existing haiku/sonnet/opus
  // pattern, since "fable" is a distinct model family, not a size variant of
  // one of those three. Falls through to manifest medium (the pre-existing
  // fallback) if this pattern is ever wrong; F:347 only asks that it not be
  // silently absent from the table.
  { pattern: /claude-fable/i, tier: 'medium' },
];

// Order matters (first match wins) and is intentional: `flash` (incl.
// flash-lite) is the cheap tier; `pro` is the standard tier; only an `exp`/
// `ultra` model that is NOT a flash/pro variant reaches the high row. In
// particular a `*-pro-exp` model (e.g. gemini-2.5-pro-exp) resolves to `medium`
// via the `pro` row above — it is priced as the pro family, not bumped to
// `high` for carrying the experimental `exp` tag.
export const GOOGLE_COST_PATTERNS: Array<{ pattern: RegExp; tier: CostTier }> = [
  { pattern: /flash/i, tier: 'low' },
  { pattern: /pro/i, tier: 'medium' },
  { pattern: /exp|ultra/i, tier: 'high' },
];

export const DEEPSEEK_COST_PATTERNS: Array<{ pattern: RegExp; tier: CostTier }> = [
  { pattern: /reasoner/i, tier: 'high' },
  { pattern: /chat/i, tier: 'medium' },
  // The V3.2-exp / V4+ configurable-thinking family (deepseek-v3.2-exp,
  // deepseek-v4-*). Thinking is per-request-optional rather than intrinsic, so
  // they sit at the standard-chat tier rather than the always-reasoning `high`.
  // Mirrors DEEPSEEK_THINKING_CONFIGURABLE_PATTERN in reasoning-resolvers.ts.
  { pattern: /deepseek-v(?:3\.(?:[2-9]|\d{2,})|[4-9]|\d{2,})/i, tier: 'medium' },
];

/**
 * Per-provider cost-pattern registry for the first-party LLM provider modules.
 * Lets each provider module collapse to a one-line `createProviderModule` call
 * (see core.ts) instead of re-declaring its own pattern table.
 */
export const PROVIDER_COST_PATTERNS: Partial<
  Record<ProviderType, Array<{ pattern: RegExp; tier: CostTier }>>
> = {
  openai: OPENAI_COST_PATTERNS,
  anthropic: ANTHROPIC_COST_PATTERNS,
  google: GOOGLE_COST_PATTERNS,
  deepseek: DEEPSEEK_COST_PATTERNS,
};

/**
 * Wraps a JSON schema in the OpenAI `response_format` envelope used by
 * openai-compatible endpoints. The schema name is cosmetic (backends like
 * Ollama ignore it), so a single constant suffices for every feature.
 */
export function jsonSchemaResponseFormat(schema: Record<string, unknown>): {
  type: 'json_schema';
  json_schema: { name: string; schema: Record<string, unknown> };
} {
  return { type: 'json_schema', json_schema: { name: 'response', schema } };
}

/**
 * Request-body transform for openai-compatible structured-output mode: injects a
 * `response_format` for the given schema without disturbing other fields. A
 * grammar-backed backend (Ollama/llama.cpp) then cannot emit prose, code fences,
 * or output that violates the schema. Applied via the provider's
 * `transformRequestBody` hook; the schema is feature-specific (string array for
 * translation, verdict/finding/suggestion objects for the AI-review features).
 */
export function withResponseFormat(
  schema: Record<string, unknown>,
): (body: Record<string, unknown>) => Record<string, unknown> {
  const responseFormat = jsonSchemaResponseFormat(schema);
  return (body) => ({ ...body, response_format: responseFormat });
}

/**
 * True when `schema` (searched recursively) uses `additionalProperties` — a
 * map-shaped object schema. Gemini's OpenAPI-subset responseSchema cannot
 * express the keyword (see the google branch of
 * {@link nativeStructuredOutputSettings}). The check is deliberately
 * conservative — any occurrence of the key at any depth counts: a false
 * positive merely downgrades google to schema-less JSON mode, while a miss
 * sends Gemini an unfillable schema whose constrained decoding degenerates
 * into whitespace and a guaranteed parse failure.
 * @internal exported for unit-testing
 */
export function schemaUsesAdditionalProperties(schema: unknown): boolean {
  if (Array.isArray(schema)) return schema.some(schemaUsesAdditionalProperties);
  if (schema === null || typeof schema !== 'object') return false;
  const record = schema as Record<string, unknown>;
  if (record.additionalProperties !== undefined && record.additionalProperties !== false) {
    return true;
  }
  return Object.values(record).some(schemaUsesAdditionalProperties);
}

/**
 * Effective `useStructuredOutput` for a module's raw config value. Any SET
 * value keeps the strict `=== true` semantics used since the flag shipped (a
 * stringy or legacy value is treated as off). An UNSET value (undefined /
 * null / '' — the settings UI never persists untouched fields, and
 * resolveEffectiveModuleConfig treats '' as absent) falls back to the
 * per-provider default: ON for google — Gemini's native JSON mode is stable
 * and the map-shape fallback in nativeStructuredOutputSettings keeps every
 * feature schema safe to enforce — OFF for every other provider, matching the
 * previous behavior. MUST stay in lockstep with each manifest's
 * `useStructuredOutput.default`: the UI checkbox renders that default for
 * unset fields, so a mismatch would show a checked box while the runtime ran
 * unconstrained (or vice versa).
 */
export function resolveUseStructuredOutput(value: unknown, provider: ProviderType): boolean {
  if (value === undefined || value === null || value === '') return provider === 'google';
  return value === true;
}

/**
 * Settings injected (via {@link defaultSettingsMiddleware}) to turn on a cloud
 * provider's NATIVE structured-output mechanism for the given schema, keeping the
 * `generateText` + manual-parse flow. Returns `undefined` when the provider has
 * no clean native path (anthropic) or uses a different mechanism (the
 * `*-compatible` branches inject `response_format` via `transformRequestBody`
 * instead). The AI SDK maps a `responseFormat: { type:'json', schema }` core
 * option per provider:
 *   - openai   → `response_format / text.format: { type:'json_object' }` (JSON
 *                mode). The installed @ai-sdk/openai defaults `openai(id)` to the
 *                Responses API, whose json_schema requires a ROOT-OBJECT schema;
 *                our feature schemas are root arrays (e.g. TRANSLATION_RESPONSE_
 *                SCHEMA), which the Responses API rejects. So the schema is
 *                intentionally omitted and plain JSON mode is used — it still
 *                forces syntactically valid JSON (the prompt already pins the
 *                array shape), keeping the generateText + parseBatchResponse flow.
 *   - google   → `responseMimeType:'application/json'` + `responseSchema`
 *                (structuredOutputs provider option defaults on). Gemini supports
 *                a root-array responseSchema, so the full schema is sent — EXCEPT
 *                map-shaped schemas (`additionalProperties`), which Gemini's
 *                OpenAPI subset cannot express; those downgrade to JSON mode
 *                (see the branch body).
 *   - deepseek → `response_format: { type:'json_object' }`. DeepSeek has no
 *                schema-strict mode, so the schema is intentionally omitted (a
 *                schema would only add an extra "conform to schema" system message
 *                plus an unsupported-feature warning); JSON mode alone is enough.
 * @internal exported for unit-testing
 */
export function nativeStructuredOutputSettings(
  provider: ProviderType,
  schema: Record<string, unknown>,
): DefaultSettings | undefined {
  // The AI SDK's responseFormat.schema is JSONSchema7; our schemas are plain
  // JSON-schema objects, structurally compatible at this boundary.
  const jsonSchema = schema as ResponseSchema;
  if (provider === 'openai') {
    // JSON mode only (no schema): the Responses API the SDK targets by default
    // rejects a root-array json_schema, and our schemas are root arrays.
    return { responseFormat: { type: 'json' } };
  }
  if (provider === 'google') {
    // Gemini's responseSchema speaks an OpenAPI-3.0 SUBSET with no
    // `additionalProperties`: @ai-sdk/google's convertJSONSchemaToOpenAPISchema
    // silently DROPS the keyword, so a map-shaped object (e.g.
    // MIXED_TARGET_RESPONSE_SCHEMA's `t`: language code → translation, or
    // glossary-suggest's `termNotes`) reaches Gemini as a propertyless OBJECT.
    // Gemini ACCEPTS that request and constrains decoding to the unfillable
    // grammar: after emitting `"t": {` the only permitted tokens are whitespace
    // and `}`, so the model floods whitespace until the output budget dies and
    // the reply fails to parse (observed in production, 2026-07-02). For those
    // schemas fall back to plain JSON mode (responseMimeType only, the same
    // schema-less constraint openai/deepseek use): decoding is still
    // constrained to valid JSON, without the unexpressible schema.
    if (schemaUsesAdditionalProperties(schema)) {
      return { responseFormat: { type: 'json' } };
    }
    return { responseFormat: { type: 'json', schema: jsonSchema, name: 'response' } };
  }
  if (provider === 'deepseek') {
    // JSON mode only — no schema (DeepSeek doesn't enforce schemas).
    return { responseFormat: { type: 'json' } };
  }
  // anthropic: no clean native path that preserves generateText + text parsing
  // (its json_schema/jsonTool shim returns a tool call for older models), so the
  // flag is a deliberate no-op. openai-compatible / anthropic-compatible inject
  // their own response_format via transformRequestBody and never reach here.
  return undefined;
}

/**
 * Wraps a base provider model so every `generateText` call carries the native
 * structured-output settings for `schema`. A no-op (returns the base model) when
 * the provider has no clean native path.
 */
function withNativeStructuredOutput(
  provider: ProviderType,
  model: LanguageModel,
  schema: Record<string, unknown>,
): LanguageModel {
  const settings = nativeStructuredOutputSettings(provider, schema);
  // The official providers (openai/google/deepseek) always return a v3 model
  // object, never a model-id string nor a v2 model — but the LanguageModel union
  // is `string | LanguageModelV3 | LanguageModelV2`. Guard the string case
  // defensively; the v2 arm never occurs here, so cast to wrapLanguageModel's
  // expected model type.
  if (!settings || typeof model === 'string') return model;
  type WrapModel = Parameters<typeof wrapLanguageModel>[0]['model'];
  return wrapLanguageModel({
    model: model as WrapModel,
    middleware: defaultSettingsMiddleware({ settings }),
  });
}

export function createModelForProvider(
  provider: ProviderType,
  opts: {
    apiKey: string;
    modelId: string;
    baseURL?: string;
    /**
     * Enable the provider's NATIVE structured-output mode so the reply is
     * constrained server-side. Effect by provider: openai → JSON mode
     * (json_object; the Responses API rejects this root-array schema); google →
     * responseSchema (full schema); deepseek → JSON mode; openai-compatible →
     * json_schema response_format via transformRequestBody. No effect on
     * anthropic / anthropic-compatible (no clean native path that keeps the
     * manual text-parse flow). See {@link AISDKModuleConfig.useStructuredOutput}.
     */
    responseFormatSchema?: Record<string, unknown>;
  },
): LanguageModel {
  // google / deepseek / openai share the create-then-optionally-wrap shape:
  // build the provider's base model, then apply the native structured-output
  // wrapper iff a response schema was requested.
  const withSchema = (model: LanguageModel): LanguageModel =>
    opts.responseFormatSchema
      ? withNativeStructuredOutput(provider, model, opts.responseFormatSchema)
      : model;

  // SSRF redirect-follow backstop: the provider's default fetch transparently
  // FOLLOWS redirects, so a literal-host-valid baseURL that answers `302 Location:
  // http://169.254.169.254/` would be followed WITH the BYOK credential attached.
  // Drive every provider through the guarded fetch (redirect:'manual' + per-hop
  // host re-validation + cross-origin credential stripping) instead. The AI SDK's
  // `fetch` option is the documented seam for this on all five factories.
  const fetch = createSsrfGuardedFetch() as never;

  if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey: opts.apiKey, fetch });
    return withSchema(google(opts.modelId));
  }
  if (provider === 'deepseek') {
    const deepseek = createDeepSeek({ apiKey: opts.apiKey, fetch });
    return withSchema(deepseek(opts.modelId));
  }
  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey: opts.apiKey, fetch });
    return withSchema(openai(opts.modelId));
  }
  if (provider === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: opts.apiKey, fetch });
    // responseFormatSchema is intentionally a no-op for anthropic: its native
    // json_schema/jsonTool path returns a tool call (not text) for models without
    // outputFormat support, which would break parseBatchResponse. Keep text parsing.
    return anthropic(opts.modelId);
  }
  if (provider === 'openrouter') {
    // Same OpenAI-compatible transport as generic-ai, but pinned to the
    // OpenRouter endpoint (config.baseURL is deliberately ignored) and carrying
    // the attribution headers. Structured output uses the same
    // transformRequestBody response_format injection as openai-compatible.
    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      baseURL: OPENROUTER_BASE_URL,
      apiKey: opts.apiKey,
      headers: { ...OPENROUTER_ATTRIBUTION_HEADERS },
      fetch,
      ...(opts.responseFormatSchema
        ? { transformRequestBody: withResponseFormat(opts.responseFormatSchema) }
        : {}),
    });
    return openrouter(opts.modelId);
  }
  if (provider === 'groq') {
    // Same OpenAI-compatible transport as openrouter, pinned to the GroqCloud
    // endpoint (config.baseURL is deliberately ignored — fixed first-party
    // endpoint, no SSRF surface). Structured output uses the same
    // transformRequestBody response_format injection as openai-compatible.
    const groq = createOpenAICompatible({
      name: 'groq',
      baseURL: GROQ_BASE_URL,
      apiKey: opts.apiKey,
      fetch,
      ...(opts.responseFormatSchema
        ? { transformRequestBody: withResponseFormat(opts.responseFormatSchema) }
        : {}),
    });
    return groq(opts.modelId);
  }
  if (provider === 'openai-compatible') {
    let baseURL = opts.baseURL || 'http://localhost:11434/v1';

    // Normalize baseURL: ensure it ends in /v1 for OpenAI-compatible endpoints if not already present.
    // This handles users providing just the host (e.g. http://ollama:11434)
    if (!baseURL.endsWith('/v1') && !baseURL.endsWith('/v1/')) {
      baseURL = baseURL.replace(/\/$/, '') + '/v1';
    }

    const openai = createOpenAICompatible({
      name: 'generic',
      baseURL,
      apiKey: opts.apiKey || 'not-needed',
      fetch,
      ...(opts.responseFormatSchema
        ? { transformRequestBody: withResponseFormat(opts.responseFormatSchema) }
        : {}),
    });
    return openai(opts.modelId);
  }
  if (provider === 'anthropic-compatible') {
    const anthropic = createAnthropic({
      apiKey: opts.apiKey || 'sk-ant-not-needed',
      baseURL: opts.baseURL || undefined,
      fetch,
    });
    return anthropic(opts.modelId);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

export function credentialKeyForProvider(provider: ProviderType): string {
  const keys: Record<ProviderType, string> = {
    google: 'GOOGLE_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    groq: 'GROQ_API_KEY',
    'openai-compatible': 'OPENAI_API_KEY',
    'anthropic-compatible': 'ANTHROPIC_API_KEY',
  };
  return keys[provider];
}

// These defaults and the pricing-oracle Anthropic alias are pinned snapshots;
// advancing them is a user-visible cost change that needs product sign-off, so
// they are not auto-updated here.
export function defaultModelForProvider(provider: ProviderType): string {
  const defaults: Record<ProviderType, string> = {
    google: 'gemini-2.5-flash',
    deepseek: 'deepseek-reasoner',
    openai: 'gpt-4o',
    anthropic: 'claude-3-5-sonnet-20241022',
    openrouter: 'openai/gpt-4o-mini',
    groq: 'openai/gpt-oss-120b',
    'openai-compatible': 'gpt-4o',
    'anthropic-compatible': 'claude-3-5-sonnet-20241022',
  };
  return defaults[provider];
}

export function deriveCostTierFromModel(
  model: string,
  patterns: Array<{ pattern: RegExp; tier: CostTier }>,
  fallback: CostTier,
): CostTier {
  for (const { pattern, tier } of patterns) {
    if (pattern.test(model)) return tier;
  }
  return fallback;
}
