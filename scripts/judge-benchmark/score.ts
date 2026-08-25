/**
 * Pure scoring logic for the judge-quality benchmark: compares verdicts.json
 * (what each candidate model said) against reference.json (what a human
 * grader said) and reduces the pair down to a ranking. No I/O, no provider
 * calls — mirrors lib.ts's own split (pure logic here, network/filesystem/
 * CLI in judge-benchmark.ts's `--score` mode).
 *
 * The central asymmetry this file has to respect: reference.json's `verdict`
 * is ground truth, NOT `arm`. Five items sit in the `clean` arm (the curated
 * corpus never injected a defect) but the human reviewer still failed them,
 * because the "known-good" reference text turned out to carry a real flaw
 * (two corrupted strings, three terminology inconsistencies — see
 * corpus.json's own `cleanFlaw` field, which flags this independently of
 * `arm`). A judge that flags one of those five is RIGHT, not trigger-happy —
 * every metric below is computed against `reference.verdict`, never against
 * `arm`, so those five items count as true positives like any other caught
 * defect. They are also surfaced as their own metric
 * (`cleanArmReferenceFailRecall`) because catching a flaw nobody labelled is
 * the hardest thing in the corpus and the most informative single number.
 */
import {
  DEFECT_TYPES,
  JUDGE_LANGS,
  modelKey,
  splitVerdictKey,
  type Arm,
  type DefectType,
  type JudgeLang,
  type VerdictRecord,
  type VerdictsFile,
} from './lib.js';

// ---------------------------------------------------------------------------
// reference.json shape
// ---------------------------------------------------------------------------

export interface ReferenceVerdict {
  lang: JudgeLang;
  entryId: string;
  arm: Arm;
  /** Non-null only on an `injected` item — the defect type it was designed to carry. */
  designedDefect: DefectType | null;
  verdict: 'pass' | 'fail';
  /** 0-100, higher is better — same scale as a model's own JudgeVerdict.score. */
  score: number;
  issues: string[];
}

