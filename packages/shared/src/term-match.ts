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
 * a genuine standalone occurrence of a term is still immediately adjacent to
 * more `\p{L}` characters — the boundary assertions above would never match,
 * silently dropping glossary enforcement (assignment, prompt filtering,
 * highlighting) for any CJK/Thai-source project. {@link buildTermBoundaryRegex}
 * detects the term's script and skips the boundary assertions in that case,
 * matching the literal wording wherever it occurs instead.
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
 * Build a case-insensitive, Unicode-aware whole-word matcher for `term`. The
 * match must not be adjacent to a Unicode letter or digit on either side —
 * EXCEPT for a term written in an unsegmented script (CJK/Thai; see above),
 * where the boundary assertions are skipped and the term's literal wording is
 * matched wherever it occurs.
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
  return new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped}(?![\p{L}\p{N}])`, 'iu');
}

/** Whether `term`'s wording occurs (word-boundary) in `text`. Empty term → false. */
export function termMatchesText(term: string, text: string): boolean {
  if (!term) return false;
  return buildTermBoundaryRegex(term).test(text);
}
