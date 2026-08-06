/**
 * Number of dots used for a fully-masked placeholder — i.e. when there is
 * nothing safe to reveal (empty, null/undefined, or a value at or below the
 * `visible` length). Matches the four-character `****`-style redaction the
 * server previously used, but with the shared bullet glyph.
 */
const FULL_MASK = '•'.repeat(4);

/**
 * Mask the leading characters of a secret string, leaving the last `visible`
 * characters intact. Useful for surfacing credential identifiers in logs and
 * UI without exposing the full value.
 *
 * Safety: never returns input that could leak a (partial) secret. Short or
 * empty values — including `null`/`undefined` — collapse to a fully-masked
 * placeholder rather than being echoed back. This makes the function a safe
 * drop-in for log redaction of arbitrary, possibly-tiny credential values.
 *
 * The masked portion is capped at 32 dots so very long inputs don't bloat
 * log lines.
 */
export function maskSecret(secret: string | null | undefined, visible = 4): string {
  const s = String(secret ?? '');
  // Nothing safe to reveal: empty, or so short that revealing the last `visible`
  // chars would expose half (or more) of the value. Require the hidden portion
  // to be larger than the revealed one (length > visible * 2) before showing a
  // suffix — otherwise collapse to a full placeholder so short secrets (e.g. a
  // 5-8 char token) are never partially leaked.
  if (s.length <= visible * 2) return FULL_MASK;
  const hiddenLen = s.length - visible;
  const dotCount = Math.min(hiddenLen, 32);
  return '•'.repeat(dotCount) + s.slice(-visible);
}

/**
 * HTTP whitespace bytes per the Fetch spec (TAB, LF, CR, SPACE). Node's
 * native `Headers` implementation (undici) strips exactly these from the
 * *leading and trailing* ends of a header value before validating it — so a
 * value rejected as malformed embeds that TRIMMED form, not the raw one,
 * verbatim in the `Headers.append: "<value>" is an invalid header value.`
 * TypeError message. Empirically verified against Node 24's native `Headers`:
 * leading/trailing space, tab, CR, and LF are all stripped; other whitespace
 * (NBSP, vertical tab, form feed) is left intact. See
 * {@link redactSecretsFromError}.
 */
const HTTP_WHITESPACE_EDGES = /^[\t\n\r ]+|[\t\n\r ]+$/g;

/** Strip leading/trailing HTTP whitespace bytes (see {@link HTTP_WHITESPACE_EDGES}). */
function trimHttpWhitespace(s: string): string {
  return s.replace(HTTP_WHITESPACE_EDGES, '');
}

/**
 * Returns a safe-to-log version of a caught error, with every occurrence of
 * each given secret value replaced by its {@link maskSecret} placeholder.
 *
 * Why this exists: a native runtime error (e.g. `Headers.append` rejecting an
 * invalid header value) embeds the OFFENDING VALUE VERBATIM in its own
 * `.message` (and therefore `.stack`, whose first line is the message) — so
 * logging the error object directly, or interpolating `err.message` into a
 * new error/log line, can leak a raw credential even when the surrounding
 * log line's own text was already redacted with {@link maskSecret}. This
 * walks `.message`, `.stack`, and one level of `.cause` (if it is itself an
 * Error), string-replacing every occurrence of every non-empty secret.
 *
 * A secret with leading/trailing HTTP whitespace (e.g. a copy-paste artifact
 * like a stray space, or a value smuggling a `\n`/`\r` that trips the native
 * `Headers` rejection this function targets) no longer appears as an exact
 * substring once that value round-trips through `Headers.append` — undici
 * trims the edges before embedding it in the error message (see
 * {@link trimHttpWhitespace}). Matching only the raw secret would let the
 * whole message pass through unredacted in that case, so each secret is also
 * matched in its HTTP-whitespace-trimmed form.
 *
 * Non-Error inputs (a thrown string, or anything else) are redacted the same
 * way if they're a string, and passed through unchanged otherwise — there is
 * nothing else that could carry a leaked value.
 */
export function redactSecretsFromError(
  err: unknown,
  secrets: Array<string | null | undefined>,
): unknown {
  const knownSecrets = secrets.filter((s): s is string => typeof s === 'string' && s.length > 0);
  if (knownSecrets.length === 0) return err;

  const redact = (text: string): string => {
    let out = text;
    for (const secret of knownSecrets) {
      const placeholder = maskSecret(secret);
      out = out.split(secret).join(placeholder);
      // Also catch the form undici embeds when the raw secret carried edge
      // whitespace that Headers.append trims before throwing (see
      // trimHttpWhitespace's doc comment above).
      const trimmed = trimHttpWhitespace(secret);
      if (trimmed && trimmed !== secret) {
        out = out.split(trimmed).join(placeholder);
      }
    }
    return out;
  };

  if (err instanceof Error) {
    const safe = new Error(redact(err.message));
    safe.name = err.name;
    if (err.stack) safe.stack = redact(err.stack);
    if (err.cause !== undefined) {
      safe.cause =
        err.cause instanceof Error ? redactSecretsFromError(err.cause, knownSecrets) : err.cause;
    }
    return safe;
  }
  if (typeof err === 'string') return redact(err);
  return err;
}