export interface ReferenceFile {
  reference: string;
  rubric: string;
  /** Keyed `"<lang>:<entryId>"`. */
  verdicts: Record<string, ReferenceVerdict>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function referenceKey(lang: string, entryId: string): string {
  return `${lang}:${entryId}`;
}

/** Strict parse — reference.json is human-authored ground truth, so a malformed row should fail loudly, not silently drop an item from every model's denominator. */
export function parseReferenceFile(raw: unknown): ReferenceFile {
  const root = raw as { reference?: unknown; rubric?: unknown; verdicts?: unknown };
  if (typeof root.reference !== 'string' || !root.reference) throw new Error('reference.json: missing "reference"');
  if (typeof root.rubric !== 'string' || !root.rubric) throw new Error('reference.json: missing "rubric"');
  if (!isPlainObject(root.verdicts)) throw new Error('reference.json: missing verdicts{}');
  const verdicts: Record<string, ReferenceVerdict> = {};
  for (const [key, rawEntry] of Object.entries(root.verdicts)) {
    if (!isPlainObject(rawEntry)) throw new Error(`reference.json: verdicts["${key}"] is not an object`);
    const { lang, entryId, arm, designedDefect, verdict, score, issues } = rawEntry;
    if (lang !== 'fr' && lang !== 'ja') throw new Error(`reference.json: verdicts["${key}"] has an invalid lang (${JSON.stringify(lang)})`);
    if (typeof entryId !== 'string' || !entryId) throw new Error(`reference.json: verdicts["${key}"] is missing entryId`);
    if (key !== referenceKey(lang, entryId)) throw new Error(`reference.json: key "${key}" does not match its own lang/entryId ("${referenceKey(lang, entryId)}")`);
    if (arm !== 'clean' && arm !== 'injected') throw new Error(`reference.json: verdicts["${key}"] has an invalid arm (${JSON.stringify(arm)})`);
    if (designedDefect !== null && !(DEFECT_TYPES as readonly string[]).includes(designedDefect as string)) {
      throw new Error(`reference.json: verdicts["${key}"] has an invalid designedDefect (${JSON.stringify(designedDefect)})`);
    }
    if (verdict !== 'pass' && verdict !== 'fail') throw new Error(`reference.json: verdicts["${key}"] has an invalid verdict (${JSON.stringify(verdict)})`);
    if (typeof score !== 'number' || !Number.isFinite(score)) throw new Error(`reference.json: verdicts["${key}"] has an invalid score`);
    if (!Array.isArray(issues) || issues.some((i) => typeof i !== 'string')) throw new Error(`reference.json: verdicts["${key}"] has an invalid issues[]`);
    verdicts[key] = { lang, entryId, arm, designedDefect: designedDefect as DefectType | null, verdict, score, issues: issues as string[] };
  }
  return { reference: root.reference, rubric: root.rubric, verdicts };
}

// ---------------------------------------------------------------------------
// Observations: verdicts.json flattened to one row per (model, run, lang, entryId)
// ---------------------------------------------------------------------------

export interface Observation {
  run: number;
  lang: JudgeLang;
  entryId: string;
  record: VerdictRecord;
}

/**
 * Groups every verdict in a (possibly partial) verdicts.json by `provider::model`.
 * Tolerant by design: `verdictsFile` may be undefined (no collection has run
 * yet), and any key that doesn't parse or names a language outside JUDGE_LANGS
 * is skipped rather than thrown — a scorer must never crash on a file another
 * process is still writing to.
 */
export function groupObservationsByModel(verdictsFile: VerdictsFile | undefined): Map<string, Observation[]> {
  const out = new Map<string, Observation[]>();
  if (!verdictsFile) return out;
  for (const [key, record] of Object.entries(verdictsFile.verdicts)) {
    let parsed;
    try {
      parsed = splitVerdictKey(key);
    } catch {
      continue;
    }
    const { providerKey, modelId, run, lang, entryId } = parsed;
    if (!(JUDGE_LANGS as readonly string[]).includes(lang)) continue;
    const mk = modelKey(providerKey, modelId);
    const list = out.get(mk);
    const obs: Observation = { run, lang: lang as JudgeLang, entryId, record };
    if (list) list.push(obs);
    else out.set(mk, [obs]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-model metrics
// ---------------------------------------------------------------------------

export interface ModelMetrics {
  modelKey: string;
  /**
   * Distinct run numbers this model has ANY data for, ascending. A run
   * abandoned mid-collection (rpd cap, or the wall-clock rate-limit budget
   * in judge-benchmark.ts) still writes whatever items it completed before
   * stopping — see `VerdictsFile.incompleteRuns`, which names the reason
   * and the itemsDone/itemsTotal shortfall for exactly this case — so a
   * PARTIAL run's number already appears here with fewer observations, not
   * absent. A run's number is absent only when nothing was ever attempted.
   */
  runsPresent: number[];
  totalObservations: number;
  malformedCount: number;
  /** Fraction of observations with a usable (non-malformed) verdict — 1.0 means the model answered every item it was asked about. */
  coverage: number;
  /** Of the items the reference fails, the fraction the model also failed. */
  recall: number;
  /** Of the items the model failed, the fraction the reference also fails. */
  precision: number;
  f1: number;
  /** Of the items the reference passes, the fraction the model failed anyway — a judge that flags everything scores 1.0 here regardless of how good recall/precision look. */
  falsePositiveRate: number;
  /** Mean absolute error between the model's score and the reference's, over items where both produced a numeric score. Null when there is no overlap to compare (e.g. every observation was malformed). */
  scoreMae: number | null;
  /** Fraction of items with usable verdicts in >=2 of this model's runs that agree with each other. Null when the model has fewer than 2 comparable runs for any item (nothing to compare yet). */
  stability: number | null;
  /** Catch rate per designed defect type, pooled over every item carrying that defect. Null for a type with zero occurrences in the scored subset (defensive — the full corpus always has >=1 per type per language). */
  perDefectRecall: Record<DefectType, number | null>;
  /** Catch rate over just the reference-fail items that sit in the `clean` arm — the hardest, most interesting signal in the corpus. Null if the scored subset contains none of them (e.g. a single-language slice missing that particular entry). */
  cleanArmReferenceFailRecall: number | null;
  /** Raw numerator/denominator behind `cleanArmReferenceFailRecall`, kept alongside the ratio so a report can show "3/10 caught" rather than just "30.0%". */
  cleanArmReferenceFailCaught: number;
  cleanArmReferenceFailDenominator: number;
}

function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}

function emptyDefectTotals(): Record<DefectType, number> {
  return Object.fromEntries(DEFECT_TYPES.map((d) => [d, 0])) as Record<DefectType, number>;
}

/** Effective 3-way label for stability comparison — malformed is its own outcome, never conflated with a real pass or fail. */
function effectiveLabel(record: VerdictRecord): 'pass' | 'fail' | 'malformed' {
  return record.malformed ? 'malformed' : (record.verdict as 'pass' | 'fail');
}

function computeStability(observations: Observation[]): number | null {
  const byItem = new Map<string, Map<number, string>>();
  for (const obs of observations) {
    const itemKey = referenceKey(obs.lang, obs.entryId);
    let byRun = byItem.get(itemKey);
    if (!byRun) {
      byRun = new Map();
      byItem.set(itemKey, byRun);
    }
    byRun.set(obs.run, effectiveLabel(obs.record));
  }
  let comparable = 0;
  let consistent = 0;
  for (const byRun of byItem.values()) {
    if (byRun.size < 2) continue; // need >=2 runs recorded for THIS item to say anything about stability
    comparable++;
    if (new Set(byRun.values()).size === 1) consistent++;
  }
  return comparable > 0 ? round(consistent / comparable, 3) : null;
}

/**
 * Reduces one model's flattened observations against the reference to the
 * full metric set. Reused for the overall ranking and for each per-language
 * slice (called again with `observations` pre-filtered to one language) —
 * every field is well-defined for any subset, including an empty one.
 */
export function computeModelMetrics(mk: string, observations: Observation[], reference: Record<string, ReferenceVerdict>): ModelMetrics {
  const runsPresent = [...new Set(observations.map((o) => o.run))].sort((a, b) => a - b);

  let malformedCount = 0;
  let refFailTotal = 0;
  let caught = 0;
  let refPassTotal = 0;
  let falseAlarms = 0;
  let modelFailTotal = 0;
  let truePositives = 0;
  let maeSum = 0;
  let maeCount = 0;
  const defectDenom = emptyDefectTotals();
  const defectCaught = emptyDefectTotals();
  let cleanFailDenom = 0;
  let cleanFailCaught = 0;

  for (const obs of observations) {
    const ref = reference[referenceKey(obs.lang, obs.entryId)];
    if (!ref) continue; // defensive: an item outside the canonical 50 — never happens against the real corpus, but a scorer must not crash on it

    const refFail = ref.verdict === 'fail';
    const malformed = obs.record.malformed === true;
    if (malformed) malformedCount++;
    const modelFail = !malformed && obs.record.verdict === 'fail';

    if (refFail) {
      refFailTotal++;
      if (modelFail) caught++;
    } else {
      refPassTotal++;
      if (modelFail) falseAlarms++;
    }
    if (modelFail) {
      modelFailTotal++;
      if (refFail) truePositives++;
    }
    if (!malformed && obs.record.score !== undefined) {
      maeSum += Math.abs(obs.record.score - ref.score);
      maeCount++;
    }
    if (ref.designedDefect) {
      defectDenom[ref.designedDefect]++;
      if (modelFail) defectCaught[ref.designedDefect]++;
    }
    if (ref.arm === 'clean' && refFail) {
      cleanFailDenom++;
      if (modelFail) cleanFailCaught++;
    }
  }

  const total = observations.length;
  // Precision/recall use the standard 0-when-no-positive-predictions convention (0/0 := 0)
  // rather than NaN/undefined, so F1 stays a real number for every model, including one that
  // never predicts "fail" at all.
  const recall = refFailTotal > 0 ? caught / refFailTotal : 0;
  const precision = modelFailTotal > 0 ? truePositives / modelFailTotal : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = refPassTotal > 0 ? falseAlarms / refPassTotal : 0;

  return {
    modelKey: mk,
    runsPresent,
    totalObservations: total,
    malformedCount,
    coverage: total > 0 ? round(1 - malformedCount / total, 3) : 0,
    recall: round(recall, 3),
    precision: round(precision, 3),
    f1: round(f1, 3),
    falsePositiveRate: round(falsePositiveRate, 3),
    scoreMae: maeCount > 0 ? round(maeSum / maeCount, 1) : null,
    stability: computeStability(observations),
    perDefectRecall: Object.fromEntries(
      DEFECT_TYPES.map((d) => [d, defectDenom[d] > 0 ? round(defectCaught[d] / defectDenom[d], 3) : null]),
    ) as Record<DefectType, number | null>,
    cleanArmReferenceFailRecall: cleanFailDenom > 0 ? round(cleanFailCaught / cleanFailDenom, 3) : null,
    cleanArmReferenceFailCaught: cleanFailCaught,
    cleanArmReferenceFailDenominator: cleanFailDenom,
  };
}

/** F1 desc, then recall desc, then modelKey asc — makes the ranking fully deterministic even between models tied on every metric. */
export function compareModelMetrics(a: ModelMetrics, b: ModelMetrics): number {
  if (a.f1 !== b.f1) return b.f1 - a.f1;
  if (a.recall !== b.recall) return b.recall - a.recall;
  return a.modelKey < b.modelKey ? -1 : a.modelKey > b.modelKey ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Full report
// ---------------------------------------------------------------------------

export interface ScoreReport {
  totalReferenceItems: number;
  totalReferenceFails: number;
  /** `"<lang>:<entryId>"` for the reference-fail items whose arm is `clean` — computed from reference.json, never hardcoded. */
  cleanArmReferenceFailKeys: string[];
  /** `provider::model` keys with at least one observation in verdicts.json, sorted. */
  presentModels: string[];
  /** Expected candidate keys (if supplied by the caller) with zero observations — collection not yet started/finished for that model. */
  missingModels: string[];
  overall: ModelMetrics[];
  byLanguage: Record<JudgeLang, ModelMetrics[]>;
}

/**
 * The whole `--score` computation in one pure call: no I/O, safe to re-run on
 * a partial verdicts.json (or none at all — `undefined` is treated as "no
 * models scored yet", not an error).
 */
export function computeScoreReport(
  verdictsFile: VerdictsFile | undefined,
  referenceFile: ReferenceFile,
  expectedModelKeys: string[] = [],
): ScoreReport {
  const reference = referenceFile.verdicts;
  const cleanArmReferenceFailKeys = Object.entries(reference)
    .filter(([, v]) => v.arm === 'clean' && v.verdict === 'fail')
    .map(([key]) => key)
    .sort();

  const grouped = groupObservationsByModel(verdictsFile);
  const presentModels = [...grouped.keys()].sort();
  const missingModels = expectedModelKeys.filter((k) => !grouped.has(k)).sort();

  const overall = presentModels.map((mk) => computeModelMetrics(mk, grouped.get(mk)!, reference)).sort(compareModelMetrics);

  const byLanguage = {} as Record<JudgeLang, ModelMetrics[]>;
  for (const lang of JUDGE_LANGS) {
    byLanguage[lang] = presentModels
      .map((mk) => computeModelMetrics(mk, grouped.get(mk)!.filter((o) => o.lang === lang), reference))
      .sort(compareModelMetrics);
  }

  return {
    totalReferenceItems: Object.keys(reference).length,
    totalReferenceFails: Object.values(reference).filter((v) => v.verdict === 'fail').length,
    cleanArmReferenceFailKeys,
    presentModels,
    missingModels,
    overall,
    byLanguage,
  };
}
