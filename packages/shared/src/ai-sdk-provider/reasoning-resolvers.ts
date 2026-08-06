import type { ModelInfo, ReasoningEffort } from '../types/models.js';
import type { EndpointType, ProviderType } from './types.js';
import { maskSecret, redactSecretsFromError } from '../mask.js';
import { toErrorMessage } from '../error-utils.js';
import { AuthError, RateLimitError } from '../types/errors.js';
import {
  lookupBilling,
  lookupCapabilityTags,
  lookupContextLength,
  modelEmitsNonTextOnly,
  billingFromOpenRouterPricing,
} from './pricing-oracle.js';
import { createSsrfGuardedFetch, redactUrlUserinfo, validateBaseURL } from './config-coerce.js';

/**
 * SSRF redirect guard for every outbound discovery / probe / unload fetch in
 * this module. Each carries the BYOK credential (Authorization / x-api-key /
 * x-goog-api-key) to a provider — or to a user-configured local/compatible
 * baseURL (Ollama / LM Studio / vLLM / OpenRouter) — and the default fetch would
 * transparently FOLLOW a `302 Location: http://169.254.169.254/`, re-sending the
 * credential to the metadata host. Routing through the guard issues
 * `redirect:'manual'` and re-validates any 3xx target before following (refusing
 * internal/private/metadata, stripping creds cross-origin). `globalThis.fetch` is
 * resolved lazily per call, so a test that stubs it after import is honored.
 */
const ssrfFetch = createSsrfGuardedFetch();

/**
 * When a provider model-listing fetch returns 401/403/429, throw a typed error
 * the caller can surface instead of swallowing it as an empty `[]` list (which
 * the UI reports as "no models", masking a bad key or a quota wall). Other
 * non-OK statuses are left for the caller to log + return `[]` as before.
 * `provider` is only used to construct the Retry-After-less rate-limit message.
 */
function throwIfAuthOrRateLimitStatus(provider: string, status: number, body: string): void {
  if (status === 429) {
    throw new RateLimitError(`[${provider}] model listing rate-limited (HTTP 429): ${body}`);
  }
  if (status === 401 || status === 403) {
    throw new AuthError(
      `[${provider}] model listing rejected (HTTP ${status}): ${body}`,
      status === 403 ? 403 : 401,
    );
  }
}

/** Spread helper: attach `billing` only when the oracle has a match. */
function billingFor(id: string): Pick<ModelInfo, 'billing'> | Record<string, never> {
  const billing = lookupBilling(id);
  return billing ? { billing } : {};
}

/** Canonical display order for capability badges (matches the pre-migration OpenRouter convention). */
const CAPABILITY_TAG_ORDER = ['thinking', 'tools', 'vision', 'audio'] as const;

/**
 * Spread helper: attach `capabilityTags` merging the pricing snapshot's tags
 * with any locally-known extras (e.g. a `thinking` tag derived from
 * `supportedReasoningEfforts`, or Anthropic's live `vision` flag), deduped
 * and sorted into canonical order.
 */
function capabilitiesFor(
  id: string,
  extraTags: string[] = [],
): Pick<ModelInfo, 'capabilityTags'> | Record<string, never> {
  const tags = new Set([...(lookupCapabilityTags(id) ?? []), ...extraTags]);
  if (tags.size === 0) return {};
  const ordered = CAPABILITY_TAG_ORDER.filter((t) => tags.has(t));
  const rest = [...tags].filter((t) => !(CAPABILITY_TAG_ORDER as readonly string[]).includes(t));
  return { capabilityTags: [...ordered, ...rest] };
}

/** Spread helper: attach `contextLength` only when the oracle has a match. */
function contextFor(id: string): Pick<ModelInfo, 'contextLength'> | Record<string, never> {
  const contextLength = lookupContextLength(id);
  return contextLength !== undefined ? { contextLength } : {};
}

// ─── Reasoning capability detection ──────────────────────────────────────────

/**
 * DeepSeek model ids whose thinking mode is configurable per request
 * (V3.2-exp and the V4 family onward). deepseek-chat is non-thinking and
 * deepseek-reasoner / R1 think intrinsically (not configurable), so neither
 * accepts reasoning provider options.
 */
const DEEPSEEK_THINKING_CONFIGURABLE_PATTERN = /^deepseek-v(?:3\.(?:[2-9]|\d{2,})|[4-9]|\d{2,})/i;

/**
 * Whether `modelId` accepts reasoning-effort/thinking provider options for
 * `provider`. Returns `undefined` when the answer is unknown (e.g. custom or
 * compatible endpoints) — callers must NOT guard in that case, preserving
 * current behavior for models we cannot classify.
 */
