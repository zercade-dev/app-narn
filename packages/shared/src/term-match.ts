/**
 * Canonical glossary-term word-boundary matcher.
 *
 * Used wherever a glossary term's source wording must be detected in text as a
 * whole word/phrase: server-side glossary assignment (M20), prompt glossary
 * filtering (the AI SDK provider), and the frontend reviewer/glossary-tab term
 * highlighting. These consumers must stay in lockstep so the UI surfaces exactly
 * the terms the engine would apply, hence the single shared definition here.
 *
 * Boundary semantics: a match must not be immediately preceded or followed by a
 * Unicode letter or digit (`\p{L}` / `\p{N}`). Matching is case-insensitive and
 * Unicode-aware (flags `iu`).
 *
 * CJK/Thai exception: those scripts are written without inter-word spacing, so
 * a genuine standalone occurrence is still immediately adjacent to more `\p{L}`
 * characters — the boundary assertions above would never match, silently
 * dropping glossary enforcement (assignment, prompt filtering, highlighting).
 * The exception therefore turns on the script at the match POSITION, not on the
 * term alone: a term written in an unsegmented script drops the assertions
 * altogether and matches its literal wording wherever it occurs, while every
 * other term keeps them but accepts an unsegmented-script neighbour as a
 * boundary. That second half matters in both directions — a Latin term like
 * "HP" is a standalone occurrence in an unsegmented SOURCE (`残りHPが少ない`,
 * for M20 and prompt filtering) and in an unsegmented TARGET (the M10
 * forbidden-term and glossary-adherence checks) — while "concatenate" still
 * hides no "cat".
 *
 * Note: M17's constant-glossary masker uses a deliberately different boundary
 * (it also treats `_` as a word character and uses a replacement form), so it is
 * NOT built from this helper.
 */

/** Escape a literal string for safe embedding in a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * Unicode ranges (BMP only — the rare supplementary-plane CJK extensions are
 * out of scope) for scripts conventionally written WITHOUT inter-word
 * spacing:
 *   - U+0E00–U+0E7F  Thai
 *   - U+3040–U+30FF  Hiragana + Katakana
 *   - U+3400–U+4DBF  CJK Unified Ideographs Extension A
 *   - U+4E00–U+9FFF  CJK Unified Ideographs
 *   - U+AC00–U+D7A3  Hangul Syllables
 *   - U+F900–U+FAFF  CJK Compatibility Ideographs
 */
const UNSEGMENTED_SCRIPT_RE = /[฀-๿぀-ヿ㐀-䶿一-鿿가-힣豈-﫿]/u;

/** True when `term` contains at least one character from an unsegmented script. */
function isUnsegmentedScript(term: string): boolean {
  return UNSEGMENTED_SCRIPT_RE.test(term);
}

/**
 * Boundary assertions for a term that is not itself unsegmented: the usual
 * "no adjacent letter or digit", relaxed to accept an unsegmented-script
 * neighbour, where adjacency carries no word-boundary meaning. Built from
 * {@link UNSEGMENTED_SCRIPT_RE}'s own class body so the two cannot drift.
 */
const UNSEGMENTED_CHAR_CLASS = UNSEGMENTED_SCRIPT_RE.source;
const LEFT_BOUNDARY = String.raw`(?:(?<![\p{L}\p{N}])|(?<=${UNSEGMENTED_CHAR_CLASS}))`;
const RIGHT_BOUNDARY = String.raw`(?:(?![\p{L}\p{N}])|(?=${UNSEGMENTED_CHAR_CLASS}))`;

/**
 * Build a case-insensitive, Unicode-aware whole-word matcher for `term`. A term
 * written in an unsegmented script (CJK/Thai; see above) matches its literal
 * wording wherever it occurs; every other term must not sit against a Unicode
 * letter or digit on either side, unless that neighbour is itself from an
 * unsegmented script.
 *
 * A bounded per-term RegExp cache could avoid recompiling in hot glossary-filter
 * loops, but profiling hasn't shown it matters for typical glossary sizes — left
 * as-is to avoid speculative complexity.
 */
export function buildTermBoundaryRegex(term: string): RegExp {
  const escaped = escapeRegExp(term);
  if (isUnsegmentedScript(term)) {
    return new RegExp(escaped, 'iu');
  }
  return new RegExp(`${LEFT_BOUNDARY}${escaped}${RIGHT_BOUNDARY}`, 'iu');
}

/** Whether `term`'s wording occurs (word-boundary) in `text`. Empty term → false. */
export function termMatchesText(term: string, text: string): boolean {
  if (!term) return false;
  return buildTermBoundaryRegex(term).test(text);
}
