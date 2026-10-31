/**
 * Checks the bundled Freeway free-tier snapshot against the live providers.
 *
 *   make freeway-refresh                       report only, writes nothing
 *   make freeway-refresh FLAGS=--probe-candidates
 *   make freeway-refresh FLAGS="--write-suggestion scripts/freeway-refresh/suggested.local.json"
 *   make freeway-refresh FLAGS=--apply-retired
 *
 * Makes real provider calls, and each probe spends one request of free quota.
 * Keys are read only from the file named by NARN_ENV_FILE (default scripts/.env),
 * only under their three provider names, and are never printed. Logic lives in
 * freeway-refresh/lib.ts.
 *
 * Exits 0 with a report, including when --apply-retired refuses; non-zero only
 * for script errors.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  REFRESH_PROVIDERS,
  checkApply,
  formatReport,
  pickKeys,
  retiredSnapshot,
  runProvider,
  sanitizeText,
  suggestedSnapshot,
  type HttpRequest,
  type HttpResponse,
  type RefreshProvider,
  type RefreshSnapshot,
} from './freeway-refresh/lib.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENV_FILE = path.join(SCRIPT_DIR, '.env');
const SNAPSHOT_PATH = path.join(
  SCRIPT_DIR,
  '..',
  'packages',
  'shared',
  'src',
  'freeway',
  'free-tier-data.json',
);

const USAGE = `Usage: tsx scripts/freeway-refresh.ts [options]

  (no options)               Report only. Lists each provider and probes every snapshot model once.
  --probe-candidates         Also probe plausible new models (capped per provider).
  --write-suggestion <path>  Write a snapshot minus confirmed retirements. The path must be gitignored.
  --apply-retired            Remove confirmed retirements from the real snapshot. Refuses if any
                             provider's status is not ok, or a provider would lose more than half
                             its models.
  --help, -h                 Print this usage.
`;

interface CliArgs {
  probeCandidates: boolean;
  applyRetired: boolean;
  suggestionPath?: string;
}

function parseArgs(argv: string[]): CliArgs | undefined {
  const args: CliArgs = { probeCandidates: false, applyRetired: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return undefined;
    } else if (arg === '--probe-candidates') {
      args.probeCandidates = true;
    } else if (arg === '--apply-retired') {
      args.applyRetired = true;
    } else if (arg === '--write-suggestion') {
      const value = argv[++i];
      if (!value) throw new Error('--write-suggestion requires a path');
      args.suggestionPath = path.resolve(value);
    } else {
      throw new Error(`Unknown flag: ${arg} (see --help)`);
    }
  }
  return args;
}

function readKeys(): Partial<Record<RefreshProvider, string>> {
  const named = process.env.NARN_ENV_FILE;
  const file = named || DEFAULT_ENV_FILE;
  if (!named && !existsSync(file)) return {};
  return pickKeys(readFileSync(file, 'utf8'));
}

/** Refuses a tracked or trackable path, so a suggestion cannot be committed by accident. */
function assertIgnored(target: string): void {
  const res = spawnSync('git', ['check-ignore', '-q', target], {
    cwd: path.dirname(target),
    stdio: 'ignore',
  });
  if (res.error) throw new Error(`Cannot check ${target}: ${res.error.message}`);
  if (res.status === 1)
    throw new Error(
      `${target} is not gitignored. Use a *.local.json path under scripts/freeway-refresh/.`,
    );
}

async function realHttp(req: HttpRequest): Promise<HttpResponse> {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}),
    signal: AbortSignal.timeout(req.timeoutMs),
    redirect: 'error',
  });
  const text = await res.text();
  return { status: res.status, text, header: (name) => res.headers.get(name) };
}

async function formatJson(value: unknown): Promise<string> {
  const prettier = await import('prettier');
  const config = await prettier.resolveConfig(SNAPSHOT_PATH);
  return prettier.format(JSON.stringify(value, null, 2), { ...config, parser: 'json' });
}

async function main(secrets: string[]): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) return;
  if (args.suggestionPath) assertIgnored(args.suggestionPath);

  const keys = readKeys();
  secrets.push(...Object.values(keys));
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as RefreshSnapshot;
  const deps = {
    http: realHttp,
    sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  };

  const reports = await Promise.all(
    REFRESH_PROVIDERS.map((provider) =>
      runProvider(
        {
          provider,
          snapshotProvider: snapshot.providers[provider] ?? { moduleId: provider, models: [] },
          apiKey: keys[provider],
          probeCandidates: args.probeCandidates,
        },
        deps,
      ),
    ),
  );
  console.log(formatReport(reports));

  if (args.suggestionPath) {
    writeFileSync(args.suggestionPath, await formatJson(suggestedSnapshot(snapshot, reports)));
    console.log(`\nSuggestion written to ${args.suggestionPath}`);
  }

  if (args.applyRetired) {
    const retiredCount = reports.reduce((n, r) => n + r.retired.length, 0);
    const verdict = checkApply(snapshot, reports);
    if (!verdict.allowed) {
      console.log(
        `\n--apply-retired REFUSED, snapshot unchanged:\n  ${verdict.reasons.join('\n  ')}`,
      );
    } else if (retiredCount === 0) {
      console.log('\n--apply-retired: nothing confirmed retired, snapshot unchanged.');
    } else {
      const today = new Date().toISOString().slice(0, 10);
      writeFileSync(SNAPSHOT_PATH, await formatJson(retiredSnapshot(snapshot, reports, today)));
      console.log(`\n--apply-retired: removed ${retiredCount} model(s) from ${SNAPSHOT_PATH}`);
    }
  }
}

const secrets: string[] = [];
main(secrets).catch((err: unknown) => {
  console.error(
    `freeway-refresh failed: ${sanitizeText(err instanceof Error ? err.message : String(err), secrets)}`,
  );
  process.exit(1);
});
