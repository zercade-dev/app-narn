/**
 * Judge-quality benchmark runner.
 *
 * `freeway-benchmark.ts` measures each free model's TRANSLATION quality, but
 * scores every candidate with one fixed judge (`google::gemma-4-31b-it`) —
 * nobody has ever measured whether THAT judge is any good. This script
 * measures the inverse: how well each free, judge-capable model performs the
 * REVIEW itself. It has two independent modes, run separately:
 *
 *   --translate-weak   Translate corpus-source.json's `en` strings into fr/ja
 *                       with a deliberately weak model, writing corpus.json
 *                       (adds a `weak{}` field alongside the existing
 *                       known-good `good{}` one). `weak` is kept for
 *                       reference only — it does NOT drive review-corpus
 *                       selection (see --judge below); a first machine-
 *                       translation pass turned out too clean to benchmark
 *                       a judge against (near-zero defects), so the review
 *                       corpus instead uses curated, catalogued defects.
 *   --judge             Build a 25-pair-per-language review corpus by
 *                       reading each entry's own `arm.{lang}` field —
 *                       "clean" sends `good[lang]`, "injected" sends
 *                       `injected[lang]` (exactly one catalogued defect,
 *                       e.g. a dropped placeholder or an `&nbsp;` leak).
 *                       That assignment is DATA curated outside this tool
 *                       (stratified so every defect type appears in the
 *                       injected arm of both languages) — this script only
 *                       reads it, never recomputes it. Then runs every
 *                       judge-capable free model's own `judgeTranslations`
 *                       over the corpus `--runs` times, recording every
 *                       verdict (plus the arm/defect it carried) to
 *                       verdicts.json.
 *   --score             Pure analysis, no network: reads verdicts.json and
 *                       the human-graded reference.json, scores every model
 *                       present in verdicts.json against the reference
 *                       (recall/precision/F1/false-positive-rate/per-defect-
 *                       type recall/score agreement/run-to-run stability),
 *                       writes judge-benchmark/scores.json, and prints a
 *                       ranked table. Safe to re-run at any time, including
 *                       while --judge is still collecting — scores whatever
 *                       is present and reports which candidate models have
 *                       no data yet rather than failing.
 *
 * A human-graded reference set (judge-benchmark/reference.json, supplied
 * separately, not built here) is what verdicts.json ultimately gets compared
 * against; --judge only collects the model verdicts, --score does the
 * comparison.
 *
 * Like freeway-benchmark.ts, the four provider-module factories are loaded
 * via a runtime `import()` of their *source* file (relative path, not the
 * package name): the workspace-root `package.json` doesn't depend on the
 * module/shared workspace packages, so a bare `@zercade-dev/narn-module-*`
 * import never resolves from `scripts/`. `packages/shared` must be built
 * first (`pnpm --filter @zercade-dev/narn-shared build`, or `pnpm build`) for
 * a REAL run; `--plan` stays fully build-free. `copilot` is excluded from
 * every candidate list for the same reason freeway-benchmark excludes it:
 * its module config takes `githubToken`, not the `apiKey` shape every other
 * candidate module shares, so it doesn't fit the one key-intake path below
 * (see CANDIDATE_MANIFESTS / getOrCreateModule).
 *
 * Usage:
 *   pnpm exec tsx scripts/judge-benchmark.ts --translate-weak --plan
 *   pnpm exec tsx scripts/judge-benchmark.ts --translate-weak
 *   pnpm exec tsx scripts/judge-benchmark.ts --translate-weak --weak-model google::gemini-3.1-flash-lite
 *   pnpm exec tsx scripts/judge-benchmark.ts --judge --plan
 *   pnpm exec tsx scripts/judge-benchmark.ts --judge
 *   pnpm exec tsx scripts/judge-benchmark.ts --judge --models google::gemma-4-31b-it,groq::openai/gpt-oss-120b --runs 3
 *   pnpm exec tsx scripts/judge-benchmark.ts --score
 *
 * Keys are read from scripts/.env (override with NARN_ENV_FILE) — never
 * accepted on argv, never printed. Only name presence/absence is ever logged.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDispatchOrder,
  buildReviewCorpus,
  DEFECT_TYPES,
  hashBytes,
  incompleteRunKey,
  itemCategory,
  JUDGE_LANGS,
  modelKey,
  parseCorpus,
  parseCorpusSource,
  pendingRunItems,
  requireCuratedEntries,
  sortedVerdictsFile,
  verdictKey,
  type Corpus,
  type CorpusEntry,
  type CorpusSourceEntry,
  type CuratedCorpusEntry,
  type DefectType,
  type DispatchItem,
  type IncompleteRunRecord,
  type JudgeLang,
  type ReviewItem,
  type VerdictsFile,
} from './judge-benchmark/lib.js';

import { COMPARABLE_THRESHOLD, computeScoreReport, parseReferenceFile, type ModelMetrics, type ScoreReport } from './judge-benchmark/score.js';

import {
  chunkArray,
  getFreeTierSnapshot,
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
} from '../packages/shared/src/index.js';

import googleManifest from '../modules/google/manifest.json' with { type: 'json' };
import openrouterManifest from '../modules/openrouter/manifest.json' with { type: 'json' };
import groqManifest from '../modules/groq/manifest.json' with { type: 'json' };
import deeplManifest from '../modules/deepl/manifest.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Paths + constants
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BENCH_DIR = path.join(SCRIPT_DIR, 'judge-benchmark');
const CORPUS_SOURCE_PATH = path.join(BENCH_DIR, 'corpus-source.json');
const CORPUS_PATH = path.join(BENCH_DIR, 'corpus.json');
const VERDICTS_PATH = path.join(BENCH_DIR, 'verdicts.json');
const VERDICTS_DETAIL_PATH = path.join(BENCH_DIR, 'verdicts-detail.local.json');
const REFERENCE_PATH = path.join(BENCH_DIR, 'reference.json');
const SCORES_PATH = path.join(BENCH_DIR, 'scores.json');

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

/** `deepl` is classical MT with no `judgeTranslations` at all — never a judge candidate. */
const NOT_JUDGE_CAPABLE: ReadonlySet<string> = new Set(['deepl']);

const DEFAULT_WEAK_MODEL = 'google::gemini-flash-lite-latest';
const DEFAULT_RUNS = 2;
/** External chunk size for the translate-weak pass — mirrors freeway-benchmark's TRANSLATE_CHUNK_SIZE. */
const TRANSLATE_CHUNK_SIZE = 12;
/**
 * The judge layer hard-caps its own batch at 10 regardless of what's passed
 * in (module-features.ts's `judgeTranslations`: `resolveBatchSize(...,
 * {default: 10, cap: 10})`) — chunking externally at the SAME size makes each
 * `mod.judgeTranslations(chunk)` call map 1:1 to one real provider request
 * (nominal; an internal transient retry can still add an invisible extra
 * one), which is what both --plan's request estimate and the runtime rpd
 * guard below depend on. At 50 items/model/run (25 fr + 25 ja, combined into
 * one list so the split falls at 10/10/10/10/10 rather than 10/10/5 twice),
 * that's exactly 5 requests/run.
 */
