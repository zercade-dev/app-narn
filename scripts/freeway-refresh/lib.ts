/**
 * Pure logic for `make freeway-refresh`: classifying provider responses,
 * deciding what is retired, and the guards on changing the snapshot. HTTP is
 * injected, so everything here runs against fixtures. The CLI wrapper in
 * ../freeway-refresh.ts owns argv, files and the real fetch.
 *
 * The rule throughout: only positive evidence retires a model. A rate limit, a
 * timeout, a bad key or an unreachable provider all mean "unknown".
 */

export type RefreshProvider = 'google' | 'groq' | 'openrouter';
export const REFRESH_PROVIDERS: readonly RefreshProvider[] = ['google', 'groq', 'openrouter'];

const ENV_NAMES: Record<RefreshProvider, string> = {
  google: 'GOOGLE_API_KEY',
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** OpenRouter's model list needs no key, so it can still be read without one. */
const PUBLIC_LIST: ReadonlySet<RefreshProvider> = new Set(['openrouter']);

const LIST_TIMEOUT_MS = 15_000;
const PROBE_TIMEOUT_MS = 20_000;
const PACING_FLOOR_MS = 1500;
const MAX_GOOGLE_LIST_PAGES = 5;
const MAX_CANDIDATE_PROBES = 15;
const PROBE_MAX_TOKENS = 16;
const PROBE_PROMPT = 'Reply with the single word OK.';

export interface RefreshLimit {
  window: string;
  limit: number;
}
export interface RefreshModel {
  id: string;
  qualityTier: number;
  limits: RefreshLimit[];
  [field: string]: unknown;
}
export interface RefreshProviderEntry {
  moduleId: string;
  models: RefreshModel[];
  sharedLimits?: RefreshLimit[];
  [field: string]: unknown;
}
export interface RefreshSnapshot {
  generatedAt: string;
  lastCheckedAt?: string;
  providers: Record<string, RefreshProviderEntry>;
}

export interface LiveModel {
  id: string;
  textOutputOnly?: boolean;
}
export type ListResult =
  | { status: 'ok'; models: LiveModel[]; calls: number }
  | { status: 'unknown'; reason: string; calls: number }
  | { status: 'skipped' };

export interface HeaderLimits {
  rpd?: number;
  tpm?: number;
}
export type ProbeOutcome =
  | { kind: 'ok'; headerLimits?: HeaderLimits }
  | { kind: 'rejected'; detail: string; decommissioned?: boolean }
  | { kind: 'rate-limited'; detail: string }
  | { kind: 'auth-failed'; detail: string }
  | { kind: 'error'; detail: string; retryable: boolean };

export type ProviderStatus = 'ok' | 'unknown' | 'skipped' | 'list-only';
export interface ModelNote {
  id: string;
  reason: string;
}
export interface Candidate {
  id: string;
  probe?: ProbeOutcome['kind'];
}
export interface LimitChange {
  id: string;
  window: string;
  snapshot: number | null;
  live: number;
}
export interface ProviderReport {
  provider: RefreshProvider;
  status: ProviderStatus;
  notes: string[];
  usable: string[];
  /** Unlisted and rejected, on evidence strong enough to change the snapshot. */
  retired: string[];
  /** Looks retired, but the evidence can't rule out this key simply lacking access. Never removed. */
  retiredUnconfirmed: ModelNote[];
  unusable: ModelNote[];
  unresolved: ModelNote[];
  unlistedWorking: string[];
  candidates: Candidate[];
  limitChanges: LimitChange[];
  calls: { list: number; probe: number };
}

// ---------------------------------------------------------------------------
// Keys and text safety
// ---------------------------------------------------------------------------

/** Extracts only the three provider keys from env-file text; every other line is ignored. */
export function pickKeys(envText: string): Partial<Record<RefreshProvider, string>> {
  const out: Partial<Record<RefreshProvider, string>> = {};
  for (const raw of envText.split('\n')) {
    const line = raw.trim().replace(/^export\s+/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const name = line.slice(0, eq).trim();
    const provider = REFRESH_PROVIDERS.find((p) => ENV_NAMES[p] === name);
    if (!provider) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) out[provider] = value;
  }
  return out;
}

const KEY_SHAPE_RE =
  /\b(?:(?:gsk_|sk-[A-Za-z0-9-]|AIza)[A-Za-z0-9_-]*|[0-9a-f][0-9a-f-]{29,}(?::fx)?)/g;
const CONTROL_CHARS_RE = /[\p{Cc}\p{Cf}]+/gu;
const MAX_DETAIL_CHARS = 160;

/** Makes upstream text safe to print: no keys, no terminal control sequences, bounded length. */
export function sanitizeText(text: string, secrets: readonly string[] = []): string {
  let out = text;
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out
    .replace(KEY_SHAPE_RE, '[redacted]')
    .replace(CONTROL_CHARS_RE, ' ')
    .trim()
    .slice(0, MAX_DETAIL_CHARS);
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
}
export interface HttpResponse {
  status: number;
  text: string;
  header: (name: string) => string | null;
}

function authHeaders(provider: RefreshProvider, apiKey: string): Record<string, string> {
  return provider === 'google'
    ? { 'x-goog-api-key': apiKey }
    : { authorization: `Bearer ${apiKey}` };
}

export function buildListRequest(
  provider: RefreshProvider,
  apiKey: string | undefined,
  pageToken?: string,
): HttpRequest {
  const base = { method: 'GET' as const, timeoutMs: LIST_TIMEOUT_MS };
  if (provider === 'openrouter')
    return { ...base, url: 'https://openrouter.ai/api/v1/models', headers: {} };
  const headers = apiKey ? authHeaders(provider, apiKey) : {};
  if (provider === 'groq')
    return { ...base, url: 'https://api.groq.com/openai/v1/models', headers };
  const token = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
  return {
    ...base,
    url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${token}`,
    headers,
  };
}

export function buildProbeRequest(
  provider: RefreshProvider,
  modelId: string,
  apiKey: string,
): HttpRequest {
  const headers = { ...authHeaders(provider, apiKey), 'content-type': 'application/json' };
  const base = { method: 'POST' as const, timeoutMs: PROBE_TIMEOUT_MS, headers };
  if (provider === 'google') {
    return {
      ...base,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
      body: {
        contents: [{ role: 'user', parts: [{ text: PROBE_PROMPT }] }],
        generationConfig: { maxOutputTokens: PROBE_MAX_TOKENS },
      },
    };
  }
  return {
    ...base,
    url:
      provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions',
    body: {
      model: modelId,
      messages: [{ role: 'user', content: PROBE_PROMPT }],
      max_tokens: PROBE_MAX_TOKENS,
    },
  };
}

// ---------------------------------------------------------------------------
// Parsing and classification
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

/** One response's models: [] for a valid empty page, undefined for an unrecognised shape. */
function parseListPage(provider: RefreshProvider, json: unknown): LiveModel[] | undefined {
  const root = asRecord(json);
  if (!root) return undefined;
  const rows = provider === 'google' ? root.models : root.data;
  if (!Array.isArray(rows)) return undefined;
  const out: LiveModel[] = [];
  for (const raw of rows) {
    const row = asRecord(raw);
    if (!row) continue;
    if (provider === 'google') {
      const methods = row.supportedGenerationMethods;
      if (
        typeof row.name === 'string' &&
        Array.isArray(methods) &&
        methods.includes('generateContent')
      ) {
        out.push({ id: row.name.replace(/^models\//, '') });
      }
    } else if (typeof row.id === 'string') {
      if (provider === 'groq') {
        if (row.active !== false) out.push({ id: row.id });
      } else {
        const modalities = asRecord(row.architecture)?.output_modalities;
        out.push({
          id: row.id,
          ...(Array.isArray(modalities)
            ? { textOutputOnly: modalities.every((m) => m === 'text') }
            : {}),
        });
      }
    }
  }
  return out;
}

/** The usable models in a list response. undefined when malformed or empty: never evidence of retirement. */
export function parseLiveList(provider: RefreshProvider, json: unknown): LiveModel[] | undefined {
  const page = parseListPage(provider, json);
  return page && page.length > 0 ? page : undefined;
}

const AUTH_MESSAGE_RE = /api.?key|\bkey\b|leaked|credential|unauthori[sz]ed/i;
const QUOTA_MESSAGE_RE = /resource.?exhausted|quota|rate.?limit/i;
const MODEL_MESSAGE_RE = /\bmodels?\b|decommission|no endpoints found/i;
const PERMISSION_MESSAGE_RE = /permission|denied|access|authori[sz]|gated|allowlist/i;

/**
 * Classifies a probe's status and body. Only a response that names the model
 * counts as a rejection: a bare 404, or one about permissions, says nothing about
 * whether the model still exists.
 */
export function classifyProbeResponse(
  status: number,
  text: string,
  secrets: readonly string[] = [],
): ProbeOutcome {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  const error = asRecord(asRecord(json)?.error);
  const code = error?.code;
  const message = typeof error?.message === 'string' ? error.message : '';
  const inBandStatus = typeof code === 'number' ? code : 500;
  const effective = status >= 200 && status < 300 && error ? inBandStatus : status;
  const quoted = sanitizeText(message, secrets).replace(/"/g, "'");
  const detail = quoted
    ? `HTTP ${effective}, provider text (untrusted): "${quoted}"`
    : `HTTP ${effective}`;
  const decommissioned =
    (typeof code === 'string' && code === 'model_decommissioned') || /decommission/i.test(message);
  const rejection: ProbeOutcome = {
    kind: 'rejected',
    detail,
    ...(decommissioned ? { decommissioned } : {}),
  };

  if (effective >= 200 && effective < 300) {
    return json === undefined
      ? { kind: 'error', detail: 'non-JSON success body', retryable: false }
      : { kind: 'ok' };
  }
  if (effective === 429) return { kind: 'rate-limited', detail };
  if (effective === 401) return { kind: 'auth-failed', detail };
  if (typeof code === 'string' && /model_(not_found|decommissioned)/.test(code)) return rejection;
  if (effective === 404 || effective === 410) {
    if (MODEL_MESSAGE_RE.test(message) && !PERMISSION_MESSAGE_RE.test(message)) return rejection;
    return { kind: 'error', detail, retryable: false };
  }
  if (effective === 400 || effective === 403) {
    if (QUOTA_MESSAGE_RE.test(message)) return { kind: 'rate-limited', detail };
    if (AUTH_MESSAGE_RE.test(message)) return { kind: 'auth-failed', detail };
    if (MODEL_MESSAGE_RE.test(message)) return rejection;
    if (effective === 403) return { kind: 'auth-failed', detail };
  }
  return { kind: 'error', detail, retryable: effective >= 500 };
}

function positiveInt(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value.trim())) return undefined;
  const n = Number(value);
  return n > 0 ? n : undefined;
}

/** Groq reports its daily request and per-minute token limits on every response. */
function readGroqLimits(res: HttpResponse): HeaderLimits | undefined {
  const rpd = positiveInt(res.header('x-ratelimit-limit-requests'));
  const tpm = positiveInt(res.header('x-ratelimit-limit-tokens'));
  if (rpd === undefined && tpm === undefined) return undefined;
  return { ...(rpd !== undefined ? { rpd } : {}), ...(tpm !== undefined ? { tpm } : {}) };
}

// ---------------------------------------------------------------------------
// Candidate filter
// ---------------------------------------------------------------------------

const MODEL_ID_RE = /^[A-Za-z0-9][\w./:+-]*$/;
const NON_TRANSLATION_RE =
  /embed|image|audio|speech|transcri|whisper|orpheus|playai|music|lyria|guard|safety|moderation|customtools|antigravity|rerank|code|devstral|codestral|robotics|computer-use|deep-research|compound|nano-banana|(^|[-_/.])(tts|veo|aqa|ocr|live)($|[-_/.])/i;

/** Whether a listed model could plausibly translate text. A filter for the report, not proof of usability. */
export function isPlausibleCandidate(provider: RefreshProvider, model: LiveModel): boolean {
  if (!MODEL_ID_RE.test(model.id) || NON_TRANSLATION_RE.test(model.id)) return false;
  if (provider !== 'openrouter') return true;
  return model.id.endsWith(':free') && model.textOutputOnly !== false;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface ReportInput {
  provider: RefreshProvider;
  snapshotProvider: RefreshProviderEntry;
  hasKey: boolean;
  list: ListResult;
  probes: Map<string, ProbeOutcome>;
  candidateProbes: Map<string, ProbeOutcome>;
}

function unknownReason(outcome: ProbeOutcome | undefined): string {
  if (!outcome) return 'not probed, unknown';
  if (outcome.kind === 'rate-limited') return `rate-limited, unknown (${outcome.detail})`;
  if (outcome.kind === 'ok') return 'ok';
  return `unknown (${outcome.detail})`;
}

function limitChangesFor(entry: RefreshModel, limits: HeaderLimits | undefined): LimitChange[] {
  if (!limits) return [];
  const changes: LimitChange[] = [];
  for (const window of ['rpd', 'tpm'] as const) {
    const live = limits[window];
    if (live === undefined) continue;
    const current = entry.limits.find((l) => l.window === window)?.limit ?? null;
    if (current !== live) changes.push({ id: entry.id, window, snapshot: current, live });
  }
  return changes;
}

/**
 * Whether an unlisted model's rejection is strong enough to remove it. Google and
 * Groq list per key, so absence plus a rejection may only mean this key lacks access,
 * unless Groq says outright that the model was decommissioned. OpenRouter's list is
 * public, so absence there holds for everyone.
 */
function confirmsRetirement(
  provider: RefreshProvider,
  outcome: { decommissioned?: boolean },
): boolean {
  if (provider === 'openrouter') return true;
  return provider === 'groq' && outcome.decommissioned === true;
}

export function buildProviderReport(input: ReportInput): ProviderReport {
  const { provider, snapshotProvider, hasKey, list, probes, candidateProbes } = input;
  const report: ProviderReport = {
    provider,
    status: 'ok',
    notes: [],
    usable: [],
    retired: [],
    retiredUnconfirmed: [],
    unusable: [],
    unresolved: [],
    unlistedWorking: [],
    candidates: [],
    limitChanges: [],
    calls: {
      list: list.status === 'skipped' ? 0 : list.calls,
      probe: 0,
    },
  };

  if (list.status === 'skipped') {
    report.status = 'skipped';
    report.notes.push(`${ENV_NAMES[provider]} is not set; provider skipped.`);
    return report;
  }
  if (list.status === 'unknown') {
    report.status = 'unknown';
    report.notes.push(`Provider unreachable, status unknown: ${list.reason}`);
    report.unresolved = snapshotProvider.models.map((m) => ({
      id: m.id,
      reason: 'provider unknown',
    }));
    return report;
  }

  if (!hasKey) {
    report.status = 'list-only';
    report.notes.push(`${ENV_NAMES[provider]} is not set; list checked, no model was probed.`);
  }

  const listed = new Set(list.models.map((m) => m.id));
  for (const model of snapshotProvider.models) {
    const outcome = probes.get(model.id);
    const isListed = listed.has(model.id);
    if (outcome?.kind === 'ok') {
      report.limitChanges.push(...limitChangesFor(model, outcome.headerLimits));
      if (isListed) report.usable.push(model.id);
      else report.unlistedWorking.push(model.id);
    } else if (outcome?.kind === 'rejected') {
      if (isListed) report.unusable.push({ id: model.id, reason: outcome.detail });
      else if (confirmsRetirement(provider, outcome)) {
        report.retired.push(model.id);
        report.notes.push(`Retired ${model.id}: ${outcome.detail}`);
      } else {
        report.retiredUnconfirmed.push({ id: model.id, reason: outcome.detail });
      }
    } else if (!hasKey && !isListed) {
      report.retiredUnconfirmed.push({
        id: model.id,
        reason: 'absent from the list; no key to probe with',
      });
    } else {
      report.unresolved.push({ id: model.id, reason: unknownReason(outcome) });
    }
  }

  const authFailure = [...probes.values()].find((p) => p.kind === 'auth-failed');
  if (authFailure?.kind === 'auth-failed') {
    report.status = 'unknown';
    report.notes = report.notes.filter((note) => !note.startsWith('Retired '));
    report.notes.push(`Key rejected, status unknown: ${authFailure.detail}`);
    report.unresolved.push(
      ...[...report.retired, ...report.retiredUnconfirmed.map((m) => m.id)].map((id) => ({
        id,
        reason: 'provider unknown',
      })),
    );
    report.retired = [];
    report.retiredUnconfirmed = [];
  }

  const known = new Set(snapshotProvider.models.map((m) => m.id));
  report.candidates = list.models
    .filter((m) => !known.has(m.id) && isPlausibleCandidate(provider, m))
    .map((m) => {
      const probe = candidateProbes.get(m.id)?.kind;
      return probe ? { id: m.id, probe } : { id: m.id };
    });
  return report;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export interface RunDeps {
  http: (req: HttpRequest) => Promise<HttpResponse>;
  sleep: (ms: number) => Promise<void>;
}
export interface RunInput {
  provider: RefreshProvider;
  snapshotProvider: RefreshProviderEntry;
  apiKey: string | undefined;
  probeCandidates: boolean;
}

function delayForRpm(rpm: number | undefined): number {
  return rpm !== undefined && rpm > 0
    ? Math.max(PACING_FLOOR_MS, Math.ceil(60_000 / rpm))
    : PACING_FLOOR_MS;
}
function rpmOf(limits: readonly RefreshLimit[] | undefined): number | undefined {
  return limits?.find((l) => l.window === 'rpm')?.limit;
}

function networkDetail(err: unknown, secrets: readonly string[]): string {
  const cause = asRecord(asRecord(err)?.cause);
  const name = asRecord(err)?.name;
  if (name === 'TimeoutError' || name === 'AbortError') return 'timed out';
  const code =
    typeof cause?.code === 'string'
      ? cause.code
      : err instanceof Error
        ? err.message
        : 'request failed';
  return sanitizeText(`network: ${code}`, secrets);
}

async function fetchList(
  input: RunInput,
  deps: RunDeps,
  secrets: readonly string[],
): Promise<ListResult> {
  const { provider, apiKey } = input;
  let calls = 0;
  const models: LiveModel[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_GOOGLE_LIST_PAGES; page++) {
    const req = buildListRequest(provider, apiKey, pageToken);
    let res: HttpResponse | undefined;
    let failure = '';
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      calls++;
      try {
        const out = await deps.http(req);
        if (out.status >= 500) failure = `HTTP ${out.status}`;
        else res = out;
      } catch (err) {
        failure = networkDetail(err, secrets);
      }
    }
    if (!res) return { status: 'unknown', reason: failure, calls };
    if (res.status !== 200) return { status: 'unknown', reason: `HTTP ${res.status}`, calls };
    let json: unknown;
    try {
      json = JSON.parse(res.text);
    } catch {
      return { status: 'unknown', reason: 'list response was not JSON', calls };
    }
    const parsed = parseListPage(provider, json);
    if (!parsed)
      return { status: 'unknown', reason: 'list response had an unexpected shape', calls };
    models.push(...parsed);
    const next = provider === 'google' ? asRecord(json)?.nextPageToken : undefined;
    if (typeof next !== 'string' || !next) {
      return models.length > 0
        ? { status: 'ok', models, calls }
        : { status: 'unknown', reason: 'list response was empty', calls };
    }
    pageToken = next;
  }
  return { status: 'unknown', reason: `list longer than ${MAX_GOOGLE_LIST_PAGES} pages`, calls };
}

/** One probe, retried once only on a transient failure. Never retries a rate limit. */
async function probeOnce(
  input: RunInput,
  apiKey: string,
  modelId: string,
  delayMs: number,
  deps: RunDeps,
  secrets: readonly string[],
  count: () => void,
): Promise<ProbeOutcome> {
  const req = buildProbeRequest(input.provider, modelId, apiKey);
  let outcome: ProbeOutcome = { kind: 'error', detail: 'not attempted', retryable: false };
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await deps.sleep(delayMs);
    count();
    try {
      const res = await deps.http(req);
      outcome = classifyProbeResponse(res.status, res.text, secrets);
      if (outcome.kind === 'ok' && input.provider === 'groq') {
        const headerLimits = readGroqLimits(res);
        if (headerLimits) outcome = { kind: 'ok', headerLimits };
      }
    } catch (err) {
      outcome = { kind: 'error', detail: networkDetail(err, secrets), retryable: true };
    }
    if (outcome.kind !== 'error' || !outcome.retryable) break;
  }
  return outcome;
}

/** Lists and probes one provider. Bounded: one probe per model, one retry, paced by the snapshot's limits. */
export async function runProvider(input: RunInput, deps: RunDeps): Promise<ProviderReport> {
  const { provider, snapshotProvider, apiKey, probeCandidates } = input;
  const secrets = apiKey ? [apiKey] : [];
  const reportInput: ReportInput = {
    provider,
    snapshotProvider,
    hasKey: Boolean(apiKey),
    list: { status: 'skipped' },
    probes: new Map(),
    candidateProbes: new Map(),
  };
  if (!apiKey && !PUBLIC_LIST.has(provider)) return buildProviderReport(reportInput);

  const list = await fetchList(input, deps, secrets);
  reportInput.list = list;
  let probeCalls = 0;
  const count = () => {
    probeCalls++;
  };

  if (apiKey && list.status === 'ok') {
    const sharedRpm = rpmOf(snapshotProvider.sharedLimits);
    const tightest = Math.min(
      ...[sharedRpm, ...snapshotProvider.models.map((m) => rpmOf(m.limits))].filter(
        (n): n is number => n !== undefined,
      ),
    );
    const known = new Set(snapshotProvider.models.map((m) => m.id));
    const plausible = list.models.filter(
      (m) => !known.has(m.id) && isPlausibleCandidate(provider, m),
    );
    const toProbe = probeCandidates ? plausible.slice(0, MAX_CANDIDATE_PROBES) : [];

    const queue: { id: string; delayMs: number; into: Map<string, ProbeOutcome> }[] = [
      ...snapshotProvider.models.map((m) => ({
        id: m.id,
        delayMs: delayForRpm(rpmOf(m.limits) ?? sharedRpm),
        into: reportInput.probes,
      })),
      ...toProbe.map((m) => ({
        id: m.id,
        delayMs: delayForRpm(Number.isFinite(tightest) ? tightest : undefined),
        into: reportInput.candidateProbes,
      })),
    ];
    let previousDelay = 0;
    for (const item of queue) {
      if (previousDelay > 0) await deps.sleep(previousDelay);
      const outcome = await probeOnce(input, apiKey, item.id, item.delayMs, deps, secrets, count);
      item.into.set(item.id, outcome);
      if (outcome.kind === 'auth-failed') break;
      previousDelay = item.delayMs;
    }
    const report = buildProviderReport(reportInput);
    if (probeCandidates && plausible.length > toProbe.length) {
      report.notes.push(`Probed the first ${toProbe.length} of ${plausible.length} candidates.`);
    }
    report.calls.probe = probeCalls;
    return report;
  }
  return buildProviderReport(reportInput);
}

// ---------------------------------------------------------------------------
// Snapshot changes
// ---------------------------------------------------------------------------

function retiredByProvider(reports: readonly ProviderReport[]): Map<string, Set<string>> {
  return new Map(reports.map((r) => [r.provider, new Set(r.retired)]));
}

/** The snapshot minus confirmed retirements. Never adds a model or edits any other field. */
export function suggestedSnapshot(
  snapshot: RefreshSnapshot,
  reports: readonly ProviderReport[],
): RefreshSnapshot {
  const retired = retiredByProvider(reports);
  const out = structuredClone(snapshot);
  for (const [key, entry] of Object.entries(out.providers)) {
    const gone = retired.get(key);
    if (gone) entry.models = entry.models.filter((m) => !gone.has(m.id));
  }
  return out;
}

function withCheckDate(snapshot: RefreshSnapshot, today: string): RefreshSnapshot {
  const { generatedAt, lastCheckedAt: _previous, ...rest } = snapshot;
  return { generatedAt, lastCheckedAt: today, ...rest };
}

/** What --apply-retired writes: the suggestion, stamped as checked, redated only if a model actually went. */
export function retiredSnapshot(
  snapshot: RefreshSnapshot,
  reports: readonly ProviderReport[],
  today: string,
): RefreshSnapshot {
  const out = withCheckDate(suggestedSnapshot(snapshot, reports), today);
  const removed = reports.some((r) => r.retired.length > 0);
  return removed ? { ...out, generatedAt: today } : out;
}

/** The snapshot stamped as checked, or undefined unless every provider's status is ok. */
export function stampChecked(
  snapshot: RefreshSnapshot,
  reports: readonly ProviderReport[],
  today: string,
): RefreshSnapshot | undefined {
  return reports.every((r) => r.status === 'ok')
    ? withCheckDate(structuredClone(snapshot), today)
    : undefined;
}

/** Guards on --apply-retired: every provider must be fully known, and no provider may lose more than half. */
export function checkApply(
  snapshot: RefreshSnapshot,
  reports: readonly ProviderReport[],
): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const report of reports) {
    if (report.status !== 'ok') reasons.push(`${report.provider} status is ${report.status}`);
    const unresolved = new Set(report.unresolved.map((m) => m.id));
    const unverified = report.retired.filter((id) => unresolved.has(id));
    if (unverified.length > 0) {
      reasons.push(
        `${report.provider} has unresolved models it would remove: ${unverified.join(', ')}`,
      );
    }
    const total = snapshot.providers[report.provider]?.models.length ?? 0;
    if (report.retired.length * 2 > total) {
      reasons.push(
        `${report.provider} would lose more than half its models (${report.retired.length} of ${total})`,
      );
    }
  }
  return { allowed: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function section(lines: string[], title: string, rows: string[]): void {
  lines.push(`  ${title}: ${rows.length === 0 ? 'none' : ''}`.trimEnd());
  for (const row of rows) lines.push(`    - ${row}`);
}

export function formatReport(reports: readonly ProviderReport[]): string {
  const lines: string[] = [];
  let total = 0;
  const perProvider: string[] = [];
  for (const r of reports) {
    const calls = r.calls.list + r.calls.probe;
    total += calls;
    perProvider.push(`${r.provider} ${calls} (${r.calls.list} list, ${r.calls.probe} probe)`);
    lines.push(`${r.provider}: ${r.status}`);
    for (const note of r.notes) lines.push(`  note: ${note}`);
    lines.push(`  usable: ${r.usable.length}`);
    section(lines, 'retired', r.retired);
    section(
      lines,
      'retired (unconfirmed, not removed)',
      r.retiredUnconfirmed.map((m) => `${m.id}: ${m.reason}`),
    );
    section(
      lines,
      'unusable (listed but rejected)',
      r.unusable.map((m) => `${m.id}: ${m.reason}`),
    );
    section(
      lines,
      'unknown',
      r.unresolved.map((m) => `${m.id}: ${m.reason}`),
    );
    section(lines, 'unlisted but still answering', r.unlistedWorking);
    section(
      lines,
      'new candidates (run freeway-benchmark before use)',
      r.candidates.map((c) => (c.probe ? `${c.id}: probe ${c.probe}` : c.id)),
    );
    section(
      lines,
      'limit differences (snapshot -> live)',
      r.limitChanges.map((c) => `${c.id} ${c.window}: ${c.snapshot ?? 'absent'} -> ${c.live}`),
    );
    lines.push('');
  }
  lines.push(
    'Not checked: deepl and copilot have no model list to compare; their snapshot entries are left alone.',
  );
  lines.push(
    'Google per-model limits are only on the AI Studio rate-limit page, so they are not checked here.',
  );
  lines.push(`Calls made: ${total} (${perProvider.join(', ')})`);
  return lines.join('\n');
}

/** Reads a response body, throwing past maxBytes so a hostile or broken server can't exhaust memory. */
export async function readBodyCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`response body too large (over ${maxBytes} bytes)`);
    }
    text += decoder.decode(value, { stream: true });
  }
}
