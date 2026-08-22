/**
 * Freeway per-language benchmark runner.
 *
 * Drives every candidate free-tier provider/model against the local benchmark
 * corpus for a set of target languages, judges the output with Gemini, and
 * accumulates per-(provider, model, language) "cell" results into
 * `freeway-benchmark/results.json` (committed) plus a per-string detail file
 * (gitignored, local-only, useful for spot-checking actual output text).
 * `--distill` folds the accumulated results into the bundled free-tier
 * snapshot's per-language fields. All the pure logic (corpus parsing,
 * mechanical checks, aggregation, distillation) lives in
 * `freeway-benchmark/lib.ts`; this file owns CLI parsing, env intake, module
 * driving, judging, pacing, and persistence.
 *
 * Network calls only happen in the default (neither --plan nor --distill)
 * mode. The four provider-module factories are loaded via a runtime
 * `import()` of their *source* file (relative path, not the package name):
 * the workspace-root `package.json` doesn't depend on the module/shared workspace
 * packages (only `packages/server` and `packages/frontend` do), so a bare
 * `@zercade-dev/narn-module-google`-style import never resolves from
 * `scripts/`. Loading the source directly — the same fix
 * `validate-recommended-models.ts` already uses for `@zercade-dev/narn-shared`
 * ("to work without a built packages/shared/dist") — sidesteps that and keeps
 * `--plan`/`--distill` fully build-free. The one real prerequisite is that
 * `packages/shared` itself must be built (`pnpm --filter @zercade-dev/narn-shared
 * build`, or `pnpm build`) before a REAL run, because each module's own
 * source imports `@zercade-dev/narn-shared` *by package name* internally —
 * that's a fixed fact of the module packages, not something this script can
 * route around. A clear error is printed if that prerequisite is missing.
 *
 * Usage:
 *   pnpm exec tsx scripts/freeway-benchmark.ts --plan --langs ja,ko
 *   pnpm exec tsx scripts/freeway-benchmark.ts --langs ja,ko --providers google,groq --max-requests 40
 *   pnpm exec tsx scripts/freeway-benchmark.ts --refresh --langs ja
 *   pnpm exec tsx scripts/freeway-benchmark.ts --distill
 *
 * Keys are read from scripts/.env (override with NARN_ENV_FILE) — never
 * accepted on argv, never printed. Only name presence/absence is ever logged.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  aggregateCell,
  applyDistilled,
  cellKey,
  corpusVersion,
  distill,
  mechanicalIssues,
  parseCorpus,
  sortedResults,
  type CellResult,
  type CorpusEntry,
  type PerStringOutcome,
  type ResultsFile,
} from './freeway-benchmark/lib.js';

import {
  chunkArray,
  getFreeTierSnapshot,
  isParseFailureMessage,
  LANGUAGE_REGISTRY,
  PSEUDO_LANGUAGE_CODE,
  toErrorMessage,
} from '../packages/shared/src/index.js';
import type {
  FreeTierModel,
  FreeTierProvider,
  FreeTierSnapshot,
  JudgeItem,
  JudgeVerdict,
  TranslationJob,
  TranslationModule,
  TranslationResult,
} from '../packages/shared/src/index.js';

import googleManifest from '../modules/google/manifest.json' with { type: 'json' };
import openrouterManifest from '../modules/openrouter/manifest.json' with { type: 'json' };
import groqManifest from '../modules/groq/manifest.json' with { type: 'json' };
import deeplManifest from '../modules/deepl/manifest.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Paths + constants
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BENCH_DIR = path.join(SCRIPT_DIR, 'freeway-benchmark');
const CORPUS_PATH = path.join(BENCH_DIR, 'corpus.json');
const CORPUS_LOCAL_PATH = path.join(BENCH_DIR, 'corpus.local.json');
const RESULTS_PATH = path.join(BENCH_DIR, 'results.json');
const DETAIL_PATH = path.join(BENCH_DIR, 'results-detail.local.json');
const FREE_TIER_DATA_PATH = path.join(
  SCRIPT_DIR,
  '..',
  'packages',
  'shared',
  'src',
  'freeway',
  'free-tier-data.json',
);

/** Relative *source* entry per candidate provider — see the file header. */
const MODULE_ENTRY: Record<string, string> = {
  google: '../modules/google/src/index.js',
  openrouter: '../modules/openrouter/src/index.js',
  groq: '../modules/groq/src/index.js',
  deepl: '../modules/deepl/src/index.js',
};

/** Manifests are plain JSON — imported directly so env-name lookup never depends on a build. */
const CANDIDATE_MANIFESTS: Record<string, { requiredEnvVars?: string[] }> = {
  google: googleManifest,
  openrouter: openrouterManifest,
  groq: groqManifest,
  deepl: deeplManifest,
};

const JUDGE_PROVIDER_KEY = 'google';
/**
 * The judge model is deliberately NOT gemini-flash-latest.
 * That model's snapshot limits are rpm 5 / rpd 20 — at the judge layer's own
 * hard cap of 10 items/request (see JUDGE_BATCH_SIZE) a single 24-string cell
 * already costs ~3 judge requests, so rpd 20 covers roughly 6 cells/day
 * against a multi-hundred-cell plan. gemma-4-31b-it (rpm 30, rpd 14400, tier
 * 3) has the headroom to judge a full wave in one run. One judge model for
 * every cell, so every score in results.json is comparable.
 */
const JUDGE_MODEL_ID = 'gemma-4-31b-it';
const TRANSLATE_CHUNK_SIZE = 12;
/**
 * The judge layer hard-caps its own batch at 10 regardless of what's passed
 * in (`module-features.ts`'s `judgeTranslations`: `resolveBatchSize(...,
 * {default: 10, cap: 10})`), so chunking externally at the SAME size makes
 * each of our `ctx.judge(chunk)` calls map 1:1 to one real provider request
 * (nominal — an internal transient retry can still add an invisible extra
 * one) — which both the per-request pacing and the `ceil(items/10)` spend
 * accounting below depend on.
 */
