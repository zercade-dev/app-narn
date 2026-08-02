import type { Response } from 'express';
import { validateBaseURL, coerceBoolean } from '@zercade-dev/narn-shared';
import { findPasswordFormatKeys } from '../modules/M19-global-config-store.js';

/**
 * SSRF / credential-safety guard for a module config's `baseURL`.
 *
 * Wraps the shared {@link validateBaseURL} (which throws) in a return-value form
 * so route handlers can map a bad endpoint to a 400 without a try/catch. Returns
 * a client-facing message when `baseURL` is a link-local/metadata host (SSRF), a
 * non-http(s) scheme, an unparseable URL, or insecure remote HTTP without opt-in;
 * returns null when the config is absent, has no string `baseURL`, or is safe.
 *
 * Accepts `unknown` so callers can pass raw persisted/request config without a cast.
 * Honors the `allowInsecureHttp` opt-in, coercing it via {@link coerceBoolean} (the
 * host persists toggles as the string "true"/"false"). The link-local/metadata SSRF
 * override is intentionally NOT read from this config — it is operator-env-only (the
 * shared `ALLOW_INTERNAL_LLM_HOSTS` env var) — because `config` may be an untrusted
 * imported/restored/bulk-PUT blob that would otherwise disable the guard on its own
 * malicious baseURL.
 */
export function moduleConfigBaseURLError(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const c = config as Record<string, unknown>;
  const baseURL = typeof c.baseURL === 'string' ? c.baseURL : undefined;
  if (!baseURL) return null;
  try {
    // Only allowInsecureHttp is honored from config; the internal-host override is
    // operator-env-only (validateBaseURL reads ALLOW_INTERNAL_LLM_HOSTS itself), so
    // an untrusted config can't re-enable a link-local/metadata baseURL on its own.
    validateBaseURL(baseURL, coerceBoolean(c.allowInsecureHttp));
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid baseURL';
  }
}

/**
 * Route guard wrapping {@link moduleConfigBaseURLError}: when the config's
 * `baseURL` is unsafe, sends the shared `400 { error: 'invalid-base-url',
 * message }` response and returns false; otherwise returns true without
 * touching `res`. Callers branch with `if (!assertSafeBaseURL(res, config)) return;`,
 * collapsing the identical inline check repeated across the baseURL-bearing
 * routes. The status code and JSON shape are preserved exactly (the frontend and
 * route tests depend on them).
 */
export function assertSafeBaseURL(res: Response, config: unknown): boolean {
  const baseURLError = moduleConfigBaseURLError(config);
  if (baseURLError) {
    res.status(400).json({ error: 'invalid-base-url', message: baseURLError });
    return false;
  }
  return true;
}

/**
 * Route guard wrapping {@link findPasswordFormatKeys}: when `config` carries any
 * key whose manifest schema declares `format: 'password'`, sends the shared
 * `400 { error: 'password-field-forbidden', message, fields }` response and
 * returns false; otherwise returns true. `scope` names the config surface in the
 * message ('global config' or 'project config') so each caller's exact wording —
 * which the frontend and tests depend on — is preserved. Callers branch with
 * `if (!assertNoPasswordFields(res, config, schema, scope)) return;`.
 */
export function assertNoPasswordFields(
  res: Response,
  config: Record<string, unknown>,
  configSchema: Record<string, unknown> | undefined,
  scope: 'global config' | 'project config',
): boolean {
  return assertNoForbiddenConfigKeys(res, findPasswordFormatKeys(config, configSchema), scope);
}

/**
 * The same `400 { error: 'password-field-forbidden', … }` response as
 * {@link assertNoPasswordFields}, for callers that classify the forbidden keys
 * themselves — `utils/module-config-secrets.ts`'s `forbiddenModuleConfigKeys`
 * resolves the schema per module id and falls back to a name heuristic when the
 * module is unregistered, which this signature cannot express. Keeping the
 * response shape in ONE place is what stops the two guards from drifting apart.
 */
export function assertNoForbiddenConfigKeys(
  res: Response,
  forbidden: string[],
  scope: 'global config' | 'project config',
): boolean {
  if (forbidden.length > 0) {
    res.status(400).json({
      error: 'password-field-forbidden',
      message: `Password-format fields belong in the vault, not ${scope}: ${forbidden.join(', ')}`,
      fields: forbidden,
    });
    return false;
  }
  return true;
}
