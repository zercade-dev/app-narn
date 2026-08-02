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
