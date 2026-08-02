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

/** The default built-in matchers applied before module dispatch. */
export const builtInMatchers: TrivialMatcher[] = [emptyMatcher, pureNumericMatcher, urlMatcher];

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