const JUDGE_BATCH_SIZE = 10;
const PACING_FLOOR_MS = 1500;
/**
 * Provider API key shapes — never let one reach a printed error line. Covers
 * the prefixed shapes (groq `gsk_…`, OpenAI/OpenRouter `sk-…`, Google
 * `AIza…`) plus DeepL's prefix-less key: a hex-and-dash UUID with an optional
 * `:fx` free-tier suffix. That last alternative is deliberately loose — it
 * also swallows long hex digests, which is the harmless direction for a
 * redaction pass over error text.
 */
const KEY_SHAPE_RE = /\b(?:(?:gsk_|sk-[A-Za-z0-9-]|AIza)[A-Za-z0-9_-]*|[0-9a-f][0-9a-f-]{29,}(?::fx)?)/g;
function redact(text: string): string {
  return text.replace(KEY_SHAPE_RE, '[redacted]');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `Usage: tsx scripts/freeway-benchmark.ts [options]

  --langs a,b,c       Target language codes (default: every LANGUAGE_REGISTRY
                       code except 'en' and the synthetic 'pseudo-test').
  --providers a,b      Restrict to these snapshot provider keys (default:
                       every candidate provider, i.e. everything except
                       'copilot').
  --max-requests N     Per-provider request ceiling for this run. For
                       google this counts its OWN translate requests PLUS
                       every judge request (judging always runs through
                       google, regardless of --providers).
  --refresh            Re-run cells that already exist in results.json
                       (default: skip them — the run is crash-resumable).
  --plan               Print the cell plan + key-presence report and exit.
                       No network calls.
  --distill            Fold results.json into the bundled free-tier snapshot
                       (free-tier-data.json) and print coverage. No network
                       calls.
  --help, -h            Print this usage and exit 0.
`;

interface CliArgs {
  langs?: string[];
  providers?: string[];
  maxRequests?: number;
  refresh: boolean;
  plan: boolean;
  distill: boolean;
}

function usageError(message: string): never {
  console.error(USAGE);
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { refresh: false, plan: false, distill: false };
  const next = (i: number, flag: string): string => {
    const value = argv[i];
    if (value === undefined) usageError(`${flag} requires a value`);
    return value;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      case '--langs':
        args.langs = next(++i, '--langs')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--providers':
        args.providers = next(++i, '--providers')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--max-requests': {
        const raw = next(++i, '--max-requests');
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) usageError(`--max-requests must be a positive number (got "${raw}")`);
        args.maxRequests = n;
        break;
      }
      case '--refresh':
        args.refresh = true;
        break;
      case '--plan':
        args.plan = true;
        break;
      case '--distill':
        args.distill = true;
        break;
      default:
        usageError(`Unknown flag: ${arg}`);
    }
  }
  if (args.langs?.length === 0) usageError('--langs must name at least one language');
  if (args.providers?.length === 0) usageError('--providers must name at least one provider');
  return args;
}

// ---------------------------------------------------------------------------
// Env intake — pattern copied from validate-recommended-models.ts. Keys are
// read ONLY here, at runtime, off argv/logs entirely: only name
// presence/absence is ever printed or returned to a caller that logs.
// ---------------------------------------------------------------------------