export function modelSupportsReasoning(
  provider: ProviderType,
  modelId: string,
): boolean | undefined {
  switch (provider) {
    case 'openai':
      return openAIEffortsForModel(modelId).length > 0;
    case 'anthropic': {
      // Non-thinking families predate extended thinking (3.5 and earlier).
      if (
        /^claude-3-5-/i.test(modelId) ||
        /^claude-3-(haiku|opus|sonnet)/i.test(modelId) ||
        /^claude-2/i.test(modelId) ||
        /^claude-instant/i.test(modelId)
      ) {
        return false;
      }
      // claude-3-7-* introduced extended thinking; 4.x+ and fable families support it.
      if (
        /^claude-3-7-/i.test(modelId) ||
        /^claude-(opus|sonnet|haiku)-[4-9]/i.test(modelId) ||
        /fable/i.test(modelId)
      ) {
        return true;
      }
      return undefined;
    }
    case 'deepseek': {
      if (DEEPSEEK_THINKING_CONFIGURABLE_PATTERN.test(modelId)) return true;
      // deepseek-chat: non-thinking; deepseek-reasoner / R1: thinking is
      // intrinsic, not configurable — reasoning options are rejected.
      if (/^deepseek-chat/i.test(modelId)) return false;
      if (/^deepseek-(reasoner|r1)/i.test(modelId)) return false;
      return undefined;
    }
    case 'google': {
      if (/^gemini-1/i.test(modelId) || /^gemini-2\.0/i.test(modelId)) return false;
      if (/^gemini-2\.5/i.test(modelId) || /^gemini-3/i.test(modelId)) return true;
      return undefined;
    }
    // Compatible endpoints proxy arbitrary backends — unknown by design.
    case 'openai-compatible':
    case 'anthropic-compatible':
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Whether an explicit "disabled" reasoning choice can actually turn thinking
 * OFF for this provider+model. Single source of truth shared by the model
 * resolvers (whether to advertise `disabled` in `supportedReasoningEfforts`)
 * and `buildProviderOptions` (whether to emit a positive off-signal for it).
 *
 * Distinct from `modelSupportsReasoning`: a model can support reasoning yet be
 * unable to switch it off — OpenAI o-series / gpt-5 always reason, Gemini 2.5
 * Pro has a non-zero minimum thinking budget, and Gemini 3 exposes thinkingLevel
 * with no "off". For those, the UI should hide `disabled` rather than show a
 * toggle that silently no-ops.
 */
export function modelSupportsDisableThinking(provider: ProviderType, modelId: string): boolean {
  switch (provider) {
    case 'anthropic':
      // Extended-thinking Claude models run with thinking omitted (= off).
      return modelSupportsReasoning('anthropic', modelId) === true;
    case 'google':
      // 2.5 Flash / Flash-Lite accept thinkingBudget 0; 2.5 Pro and Gemini 3 cannot.
      return /^gemini-2\.5/i.test(modelId) && !/pro/i.test(modelId);
    case 'deepseek':
      // Only the per-request-configurable family (V3.2+/V4) can toggle thinking.
      return DEEPSEEK_THINKING_CONFIGURABLE_PATTERN.test(modelId);
    default:
      // OpenAI reasoning can't be turned off; compatible endpoints are unknown
      // by design (omitting options is the safest default there).
      return false;
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

const ANTHROPIC_VALID_EFFORTS = new Set<string>([
  'disabled',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);

export async function resolveAnthropicModels({
  apiKey,
}: {
  apiKey: string;
  baseURL?: string;
}): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  let afterId: string | undefined;

  try {
    while (true) {
      const url = new URL('https://api.anthropic.com/v1/models');
      url.searchParams.set('limit', '100');
      if (afterId) url.searchParams.set('after_id', afterId);

      const res = await ssrfFetch(url.toString(), {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => 'No body');
        console.error(
          `[anthropic] fetch failed (HTTP ${res.status}) key=${maskSecret(apiKey)} body=${toErrorMessage(errBody)}`,
        );
        throwIfAuthOrRateLimitStatus('anthropic', res.status, errBody);
        return [];
      }

      const json = (await res.json()) as {
        data: Array<{
          id: string;
          display_name?: string;
          capabilities?: {
            thinking?: { supported?: boolean };
            effort?: Record<string, { supported?: boolean }>;
            image_input?: { supported?: boolean };
          };
          max_input_tokens?: number;
        }>;
        has_more: boolean;
        last_id?: string;
      };

      for (const model of json.data) {
        // Drop image/audio generators (output modality lacks `text`) — they
        // can't translate. Unknown models are kept (the helper returns false).
        if (modelEmitsNonTextOnly(model.id)) continue;
        const thinkingSupported = model.capabilities?.thinking?.supported;
        const effortMap = model.capabilities?.effort;

        let supportedReasoningEfforts: ReasoningEffort[] = [];

        if (thinkingSupported !== false && effortMap) {
          const efforts = Object.entries(effortMap)
            .filter(([key, val]) => val?.supported === true && ANTHROPIC_VALID_EFFORTS.has(key))
            .map(([key]) => key as ReasoningEffort);

          // Sort by canonical order
          const order: ReasoningEffort[] = [
            'disabled',
            'minimal',
            'low',
            'medium',
            'high',
            'xhigh',
            'max',
          ];
          supportedReasoningEfforts = order.filter((e) => efforts.includes(e));

          // Always offer an explicit "disabled" choice when the model supports
          // any effort (matches the openai/google resolver convention) so the
          // UI can turn thinking off without falling back to the provider default.
          if (
            supportedReasoningEfforts.length > 0 &&
            !supportedReasoningEfforts.includes('disabled')
          ) {
            supportedReasoningEfforts = ['disabled', ...supportedReasoningEfforts];
          }
        }

        // Thinking-capable but no graded effort levels (e.g. Claude Haiku 4.5,
        // which accepts adaptive thinking but rejects the `effort` parameter):
        // still expose an on/off choice so thinking can be enabled or disabled
        // from the UI. Gate on the live `thinking` capability, falling back to
        // the id heuristic for models whose capability metadata omits it.
        const thinkingCapable =
          thinkingSupported === true || modelSupportsReasoning('anthropic', model.id) === true;
        if (supportedReasoningEfforts.length === 0 && thinkingCapable) {
          supportedReasoningEfforts = ['disabled', 'enabled'];
        }

        // Pre-select a sensible default: a graded mid-level when efforts exist,
        // or "enabled" (thinking on) for on/off-only models. Omitted when the
        // model has no reasoning mode at all.
        const defaultReasoningEffort: ReasoningEffort | undefined =
          supportedReasoningEfforts.length === 0
            ? undefined
            : supportedReasoningEfforts.includes('enabled')
              ? 'enabled'
              : 'medium';

        const extraTags = [
          ...(supportedReasoningEfforts.length > 0 ? ['thinking'] : []),
          ...(model.capabilities?.image_input?.supported ? ['vision'] : []),
        ];

        models.push({
          id: model.id,
          name: model.display_name,
          supportedReasoningEfforts,
          ...billingFor(model.id),
          ...capabilitiesFor(model.id, extraTags),
          ...contextFor(model.id),
          ...(typeof model.max_input_tokens === 'number' && model.max_input_tokens > 0
            ? { contextLength: model.max_input_tokens }
            : {}),
          ...(defaultReasoningEffort ? { defaultReasoningEffort } : {}),
        });
      }

      if (!json.has_more) break;
      afterId = json.last_id;
    }
  } catch (err) {
    // A typed auth/rate-limit error is intentional — propagate it so the caller
    // surfaces a bad key / quota wall instead of an empty list.
    if (err instanceof AuthError || err instanceof RateLimitError) throw err;
    console.error(
      `[anthropic] fetch error key=${maskSecret(apiKey)}`,
      redactSecretsFromError(err, [apiKey]),
    );
    return [];
  }

  return models;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

const OPENAI_EFFORT_MAP: Array<{ pattern: RegExp; efforts: ReasoningEffort[] }> = [
  {
    // OpenAI reasoning models (o-series / gpt-5) always reason — no "off".
    pattern: /^o[1-9]|gpt-5/i,
    efforts: ['low', 'medium', 'high'] as ReasoningEffort[],
  },
];

function openAIEffortsForModel(id: string): ReasoningEffort[] {
  for (const { pattern, efforts } of OPENAI_EFFORT_MAP) {
    if (pattern.test(id)) return efforts;
  }
  return [];
}

/**
 * Name/id tokens that mark an OpenAI `/v1/models` entry as not text-to-text:
 * image generation (`image`, `dall-e`, `gpt-image`), TTS/audio (`tts`,
 * `audio`, `gpt-audio`), video (`sora`, `video`), and `vision-only` models.
 * Static fallback for the OpenRouter modality feed this app no longer has.
 */
const OPENAI_NON_TEXT_NAME_PATTERN =
  /\b(image|tts|audio|vision-only|dall-e|gpt-image|gpt-audio|sora|video)\b/i;

export async function resolveOpenAIModels({
  apiKey,
}: {
  apiKey: string;
  baseURL?: string;
}): Promise<ModelInfo[]> {
  try {
    const res = await ssrfFetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'No body');
      console.error(
        `[openai] fetch failed (HTTP ${res.status}) key=${maskSecret(apiKey)} body=${toErrorMessage(errBody)}`,
      );
      throwIfAuthOrRateLimitStatus('openai', res.status, errBody);
      return [];
    }

    const json = (await res.json()) as { data: Array<{ id: string }> };

    // Drop non-text-output models (image/TTS/etc.) that the OpenAI /models
    // endpoint lists alongside chat models; they can't translate. Combines the
    // (now always-false, no-op post-OpenRouter-removal) feed check with a
    // static name-pattern fallback.
    return json.data
      .filter((m) => !modelEmitsNonTextOnly(m.id) && !OPENAI_NON_TEXT_NAME_PATTERN.test(m.id))
      .map((m) => {
        const efforts = openAIEffortsForModel(m.id);
        return {
          id: m.id,
          supportedReasoningEfforts: efforts,
          ...billingFor(m.id),
          ...capabilitiesFor(m.id, efforts.length > 0 ? ['thinking'] : []),
          ...contextFor(m.id),
          ...(efforts.length > 0 ? { defaultReasoningEffort: 'medium' as ReasoningEffort } : {}),
        };
      });
  } catch (err) {
    if (err instanceof AuthError || err instanceof RateLimitError) throw err;
    console.error(
      `[openai] fetch error key=${maskSecret(apiKey)}`,
      redactSecretsFromError(err, [apiKey]),
    );
    return [];
  }
}

// ─── Google ───────────────────────────────────────────────────────────────────

function googleEffortsForThinkingModel(id: string): ReasoningEffort[] {
  if (/gemini-3/i.test(id)) {
    // Gemini 3: thinkingLevel only — thinking can't be turned off.
    return ['minimal', 'low', 'medium', 'high'] as ReasoningEffort[];
  }
  // Gemini 2.5 and other thinking models. `disabled` is offered only where it
  // can actually be honored (2.5 Flash / Flash-Lite); 2.5 Pro can't disable.
  const base: ReasoningEffort[] = ['low', 'medium', 'high'];
  return (
    modelSupportsDisableThinking('google', id) ? ['disabled', ...base] : base
  ) as ReasoningEffort[];
}

/** One entry of the `/v1beta/models` list response (raw JSON may carry extra fields). */
export interface GoogleListedModel {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  thinking?: boolean;
  inputTokenLimit?: number;
  [key: string]: unknown;
}

/**
 * Name/id tokens that mark a model as not text-to-text: image generation
 * (`image`, `imagen`, "Nano Banana"), video (`veo`), music/audio generation
 * (`lyria`, `music`, native `audio`), speech (`tts`), embeddings
 * (`embedding`/`embed`), AQA, and Live API realtime models (`live`). Matched
 * as whole tokens so e.g. `gemini-2.5-flash` or `gemma` are never caught.
 */
const GOOGLE_NON_TEXT_NAME_PATTERN =
  /(?:^|[^a-z0-9])(?:image|imagen|veo|lyria|music|tts|audio|embedding|embed|aqa|live)(?:[^a-z0-9]|$)|nano[\s_-]?banana/i;

/** Optional output-modality hints the live API may attach to a model entry. */
const GOOGLE_OUTPUT_MODALITY_KEYS = [
  'outputModalities',
  'supportedOutputModalities',
  'responseModalities',
] as const;

/**
 * Returns true when the listed model carries explicit modality metadata
 * declaring a non-text output (image/audio/video). Returns false when the
 * metadata declares text-only output or when no usable metadata is present.
 */
function googleDeclaresNonTextOutput(model: GoogleListedModel): boolean {
  for (const key of GOOGLE_OUTPUT_MODALITY_KEYS) {
    const value = model[key];
    if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string')) {
      return value.some((modality) => modality.toLowerCase() !== 'text');
    }
  }
  return false;
}

/**
 * True when a `/v1beta/models` entry is a text-to-text chat model usable for
 * translation. Excludes models that cannot `generateContent` (embeddings,
 * `predict`-style image/video models) and models whose output is not plain
 * text (image generation such as "Nano Banana", TTS/audio, Live API).
 */
export function isTextToTextGoogleModel(model: GoogleListedModel): boolean {
  // Must support chat-style generation (drops embedContent/predict-only models).
  if (!model.supportedGenerationMethods?.includes('generateContent')) return false;

  // Prefer explicit modality metadata when the API provides it.
  if (googleDeclaresNonTextOutput(model)) return false;

  // Conservative name/id exclusions (image models still report generateContent).
  if (GOOGLE_NON_TEXT_NAME_PATTERN.test(model.name)) return false;
  if (model.displayName !== undefined && GOOGLE_NON_TEXT_NAME_PATTERN.test(model.displayName)) {
    return false;
  }

  return true;
}

export async function resolveGoogleModels({
  apiKey,
}: {
  apiKey: string;
  baseURL?: string;
}): Promise<ModelInfo[]> {
  const models: ModelInfo[] = [];
  let pageToken: string | undefined;

  try {
    while (true) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await ssrfFetch(url.toString(), {
        headers: { 'x-goog-api-key': apiKey },
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => 'No body');
        console.error(
          `[google] fetch failed (HTTP ${res.status}) key=${maskSecret(apiKey)} body=${toErrorMessage(errBody)}`,
        );
        throwIfAuthOrRateLimitStatus('google', res.status, errBody);
        return [];
      }

      const json = (await res.json()) as {
        models?: GoogleListedModel[];
        nextPageToken?: string;
      };

      for (const model of json.models ?? []) {
        if (!isTextToTextGoogleModel(model)) continue;

        // Strip "models/" prefix
        const id = model.name.startsWith('models/')
          ? model.name.slice('models/'.length)
          : model.name;

        // Belt-and-suspenders with isTextToTextGoogleModel: also drop anything
        // the feed knows emits non-text output (image generators).
        if (modelEmitsNonTextOnly(id)) continue;

        const thinking = model.thinking === true;
        const supportedReasoningEfforts = thinking ? googleEffortsForThinkingModel(id) : [];

        const liveContextLength = normalizePositiveInt(model.inputTokenLimit);
        models.push({
          id,
          name: model.displayName,
          supportedReasoningEfforts,
          ...billingFor(id),
          ...capabilitiesFor(id, supportedReasoningEfforts.length > 0 ? ['thinking'] : []),
          ...contextFor(id),
          ...(liveContextLength !== undefined ? { contextLength: liveContextLength } : {}),
          ...(thinking ? { defaultReasoningEffort: 'medium' as ReasoningEffort } : {}),
        });
      }

      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
  } catch (err) {
    if (err instanceof AuthError || err instanceof RateLimitError) throw err;
    console.error(
      `[google] fetch error key=${maskSecret(apiKey)}`,
      redactSecretsFromError(err, [apiKey]),
    );
    return [];
  }

  return models;
}

// ─── Anthropic Compatible ────────────────────────────────────────────────────────

export async function resolveAnthropicCompatibleModels({
  apiKey: _apiKey,
  baseURL: _baseURL,
}: {
  apiKey: string;
  baseURL?: string;
}): Promise<ModelInfo[]> {
  // For Anthropic-compatible endpoints, return hardcoded list of supported Claude models.
  // This fixed list will drift from what an endpoint actually serves; there is no
  // dynamic endpoint detection / refreshing of the entries. These models reflect the
  // Anthropic API offerings at time of writing.
  return [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet (Latest)',
      supportedReasoningEfforts: ['low', 'medium', 'high', 'xhigh'] as ReasoningEffort[],
      defaultReasoningEffort: 'medium' as ReasoningEffort,
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude 3.5 Haiku (Fast)',
      supportedReasoningEfforts: [],
    },
    {
      id: 'claude-opus-4-1',
      name: 'Claude Opus 4.1',
      supportedReasoningEfforts: ['low', 'medium', 'high'] as ReasoningEffort[],
      defaultReasoningEffort: 'medium' as ReasoningEffort,
    },
  ];
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

/**
 * Name/id tokens that mark a DeepSeek `/models` entry as not text-to-text:
 * image, vision, or audio generation. Static fallback for the OpenRouter
 * modality feed this app no longer has.
 */
const DEEPSEEK_NON_TEXT_NAME_PATTERN = /\b(image|vision|audio)\b/i;

function deepSeekEffortsForModel(id: string): ReasoningEffort[] {
  // Only models with per-request configurable thinking (V3.2+/V4 family)
  // expose effort levels. deepseek-chat (non-thinking), deepseek-reasoner
  // (intrinsic thinking) and unknown ids advertise none.
  // No defaultReasoningEffort: the manifest default 'disabled' governs.
  if (DEEPSEEK_THINKING_CONFIGURABLE_PATTERN.test(id)) {
    return ['disabled', 'low', 'medium', 'high'] as ReasoningEffort[];
  }
  return [];
}

export async function resolveDeepSeekModels({
  apiKey,
  baseURL,
}: {
  apiKey: string;
  baseURL?: string;
}): Promise<ModelInfo[]> {
  // Eagerly validate a custom baseURL (scheme + no-userinfo + cloud private-range
  // block) so discovery matches the translate path's guard, not only the runtime
  // ssrfFetch backstop. No-op when baseURL is undefined (the public API path).
  validateBaseURL(baseURL, true);
  // Honor a custom baseURL (e.g. a DeepSeek-compatible proxy); normalize a
  // trailing slash and append the `/models` path. Falls back to the public API.
  const modelsUrl = baseURL
    ? `${baseURL.replace(/\/$/, '')}/models`
    : 'https://api.deepseek.com/models';
  try {
    const res = await ssrfFetch(modelsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => 'No body');
      console.error(
        `[deepseek] fetch failed (HTTP ${res.status}) key=${maskSecret(apiKey)} body=${toErrorMessage(errBody)}`,
      );
      throwIfAuthOrRateLimitStatus('deepseek', res.status, errBody);
      return [];
    }

    const json = (await res.json()) as { data: Array<{ id: string }> };

    // Combines the (now always-false, no-op post-OpenRouter-removal) feed
    // check with a static name-pattern fallback.
    return json.data
      .filter((m) => !modelEmitsNonTextOnly(m.id) && !DEEPSEEK_NON_TEXT_NAME_PATTERN.test(m.id))
      .map((m) => {
        const efforts = deepSeekEffortsForModel(m.id);
        return {
          id: m.id,
          supportedReasoningEfforts: efforts,
          ...billingFor(m.id),
          ...capabilitiesFor(m.id, efforts.length > 0 ? ['thinking'] : []),
          ...contextFor(m.id),
        };
      });
  } catch (err) {
    if (err instanceof AuthError || err instanceof RateLimitError) throw err;
    console.error(
      `[deepseek] fetch error key=${maskSecret(apiKey)}`,
      redactSecretsFromError(err, [apiKey]),
    );
    return [];
  }
}

// ─── Generic (OpenRouter / Ollama / vLLM) ─────────────────────────────────────

/**
 * Coerce a provider-reported numeric metric (context window in tokens, on-disk
 * size in bytes, …) to a positive integer, or `undefined` when it's missing or
 * not a usable number.
 */
function normalizePositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.floor(value);
}

