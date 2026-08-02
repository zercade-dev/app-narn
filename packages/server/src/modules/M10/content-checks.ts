/**
 * Configurable content checks: glossary adherence, forbidden terms, and
 * user-authored regex assertions. All three are opt-in per project.
 */
import { runInNewContext } from 'node:vm';
import type { LQAIssue } from '@zercade-dev/narn-shared';
import { wordBoundaryRegExp, type LQACheck } from './types.js';

/**
 * Glossary terms matched in the source must appear (translated) in the
 * output. Both sides use Unicode word-boundary matching — a bare substring
 * match would accept "cat" inside "catalogue".
 *
 * Stays `defaultEnabled: false`: constant glossary terms are already masked
 * (M17) before translation, so for this project most terminology never
 * reaches the model as translatable text and the check would mostly re-flag
 * stylistic variants. Severity stays `warning` — only `blocking` issues feed
 * the auto-retry (see the UI description).
 */
export const glossaryAdherenceCheck: LQACheck = {
  id: 'glossary-adherence',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  needsGlossary: true,
  run(entry, translatedText, targetLanguage, ctx) {
    const issues: LQAIssue[] = [];
    for (const term of ctx.glossaryTerms) {
      if (!term.source) continue;
      const expected = term.translations[targetLanguage];
      if (typeof expected !== 'string' || expected.length === 0) continue;
      if (!wordBoundaryRegExp(term.source).test(entry.sourceText)) continue;
      if (!wordBoundaryRegExp(expected).test(translatedText)) {
        issues.push({
          type: 'glossary-term-missing',
          detail: `glossary term "${term.source}" should appear as "${expected}" in the translation`,
        });
      }
    }
    return issues;
  },
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : [];
}

/**
 * Forbidden term lists. Options:
 *  - `terms: string[]` — forbidden in every target language
 *  - `termsByLanguage: Record<string, string[]>` — per-language lists
 */
export const forbiddenTermsCheck: LQACheck = {
  id: 'forbidden-terms',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  run(_entry, translatedText, targetLanguage, ctx) {
    const byLanguage =
      ctx.options.termsByLanguage && typeof ctx.options.termsByLanguage === 'object'
        ? (ctx.options.termsByLanguage as Record<string, unknown>)[targetLanguage]
        : undefined;
    const terms = new Set(
      [...asStringArray(ctx.options.terms), ...asStringArray(byLanguage)].map((t) => t.trim()),
    );
    const issues: LQAIssue[] = [];
    for (const term of terms) {
      if (wordBoundaryRegExp(term).test(translatedText)) {
        issues.push({
          type: 'forbidden-term',
          detail: `forbidden term "${term}" found in translation`,
        });
      }
    }
    return issues;
  },
};

export interface RegexAssertion {
  pattern: string;
  flags?: string;
  mode: 'must-match' | 'must-not-match';
  message?: string;
  /** Restrict the assertion to these target languages. Absent ⇒ all languages. */
  languages?: string[];
}

// ReDoS guards: cap pattern and input size, sanitize flags, and run each
// test inside a vm context with a hard execution timeout.
const MAX_PATTERN_LENGTH = 200;
const MAX_TEXT_LENGTH = 5000;
const REGEX_TIMEOUT_MS = 100;
const ALLOWED_FLAGS = new Set(['i', 'm', 's', 'u']);

function parseAssertions(value: unknown): RegexAssertion[] {
  if (!Array.isArray(value)) return [];
  const assertions: RegexAssertion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    if (typeof a.pattern !== 'string' || a.pattern.length === 0) continue;
    assertions.push({
      pattern: a.pattern,
      flags: typeof a.flags === 'string' ? a.flags : undefined,
      mode: a.mode === 'must-not-match' ? 'must-not-match' : 'must-match',
      message: typeof a.message === 'string' && a.message ? a.message : undefined,
      languages: asStringArray(a.languages).length > 0 ? asStringArray(a.languages) : undefined,
    });
  }
  return assertions;
}

/** Returns the test outcome, or 'error' when the pattern is invalid / timed out. */
function safeRegexTest(assertion: RegexAssertion, text: string): boolean | 'error' {
  if (assertion.pattern.length > MAX_PATTERN_LENGTH) return 'error';
  const flags = [...(assertion.flags ?? '')].filter((f) => ALLOWED_FLAGS.has(f)).join('');
  let re: RegExp;
  try {
    re = new RegExp(assertion.pattern, flags);
  } catch {
    return 'error';
  }
  const input = text.slice(0, MAX_TEXT_LENGTH);
  try {
    return runInNewContext(
      're.test(text)',
      { re, text: input },
      { timeout: REGEX_TIMEOUT_MS },
    ) as boolean;
  } catch {
    return 'error'; // execution timeout
  }
}

/**
 * User-authored regex assertions. Options:
 *  - `assertions: RegexAssertion[]`
 */
export const regexAssertionsCheck: LQACheck = {
  id: 'regex-assertions',
  defaultSeverity: 'warning',
  defaultEnabled: false,
  run(_entry, translatedText, targetLanguage, ctx) {
    const issues: LQAIssue[] = [];
    for (const assertion of parseAssertions(ctx.options.assertions)) {
      if (assertion.languages && !assertion.languages.includes(targetLanguage)) continue;
      const matched = safeRegexTest(assertion, translatedText);
      if (matched === 'error') {
        issues.push({
          type: 'regex-config-error',
          detail: `regex assertion /${assertion.pattern.slice(0, 80)}/ is invalid, too long, or timed out`,
          severity: 'warning',
        });
        continue;
      }
      const failed = assertion.mode === 'must-match' ? !matched : matched;
      if (failed) {
        issues.push({
          type: 'regex-assertion-failed',
          detail:
            assertion.message ??
            `translation ${assertion.mode === 'must-match' ? 'does not match' : 'must not match'} /${assertion.pattern.slice(0, 80)}/`,
        });
      }
    }
    return issues;
  },
};
