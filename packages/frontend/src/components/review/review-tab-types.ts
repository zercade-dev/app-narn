/**
 * Shared types + pure helpers for the human Review tab, extracted from
 * ReviewTab.tsx so the tab component and its presentational sub-components (the
 * "View all" dialog and its rows) can share them without a circular import.
 * Pure — no React, no state, no side effects.
 */
import type { StringEntry, TranslationRecord } from '@zercade-dev/narn-shared';

export interface ReviewItem {
  entry: StringEntry;
  language: string;
  record: TranslationRecord;
}

/** Stable identity for a review card: the (entry, language) pair. */
export function itemKey(entryId: string, language: string): string {
  return `${entryId}::${language}`;
}

/** Immutable Set add of one or more keys (returns a fresh Set). */
export function withKeys(set: Set<string>, keys: readonly string[]): Set<string> {
  const next = new Set(set);
  for (const k of keys) next.add(k);
  return next;
}

/** Immutable Set delete of one or more keys (returns a fresh Set). */
export function withoutKeys(set: Set<string>, keys: readonly string[]): Set<string> {
  const next = new Set(set);
  for (const k of keys) next.delete(k);
  return next;
}

// checkId stamped on every LQA issue the LLM judge (M25) persists onto an
// entry's lqaResults. Mirrors the server's `LLM_JUDGE_CHECK_ID`
// (packages/server/src/modules/M25-judge-engine.ts) — the value is the
// persisted on-disk contract, so we read it here without importing server code.
const LLM_JUDGE_CHECK_ID = 'llm-judge';

// Issue type the judge persists for the corrected text it suggests on a FAIL
// verdict; its `detail` carries the suggested translation.
const JUDGE_SUGGESTION_TYPE = 'judge-suggestion';

/**
 * Normalize text the way the server normalizes a judge suggestion before
 * persisting it (M9 `sanitizeLLMText`): control chars and runs of whitespace
 * collapse to a single space, then trim. We apply this to the current
 * translation before comparing it against a stored `judge-suggestion` detail so
 * a suggestion that differs from the current text only by whitespace/control
 * characters is correctly treated as a no-op (not a real proposed change).
 */
function normalizeForSuggestionCompare(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * True when the most recent run left this translation's text unchanged: the
 * record has at least one prior version and its newest prior version's text is
 * identical to the current text (i.e. the latest run reproduced the prior
 * value). A record with no `previousVersions` is treated as changed/new — there
 * is no prior value to have matched.
 */
function runLeftTextUnchanged(record: TranslationRecord): boolean {
  const previous = record.previousVersions;
  if (!previous || previous.length === 0) return false;
  return previous[previous.length - 1].text === record.text;
}

/**
 * True when the LLM judge has NOT flagged this (entry, language) translation —
 * i.e. it is safe to approve as-is. Inspects the persisted judge issues (those
 * with `checkId === LLM_JUDGE_CHECK_ID` on `entry.lqaResults[language]`):
 *   (b) no judge finding — `persistVerdict` (M25) records a `judge-<type>` issue
 *       for every finding the judge raises; the presence of any such issue means
 *       the judge flagged a problem, so the item is not a clean pass, and
 *   (c) no `judge-suggestion` whose suggested text differs from the current
 *       translation — a differing suggestion is a proposed change the reviewer
 *       should look at. A suggestion equal to the current text is a no-op.
 *
 * Note on "no judge issues at all": a CLEAN judge pass leaves no issues behind
 * (the engine persists issues only for failing/flagged verdicts), so it is
 * indistinguishable from a never-reviewed entry. We treat that absence as a pass
 * — the whole point of this action is to approve translations the judge left
 * untouched; requiring a positive on-disk pass marker (which never exists) would
 * make the action inert for the common clean-pass case. The (a) unchanged guard
 * still keeps brand-new/edited translations out.
 */
function judgeVerdictPassedClean(
  entry: StringEntry,
  language: string,
  currentText: string,
): boolean {
  const issues = entry.lqaResults?.[language]?.issues ?? [];
  // The stored suggestion detail is whitespace-normalized by the server, so
  // compare against the normalized current text (computed once, only if needed).
  let normalizedCurrent: string | undefined;
  for (const issue of issues) {
    if (issue.checkId !== LLM_JUDGE_CHECK_ID) continue;
    if (issue.type === JUDGE_SUGGESTION_TYPE) {
      // (c) A suggestion that differs from the current text disqualifies; one
      // that is identical (a no-op, modulo whitespace normalization) is harmless.
      normalizedCurrent ??= normalizeForSuggestionCompare(currentText);
      if (issue.detail !== normalizedCurrent) return false;
    } else {
      // (b) Any other judge issue is a flagged finding → not a clean pass.
      return false;
    }
  }
  return true;
}

/**
 * The review-queue subset eligible for one-click "approve unchanged & passing":
 * the run left the text unchanged AND the AI judge passed it cleanly (see
 * {@link runLeftTextUnchanged} and {@link judgeVerdictPassedClean}).
 */
export function isUnchangedAndPassing(item: ReviewItem): boolean {
  return (
    runLeftTextUnchanged(item.record) &&
    judgeVerdictPassedClean(item.entry, item.language, item.record.text)
  );
}
