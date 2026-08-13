/**
 * Immutable EMA updates for a bucket's quality stats. The returned object is
 * shaped for FreewayLedgerStore.mergeStats, whose jsonb merge replaces the
 * gatePassByLanguage map wholesale — so the full updated map is returned,
 * never a single-language fragment.
 */
import type { FreewayBucketStats } from '../../storage/types.js';

const DEFAULT_ALPHA = 0.2;

export function updateGatePassEma(
  stats: FreewayBucketStats,
  language: string,
  passed: boolean,
  alpha: number = DEFAULT_ALPHA,
): FreewayBucketStats {
  const sample = passed ? 1 : 0;
  const current = stats.gatePassByLanguage?.[language];
  const next = typeof current === 'number' ? current * (1 - alpha) + sample * alpha : sample;
  return {
    ...stats,
    gatePassByLanguage: { ...stats.gatePassByLanguage, [language]: next },
  };
}
