#!/usr/bin/env node
/**
 * Lexicon citation guard: does a rendering quoted in a per-locale terminology
 * file, OR a shipped-key-adjacent rendering quoted in a per-locale STYLE
 * GUIDE, actually occur, in some form, in that locale's shipped strings?
 *
 *   node scripts/check-lexicon-citations.mjs   (usually via `pnpm check:lexicon`)
 *
 * Two other guards already run over docs/i18n and neither catches this
 * defect. check-locales.mjs's used-key rule proves a KEY referenced in
 * frontend source exists in the reference locale — it says nothing about the
 * lexicon at all. And nothing anywhere compares a lexicon row's claimed
 * rendering against the actual shipped VALUE: a translator can write
 * "`config:batchGroupingLabel` is «Группировка пакетов»" in good faith, the
 * shipped string can later change (or the row can simply be copied wrong),
 * and nothing before this script said so. That gap is exactly what the pilot
 * needed most — a row quoting a stale rendering survived six rounds of human
 * review before the shipped file was checked directly.
 *
 * SINCE THEN, this script also reads `docs/i18n/style/<locale>.md` — the
 * style guide a translator copies control shapes from, and which quotes
 * shipped renderings constantly, in running prose rather than a lexicon
 * table. That extension has its own header, "STYLE GUIDE CITATIONS", further
 * down this file, right above checkStyleGuide() — read it before touching
 * anything under that heading; the rules below this point are the ORIGINAL
 * lexicon-table design and do not describe the style-guide path.
 *
 * SCOPE. Only the per-locale files this script targets,
 * docs/i18n/terminology/<locale>.md — not the shared docs/i18n/terminology.md,
 * which is frozen for the duration of the backfill and carries no per-locale
 * renderings to check. A locale file with no shipped locale directory yet
 * (eleven of the fourteen today) is skipped, not failed: an empty scaffold
 * makes no claims, so there is nothing to verify.
 *
 * WHAT COUNTS AS A CITATION, and what deliberately does not.
 *
 *   1. The Rendering column's own value, whenever it is non-empty. This is
 *      the row's primary claim and is always checked.
 *   2. A guillemet-, corner-bracket- or straight-double-quote-delimited span
 *      in the Notes column, but ONLY when it sits immediately next to a
 *      backtick `ns:key`-shaped reference — either "`key` is «span»" (and its
 *      "ships"/"ships as"/"says"/"becomes"/"renders" variants) or
 *      "«span» (`key`)". That adjacency is what turns a quoted word into a
 *      falsifiable CITATION rather than linguistic commentary. Most of
 *      ru.md's quoted spans are the latter: a declension paradigm ("gen.
 *      проекта, dat. проекту…"), a rejected candidate ("«опорный» и
 *      «промежуточный» were rejected"), or a status value quoted only for
 *      its shape. None of those claims the shipped file contains that exact
 *      span, so checking every quoted span indiscriminately would flag
 *      dozens of correct rows — the "cries wolf, gets disabled" failure this
 *      whole codebase's locale-rules module is written to avoid (see its own
 *      header). A citation bound to a specific key is checkable; free-
 *      floating linguistic commentary is not, and is left alone on purpose.
 *      A free-text "`key` ships as: <unquoted paragraph>" block (four of
 *      these exist in ru.md today) is likewise NOT parsed — it has no
 *      closing delimiter to parse to, and guessing a sentence boundary would
 *      either truncate a real citation or swallow trailing commentary as
 *      part of it. Known gap, not a silent one.
 *   3. A backtick span that is NOT shaped like a key or file reference (it
 *      contains whitespace, or a character outside `[\w./:*-]`) is treated
 *      as a citation too, by the same adjacency-free rule as a quoted span —
 *      UNLESS the span is itself a reference to an interpolation token
 *      (`` `{{message}}` ``, `` `{{count}}件` ``): isPlaceholderReferenceSpan()
 *      excludes it, because a placeholder is substituted at render time and
 *      can never appear in the shipped corpus literally — a backtick'd
 *      mention of one in prose ("collides with the `{{message}}` strings")
 *      is commentary about a token name, not a claim about shipped text, and
 *      two translators (ja, de) independently wrapped one in backticks and
 *      hit this rule by accident before the exclusion existed.
 *
 *   The delimiter used for "a quoted span" is decided PER CELL, not per
 *   locale, and — since the wave that added the style-guide extension below —
 *   over THREE delimiter pairs, not two: a cell containing a guillemet uses
 *   guillemets; failing that, a cell containing a Japanese corner bracket
 *   (「」) uses corner brackets; failing that, straight double quotes are the
 *   fallback. Priority order matters for the same reason it did with two
 *   delimiters: ru.md uses straight quotes exclusively to quote ENGLISH words
 *   under discussion ("the word "string"", ""Approve all suggestions""),
 *   never a Russian citation, so treating both delimiters as equivalent in a
 *   guillemet cell would check English prose against a Russian corpus and
 *   fail every time. es.md/fr.md have no guillemets at all, so straight
 *   quotes are their only citation delimiter — confirmed by reading every
 *   quoted span in those files, not assumed.
 *
 *   THE CORNER-BRACKET CASE WAS A REAL, SHIPPED BUG, not a hypothetical
 *   extension made for symmetry with the style-guide path. Before it was
 *   added here, quoteDelimiterFor() had exactly two branches — guillemet or
 *   straight-quote fallback — so a ja.md Notes cell whose only quote
 *   punctuation was 「…」 (Japanese's own convention, stated in that file's own
 *   header) matched NEITHER branch: it fell to the straight-quote fallback,
 *   found no straight quotes in the cell, and extracted ZERO citations from a
 *   cell that plainly named one. Every Notes citation in terminology/ja.md
 *   was silently unchecked as a result — which is exactly how a stale
 *   `pass rate` rendering survived batch 1's own review; see
 *   checkLocaleLexicon's real-corpus regression test for the corner-bracket
 *   citation used to prove the fix catches a genuine defect. Korean and both
 *   Chinese locales (also in UNSPACED_SCRIPT_LOCALES) use the same 「」/『』ish
 *   convention family and would have hit this identically the moment their
 *   terminology files gained content — this was not a Japanese-only fix.
 *
 * INFLECTION TOLERANCE, and why this shape. Russian (and, later, Turkish)
 * inflects nouns and adjectives, so a citation written in dictionary form —
 * "запись" — routinely surfaces in the shipped string only in a declined
 * form: "записи", "записью", "записей". Demanding byte-identity would fire
 * on most correctly-cited Russian rows, and a check that cries wolf on
 * correct rows is a check that gets disabled rather than fixed.
 *
 * The tolerance is WORD-LEVEL LONGEST-COMMON-PREFIX, applied independently to
 * every "significant" word (>= MIN_WORD_LENGTH characters) in the candidate:
 * a word is "attested" if the locale's corpus contains some word sharing a
 * prefix of at least requiredPrefixLength(word.length) characters with it. A
 * whole candidate is covered only if every one of its significant words is
 * attested — one unrelated word is enough to fail the row.
 *
 * The required prefix is a RATIO of word length (PREFIX_RATIO, floored at
 * PREFIX_FLOOR), not a flat character count. A flat count small enough to
 * tolerate "метка" -> "метки" (a 5-letter word, one-letter ending) is far too
 * loose for a 12-letter word like "переполнение", where the same flat count
 * would match on the shared first syllable alone ("пере-", which also starts
 * "перевод", "переведено" and a dozen unrelated words) and never fail on
 * anything. Scaling by ratio keeps both ends honest: measured against the
 * shipped ru corpus, ratio 0.7 / floor 3 accepts every real declension in the
 * current lexicon (verified by running this script against it — see the
 * package script) while rejecting a fabricated word and a real-but-unrelated
 * one in the stress cases pinned alongside this module's other tests.
 *
 * UNSPACED-SCRIPT ATTESTATION. Everything above assumes the target script
 * marks word boundaries with whitespace, so tokenizeWords() can split a
 * sentence into the individual words a citation is checked against.
 * Japanese, Korean, Chinese and Thai do not — UNSPACED_SCRIPT_LOCALES in
 * locale-rules.mjs is the exact same list the identical-value rule
 * (MIN_UNSPACED_CHARS) and the numeral-agreement detector's `gapFor()`
 * already special-case, for the identical underlying reason; this script
 * predates all three languages having a shipped locale directory and never
 * got the same treatment until Japanese was the first to exercise it.
 * Because tokenizeWords() splits only on non-letter characters, an entire
 * Japanese CLAUSE with no intervening punctuation is ONE token:
 * `config:sourcesHint` ships "エントリをインポートすると、ここにソースラベルが
 * 表示されます。", which tokenizes as a single run up to the "、" — so the
 * lexicon's "source label" -> "ソースラベル" citation sits in the MIDDLE of
 * that one corpus token, never at its start. requiredPrefixLength anchors to
 * position 0 of both strings — that is what "prefix" means — so it can only
 * ever match a citation that happens to open a clause, which was true of
 * none of nine real, correctly-cited Japanese terms (verified: each of the
 * nine occurs mid-sentence in the shipped file, never clause-initial). No
 * value of PREFIX_RATIO or PREFIX_FLOOR fixes this; a prefix rule cannot
 * match a substring that does not start at position 0, however short the
 * required prefix is allowed to get.
 *
 * For a locale in UNSPACED_SCRIPT_LOCALES, checkLocaleLexicon() therefore
 * switches wordIsAttested() to CONTAINMENT instead of leading-prefix: a
 * candidate is attested if some corpus token contains it anywhere, not only
 * as a leading run (options.unspacedScript; see wordIsAttested()'s own
 * comment). This is not "the same rule but looser" — it is the rule that
 * makes sense once "prefix of a word" stops being a meaningful position at
 * all, which is exactly the situation a script with no word boundaries is
 * in. See limit 4 below for what the swap gives up.
 *
 * FOUR KNOWN LIMITS OF THIS TOLERANCE, stated rather than hidden. This is
 * the most valuable part of this comment: each one says exactly what gets
 * through and why, so the next person reading a clean run knows precisely
 * which defects it did NOT rule out. None of the first three is fixed by
 * moving PREFIX_RATIO or PREFIX_FLOOR — the "required prefix" section above
 * already measured what a looser, flatter floor costs, and tightening
 * either constant to close one of these gaps reopens that exact calibration
 * problem for a different word. The fourth is specific to the containment
 * swap just above and has no PREFIX_RATIO/PREFIX_FLOOR to tune at all. Four
 * stated limits are worth more than a fifth one nobody wrote down.
 *
 *   1. A case-inflected form of the SAME word cannot be told apart from a
 *      DIFFERENT word derived from the same root, because both share a long
 *      leading stem. Russian "ожидает" (waits, a verb) and "ожидание"
 *      (waiting, a noun) share a five-character stem on seven- and
 *      eight-letter words — the same shape as a legitimate adjective
 *      declension such as "рабочая" -> "рабочей" — so no prefix-only rule
 *      can fail one without also failing the other. A citation that quoted
 *      "ожидает" for a key that actually ships "ожидание" would NOT be
 *      caught. That is a fact about the two pairs having identical string
 *      shape, not a bug in the threshold; catching it needs a lemma/
 *      part-of-speech comparison this script does not attempt.
 *
 *   2. A SHORT-WORD TYPO can coincidentally collide with a genuinely
 *      shipped but entirely unrelated word, and pass for the wrong reason —
 *      a collision, not a shared root. Confirmed against the real shipped
 *      ru corpus: "тег" (tag) mistyped as "тек" is a 3-letter candidate, so
 *      its required prefix is the floor, 3 — and the corpus ships "текст"
 *      (text), which happens to start with exactly those same three
 *      characters. `wordIsAttested('тек', corpus)` returns `true`, even
 *      though "тек" is nobody's citation of "текст" and "тег" was never
 *      shipped as "тек" anywhere. The shorter a wrong candidate is, the
 *      more likely a coincidental collision like this becomes, because
 *      short prefixes are drawn from a small alphabet that many unrelated
 *      words share.
 *
 *   3. TRUNCATION TOWARD THE FLOOR is structurally never caught, for the
 *      same underlying reason (2) is possible at all: the required prefix
 *      scales with the CANDIDATE's own length, not with whatever length the
 *      citation was supposed to have. A citation garbled or truncated down
 *      to a 3-letter fragment — "пер" instead of "переполнение" — needs
 *      only a 3-character match, which the real word (and a dozen other
 *      unrelated ones: "перевод", "период", "переведено"…) all satisfy
 *      trivially; confirmed the same way — `wordIsAttested('пер', corpus)`
 *      is `true` against the real shipped ru corpus. The shorter a wrong
 *      citation gets, the EASIER this check finds it to wave through, which
 *      is the opposite of what "tolerance" is meant to buy, and is an
 *      unavoidable consequence of scaling the requirement to the
 *      candidate's own — possibly already wrong — length rather than to
 *      some ground truth this script has no way to know.
 *
 *   4. SCOPED TO UNSPACED-SCRIPT LOCALES (see UNSPACED_SCRIPT_LOCALES
 *      above): containment gives up the prefix rule's tolerance for
 *      inflection at the END of a word, because containment demands every
 *      character of the candidate match, contiguously, wherever it occurs —
 *      there is no ratio or floor to relax. A spaced-locale citation in
 *      dictionary form is accepted when the shipped word differs in its
 *      last ~30% of characters (that is the whole point of PREFIX_RATIO —
 *      "метка" cited for shipped "метки"). The equivalent situation in an
 *      unspaced-script locale — a citation whose dictionary/citation form
 *      differs from the shipped form only in trailing characters, the way a
 *      Japanese い-adjective or する-verb conjugation can alter a word's own
 *      tail — is NOT caught: containment requires the candidate's exact
 *      characters to appear unbroken, so any difference anywhere in the
 *      candidate, including at the very end, fails the match. This is the
 *      opposite trade from limits 1-3, which are all about the prefix rule
 *      being too LOOSE at the end of a word; containment is looser about
 *      WHERE a match sits (anywhere in a corpus token, not only its start)
 *      but has zero tolerance for HOW EXACTLY it matches once found. No
 *      shipped Japanese citation has been observed to fall in this gap —
 *      Japanese nouns mostly do not inflect at all, which is why containment
 *      is the right default here — but a future term whose citation form is
 *      a verb or adjective stem rather than its shipped conjugated form
 *      could.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UNSPACED_SCRIPT_LOCALES, flattenEntries, loadLocales } from './locale-rules.mjs';

// `join(dirname(fileURLToPath(import.meta.url)), '..')`, NOT
// `fileURLToPath(new URL('..', import.meta.url))`. This module is imported
// both by plain Node (the CLI) and by the vitest `frontend` project, which
// runs in jsdom — and jsdom's `URL` global is not node:url's, so
// `fileURLToPath()` rejects a `new URL(relative, import.meta.url)` result
// with ERR_INVALID_URL_SCHEME even though `import.meta.url` itself is a
// perfectly good `file:` URL. Composing the relative path with node:path
// instead of the URL constructor sidesteps the question — see
// locale-rules.mjs's own header for the same trap, probed the same way.
const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = join(APP_ROOT, 'packages/frontend/src/locales');
const TERMINOLOGY_DIR = join(APP_ROOT, 'docs/i18n/terminology');
const STYLE_DIR = join(APP_ROOT, 'docs/i18n/style');

// ---------------------------------------------------------------------------
// Matching primitives
// ---------------------------------------------------------------------------

/** Words shorter than this are never checked on their own — see the module
 * header for why a flat floor still applies even though the required prefix
 * otherwise scales with word length: a 1-2 character "word" (a stray letter,
 * a Roman numeral) carries no information either way. */
