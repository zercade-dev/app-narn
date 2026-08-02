import {
  createAISDKModule,
  createDefaultModuleLogger,
  coerceBoolean,
  coerceBooleanDefaultTrue,
  validateBaseURL,
  OPENAI_COST_PATTERNS,
  type TranslationModule,
  type ModuleFactoryConfig,
  type ModuleManifest,
} from '@zercade-dev/narn-shared';
import manifest from '../manifest.json' with { type: 'json' };

export interface GenericAIModuleConfig extends ModuleFactoryConfig {
  /** API wire format of the endpoint; routes to the matching AI SDK provider. */
  format?: 'openai' | 'anthropic';
  /** Allow plain-HTTP baseURL for remote (non-loopback) hosts. */
  allowInsecureHttp?: boolean;
  /**
   * @deprecated No longer honored from config (it enabled an SSRF self-bypass): a
   * value here is IGNORED. The link-local/metadata SSRF-guard override is now
   * operator-only via the `ALLOW_INTERNAL_LLM_HOSTS` environment variable. Kept on
   * the type so legacy persisted config still type-checks; it is stripped from the
   * forwarded config, not used.
   */
  allowInternalHosts?: boolean;
  /**
   * Whether this endpoint is a free, local LLM (Ollama/LM Studio). Defaults to
   * true (matching the manifest), so an endpoint reports cost tier `free` unless
   * `free` is explicitly `false`/"false". When free, the UI treats it as a local
   * model (pricing hidden, size/VRAM footprint shown instead). Set false for a
   * paid generic OpenAI-compatible endpoint.
   *
   * Typed `boolean | string` because the host persists the UI toggle as a
   * string (`"true"`/`"false"`); both shapes are handled below.
   */
  free?: boolean | string;
  /**
   * Max provider requests run at once for this endpoint. Defaults to 1 (serial)
   * — single local LLMs (Ollama/LM Studio) handle one request at a time. Raise
   * for a fast paid endpoint. Coerced from the (string) UI value and clamped to
   * an integer >= 1.
   */
  maxParallel?: number;
}

/**
 * Normalize and validate the `format` selector. `format` is typed as the
 * `'openai' | 'anthropic'` enum, but the real value arrives from persisted
 * per-project config as an unknown/string, and nothing validates it against the
 * manifest enum server-side. Accept `'openai'`/`'anthropic'` (case-insensitively)
 * and treat an omitted/empty value as the default `'openai'`; reject anything
 * else with a thrown error — mirroring how `validateBaseURL` rejects bad input
 * rather than silently falling through to the openai-compatible branch.
 */
function resolveFormat(format: unknown): 'openai' | 'anthropic' {
  if (format === undefined || format === null || format === '') return 'openai';

  if (typeof format !== 'string') {
    throw new Error(`format must be "openai" or "anthropic"; got ${typeof format}.`);
  }

  const normalized = format.trim().toLowerCase();
  if (normalized === 'openai' || normalized === 'anthropic') return normalized;

  throw new Error(`format must be "openai" or "anthropic"; got "${format}".`);
}

