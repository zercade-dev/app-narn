/**
 * Freeway speed pass: provider time per delivered string for the bundled free
 * models. Translate-only (no judge), two 12-string chunks per model and
 * language. All I/O (clock, sleep, module construction, persistence) is
 * injected, so the quota accounting and restart behaviour are unit-tested with
 * fake modules; freeway-benchmark.ts wires the real ones.
 *
 * Quota: before each call scope a reservation is written to the sidecar's
 * `spends` for every window the call draws on (the model's own daily window and
 * the provider's shared pool). The scope is capped at the reservation, so the
 * reservation is a true upper bound; on settlement it is replaced by the calls
 * actually made. A run killed mid-call leaves its reservation in place, and it
 * ages out only when that window resets (spend keys carry the window start).
 */
import { nextReset, runCountingProviderCalls, windowStart } from '../../packages/shared/src/index.js';
import type {
  FreeTierLimit,
  FreeTierModel,
  FreeTierProvider,
  FreeTierSnapshot,
  TranslationJob,
  TranslationModule,
} from '../../packages/shared/src/index.js';

import { cellKey, redact, type CorpusEntry, type SpeedCell, type SpeedResultsFile } from './lib.js';

export const SPEED_CHUNK_SIZE = 12;
/** One request plus at most two split halves per chunk; the counter stops anything beyond it. */
export const SPEED_MAX_SCOPE_CALLS = 3;
const PACING_FLOOR_MS = 1500;

/** Providers the pass can run: DeepL is classical MT billed in characters, not a Freeway request model. */
export const SPEED_ENV_NAMES: Record<string, string> = {
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  copilot: 'GITHUB_TOKEN',
};

/** Numbered replies mirror the router; FREEWAY_BENCH_INDEXED=0 opts out. */
export function benchIndexedReplies(): boolean {
  return process.env.FREEWAY_BENCH_INDEXED !== '0';
}

/** Module config for a speed call. Numbered replies follow the router; the AI SDK's own retries would hide spend. */
export function speedModuleConfig(providerKey: string, model: FreeTierModel, secret: string): Record<string, unknown> {
  return {
    model: model.id,
    ...(providerKey === 'copilot' ? { githubToken: secret } : { apiKey: secret }),
    maxRetries: 0,
    indexedBatchReplies: benchIndexedReplies(),
    ...(model.useStructuredOutput !== undefined ? { useStructuredOutput: model.useStructuredOutput } : {}),
  };
}

