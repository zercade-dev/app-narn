import type { StringEntry } from '@zercade-dev/narn-shared';

export interface TrivialMatcher {
  id: string;
  /** Returns translated text if this matcher handles the source, or null to pass through. */
  match(sourceText: string, sourceLang: string, targetLang: string): string | null;
}

/** Matches empty or whitespace-only strings → returns ''. */
export const emptyMatcher: TrivialMatcher = {
  id: 'trivial-empty',
  match(src) {
    return src.trim() === '' ? '' : null;
  },
};

/**
 * Matches pure numeric/punctuation-only strings (digits, spaces, decimal point,
 * comma, percent, plus, minus) → returns source unchanged.
 * Conservative: single-digit strings, "42", "3.14", "100%", "+5", "-12".
 * Requires at least one digit, so lone-punctuation strings ("...", "--", ":")
 * are NOT treated as untranslatable and still reach a translation module.
 */
export const pureNumericMatcher: TrivialMatcher = {
  id: 'trivial-numeric',
  match(src) {
    const trimmed = src.trim();
    return /\d/.test(trimmed) && /^[\d\s.,:%+-]+$/.test(trimmed) ? src : null;
  },
};

/**
 * Matches absolute HTTP/HTTPS URLs → returns source unchanged.
 * Only matches bare URLs (no surrounding text).
 */
export const urlMatcher: TrivialMatcher = {
  id: 'trivial-url',
  match(src) {
    return /^https?:\/\/\S+$/i.test(src.trim()) ? src : null;
  },
};

/** Matches bare hex color literals (#rgb/#rgba/#rrggbb/#rrggbbaa) → returns source unchanged. */
export const hexColorMatcher: TrivialMatcher = {
  id: 'trivial-hex-color',
  match(src) {
    return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(src.trim()) ? src : null;
  },
};

/**
 * Matches strings that are ONLY markup: after stripping <tags> and {placeholders}
 * (nested up to a bounded depth), no Unicode letter remains — pure color
 * wrappers, separators, and placeholder plumbing that a model can only echo
 * back or corrupt. Anything with real words around the markup passes through.
 */
export const markupOnlyMatcher: TrivialMatcher = {
  id: 'trivial-markup-only',
  match(src) {
    const trimmed = src.trim();
    if (trimmed === '' || !/[<{]/.test(trimmed)) return null;
    let stripped = trimmed;
    for (let i = 0; i < 10; i++) {
      const next = stripped.replace(/<[^<>]*>/g, '').replace(/\{[^{}]*\}/g, '');
      if (next === stripped) break;
      stripped = next;
    }
    return /\p{L}/u.test(stripped) ? null : src;
  },
};

/** The default built-in matchers applied before module dispatch. */
export const builtInMatchers: TrivialMatcher[] = [
  emptyMatcher,
  pureNumericMatcher,
  urlMatcher,
  hexColorMatcher,
  markupOnlyMatcher,
];

/**
 * Runs the built-in matchers against sourceText.
 * Returns [matcherId, translatedText] when matched, or null when no match.
 */
export function runTrivialMatchers(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  matchers: TrivialMatcher[] = builtInMatchers,
): [string, string] | null {
  for (const matcher of matchers) {
    const result = matcher.match(sourceText, sourceLang, targetLang);
    if (result !== null) return [matcher.id, result];
  }
  return null;
}

/**
 * Whether a run should (re-)translate this (entry, language) pair. A pair
 * with produced text is done; a pair whose source is EMPTY and whose record
 * was produced by the trivial-empty matcher is also done — without this,
 * every empty-source row re-enters every run's totals forever (its text is
 * '' — falsy — so a truthiness check re-selects it each time), inflating
 * "missing" counts with rows that cost nothing and change nothing.
 */
export function needsTranslation(
  entry: StringEntry,
  targetLanguage: string,
  reTranslate: boolean,
): boolean {
  if (reTranslate) return true;
  const record = entry.translations[targetLanguage];
  if (!record) return true;
  if (record.text) return false;
  return !(entry.sourceText.trim() === '' && record.moduleId === emptyMatcher.id);
}