export function createGenericAIModule(config: GenericAIModuleConfig = {}): TranslationModule {
  // Destructure every module-specific key (including maxParallel) out of `rest`
  // so the raw, possibly-string UI values are removed rather than just shadowed
  // by the coerced keys below — `rest` then carries only plain AI SDK config.
  const {
    format: rawFormat,
    allowInsecureHttp,
    allowInternalHosts,
    free,
    maxParallel: rawMaxParallel,
    ...rest
  } = config;

  // Per-project config is persisted as a record of unknowns, so allowInsecureHttp
  // may arrive as the string "true"/"false". Coerce it the same way maxParallel
  // is coerced below, so a stringified UI value behaves like a real boolean.
  const insecureHttp = coerceBoolean(allowInsecureHttp);

  // SECURITY: allowInternalHosts is NO LONGER honored from config. Reading the
  // SSRF-guard override from this (possibly imported/restored) config would let an
  // untrusted blob disable the guard on its own malicious baseURL. validateBaseURL
  // now sources the override from the operator-only ALLOW_INTERNAL_LLM_HOSTS env
  // var. It is still destructured above so it is stripped from `rest` (not
  // forwarded to the AI SDK); warn if a stale/imported config still sets it.
  if (allowInternalHosts !== undefined) {
    const log = config.log ?? createDefaultModuleLogger();
    log(
      'warn',
      '[generic-ai] allowInternalHosts in config is ignored; set the ALLOW_INTERNAL_LLM_HOSTS env var (operator-only) to permit a link-local/metadata endpoint',
      {},
    );
  }

  // The manifest documents `free` as defaulting to `true`, so honor that default
  // here regardless of whether the caller applied manifest defaults: treat an
  // omitted value (and only an explicit `false`/"false") as paid. The
  // default-true helper makes that asymmetry with `coerceBoolean` explicit.
  const isFree = coerceBooleanDefaultTrue(free);

  validateBaseURL(rest.baseURL, insecureHttp);

  // Coerce the UI value (stored as a string) and default to 1 so a single local
  // endpoint runs requests serially unless the operator opts into more.
  const parsed = Number(rawMaxParallel);
  const validMaxParallel = Number.isFinite(parsed) && parsed >= 1;
  const maxParallel = validMaxParallel ? Math.floor(parsed) : 1;

  // Warn when the operator supplied a maxParallel value that silently clamps to
  // the default (e.g. "0", "8x", NaN) — surprising on a paid endpoint where they
  // expected parallelism. An omitted value is the documented default, not a typo.
  if (rawMaxParallel !== undefined && !validMaxParallel) {
    const log = config.log ?? createDefaultModuleLogger();
    log('warn', '[generic-ai] maxParallel coerced to default 1', { rawMaxParallel });
  }

  // Route to correct provider based on the validated format selection.
  const format = resolveFormat(rawFormat);
  const provider = format === 'anthropic' ? 'anthropic-compatible' : 'openai-compatible';

  // A free, local LLM costs nothing — report cost tier `free` so routing and the
  // cheapest-module heuristics treat it accordingly. `free` defaults to true (see
  // above), so a real local endpoint reports `free`; only an explicit paid flag
  // (free === false) keeps the manifest's default tier. NB: the manifest's static
  // costTier is surfaced only by the paid anthropic-compatible branch (it passes
  // no costPatterns, so createAISDKModule falls through to it) — the free path
  // forces `free` here and the paid openai-compatible path derives from the model
  // below, so don't assume editing the manifest costTier affects those two paths.
  const baseManifest = manifest as ModuleManifest;
  const effectiveManifest: ModuleManifest = isFree
    ? { ...baseManifest, costTier: 'free' }
    : baseManifest;

  // For a paid openai-compatible endpoint (e.g. OpenRouter), tier by the
  // configured model id the same way the first-party openai module does, so the
  // backend model namespace — when it matches the OpenAI naming — is classified
  // instead of always reporting the manifest's static `medium`. Best-effort: the
  // backend namespace is unknown, so fall back to `medium`. The free path already
  // forces `free` above and never reaches here; anthropic-compatible has no model
  // namespace to match, so it keeps the manifest tier.
  const costPatternsSpread =
    !isFree && provider === 'openai-compatible'
      ? { costPatterns: OPENAI_COST_PATTERNS, costFallback: 'medium' as const }
      : {};

  // `useStructuredOutput` is documented as openai-format-only ("ignored when
  // format is 'anthropic'"). Enforce that scope here rather than relying on the
  // downstream model-factory happening to ignore it for the anthropic path.
  const { useStructuredOutput: _useStructuredOutput, ...restWithoutStructured } = rest;
  const providerRest = provider === 'anthropic-compatible' ? restWithoutStructured : rest;

  return createAISDKModule({
    ...providerRest,
    maxParallel,
    provider,
    manifest: effectiveManifest,
    ...costPatternsSpread,
  });
}

// Re-export the manifest so the server's module-index can import it via the package
// specifier (`@zercade-dev/narn-module-generic-ai`). The relative `../manifest.json` resolves
// from both src/index.ts and the flat dist/index.js to modules/generic-ai/manifest.json.
export { manifest };

export default createGenericAIModule;
