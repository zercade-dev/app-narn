#!/usr/bin/env node
/**
 * Lexicon citation guard: does a rendering quoted in a per-locale terminology
 * file actually occur, in some form, in that locale's shipped strings?
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
 *   2. A guillemet- or straight-double-quote-delimited span in the Notes
 *      column, but ONLY when it sits immediately next to a backtick
 *      `ns:key`-shaped reference — either "`key` is «span»" (and its
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
 *   locale: if a cell contains a guillemet anywhere, guillemets are that
 *   cell's citation marks and straight double quotes are ignored: ru.md uses
 *   straight quotes exclusively to quote ENGLISH words under discussion
 *   ("the word "string"", ""Approve all suggestions""), never a Russian
 *   citation, so treating both delimiters as equivalent in a guillemet cell
 *   would check English prose against a Russian corpus and fail every time.
 *   A cell with no guillemet falls back to straight double quotes, which is
 *   es.md/fr.md's only citation delimiter — neither file uses guillemets at
 *   all. Both conventions were confirmed by reading every quoted span in the
 *   three currently-populated files, not assumed.
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
 * The quote delimiter this cell's citations use. Decided PER CELL: a
 * guillemet anywhere in the cell means guillemets are the citation marks and
 * straight double quotes are commentary (see the module header); no
 * guillemet means straight double quotes are the citation marks, which is
 * es.md/fr.md's only convention.
 */
export function quoteDelimiterFor(cellText) {
  return cellText.includes('«') ? { open: '«', close: '»' } : { open: '"', close: '"' };
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
      `at least one candidate citation.`,
  );
}

// Only run as a CLI (the test suite imports the pure functions above).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