function readEnvFile(filePath: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(filePath, 'utf8');
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

interface KeyReportRow {
  providerKey: string;
  envVar: string;
  present: boolean;
}

/** Which candidate providers have a usable key, keyed by snapshot provider key. Values, never logged. */
function buildKeyReport(
  snapshot: FreeTierSnapshot,
  env: Record<string, string>,
): { report: KeyReportRow[]; apiKeys: Record<string, string> } {
  const report: KeyReportRow[] = [];
  const apiKeys: Record<string, string> = {};
  for (const providerKey of Object.keys(snapshot.providers)) {
    if (providerKey === 'copilot') continue; // no local key path — always excluded
    const manifest = CANDIDATE_MANIFESTS[providerKey];
    const envVar = manifest?.requiredEnvVars?.[0];
    if (!envVar) {
      report.push({ providerKey, envVar: '(no manifest registered for this provider)', present: false });
      continue;
    }
    const value = env[envVar];
    const present = typeof value === 'string' && value.length > 0;
    report.push({ providerKey, envVar, present });
    if (present) apiKeys[providerKey] = value;
  }
  return { report, apiKeys };
}

// ---------------------------------------------------------------------------
// Corpus: committed + optional local, merged. corpusVersion is always the
// hash of the COMMITTED file's bytes — local strings never change the
// recorded corpus identity, even though their scores flow into the same
// aggregates.
// ---------------------------------------------------------------------------

function readCorpus(): { entries: CorpusEntry[]; committedVersion: string; localCount: number } {
  let committedRaw: string;
  try {
    committedRaw = readFileSync(CORPUS_PATH, 'utf8');
  } catch (err) {
    console.error(`Cannot read committed corpus at ${CORPUS_PATH}: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
  let committedEntries: CorpusEntry[];
  try {
    committedEntries = parseCorpus(JSON.parse(committedRaw));
  } catch (err) {
    console.error(`Committed corpus is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
  const committedVersion = corpusVersion(committedRaw);

  let localEntries: CorpusEntry[] = [];
  if (existsSync(CORPUS_LOCAL_PATH)) {
    try {
      localEntries = parseCorpus(JSON.parse(readFileSync(CORPUS_LOCAL_PATH, 'utf8')));
    } catch (err) {
      console.error(`Local corpus (${CORPUS_LOCAL_PATH}) is invalid: ${redact(toErrorMessage(err))}`);
      process.exit(1);
    }
  }

  const seenIds = new Set(committedEntries.map((e) => e.id));
  for (const e of localEntries) {
    if (seenIds.has(e.id)) {
      console.error(`corpus.local.json: id "${e.id}" collides with an existing corpus entry`);
      process.exit(1);
    }
    seenIds.add(e.id);
  }

  return { entries: [...committedEntries, ...localEntries], committedVersion, localCount: localEntries.length };
}

// ---------------------------------------------------------------------------
// results.json / results-detail.local.json persistence
// ---------------------------------------------------------------------------

function readResultsFile(): ResultsFile | undefined {
  if (!existsSync(RESULTS_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as ResultsFile;
  } catch (err) {
    console.error(`results.json is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

function writeResultsFile(file: ResultsFile): void {
  writeFileSync(RESULTS_PATH, JSON.stringify(sortedResults(file), null, 2) + '\n');
}

interface DetailEntry {
  id: string;
  translated: string;
  score?: number;
  verdict?: 'pass' | 'fail';
  issues?: string[];
}
type DetailFile = Record<string, DetailEntry[]>;

function readDetailFile(): DetailFile {
  if (!existsSync(DETAIL_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DETAIL_PATH, 'utf8')) as DetailFile;
  } catch {
    return {}; // local-only diagnostic file: corrupt/missing is non-fatal, just start fresh
  }
}

function writeDetailFile(file: DetailFile): void {
  const sorted: DetailFile = Object.fromEntries(Object.entries(file).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(DETAIL_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rpmLimit(snapModel: FreeTierModel | undefined, provider: FreeTierProvider | undefined): number | undefined {
  const own = snapModel?.limits.find((l) => l.window === 'rpm')?.limit;
  if (own !== undefined) return own;
  return provider?.sharedLimits?.find((l) => l.window === 'rpm')?.limit;
}

async function paceAfterCall(snapModel: FreeTierModel | undefined, provider: FreeTierProvider | undefined): Promise<void> {
  const rpm = rpmLimit(snapModel, provider);
  const delay = rpm !== undefined && rpm > 0 ? Math.max(PACING_FLOOR_MS, Math.ceil(60000 / rpm)) : PACING_FLOOR_MS;
  await sleepMs(delay);
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

type Classification =
  | { kind: 'cooling'; message: string }
  | { kind: 'auth-failed'; message: string }
  | { kind: 'unsupported' }
  | { kind: 'other'; message: string };

function classify(message: string, isDeepl: boolean): Classification {
  if (/429|rate.?limit|quota|resource.?exhausted/i.test(message)) return { kind: 'cooling', message };
  if (/401|403|api.?key|unauthorized/i.test(message)) return { kind: 'auth-failed', message };
  if (isDeepl && /target_lang|not supported|unsupported/i.test(message)) return { kind: 'unsupported' };
  return { kind: 'other', message };
}

// ---------------------------------------------------------------------------
// Provider/run state
// ---------------------------------------------------------------------------

type DeferReason =
  | 'cooling'
  | 'auth-failed'
  | 'budget-capped'
  | 'parse-failed'
  | 'judge-failed'
  | 'judge-cooling'
  | 'error';

interface ProviderStats {
  requestsMade: number;
  cellsCompleted: number;
  cellsUnsupported: number;
  cellsDeferred: Partial<Record<DeferReason, number>>;
}

function newStats(): ProviderStats {
  return { requestsMade: 0, cellsCompleted: 0, cellsUnsupported: 0, cellsDeferred: {} };
}

interface RunContext {
  corpus: CorpusEntry[];
  entryById: Map<string, CorpusEntry>;
  committedCorpusVersion: string;
  apiKeys: Record<string, string>;
  maxRequests: number | undefined;
  refresh: boolean;
  resultsFile: ResultsFile;
  detailFile: DetailFile;
  providerState: Map<string, 'cooling' | 'auth-failed' | 'budget-capped'>;
  providerStats: Map<string, ProviderStats>;
  moduleCache: Map<string, TranslationModule>;
  judge: (items: JudgeItem[]) => Promise<JudgeVerdict[]>;
  judgeSnapModel: FreeTierModel;
  judgeProvider: FreeTierProvider;
  hadUnexpectedFailure: boolean;
}

function getStats(ctx: RunContext, providerKey: string): ProviderStats {
  let s = ctx.providerStats.get(providerKey);
  if (!s) {
    s = newStats();
    ctx.providerStats.set(providerKey, s);
  }
  return s;
}

/** Quota/budget reasons are expected outcomes — everything else trips the exit code. */
const QUOTA_DEFER_REASONS: ReadonlySet<DeferReason> = new Set(['cooling', 'auth-failed', 'budget-capped', 'judge-cooling']);

function deferCell(ctx: RunContext, providerKey: string, reason: DeferReason): void {
  const stats = getStats(ctx, providerKey);
  stats.cellsDeferred[reason] = (stats.cellsDeferred[reason] ?? 0) + 1;
  if (!QUOTA_DEFER_REASONS.has(reason)) {
    ctx.hadUnexpectedFailure = true;
  }
}

function writeCell(ctx: RunContext, key: string, cell: CellResult, detail: DetailEntry[]): void {
  ctx.resultsFile.cells[key] = cell;
  writeResultsFile(ctx.resultsFile);
  ctx.detailFile[key] = detail;
  writeDetailFile(ctx.detailFile);
}

// ---------------------------------------------------------------------------
// Module construction (lazy, dynamic — see file header for why)
// ---------------------------------------------------------------------------

async function loadFactory(providerKey: string): Promise<(config: Record<string, unknown>) => TranslationModule> {
  const entry = MODULE_ENTRY[providerKey];
  if (!entry) throw new Error(`no module entry registered for provider "${providerKey}"`);
  try {
    const imported = (await import(entry)) as { default: (config: Record<string, unknown>) => TranslationModule };
    return imported.default;
  } catch (err) {
    throw new Error(
      `failed to load provider module "${providerKey}": ${toErrorMessage(err)}\n` +
        '  packages/shared must be built first — run `pnpm --filter @zercade-dev/narn-shared build` ' +
        '(or `pnpm build`) from the workspace root, then retry.',
    );
  }
}

async function getOrCreateModule(
  ctx: RunContext,
  providerKey: string,
  modelId: string,
  snapModel: FreeTierModel,
): Promise<TranslationModule> {
  const cacheKey = `${providerKey}::${modelId}`;
  const cached = ctx.moduleCache.get(cacheKey);
  if (cached) return cached;
  const factory = await loadFactory(providerKey);
  const apiKey = ctx.apiKeys[providerKey];
  const config: Record<string, unknown> =
    providerKey === 'deepl'
      ? { apiKey } // DeepL is classical MT, not an AI-SDK module — no maxRetries field on DeepLConfig.
      : {
          model: modelId,
          apiKey,
          // Mirrors freewayModuleOverrides (M32/bucket-source.ts): the AI SDK's own internal
          // retry loop (default 2, i.e. 3 attempts) would otherwise burn free-tier quota
          // silently and undercount `requests`/`--max-requests` by up to 3x on any failing call.
          maxRetries: 0,
          ...(snapModel.useStructuredOutput !== undefined ? { useStructuredOutput: snapModel.useStructuredOutput } : {}),
        };
  const mod = factory(config);
  ctx.moduleCache.set(cacheKey, mod);
  return mod;
}

// ---------------------------------------------------------------------------
// Judging
//
// `judgeTranslations` (shared `runJudgeFeature` + `splitAndRetry`,
// packages/shared/src/ai-sdk-provider/{llm-module,module-features}.ts) NEVER
// throws: every failure class — parse failure at singleton, 429, 401/403,
// transport error — resolves as a `JudgeVerdict` carrying `.error` instead
// ("so one bad batch never aborts a judge run"). There is no
// `rethrowIfAuthOrRateLimit` anywhere on this path (unlike translate, which
// does rethrow). So there is nothing to catch here, and no retry to run
// ourselves — the shared layer already retries transients once and halves
// on a parse failure, internally, below its own hard 10-item batch cap.
//
// What we DO own: detecting that a returned verdict is bad (the shared layer
// reports failure via data, not control flow) and deciding what that means
// for the cell/run. A cell with ANY unjudged or errored item must NOT be
// written (stays absent, resumable) — writing it would let `distill()`
// silently drop it forever (`medianScore: undefined`) with no error and no
// way to retry short of `--refresh` on the whole run.
// ---------------------------------------------------------------------------

type JudgeRunOutcome =
  | { kind: 'ok'; verdicts: JudgeVerdict[] }
  | { kind: 'budget-capped' }
  | { kind: 'cooling'; message: string }
  | { kind: 'failed'; message: string };

async function runJudge(ctx: RunContext, items: JudgeItem[]): Promise<JudgeRunOutcome> {
  if (items.length === 0) return { kind: 'ok', verdicts: [] };
  const judgeStats = getStats(ctx, JUDGE_PROVIDER_KEY);
  const verdicts: JudgeVerdict[] = [];
  // Chunk at the shared layer's own hard cap (JUDGE_BATCH_SIZE) so each call
  // here is one real provider request — see the constant's comment.
  for (const chunk of chunkArray(items, JUDGE_BATCH_SIZE)) {
    if (ctx.maxRequests !== undefined && judgeStats.requestsMade >= ctx.maxRequests) {
      return { kind: 'budget-capped' };
    }
    const chunkVerdicts = await ctx.judge(chunk);
    judgeStats.requestsMade += 1;
    await paceAfterCall(ctx.judgeSnapModel, ctx.judgeProvider);
    verdicts.push(...chunkVerdicts);
  }

  const verdictByEntry = new Map(verdicts.map((v) => [v.entryId, v]));
  const badItem = items.find((item) => {
    const v = verdictByEntry.get(item.entryId);
    return v === undefined || v.error !== undefined;
  });
  if (badItem) {
    const message = redact(verdictByEntry.get(badItem.entryId)?.error ?? 'judge returned no verdict for this item');
    const classification = classify(message, false);
    // 429/quota-ish: judging is dead for every remaining cell of every
    // provider (they all share this one judge), so translating them further
    // would only waste candidate quota on cells that can never be written.
    if (classification.kind === 'cooling') return { kind: 'cooling', message };
    // Any other judge error (including an auth-shaped one): defer just this
    // cell and keep going — a single provider's transient/parse failure
    // doesn't mean the judge is unusable for the next cell.
    return { kind: 'failed', message };
  }
  return { kind: 'ok', verdicts };
}

// ---------------------------------------------------------------------------
// Classification handling shared by both failure sources (a thrown error,
// or a resolved call whose every result carries .error).
// ---------------------------------------------------------------------------

function applyClassification(
  ctx: RunContext,
  providerKey: string,
  key: string,
  classification: Classification,
  requestsSoFar: number,
): void {
  if (classification.kind === 'cooling') {
    console.error(`[${key}] rate-limited: ${classification.message} — "${providerKey}" cooling for the rest of this run`);
    ctx.providerState.set(providerKey, 'cooling');
    deferCell(ctx, providerKey, 'cooling');
    return;
  }
  if (classification.kind === 'auth-failed') {
    console.error(`[${key}] auth failed: ${classification.message} — "${providerKey}" marked auth-failed for the rest of this run`);
    ctx.providerState.set(providerKey, 'auth-failed');
    deferCell(ctx, providerKey, 'auth-failed');
    return;
  }
  if (classification.kind === 'unsupported') {
    const cell: CellResult = {
      ts: Date.now(),
      corpusVersion: ctx.committedCorpusVersion,
      judgeModel: JUDGE_MODEL_ID,
      strings: 0,
      requests: requestsSoFar,
      parseFailures: 0,
      mechPassRate: 0,
      wrongLanguageCount: 0,
      perStringScores: [],
      unsupported: true,
    };
    writeCell(ctx, key, cell, []);
    getStats(ctx, providerKey).cellsUnsupported++;
    return;
  }
  console.error(`[${key}] ${classification.message}`);
  deferCell(ctx, providerKey, 'error');
}

// ---------------------------------------------------------------------------
// Per-cell processing (requirements 3-7, 9)
// ---------------------------------------------------------------------------

function jobContext(c: CorpusEntry): string | undefined {
  return (
    [c.tone ? `Tone: ${c.tone}.` : '', c.maxLength ? `Hard limit: at most ${c.maxLength} characters.` : '']
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function buildJobs(corpus: CorpusEntry[], lang: string): TranslationJob[] {
  return corpus.map((c) => ({
    entryId: c.id,
    sourceText: c.text,
    targetLanguage: lang,
    sourceLanguage: 'en',
    context: jobContext(c),
  }));
}

/**
 * DeepL groups jobs by (target, source, context) before chunking — within one
 * cell, target/source are constant, so this reduces to distinct `context`
 * values. Mirrors `jobContext` exactly so the --plan estimate matches actual
 * DeepL sub-request behavior.
 */
function countDeeplContextGroups(corpus: CorpusEntry[]): number {
  return new Set(corpus.map(jobContext)).size;
}

/** `'stop'` = judging just went dead (429-shaped) — the caller must end the whole run gracefully. */
type CellOutcome = 'continue' | 'stop';

async function processCell(
  ctx: RunContext,
  providerKey: string,
  modelId: string,
  lang: string,
  snapModel: FreeTierModel,
  provider: FreeTierProvider,
): Promise<CellOutcome> {
  const key = cellKey(providerKey, modelId, lang);
  if (ctx.resultsFile.cells[key] && !ctx.refresh) return 'continue'; // resumable: already have it

  const state = ctx.providerState.get(providerKey);
  if (state !== undefined) {
    deferCell(ctx, providerKey, state);
    return 'continue';
  }
  // The judge is google, always, regardless of which provider this cell candidates. If google's
  // account is already known-bad (cooling/auth-failed/budget-capped — set either by google's own
  // candidate-translate path or by a prior judge call) this cell can never be written no matter
  // how well it translates, so defer now rather than spend candidate quota translating it first.
  if (providerKey !== JUDGE_PROVIDER_KEY) {
    const judgeState = ctx.providerState.get(JUDGE_PROVIDER_KEY);
    if (judgeState !== undefined) {
      deferCell(ctx, providerKey, judgeState === 'cooling' ? 'judge-cooling' : judgeState);
      return 'continue';
    }
  }

  const isDeepl = providerKey === 'deepl';
  const stats = getStats(ctx, providerKey);

  let mod: TranslationModule;
  try {
    mod = await getOrCreateModule(ctx, providerKey, modelId, snapModel);
  } catch (err) {
    console.error(`[${key}] ${redact(toErrorMessage(err))}`);
    deferCell(ctx, providerKey, 'error');
    return 'continue';
  }

  const jobs = buildJobs(ctx.corpus, lang);
  const chunks = isDeepl ? [jobs] : chunkArray(jobs, TRANSLATE_CHUNK_SIZE);

  // Judged: translated without error AND not blank (an empty/whitespace success is already a
  // mechanical fail — judging it would spend the scarcest quota in the run for no signal).
  const toJudge: Array<{ entry: CorpusEntry; result: TranslationResult }> = [];
  // Mechanical-only: either the module reported .error, or it "succeeded" with blank text.
  const mechOnly: TranslationResult[] = [];
  let parseFailures = 0;
  let parseFailedStrings = 0;
  let requests = 0;

  for (const chunk of chunks) {
    if (ctx.maxRequests !== undefined && stats.requestsMade >= ctx.maxRequests) {
      console.error(`[${providerKey}] hit --max-requests (${ctx.maxRequests}); remaining cells deferred`);
      ctx.providerState.set(providerKey, 'budget-capped');
      deferCell(ctx, providerKey, 'budget-capped');
      return 'continue';
    }

    let results: TranslationResult[];
    try {
      results = await mod.translate(chunk, undefined);
      requests++;
      stats.requestsMade++;
      await paceAfterCall(snapModel, provider);
    } catch (err) {
      requests++;
      stats.requestsMade++;
      await paceAfterCall(snapModel, provider); // a request was made even though it threw
      applyClassification(ctx, providerKey, key, classify(redact(toErrorMessage(err)), isDeepl), requests);
      return 'continue';
    }

    if (results.length > 0 && results.every((r) => r.error !== undefined)) {
      const message = redact(results[0].error ?? '');
      if (isParseFailureMessage(message)) {
        parseFailures++;
        parseFailedStrings += chunk.length;
        continue;
      }
      applyClassification(ctx, providerKey, key, classify(message, isDeepl), requests);
      return 'continue';
    }

    for (const r of results) {
      if (r.error !== undefined || r.translatedText.trim() === '') {
        mechOnly.push(r);
        continue;
      }
      const entry = ctx.entryById.get(r.entryId);
      if (!entry) continue; // defensive: a result outside our corpus should never happen
      toJudge.push({ entry, result: r });
    }
  }

  if (toJudge.length === 0) {
    console.error(`[${key}] nothing to judge (every string errored or translated blank); cell deferred (resumable)`);
    deferCell(ctx, providerKey, 'parse-failed');
    return 'continue';
  }

  const judgeItems: JudgeItem[] = toJudge.map(({ entry, result }) => ({
    entryId: entry.id,
    targetLanguage: lang,
    sourceText: entry.text,
    translatedText: result.translatedText,
    sourceLanguage: 'en',
  }));

  const judgeOutcome = await runJudge(ctx, judgeItems);
  if (judgeOutcome.kind === 'budget-capped') {
    console.error(`[${key}] google hit --max-requests (${ctx.maxRequests}) via judge spend; cell deferred, google budget-capped`);
    ctx.providerState.set(JUDGE_PROVIDER_KEY, 'budget-capped');
    deferCell(ctx, providerKey, 'budget-capped');
    return 'continue';
  }
  if (judgeOutcome.kind === 'cooling') {
    console.error(
      `[judge] rate-limited: ${judgeOutcome.message} — ending run gracefully; every remaining cell deferred (judge-cooling)`,
    );
    ctx.providerState.set(JUDGE_PROVIDER_KEY, 'cooling');
    deferCell(ctx, providerKey, 'judge-cooling');
    return 'stop';
  }
  if (judgeOutcome.kind === 'failed') {
    console.error(`[${key}] judge error: ${judgeOutcome.message} — cell deferred (resumable)`);
    deferCell(ctx, providerKey, 'judge-failed');
    return 'continue';
  }
  // judgeOutcome.kind === 'ok': every item in judgeItems has a clean (error-free) verdict.
  const verdictByEntry = new Map(judgeOutcome.verdicts.map((v) => [v.entryId, v]));

  const outcomes: PerStringOutcome[] = [];
  const detail: DetailEntry[] = [];

  for (const { entry, result } of toJudge) {
    const issues = mechanicalIssues(entry, result.translatedText, lang);
    const mechPass = issues.length === 0;
    const mechWrongScript = issues.includes('wrong-script');
    const verdict = verdictByEntry.get(entry.id)!; // guaranteed present & error-free by runJudge's 'ok' contract
    const judgeMistranslation = verdict.verdict === 'fail' && verdict.issues.some((i) => i.type === 'mistranslation');
    outcomes.push({
      id: entry.id,
      mechPass,
      wrongLanguage: mechWrongScript || judgeMistranslation,
      score: verdict.score,
    });
    detail.push({
      id: entry.id,
      translated: result.translatedText,
      score: verdict.score,
      verdict: verdict.verdict,
      issues: verdict.issues.map((i) => i.type),
    });
  }

  for (const r of mechOnly) {
    const entry = ctx.entryById.get(r.entryId);
    if (!entry) continue;
    const issues = mechanicalIssues(entry, r.translatedText, lang);
    outcomes.push({ id: entry.id, mechPass: issues.length === 0, wrongLanguage: false });
    detail.push({ id: entry.id, translated: r.translatedText });
  }

  const cell = aggregateCell({
    ts: Date.now(),
    corpusVer: ctx.committedCorpusVersion,
    judgeModel: JUDGE_MODEL_ID,
    requests,
    parseFailures,
    outcomes,
    parseFailedStrings,
  });

  writeCell(ctx, key, cell, detail);
  stats.cellsCompleted++;
  return 'continue';
}

// ---------------------------------------------------------------------------
// Cell plan — shared by --plan and the real run.
// ---------------------------------------------------------------------------

interface PlannedCell {
  providerKey: string;
  modelId: string;
  lang: string;
  snapModel: FreeTierModel;
  provider: FreeTierProvider;
}

function buildPlan(
  snapshot: FreeTierSnapshot,
  langs: string[],
  providerFilter: string[] | undefined,
  apiKeys: Record<string, string>,
): { cells: PlannedCell[]; missingKeyProviders: string[] } {
  const cells: PlannedCell[] = [];
  const missingKeyProviders: string[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    if (providerKey === 'copilot') continue; // no local key path — always excluded
    if (providerFilter && !providerFilter.includes(providerKey)) continue; // intentional user choice, not a "skip"
    if (!apiKeys[providerKey]) {
      missingKeyProviders.push(providerKey);
      continue;
    }
    for (const model of provider.models) {
      for (const lang of langs) {
        cells.push({ providerKey, modelId: model.id, lang, snapModel: model, provider });
      }
    }
  }
  return { cells, missingKeyProviders };
}

/** Printed at startup in BOTH --plan and a real run — never only under --plan. */
function printKeyReport(keyReport: KeyReportRow[], missingKeyProviders: string[]): void {
  console.log('Freeway benchmark — API key presence (scripts/.env):');
  for (const r of keyReport) {
    console.log(`  ${r.providerKey.padEnd(12)} ${r.envVar.padEnd(24)} ${r.present ? 'present' : 'MISSING'}`);
  }
  console.log(`  ${'copilot'.padEnd(12)} ${'(no key path)'.padEnd(24)} SKIPPED (always excluded)`);
  const googlePresent = keyReport.find((r) => r.providerKey === 'google')?.present ?? false;
  console.log(
    `  note: every real run also judges via google/${JUDGE_MODEL_ID}, regardless of --providers — ` +
      `GOOGLE_API_KEY is ${googlePresent ? 'present' : 'MISSING'}`,
  );
  if (missingKeyProviders.length > 0) {
    console.log(`  skipped (missing key): ${missingKeyProviders.join(', ')}`);
  }
}

function printPlan(opts: {
  cells: PlannedCell[];
  corpus: CorpusEntry[];
  localCount: number;
  committedVersion: string;
  existingResults: ResultsFile | undefined;
}): void {
  const corpusSize = opts.corpus.length;
  console.log(
    `Corpus: ${corpusSize} string(s) (${corpusSize - opts.localCount} committed, ${opts.localCount} local)` +
      ` — committed corpusVersion ${opts.committedVersion}`,
  );
  console.log();

  const byProvider = new Map<string, PlannedCell[]>();
  for (const cell of opts.cells) {
    const list = byProvider.get(cell.providerKey) ?? [];
    list.push(cell);
    byProvider.set(cell.providerKey, list);
  }

  console.log('Cell plan:');
  let totalTranslateRequests = 0;
  let totalJudgeRequests = 0;
  let googleOwnTranslateRequests = 0;
  const deeplContextGroups = countDeeplContextGroups(opts.corpus);
  for (const [providerKey, cells] of [...byProvider.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    // DeepL batches by (target, source, context) before chunking — one request per distinct
    // context group in the corpus, not one request for the whole cell.
    const translatePerCell = providerKey === 'deepl' ? deeplContextGroups : Math.ceil(corpusSize / TRANSLATE_CHUNK_SIZE);
    // The judge layer's own hard cap is JUDGE_BATCH_SIZE (10), not our old external chunk size.
    const judgePerCell = Math.ceil(corpusSize / JUDGE_BATCH_SIZE);
    const models = new Set(cells.map((c) => c.modelId));
    const alreadyDone = opts.existingResults
      ? cells.filter((c) => opts.existingResults!.cells[cellKey(c.providerKey, c.modelId, c.lang)]).length
      : 0;
    console.log(
      `  ${providerKey}: ${cells.length} cell(s) across ${models.size} model(s) — ` +
        `~${translatePerCell} translate request(s)/cell + ~${judgePerCell} judge request(s)/cell` +
        (alreadyDone > 0 ? ` (${alreadyDone} already in results.json, skipped unless --refresh)` : ''),
    );
    totalTranslateRequests += cells.length * translatePerCell;
    totalJudgeRequests += cells.length * judgePerCell;
    if (providerKey === JUDGE_PROVIDER_KEY) googleOwnTranslateRequests = cells.length * translatePerCell;
  }
  console.log();
  console.log(
    `Total: ${opts.cells.length} cell(s), ~${totalTranslateRequests} translate request(s)` +
      ` + ~${totalJudgeRequests} judge request(s) (judge always via google/${JUDGE_MODEL_ID})`,
  );
  // google carries every OTHER provider's judging too (--max-requests shares one counter across
  // google's own candidate-translate spend and every judge call) — the
  // per-provider line above only shows google's OWN candidate share, so spell out the true total.
  console.log(
    `google total (candidate + judge for every provider's cells): ` +
      `~${googleOwnTranslateRequests} + ~${totalJudgeRequests} = ~${googleOwnTranslateRequests + totalJudgeRequests} request(s)` +
      ` — size --max-requests for google accordingly`,
  );
}

// ---------------------------------------------------------------------------
// --distill: no network. Reads results.json, folds it onto
// the bundled free-tier snapshot via lib.ts's distill()/applyDistilled(), and
// writes free-tier-data.json back in place.
// ---------------------------------------------------------------------------

function formatCellNumbers(cell: CellResult | undefined): string {
  if (!cell) return '';
  if (cell.unsupported) return ' (unsupported by provider)';
  const parts = [
    cell.medianScore !== undefined ? `medianScore=${cell.medianScore}` : undefined,
    `mechPassRate=${cell.mechPassRate}`,
    `wrongLanguageCount=${cell.wrongLanguageCount}/${cell.strings}`,
  ].filter((p): p is string => p !== undefined);
  return ` (${parts.join(', ')})`;
}

function runDistill(): void {
  const resultsFile = readResultsFile();
  if (!resultsFile) {
    console.error(
      `No results.json found at ${RESULTS_PATH} — run the benchmark first (without --distill) before distilling.`,
    );
    process.exit(1);
  }

  const registryCodes = LANGUAGE_REGISTRY.map((l) => l.code);
  const distilled = distill(resultsFile, registryCodes);
  const snapshot = getFreeTierSnapshot();
  const updated = applyDistilled(snapshot, distilled);
  writeFileSync(FREE_TIER_DATA_PATH, JSON.stringify(updated, null, 2) + '\n');

  // Every registry code except 'en', which can never be a benchmark target.
  const totalTargetLangs = LANGUAGE_REGISTRY.length - 1;
  console.log(`Distilled ${distilled.size} model(s) into ${FREE_TIER_DATA_PATH}\n`);
  for (const [modelKey, d] of [...distilled.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const measured = Object.keys(d.langScores).length;
    console.log(`${modelKey}: measured ${measured}/${totalTargetLangs} languages`);
    for (const lang of d.blockedLanguages) {
      console.log(`  BLOCKED  ${lang}${formatCellNumbers(resultsFile.cells[`${modelKey}::${lang}`])}`);
    }
    for (const lang of d.weakLanguages) {
      console.log(`  weak     ${lang}${formatCellNumbers(resultsFile.cells[`${modelKey}::${lang}`])}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Summary + exit code
// ---------------------------------------------------------------------------

function printSummary(ctx: RunContext): void {
  console.log('\n=== Spend summary ===');
  for (const [providerKey, stats] of [...ctx.providerStats.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const deferredParts = Object.entries(stats.cellsDeferred)
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(', ');
    // google's requestsMade blends its own candidate-translate calls with every judge call across
    // every provider's cells (they share one counter); label it accordingly
    // so "attribution stays visible in the summary" for the one provider where the count isn't
    // purely translate requests.
    const requestLabel = providerKey === JUDGE_PROVIDER_KEY ? 'request(s) (candidate translate + judge)' : 'translate request(s)';
    console.log(
      `${providerKey}: ${stats.requestsMade} ${requestLabel}, ${stats.cellsCompleted} cell(s) completed` +
        (stats.cellsUnsupported > 0 ? `, ${stats.cellsUnsupported} unsupported` : '') +
        (deferredParts ? `, deferred (${deferredParts})` : ''),
    );
  }
  console.log(`Exit: ${ctx.hadUnexpectedFailure ? 'FAILURE (at least one cell was deferred for a non-quota reason)' : 'OK'}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.distill) {
    runDistill();
    return;
  }

  const envPath = process.env.NARN_ENV_FILE ?? 'scripts/.env';
  const env = readEnvFile(envPath);
  const snapshot = getFreeTierSnapshot();
  const { report: keyReport, apiKeys } = buildKeyReport(snapshot, env);

  const { entries: corpus, committedVersion, localCount } = readCorpus();
  // Default excludes 'en' (never a target) AND the synthetic pseudo-test language (M7 never
  // routes it to a real provider, so benchmarking it burns quota on a case that can't occur in
  // production). An explicit `--langs pseudo-test` still works if ever wanted.
  const langs =
    args.langs ?? LANGUAGE_REGISTRY.filter((l) => l.code !== 'en' && l.code !== PSEUDO_LANGUAGE_CODE).map((l) => l.code);
  const { cells, missingKeyProviders } = buildPlan(snapshot, langs, args.providers, apiKeys);
  const existingResults = readResultsFile();

  // Printed at startup in BOTH modes — a real run is exactly where "which provider got
  // silently skipped" matters most.
  printKeyReport(keyReport, missingKeyProviders);
  console.log();

  if (args.plan) {
    printPlan({ cells, corpus, localCount, committedVersion, existingResults });
    return;
  }

  if (cells.length === 0) {
    console.log('Nothing to do: no candidate provider has a usable key, or --providers/--langs excluded everything.');
    return;
  }
  // Real run: every cell needs judging, and judging always goes through
  // google, regardless of --providers, so this key is non-negotiable even
  // when google itself isn't one of the candidates being benchmarked.
  if (!apiKeys.google) {
    console.error(
      `GOOGLE_API_KEY is required even when not benchmarking google — every cell is judged via ` +
        `google/${JUDGE_MODEL_ID}. Add it to ${envPath} and retry.`,
    );
    process.exit(1);
  }

  const judgeProvider = snapshot.providers[JUDGE_PROVIDER_KEY];
  const judgeSnapModel = judgeProvider?.models.find((m) => m.id === JUDGE_MODEL_ID);
  if (!judgeProvider || !judgeSnapModel) {
    console.error(`Judge model "${JUDGE_MODEL_ID}" is not in the free-tier snapshot under "${JUDGE_PROVIDER_KEY}" — cannot judge.`);
    process.exit(1);
  }

  let judgeModule: TranslationModule;
  try {
    const factory = await loadFactory(JUDGE_PROVIDER_KEY);
    judgeModule = factory({
      model: JUDGE_MODEL_ID,
      apiKey: apiKeys.google,
      // See getOrCreateModule's comment — same reasoning applies to the judge call.
      maxRetries: 0,
      ...(judgeSnapModel.useStructuredOutput !== undefined ? { useStructuredOutput: judgeSnapModel.useStructuredOutput } : {}),
    });
  } catch (err) {
    console.error(`Failed to load the judge module: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
  const judgeFn = judgeModule.judgeTranslations;
  if (!judgeFn) {
    console.error('google module does not implement judgeTranslations (unexpected) — cannot judge.');
    process.exit(1);
  }

  const ctx: RunContext = {
    corpus,
    entryById: new Map(corpus.map((e) => [e.id, e])),
    committedCorpusVersion: committedVersion,
    apiKeys,
    maxRequests: args.maxRequests,
    refresh: args.refresh,
    // Resuming against a newer committed corpus refreshes the top-level version unconditionally;
    // per-cell CellResult.corpusVersion stays whatever it was when that cell was written.
    resultsFile: existingResults
      ? { ...existingResults, corpusVersion: committedVersion }
      : { corpusVersion: committedVersion, cells: {} },
    detailFile: readDetailFile(),
    providerState: new Map(),
    providerStats: new Map(),
    moduleCache: new Map([[`${JUDGE_PROVIDER_KEY}::${JUDGE_MODEL_ID}`, judgeModule]]),
    judge: (items) => judgeFn.call(judgeModule, items, undefined),
    judgeSnapModel,
    judgeProvider,
    hadUnexpectedFailure: false,
  };

  console.log(
    `Freeway benchmark: ${cells.length} cell(s) planned across ${new Set(cells.map((c) => c.providerKey)).size} provider(s).`,
  );
  console.log(`Corpus: ${corpus.length} string(s) (${corpus.length - localCount} committed, ${localCount} local).`);
  if (!args.refresh && existingResults) {
    const already = cells.filter((c) => existingResults.cells[cellKey(c.providerKey, c.modelId, c.lang)]).length;
    if (already > 0) console.log(`${already} cell(s) already in results.json — skipping (pass --refresh to redo them).`);
  }
  console.log();

  for (let i = 0; i < cells.length; i++) {
    const planned = cells[i];
    const outcome = await processCell(ctx, planned.providerKey, planned.modelId, planned.lang, planned.snapModel, planned.provider);
    if (outcome === 'stop') {
      // Judge just went cooling (429-shaped) — it's shared by every provider's cells, so nothing
      // remaining can be judged either. Attribute each of them to its own provider bucket so the
      // summary shows exactly how much was left on the table, then stop.
      for (const remaining of cells.slice(i + 1)) {
        deferCell(ctx, remaining.providerKey, 'judge-cooling');
      }
      break;
    }
  }

  printSummary(ctx);
  process.exitCode = ctx.hadUnexpectedFailure ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error(`Unexpected error: ${redact(toErrorMessage(err))}`);
  process.exitCode = 1;
});