/**
 * Resolve the context window to display for an Ollama model from an `/api/show`
 * response. Two values are available and they differ:
 *
 * - the configured `num_ctx` in the `parameters` blob — the window the model is
 *   actually loaded/run with (matches `ollama ps` CONTEXT), and
 * - the architecture's native max in `model_info."<arch>.context_length"`.
 *
 * We prefer the configured `num_ctx` (what the user set in the Modelfile) and
 * fall back to the architecture max only when no `num_ctx` is configured.
 */
function ollamaContextLength(
  parameters: string | undefined,
  modelInfo: Record<string, unknown> | undefined,
): number | undefined {
  // `parameters` is a Modelfile-style blob, one `name   value` per line.
  const numCtx = parameters?.match(/^\s*num_ctx\s+(\d+)/m);
  if (numCtx) {
    const configured = normalizePositiveInt(Number(numCtx[1]));
    if (configured !== undefined) return configured;
  }
  if (!modelInfo) return undefined;
  // The architecture-scoped key (e.g. `llama.context_length`,
  // `qwen3.context_length`) resolved via `general.architecture`, falling back
  // to any `*.context_length` entry.
  const arch = modelInfo['general.architecture'];
  if (typeof arch === 'string') {
    const scoped = normalizePositiveInt(modelInfo[`${arch}.context_length`]);
    if (scoped !== undefined) return scoped;
  }
  for (const [key, value] of Object.entries(modelInfo)) {
    if (key.endsWith('.context_length')) {
      const ctx = normalizePositiveInt(value);
      if (ctx !== undefined) return ctx;
    }
  }
  return undefined;
}