export const MIN_WORD_LENGTH = 3;

/** See the module header ("INFLECTION TOLERANCE") for how these two were
 * calibrated against the real corpus, not picked round. */
export const PREFIX_RATIO = 0.7;
export const PREFIX_FLOOR = 3;

/** Unicode-letter tokens, lowercased, so "LQA", "«ИИ-рецензия»" and
 * "переполнения" all split the way a human reading the word would expect —
 * `\p{L}\p{M}` keeps combining marks attached to their base letter and drops
 * everything else (spaces, punctuation, `{{count}}` braces) as a separator. */
export function tokenizeWords(text) {
  return (text.match(/[\p{L}\p{M}]+/gu) ?? []).map((word) => word.toLowerCase());
}

/** Length of the shared leading run of two strings. */
export function longestCommonPrefixLength(a, b) {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i += 1;
  return i;
}

/** How many leading characters of `word` a corpus word must share with it to
 * count as the same word inflected. The `Math.min(wordLength, …)` OUTSIDE the
 * floor is load-bearing, not redundant with the one inside: for a word
 * SHORTER than PREFIX_FLOOR (a 1- or 2-letter candidate), `Math.max(floor, …)`
 * alone would demand more characters than the word even has, so it could
 * never be satisfied even by an exact match. Capping by the word's own length
 * last guarantees a corpus word EQUAL to the candidate always matches,
 * whatever floor or ratio say — a fixed point no calibration should be able
 * to break. */
