// Patterns that may expose secrets or infrastructure details in error strings
const URL_PATTERN = /https?:\/\/[^\s"'><]+/g;
// GitHub tokens are base62, so the all-hex API_KEY_PATTERN below misses them.
const GITHUB_TOKEN_PATTERN = /\b(?:gh[opusr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})\b/g;
// Google API keys (AIzaSy…, 39 chars of alnum/-/_, not hex) and DeepL keys
// (a UUID suffixed with `:fx` for the free tier) are also missed by the
// hex/sk-/Bearer-only API_KEY_PATTERN, so match them explicitly.
const GOOGLE_KEY_PATTERN = /\bAIza[0-9A-Za-z_-]{20,}\b/g;
const DEEPL_KEY_PATTERN =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:fx\b/g;
const API_KEY_PATTERN =
  /\bsk-[A-Za-z0-9_-]{10,}|\bBearer\s+[A-Za-z0-9\-._~+/]{10,}|[0-9a-fA-F]{32,}/g;
// A PAID-tier DeepL key is a bare UUID with no `:fx` suffix, so it escapes
// both DEEPL_KEY_PATTERN (requires `:fx`) and API_KEY_PATTERN (requires 32+
// CONSECUTIVE hex chars; a UUID's longest hyphen-delimited group is only 12).
// A bare UUID is otherwise a completely generic, ubiquitous identifier shape
// (project/run/request ids, ...), so redacting every UUID-looking substring
// unconditionally would over-redact unrelated, legitimate diagnostics.
// Scope it: only redact a bare UUID when the SAME message also carries a
// DeepL/auth-context marker, so an incidental UUID elsewhere is left alone.
const DEEPL_AUTH_CONTEXT_PATTERN = /deepl|auth_key|authorization/i;
const BARE_UUID_PATTERN =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

function redactSensitive(value: string): string {
  const partial = value
    .replace(URL_PATTERN, '[URL redacted]')
    .replace(GITHUB_TOKEN_PATTERN, '[redacted]')
    .replace(GOOGLE_KEY_PATTERN, '[redacted]')
    .replace(DEEPL_KEY_PATTERN, '[redacted]')
    .replace(API_KEY_PATTERN, '[redacted]');
  return DEEPL_AUTH_CONTEXT_PATTERN.test(partial)
    ? partial.replace(BARE_UUID_PATTERN, '[redacted]')
    : partial;
}

/**
 * Coerce an unknown thrown value into a human-readable string. Preserves
 * `Error.message` when present, otherwise falls back to `String(err)`.
 * Redacts URLs and API-key-like patterns before returning.
 */
export function toErrorMessage(err: unknown): string {
  let raw: string;
  if (err instanceof Error) raw = err.message;
  else if (typeof err === 'string') raw = err;
  else if (err === undefined) raw = 'undefined';
  else if (err === null) raw = 'null';
  else {
    try {
      const json = JSON.stringify(err);
      raw = typeof json === 'string' ? json : String(err);
    } catch {
      raw = String(err);
    }
  }
  return redactSensitive(raw);
}
