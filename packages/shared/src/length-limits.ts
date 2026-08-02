/**
 * Hard per-language output length limits imposed by the game editor.
 * A translation that exceeds either bound cannot be imported in-game, so the
 * M10 `length-limit` check validates every output against them and LLM
 * modules receive them as an explicit prompt constraint when a shorter
 * version is requested.
 *
 * Limits are grouped by script family:
 * - CJK + Thai + Vietnamese: 500 chars / 1,500 UTF-8 bytes
 * - Cyrillic (Russian):      500 chars / 1,000 UTF-8 bytes
 * - Latin (incl. English): 1,000 chars / 1,000 UTF-8 bytes
 *
 * The limit applies only when a language is a translation *target*; the source
 * language is never translated, so the M10 check skips it (English is most
 * often the source but carries a Latin limit for projects that translate into
 * it).
 */
export interface LengthLimit {
  maxChars: number;
  maxBytes: number;
}

const CJK_THAI_VIETNAMESE: LengthLimit = { maxChars: 500, maxBytes: 1500 };
const CYRILLIC: LengthLimit = { maxChars: 500, maxBytes: 1000 };
const LATIN: LengthLimit = { maxChars: 1000, maxBytes: 1000 };

/** Limits keyed by `LANGUAGE_REGISTRY` code. Languages without an entry (e.g. `pseudo-test`) are unbounded. */
export const LENGTH_LIMITS: Readonly<Record<string, LengthLimit>> = Object.freeze({
  en: LATIN,
  'zh-hans': CJK_THAI_VIETNAMESE,
  'zh-hant': CJK_THAI_VIETNAMESE,
  ko: CJK_THAI_VIETNAMESE,
  ja: CJK_THAI_VIETNAMESE,
  th: CJK_THAI_VIETNAMESE,
  vi: CJK_THAI_VIETNAMESE,
  ru: CYRILLIC,
  es: LATIN,
  fr: LATIN,
  de: LATIN,
  id: LATIN,
  'pt-br': LATIN,
  tr: LATIN,
  it: LATIN,
});

export function getLengthLimit(languageCode: string): LengthLimit | undefined {
  return LENGTH_LIMITS[languageCode];
}

const utf8Encoder = new TextEncoder();

/** UTF-8 byte length of `text` (TextEncoder is available in Node and browsers). */
export function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).length;
}

/** True when `text` exceeds either bound of `limit`. */
export function exceedsLengthLimit(text: string, limit: LengthLimit): boolean {
  return text.length > limit.maxChars || utf8ByteLength(text) > limit.maxBytes;
}

/** Issue type emitted by the M10 `length-limit` check. */
export const TOO_LONG_ISSUE_TYPE = 'too-long';

/**
 * True when the entry's persisted LQA result for `languageCode` flags the
 * current translation as exceeding the language's length limit. Used by the
 * frontend "too long" filter and by M9 to request a shorter version when the
 * entry is re-translated.
 */
export function hasTooLongIssue(
  lqaResults: Record<string, { issues: Array<{ type: string }> }> | undefined,
  languageCode: string,
): boolean {
  const issues = lqaResults?.[languageCode]?.issues;
  return Array.isArray(issues) && issues.some((i) => i.type === TOO_LONG_ISSUE_TYPE);
}