/** Runtime memory footprint of a single Ollama model loaded at a given context. */
export interface OllamaFootprint {
  modelId: string;
  /** Total memory the loaded model occupies (RAM + VRAM), in bytes. */
  sizeBytes?: number;
  /** Portion resident in VRAM, in bytes. Equals `sizeBytes` on a full-GPU load. */
  sizeVramBytes?: number;
  /** Context length the model was actually loaded with. */
  contextLength?: number;
  /** Set when the probe failed (e.g. the model could not be loaded at that context). */
  error?: string;
}

/** Whether a baseURL points at an Ollama endpoint (same heuristic as discovery). */
export function isOllamaBaseURL(baseURL: string): boolean {
  return baseURL.includes(':11434') || baseURL.includes('ollama');
}

/**
 * Resolve the local-LLM endpoint type for a generic-ai instance. An explicit
 * config value (`ollama` | `lm-studio` | `unknown`) is authoritative; an
 * absent/invalid value falls back to the legacy {@link isOllamaBaseURL}
 * heuristic, so instances configured before the `endpointType` field existed
 * keep their Ollama behavior. This fallback is the ONLY remaining use of the
 * autodetect — it is no longer the primary mechanism (the manifest field +
 * the startup backfill migration are). Single source of truth shared by model
 * discovery, the footprint route, and the M9 split-by-model classifier.
 */
