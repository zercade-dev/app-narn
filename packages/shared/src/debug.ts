/**
 * Lightweight `DEBUG=`-gated logger. Emits to `console.error` (stderr) when the
 * current `DEBUG` environment variable is `*` or contains `scope` as one of
 * its comma-separated entries. Otherwise it is a silent no-op.
 *
 * Modeled after the de-facto `debug` package's activation contract but
 * dependency-free so it can be shared across server and module packages
 * without bundler friction.
 *
 * SECURITY: `args` are written straight to `console.error` and **bypass
 * `sanitizeLogObject` redaction** (the masking applied to the app's structured
 * logs). Callers MUST NOT pass credentials, API keys, auth headers, vault
 * material, or raw request/response objects — pass only non-sensitive
 * diagnostics. Anything handed to `debug()` may be printed verbatim to stderr.
 */
export function debug(scope: string, ...args: unknown[]): void {
  const env = typeof process !== 'undefined' && process.env ? process.env.DEBUG : undefined;
  if (!env) return;
  if (
    env !== '*' &&
    !env
      .split(',')
      .map((s) => s.trim())
      .includes(scope)
  )
    return;
  console.error(`[${scope}]`, ...args);
}
