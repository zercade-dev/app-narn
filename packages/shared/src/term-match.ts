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
 * M17's constant-glossary masker builds its (case-sensitive) pattern from
 * {@link termBoundaryPattern} too, so a constant term is masked exactly where
 * the prompt filter would otherwise send it to the model — `_` is not a word
 * character for either, and both accept an unsegmented-script neighbour.
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
  return new RegExp(termBoundaryPattern(term), 'iu');
}

/**
 * The RegExp source behind {@link buildTermBoundaryRegex}, without flags, so a
 * caller that needs different flags (M17's case-sensitive, global constant-term
 * masker) shares the exact same boundary definition. Contains no capture group.
 */
export function termBoundaryPattern(term: string): string {
  const escaped = escapeRegExp(term);
  if (isUnsegmentedScript(term)) return escaped;
  return `${LEFT_BOUNDARY}${escaped}${RIGHT_BOUNDARY}`;
}

/** Vowels (Latin, Cyrillic, Greek), as a character-class body. */
const VOWELS = 'aeiouyàáâãäåèéêëìíîïòóôõöùúûüаеёиоуыэюяіїєαεηιουω';

/**
 * The part of a word's end a declension may replace: a vowel + `й` or a lone
 * `й`/`ь` ("Большой", "Рыцарь"), else one or two vowels ("Сила", "Снежная").
 */
const REPLACEABLE_ENDING = new RegExp(`(?:[${VOWELS}]?[йь]|[${VOWELS}]{1,2})$`, 'iu');

/** Longest ending a whole (unshortened) word of `length` letters may take. */
function maxEndingFor(length: number): number {
  if (length <= 3) return 2;
  if (length <= 5) return 3;
  return 5;
}

/** One word of an inflected-term pattern; see {@link buildInflectedTermRegex}. */
function inflectedWordPattern(word: string): string {
  const letters = [...word];
  if (letters.length < 3) return escapeRegExp(word);
  const whole = `${escapeRegExp(word)}\\p{L}{0,${maxEndingFor(letters.length)}}`;
  if (letters.length < 4) return whole;
  const replaceable = REPLACEABLE_ENDING.exec(word)?.[0];
  if (!replaceable) return whole;
  // Keep at least three stem letters.
  const cut = Math.min([...replaceable].length, letters.length - 3);
  const stem = letters.slice(0, letters.length - cut).join('');
  const shortEnding = String.raw`(?:\p{L}{0,2}|\p{L}{2}[${VOWELS}])`;
  return `(?:${whole}|${escapeRegExp(stem)}${shortEnding})`;
}

/**
 * Like {@link buildTermBoundaryRegex}, but each word of `term` may also carry
 * an inflectional ending. For checking that a target text uses a required
 * translation, where the grammar may have declined it. Per word:
 *
 * - under three letters ("HP"): exact.
 * - three letters ("Маг"): plus an ending of at most two letters — "мага",
 *   "магов", but not "Магазин"; "Geo" does not match "Geology".
 * - four letters or more: the whole word plus an ending of up to three letters
 *   (up to five for a word of six letters or more: Turkish "Oyuncu" →
 *   "oyuncuların"), OR the word with its final vowel(s) — or `й`/`ь`, with the
 *   vowel before a `й` — dropped, keeping at least three stem letters, plus an
 *   ending of at most two letters, or three letters ending in a vowel:
 *   "Сила" → "силу", "Снежная" → "Снежной", "Большой" → "Большого",
 *   "Рыцарь" → "Рыцаря"/"рыцарями". The short, vowel-final cap is what keeps
 *   "Hydro" off "Hydrant" (Hydr + "ant").
 *
 * Terms in an unsegmented script (CJK/Thai, which do not inflect this way)
 * match exactly. "Дилюк" accepts "Дилюка", "Маг Бездны" accepts "мага Бездны".
 */
export function buildInflectedTermRegex(term: string): RegExp {
  if (isUnsegmentedScript(term)) return buildTermBoundaryRegex(term);
  const words = term.trim().split(/\s+/u).map(inflectedWordPattern);
  return new RegExp(`${LEFT_BOUNDARY}${words.join(String.raw`\s+`)}${RIGHT_BOUNDARY}`, 'iu');
}

/**
 * A `{…}` placeholder: its contents are an opaque variable name (`{player}`,
 * `{1:lv.ReadySystem.Player Ready}`), not translatable wording.
 */
const PLACEHOLDER_RE = /\{[^{}]*\}/g;

/**
 * `text` with every `{…}` placeholder replaced by a space (keeping the word
 * boundaries around it), so a glossary term that appears only inside a
 * variable name ("Player" in `{player} (you)`) is not a match.
 */
export function glossaryScanText(text: string): string {
  return text.replace(PLACEHOLDER_RE, ' ');
}

/**
 * Whether `term`'s wording occurs (word-boundary) in `text`, outside any `{…}`
 * placeholder (see {@link glossaryScanText}). Empty term → false.
 */
export function termMatchesText(term: string, text: string): boolean {
  if (!term) return false;
  return buildTermBoundaryRegex(term).test(glossaryScanText(text));
}