export function resolveEndpointType(input: {
  endpointType?: unknown;
  baseURL?: string;
}): EndpointType {
  const v = input.endpointType;
  if (v === 'ollama' || v === 'lm-studio' || v === 'unknown') return v;
  return input.baseURL && isOllamaBaseURL(input.baseURL) ? 'ollama' : 'unknown';
}

/**
 * Free a loaded Ollama model from memory (RAM + VRAM) by POSTing `keep_alive: 0`
 * to `/api/generate` — the call Ollama uses to evict a model immediately. The
 * `/v1` OpenAI-compat suffix is stripped so the native Ollama route is hit
 * regardless of how the baseURL was configured.
 *
 * Best-effort: any failure (endpoint down, model not loaded, network error) is
 * swallowed, so callers can fire it before a model swap without a failed unload
 * aborting the run. Shared by {@link inspectOllamaFootprint} and the engine's
 * split-by-model run path.
 */
export async function unloadOllamaModel({
  baseURL,
  modelId,
}: {
  baseURL: string;
  modelId: string;
}): Promise<void> {
  const base = baseURL.replace(/\/v1\/?$/, '');
  await ssrfFetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId, keep_alive: 0 }),
  }).catch(() => {});
}

/**
 * Free a loaded LM Studio model from memory via its native v1 REST API
 * (`POST {root}/api/v1/models/unload`). The OpenAI-compat `/v1` suffix is
 * stripped so the native route is hit regardless of how the baseURL was
 * configured. Best-effort: any failure is swallowed, matching
 * {@link unloadOllamaModel}'s contract. (LM Studio exposes no VRAM-bytes/`ps`
 * equivalent over REST, so footprint probing stays Ollama-only — but unload
 * IS available, giving LM Studio split-by-model parity.)
 */
