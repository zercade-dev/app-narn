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

/**
 * A model must have returned a USABLE (non-malformed) verdict for at least
 * this fraction of the applicable corpus (50 items overall, 25 per
 * language) before its rate metrics are considered commensurable with a
 * fully-reviewed model's. Chosen as a round, clearly-stated cutoff — not
 * tuned — so a model interrupted after a handful of items (a rate-limit or
 * rpd cap mid-run) doesn't get ranked by F1 next to one that saw everything.
 * 0.8 = 40/50 overall, 20/25 per language.
 */
export const COMPARABLE_THRESHOLD = 0.8;

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
  /**
   * Fraction of observations with a usable (non-malformed) verdict — 1.0
   * means every attempt this model made came back parseable. Null when the
   * model has zero observations in this scope (e.g. a per-language slice
   * for a language it never touched) — there is nothing to rate.
   */
  coverage: number | null;
  /**
   * Distinct corpus items (lang, entryId) this model returned a USABLE
   * verdict for — the basis for `reviewedFraction`/`comparable`. Malformed
   * attempts do NOT count: an item the model was asked about but never
   * produced a parseable answer for taught us nothing about its judging,
   * the same way an item it was never asked about at all didn't.
   */
  itemsReviewed: number;
  /** Size of the corpus this call was scored against — 50 overall, 25 for a single-language slice. */
  totalItemsInScope: number;
  /** `itemsReviewed / totalItemsInScope`. */
  reviewedFraction: number;
  /** `reviewedFraction >= COMPARABLE_THRESHOLD`. A model below this reviewed too little of the corpus for its rate metrics to mean the same thing as a fully-reviewed model's — see `compareModelMetrics`, which ranks these AFTER every comparable model regardless of F1. */
  comparable: boolean;
  /**
   * Of the reference-fail items the model returned a usable verdict for,
   * the fraction it also failed. Null when the model returned zero usable
   * verdicts on any reference-fail item — there were no true fails to
   * measure recall against, not a recall of zero.
   */
  recall: number | null;
  /**
   * Of the items the model failed (a usable verdict, `verdict: 'fail'`),
   * the fraction the reference also fails. Null when the model never
   * predicted "fail" at all — no denominator to divide by.
   */
  precision: number | null;
  /** Null only when there's no usable data to compute EITHER precision or recall from (see each field) — otherwise a real number, treating a null half as 0 so a model with some data still ranks. */
  f1: number | null;
  /**
   * Of the reference-pass items the model returned a usable verdict for,
   * the fraction it failed anyway — a judge that flags everything scores
   * 1.0 here regardless of how good recall/precision look. Null when the
   * model never returned a usable verdict on any reference-pass item.
   */
  falsePositiveRate: number | null;
  /** Mean absolute error between the model's score and the reference's, over items where both produced a numeric score. Null when there is no overlap to compare (e.g. every observation was malformed). */
  scoreMae: number | null;
  /** Fraction of items with usable verdicts in >=2 of this model's runs that agree with each other. Null when the model has fewer than 2 comparable runs for any item (nothing to compare yet). */
  stability: number | null;
  /**
   * Catch rate per designed defect type, over items the model returned a
   * usable verdict for. Null means the model returned NO usable verdict
   * for any item of that type — it was never meaningfully tested on it,
   * which is a completely different fact from "tested and missed every
   * time" (0). The two must never render the same way.
   */
  perDefectRecall: Record<DefectType, number | null>;
  /**
   * Catch rate over just the reference-fail items that sit in the `clean`
   * arm — the hardest, most interesting signal in the corpus — restricted
   * to items the model returned a usable verdict for. Null if it returned
   * none (never meaningfully tested on this signal), never 0 for that case.
   */
  cleanArmReferenceFailRecall: number | null;
  /** Raw numerator/denominator behind `cleanArmReferenceFailRecall` — counts only usable verdicts, so this reads as "caught/seen", never "caught/corpus-total". */
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
 * slice (called again with `observations` pre-filtered to one language, and
 * `totalItemsInScope` set to that language's own corpus size) — every field
 * is well-defined for any subset, including an empty one.
 *
 * THE CENTRAL RULE: a malformed observation (`record.malformed === true`,
 * meaning the judge returned no verdict or one carrying `.error`) is not
 * "the model reviewed this and missed it" — it is "we don't know what this
 * model would have said." Every rate below is built from ONLY the
 * non-malformed observations, both numerator and denominator; a malformed
 * observation is skipped before it can inflate any denominator. This is
 * what makes "unseen" (no observation at all) and "seen but unparseable"
 * (malformed) collapse to the same correct outcome — null/n-a, never 0% —
 * everywhere a rate is computed. `malformedCount`/`coverage` are the one
 * place malformed observations DO count, because reporting the malformed
 * rate itself is the point of those two fields.
 */
export function computeModelMetrics(
  mk: string,
  observations: Observation[],
  reference: Record<string, ReferenceVerdict>,
  totalItemsInScope: number,
  comparableThreshold: number = COMPARABLE_THRESHOLD,
): ModelMetrics {
  const runsPresent = [...new Set(observations.map((o) => o.run))].sort((a, b) => a - b);

  let malformedCount = 0;
  const usableItemKeys = new Set<string>();
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

    if (obs.record.malformed === true) {
      malformedCount++;
      continue; // no usable verdict was returned — excluded from every rate below, per THE CENTRAL RULE above
    }
    usableItemKeys.add(referenceKey(obs.lang, obs.entryId));

    const refFail = ref.verdict === 'fail';
    const modelFail = obs.record.verdict === 'fail';

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
    if (obs.record.score !== undefined) {
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
  const recall = refFailTotal > 0 ? round(caught / refFailTotal, 3) : null;
  const precision = modelFailTotal > 0 ? round(truePositives / modelFailTotal, 3) : null;
  const falsePositiveRate = refPassTotal > 0 ? round(falseAlarms / refPassTotal, 3) : null;
  // F1 is null only when there's NOTHING to compute either half from (recall AND precision both
  // null — e.g. zero usable observations). Otherwise a null half contributes 0, same convention
  // as "no positive predictions" always has: a model with SOME usable data still gets a real F1.
  const f1 =
    recall === null && precision === null
      ? null
      : (() => {
          const p = precision ?? 0;
          const r = recall ?? 0;
          return p + r > 0 ? round((2 * p * r) / (p + r), 3) : 0;
        })();

  const itemsReviewed = usableItemKeys.size;
  const reviewedFraction = totalItemsInScope > 0 ? round(itemsReviewed / totalItemsInScope, 3) : 0;

  return {
    modelKey: mk,
    runsPresent,
    totalObservations: total,
    malformedCount,
    coverage: total > 0 ? round(1 - malformedCount / total, 3) : null,
    itemsReviewed,
    totalItemsInScope,
    reviewedFraction,
    comparable: reviewedFraction >= comparableThreshold,
    recall,
    precision,
    f1,
    falsePositiveRate,
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

/**
 * Comparable models first (see `COMPARABLE_THRESHOLD`) — a partial-coverage
 * model never outranks a fully-reviewed one just because its small sample
 * happened to score well. Within each group: F1 desc, then recall desc,
 * then modelKey asc. Null F1/recall (no usable data at all) sort as the
 * worst possible value, never crash the comparator.
 */
export function compareModelMetrics(a: ModelMetrics, b: ModelMetrics): number {
  if (a.comparable !== b.comparable) return a.comparable ? -1 : 1;
  const af1 = a.f1 ?? -1;
  const bf1 = b.f1 ?? -1;
  if (af1 !== bf1) return bf1 - af1;
  const ar = a.recall ?? -1;
  const br = b.recall ?? -1;
  if (ar !== br) return br - ar;
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
  comparableThreshold: number = COMPARABLE_THRESHOLD,
): ScoreReport {
  const reference = referenceFile.verdicts;
  const cleanArmReferenceFailKeys = Object.entries(reference)
    .filter(([, v]) => v.arm === 'clean' && v.verdict === 'fail')
    .map(([key]) => key)
    .sort();
  const totalItemsOverall = Object.keys(reference).length;
  const totalItemsByLang = Object.fromEntries(
    JUDGE_LANGS.map((lang) => [lang, Object.values(reference).filter((v) => v.lang === lang).length]),
  ) as Record<JudgeLang, number>;

  const grouped = groupObservationsByModel(verdictsFile);
  const presentModels = [...grouped.keys()].sort();
  const missingModels = expectedModelKeys.filter((k) => !grouped.has(k)).sort();

  const overall = presentModels
    .map((mk) => computeModelMetrics(mk, grouped.get(mk)!, reference, totalItemsOverall, comparableThreshold))
    .sort(compareModelMetrics);

  const byLanguage = {} as Record<JudgeLang, ModelMetrics[]>;
  for (const lang of JUDGE_LANGS) {
    byLanguage[lang] = presentModels
      .map((mk) => computeModelMetrics(mk, grouped.get(mk)!.filter((o) => o.lang === lang), reference, totalItemsByLang[lang], comparableThreshold))
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
