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
 *   pnpm exec tsx scripts/freeway-benchmark.ts --candidates c.json --results-out scripts/freeway-benchmark/candidates-x.local.json --langs es
 *
 * Keys are read from scripts/.env (override with NARN_ENV_FILE) — never
 * accepted on argv, never printed. Only name presence/absence is ever logged.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  aggregateCell,
  applyDistilled,
  applySpeedDistilled,
  candidateDetailPath,
  candidateTranslationsPath,
  candidateSnapshot,
  cellKey,
  corpusVersion,
  distill,
  distillSpeed,
  emptySpeedResults,
  httpCeilingMessage,
  isHttpCeilingMessage,
  judgeBudgetFits,
  mechanicalIssues,
  parseCandidates,
  parseCorpus,
  parseSpeedResults,
  redact,
  restrictCandidateEnv,
  sortedResults,
  type CellResult,
  type CorpusEntry,
  type PerStringOutcome,
  type ResultsFile,
  type SpeedResultsFile,
} from './freeway-benchmark/lib.js';
import { planSpeed, runSpeedPass, SPEED_ENV_NAMES } from './freeway-benchmark/speed.js';

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
const SPEED_RESULTS_PATH = path.join(BENCH_DIR, 'speed-results.local.json');
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
  copilot: '../modules/copilot/src/index.js',
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
  --candidates <file>  Benchmark the models in this JSON file instead of the
                       snapshot's: {"providers":{"groq":[{"id":"…","rpm":6}]}}.
                       Reads only GOOGLE/GROQ/OPENROUTER keys, also enforces
                       --max-requests per host on real HTTP calls, and records
                       translate latency. Requires --results-out.
  --results-out <path> Results file for --candidates; must be gitignored and end
                       in .local.json. results.json is neither read nor written.
  --judge-pace-ms N    Minimum wait after each judge request.
  --translate-only     With --candidates: translate and save to a sidecar file
                       without judging. A later run without this flag judges
                       the saved translations instead of translating again.
  --distill            Fold results.json into the bundled free-tier snapshot
                       (free-tier-data.json) and print coverage. No network
                       calls.
  --speed              Measure provider time per delivered string for every bundled
                       model (translate-only, no judge, two 12-string requests
                       per language) into the gitignored
                       scripts/freeway-benchmark/speed-results.local.json.
                       Reads GOOGLE_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY and
                       GITHUB_TOKEN from the process environment (no env file),
                       only for the providers selected. Resumable and quota-aware
                       across restarts. With --plan, makes no calls.
  --distill-speed <path>
                       Write a reviewed speed-results file's per-model
                       ms/string into the bundled free-tier snapshot's
                       speedMsPerString. No network calls.
  --help, -h            Print this usage and exit 0.
`;

interface CliArgs {
  langs?: string[];
  providers?: string[];
  maxRequests?: number;
  refresh: boolean;
  plan: boolean;
  distill: boolean;
  speed: boolean;
  distillSpeedPath?: string;
  candidatesPath?: string;
  resultsOut?: string;
  judgePaceMs?: number;
  translateOnly?: boolean;
}

function usageError(message: string): never {
  console.error(USAGE);
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { refresh: false, plan: false, distill: false, speed: false };
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
      case '--translate-only':
        args.translateOnly = true;
        break;
      case '--candidates':
        args.candidatesPath = path.resolve(next(++i, '--candidates'));
        break;
      case '--results-out':
        args.resultsOut = path.resolve(next(++i, '--results-out'));
        break;
      case '--judge-pace-ms': {
        const raw = next(++i, '--judge-pace-ms');
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) usageError(`--judge-pace-ms must be a positive number (got "${raw}")`);
        args.judgePaceMs = n;
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
      case '--speed':
        args.speed = true;
        break;
      case '--distill-speed':
        args.distillSpeedPath = path.resolve(next(++i, '--distill-speed'));
        break;
      default:
        usageError(`Unknown flag: ${arg}`);
    }
  }
  if (args.langs?.length === 0) usageError('--langs must name at least one language');
  if (args.providers?.length === 0) usageError('--providers must name at least one provider');
  if ((args.candidatesPath === undefined) !== (args.resultsOut === undefined)) {
    usageError('--candidates and --results-out must be used together');
  }
  if (args.translateOnly && !args.candidatesPath) usageError('--translate-only requires --candidates');
  if (args.candidatesPath && args.distill) usageError('--distill cannot be used with --candidates');
  if (args.speed && (args.candidatesPath || args.distill || args.distillSpeedPath || args.translateOnly || args.refresh)) {
    usageError('--speed cannot be combined with --candidates, --distill, --distill-speed, --translate-only or --refresh');
  }
  if (args.distillSpeedPath && (args.candidatesPath || args.distill || args.plan)) {
    usageError('--distill-speed cannot be combined with --candidates, --distill or --plan');
  }
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

let resultsPath = RESULTS_PATH;
let detailPath = DETAIL_PATH;

function readResultsFile(): ResultsFile | undefined {
  if (!existsSync(resultsPath)) return undefined;
  try {
    return JSON.parse(readFileSync(resultsPath, 'utf8')) as ResultsFile;
  } catch (err) {
    console.error(`results.json is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

