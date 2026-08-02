/**
 * Parity checks ported from translate-toolkit's pofilter catalogue —
 * native LQACheck implementations, no external dependency. All compare a
 * surface property of the source text against the translation.
 */
import type { LQAIssue } from '@zercade-dev/narn-shared';
import { runTrivialMatchers } from '../trivial-matchers.js';
import { MASK_PLACEHOLDER_RE, type LQACheck } from './types.js';

/**
 * Numerals in the source, normalized for decimal-separator localization:
 * "3.5" and "3,5" compare equal, and space-style grouping separators are
 * dropped. Mask placeholders are ignored (their integrity has its own check).
 */
function extractNumbers(text: string): string[] {
  const matches = text.replace(MASK_PLACEHOLDER_RE, ' ').match(/\d+(?:[.,\s]\d+)*/g) ?? [];
  return matches.map((m) => m.replace(/\s/g, '').replace(/,/g, '.'));
}

function countByValue(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

const LEADING_WS_RE = /^\s*/u;
const TRAILING_WS_RE = /\s*$/u;
const leadingWhitespace = (s: string): string => s.match(LEADING_WS_RE)?.[0] ?? '';
const trailingWhitespace = (s: string): string => s.match(TRAILING_WS_RE)?.[0] ?? '';

const LITERAL_NEWLINE_RE = /\\n/g;
const REAL_NEWLINE_RE = /\r\n|\r|\n/g;
const countMatches = (text: string, re: RegExp): number => text.match(re)?.length ?? 0;

/** Numbers present in the source must survive into the translation, and vice versa. */
export const numberParityCheck: LQACheck = {
  id: 'number-parity',
  defaultSeverity: 'warning',
  defaultEnabled: true,
  run(entry, translatedText) {
    const issues: LQAIssue[] = [];
    const source = countByValue(extractNumbers(entry.sourceText));
    const translated = countByValue(extractNumbers(translatedText));
    for (const [value, count] of source) {
      if ((translated.get(value) ?? 0) < count) {
        issues.push({
          type: 'number-missing',
          detail: `number "${value}" from the source is missing in the translation`,
        });
      }
    }
    for (const [value, count] of translated) {
      if ((source.get(value) ?? 0) < count) {
        issues.push({
          type: 'number-added',
          detail: `number "${value}" appears in the translation but not in the source`,
        });
      }
    }
    return issues;
  },
};

/** Leading/trailing whitespace must match the source exactly. */
export const whitespaceParityCheck: LQACheck = {
  id: 'whitespace-parity',
  defaultSeverity: 'warning',
  defaultEnabled: true,
  run(entry, translatedText) {
    const issues: LQAIssue[] = [];
    if (leadingWhitespace(entry.sourceText) !== leadingWhitespace(translatedText)) {
      issues.push({
        type: 'whitespace-leading',
        detail: 'leading whitespace differs from the source',
      });
    }
    if (trailingWhitespace(entry.sourceText) !== trailingWhitespace(translatedText)) {
      issues.push({
        type: 'whitespace-trailing',
        detail: 'trailing whitespace differs from the source',
      });
    }
    return issues;
  },
};

/**
 * Line breaks must carry over exactly. Game strings use literal `\n` escape
 * sequences (see M14); a translation that drops one, adds one, or turns a
 * literal `\n` into a real newline renders wrong in-game. Literal escapes and
 * real newline characters are counted separately so a conversion between the
 * two is flagged even when the total stays the same.
 */
export const lineBreakParityCheck: LQACheck = {
  id: 'line-break-parity',
  defaultSeverity: 'blocking',
  defaultEnabled: true,
  run(entry, translatedText) {
    const issues: LQAIssue[] = [];

    const sourceLiteral = countMatches(entry.sourceText, LITERAL_NEWLINE_RE);
    const translatedLiteral = countMatches(translatedText, LITERAL_NEWLINE_RE);
    if (sourceLiteral !== translatedLiteral) {
      issues.push({
        type: 'line-break-mismatch',
        detail: `source has ${sourceLiteral} literal \\n escape(s), translation has ${translatedLiteral}`,
      });
    }

    const sourceReal = countMatches(entry.sourceText, REAL_NEWLINE_RE);
    const translatedReal = countMatches(translatedText, REAL_NEWLINE_RE);
    if (sourceReal !== translatedReal) {
      issues.push({
        type: 'line-break-mismatch',
        detail: `source has ${sourceReal} line break(s), translation has ${translatedReal}`,
      });
    }

    return issues;
  },
};

const CJK_EQUIVALENTS: Record<string, string[]> = {
  '.': ['。', '.'],
  '?': ['？', '?'],
  '!': ['！', '!'],
  ':': ['：', ':'],
};

const PUNCTUATION_EQUIVALENTS: Record<string, Record<string, string[]>> = {
  ja: CJK_EQUIVALENTS,
  ko: CJK_EQUIVALENTS,
  'zh-hans': CJK_EQUIVALENTS,
  'zh-hant': CJK_EQUIVALENTS,
};

const TERMINAL_MARKS = ['.', '…', '?', '!', ':', ';', '。', '？', '！', '：'];

/**
 * The text's terminal punctuation mark, or null. Trailing whitespace is
 * trimmed first (\s covers NBSP and narrow NBSP, so the French narrow space
 * before !?;: never affects the comparison; Spanish ¿¡ are sentence-initial
 * and never terminal). "..." normalizes to the ellipsis character.
 */
function terminalMark(text: string): string | null {
  const trimmed = text.replace(/\s+$/u, '');
  if (!trimmed) return null;
  const last = trimmed.slice(-1);
  if (trimmed.endsWith('...')) return '…';
  return TERMINAL_MARKS.includes(last) ? last : null;
}

/** Terminal punctuation must carry over, with per-language equivalents (CJK fullwidth forms). */
export const endPunctuationCheck: LQACheck = {
  id: 'end-punctuation',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  run(entry, translatedText, targetLanguage) {
    const sourceMark = terminalMark(entry.sourceText);
    const translatedMark = terminalMark(translatedText);
    if (sourceMark === translatedMark) return [];
    const equivalents = PUNCTUATION_EQUIVALENTS[targetLanguage.toLowerCase()] ?? {};
    if (sourceMark !== null && translatedMark !== null) {
      const accepted = equivalents[sourceMark] ?? [sourceMark];
      if (accepted.includes(translatedMark)) return [];
    }
    return [
      {
        type: 'end-punctuation-mismatch',
        detail: `terminal punctuation differs: source ends with ${
          sourceMark ? `"${sourceMark}"` : 'no mark'
        }, translation ends with ${translatedMark ? `"${translatedMark}"` : 'no mark'}`,
      },
    ];
  },
};

/** Repeated spaces in the translation that the source does not have. */
export const doubleSpacingCheck: LQACheck = {
  id: 'double-spacing',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  run(entry, translatedText) {
    const doubled = / {2,}/;
    if (doubled.test(translatedText) && !doubled.test(entry.sourceText)) {
      return [
        {
          type: 'double-spacing',
          detail: 'translation contains repeated spaces not present in the source',
        },
      ];
    }
    return [];
  },
};

/** Accidentally repeated word ("the the"). */
export const doubleWordsCheck: LQACheck = {
  id: 'double-words',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  run(_entry, translatedText) {
    const repeated = /(?<![\p{L}\p{N}])(\p{L}{2,})\s+\1(?![\p{L}\p{N}])/iu.exec(translatedText);
    if (repeated) {
      return [
        {
          type: 'double-words',
          detail: `word "${repeated[1]}" is repeated in the translation`,
        },
      ];
    }
    return [];
  },
};

/**
 * Translation identical to the source — likely returned untranslated.
 * Skips entries the trivial matchers would short-circuit anyway (numbers,
 * URLs, empty strings, …).
 */
export const untranslatedCheck: LQACheck = {
  id: 'untranslated',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  run(entry, translatedText, targetLanguage, ctx) {
    const source = entry.sourceText.trim();
    if (!source || source.toLowerCase() !== translatedText.trim().toLowerCase()) return [];
    const sourceLanguage = ctx.project?.sourceLanguage ?? 'en';
    if (sourceLanguage === targetLanguage) return [];
    if (runTrivialMatchers(entry.sourceText, sourceLanguage, targetLanguage) !== null) return [];
    return [
      {
        type: 'untranslated',
        detail: 'translation is identical to the source text',
      },
    ];
  },
};

export const PARITY_CHECKS: readonly LQACheck[] = [
  numberParityCheck,
  whitespaceParityCheck,
  lineBreakParityCheck,
  endPunctuationCheck,
  doubleSpacingCheck,
  doubleWordsCheck,
  untranslatedCheck,
];
