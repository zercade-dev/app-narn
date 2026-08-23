/**
 * Pure logic for the Freeway per-language benchmark: corpus parsing, mechanical
 * output checks, per-cell aggregation, and distillation of accumulated results
 * into the free-tier snapshot's per-language fields. No I/O, no provider calls
 * — everything here is unit-tested; the runner (freeway-benchmark.ts) owns the
 * network and the filesystem.
 */
import { createHash } from 'node:crypto';

export interface CorpusEntry { id: string; text: string; maxLength?: number; tone?: string }
export interface PerStringOutcome { id: string; mechPass: boolean; wrongLanguage: boolean; score?: number }
export interface CellResult {
  ts: number; corpusVersion: string; judgeModel: string; strings: number; requests: number;
  parseFailures: number; mechPassRate: number;
  /**
   * Rounded mean of this cell's judged scores. Mean, not median: live results
   * showed a generous judge saturates the median at 100, while tail failures
   * — the actual routing signal — still pull the mean down.
   */
  meanScore?: number;
  wrongLanguageCount: number;
  perStringScores: number[]; unsupported?: true;
}
export interface ResultsFile { corpusVersion: string; cells: Record<string, CellResult> }
export interface DistilledModel {
  langScores: Record<string, number>; langPassPriors: Record<string, number>;
  weakLanguages: string[]; blockedLanguages: string[];
}

export const BLOCKED_SCORE = 40;
export const WEAK_SCORE = 70;
export const BLOCKED_MECH = 0.4;
export const WEAK_MECH = 0.7;
export const WRONG_LANGUAGE_FRACTION = 0.25;

export function cellKey(providerKey: string, modelId: string, lang: string): string {
  return `${providerKey}::${modelId}::${lang}`;
}

export function parseCorpus(raw: unknown): CorpusEntry[] {
  const root = raw as { entries?: unknown };
  if (!Array.isArray(root.entries)) throw new Error('corpus: missing entries[]');
  return root.entries.map((e) => {
    const { id, text, maxLength, tone } = e as Record<string, unknown>;
    if (typeof id !== 'string' || typeof text !== 'string' || !id || !text) {
      throw new Error('corpus: every entry needs id + text');
    }
    return {
      id, text,
      ...(typeof maxLength === 'number' ? { maxLength } : {}),
      ...(typeof tone === 'string' ? { tone } : {}),
    };
  });
}

export function corpusVersion(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8);
}

/** Placeholders {…}, markup tags <…>, and newline escapes — order of appearance. */
export function formatTokens(text: string): string[] {
  const tokens = text.match(/\{[^{}]*\}|<[^<>]+>/g) ?? [];
  const newlines = text.match(/\n/g) ?? [];
  return [...tokens, ...newlines];
}

const SCRIPT_OF: Record<string, RegExp> = {
  'zh-hans': /\p{Script=Han}/u,
  'zh-hant': /\p{Script=Han}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ko: /\p{Script=Hangul}/u,
  th: /\p{Script=Thai}/u,
  ru: /\p{Script=Cyrillic}/u,
};
const NON_LATIN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;

export function mechanicalIssues(entry: CorpusEntry, translated: string, lang: string): string[] {
  const issues: string[] = [];
  if (translated.trim() === '') return ['empty'];
  for (const token of new Set(formatTokens(entry.text))) {
    const wanted = (entry.text.match(tokenPattern(token)) ?? []).length;
    const got = (translated.match(tokenPattern(token)) ?? []).length;
    if (got < wanted) issues.push(`missing-token:${token === '\n' ? '\\n' : token}`);
  }
  if (entry.maxLength !== undefined && translated.length > entry.maxLength) issues.push('over-limit');
  if (entry.text.length >= 20 && translated.trim().toLowerCase() === entry.text.trim().toLowerCase()) {
    issues.push('echo');
  }
  const letters = [...stripTokens(translated)].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length >= 4) {
    const expected = SCRIPT_OF[lang];
    if (expected) {
      const hits = letters.filter((ch) => expected.test(ch)).length;
      if (hits / letters.length < 0.5) issues.push('wrong-script');
    } else {
      const nonLatin = letters.filter((ch) => NON_LATIN.test(ch)).length;
      if (nonLatin / letters.length > 0.3) issues.push('wrong-script');
    }
  }
  return issues;
}

function tokenPattern(token: string): RegExp {
  return new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
}
function stripTokens(text: string): string {
  // Stripping runs to a fixpoint so token fragments cannot recombine into new token shapes.
  let stripped = text;
  for (;;) {
    const next = stripped.replace(/\{[^{}]*\}|<[^<>]+>/g, '');
    if (next === stripped) return next;
    stripped = next;
  }
}

