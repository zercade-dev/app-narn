import type { LQAIssue } from '@zercade-dev/narn-shared';

/** Issue types that were blocking before issues carried an explicit severity. */
const LEGACY_BLOCKING_TYPES = new Set(['placeholder-missing', 'tag-mismatch', 'mask-mismatch']);

/**
 * True when the issue fails the LQA gate. Pipeline-produced issues carry an
 * explicit severity; legacy persisted results fall back to the historical
 * type set (everything except `overflow` was blocking).
 */
export function isBlockingIssue(issue: LQAIssue): boolean {
  if (issue.severity) return issue.severity === 'blocking';
  return LEGACY_BLOCKING_TYPES.has(issue.type);
}