export function requiredPrefixLength(
  wordLength,
  { ratio = PREFIX_RATIO, floor = PREFIX_FLOOR } = {},
) {
  return Math.min(wordLength, Math.max(floor, Math.ceil(wordLength * ratio)));
}

/** Is `word` attested — itself or a long-enough-shared-prefix relative —
 * anywhere in `corpusWords`? For an UNSPACED-SCRIPT locale
 * (`options.unspacedScript`, set by checkLocaleLexicon from
 * UNSPACED_SCRIPT_LOCALES in locale-rules.mjs) this is CONTAINMENT instead:
 * does some corpus token literally contain `word` as a substring, anywhere
 * within it, not only as its own leading run. See "UNSPACED-SCRIPT
 * ATTESTATION" in the module header for why leading-prefix cannot be applied
 * to a script with no word boundaries at all. */
export function wordIsAttested(word, corpusWords, options) {
  if (options?.unspacedScript) {
    for (const corpusWord of corpusWords) {
      if (corpusWord.includes(word)) return true;
    }
    return false;
  }
  const required = requiredPrefixLength(word.length, options);
  for (const corpusWord of corpusWords) {
    if (longestCommonPrefixLength(word, corpusWord) >= required) return true;
  }
  return false;
}

/** The tokens of `text` worth checking on their own — see MIN_WORD_LENGTH. */
export function significantWords(text, minWordLength = MIN_WORD_LENGTH) {
  return tokenizeWords(text).filter((word) => word.length >= minWordLength);
}

/**
 * Is every significant word of `candidate` attested in `corpusWords`? A
 * candidate with no significant word at all (e.g. entirely short particles)
 * falls back to checking its whole trimmed, lowercased form as one unit
 * rather than silently passing — an empty candidate (blank cell) is the only
 * thing that is vacuously "covered".
 */
export function renderingIsCovered(candidate, corpusWords, options) {
  const words = significantWords(candidate, options?.minWordLength);
  if (words.length > 0) {
    return words.every((word) => wordIsAttested(word, corpusWords, options));
  }
  const whole = candidate.trim().toLowerCase();
  if (whole === '') return true;
  return wordIsAttested(whole, corpusWords, options);
}

// ---------------------------------------------------------------------------
// Row and citation extraction
// ---------------------------------------------------------------------------

/**
 * Parses a `| Term | Rendering | Notes |` table out of one per-locale
 * lexicon file's text, skipping the header row and the `| --- | --- | --- |`
 * separator. Cells are split on the raw `|` character — safe here because
 * none of the shipped per-locale files ever escape a literal pipe inside a
 * cell (confirmed: zero `\|` sequences across es.md, fr.md and ru.md today).
 */
export function parseLexiconRows(fileText) {
  const rows = [];
  for (const line of fileText.split('\n')) {
    if (!line.startsWith('| ') && !line.startsWith('|')) continue;
    if (!line.trimEnd().endsWith('|')) continue;
    const cells = line
      .slice(line.indexOf('|') + 1, line.lastIndexOf('|'))
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    const [term, rendering, notes] = cells;
    if (term === 'Term') continue; // header
    if (/^-+$/.test(term.replace(/\s/g, ''))) continue; // separator row
    rows.push({ term, rendering, notes: notes ?? '' });
  }
  return rows;
}

/** A backtick span shaped like a key path, a namespace, or a file/anchor
 * reference — the things this file cites constantly and which are never
 * themselves a rendering to verify against the locale corpus. */
export function isKeyLikeSpan(span) {
  return /^[\w./:*-]+$/.test(span);
}

/**
 * A backtick span that names an interpolation TOKEN, such as `` `{{message}}` ``
 * or `` `{{count}}件` ``, rather than citing shipped text. A placeholder is
 * substituted with a value at render time, so it can never appear in the
 * shipped corpus literally — a backtick'd mention of one is a reference to a
 * token name in prose ("collides with the `{{message}}` strings"), not a
 * falsifiable claim, and treating it as one produces a false failure with no
 * way for a translator to satisfy it short of removing correct commentary.
 * Two translators (ja, de) independently wrapped a placeholder in backticks
 * inside a Notes cell and hit exactly this before this exclusion existed —
 * see the module header, "WHAT COUNTS AS A CITATION" item 3.
 */
export function isPlaceholderReferenceSpan(span) {
  return /\{\{[^{}]*\}\}/.test(span);
}

const KEY_SPAN = String.raw`[\w./:*-]+`;
/** Up to three connector words (always English prose in this file, even in
 * ru.md) plus optional punctuation between a key and its quoted rendering —
 * "is", "ships", "ships as:", "says", "becomes", or nothing at all when the
 * two sit directly adjacent ("`key` «span»"). */
const CONNECTOR = String.raw`(?:\w+(?:\s+\w+){0,2}\s*)?[:—-]?\s*`;

function citationPatterns(open, close) {
  const openPattern = open === '"' ? '"' : open;
  const closePattern = close === '"' ? '"' : close;
  return {
    forward: new RegExp(
      '`(' + KEY_SPAN + ')`\\s*' + CONNECTOR + openPattern + '([^' + closePattern + ']+)' + closePattern,
      'g',
    ),
    backward: new RegExp(
      openPattern + '([^' + closePattern + ']+)' + closePattern + '\\s*\\(\\s*`(' + KEY_SPAN + ')`\\s*\\)',
      'g',
    ),
  };
}

/**
 * The quote delimiter this cell's citations use. Decided PER CELL, over
 * THREE candidates in priority order — guillemet, then Japanese corner
 * bracket, then straight-quote fallback — see the module header ("WHAT
 * COUNTS AS A CITATION", item 2) for why priority order matters and for the
 * real, shipped bug the corner-bracket branch fixes: before it existed, a
 * ja.md Notes cell quoted only in 「…」 fell straight through to the
 * straight-quote fallback and yielded zero citations, silently.
 */
export function quoteDelimiterFor(cellText) {
  if (cellText.includes('«')) return { open: '«', close: '»' };
  if (cellText.includes('「')) return { open: '「', close: '」' };
  // Curly doubles are checked BEFORE the straight fallback, and the ordering is
  // the whole point. A locale whose lexicon uses curly quotes exclusively — 974
  // of them and not one straight quote — extracted ZERO citations for four
  // rounds, because straight quotes were the unconditional fallback and a curly
  // span never matched them. Every one of its key-adjacent citations was
  // silently unchecked while the run stayed green.
  //
  // The mixed cell is the reason this sits above the fallback rather than
  // below it: with straight first, a cell carrying an English gloss in straight
  // quotes and the locale's rendering in curly ones extracts the ENGLISH and
  // checks it against the target-language corpus — a guaranteed false finding
  // that also hides the real citation.
  if (cellText.includes('“')) return { open: '“', close: '”' };
  return { open: '"', close: '"' };
}

/**
 * Every key-adjacent quoted-span citation in `cellText`, as the quoted text
 * alone (the key is only what makes the span a citation — this script does
 * not resolve or validate the key itself; that is a different guard's job).
 */
export function extractQuotedCitations(cellText) {
  const { open, close } = quoteDelimiterFor(cellText);
  const { forward, backward } = citationPatterns(open, close);
  const citations = [];
  for (const match of cellText.matchAll(forward)) citations.push(match[2]);
  for (const match of cellText.matchAll(backward)) citations.push(match[1]);
  return citations;
}