/** Rounded arithmetic mean, or undefined for an empty list (nothing was scored). */
function roundedMean(scores: number[]): number | undefined {
  return scores.length === 0 ? undefined : Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

export function aggregateCell(args: {
  ts: number; corpusVer: string; judgeModel: string; requests: number; parseFailures: number;
  outcomes: PerStringOutcome[]; parseFailedStrings: number;
}): CellResult {
  const scored = args.outcomes.map((o) => o.score).filter((s): s is number => s !== undefined);
  const mean = roundedMean(scored);
  const strings = args.outcomes.length + args.parseFailedStrings;
  const mechPasses = args.outcomes.filter((o) => o.mechPass).length;
  return {
    ts: args.ts,
    corpusVersion: args.corpusVer,
    judgeModel: args.judgeModel,
    strings,
    requests: args.requests,
    parseFailures: args.parseFailures,
    mechPassRate: strings === 0 ? 0 : Number((mechPasses / strings).toFixed(2)),
    ...(mean !== undefined ? { meanScore: mean } : {}),
    wrongLanguageCount: args.outcomes.filter((o) => o.wrongLanguage).length,
    perStringScores: scored.map((s) => Math.round(s)),
  };
}

export function sortedResults(file: ResultsFile): ResultsFile {
  return {
    corpusVersion: file.corpusVersion,
    cells: Object.fromEntries(Object.entries(file.cells).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

/**
 * Backward compatibility for results.json cells written before `meanScore`
 * replaced `medianScore`: those cells still carry `perStringScores`, so
 * recompute the mean from them (identical to what a fresh `aggregateCell`
 * run now produces) rather than treating the cell as unmeasured. Only a
 * cell with neither falls back to its old `medianScore`.
 */
function effectiveMeanScore(cell: CellResult): number | undefined {
  if (cell.meanScore !== undefined) return cell.meanScore;
  const recomputed = roundedMean(cell.perStringScores);
  if (recomputed !== undefined) return recomputed;
  return (cell as unknown as { medianScore?: number }).medianScore;
}

export function distill(file: ResultsFile, registryCodes: string[]): Map<string, DistilledModel> {
  const registry = new Set(registryCodes);
  const out = new Map<string, DistilledModel>();
  for (const [key, cell] of Object.entries(file.cells)) {
    const [providerKey, modelId, lang] = splitKey(key);
    if (!registry.has(lang)) continue;
    const modelKey = `${providerKey}::${modelId}`;
    let d = out.get(modelKey);
    if (!d) {
      d = { langScores: {}, langPassPriors: {}, weakLanguages: [], blockedLanguages: [] };
      out.set(modelKey, d);
    }
    if (cell.unsupported) {
      d.blockedLanguages.push(lang);
      continue;
    }
    const meanScore = effectiveMeanScore(cell);
    if (meanScore === undefined) continue; // incomplete cell: not measured
    d.langScores[lang] = meanScore;
    d.langPassPriors[lang] = Number(cell.mechPassRate.toFixed(2));
    const blocked =
      meanScore < BLOCKED_SCORE ||
      cell.wrongLanguageCount >= Math.ceil(WRONG_LANGUAGE_FRACTION * cell.strings) ||
      cell.mechPassRate < BLOCKED_MECH;
    if (blocked) d.blockedLanguages.push(lang);
    else if (meanScore < WEAK_SCORE || cell.mechPassRate < WEAK_MECH) d.weakLanguages.push(lang);
  }
  for (const d of out.values()) {
    d.weakLanguages.sort();
    d.blockedLanguages.sort();
  }
  return out;
}

function splitKey(key: string): [string, string, string] {
  const first = key.indexOf('::');
  const last = key.lastIndexOf('::');
  return [key.slice(0, first), key.slice(first + 2, last), key.slice(last + 2)];
}

export function applyDistilled(snapshot: unknown, distilled: Map<string, DistilledModel>): unknown {
  const copy = JSON.parse(JSON.stringify(snapshot)) as {
    providers: Record<string, { models: Array<Record<string, unknown> & { id: string }> }>;
  };
  for (const [providerKey, provider] of Object.entries(copy.providers)) {
    for (const model of provider.models) {
      const d = distilled.get(`${providerKey}::${model.id}`);
      if (!d) continue;
      setOrDelete(model, 'langScores', Object.keys(d.langScores).length ? sortRecord(d.langScores) : undefined);
      setOrDelete(model, 'langPassPriors', Object.keys(d.langPassPriors).length ? sortRecord(d.langPassPriors) : undefined);
      setOrDelete(model, 'weakLanguages', d.weakLanguages.length ? d.weakLanguages : undefined);
      setOrDelete(model, 'blockedLanguages', d.blockedLanguages.length ? d.blockedLanguages : undefined);
    }
  }
  return copy;
}

function setOrDelete(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined) delete obj[key];
  else obj[key] = value;
}
function sortRecord(rec: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(rec).sort(([a], [b]) => (a < b ? -1 : 1)));
}