const JUDGE_BATCH_SIZE = 10;
const PACING_FLOOR_MS = 1500;
/**
 * Per-model, per-run cap on cumulative wall-clock spent waiting on judge
 * calls before this script gives up on that model and moves to the next
 * one. Nothing comparable already existed to reuse: `PACING_FLOOR_MS` above
 * is a FLOOR between successful requests (a pacing courtesy), not a ceiling
 * on how long we'll wait for a struggling one, and the shared AI SDK
 * layer's `DEFAULT_REQUEST_TIMEOUT_MS` (300_000ms) bounds a single HTTP
 * call, not what this script is willing to spend accumulating across
 * several calls to the same model. A real run burned ~50 minutes of
 * wall-clock and the owner's daily quota on a handful of 429/503-heavy
 * models before a timeout killed it having written nothing (see
 * JUDGE-BENCH-NOTES.md) — this cap exists so one rate-limited model can
 * never again consume the whole run. Checked between chunks AND enforced
 * per-chunk via an AbortSignal sized to whatever budget remains, so a
 * single very slow chunk is itself bounded, not just chunks after it.
 */
const RATE_LIMIT_WAIT_CAP_MS = 90_000;
/** See freeway-benchmark.ts's identical constant for the shape rationale. */
const KEY_SHAPE_RE = /\b(?:(?:gsk_|sk-[A-Za-z0-9-]|AIza)[A-Za-z0-9_-]*|[0-9a-f][0-9a-f-]{29,}(?::fx)?)/g;
function redact(text: string): string {
  return text.replace(KEY_SHAPE_RE, '[redacted]');
}

/**
 * Write-temp-then-rename: `rename()` on the same filesystem is atomic, so a
 * process killed mid-write (the failure mode that cost real quota for zero
 * data — see RATE_LIMIT_WAIT_CAP_MS above) leaves either the OLD complete
 * file or the NEW complete file on disk, never a half-written one. Every
 * JSON artifact this script owns goes through this, not just verdicts.json.
 */
function writeJsonAtomic(filePath: string, data: unknown): void {
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmpPath, filePath);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const USAGE = `Usage: tsx scripts/judge-benchmark.ts --translate-weak [options]
       tsx scripts/judge-benchmark.ts --judge [options]
       tsx scripts/judge-benchmark.ts --score

  --translate-weak      Translate corpus-source.json into corpus.json using a
                         deliberately weak model (default: ${DEFAULT_WEAK_MODEL}).
  --weak-model p::m      Override the weak model for --translate-weak (provider::modelId).
  --judge                Build the review corpus and collect judge verdicts
                         from every judge-capable free model into verdicts.json.
  --models a::b,c::d      Restrict --judge to these provider::modelId pairs
                         (default: every judge-capable model in the snapshot).
  --skip-models a::b      Exclude these provider::modelId pairs from --judge
                         (applied after --models; lets you run the fast
                         providers now and the tight-quota ones separately).
  --runs N               Number of independent judge passes per model (default: ${DEFAULT_RUNS}).
  --wait-cap SECONDS     Per-(model, run) cumulative rate-limit wait budget
                         (default: ${RATE_LIMIT_WAIT_CAP_MS / 1000}). Raise it for
                         providers whose free tier makes you wait minutes between
                         chunks; the default keeps one throttled model from eating
                         a whole run.
  --refresh              Re-run (model, run) pairs already fully in verdicts.json
                         (default: skip them — the run is crash-resumable).
  --plan                 Print the request plan + key-presence report and exit.
                         No network calls.
  --score                 Score verdicts.json against reference.json and write
                         scores.json. Pure analysis — no network calls, safe to
                         re-run anytime, including against a partial verdicts.json.
  --help, -h              Print this usage and exit 0.
`;

interface CliArgs {
  translateWeak: boolean;
  judge: boolean;
  score: boolean;
  weakModel: string;
  models?: string[];
  skipModels?: string[];
  runs: number;
  refresh: boolean;
  plan: boolean;
  waitCapMs?: number;
}

function usageError(message: string): never {
  console.error(USAGE);
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    translateWeak: false,
    judge: false,
    score: false,
    weakModel: DEFAULT_WEAK_MODEL,
    runs: DEFAULT_RUNS,
    refresh: false,
    plan: false,
  };
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
      case '--translate-weak':
        args.translateWeak = true;
        break;
      case '--weak-model':
        args.weakModel = next(++i, '--weak-model');
        break;
      case '--judge':
        args.judge = true;
        break;
      case '--score':
        args.score = true;
        break;
      case '--models':
        args.models = next(++i, '--models')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--skip-models':
        args.skipModels = next(++i, '--skip-models')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--runs': {
        const raw = next(++i, '--runs');
        const n = Number(raw);
        if (!Number.isInteger(n) || n <= 0) usageError(`--runs must be a positive integer (got "${raw}")`);
        args.runs = n;
        break;
      }
      case '--wait-cap': {
        const raw = next(++i, '--wait-cap');
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) usageError(`--wait-cap must be a positive number of seconds (got "${raw}")`);
        args.waitCapMs = Math.round(n * 1000);
        break;
      }
      case '--refresh':
        args.refresh = true;
        break;
      case '--plan':
        args.plan = true;
        break;
      default:
        usageError(`Unknown flag: ${arg}`);
    }
  }
  const modeCount = [args.translateWeak, args.judge, args.score].filter(Boolean).length;
  if (modeCount !== 1) {
    usageError('exactly one of --translate-weak, --judge, or --score is required');
  }
  if (args.models?.length === 0) usageError('--models must name at least one provider::modelId pair');
  if (args.skipModels?.length === 0) usageError('--skip-models must name at least one provider::modelId pair');
  if (args.score && args.models) usageError('--models only applies to --judge (--score scores every model present in verdicts.json)');
  if (!args.judge && args.skipModels) usageError('--skip-models only applies to --judge');
  if (!args.judge && args.waitCapMs !== undefined) usageError('--wait-cap only applies to --judge');
  return args;
}

function parseModelKeyArg(raw: string, flag: string): { providerKey: string; modelId: string } {
  const i = raw.indexOf('::');
  if (i < 0) usageError(`${flag}: "${raw}" must be in "provider::modelId" form`);
  return { providerKey: raw.slice(0, i), modelId: raw.slice(i + 2) };
}

// ---------------------------------------------------------------------------
// Env intake — identical pattern to freeway-benchmark.ts. Keys are read ONLY
// here, at runtime, off argv/logs entirely: only name presence/absence is
// ever printed or returned to a caller that logs.
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