/** Backtick spans in `cellText` that are not key-like and not a placeholder
 * reference — see isKeyLikeSpan and isPlaceholderReferenceSpan. */
export function extractNonKeyBacktickSpans(cellText) {
  const spans = [];
  for (const match of cellText.matchAll(/`([^`]+)`/g)) {
    if (!isKeyLikeSpan(match[1]) && !isPlaceholderReferenceSpan(match[1])) spans.push(match[1]);
  }
  return spans;
}

/**
 * Every candidate rendering a row asserts, each tagged with where it came
 * from (for the offender report). The Rendering column is always included
 * when non-empty; the Notes column contributes its key-adjacent quoted spans
 * and any non-key backtick span.
 */
export function candidatesForRow(row) {
  const candidates = [];
  if (row.rendering.trim() !== '') {
    candidates.push({ source: 'Rendering', text: row.rendering });
  }
  for (const text of extractQuotedCitations(row.notes)) {
    candidates.push({ source: 'Notes citation', text });
  }
  for (const text of extractNonKeyBacktickSpans(row.notes)) {
    candidates.push({ source: 'Notes citation', text });
  }
  for (const text of extractNonKeyBacktickSpans(row.rendering)) {
    candidates.push({ source: 'Rendering citation', text });
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Allowlist — a rendering deliberately absent from the shipped corpus today
// ---------------------------------------------------------------------------

/**
 * `locale:term` -> why the Rendering column's own value is not expected to
 * appear in the shipped corpus. This is NOT an escape hatch for a wrong
 * citation — it is for the rarer case where the row correctly records the
 * SETTLED word for a concept the shipped strings do not currently need to
 * spell out. `ru:severity` is the one example today: the row's own Notes
 * say plainly that every shipped LQA-severity string drops the head noun
 * ("Prefer no head noun at all — that is what the app's strings do") and
 * that «серьезность» is recorded only for the one situation that would need
 * a noun, such as a future column header, which does not exist yet.
 * Entries are asserted to still be needed (see staleAllowlistEntries) so a
 * future edit that finally ships the word does not leave a dead suppression
 * hiding the next real regression on that row.
 */
export const RENDERING_ALLOWLIST = {
  'ru:severity':
    'Every shipped LQA-severity string drops the head noun (see the row\'s own Notes: ' +
    '"Prefer no head noun at all — that is what the app\'s strings do"). «Серьезность» / ' +
    '«критичность» are recorded as the settled word for the one case that would need a ' +
    'noun — e.g. a column header — which the app does not have today, so the word is not ' +
    'and should not be expected to be anywhere in the shipped corpus yet.',
};

function allowlistKey(locale, term) {
  return `${locale}:${term}`;
}

// ---------------------------------------------------------------------------
// Per-locale check
// ---------------------------------------------------------------------------

/**
 * Every string value in `namespaces` (a Map<namespace, parsedJSON>, i.e. one
 * entry of loadLocales()'s return value), tokenized into words once so every
 * row's candidates can be checked against the same list.
 */
export function corpusWordsFor(namespaces) {
  const words = [];
  for (const data of namespaces.values()) {
    for (const [, value] of flattenEntries(data)) {
      if (typeof value === 'string') words.push(...tokenizeWords(value));
    }
  }
  return words;
}

/**
 * Checks one locale's lexicon file against its shipped corpus. Returns
 * `{ offenders, allowlisted, rowsChecked }` — `offenders` as
 * `term (source): "text"` strings, ready to print; `allowlisted` the
 * RENDERING_ALLOWLIST keys this locale actually used, so the caller can
 * detect a stale entry.
 */
export function checkLocaleLexicon(locale, fileText, corpusWords, options) {
  // Every candidate for THIS locale is checked under one matching rule,
  // decided once here rather than by each caller — see UNSPACED_SCRIPT_LOCALES
  // in locale-rules.mjs and "UNSPACED-SCRIPT ATTESTATION" in the module
  // header. `options` may still set the prefix-mode ratio/floor explicitly
  // (tests do); this only adds the mode switch on top.
  const matchOptions = { ...options, unspacedScript: UNSPACED_SCRIPT_LOCALES.has(locale) };
  const offenders = [];
  const allowlisted = new Set();
  const rows = parseLexiconRows(fileText);
  let rowsChecked = 0;
  for (const row of rows) {
    const candidates = candidatesForRow(row);
    if (candidates.length === 0) continue;
    rowsChecked += 1;
    for (const candidate of candidates) {
      if (renderingIsCovered(candidate.text, corpusWords, matchOptions)) continue;
      const key = allowlistKey(locale, row.term);
      if (candidate.source === 'Rendering' && key in RENDERING_ALLOWLIST) {
        allowlisted.add(key);
        continue;
      }
      offenders.push(`${row.term} (${candidate.source}): "${candidate.text}"`);
    }
  }
  return { offenders, allowlisted, rowsChecked };
}

// ---------------------------------------------------------------------------
// STYLE GUIDE CITATIONS — docs/i18n/style/<locale>.md
// ---------------------------------------------------------------------------
//
// A style guide is running prose, not a Term/Rendering/Notes table, and it
// quotes a shipped rendering constantly — "resolve the control, then here is
// what it ships as". Nothing above this point ever opened these files: a
// German sweep of `style/de.md` this round found five stale or malformed
// citations among 106 quoted spans by hand, `style/ru.md` was found stale
// three separate times in pre-flight, and a whole-branch review independently
// flagged the gap as higher-value than a typography guard also on the table.
// This section is the fix, reusing every primitive above it (KEY_SPAN,
// isKeyLikeSpan, isPlaceholderReferenceSpan, renderingIsCovered,
// UNSPACED_SCRIPT_LOCALES) rather than re-deriving them.
//
// WHAT COUNTS AS A CITATION HERE, and what does not.
//
// A style guide mixes three things that all look the same at a glance — a
// quoted span of the target language — and only one of them is checkable:
//
//   1. A CITATION: a quoted span bound to a key whose NAMESPACE has already
//      shipped for this locale. Checkable today, exactly like a lexicon
//      Rendering cell.
//   2. A PRESCRIPTION: a quoted span bound to a key whose namespace has NOT
//      shipped yet (batch 1 today is `config`-only for de/tr/ja; ru shipped
//      every namespace, so ru has no prescriptions left). It describes what
//      that key MUST ship, not what it DOES ship, and checking it against
//      today's corpus would either pass by pure accident (the words happen
//      to occur elsewhere already) or fail for a reason that has nothing to
//      do with the citation being wrong. `style/tr.md`'s own header block
//      states this exact three-way split independently, in its own words,
//      before this script read a single style guide — which is strong
//      independent confirmation this is the right cut, not a rule invented
//      to fit the four files it happened to be checked against.
//   3. An ILLUSTRATION: a quoted span with NO key adjacent to it at all — a
//      rejected candidate ("neither "Wähle ein Projekt aus" nor "Wählen Sie
//      ein Projekt aus""), a wrong form shown as wrong, a declension
//      paradigm, an English gloss under discussion. Never copied as a
//      rendering, and — exactly as in a lexicon Notes cell (see WHAT COUNTS
//      AS A CITATION above) — never extracted, because nothing marks it as a
//      claim about shipped text. This is the SAME adjacency principle the
//      lexicon rules already rely on, just applied to prose instead of a
//      table cell.
//
// So there are two decisions, and they are independent: EXTRACTION decides
// whether a quoted span is a citation-shaped candidate at all (adjacency);
// NAMESPACE GATING decides whether a citation-shaped candidate is checkable
// today (has its namespace shipped). A span can be citation-shaped and still
// not be checked (a prescription); a span can never be citation-shaped no
// matter how "future" it sounds (an illustration is never checked, and never
// needs to be — it never claimed anything about the shipped corpus).
//
// EXTRACTION. Four shapes, tried in this order, over the file's PARAGRAPHS
// (flattenStyleParagraphs joins a soft-wrapped paragraph into one line so a
// citation split across a markdown line wrap — `style/de.md`'s
// `config:health.successRate` example is exactly this — is still found; a
// blank line remains a hard break, so one paragraph's trailing key can never
// absorb the next paragraph's leading quote):
//
//   a. FORWARD, quote-delimited: `` `key` [("English gloss")] [connector]
//      "span" ``. The optional parenthetical gloss is new relative to the
//      lexicon Notes-cell forward pattern (STYLE_GLOSS below) — a style
//      guide routinely restates the English source in parens before giving
//      the rendering ("`sidebar:selectProject` ("Select a project") is
//      "Projekt auswählen""), which the lexicon table never does because a
//      lexicon row has no English-source column to restate. The connector
//      itself is unchanged from the lexicon rule: up to three words plus
//      optional `:`/`—`/`-` punctuation. A connector containing a NEGATION
//      (`not`, `never`, `no longer`, `isn't`) is dropped rather than
//      extracted — `` `key` is not "X"`` names X to reject it, the mirror
//      image of "no key at all" for the illustration case above; no shipped
//      style guide currently has this shape, but a citation guard that could
//      be fooled by "is not" is worse than one with an explicit rule against
//      it, at negligible cost.
//   b. BACKWARD, quote-delimited: `` "span" (`key`) `` — unchanged from the
//      lexicon rule.
//   c. BARE PARENTHETICAL: `` `key` ("span") `` with NO connector or
//      trailing quote at all — `style/de.md`'s own worked example for why
//      this script exists: `` `config:routing.defaultToneHelp` ("Einträge
//      verwendet, die diese Regel übersetzt") ``, a direct German citation in
//      parens, no "is"/"ships" in sight. This shape is genuinely ambiguous
//      with (a)'s gloss-only prefix — both are "`key` (something in
//      parens)" — so it is accepted ONLY when (a)/(b) did not already
//      consume that exact key+paren span (tracked by match range, not by
//      re-parsing) AND the parenthetical contains a non-ASCII LETTER
//      (hasNonAsciiLetter): an English gloss is, in every observed instance,
//      pure ASCII text (aside from a stray "…" or em dash, neither of which
//      is a letter), while a German/Turkish citation typically carries an
//      umlaut/cedilla/dotless-i and a Russian or Japanese one is non-ASCII by
//      definition. This is a heuristic, not a certainty, and it is
//      documented as one rather than assumed: a German or Turkish citation
//      written entirely in plain ASCII letters (`style/de.md`'s neighboring
//      "Limits, die der Spiel-Editor vorgibt" is exactly this) is
//      INDISTINGUISHABLE from an English gloss by this rule and is silently
//      not checked — a known false negative, not a false positive, which is
//      the direction this script has to fail in.
//   d. PIPE-ADJACENT BACKWARD, table-row shape: `` "span" | `key` `` — a
//      citation and its key in ADJACENT `|`-separated table cells rather
//      than adjacent in the same clause. `style/ru.md`'s "Surface names
//      already shipped" table and `style/ja.md`'s "Surface names settled in
//      batch 1" table both have this exact shape in their second and third
//      columns (`| Compare | «Сравнение» | `strings:tabs.compare` | ... |`,
//      `| Global Config | 「グローバル設定」 | `config:globalConfigTitle` |
//      ... |`) — a rendering quoted in one cell, its key in the very next
//      one, no clause-level adjacency at all. Bounded to exactly ONE `|`
//      between quote and key (not "the next key anywhere in the row"): a
//      corpus-wide scan for `["»」]\s*\|\s*` immediately-followed-by-a-key
//      found this shape in exactly these two tables and nowhere else, so a
//      single-pipe bound is not an arbitrary guess, it is what the real data
//      contains. A row's THIRD+ cell (`style/ru.md`'s "Repeated at",
//      `style/ja.md`'s "Also owed by") — a key that merely OWES the same
//      rendering, not one already checked to carry it — is correctly out of
//      this pattern's one-pipe reach and is never claimed as a citation.
//
// TWO THINGS DELIBERATELY NOT DONE, each because the real content in
// `style/de.md`, `style/ru.md`, `style/tr.md` and `style/ja.md` was read
// first and shows why:
//
//   - NO adjacency-free "any non-key backtick span is a citation" rule (the
//     lexicon Notes-cell rule 3), applied file-wide. Tried this in analysis
//     and it fires on every symbol/regex/code illustration a style guide
//     uses to teach its own sweeps: `` `;` ``, `` `„…“` ``, `` `1.234,56` ``,
//     `` `\b(Sie|Ihr|Ihre|Ihnen)\b` ``, `` `toLowerCase()` ``,
//     `` `Intl.PluralRules('tr')` `` — every one of these is a real backtick
//     span in one of the four files today, none is a citation, and a bare
//     "non-key, non-placeholder" filter (the lexicon rule) accepts most of
//     them because they contain letters and are not key-shaped. Restricting
//     extraction to KEY-ADJACENT quoted/parenthetical spans, as (a)-(c) do,
//     structurally excludes every one of these without needing to enumerate
//     them: none sits directly after a backtick key.
//   - NO backtick-delimited citation body (`` `key` ships as `Word` ``,
//     rather than in quotes). `style/ru.md` has exactly one instance,
//     `` `config:models.useCustom` ships as `Использовать «{{model}}» как
//     пользовательскую модель` `` — a real citation, missed by this design.
//     Supporting it safely means telling it apart from every command/path
//     backtick span two paragraphs later (`` `node
//     scripts/i18n-preflight.mjs de` `` in `style/de.md` is the concrete
//     instance — a backtick span containing WHITESPACE that is not a key and
//     not a placeholder reference, exactly the trap this module's header
//     already names for the lexicon Notes-cell rule and calls unexercised
//     there; it is exercised here, by this exact string, and the fix is the
//     same one item 3 already states: this design does not extract a bare
//     backtick span as a citation AT ALL outside the quote/paren shapes
//     above, so a command or path backtick span is simply inert — never a
//     match target — rather than caught-and-excluded case by case). One
//     missed citation, cleanly documented, beats a body of code trying to
//     out-guess every future command example.
//     THE DECISION, and why it is "rewrite the row", not "add a fourth
//     delimiter": adding a bare backtick as a citation delimiter here is not
//     merely more work, it is actively unsafe, because a backtick is ALSO
//     this design's own KEY delimiter. `` `config:models.select` and
//     `config:models.pickTitle` are ... `` — two adjacent backtick-key
//     mentions joined by a short connector — is one of the single most
//     common shapes in every one of these four files. Treat a bare backtick
//     as a citation delimiter and that exact shape becomes indistinguishable
//     from `` `key1` CONNECTOR `key2` ``: the second key gets captured as if
//     it were key1's citation, tokenizes to English/code fragments
//     ("config", "models", "pickTitle"), and fails against the corpus — a
//     brand-new false-positive class across the entire corpus, not a
//     narrowly-scoped fix for one row. The row itself has a cheap, safe fix
//     that needs no guard change at all: rewrap it in straight quotes
//     instead of backticks (confirmed by hand: the citation's own inner
//     «{{model}}» guillemets do not collide with an outer straight-quote
//     pair the way they would with outer guillemets, and the style path
//     already tries straight quotes as one of STYLE_QUOTE_DELIMITERS). This
//     was reported upward rather than edited directly — `style/ru.md` is a
//     shipped, translator-owned authority document.
//
// A FOURTH shape exists for exactly one reason: the first version of this
// analysis claimed the "Surface | Rendering | Owning key" table shape below
// (rendering and key in DIFFERENT `|` cells) was safe to leave uncovered
// because every rendering in it was "already checked elsewhere in prose".
// That claim was never run — and it was false: re-running the real-corpus
// regression with each table-row rendering corrupted in turn found NO other
// citation anywhere in the file that would have caught the corruption. The
// "Repeated at"/"Also owed by" column NAMES a sibling key that must carry
// the same rendering; it does not itself CITE the rendering a second time in
// checkable prose. Retracted, and replaced with STYLE_PIPE_KEY below, which
// closes the gap instead of documenting it.
//
// NAMESPACE GATING implementation: `namespaceOfKey` reads the part of a key
// before its first `:`; a key with no colon at all (almost always a file or
// script reference the KEY_SPAN character class also happens to match, e.g.
// `` `terminology/de.md` `` or `` `english-review-notes.md` ``) is not a
// citation of anything and is dropped outright, not even counted as a
// prescription. A key WITH a colon is checked against `namespaces.has(...)`
// — the same shipped-namespace map corpusWordsFor already flattens — so a
// bogus "namespace" that is not really one (nothing in these four files
// produces one, but nothing prevents it either) is harmless: it is simply
// never present in `namespaces`, so it is treated as a prescription and
// skipped, the safe direction.
export const STYLE_QUOTE_DELIMITERS = [
  { open: '"', close: '"' },
  { open: '«', close: '»' },
  { open: '「', close: '」' },
  // Curly doubles. Added after a locale whose authority documents use them
  // EXCLUSIVELY — 974 curly quotes and not one straight quote — turned out to
  // have every one of its key-adjacent citations silently unextracted, and so
  // unchecked, for four rounds. That is the same shape as the corner-bracket
  // gap this file's header already records for an unspaced script: a delimiter
  // list written from the locales that existed at the time, meeting a locale
  // that punctuates differently. The lesson is in the list rather than the
  // comment — when a new locale arrives, check which quote characters its
  // documents actually use before trusting a green run.
  { open: '“', close: '”' },
];

/** Up to a three-word connector plus optional punctuation, CAPTURED this
 * time (unlike the lexicon CONNECTOR) so extractStyleCitations can veto a
 * negated one — see "WHAT COUNTS AS A CITATION", item (a). */
const STYLE_CONNECTOR_WORDS = String.raw`((?:\w+(?:\s+\w+){0,2})?)`;

/** An optional English-gloss parenthetical directly after the key — see
 * "EXTRACTION", item (a), shape 1: `` `key` (gloss) ``, the paren opens right
 * after the key. de.md's convention throughout: `` `sidebar:selectProject`
 * ("Select a project") is "Projekt auswählen" ``. A SINGLE, non-nested paren:
 * no observed gloss nests parentheses, and nesting support would risk the
 * gloss swallowing real content past its own close-paren.
 *
 * Shape 2 — `` (`key` "gloss") connector "citation" ``, where the paren opens
 * BEFORE the key instead — is deliberately NOT folded into this same
 * alternation; see STYLE_SHAPE2_PATTERNS for why it has to be its own,
 * separately-anchored pattern. */
const STYLE_GLOSS = String.raw`(?:\s*\([^)]*\))?`;

function styleCitationPatterns(open, close) {
  return {
    forward: new RegExp(
      '`(' +
        KEY_SPAN +
        ')`' +
        STYLE_GLOSS +
        String.raw`\s*` +
        STYLE_CONNECTOR_WORDS +
        String.raw`\s*[:—-]?\s*` +
        open +
        '([^' +
        close +
        ']+)' +
        close,
      'g',
    ),
    backward: new RegExp(
      open + '([^' + close + ']+)' + close + String.raw`\s*\(\s*` + '`(' + KEY_SPAN + ')`' + String.raw`\s*\)`,
      'g',
    ),
  };
}

/**
 * Shape 2 — `` (`key` "gloss") connector "citation" `` — see "EXTRACTION",
 * item (a). Anchored at the OPENING paren, which sits BEFORE the key, rather
 * than folded as an alternative into STYLE_GLOSS (which is anchored AFTER
 * the key and can only look forward). That difference is not cosmetic: an
 * earlier version tried "after the key, either a paren-wrapped gloss OR a
 * bare-quote-then-close-paren gloss" as one alternation, and it was a real,
 * caught bug, not a hypothetical one. Once that bare-quote alternative
 * exists at the key's own position, the SAME straight-quote-adjacent-to-key
 * shape is now ambiguous with the ordinary "`key` "citation"" zero-connector
 * case (see styleCitationPatterns' forward pattern) — and when the intended
 * parse (gloss, then a DIFFERENT-delimiter citation later) fails to complete
 * because that later citation is guillemet- or corner-bracket-delimited, not
 * straight-quoted, standard regex backtracking falls back to the other legal
 * parse: the bare gloss quote treated as if IT were the citation. Anchoring
 * shape 2 at the leading "(" instead removes the ambiguity structurally —
 * this pattern and the plain forward pattern can never both claim the same
 * key position, because only one of them requires a "(" immediately before
 * the backtick. The gloss itself is always straight-quoted in every observed
 * instance (es.md/fr.md/it.md/ru.md's shared `english-review-notes.md`
 * Title-Case sentence — `` (`config:routing.title` "Routing Rules") becomes
 * «Правила маршрутизации» ``), so only that one gloss delimiter is supported
 * here; the citation itself is tried against all of STYLE_QUOTE_DELIMITERS.
 */
function styleShape2Pattern(open, close) {
  return new RegExp(
    String.raw`\(\s*` +
      '`(' +
      KEY_SPAN +
      ')`' +
      String.raw`\s*"[^"]*"\s*\)\s*` +
      STYLE_CONNECTOR_WORDS +
      String.raw`\s*[:—-]?\s*` +
      open +
      '([^' +
      close +
      ']+)' +
      close,
    'g',
  );
}

/** `` `key` (span) `` with no connector or trailing quote — see "EXTRACTION",
 * item (c). Matched separately from styleCitationPatterns() because it is a
 * strict subset of shape (a)'s shape-1 prefix, before its optional
 * connector+quote tail: every shape-1 match's key+gloss prefix ALSO matches
 * this pattern, which is exactly why extractStyleCitations() has to track
 * and exclude ranges already consumed by shape 1/2/backward rather than
 * simply unioning every pattern's results. */
const STYLE_BARE_PAREN = new RegExp('`(' + KEY_SPAN + ')`\\s*\\(([^)]*)\\)', 'g');

/** `` "span" | `key` `` — see "EXTRACTION", item (d): a table-row shape
 * where the rendering and its key sit in adjacent `|`-separated cells rather
 * than adjacent in prose. Exactly one pipe between quote and key, matching
 * what the real corpus contains (see item (d)'s own comment for the scan
 * that confirmed this bound, not merely assumed it). */
function stylePipeKeyPattern(open, close) {
  // `|` required on BOTH sides, not just before the key — the quote must be
  // its OWN cell's entire content, not merely something that happens to
  // precede a `|`. Without the leading `|`, this pattern over-matched a real
  // row: `style/ja.md`'s "Translations (tab)" row nests its OWN "named in
  // prose by `key` 「quote」" citation inside a LATER cell, and the naive
  // (quote)(pipe)(key) version grabbed THAT quote and misattributed it to
  // the row's fourth-cell key — silently harmless only because that key's
  // namespace has not shipped for ja yet, and a guaranteed false positive
  // the day it does (the two strings are unrelated sentences). Requiring a
  // `|` immediately before the quote too confines a match to a cell whose
  // ENTIRE content is the quote, which is what every genuine instance in
  // both real tables looks like and what the nested-citation row does not.
  return new RegExp(
    '\\|\\s*' + open + '([^' + close + ']+)' + close + '\\s*\\|\\s*`(' + KEY_SPAN + ')`',
    'g',
  );
}

/**
 * A key-adjacent connector that means the following quote is NOT a claim
 * about shipped text, even though it is quote-delimited and key-adjacent —
 * every word here was found causing a real false positive in one of the four
 * populated style guides, not added speculatively:
 *
 *   - `not` / `never` / `no longer` / `isn't`: `` `key` is not "X"`` names X
 *     to reject it — see "EXTRACTION", item (a). No shipped style guide uses
 *     this shape today; kept as a cheap guard against one that will.
 *   - `shipped` (bare past tense, distinct from `ships`): de.md's own worked
 *     example for a FIXED defect, kept on purpose as a worked example —
 *     `` `config:lqa.checks.untranslated.description` shipped "Einträge, die
 *     triviale Matcher abfangen würden" `` quotes the WRONG, since-corrected
 *     string, deliberately, to show what the bug looked like. "shipped"
 *     (what a string used to render) and "ships" (what it renders now) are
 *     one word apart and opposite in meaning for this guard's purposes.
 *   - `bare` (as in "is the bare"): ru.md and tr.md's parallel worked example
 *     for the sibling-namespace trap — `` `quality:checkLabels.tag-equality`
 *     is the bare "Tag equality"`` — names the UNADORNED ENGLISH form of the
 *     key for contrast with a fuller sibling, not a rendering.
 */
const NON_CLAIM_CONNECTOR = /\b(?:not|never|no longer|isn't|isnt|shipped|bare)\b/i;

/**
 * A citation immediately followed by this (within a short trailing window)
 * is explicitly marked as the ENGLISH source, not a rendering — tr.md's
 * `` `config:fullReplaceOrphanNotice` calls it the "Relink tab" in English``
 * is the one instance found; without this check "Relink tab" itself was
 * extracted and checked against the Turkish corpus.
 */
const TRAILING_ENGLISH_GLOSS = /^\s*in English\b/i;

/** Does `text` contain at least one Unicode LETTER outside the ASCII range?
 * The disambiguator for STYLE_BARE_PAREN — see "EXTRACTION", item (c), for
 * what this does and does not catch. */
export function hasNonAsciiLetter(text) {
  for (const ch of text) {
    if (ch.codePointAt(0) > 127 && /\p{L}/u.test(ch)) return true;
  }
  return false;
}

/**
 * Strips one layer of wrapping quote/backtick characters from a
 * STYLE_BARE_PAREN capture, so an offender message reads `key: "text"`
 * rather than `key: "«text»"` or `` key: "`text`" `` when the parenthetical
 * itself already carried its own quote marks — ru.md's
 * `` `backup:createSection` («Создать резервную копию») `` and tr.md's
 * `` `config:instances.*` (`"{{base}}" örneği`) `` both do this. Cosmetic
 * only: tokenizeWords already drops these characters on both the citation
 * and the corpus side, so the match verdict is unaffected either way — this
 * exists so a reader of an offender line is never left wondering whether the
 * extra punctuation is part of the claimed rendering.
 */
export function stripWrappingQuote(text) {
  const trimmed = text.trim();
  const pairs = [
    ['"', '"'],
    ['«', '»'],
    ['「', '」'],
    ['`', '`'],
  ];
  for (const [open, close] of pairs) {
    if (
      trimmed.startsWith(open) &&
      trimmed.endsWith(close) &&
      trimmed.length >= open.length + close.length
    ) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
  }
  return trimmed;
}

/**
 * Locales whose real shipped UI text is never pure ASCII — Cyrillic (ru) and
 * every UNSPACED_SCRIPT_LOCALES member (CJK/Thai). Used only to catch an
 * ENGLISH GLOSS extracted where no gloss-marking punctuation (parens) was
 * present to swallow it — see checkStyleGuide. NOT extended to de/tr: both
 * are Latin-script locales with genuinely, correctly ASCII-only shipped
 * citations today (tr's `config:delete` is "Sil"), so "pure ASCII" carries no
 * signal there at all.
 */
const NON_LATIN_SCRIPT_LOCALES = new Set(['ru', ...UNSPACED_SCRIPT_LOCALES]);

/** The namespace prefix of a `namespace:key.path` reference — the part
 * before the first `:` — or `null` if the span has no colon at all (a file
 * or script reference KEY_SPAN's character class also matches; see
 * "NAMESPACE GATING" above). Never validated against a real namespace list:
 * an invalid namespace is simply never present in a locale's shipped
 * `namespaces` map, so checkStyleGuide's own gating already treats it as
 * unshippable — the safe outcome — without this function needing to know
 * what a real namespace looks like. */
export function namespaceOfKey(key) {
  const idx = key.indexOf(':');
  return idx === -1 ? null : key.slice(0, idx);
}

/**
 * A style guide is markdown PROSE, not a table: a citation can be split
 * across a soft line wrap that a lexicon table cell never has. Blank lines
 * are markdown's own hard paragraph break, so joining only WITHIN a
 * `\n{2,}`-delimited block (never across one) cannot let one paragraph's
 * trailing key absorb the next paragraph's leading quote. A markdown TABLE
 * block (no blank lines between its rows) flattens into one block same as
 * prose; this is safe rather than a hazard, because every citation pattern
 * above requires a literal quote/paren character immediately after the key
 * (plus its bounded gloss+connector) — the `|` cell separators that remain
 * in the flattened text cannot satisfy that requirement, so a row boundary
 * simply cannot be crossed by a match (verified against every surface-name
 * and control-shape table in the four populated style guides).
 */
export function flattenStyleParagraphs(fileText) {
  return fileText.split(/\n{2,}/).map((block) =>
    block
      // Drop the blockquote marker each line carries BEFORE joining. Without
      // this the join leaves a stray "> " sitting between a key and the
      // rendering quoted after it, which no citation pattern tolerates — so a
      // citation split across a line break inside a blockquote extracted
      // NOTHING, silently, and a guide that states its rules in blockquotes
      // had them go unchecked. Found by measurement in a batch that lost a
      // real prescription to it.
      //
      // The marker is only stripped at the start of a line, so a ">" inside
      // prose or inside a quoted rendering is untouched.
      .replace(/^[ \t]*>[ \t]?/gm, '')
      .replace(/\n/g, ' '),
  );
}

/**
 * Every key-adjacent citation candidate in one flattened block of style-guide
 * text, as `{ key, text }` — `key` exactly as written (raw backtick span,
 * unresolved; see namespaceOfKey), `text` the candidate rendering. See the
 * STYLE GUIDE CITATIONS header above for the three extraction shapes and why
 * a fourth (adjacency-free backtick citation) is deliberately not attempted.
 */
export function extractStyleCitations(text) {
  const citations = [];
  const consumedRanges = [];

  // Shape 2 FIRST, and its consumed ranges recorded before shape 1/backward
  // ever run — see styleShape2Pattern's own comment for why running it
  // first (rather than folding it into styleCitationPatterns) is what makes
  // the ambiguity with the plain "`key` "citation"" zero-connector case
  // structurally impossible rather than merely untriggered by today's
  // content.
  for (const { open, close } of STYLE_QUOTE_DELIMITERS) {
    for (const match of text.matchAll(styleShape2Pattern(open, close))) {
      const matchEnd = match.index + match[0].length;
      consumedRanges.push([match.index, matchEnd]);
      const [, key, connector, span] = match;
      if (NON_CLAIM_CONNECTOR.test(connector)) continue;
      if (span.includes('**')) continue;
      if (TRAILING_ENGLISH_GLOSS.test(text.slice(matchEnd, matchEnd + 20))) continue;
      citations.push({ key, text: span });
    }
  }

  for (const { open, close } of STYLE_QUOTE_DELIMITERS) {
    const { forward, backward } = styleCitationPatterns(open, close);
    for (const match of text.matchAll(forward)) {
      // A match whose key position sits inside an already-consumed shape-2
      // range is shape 2's own gloss, re-discovered here as the spurious
      // "zero-connector" alternate parse — see styleShape2Pattern's comment.
      const withinShape2 = consumedRanges.some(
        ([start, end]) => match.index >= start && match.index < end,
      );
      if (withinShape2) continue;
      const matchEnd = match.index + match[0].length;
      consumedRanges.push([match.index, matchEnd]);
      const [, key, connector, span] = match;
      if (NON_CLAIM_CONNECTOR.test(connector)) continue;
      if (span.includes('**')) continue; // markdown emphasis — commentary about the English source, never a literal rendering
      if (TRAILING_ENGLISH_GLOSS.test(text.slice(matchEnd, matchEnd + 20))) continue;
      citations.push({ key, text: span });
    }
    for (const match of text.matchAll(backward)) {
      consumedRanges.push([match.index, match.index + match[0].length]);
      const [, span, key] = match;
      if (span.includes('**')) continue;
      citations.push({ key, text: span });
    }
  }
  for (const match of text.matchAll(STYLE_BARE_PAREN)) {
    const alreadyConsumed = consumedRanges.some(
      ([start, end]) => match.index >= start && match.index < end,
    );
    if (alreadyConsumed) continue;
    const [, key, rawSpan] = match;
    const span = stripWrappingQuote(rawSpan);
    if (!hasNonAsciiLetter(span)) continue;
    citations.push({ key, text: span });
  }

  // Shape (d) — table-row "span" | `key`. Independent of every shape above
  // (the quote comes BEFORE the key here, separated by a `|` cell boundary,
  // never a `(`), so no overlap tracking against the earlier ranges is
  // needed for correctness; still recorded for consistency and in case a
  // future shape is added that could otherwise double-claim the same span.
  for (const { open, close } of STYLE_QUOTE_DELIMITERS) {
    for (const match of text.matchAll(stylePipeKeyPattern(open, close))) {
      consumedRanges.push([match.index, match.index + match[0].length]);
      const [, span, key] = match;
      if (span.includes('**')) continue;
      citations.push({ key, text: span });
    }
  }
  return citations;
}

/**
 * Checks one locale's style guide against its shipped corpus. Returns
 * `{ offenders, citationsChecked, prescriptionsSkipped }` — `offenders` as
 * `key: "text"` strings, ready to print; `prescriptionsSkipped` the count of
 * citation-shaped candidates whose namespace has not shipped yet (see
 * "NAMESPACE GATING" above) — reported for visibility, never a failure.
 *
 * Two adjustments relative to checkLocaleLexicon, both scoped to THIS
 * function only — checkLocaleLexicon and its lexicon-file callers are
 * untouched, so this cannot change what `pnpm check:lexicon` reports for a
 * terminology file:
 *
 *   - A candidate whose text is pure ASCII is dropped for a
 *     NON_LATIN_SCRIPT_LOCALES member before it is even namespace-gated. An
 *     ENGLISH GLOSS with no parens around it to mark it as one (ja.md:
 *     `` `config:targetLanguages` "Target Languages" and
 *     `config:routing.labelTargetLanguage` "Target language" are both
 *     「ターゲット言語」 ``, two keys sharing one trailing citation) is
 *     otherwise indistinguishable from a real citation by this module's
 *     adjacency rules alone. Restricted to ru/ja/ko/zh/th because a Latin
 *     script locale can have a genuinely, correctly ASCII-only citation
 *     (tr's `config:delete` is "Sil") — see NON_LATIN_SCRIPT_LOCALES.
 *   - `minWordLength: 2` for an UNSPACED_SCRIPT_LOCALES member, down from the
 *     lexicon default of 3 (MIN_WORD_LENGTH). ja.md deliberately quotes a
 *     short, VERBATIM, ellipsis-elided tail of a longer shipped string —
 *     `` `config:pseudoTestHelpLink` 「…読む →」`` for the shipped
 *     "クリックしてガイドを読む →" — and the elided, checkable word "読む" is
 *     two characters. At the default floor of 3 it never becomes a
 *     "significant word" at all, so renderingIsCovered() falls back to
 *     matching the WHOLE candidate string as one unit — arrow and ellipsis
 *     included — against a corpus of pure-letter tokens, which can never
 *     succeed. Two-character CJK words are not the "stray letter" case
 *     MIN_WORD_LENGTH exists to filter (see that constant's own comment) —
 *     a two-character kanji/kana compound routinely carries a word's worth
 *     of meaning, unlike two Latin letters.
 */
export function checkStyleGuide(locale, fileText, namespaces, corpusWords, options) {
  const unspacedScript = UNSPACED_SCRIPT_LOCALES.has(locale);
  const matchOptions = {
    ...options,
    unspacedScript,
    minWordLength: options?.minWordLength ?? (unspacedScript ? 2 : MIN_WORD_LENGTH),
  };
  const nonLatinScript = NON_LATIN_SCRIPT_LOCALES.has(locale);
  const offenders = [];
  let citationsChecked = 0;
  let prescriptionsSkipped = 0;
  for (const block of flattenStyleParagraphs(fileText)) {
    for (const { key, text } of extractStyleCitations(block)) {
      if (nonLatinScript && !hasNonAsciiLetter(text)) continue; // an English gloss with no paren to mark it as one
      const namespace = namespaceOfKey(key);
      if (namespace === null) continue; // a file/script reference, not a translation key
      if (!namespaces.has(namespace)) {
        prescriptionsSkipped += 1;
        continue; // prescription: this namespace has not shipped for this locale yet
      }
      citationsChecked += 1;
      if (renderingIsCovered(text, corpusWords, matchOptions)) continue;
      offenders.push(`${key}: "${text}"`);
    }
  }
  return { offenders, citationsChecked, prescriptionsSkipped };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function runCli() {
  const locales = loadLocales(LOCALES_DIR);
  const files = readdirSync(TERMINOLOGY_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();

  /** [locale, [offender, ...]][] */
  const failures = [];
  const usedAllowlistKeys = new Set();
  let localesChecked = 0;
  let rowsChecked = 0;
  let localesSkipped = 0;

  for (const file of files) {
    const locale = basename(file, '.md');
    const namespaces = locales.get(locale);
    if (!namespaces) {
      // No shipped locale directory yet — an empty scaffold makes no claims
      // about a corpus that does not exist. Not a failure; see module header.
      localesSkipped += 1;
      continue;
    }
    const fileText = readFileSync(join(TERMINOLOGY_DIR, file), 'utf8');
    const corpusWords = corpusWordsFor(namespaces);
    const { offenders, allowlisted, rowsChecked: checked } = checkLocaleLexicon(
      locale,
      fileText,
      corpusWords,
    );
    for (const key of allowlisted) usedAllowlistKeys.add(key);
    if (checked > 0) localesChecked += 1;
    rowsChecked += checked;
    if (offenders.length > 0) failures.push([locale, offenders]);
  }

  const staleAllowlistKeys = Object.keys(RENDERING_ALLOWLIST)
    .filter((key) => !usedAllowlistKeys.has(key))
    .sort();
  if (staleAllowlistKeys.length > 0) {
    failures.push([
      'RENDERING_ALLOWLIST hygiene',
      staleAllowlistKeys.map(
        (key) => `${key} — no longer needed (the word is attested in the shipped corpus now); remove the entry`,
      ),
    ]);
  }

  // Style guides — docs/i18n/style/<locale>.md. Same `locales` map, same
  // corpus-per-locale computation; see the "STYLE GUIDE CITATIONS" header
  // above checkStyleGuide() for what counts as a citation here and why a
  // locale with no shipped directory (or a citation in a namespace that
  // has not shipped for one that does) is skipped rather than failed.
  const styleFiles = readdirSync(STYLE_DIR)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();
  let styleLocalesChecked = 0;
  let styleLocalesSkipped = 0;
  let styleCitationsChecked = 0;
  let stylePrescriptionsSkipped = 0;

  for (const file of styleFiles) {
    const locale = basename(file, '.md');
    const namespaces = locales.get(locale);
    if (!namespaces) {
      styleLocalesSkipped += 1;
      continue;
    }
    const fileText = readFileSync(join(STYLE_DIR, file), 'utf8');
    const corpusWords = corpusWordsFor(namespaces);
    const {
      offenders,
      citationsChecked,
      prescriptionsSkipped,
    } = checkStyleGuide(locale, fileText, namespaces, corpusWords);
    styleCitationsChecked += citationsChecked;
    stylePrescriptionsSkipped += prescriptionsSkipped;
    if (citationsChecked > 0 || prescriptionsSkipped > 0) styleLocalesChecked += 1;
    if (offenders.length > 0) failures.push([`${locale} (style guide)`, offenders]);
  }

  if (failures.length > 0) {
    console.error('');
    for (const [locale, offenders] of failures) {
      console.error(`check-lexicon-citations: FAIL — ${locale}`);
      for (const offender of offenders) console.error(`  ${offender}`);
    }
    const total = failures.reduce((sum, [, offenders]) => sum + offenders.length, 0);
    console.error('');
    console.error(
      `check-lexicon-citations: FAILED — ${total} finding(s) across ${failures.length} locale(s)/group(s).`,
    );
    process.exit(1);
  }

  console.log(
    `check-lexicon-citations: OK — ${localesChecked} locale(s) with shipped renderings checked ` +
      `(${localesSkipped} scaffold(s) with no shipped locale skipped), ${rowsChecked} row(s) with ` +
      `at least one candidate citation; ${styleLocalesChecked} style guide(s) checked ` +
      `(${styleLocalesSkipped} with no shipped locale skipped), ${styleCitationsChecked} citation(s) ` +
      `checked (${stylePrescriptionsSkipped} prescription(s) for an unshipped namespace skipped).`,
  );
}

// Only run as a CLI (the test suite imports the pure functions above).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