/** Chunks of the corpus for one model: at most 12 strings, within the model's batch ceiling and char budget. */
export function speedChunks(entries: CorpusEntry[], model: FreeTierModel): CorpusEntry[][] {
  const maxStrings = Math.max(1, Math.min(SPEED_CHUNK_SIZE, model.batchCeiling ?? model.maxBatch));
  const chunks: CorpusEntry[][] = [];
  let current: CorpusEntry[] = [];
  let chars = 0;
  for (const entry of entries) {
    const over = model.charBudget !== undefined && chars + entry.text.length > model.charBudget;
    if (current.length > 0 && (current.length >= maxStrings || over)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(entry);
    chars += entry.text.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export interface SpeedModelRef {
  providerKey: string;
  provider: FreeTierProvider;
  model: FreeTierModel;
}

/** Bundled models the pass may run (selected providers with a usable secret), plus providers skipped for lack of one. */
export function speedTargets(
  snapshot: FreeTierSnapshot,
  env: Record<string, string | undefined>,
  providers?: string[],
): { targets: SpeedModelRef[]; skippedProviders: string[] } {
  const targets: SpeedModelRef[] = [];
  const skippedProviders: string[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    const envName = SPEED_ENV_NAMES[providerKey];
    if (!envName) continue;
    if (providers && !providers.includes(providerKey)) continue;
    if (!env[envName]) {
      skippedProviders.push(providerKey);
      continue;
    }
    for (const model of provider.models) targets.push({ providerKey, provider, model });
  }
  return { targets, skippedProviders };
}

interface DailyWindow { key: string; limit: number }

/** Daily windows a call to this model draws on: its own, and the provider's shared pool. */
function dailyWindows(ref: SpeedModelRef, now: number): DailyWindow[] {
  const zone = ref.provider.resetTimeZone;
  const windows: DailyWindow[] = [];
  const add = (scope: string, limits: FreeTierLimit[] | undefined): void => {
    for (const l of limits ?? []) {
      if (l.window !== 'rpd') continue;
      windows.push({ key: `${ref.providerKey}::${scope}::rpd::${windowStart('rpd', now, zone)}`, limit: l.limit });
    }
  };
  add(`model:${ref.model.id}`, ref.model.limits);
  add('pool', ref.provider.sharedLimits);
  return windows;
}

function pacingMs(ref: SpeedModelRef): number {
  const rpms = [
    ref.model.limits.find((l) => l.window === 'rpm')?.limit,
    ref.provider.sharedLimits?.find((l) => l.window === 'rpm')?.limit,
  ].filter((n): n is number => n !== undefined && n > 0);
  return Math.max(PACING_FLOOR_MS, ...rpms.map((rpm) => Math.ceil(60000 / rpm)));
}

export type SpeedDeferReason = 'quota' | 'max-requests' | 'cooling' | 'auth-failed' | 'failed';

export interface SpeedReport {
  /** Cells whose every chunk is complete. */
  completed: string[];
  /** Incomplete cells by reason (the first reason that stopped them this run). */
  incomplete: Record<string, SpeedDeferReason>;
  skippedProviders: string[];
  /** Provider requests made this run, by provider. */
  requests: Record<string, number>;
  /** Window spend after the run (reservations included), by window key. */
  spends: Record<string, number>;
}

export interface SpeedStore {
  load(): SpeedResultsFile;
  save(file: SpeedResultsFile): void;
}

export interface SpeedDeps {
  snapshot: FreeTierSnapshot;
  corpus: CorpusEntry[];
  langs: string[];
  env: Record<string, string | undefined>;
  providers?: string[];
  maxRequests?: number;
  now(): number;
  sleep(ms: number): Promise<void>;
  createModule(providerKey: string, config: Record<string, unknown>): Promise<TranslationModule>;
  store: SpeedStore;
  log(line: string): void;
}

function jobFor(entry: CorpusEntry, lang: string): TranslationJob {
  const context =
    [entry.tone ? `Tone: ${entry.tone}.` : '', entry.maxLength ? `Hard limit: at most ${entry.maxLength} characters.` : '']
      .filter(Boolean)
      .join(' ') || undefined;
  return { entryId: entry.id, sourceText: entry.text, targetLanguage: lang, sourceLanguage: 'en', context };
}

function classifyFailure(message: string): 'cooling' | 'auth-failed' | 'failed' {
  if (/429|rate.?limit|quota|resource.?exhausted/i.test(message)) return 'cooling';
  if (/401|403|api.?key|unauthorized/i.test(message)) return 'auth-failed';
  return 'failed';
}

export async function runSpeedPass(deps: SpeedDeps): Promise<SpeedReport> {
  const file = deps.store.load();
  const { targets, skippedProviders } = speedTargets(deps.snapshot, deps.env, deps.providers);
  const secrets = Object.values(SPEED_ENV_NAMES).map((n) => deps.env[n] ?? '');
  const report: SpeedReport = { completed: [], incomplete: {}, skippedProviders, requests: {}, spends: file.spends };
  const modules = new Map<string, TranslationModule>();
  const stopped = new Map<string, SpeedDeferReason>();
  const entryById = new Map(deps.corpus.map((e) => [e.id, e]));
  const save = (): void => deps.store.save(file);

  for (const ref of targets) {
    const { providerKey, model } = ref;
    const chunks = speedChunks(deps.corpus, model);
    for (const lang of deps.langs) {
      const key = cellKey(providerKey, model.id, lang);
      const delivered = new Set(file.deliveredIds[key] ?? []);
      const done = new Set(file.completedChunks[key] ?? []);
      const cell: SpeedCell = file.cells[key] ?? { totalMs: 0, strings: 0, requests: 0 };

      for (const [chunkIndex, chunk] of chunks.entries()) {
        if (done.has(chunkIndex)) continue;
        const missing = chunk.filter((e) => !delivered.has(e.id));
        if (missing.length === 0) {
          done.add(chunkIndex);
          continue;
        }
        const stopState = stopped.get(`${providerKey}::${model.id}`) ?? stopped.get(providerKey);
        if (stopState) {
          report.incomplete[key] ??= stopState;
          continue;
        }

        const windows = dailyWindows(ref, deps.now());
        let allowance = SPEED_MAX_SCOPE_CALLS;
        let capped: SpeedDeferReason = 'quota';
        for (const w of windows) allowance = Math.min(allowance, w.limit - (file.spends[w.key] ?? 0));
        if (deps.maxRequests !== undefined) {
          const left = deps.maxRequests - (report.requests[providerKey] ?? 0);
          if (left < allowance) {
            allowance = left;
            capped = 'max-requests';
          }
        }
        if (allowance < 1) {
          report.incomplete[key] ??= capped;
          continue;
        }

        const mod = await (async (): Promise<TranslationModule | undefined> => {
          const cached = modules.get(`${providerKey}::${model.id}`);
          if (cached) return cached;
          try {
            const created = await deps.createModule(
              providerKey,
              speedModuleConfig(providerKey, model, deps.env[SPEED_ENV_NAMES[providerKey]] ?? ''),
            );
            modules.set(`${providerKey}::${model.id}`, created);
            return created;
          } catch (err) {
            deps.log(`[${key}] ${redact(err instanceof Error ? err.message : String(err), secrets)}`);
            return undefined;
          }
        })();
        if (!mod) {
          report.incomplete[key] ??= 'failed';
          continue;
        }

        // Reserve before the call; the scope cannot exceed it, so an interrupted run still never undercounts.
        const reserve = allowance;
        for (const w of windows) file.spends[w.key] = (file.spends[w.key] ?? 0) + reserve;
        save();

        let calls = 0;
        let providerMs: number | undefined;
        let results: Awaited<ReturnType<TranslationModule['translate']>> = [];
        let thrown: string | undefined;
        const startedAt = deps.now();
        try {
          ({ result: results } = await runCountingProviderCalls(
            () => mod.translate(missing.map((e) => jobFor(e, lang)), undefined),
            (n, ms) => {
              calls = n;
              providerMs = ms;
            },
            { maxCalls: reserve },
          ));
        } catch (err) {
          thrown = redact(err instanceof Error ? err.message : String(err), secrets);
        }
        const elapsed = providerMs ?? Math.max(0, deps.now() - startedAt);
        // A scope that made no counted call is still charged one: the attempt may have reached the provider.
        const charged = Math.min(reserve, Math.max(1, calls));
        for (const w of windows) file.spends[w.key] = (file.spends[w.key] ?? 0) - reserve + charged;
        report.requests[providerKey] = (report.requests[providerKey] ?? 0) + charged;

        let fresh = 0;
        for (const r of results) {
          if (r.error !== undefined || r.translatedText.trim() === '') continue;
          if (!entryById.has(r.entryId) || delivered.has(r.entryId) || !missing.some((e) => e.id === r.entryId)) continue;
          delivered.add(r.entryId);
          fresh++;
        }
        cell.totalMs += elapsed;
        cell.strings += fresh;
        cell.requests += charged;
        file.cells[key] = cell;
        file.deliveredIds[key] = [...delivered];
        if (chunk.every((e) => delivered.has(e.id))) done.add(chunkIndex);
        file.completedChunks[key] = [...done].sort((a, b) => a - b);
        save();

        if (!chunk.every((e) => delivered.has(e.id))) {
          const message = thrown ?? redact(results.find((r) => r.error !== undefined)?.error ?? '', secrets);
          const kind = classifyFailure(message);
          report.incomplete[key] ??= kind;
          if (kind === 'auth-failed') stopped.set(providerKey, kind);
          else if (kind === 'cooling') stopped.set(ref.provider.sharedLimits ? providerKey : `${providerKey}::${model.id}`, kind);
          deps.log(`[${key}] chunk ${chunkIndex}: ${fresh}/${missing.length} delivered${message ? ` (${message.slice(0, 200)})` : ''}`);
        }
        await deps.sleep(pacingMs(ref));
      }

      if (chunks.every((_, i) => done.has(i))) report.completed.push(key);
      else report.incomplete[key] ??= 'failed';
    }
  }
  return report;
}

export interface SpeedPlanRow {
  providerKey: string;
  modelId: string;
  /** Requests still needed: one per chunk not yet complete, across the selected languages. */
  requests: number;
  windows: Array<{ key: string; limit: number; spent: number; resetsAt: number }>;
}

/** What a pass would do next. Makes no calls and needs no module. */
export function planSpeed(
  deps: Pick<SpeedDeps, 'snapshot' | 'corpus' | 'langs' | 'env' | 'providers' | 'now'> & { file: SpeedResultsFile },
): { rows: SpeedPlanRow[]; skippedProviders: string[] } {
  const { targets, skippedProviders } = speedTargets(deps.snapshot, deps.env, deps.providers);
  const rows = targets.map((ref) => {
    const chunks = speedChunks(deps.corpus, ref.model);
    let requests = 0;
    for (const lang of deps.langs) {
      const key = cellKey(ref.providerKey, ref.model.id, lang);
      const done = new Set(deps.file.completedChunks[key] ?? []);
      requests += chunks.filter((_, i) => !done.has(i)).length;
    }
    const now = deps.now();
    const resetsAt = nextReset('rpd', now, ref.provider.resetTimeZone);
    return {
      providerKey: ref.providerKey,
      modelId: ref.model.id,
      requests,
      windows: dailyWindows(ref, now).map((w) => ({ ...w, spent: deps.file.spends[w.key] ?? 0, resetsAt })),
    };
  });
  return { rows, skippedProviders };
}
