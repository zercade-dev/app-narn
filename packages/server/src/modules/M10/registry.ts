/**
 * Ordered registry of the built-in LQA pipeline checks, plus descriptor
 * metadata served to the config UI (`GET /api/lqa/checks`).
 */
import type { LQASeverity } from '@zercade-dev/narn-shared';
import {
  achievementLengthLimitCheck,
  lengthLimitCheck,
  overflowCheck,
  tagEqualityCheck,
} from './builtin-checks.js';
import {
  forbiddenTermsCheck,
  glossaryAdherenceCheck,
  regexAssertionsCheck,
} from './content-checks.js';
import { PARITY_CHECKS } from './parity-checks.js';
import type { LQACheck } from './types.js';

/**
 * Pseudo-check id for the M17 mask diagnostics computed in M9 and passed to
 * the gate as `extraIssues`. It is configurable (enabled/severity) like a
 * real check but its issues are produced by the engine, not the pipeline.
 */
export const MASK_INTEGRITY_CHECK_ID = 'mask-integrity';

/** Legacy-order first (tag, overflow) so persisted issue order is unchanged. */
export const ALL_CHECKS: readonly LQACheck[] = [
  tagEqualityCheck,
  overflowCheck,
  lengthLimitCheck,
  achievementLengthLimitCheck,
  glossaryAdherenceCheck,
  forbiddenTermsCheck,
  regexAssertionsCheck,
  ...PARITY_CHECKS,
];

export interface LQACheckDescriptor {
  id: string;
  defaultSeverity: LQASeverity;
  defaultEnabled: boolean;
}

export function describeChecks(): LQACheckDescriptor[] {
  const descriptors: LQACheckDescriptor[] = ALL_CHECKS.map((c) => ({
    id: c.id,
    defaultSeverity: c.defaultSeverity,
    defaultEnabled: c.defaultEnabled,
  }));
  descriptors.push({
    id: MASK_INTEGRITY_CHECK_ID,
    defaultSeverity: 'blocking',
    defaultEnabled: true,
  });
  return descriptors;
}
