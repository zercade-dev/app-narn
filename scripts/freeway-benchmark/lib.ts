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

// ---------------------------------------------------------------------------
// Candidate runs: models that are not in the bundled snapshot yet. Their
// results go to a separate gitignored file and never reach the snapshot.
// ---------------------------------------------------------------------------

export const CANDIDATE_ENV_NAMES = ['GOOGLE_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY'] as const;
const CANDIDATE_PROVIDERS: ReadonlySet<string> = new Set(['google', 'groq', 'openrouter']);

export interface CandidateModel { id: string; rpm: number; useStructuredOutput?: boolean }
export type CandidateFile = Record<string, CandidateModel[]>;

/** Only the three keys a candidate run may use; every other env-file name is dropped. */
export function restrictCandidateEnv(env: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of CANDIDATE_ENV_NAMES) {
    if (env[name] !== undefined) out[name] = env[name];
  }
  return out;
}

export function parseCandidates(raw: unknown): CandidateFile {
  const root = (raw as { providers?: unknown } | null)?.providers;
  if (typeof root !== 'object' || root === null) throw new Error('candidates: missing providers{}');
  const out: CandidateFile = {};
  for (const [provider, models] of Object.entries(root)) {
    if (!CANDIDATE_PROVIDERS.has(provider)) throw new Error(`candidates: provider "${provider}" is not allowed`);
    if (!Array.isArray(models) || models.length === 0) throw new Error(`candidates: "${provider}" needs models[]`);
    out[provider] = models.map((m) => {
      const { id, rpm, useStructuredOutput } = m as Record<string, unknown>;
      if (typeof id !== 'string' || !id || typeof rpm !== 'number' || rpm <= 0) {
        throw new Error(`candidates: every "${provider}" model needs id + positive rpm`);
      }
      return { id, rpm, ...(typeof useStructuredOutput === 'boolean' ? { useStructuredOutput } : {}) };
    });
  }
  return out;
}

/** A copy of the snapshot holding only the candidate models, in a shape the cell plan can walk. */
export function candidateSnapshot<S extends { providers: Record<string, object> }>(snapshot: S, candidates: CandidateFile): S {
  const providers: Record<string, object> = {};
  for (const [providerKey, models] of Object.entries(candidates)) {
    const provider = snapshot.providers[providerKey];
    if (!provider) throw new Error(`candidates: provider "${providerKey}" is not in the snapshot`);
    providers[providerKey] = {
      ...provider,
      models: models.map(({ id, rpm, useStructuredOutput }) => ({
        id,
        limits: [{ window: 'rpm', limit: rpm }],
        ...(useStructuredOutput !== undefined ? { useStructuredOutput } : {}),
      })),
    };
  }
  return { ...snapshot, providers };
}

/** Detail file beside a candidate results file; both match the gitignored *.local.* shape. */
export function candidateDetailPath(resultsPath: string): string {
  if (!resultsPath.endsWith('.local.json')) throw new Error('candidate results path must end in .local.json');
  return `${resultsPath.slice(0, -'.local.json'.length)}.detail.local.json`;
}

export function candidateTranslationsPath(resultsPath: string): string {
  if (!resultsPath.endsWith('.local.json')) throw new Error('candidate results path must end in .local.json');
  return `${resultsPath.slice(0, -'.local.json'.length)}.translations.local.json`;
}

const HTTP_CEILING_PREFIX = 'HTTP ceiling reached for ';

export function httpCeilingMessage(host: string): string {
  return `${HTTP_CEILING_PREFIX}${host}`;
}

/** Providers wrap errors in their own text, so this matches anywhere in the message. */
export function isHttpCeilingMessage(message: string): boolean {
  return message.includes(HTTP_CEILING_PREFIX);
}

/** False when judging a whole cell would cross the ceiling, so its translations would be thrown away. */
export function judgeBudgetFits(args: {
  used: number; maxRequests: number | undefined; judgeRequests: number; ownTranslateRequests: number;
}): boolean {
  if (args.maxRequests === undefined) return true;
  return args.used + args.judgeRequests + args.ownTranslateRequests <= args.maxRequests;
}

// ---------------------------------------------------------------------------
// Speed pass: provider time per delivered string for the bundled models. The
// speed sidecar is separate from the judged results; only a reviewed copy is
// distilled onto the snapshot's `speedMsPerString`.
// ---------------------------------------------------------------------------