function buildKeyReport(env: Record<string, string>): { report: KeyReportRow[]; apiKeys: Record<string, string> } {
  const report: KeyReportRow[] = [];
  const apiKeys: Record<string, string> = {};
  for (const providerKey of Object.keys(MODULE_ENTRY)) {
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

function printKeyReport(keyReport: KeyReportRow[]): void {
  console.log('Judge benchmark — API key presence (scripts/.env):');
  for (const r of keyReport) {
    console.log(`  ${r.providerKey.padEnd(12)} ${r.envVar.padEnd(24)} ${r.present ? 'present' : 'MISSING'}`);
  }
  console.log(`  ${'copilot'.padEnd(12)} ${'(no key path)'.padEnd(24)} SKIPPED (always excluded — see file header)`);
}

// ---------------------------------------------------------------------------
// Pacing + rpd budget
// ---------------------------------------------------------------------------

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rpmLimit(snapModel: FreeTierModel | undefined, provider: FreeTierProvider | undefined): number | undefined {
  const own = snapModel?.limits.find((l) => l.window === 'rpm')?.limit;
  if (own !== undefined) return own;
  return provider?.sharedLimits?.find((l) => l.window === 'rpm')?.limit;
}

function rpdLimit(snapModel: FreeTierModel | undefined, provider: FreeTierProvider | undefined): number | undefined {
  const own = snapModel?.limits.find((l) => l.window === 'rpd')?.limit;
  if (own !== undefined) return own;
  return provider?.sharedLimits?.find((l) => l.window === 'rpd')?.limit;
}

async function paceAfterCall(snapModel: FreeTierModel | undefined, provider: FreeTierProvider | undefined): Promise<void> {
  const rpm = rpmLimit(snapModel, provider);
  const delay = rpm !== undefined && rpm > 0 ? Math.max(PACING_FLOOR_MS, Math.ceil(60000 / rpm)) : PACING_FLOOR_MS;
  await sleepMs(delay);
}

// ---------------------------------------------------------------------------
// corpus-source.json / corpus.json / verdicts.json persistence
// ---------------------------------------------------------------------------

function readCorpusSource(): { entries: CorpusSourceEntry[]; bytes: string; sourceVersion: string } {
  let bytes: string;
  try {
    bytes = readFileSync(CORPUS_SOURCE_PATH, 'utf8');
  } catch (err) {
    console.error(`Cannot read ${CORPUS_SOURCE_PATH}: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
  try {
    const entries = parseCorpusSource(JSON.parse(bytes));
    return { entries, bytes, sourceVersion: hashBytes(bytes) };
  } catch (err) {
    console.error(`corpus-source.json is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

function readCorpus(): { corpus: Corpus; corpusVersion: string } {
  let bytes: string;
  try {
    bytes = readFileSync(CORPUS_PATH, 'utf8');
  } catch (err) {
    console.error(
      `Cannot read ${CORPUS_PATH}: ${redact(toErrorMessage(err))}\n` +
        '  Run `--translate-weak` first — --judge needs corpus.json (good + weak translations).',
    );
    process.exit(1);
  }
  try {
    return { corpus: parseCorpus(JSON.parse(bytes)), corpusVersion: hashBytes(bytes) };
  } catch (err) {
    console.error(`corpus.json is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

function writeCorpus(corpus: Corpus): void {
  writeJsonAtomic(CORPUS_PATH, corpus);
}

interface CuratedFieldSet {
  injected?: Record<string, string>;
  defect?: Record<string, string>;
  arm?: Record<string, string>;
  cleanFlaw?: Record<string, string | null>;
}

/**
 * Reads whatever curated defect-injection fields (`injected`/`defect`/`arm`/
 * `cleanFlaw`) already exist in a prior corpus.json, by entry id.
 * `--translate-weak` only ever produces `good` (copied straight from
 * corpus-source.json) and a fresh `weak` — the curated fields come from a
 * separate defect-injection pass outside this tool (see
 * JUDGE-BENCH-NOTES.md) — so a re-run must carry them forward untouched
 * rather than silently dropping them back to nothing. Deliberately lenient
 * (raw JSON.parse, not `parseCorpus`): a missing, corrupt, or not-yet-
 * curated corpus.json is not an error here, just nothing to carry forward.
 */
function readCuratedFieldsForMerge(): Map<string, CuratedFieldSet> {
  const out = new Map<string, CuratedFieldSet>();
  if (!existsSync(CORPUS_PATH)) return out;
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(CORPUS_PATH, 'utf8'));
  } catch {
    return out;
  }
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return out;
  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  for (const e of entries) {
    if (!isRecord(e) || typeof e.id !== 'string') continue;
    const fields: CuratedFieldSet = {};
    if (isRecord(e.injected)) fields.injected = e.injected as Record<string, string>;
    if (isRecord(e.defect)) fields.defect = e.defect as Record<string, string>;
    if (isRecord(e.arm)) fields.arm = e.arm as Record<string, string>;
    if (isRecord(e.cleanFlaw)) fields.cleanFlaw = e.cleanFlaw as Record<string, string | null>;
    out.set(e.id, fields);
  }
  return out;
}

function readVerdictsFile(): VerdictsFile | undefined {
  if (!existsSync(VERDICTS_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(VERDICTS_PATH, 'utf8')) as VerdictsFile;
  } catch (err) {
    console.error(`verdicts.json is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

function writeVerdictsFile(file: VerdictsFile): void {
  writeJsonAtomic(VERDICTS_PATH, sortedVerdictsFile(file));
}

/**
 * reference.json is a required, already-committed input for `--score` (unlike
 * verdicts.json, it is never expected to be partial/in-flight), so a missing
 * or invalid file exits with a clear message rather than degrading — there is
 * nothing meaningful to score against without it.
 */
function readReferenceFile(): ReturnType<typeof parseReferenceFile> {
  let bytes: string;
  try {
    bytes = readFileSync(REFERENCE_PATH, 'utf8');
  } catch (err) {
    console.error(`Cannot read ${REFERENCE_PATH}: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
  try {
    return parseReferenceFile(JSON.parse(bytes));
  } catch (err) {
    console.error(`reference.json is invalid: ${redact(toErrorMessage(err))}`);
    process.exit(1);
  }
}

interface DetailEntry {
  issues?: Array<{ type: string; detail: string }>;
  suggestion?: string;
  usage?: unknown;
}
type DetailFile = Record<string, DetailEntry>;

function readDetailFile(): DetailFile {
  if (!existsSync(VERDICTS_DETAIL_PATH)) return {};
  try {
    return JSON.parse(readFileSync(VERDICTS_DETAIL_PATH, 'utf8')) as DetailFile;
  } catch {
    return {}; // local-only diagnostic file: corrupt/missing is non-fatal, just start fresh
  }
}

function writeDetailFile(file: DetailFile): void {
  const sorted: DetailFile = Object.fromEntries(Object.entries(file).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeJsonAtomic(VERDICTS_DETAIL_PATH, sorted);
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

async function buildModule(
  providerKey: string,
  modelId: string,
  snapModel: FreeTierModel,
  apiKey: string,
): Promise<TranslationModule> {
  const factory = await loadFactory(providerKey);
  const config: Record<string, unknown> =
    providerKey === 'deepl'
      ? { apiKey } // DeepL is classical MT, not an AI-SDK module.
      : {
          model: modelId,
          apiKey,
          // Mirrors freeway-benchmark.ts: disable the AI SDK's own internal retry loop so a
          // failing call costs exactly one request against the rpd budget, not up to 3.
          maxRetries: 0,
          ...(snapModel.useStructuredOutput !== undefined ? { useStructuredOutput: snapModel.useStructuredOutput } : {}),
        };
  return factory(config);
}

// ---------------------------------------------------------------------------
// --translate-weak
// ---------------------------------------------------------------------------

interface TranslatePlan {
  providerKey: string;
  modelId: string;
  snapModel: FreeTierModel;
  provider: FreeTierProvider;
  jobCount: number;
  chunkCount: number;
}

function buildTranslatePlan(
  snapshot: FreeTierSnapshot,
  weakModel: string,
  sourceEntries: CorpusSourceEntry[],
): TranslatePlan {
  const { providerKey, modelId } = parseModelKeyArg(weakModel, '--weak-model');
  const provider = snapshot.providers[providerKey];
  const snapModel = provider?.models.find((m) => m.id === modelId);
  if (!provider || !snapModel) {
    console.error(`--weak-model "${weakModel}" is not in the bundled free-tier snapshot.`);
    process.exit(1);
  }
  const jobCount = sourceEntries.length * JUDGE_LANGS.length; // one job per (entry, language)
  return { providerKey, modelId, snapModel, provider, jobCount, chunkCount: Math.ceil(jobCount / TRANSLATE_CHUNK_SIZE) };
}

function printTranslatePlan(plan: TranslatePlan, entryCount: number, apiKeyPresent: boolean): void {
  console.log(`Corpus-source: ${entryCount} entries x ${JUDGE_LANGS.length} language(s) = ${plan.jobCount} translation job(s).`);
  console.log(
    `Weak model: ${plan.providerKey}::${plan.modelId} (tier ${plan.snapModel.qualityTier}) — ` +
      `~${plan.chunkCount} translate request(s) — key ${apiKeyPresent ? 'present' : 'MISSING'}.`,
  );
  const rpd = rpdLimit(plan.snapModel, plan.provider);
  if (rpd !== undefined && plan.chunkCount > rpd) {
    console.log(`  WARNING: ${plan.chunkCount} planned request(s) exceeds this model's rpd of ${rpd}. The run will stop early rather than exceed it.`);
  } else if (rpd !== undefined) {
    console.log(`  rpd budget: ${plan.chunkCount}/${rpd} request(s).`);
  }
}

async function runTranslateWeak(args: CliArgs, snapshot: FreeTierSnapshot): Promise<void> {
  const { entries: sourceEntries, sourceVersion } = readCorpusSource();
  const plan = buildTranslatePlan(snapshot, args.weakModel, sourceEntries);

  const envPath = process.env.NARN_ENV_FILE ?? 'scripts/.env';
  const env = readEnvFile(envPath);
  const { report: keyReport, apiKeys } = buildKeyReport(env);
  printKeyReport(keyReport);
  console.log();

  const apiKey = apiKeys[plan.providerKey];
  if (args.plan) {
    printTranslatePlan(plan, sourceEntries.length, apiKey !== undefined);
    return;
  }
  if (!apiKey) {
    console.error(`No key present for --weak-model provider "${plan.providerKey}" (see key report above). Add it to ${envPath}.`);
    process.exit(1);
  }

  const mod = await buildModule(plan.providerKey, plan.modelId, plan.snapModel, apiKey);
  if (!mod.translate) {
    console.error(`Module "${plan.providerKey}" does not implement translate() (unexpected).`);
    process.exit(1);
  }

  const jobs: TranslationJob[] = [];
  for (const e of sourceEntries) {
    for (const lang of JUDGE_LANGS) {
      jobs.push({ entryId: e.id, sourceText: e.en, targetLanguage: lang, sourceLanguage: 'en' });
    }
  }

  const translated = new Map<string, Record<string, string>>(); // entryId -> lang -> text
  const rpd = rpdLimit(plan.snapModel, plan.provider);
  let requestsMade = 0;
  let hadFailure = false;

  console.log(`Translating ${jobs.length} job(s) with ${plan.providerKey}::${plan.modelId} in ${plan.chunkCount} chunk(s)...`);
  for (const chunk of chunkArray(jobs, TRANSLATE_CHUNK_SIZE)) {
    if (rpd !== undefined && requestsMade >= rpd) {
      console.error(`Hit ${plan.providerKey}::${plan.modelId}'s rpd (${rpd}) — stopping before exceeding it. Rerun tomorrow to finish (results so far are NOT written; corpus.json is all-or-nothing).`);
      hadFailure = true;
      break;
    }
    let results;
    try {
      results = await mod.translate(chunk, undefined);
      requestsMade++;
      await paceAfterCall(plan.snapModel, plan.provider);
    } catch (err) {
      requestsMade++;
      await paceAfterCall(plan.snapModel, plan.provider);
      console.error(`Translate chunk failed: ${redact(toErrorMessage(err))}`);
      hadFailure = true;
      break;
    }
    for (const r of results) {
      if (r.error !== undefined) {
        console.error(`  [${r.entryId}/${r.targetLanguage}] translate error: ${redact(r.error)}`);
        hadFailure = true;
        continue;
      }
      const forEntry = translated.get(r.entryId) ?? {};
      forEntry[r.targetLanguage] = r.translatedText;
      translated.set(r.entryId, forEntry);
    }
  }

  if (hadFailure) {
    console.error('Aborting without writing corpus.json — fix the error above and rerun (nothing was written, so this is safe to retry).');
    process.exitCode = 1;
    return;
  }

  // Carry forward any already-curated defect-injection fields from the corpus.json this run
  // is about to overwrite — --translate-weak only ever supplies good/weak, never
  // injected/defect/arm/cleanFlaw, and must not clobber a separately curated corpus.
  const curated = readCuratedFieldsForMerge();
  const preservedCount = sourceEntries.filter((e) => curated.has(e.id) && curated.get(e.id)!.arm).length;

  const entries: CorpusEntry[] = sourceEntries.map((e) => {
    const weak = translated.get(e.id);
    if (!weak || JUDGE_LANGS.some((lang) => typeof weak[lang] !== 'string')) {
      throw new Error(`internal: entry "${e.id}" is missing a weak translation after a clean run`);
    }
    const preserved = curated.get(e.id);
    const entry: CorpusEntry = { ...e, weak };
    if (preserved?.injected) entry.injected = preserved.injected;
    if (preserved?.defect) entry.defect = preserved.defect as Record<string, DefectType>;
    if (preserved?.arm) entry.arm = preserved.arm as Record<string, 'clean' | 'injected'>;
    if (preserved?.cleanFlaw) entry.cleanFlaw = preserved.cleanFlaw as Record<string, DefectType | null>;
    return entry;
  });

  writeCorpus({
    version: 1,
    sourceVersion,
    weakModel: `${plan.providerKey}::${plan.modelId}`,
    generatedAt: new Date().toISOString(),
    entries,
  });
  console.log(`\nWrote ${CORPUS_PATH} (${entries.length} entries, ${requestsMade} request(s) made).`);
  if (preservedCount > 0) {
    console.log(`Carried forward curated defect-injection fields (injected/defect/arm/cleanFlaw) for ${preservedCount}/${entries.length} entries from the prior corpus.json.`);
  } else if (curated.size > 0) {
    console.log('No curated defect-injection fields (arm/injected/defect/cleanFlaw) found in the prior corpus.json — this corpus is NOT judgeable yet (--judge needs them; see JUDGE-BENCH-NOTES.md).');
  }
}

// ---------------------------------------------------------------------------
// --judge
// ---------------------------------------------------------------------------

interface JudgeCandidate {
  providerKey: string;
  modelId: string;
  snapModel: FreeTierModel;
  provider: FreeTierProvider;
}

/**
 * Every model in the snapshot whose module implements judgeTranslations,
 * excluding deepl/copilot — see file header. Exported for `--score`, which
 * needs the full expected candidate list to report models verdicts.json
 * hasn't collected yet, without duplicating this selection logic (that call
 * passes `skipFilter: undefined` — skipping is a `--judge`-only concept).
 * `skipFilter` is applied AFTER `modelsFilter`, so a model named in both ends
 * up excluded either way.
 */
export function judgeCandidates(
  snapshot: FreeTierSnapshot,
  modelsFilter: string[] | undefined,
  skipFilter?: string[],
): JudgeCandidate[] {
  const wanted = modelsFilter ? new Set(modelsFilter) : undefined;
  const skipped = skipFilter ? new Set(skipFilter) : undefined;
  const out: JudgeCandidate[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    if (!MODULE_ENTRY[providerKey]) continue; // copilot (no key path) or any future non-candidate provider
    if (NOT_JUDGE_CAPABLE.has(providerKey)) continue;
    for (const model of provider.models) {
      const key = modelKey(providerKey, model.id);
      if (wanted && !wanted.has(key)) continue;
      if (skipped?.has(key)) continue;
      out.push({ providerKey, modelId: model.id, snapModel: model, provider });
    }
  }
  return out;
}

/** Requests needed for ONE run: 50 items (25 fr + 25 ja) chunked at JUDGE_BATCH_SIZE. */
function requestsPerRun(reviewItemCount: number): number {
  return Math.ceil(reviewItemCount / JUDGE_BATCH_SIZE);
}

interface JudgePlanRow {
  candidate: JudgeCandidate;
  alreadyDoneRuns: number;
  runsToDo: number;
  requestsPlanned: number;
  rpd: number | undefined;
  exceedsRpd: boolean;
}

/**
 * Per-run request estimate accounts for PARTIAL prior progress: a run that
 * already has 30/50 items recorded (left behind by an earlier interrupted
 * invocation — see RATE_LIMIT_WAIT_CAP_MS / writeJsonAtomic) only needs
 * ceil(20/JUDGE_BATCH_SIZE) more requests, not a fresh ceil(50/JUDGE_BATCH_SIZE).
 * A brand-new run (no prior data) is the common case and still lands on the
 * old flat estimate, since `pending.length` is then the full 50.
 */
function buildJudgePlan(
  candidates: JudgeCandidate[],
  runs: number,
  dispatchOrder: DispatchItem[],
  existing: VerdictsFile | undefined,
  refresh: boolean,
): JudgePlanRow[] {
  return candidates.map((candidate) => {
    let alreadyDoneRuns = 0;
    let runsToDo = 0;
    let requestsPlanned = 0;
    for (let run = 1; run <= runs; run++) {
      const pending = pendingRunItems(
        candidate.providerKey,
        candidate.modelId,
        run,
        dispatchOrder,
        refresh ? undefined : existing?.verdicts,
      );
      if (pending.length === 0) {
        alreadyDoneRuns++;
      } else {
        runsToDo++;
        requestsPlanned += requestsPerRun(pending.length);
      }
    }
    const rpd = rpdLimit(candidate.snapModel, candidate.provider);
    return { candidate, alreadyDoneRuns, runsToDo, requestsPlanned, rpd, exceedsRpd: rpd !== undefined && requestsPlanned > rpd };
  });
}

/**
 * Per-language clean/injected counts + defect-type spread, read straight off
 * the review corpus (which is itself a straight read of the corpus's own
 * `arm`/`defect` fields — see buildReviewCorpus). Printed unconditionally
 * (both --plan and a real run) so a stale/mismatched corpus is visible
 * before any network call, the same way freeway-benchmark always prints its
 * key-presence report in both modes.
 */
function printCorpusSummary(reviewCorpora: Record<JudgeLang, ReviewItem[]>): void {
  const totalItems = JUDGE_LANGS.reduce((sum, lang) => sum + reviewCorpora[lang].length, 0);
  const totalClean = JUDGE_LANGS.reduce((sum, lang) => sum + reviewCorpora[lang].filter((i) => i.arm === 'clean').length, 0);
  console.log(
    `Review corpus: ${JUDGE_LANGS.map((l) => `${l}=${reviewCorpora[l].length}`).join(', ')} ` +
      `(${totalItems} pairs total; ${totalClean} clean + ${totalItems - totalClean} injected).`,
  );
  for (const lang of JUDGE_LANGS) {
    const items = reviewCorpora[lang];
    const cleanCount = items.filter((i) => i.arm === 'clean').length;
    const injectedCount = items.length - cleanCount;
    const spread = new Map<DefectType, number>();
    for (const item of items) {
      if (item.arm !== 'injected') continue;
      spread.set(item.defect, (spread.get(item.defect) ?? 0) + 1);
    }
    const spreadText = DEFECT_TYPES.filter((d) => spread.has(d))
      .map((d) => `${d}=${spread.get(d)}`)
      .join(', ');
    const flawedClean = items.filter((i) => i.arm === 'clean' && i.cleanFlaw !== null).length;
    console.log(
      `  ${lang}: ${cleanCount} clean / ${injectedCount} injected — defect spread: ${spreadText || '(none)'}` +
        (flawedClean > 0 ? ` — NOTE: ${flawedClean} "clean" item(s) carry a known cleanFlaw (not actually defect-free)` : ''),
    );
  }
}

const DISPATCH_PREVIEW_COUNT = 12;

/**
 * Shows the actual per-request order (see buildDispatchOrder) so a stale or
 * accidentally-block-ordered corpus is visible before any network call —
 * printed unconditionally, same convention as printKeyReport/printCorpusSummary.
 */
function printDispatchOrderPreview(dispatchOrder: DispatchItem[]): void {
  const n = Math.min(DISPATCH_PREVIEW_COUNT, dispatchOrder.length);
  console.log(`Dispatch order (interleaved by category + language; first ${n}/${dispatchOrder.length} shown):`);
  dispatchOrder.slice(0, n).forEach(({ lang, item }, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${item.id} (${lang}, ${itemCategory(item)})`);
  });
}

function printJudgePlan(
  plan: JudgePlanRow[],
  apiKeys: Record<string, string>,
  incompleteRuns: Record<string, IncompleteRunRecord> | undefined,
): void {
  console.log('Judge request plan (per model, this invocation):');
  let grandTotal = 0;
  for (const row of plan) {
    const key = modelKey(row.candidate.providerKey, row.candidate.modelId);
    const hasKey = apiKeys[row.candidate.providerKey] !== undefined;
    const rpdText = row.rpd !== undefined ? `rpd=${row.rpd}` : 'rpd=unbounded';
    console.log(
      `  ${key.padEnd(48)} ${row.runsToDo} run(s) to do (${row.alreadyDoneRuns} already done) ` +
        `-> ~${row.requestsPlanned} request(s), ${rpdText}` +
        (hasKey ? '' : ' [NO KEY]') +
        (row.exceedsRpd ? '  *** EXCEEDS RPD — this model will be capped mid-run, not fully judged ***' : ''),
    );
    grandTotal += row.requestsPlanned;
  }
  console.log(`\nTotal planned requests across ${plan.length} model(s): ~${grandTotal}.`);
  if (incompleteRuns && Object.keys(incompleteRuns).length > 0) {
    console.log(`\n${Object.keys(incompleteRuns).length} run(s) left INCOMPLETE by a prior invocation (this plan already counts only what's still missing):`);
    for (const [k, rec] of Object.entries(incompleteRuns).sort(([a], [b]) => (a < b ? -1 : 1))) {
      console.log(`  ${k}: ${rec.itemsDone}/${rec.itemsTotal} item(s) — ${rec.reason}`);
    }
  }
  const missingKeys = plan.filter((r) => apiKeys[r.candidate.providerKey] === undefined);
  if (missingKeys.length > 0) {
    const providers = [...new Set(missingKeys.map((r) => r.candidate.providerKey))];
    console.log(`Missing key for: ${providers.join(', ')} — those models will be skipped in a real run.`);
  }
}

async function runJudge(args: CliArgs, snapshot: FreeTierSnapshot): Promise<void> {
  // The cap is a default, not a law: a provider whose free tier answers once every
  // few minutes needs a bigger budget than one that answers instantly, and which is
  // which is only knowable per invocation. --wait-cap raises it for those runs.
  const waitCapMs = args.waitCapMs ?? RATE_LIMIT_WAIT_CAP_MS;
  const { corpus, corpusVersion } = readCorpus();
  // --judge needs the curated defect-injection fields (injected/defect/arm/cleanFlaw) on
  // every entry — --translate-weak alone can never produce them (see requireCuratedEntries).
  const curatedEntries = requireCuratedEntries(corpus.entries);

  const reviewCorpora: Record<JudgeLang, ReviewItem[]> = {
    fr: buildReviewCorpus(curatedEntries, 'fr'),
    ja: buildReviewCorpus(curatedEntries, 'ja'),
  };
  const entryById = new Map(curatedEntries.map((e) => [e.id, e]));
  // The actual per-request dispatch order — interleaved across defect category AND
  // language so any prefix (in particular the items an abandoned model manages to see
  // before hitting RATE_LIMIT_WAIT_CAP_MS/rpd) is a representative cross-section, not one
  // corpus-order block. Computed ONCE per invocation and reused everywhere below (the
  // plan, the real dispatch loop, and what gets persisted to verdicts.json) so every
  // consumer agrees on exactly the same sequence.
  const dispatchOrder = buildDispatchOrder(reviewCorpora);

  const candidates = judgeCandidates(snapshot, args.models, args.skipModels);
  if (candidates.length === 0) {
    console.error('No judge-capable candidates matched (check --models, and that the provider is not deepl/copilot).');
    process.exit(1);
  }

  const envPath = process.env.NARN_ENV_FILE ?? 'scripts/.env';
  const env = readEnvFile(envPath);
  const { report: keyReport, apiKeys } = buildKeyReport(env);
  printKeyReport(keyReport);
  console.log();
  printCorpusSummary(reviewCorpora);
  console.log();
  printDispatchOrderPreview(dispatchOrder);
  console.log();

  const existing = readVerdictsFile();
  const plan = buildJudgePlan(candidates, args.runs, dispatchOrder, existing, args.refresh);

  if (args.plan) {
    printJudgePlan(plan, apiKeys, existing?.incompleteRuns);
    return;
  }

  // Trim to exactly what VerdictsFile.reviewCorpus needs — the reviewed TEXT is deliberately
  // NOT duplicated here (it's derivable from corpus.json's good/injected + this same arm), so
  // verdicts.json stays lean and never drifts out of sync with corpus.json's own strings.
  const reviewCorpusForFile: VerdictsFile['reviewCorpus'] = {
    fr: reviewCorpora.fr.map(({ id, arm, defect, cleanFlaw }) => ({ id, arm, defect, cleanFlaw })),
    ja: reviewCorpora.ja.map(({ id, arm, defect, cleanFlaw }) => ({ id, arm, defect, cleanFlaw })),
  };
  // Persisted verbatim so a later reader can reconstruct exactly what any given (possibly
  // partial) run was shown without re-deriving buildDispatchOrder themselves.
  const dispatchOrderForFile: VerdictsFile['dispatchOrder'] = dispatchOrder.map(({ lang, item }) => ({ lang, entryId: item.id }));
  const verdictsFile: VerdictsFile = existing
    ? { ...existing, corpusVersion, reviewCorpus: reviewCorpusForFile, dispatchOrder: dispatchOrderForFile }
    : {
        version: 1,
        corpusVersion,
        reviewCorpus: reviewCorpusForFile,
        dispatchOrder: dispatchOrderForFile,
        verdicts: {},
      };
  const detailFile = readDetailFile();
  const totalItemsPerRun = dispatchOrder.length;

  console.log(`Judging with ${plan.length} model(s), ${args.runs} run(s) each (default unless overridden).\n`);

  for (const row of plan) {
    const { candidate } = row;
    const key = modelKey(candidate.providerKey, candidate.modelId);
    const apiKey = apiKeys[candidate.providerKey];
    if (!apiKey) {
      console.error(`[${key}] skipped — no key for provider "${candidate.providerKey}".`);
      continue;
    }
    if (row.runsToDo === 0) {
      console.log(`[${key}] nothing to do (${row.alreadyDoneRuns}/${args.runs} run(s) already in verdicts.json).`);
      continue;
    }

    let mod: TranslationModule;
    try {
      mod = await buildModule(candidate.providerKey, candidate.modelId, candidate.snapModel, apiKey);
    } catch (err) {
      console.error(`[${key}] failed to load module: ${redact(toErrorMessage(err))}`);
      continue;
    }
    const judgeFn = mod.judgeTranslations;
    if (!judgeFn) {
      console.error(`[${key}] module does not implement judgeTranslations (unexpected for a judge candidate) — skipped.`);
      continue;
    }

    const rpd = rpdLimit(candidate.snapModel, candidate.provider);
    let requestsMadeThisModel = 0;
    let modelAbandoned = false;

    for (let run = 1; run <= args.runs; run++) {
      if (modelAbandoned) break;
      // Item-granularity resume: only the entries THIS run is still missing a verdict for —
      // a run an earlier invocation abandoned partway through only re-requests the shortfall.
      const pending = pendingRunItems(
        candidate.providerKey,
        candidate.modelId,
        run,
        dispatchOrder,
        args.refresh ? undefined : verdictsFile.verdicts,
      );
      if (pending.length === 0) continue; // already fully recorded (resumed, or completed earlier this run)
      const itemsAlreadyDone = totalItemsPerRun - pending.length;

      let elapsedMsThisRun = 0;
      let itemsDoneThisAttempt = 0;
      let abandonReason: string | undefined;

      for (const pendingChunk of chunkArray(pending, JUDGE_BATCH_SIZE)) {
        if (rpd !== undefined && requestsMadeThisModel >= rpd) {
          abandonReason = `rpd (${rpd}) reached`;
          console.error(`[${key}] hit rpd (${rpd}) — stopping this model here; remaining items stay unrecorded and resumable.`);
          modelAbandoned = true;
          break;
        }
        // Fix for the incident: the shared judge layer's internal transient retry honors a
        // provider's Retry-After (observed: "Please retry in 59.586s"), which can burn most of
        // a minute PER CHUNK on a 429/503-heavy model with nothing to show for it. Bound each
        // chunk's wait to whatever's left of this run's budget via AbortSignal — a real timeout,
        // not just a post-hoc check — so a single very slow chunk is itself capped, not only the
        // chunk after it.
        const remainingBudgetMs = waitCapMs - elapsedMsThisRun;
        if (remainingBudgetMs <= 0) {
          abandonReason = `exceeded the ${waitCapMs}ms cumulative rate-limit wait budget for this run`;
          console.error(`[${key}] rate-limit wait budget (${waitCapMs}ms) exhausted for run ${run} — abandoning remaining work for this model.`);
          modelAbandoned = true;
          break;
        }

        const chunk: JudgeItem[] = pendingChunk.map(({ lang, item }) => {
          const entry = entryById.get(item.id)!;
          return { entryId: item.id, targetLanguage: lang, sourceText: entry.en, translatedText: item.text, sourceLanguage: 'en' };
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), remainingBudgetMs);
        const startedAt = Date.now();
        let chunkVerdicts: JudgeVerdict[] | undefined;
        let unexpectedError: string | undefined;
        try {
          chunkVerdicts = await judgeFn.call(mod, chunk, controller.signal);
        } catch (err) {
          // An abort we requested surfaces here as a rejection too — only treat it as an
          // "unexpected" error (distinct from budget exhaustion) if we did NOT abort it.
          if (!controller.signal.aborted) unexpectedError = redact(toErrorMessage(err));
        } finally {
          clearTimeout(timer);
        }
        const elapsedThisChunk = Date.now() - startedAt;
        elapsedMsThisRun += elapsedThisChunk;
        // A call was attempted (and, per RATE_LIMIT_WAIT_CAP_MS's comment, may have reached the
        // provider even if we gave up waiting on it) either way — count it against rpd regardless
        // of outcome, same conservative "spend counts even on failure" convention as --translate-weak.
        requestsMadeThisModel++;

        if (chunkVerdicts === undefined) {
          if (unexpectedError !== undefined) {
            // judgeTranslations is documented to never throw (every failure resolves as a
            // per-item .error verdict instead — see packages/shared/src/ai-sdk-provider/
            // llm-module.ts's runJudgeFeature), so a genuine throw here is unexpected — but
            // it's still a network call, so treat it the same as a budget trip: stop this
            // model, not the whole run.
            abandonReason = `unexpected error: ${unexpectedError}`;
            console.error(`[${key}] judge call threw unexpectedly: ${unexpectedError} — stopping this model.`);
          } else {
            abandonReason = `a chunk was aborted after ${elapsedThisChunk}ms — exceeded the ${waitCapMs}ms wait budget for this run (provider is likely rate-limited)`;
            console.error(`[${key}] chunk timed out after ${elapsedThisChunk}ms (budget cap ${waitCapMs}ms) — abandoning remaining work for this model.`);
          }
          modelAbandoned = true;
          break;
        }

        const verdictByEntryLang = new Map(chunkVerdicts.map((v) => [`${v.entryId}::${v.targetLanguage}`, v]));
        for (const { lang, item } of pendingChunk) {
          const k = verdictKey(candidate.providerKey, candidate.modelId, run, lang, item.id);
          const base = { arm: item.arm, defect: item.defect, cleanFlaw: item.cleanFlaw };
          const v = verdictByEntryLang.get(`${item.id}::${lang}`);
          if (v === undefined) {
            verdictsFile.verdicts[k] = { ...base, malformed: true, error: 'judge returned no verdict for this item' };
          } else if (v.error !== undefined) {
            verdictsFile.verdicts[k] = { ...base, malformed: true, error: redact(v.error) };
          } else {
            verdictsFile.verdicts[k] = {
              ...base,
              verdict: v.verdict,
              score: v.score,
              issues: v.issues.map((i) => i.type),
              malformed: false,
            };
            if (v.issues.length > 0 || v.suggestion !== undefined || v.usage !== undefined) {
              detailFile[k] = {
                ...(v.issues.length > 0 ? { issues: v.issues } : {}),
                ...(v.suggestion !== undefined ? { suggestion: v.suggestion } : {}),
                ...(v.usage !== undefined ? { usage: v.usage } : {}),
              };
            }
          }
          itemsDoneThisAttempt++;
        }
        // Persist after EVERY chunk, not once per run — this is the fix for the incident: a
        // process killed here (timeout, OOM, ^C) leaves every already-judged item on disk,
        // and the next invocation's `pendingRunItems` genuinely skips them rather than
        // re-spending quota on work already paid for.
        writeVerdictsFile(verdictsFile);
        writeDetailFile(detailFile);
        await paceAfterCall(candidate.snapModel, candidate.provider);
      }

      const runKey = incompleteRunKey(candidate.providerKey, candidate.modelId, run);
      if (abandonReason !== undefined) {
        verdictsFile.incompleteRuns = verdictsFile.incompleteRuns ?? {};
        const itemsDone = itemsAlreadyDone + itemsDoneThisAttempt;
        verdictsFile.incompleteRuns[runKey] = { reason: abandonReason, ts: Date.now(), itemsDone, itemsTotal: totalItemsPerRun };
        writeVerdictsFile(verdictsFile);
        console.error(`[${key}] run ${run}: INCOMPLETE — ${itemsDone}/${totalItemsPerRun} item(s) recorded (${abandonReason}).`);
      } else {
        if (verdictsFile.incompleteRuns?.[runKey]) {
          // A later invocation with more quota finished what an earlier one abandoned —
          // the marker described a past state that no longer applies.
          delete verdictsFile.incompleteRuns[runKey];
          if (Object.keys(verdictsFile.incompleteRuns).length === 0) delete verdictsFile.incompleteRuns;
          writeVerdictsFile(verdictsFile);
        }
        console.log(`[${key}] run ${run}/${args.runs} done (${requestsMadeThisModel} request(s) so far for this model).`);
      }
    }
  }

  console.log(`\nWrote ${VERDICTS_PATH}.`);
}

// ---------------------------------------------------------------------------
// --score: pure analysis, no network. Reads verdicts.json + reference.json,
// writes scores.json, prints a ranked table.
// ---------------------------------------------------------------------------

const DEFECT_COLUMN_ORDER: readonly DefectType[] = DEFECT_TYPES;

function pct(x: number | null): string {
  return x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`;
}

function num1(x: number | null): string {
  return x === null ? 'n/a' : x.toFixed(1);
}

function printOverview(report: ScoreReport): void {
  console.log(
    `Reference: ${report.totalReferenceItems} item(s), ${report.totalReferenceFails} true fail(s) ` +
      `(${report.cleanArmReferenceFailKeys.length} of those sit in the "clean" arm — a supposedly-good ` +
      `reference that turned out flawed: ${report.cleanArmReferenceFailKeys.join(', ')}).`,
  );
  console.log(`Models scored: ${report.presentModels.length} (${report.presentModels.join(', ') || '(none)'}).`);
  if (report.missingModels.length > 0) {
    console.log(`Models with no data yet in verdicts.json: ${report.missingModels.length} (${report.missingModels.join(', ')}).`);
  }
  console.log(
    `A model must have a USABLE verdict for >=${(COMPARABLE_THRESHOLD * 100).toFixed(0)}% of the applicable corpus ` +
      `to be ranked as "comparable" below — a model interrupted mid-collection (rate limit/rpd cap) is listed ` +
      `separately as partial coverage, never ranked by F1 alongside a fully-reviewed model. ` +
      `"n/a" means the model was never meaningfully tested on that signal; "0.0%" means it was tested and missed every time — these are never the same thing.`,
  );
}

function f1Str(x: number | null): string {
  return x === null ? 'n/a' : x.toFixed(3);
}

function printRankingRow(nameWidth: number, r: ModelMetrics, label: string): void {
  console.log(
    `  ${label.padEnd(5)}${r.modelKey.padEnd(nameWidth + 2)}${f1Str(r.f1).padStart(6)}${pct(r.recall).padStart(8)}` +
      `${pct(r.precision).padStart(11)}${pct(r.falsePositiveRate).padStart(8)}${pct(r.stability).padStart(11)}` +
      `${pct(r.coverage).padStart(10)}${num1(r.scoreMae).padStart(7)}  ${pct(r.reviewedFraction).padStart(6)} (${r.itemsReviewed}/${r.totalItemsInScope})`,
  );
}

/**
 * Splits into two blocks — comparable models ranked by F1, then
 * partial-coverage models listed separately (never interleaved into the
 * same rank order, even though `rows` already sorts comparable-first —
 * printing them as visually distinct tables is what actually keeps a
 * reader from mistaking a 10-item slice for a 50-item evaluation).
 */
function printRankingTable(title: string, rows: ModelMetrics[]): void {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log('  (no models to rank)');
    return;
  }
  const nameWidth = Math.max(5, ...rows.map((r) => r.modelKey.length));
  const header =
    `  ${'Rank'.padEnd(5)}${'Model'.padEnd(nameWidth + 2)}${'F1'.padStart(6)}${'Recall'.padStart(8)}` +
    `${'Precision'.padStart(11)}${'FPR'.padStart(8)}${'Stability'.padStart(11)}${'Coverage'.padStart(10)}${'MAE'.padStart(7)}` +
    `  ${'Reviewed'.padStart(6)}`;

  const comparableRows = rows.filter((r) => r.comparable);
  const partialRows = rows.filter((r) => !r.comparable);

  if (comparableRows.length > 0) {
    console.log(header);
    comparableRows.forEach((r, i) => printRankingRow(nameWidth, r, String(i + 1)));
  } else {
    console.log('  (no comparable models — every model below reviewed too little of the corpus to rank)');
  }

  if (partialRows.length > 0) {
    console.log(
      `\n  Partial coverage — NOT comparable (reviewed <${(COMPARABLE_THRESHOLD * 100).toFixed(0)}% of the corpus; excluded from the ranking above):`,
    );
    console.log(header);
    partialRows.forEach((r) => printRankingRow(nameWidth, r, '-'));
  }
}

function printDefectMatrix(rows: ModelMetrics[]): void {
  console.log('\nPer-defect-type recall (catch rate; ranked by overall F1):');
  if (rows.length === 0) {
    console.log('  (no models to show)');
    return;
  }
  const nameWidth = Math.max(5, ...rows.map((r) => r.modelKey.length));
  const colWidth = Math.max(...DEFECT_COLUMN_ORDER.map((d) => d.length)) + 3;
  console.log(`  ${'Model'.padEnd(nameWidth + 2)}${DEFECT_COLUMN_ORDER.map((d) => d.padStart(colWidth)).join('')}`);
  for (const r of rows) {
    console.log(
      `  ${r.modelKey.padEnd(nameWidth + 2)}${DEFECT_COLUMN_ORDER.map((d) => pct(r.perDefectRecall[d]).padStart(colWidth)).join('')}`,
    );
  }
}

function printCleanArmHighlight(rows: ModelMetrics[]): void {
  console.log('\nReal defects found in supposedly-good ("clean" arm) output — the hardest signal in the corpus:');
  if (rows.length === 0) {
    console.log('  (no models to show)');
    return;
  }
  const nameWidth = Math.max(5, ...rows.map((r) => r.modelKey.length));
  for (const r of rows) {
    const ratio = `${r.cleanArmReferenceFailCaught}/${r.cleanArmReferenceFailDenominator}`;
    console.log(`  ${r.modelKey.padEnd(nameWidth + 2)}${pct(r.cleanArmReferenceFailRecall).padStart(8)}  (${ratio} caught)`);
  }
}

function printLanguageSplit(byLanguage: ScoreReport['byLanguage']): void {
  for (const lang of JUDGE_LANGS) {
    printRankingTable(`Per-language split: ${lang}`, byLanguage[lang]);
  }
}

function runScore(): void {
  const verdictsFile = readVerdictsFile();
  const referenceFile = readReferenceFile();
  const snapshot = getFreeTierSnapshot();
  const expectedModelKeys = judgeCandidates(snapshot, undefined).map((c) => modelKey(c.providerKey, c.modelId));

  if (!verdictsFile) {
    console.log(`No ${VERDICTS_PATH} found yet — nothing to score. Run --judge first (partial data is fine; --score handles it).`);
  }

  const report = computeScoreReport(verdictsFile, referenceFile, expectedModelKeys);
  writeJsonAtomic(SCORES_PATH, report);

  printOverview(report);
  printRankingTable('Ranking (by F1, descending):', report.overall);
  printDefectMatrix(report.overall);
  printCleanArmHighlight(report.overall);
  printLanguageSplit(report.byLanguage);

  console.log(`\nWrote ${SCORES_PATH}.`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.score) {
    runScore();
    return;
  }

  const snapshot = getFreeTierSnapshot();
  if (args.translateWeak) {
    await runTranslateWeak(args, snapshot);
    return;
  }
  await runJudge(args, snapshot);
}

main().catch((err: unknown) => {
  console.error(`Unexpected error: ${redact(toErrorMessage(err))}`);
  process.exitCode = 1;
});