export async function unloadLMStudioModel({
  baseURL,
  modelId,
}: {
  baseURL: string;
  modelId: string;
}): Promise<void> {
  const base = baseURL.replace(/\/v1\/?$/, '');
  await ssrfFetch(`${base}/api/v1/models/unload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelId }),
  }).catch(() => {});
}

/**
 * Provider-agnostic "free this local model from VRAM" used by the M9
 * split-by-model run path. Dispatches by endpoint type: `ollama` →
 * {@link unloadOllamaModel}; `lm-studio` → {@link unloadLMStudioModel};
 * `unknown` (a generic OpenAI-compatible endpoint with no unload concept) is a
 * no-op. Best-effort throughout.
 */
export async function unloadLocalModel({
  endpointType,
  baseURL,
  modelId,
}: {
  endpointType: EndpointType;
  baseURL: string;
  modelId: string;
}): Promise<void> {
  if (endpointType === 'ollama') return unloadOllamaModel({ baseURL, modelId });
  if (endpointType === 'lm-studio') return unloadLMStudioModel({ baseURL, modelId });
}

/**
 * Measure an Ollama model's runtime memory footprint by loading it, reading
 * `/api/ps`, then unloading it. The model is loaded at `numCtx` (its configured
 * context) so the figure matches a real run; `keep_alive:0` unloads it
 * afterwards so only one model is ever resident — callers probe a list
 * sequentially without exceeding VRAM.
 *
 * Best-effort: a load failure (e.g. OOM at a large context) resolves to a
 * footprint carrying `error` rather than throwing, and the unload always runs.
 */
export async function inspectOllamaFootprint({
  baseURL,
  modelId,
  numCtx,
}: {
  baseURL: string;
  modelId: string;
  numCtx?: number;
}): Promise<OllamaFootprint> {
  const base = baseURL.replace(/\/v1\/?$/, '');
  const genUrl = `${base}/api/generate`;
  const loadBody = JSON.stringify({
    model: modelId,
    keep_alive: '30s',
    ...(numCtx && numCtx > 0 ? { options: { num_ctx: numCtx } } : {}),
  });

  try {
    // Empty-prompt generate just loads the model (no generation).
    const loadRes = await ssrfFetch(genUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: loadBody,
    });
    if (!loadRes.ok) {
      const detail = await loadRes.text().catch(() => '');
      const parsed = (() => {
        try {
          return (JSON.parse(detail) as { error?: string }).error;
        } catch {
          return detail;
        }
      })();
      return { modelId, error: parsed || `Ollama load failed (HTTP ${loadRes.status})` };
    }

    const psRes = await ssrfFetch(`${base}/api/ps`);
    if (!psRes.ok) {
      return { modelId, error: `Ollama /api/ps failed (HTTP ${psRes.status})` };
    }
    const ps = (await psRes.json()) as {
      models?: Array<{
        name?: string;
        model?: string;
        size?: number;
        size_vram?: number;
        context_length?: number;
      }>;
    };
    const loaded = ps.models?.find((m) => m.name === modelId || m.model === modelId);
    if (!loaded) {
      return { modelId, error: 'model not reported as loaded by /api/ps' };
    }
    return {
      modelId,
      ...(normalizePositiveInt(loaded.size) !== undefined
        ? { sizeBytes: normalizePositiveInt(loaded.size) }
        : {}),
      ...(normalizePositiveInt(loaded.size_vram) !== undefined
        ? { sizeVramBytes: normalizePositiveInt(loaded.size_vram) }
        : {}),
      ...(normalizePositiveInt(loaded.context_length) !== undefined
        ? { contextLength: normalizePositiveInt(loaded.context_length) }
        : {}),
    };
  } catch (err) {
    return {
      modelId,
      error: err instanceof Error ? err.message : 'failed to inspect footprint',
    };
  } finally {
    // Always free VRAM before the next probe, even on error.
    await unloadOllamaModel({ baseURL, modelId });
  }
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

/**
 * Live OpenRouter catalog (api/v1/models): per-model pricing, context length,
 * and reasoning support. Shared by the first-class `openrouter` module and by
 * generic-ai instances pointed at openrouter.ai.
 *
 * Only text-generating models are returned: a model whose
 * `architecture.output_modalities` exists but lacks `"text"` (image/audio
 * generators) cannot translate and is dropped. Models with missing or empty
 * modality data are KEPT (fail-open — a feed-shape change must not blank the
 * whole picker).
 */
export async function resolveOpenRouterModels({
  apiKey,
}: {
  apiKey: string;
}): Promise<ModelInfo[]> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await ssrfFetch('https://openrouter.ai/api/v1/models', { headers });
    if (!res.ok) {
      console.warn(`[openrouter] fetch failed (HTTP ${res.status}) key=${maskSecret(apiKey)}`);
      throwIfAuthOrRateLimitStatus('openrouter', res.status, '');
      return [];
    }

    const json = (await res.json()) as {
      data: Array<{
        id: string;
        name?: string;
        supported_parameters?: string[];
        pricing?: { prompt?: string; completion?: string };
        context_length?: number;
        architecture?: { output_modalities?: string[] };
      }>;
    };

    const models: ModelInfo[] = [];
    for (const m of json.data) {
      const out = m.architecture?.output_modalities;
      if (Array.isArray(out) && out.length > 0 && !out.includes('text')) continue;

      const hasReasoning =
        m.supported_parameters?.includes('reasoning_effort') === true ||
        m.supported_parameters?.includes('reasoning') === true;
      const efforts: ReasoningEffort[] = hasReasoning ? ['low', 'medium', 'high'] : [];
      const billing = billingFromOpenRouterPricing(m.pricing);
      const contextLength = normalizePositiveInt(m.context_length);
      models.push({
        id: m.id,
        name: m.name,
        supportedReasoningEfforts: efforts,
        ...(billing ? { billing } : {}),
        ...(hasReasoning ? { defaultReasoningEffort: 'medium' as ReasoningEffort } : {}),
        ...(contextLength !== undefined ? { contextLength } : {}),
      });
    }
    return models;
  } catch (err) {
    if (err instanceof AuthError || err instanceof RateLimitError) throw err;
    console.error(
      `[openrouter] fetch error key=${maskSecret(apiKey)}`,
      redactSecretsFromError(err, [apiKey]),
    );
    return [];
  }
}

export async function resolveGenericModels({
  apiKey,
  baseURL,
  endpointType,
}: {
  apiKey: string;
  baseURL?: string;
  /** Explicit endpoint kind; absent → the baseURL heuristic (back-compat). */
  endpointType?: unknown;
}): Promise<ModelInfo[]> {
  if (!baseURL) return [];

  try {
    // 1. OpenRouter — domain-detected regardless of endpointType (a paid cloud
    // aggregator, not one of the three local kinds; keeps pricing enrichment).
    // Delegates to the shared resolver, which also applies the
    // text-generation-only modality filter.
    if (baseURL.includes('openrouter.ai')) {
      return await resolveOpenRouterModels({ apiKey });
    }

    // The explicit endpoint kind (falling back to the baseURL heuristic for
    // legacy/unset configs) selects the local-discovery strategy below.
    const kind = resolveEndpointType({ endpointType, baseURL });

    // 2. Ollama — /api/tags + per-model /api/show (thinking, num_ctx, size).
    if (kind === 'ollama') {
      const tagsUrl = baseURL.replace(/\/v1\/?$/, '') + '/api/tags';
      try {
        const tagsRes = await ssrfFetch(tagsUrl);
        if (!tagsRes.ok) {
          console.warn(
            `[generic/ollama] fetch failed (HTTP ${tagsRes.status}) url=${redactUrlUserinfo(tagsUrl)} key=${maskSecret(apiKey)}`,
          );
          throw new Error(
            `Ollama server returned HTTP ${tagsRes.status}. Is Ollama running at ${baseURL}?`,
          );
        }

        const tagsJson = (await tagsRes.json()) as {
          models: Array<{
            name: string;
            size?: number;
            details?: { parameter_size?: string; quantization_level?: string };
          }>;
        };

        const results: ModelInfo[] = [];
        for (const m of tagsJson.models) {
          let supportedReasoningEfforts: ReasoningEffort[] = [];
          let capabilities: string[] | undefined;
          let contextLength: number | undefined;

          try {
            const showUrl = baseURL.replace(/\/v1\/?$/, '') + '/api/show';
            const showRes = await ssrfFetch(showUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: m.name }),
            });
            if (showRes.ok) {
              const showJson = (await showRes.json()) as {
                capabilities?: string[];
                parameters?: string;
                model_info?: Record<string, unknown>;
              };
              capabilities = showJson.capabilities;
              contextLength = ollamaContextLength(showJson.parameters, showJson.model_info);
              if (showJson.capabilities?.includes('thinking')) {
                // Ollama exposes thinking as a binary capability; `disabled`
                // (sent as reasoning_effort:"none") is the verified off-switch,
                // and `low`/`high` only grade effort on models that template it
                // (e.g. gpt-oss) — harmless "on" otherwise.
                supportedReasoningEfforts = ['disabled', 'low', 'high'] as ReasoningEffort[];
              }
            }
          } catch {
            // best-effort; continue with empty efforts
          }

          const sizeBytes = normalizePositiveInt(m.size);
          results.push({
            id: m.name,
            supportedReasoningEfforts,
            ...(capabilities ? { capabilityTags: capabilities } : {}),
            ...(contextLength !== undefined ? { contextLength } : {}),
            ...(sizeBytes !== undefined ? { sizeBytes } : {}),
            ...(m.details?.parameter_size ? { parameterSize: m.details.parameter_size } : {}),
            ...(m.details?.quantization_level
              ? { quantizationLevel: m.details.quantization_level }
              : {}),
          });
        }
        return results;
      } catch (err) {
        if (err instanceof TypeError) {
          // A native Headers.append TypeError embeds the raw apiKey verbatim
          // in its own .message — attaching the caught `err` itself as
          // `cause` (the usual preserve-caught-error-compliant shape) would
          // propagate that unmasked value to anyone who later logs this
          // error's cause chain. Deliberately substitute a redacted stand-in
          // instead; reassigning `err` isn't an option either (no-ex-assign).
          const safeErr = redactSecretsFromError(err, [apiKey]) as Error;
          throw new Error(
            `Could not connect to Ollama at ${baseURL}: ${safeErr.message}. Is Ollama running?`,
            // eslint-disable-next-line preserve-caught-error -- cause is intentionally the redacted stand-in, not the raw caught error (which could carry an unmasked apiKey)
            { cause: safeErr },
          );
        }
        throw err;
      }
    }

    // 2b. LM Studio — its native REST API lists models with rich metadata
    // (context length, quantization, arch). Prefer the v1 API and fall back to
    // the older v0 path. No on-disk size / VRAM bytes are reported by either,
    // so `sizeBytes` is intentionally omitted (footprint probing stays
    // Ollama-only); thinking capability isn't exposed, so efforts stay empty.
    if (kind === 'lm-studio') {
      const root = baseURL.replace(/\/v1\/?$/, '').replace(/\/$/, '');
      const headers: Record<string, string> = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const fetchModels = async (apiVersion: 'v1' | 'v0'): Promise<Response> =>
        ssrfFetch(`${root}/api/${apiVersion}/models`, { headers });

      try {
        let res = await fetchModels('v1');
        if (res.status === 404) res = await fetchModels('v0');
        if (!res.ok) {
          console.warn(
            `[generic/lm-studio] fetch failed (HTTP ${res.status}) url=${redactUrlUserinfo(root)}/api key=${maskSecret(apiKey)}`,
          );
          throwIfAuthOrRateLimitStatus('generic/lm-studio', res.status, '');
          throw new Error(
            `LM Studio server returned HTTP ${res.status}. Is the local server running at ${baseURL}?`,
          );
        }

        const json = (await res.json()) as {
          data?: Array<Record<string, unknown>>;
        } & { models?: Array<Record<string, unknown>> };
        // LM Studio returns { data: [...] }; tolerate a bare array or { models }.
        const list: Array<Record<string, unknown>> = Array.isArray(json)
          ? (json as Array<Record<string, unknown>>)
          : (json.data ?? json.models ?? []);

        const results: ModelInfo[] = [];
        for (const m of list) {
          const id =
            typeof m.id === 'string' ? m.id : typeof m.key === 'string' ? m.key : undefined;
          if (!id) continue;
          // Drop embedding models — they can't translate.
          if (m.type === 'embeddings' || m.type === 'embedding') continue;
          const contextLength = normalizePositiveInt(
            m.max_context_length ?? m.loaded_context_length,
          );
          const arch = typeof m.arch === 'string' ? m.arch : undefined;
          const quant = typeof m.quantization === 'string' ? m.quantization : undefined;
          results.push({
            id,
            supportedReasoningEfforts: [],
            ...(contextLength !== undefined ? { contextLength } : {}),
            ...(quant ? { quantizationLevel: quant } : {}),
            ...(arch ? { capabilityTags: [arch] } : {}),
          });
        }
        return results;
      } catch (err) {
        if (err instanceof AuthError || err instanceof RateLimitError) throw err;
        if (err instanceof Error && err.message.startsWith('LM Studio server returned')) throw err;
        if (err instanceof TypeError) {
          // See the matching Ollama-branch comment above: cause is
          // deliberately the redacted stand-in, not the raw caught error.
          const safeErr = redactSecretsFromError(err, [apiKey]) as Error;
          throw new Error(
            `Could not connect to LM Studio at ${baseURL}: ${safeErr.message}. Is the local server running?`,
            // eslint-disable-next-line preserve-caught-error -- see the Ollama-branch comment above
            { cause: safeErr },
          );
        }
        throw err;
      }
    }

    // 3. Generic vLLM / OpenAI-compatible fallback
    let modelsUrl = baseURL.replace(/\/$/, '');
    if (!modelsUrl.endsWith('/v1')) {
      modelsUrl += '/v1';
    }
    modelsUrl += '/models';

    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    try {
      const res = await ssrfFetch(modelsUrl, { headers });
      if (!res.ok) {
        console.warn(
          `[generic/vllm] fetch failed (HTTP ${res.status}) url=${redactUrlUserinfo(modelsUrl)} key=${maskSecret(apiKey)}`,
        );
        throw new Error(
          `Failed to fetch models from ${modelsUrl} (HTTP ${res.status}). ` +
            `Verify the baseURL is correct and the server is running.`,
        );
      }

      const json = (await res.json()) as {
        data: Array<{ id: string; max_model_len?: number }>;
      };

      return (json.data ?? []).map((m) => {
        const contextLength = normalizePositiveInt(m.max_model_len);
        return {
          id: m.id,
          supportedReasoningEfforts: [],
          ...(contextLength !== undefined ? { contextLength } : {}),
        };
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('Failed to fetch models from')) {
        throw err; // Re-throw user-facing errors
      }
      // See the Ollama-branch comment above: cause is deliberately the
      // redacted stand-in (also reused for the console.warn below), not the
      // raw caught error, which could carry an unmasked apiKey.
      const safeErr = redactSecretsFromError(err, [apiKey]);
      console.warn(
        `[generic] fetch error url=${redactUrlUserinfo(modelsUrl)} key=${maskSecret(apiKey)}`,
        safeErr,
      );
      throw new Error(
        `Could not connect to ${modelsUrl}: ${safeErr instanceof Error ? safeErr.message : 'Unknown error'}`,
        // eslint-disable-next-line preserve-caught-error -- see the Ollama-branch comment above
        { cause: safeErr },
      );
    }
  } catch (err) {
    console.warn(`[generic] error: ${String(err)}`);
    throw err;
  }
}
