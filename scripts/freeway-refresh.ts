/**
 * Checks the bundled Freeway free-tier snapshot against the live providers.
 *
 *   make freeway-refresh                       report only, writes nothing
 *   make freeway-refresh FLAGS=--probe-candidates
 *   make freeway-refresh FLAGS="--write-suggestion scripts/freeway-refresh/suggested.local.json"
 *   make freeway-refresh FLAGS=--apply-retired
 *   make freeway-refresh FLAGS=--stamp-checked
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
  readBodyCapped,
  retiredSnapshot,
  runProvider,
  sanitizeText,
  stampChecked,
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

/** Far above any real model list, which runs to a few megabytes at most. */
const MAX_BODY_BYTES = 32 * 1024 * 1024;

const USAGE = `Usage: tsx scripts/freeway-refresh.ts [options]

  (no options)               Report only. Lists each provider and probes every snapshot model once.
  --probe-candidates         Also probe plausible new models (capped per provider).
  --write-suggestion <path>  Write a snapshot minus confirmed retirements. The path must be gitignored.
  --apply-retired            Remove confirmed retirements from the real snapshot. Refuses if any
                             provider's status is not ok, or a provider would lose more than half
                             its models. Records the check even when nothing is removed.
  --stamp-checked            Record today as lastCheckedAt in the real snapshot, only if every
                             provider's status is ok.
  --help, -h                 Print this usage.
`;

interface CliArgs {
  probeCandidates: boolean;
  applyRetired: boolean;
  stampChecked: boolean;
  suggestionPath?: string;
}

function parseArgs(argv: string[]): CliArgs | undefined {
  const args: CliArgs = { probeCandidates: false, applyRetired: false, stampChecked: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      return undefined;
    } else if (arg === '--probe-candidates') {
      args.probeCandidates = true;
    } else if (arg === '--apply-retired') {
      args.applyRetired = true;
    } else if (arg === '--stamp-checked') {
      args.stampChecked = true;
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
  const text = await readBodyCapped(res.body, MAX_BODY_BYTES);
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

  const today = new Date().toISOString().slice(0, 10);
  let toWrite: RefreshSnapshot | undefined;
  if (args.applyRetired) {
    const retiredCount = reports.reduce((n, r) => n + r.retired.length, 0);
    const unresolvedCount = reports.reduce((n, r) => n + r.unresolved.length, 0);
    const unconfirmedCount = reports.reduce((n, r) => n + r.retiredUnconfirmed.length, 0);
    const counts = `${unresolvedCount} unresolved, ${unconfirmedCount} unconfirmed, neither removed`;
    const verdict = checkApply(snapshot, reports);
    if (verdict.allowed) {
      toWrite = retiredSnapshot(snapshot, reports, today);
      console.log(`\n--apply-retired: removed ${retiredCount} model(s) (${counts}).`);
    } else {
      console.log(`\n--apply-retired REFUSED (${counts}):\n  ${verdict.reasons.join('\n  ')}`);
    }
  }
  if (args.stampChecked && !toWrite) {
    toWrite = stampChecked(snapshot, reports, today);
    console.log(
      toWrite
        ? `\n--stamp-checked: lastCheckedAt set to ${today}.`
        : "\n--stamp-checked REFUSED: every provider's status must be ok.",
    );
  }
  if (toWrite) writeFileSync(SNAPSHOT_PATH, await formatJson(toWrite));
}

const secrets: string[] = [];
main(secrets).catch((err: unknown) => {
  console.error(
    `freeway-refresh failed: ${sanitizeText(err instanceof Error ? err.message : String(err), secrets)}`,
  );
  process.exit(1);
});