export interface SpeedCell { totalMs: number; strings: number; requests: number }
export interface SpeedResultsFile {
  cells: Record<string, SpeedCell>;
  /** Chunk indexes whose every string was delivered, by cell key. */
  completedChunks: Record<string, number[]>;
  /** Corpus ids already delivered (nonblank, no error), by cell key. */
  deliveredIds: Record<string, string[]>;
  /** Requests charged (or reserved) per quota window, keyed by the window's start. */
  spends: Record<string, number>;
}

export function emptySpeedResults(): SpeedResultsFile {
  return { cells: {}, completedChunks: {}, deliveredIds: {}, spends: {} };
}

function validSpeedCell(cell: unknown): cell is SpeedCell {
  if (typeof cell !== 'object' || cell === null) return false;
  const { totalMs, strings, requests } = cell as Record<string, unknown>;
  return (
    typeof totalMs === 'number' && Number.isFinite(totalMs) && totalMs >= 0 &&
    typeof strings === 'number' && Number.isInteger(strings) && strings >= 0 &&
    typeof requests === 'number' && Number.isInteger(requests) && requests >= 0
  );
}

/**
 * Milliseconds per delivered string for each model: all its languages' time,
 * failed and split calls included, over all its deliveries. A model with no
 * delivery has no entry; malformed cells are ignored.
 */
export function distillSpeed(file: SpeedResultsFile): Map<string, number> {
  const totals = new Map<string, { ms: number; strings: number }>();
  for (const [key, cell] of Object.entries(file.cells ?? {})) {
    if (!validSpeedCell(cell)) continue;
    const [providerKey, modelId] = splitKey(key);
    const modelKey = `${providerKey}::${modelId}`;
    const t = totals.get(modelKey) ?? { ms: 0, strings: 0 };
    t.ms += cell.totalMs;
    t.strings += cell.strings;
    totals.set(modelKey, t);
  }
  const out = new Map<string, number>();
  for (const [modelKey, t] of totals) {
    if (t.strings > 0) out.set(modelKey, t.ms / t.strings);
  }
  return out;
}

/** Sets `speedMsPerString` (rounded ms) on measured bundled models only; everything else is untouched. */
export function applySpeedDistilled(snapshot: unknown, speed: Map<string, number>): unknown {
  const copy = JSON.parse(JSON.stringify(snapshot)) as {
    providers: Record<string, { models: Array<Record<string, unknown> & { id: string }> }>;
  };
  for (const [providerKey, provider] of Object.entries(copy.providers)) {
    for (const model of provider.models) {
      const ms = speed.get(`${providerKey}::${model.id}`);
      if (ms === undefined || !Number.isFinite(ms) || ms <= 0) continue;
      model.speedMsPerString = Math.round(ms);
    }
  }
  return copy;
}

/** Reads a results file from disk defensively: anything missing or malformed becomes empty. */
export function parseSpeedResults(raw: unknown): SpeedResultsFile {
  const root = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SpeedResultsFile>;
  const record = <T>(v: unknown): Record<string, T> =>
    typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, T>) : {};
  return {
    cells: record<SpeedCell>(root.cells),
    completedChunks: record<number[]>(root.completedChunks),
    deliveredIds: record<string[]>(root.deliveredIds),
    spends: record<number>(root.spends),
  };
}

/**
 * Provider API key shapes — never let one reach a printed error line. Covers
 * the prefixed shapes (groq `gsk_…`, OpenAI/OpenRouter `sk-…`, Google
 * `AIza…`, GitHub `ghp_…`/`github_pat_…`) plus DeepL's prefix-less key: a
 * hex-and-dash UUID with an optional `:fx` free-tier suffix. That last
 * alternative is deliberately loose — it also swallows long hex digests, which
 * is the harmless direction for a redaction pass over error text.
 */
const KEY_SHAPE_RE =
  /\b(?:(?:gsk_|sk-[A-Za-z0-9-]|AIza|gh[pousr]_|github_pat_)[A-Za-z0-9_-]*|[0-9a-f][0-9a-f-]{29,}(?::fx)?)/g;
export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join('[redacted]');
  }
  return out.replace(KEY_SHAPE_RE, '[redacted]');
}