function writeResultsFile(file: ResultsFile): void {
  writeFileSync(resultsPath, JSON.stringify(sortedResults(file), null, 2) + '\n');
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
  if (!existsSync(detailPath)) return {};
  try {
    return JSON.parse(readFileSync(detailPath, 'utf8')) as DetailFile;
  } catch {
    return {}; // local-only diagnostic file: corrupt/missing is non-fatal, just start fresh
  }
}

function writeDetailFile(file: DetailFile): void {
  const sorted: DetailFile = Object.fromEntries(Object.entries(file).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(detailPath, JSON.stringify(sorted, null, 2) + '\n');
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

type TranslationCache = Record<string, Record<number, { results: TranslationResult[]; ms: number }>>;

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
  judgePaceMs: number | undefined;
  recordLatency: boolean;
  translateOnly: boolean;
  /** Candidate runs only: translated chunks by cell key, so a judge failure never re-spends translate quota. */
  translationCache: TranslationCache | undefined;
  translationCachePath: string | undefined;
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
          indexedBatchReplies: false,
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
// throws for THIS caller: every failure class — parse failure at singleton,
// 429, 401/403, transport error — resolves as a `JudgeVerdict` carrying
// `.error` instead ("so one bad batch never aborts a judge run"). The layer's
// `rethrowIfAuthOrRateLimit` is opt-in on this path — reached only by a caller
// passing `BatchDispatchOptions.surfaceTypedErrors` (the background engines,
// which answer a 429 with a bucket cool and a re-route), and we never do. So
// there is nothing to catch here, and no retry to run ourselves — the shared
// layer already retries transients once and halves on a parse failure,
// internally, below its own hard 10-item batch cap.
//
// What we DO own: detecting that a returned verdict is bad (the shared layer
// reports failure via data, not control flow) and deciding what that means
// for the cell/run. A cell with ANY unjudged or errored item must NOT be
// written (stays absent, resumable) — writing it would let `distill()`
// silently drop it forever (`meanScore: undefined`) with no error and no
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
    if (ctx.judgePaceMs !== undefined) await sleepMs(ctx.judgePaceMs);
    // The ceiling can't lift during this run, so the rest of this cell can never be judged.
    if (chunkVerdicts.some((v) => v.error !== undefined && isHttpCeilingMessage(v.error))) {
      return { kind: 'budget-capped' };
    }
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

function capProviderAtHttpCeiling(ctx: RunContext, providerKey: string, key: string): void {
  console.error(`[${key}] hit the HTTP ceiling; "${providerKey}" budget-capped, remaining cells deferred`);
  ctx.providerState.set(providerKey, 'budget-capped');
  deferCell(ctx, providerKey, 'budget-capped');
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
  if (providerKey !== JUDGE_PROVIDER_KEY && !ctx.translateOnly) {
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
  const judgeStats = getStats(ctx, JUDGE_PROVIDER_KEY);
  if (
    !ctx.translateOnly &&
    !judgeBudgetFits({
      used: judgeStats.requestsMade,
      maxRequests: ctx.maxRequests,
      judgeRequests: Math.ceil(jobs.length / JUDGE_BATCH_SIZE),
      ownTranslateRequests: providerKey === JUDGE_PROVIDER_KEY ? chunks.length : 0,
    })
  ) {
    console.error(`[${key}] a full judge pass would cross --max-requests (${ctx.maxRequests}); cell deferred before translating`);
    ctx.providerState.set(JUDGE_PROVIDER_KEY, 'budget-capped');
    deferCell(ctx, providerKey, 'budget-capped');
    return 'continue';
  }

  const toJudge: Array<{ entry: CorpusEntry; result: TranslationResult }> = [];
  // Mechanical-only: either the module reported .error, or it "succeeded" with blank text.
  const mechOnly: TranslationResult[] = [];
  let parseFailures = 0;
  let parseFailedStrings = 0;
  let requests = 0;
  let translateMs = 0;

  const remember = (index: number, results: TranslationResult[], ms: number): void => {
    if (!ctx.translationCache || !ctx.translationCachePath) return;
    (ctx.translationCache[key] ??= {})[index] = { results, ms };
    writeFileSync(ctx.translationCachePath, `${JSON.stringify(ctx.translationCache, null, 2)}\n`);
  };

  for (const [chunkIndex, chunk] of chunks.entries()) {
    const saved = ctx.translationCache?.[key]?.[chunkIndex];
    if (saved && !ctx.refresh) {
      requests++;
      translateMs += saved.ms;
      const failed = saved.results.length > 0 && saved.results.every((r) => r.error !== undefined);
      if (failed) {
        parseFailures++;
        parseFailedStrings += chunk.length;
        continue;
      }
      for (const r of saved.results) {
        const entry = ctx.entryById.get(r.entryId);
        if (r.error !== undefined || r.translatedText.trim() === '') mechOnly.push(r);
        else if (entry) toJudge.push({ entry, result: r });
      }
      continue;
    }

    if (ctx.maxRequests !== undefined && stats.requestsMade >= ctx.maxRequests) {
      console.error(`[${providerKey}] hit --max-requests (${ctx.maxRequests}); remaining cells deferred`);
      ctx.providerState.set(providerKey, 'budget-capped');
      deferCell(ctx, providerKey, 'budget-capped');
      return 'continue';
    }

    let results: TranslationResult[];
    let chunkMs = 0;
    try {
      const startedAt = Date.now();
      results = await mod.translate(chunk, undefined);
      chunkMs = Date.now() - startedAt;
      translateMs += chunkMs;
      requests++;
      stats.requestsMade++;
      await paceAfterCall(snapModel, provider);
    } catch (err) {
      requests++;
      stats.requestsMade++;
      await paceAfterCall(snapModel, provider); // a request was made even though it threw
      const message = redact(toErrorMessage(err));
      if (isHttpCeilingMessage(message)) {
        capProviderAtHttpCeiling(ctx, providerKey, key);
        return 'continue';
      }
      applyClassification(ctx, providerKey, key, classify(message, isDeepl), requests);
      return 'continue';
    }

    if (results.some((r) => r.error !== undefined && isHttpCeilingMessage(r.error))) {
      capProviderAtHttpCeiling(ctx, providerKey, key);
      return 'continue';
    }

    if (results.length > 0 && results.every((r) => r.error !== undefined)) {
      const message = redact(results[0].error ?? '');
      if (isParseFailureMessage(message)) {
        parseFailures++;
        parseFailedStrings += chunk.length;
        remember(chunkIndex, results, chunkMs);
        continue;
      }
      applyClassification(ctx, providerKey, key, classify(message, isDeepl), requests);
      return 'continue';
    }

    remember(chunkIndex, results, chunkMs);
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

  if (ctx.translateOnly) {
    console.error(`[${key}] translated ${toJudge.length} string(s), ${parseFailures} parse failure(s), ${Math.round(translateMs / Math.max(1, requests))} ms/request`);
    return 'continue';
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

  writeCell(ctx, key, ctx.recordLatency ? { ...cell, meanTranslateMs: Math.round(translateMs / requests) } as CellResult : cell, detail);
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
    cell.meanScore !== undefined ? `meanScore=${cell.meanScore}` : undefined,
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
// --speed / --distill-speed
// ---------------------------------------------------------------------------

function readSpeedResults(file: string): SpeedResultsFile {
  if (!existsSync(file)) return emptySpeedResults();
  try {
    return parseSpeedResults(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    console.error(`${file} is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

function runDistillSpeed(file: string): void {
  if (!existsSync(file)) {
    console.error(`No speed results at ${file} — run the speed pass first (--speed).`);
    process.exit(1);
  }
  const speed = distillSpeed(readSpeedResults(file));
  const updated = applySpeedDistilled(getFreeTierSnapshot(), speed);
  writeFileSync(FREE_TIER_DATA_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`Wrote speedMsPerString for ${speed.size} model(s) into ${FREE_TIER_DATA_PATH}\n`);
  for (const [modelKey, ms] of [...speed.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    console.log(`${modelKey}: ${Math.round(ms)} ms/string`);
  }
}

async function runSpeed(args: CliArgs): Promise<void> {
  const snapshot = getFreeTierSnapshot();
  const { entries: corpus } = readCorpus();
  const langs =
    args.langs ?? LANGUAGE_REGISTRY.filter((l) => l.code !== 'en' && l.code !== PSEUDO_LANGUAGE_CODE).map((l) => l.code);
  const file = readSpeedResults(SPEED_RESULTS_PATH);
  const common = { snapshot, corpus, langs, env: process.env, providers: args.providers, now: Date.now };

  console.log('Freeway speed pass — key presence (process environment):');
  for (const [providerKey, envName] of Object.entries(SPEED_ENV_NAMES)) {
    console.log(`  ${providerKey.padEnd(12)} ${envName.padEnd(24)} ${process.env[envName] ? 'present' : 'MISSING'}`);
  }
  console.log();

  const plan = planSpeed({ ...common, file });
  console.log(`Corpus: ${corpus.length} string(s); ${langs.length} language(s); ${plan.rows.length} model(s) selected.`);
  for (const row of plan.rows) {
    const windows = row.windows.map((w) => `${w.spent}/${w.limit} used until ${new Date(w.resetsAt).toISOString()}`).join('; ');
    console.log(`  ${row.providerKey}::${row.modelId}: ${row.requests} request(s) to go${windows ? ` (daily window ${windows})` : ''}`);
  }
  if (plan.skippedProviders.length > 0) console.log(`  skipped (missing key): ${plan.skippedProviders.join(', ')}`);
  if (args.plan) return;
  if (plan.rows.length === 0) {
    console.log('Nothing to do: no selected provider has a key in the environment.');
    return;
  }

  assertGitignored(SPEED_RESULTS_PATH);
  const report = await runSpeedPass({
    ...common,
    maxRequests: args.maxRequests,
    sleep: sleepMs,
    log: (line) => console.error(line),
    createModule: async (providerKey, config) => (await loadFactory(providerKey))(config),
    store: {
      load: () => file,
      save: (f) => writeFileSync(SPEED_RESULTS_PATH, JSON.stringify(f, null, 2) + '\n'),
    },
  });

  console.log('\n=== Speed pass summary ===');
  console.log(`Completed cells: ${report.completed.length}`);
  const byReason = new Map<string, string[]>();
  for (const [cell, reason] of Object.entries(report.incomplete)) byReason.set(reason, [...(byReason.get(reason) ?? []), cell]);
  for (const [reason, cells] of [...byReason.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    console.log(`Incomplete (${reason}): ${cells.length} cell(s)`);
  }
  if (report.skippedProviders.length > 0) console.log(`Skipped providers (no key): ${report.skippedProviders.join(', ')}`);
  for (const [providerKey, n] of Object.entries(report.requests).sort(([a], [b]) => (a < b ? -1 : 1))) {
    console.log(`${providerKey}: ${n} request(s) this run`);
  }
  for (const [window, spent] of Object.entries(report.spends).sort(([a], [b]) => (a < b ? -1 : 1))) {
    console.log(`  window ${window}: ${spent} spent`);
  }
  process.exitCode = Object.values(report.incomplete).some((r) => r === 'failed' || r === 'auth-failed') ? 1 : 0;
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
// Candidate-run guards
// ---------------------------------------------------------------------------

function assertGitignored(target: string): void {
  const res = spawnSync('git', ['check-ignore', '-q', target], { cwd: path.dirname(target), stdio: 'ignore' });
  if (res.status !== 0) {
    console.error(`${target} is not gitignored — refusing to write candidate results there.`);
    process.exit(1);
  }
}

/**
 * The shared layer retries and splits batches below the per-call counters, so a
 * candidate run also counts and caps real HTTP calls by host. Hostnames only:
 * a URL can carry a key.
 */
function installHttpCounter(maxRequests: number | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const host = new URL(input instanceof Request ? input.url : String(input)).hostname;
    const used = counts.get(host) ?? 0;
    if (maxRequests !== undefined && used >= maxRequests) {
      return Promise.reject(new Error(httpCeilingMessage(host)));
    }
    counts.set(host, used + 1);
    return realFetch(input, init);
  };
  return counts;
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
  if (args.distillSpeedPath) {
    runDistillSpeed(args.distillSpeedPath);
    return;
  }
  if (args.speed) {
    await runSpeed(args);
    return;
  }

  const envPath = process.env.NARN_ENV_FILE ?? 'scripts/.env';
  const candidateRun = args.candidatesPath !== undefined;
  const env = candidateRun ? restrictCandidateEnv(readEnvFile(envPath)) : readEnvFile(envPath);
  const snapshot = getFreeTierSnapshot();
  let planSnapshot = snapshot;
  if (args.candidatesPath && args.resultsOut) {
    assertGitignored(args.resultsOut);
    try {
      detailPath = candidateDetailPath(args.resultsOut);
      planSnapshot = candidateSnapshot(snapshot, parseCandidates(JSON.parse(readFileSync(args.candidatesPath, 'utf8'))));
    } catch (err) {
      usageError(redact(toErrorMessage(err)));
    }
    resultsPath = args.resultsOut;
  }
  const { report: keyReport, apiKeys } = buildKeyReport(snapshot, env);

  const { entries: corpus, committedVersion, localCount } = readCorpus();
  // Default excludes 'en' (never a target) AND the synthetic pseudo-test language (M7 never
  // routes it to a real provider, so benchmarking it burns quota on a case that can't occur in
  // production). An explicit `--langs pseudo-test` still works if ever wanted.
  const langs =
    args.langs ?? LANGUAGE_REGISTRY.filter((l) => l.code !== 'en' && l.code !== PSEUDO_LANGUAGE_CODE).map((l) => l.code);
  const { cells, missingKeyProviders } = buildPlan(planSnapshot, langs, args.providers, apiKeys);
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

  const translationCachePath = args.resultsOut && candidateRun ? candidateTranslationsPath(args.resultsOut) : undefined;
  const translationCache: TranslationCache | undefined = translationCachePath
    ? existsSync(translationCachePath)
      ? (JSON.parse(readFileSync(translationCachePath, 'utf8')) as TranslationCache)
      : {}
    : undefined;

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
    judgePaceMs: args.judgePaceMs,
    translateOnly: args.translateOnly === true,
    translationCache,
    translationCachePath,
    recordLatency: candidateRun,
  };
  const httpCounts = candidateRun ? installHttpCounter(args.maxRequests) : undefined;

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
  if (httpCounts) {
    console.log(`HTTP calls by host: ${[...httpCounts].map(([host, n]) => `${host}=${n}`).join(', ') || 'none'}`);
  }
  process.exitCode = ctx.hadUnexpectedFailure ? 1 : 0;
}

main().catch((err: unknown) => {
  console.error(`Unexpected error: ${redact(toErrorMessage(err))}`);
  process.exitCode = 1;
});
