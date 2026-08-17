/**
 * Storage arithmetic for the Beta-Binomial gate-pass estimator: decay, cap, and
 * the per-observation update. The prior and the posterior itself live in
 * scoring.ts; this file knows only how counts are kept.
 *
 * Counts are decayed on BOTH the read path (`loadBucketViews`) and the write
 * path (`recordGateOutcomes`) from the same stored `t`, so the two can never
 * disagree. Reading never persists: `t` is the age of the evidence, and reading
 * does not make evidence newer.
 *
 * Returned objects are shaped for FreewayLedgerStore.mergeStats, whose jsonb
 * merge replaces each top-level key wholesale — so the FULL updated maps are
 * returned, never a single-language fragment.
 */
import type { FreewayBucketStats, FreewayGatePassRecord } from '../../storage/types.js';

/**
 * Pseudo-observations the curated tier/band prior is worth. Gate outcomes are
 * recorded per translated string, so a batch delivers tens of observations at
 * once and this is overtaken almost immediately — it buys a cold start, not
 * lasting inertia. At 10, a bucket's first failure costs it half its batch
 * size rather than three quarters and a last-place ranking.
 */
export const PRIOR_STRENGTH = 10;

/**
 * Ceiling on a record's effective sample count — roughly "the last 200
 * strings". Without it a single large project cements a verdict permanently,
 * because attempts accumulate per string and nothing else bounds them.
 */
export const MAX_SAMPLES = 200;

/**
 * Evidence half-life. An idle record's counts halve every three days, which
 * regresses its posterior toward the curated prior and is what eventually gives
 * a written-off model another try. Cheap, because re-demotion after recovery
 * takes only a handful of failures.
 */
export const HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * `stats` is jsonb and can hold whatever a rollback or a hand-edit left behind,
 * including the bare per-language EMA numbers this estimator replaced. Anything
 * failing this guard is treated as absent, so the bucket scores its curated
 * prior until its next observation.
 */
export function isGatePassRecord(value: unknown): value is FreewayGatePassRecord {
  if (typeof value !== 'object' || value === null) return false;
  const { s, n, t } = value as Record<string, unknown>;
  if (typeof s !== 'number' || !Number.isFinite(s)) return false;
  if (typeof n !== 'number' || !Number.isFinite(n)) return false;
  if (typeof t !== 'number' || !Number.isFinite(t)) return false;
  // The float slop absorbs rounding from repeated decay scaling.
  return n >= 0 && s >= 0 && s <= n + 1e-9;
}

/**
 * Halve both counts for every HALF_LIFE_MS since `t`. Returns the very same
 * object when `now` exactly equals `t` — a true no-op, relied on by callers
 * that fold many records in a loop. When `t` is ahead of `now` (clock skew,
 * or an anchor that needs correcting), re-anchor to `now` without scaling the
 * counts, rather than leaving a future `t` in place — that would keep
 * `elapsed` negative or zero forever and freeze decay for the record.
 */
export function decayRecord(rec: FreewayGatePassRecord, now: number): FreewayGatePassRecord {
  const elapsed = now - rec.t;
  if (elapsed === 0) return rec;
  if (elapsed < 0) return { ...rec, t: now };
  const factor = Math.pow(2, -elapsed / HALF_LIFE_MS);
  return { s: rec.s * factor, n: rec.n * factor, t: now };
}

/** Scale a record down to at most MAX_SAMPLES attempts, preserving `s / n`. */
export function capRecord(rec: FreewayGatePassRecord): FreewayGatePassRecord {
  if (rec.n <= MAX_SAMPLES) return rec;
  const scale = MAX_SAMPLES / rec.n;
  return { s: rec.s * scale, n: MAX_SAMPLES, t: rec.t };
}

/** The display map the status route and Freeway panel read: observed `s / n` per language. */
function deriveDisplayRates(
  records: Record<string, FreewayGatePassRecord>,
): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const [language, rec] of Object.entries(records)) {
    if (isGatePassRecord(rec) && rec.n > 0) rates[language] = rec.s / rec.n;
  }
  return rates;
}

/**
 * Decay every language's record to `now`, dropping any that fails the guard.
 * The read path uses this to build a BucketView's stats; the result is never
 * written back.
 */
export function decayStats(stats: FreewayBucketStats, now: number): FreewayBucketStats {
  const source = stats.gatePassStats;
  if (typeof source !== 'object' || source === null) return stats;
  const decayed: Record<string, FreewayGatePassRecord> = {};
  for (const [language, rec] of Object.entries(source)) {
    if (isGatePassRecord(rec)) decayed[language] = decayRecord(rec, now);
  }
  return { ...stats, gatePassStats: decayed };
}

/**
 * Fold ONE gate outcome in: decay, then add, then cap. Capping after the
 * addition rather than before is what guarantees no stored record exceeds
 * MAX_SAMPLES, however a run happens to be batched.
 */
export function recordGatePass(
  stats: FreewayBucketStats,
  language: string,
  passed: boolean,
  now: number,
): FreewayBucketStats {
  const existing = stats.gatePassStats?.[language];
  const base: FreewayGatePassRecord = isGatePassRecord(existing)
    ? decayRecord(existing, now)
    : { s: 0, n: 0, t: now };
  const next = capRecord({ s: base.s + (passed ? 1 : 0), n: base.n + 1, t: now });
  const gatePassStats = { ...stats.gatePassStats, [language]: next };
  return { ...stats, gatePassStats, gatePassByLanguage: deriveDisplayRates(gatePassStats) };
}
