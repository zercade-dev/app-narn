/**
 * Pure parsing and validation for update-provider-pricing.ts. Nothing here touches a
 * browser or the network, so each parser can be tested against a saved copy of the page
 * shape it reads, and a bad scrape can be refused before it overwrites the snapshot.
 */

export interface ScrapedModelPricing {
  /** Provider-native model id (or family-prefix pattern), e.g. "gpt-4o". */
  id: string;
  inputCostPerMillion?: number;
  outputCostPerMillion?: number;
  cachedInputCostPerMillion?: number;
  cacheWriteCostPerMillion?: number;
  contextLength?: number;
  capabilityTags?: string[];
}

export interface ScrapedProviderResult {
  sourceUrl: string;
  /** When this provider's prices were last scraped and accepted. */
  scrapedAt?: string;
  models: ScrapedModelPricing[];
}

export interface PricingSnapshot {
  generatedAt?: string;
  providers?: Record<string, ScrapedProviderResult>;
}

export type TableRows = string[][];

export function parseFirstDollarAmount(cell: string | undefined): number | undefined {
  if (!cell) return undefined;
  const m = cell.match(/\$?([\d]+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

function parseContextTokens(cell: string | undefined): number | undefined {
  if (!cell) return undefined;
  const m = cell.match(/([\d.]+)\s*([MK])\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2].toUpperCase() === 'M' ? Math.round(n * 1_000_000) : Math.round(n * 1_000);
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

const parseStrictDollars = (cell: string | undefined): number | undefined => {
  const m = cell?.match(/\$(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
};

/**
 * Prices are split into OFF-PEAK and PEAK rows under a merged label cell, which only
 * appears in the DOM on the first row of its group:
 *   ["PRICING(2)", "1M INPUT TOKENS(CACHE HIT)", "OFF-PEAK", "$0.003", "$0.022"]
 *   ["PEAK", "$0.006", "$0.044"]
 * so values are read from the end of a row, never by position from the start. The peak
 * rate is what's stored: it's the higher of the two, and the off-peak hours aren't
 * something the app can plan around. A table with no split has one row per label.
 */
export function parseDeepSeekPricing(tables: TableRows[], pageText: string): ScrapedModelPricing[] {
  const table = tables.find((rows) => rows[0]?.[0]?.toUpperCase().includes('MODEL'));
  if (!table) throw new Error('[deepseek] model/pricing table not found on page');

  const modelIds = table[0].slice(1).map((h) => h.replace(/\(\d+\)/g, '').trim());
  const count = modelIds.length;
  const hasCell = (row: string[], text: string) => row.some((c) => c.trim().toUpperCase() === text);

  const priceValues = (label: string): string[] | undefined => {
    const start = table.findIndex((r) => r.some((c) => c.toUpperCase().includes(label)));
    if (start === -1) return undefined;
    const peak = table.slice(start, start + 2).find((r) => hasCell(r, 'PEAK'));
    if (peak) return peak.slice(-count);
    // Off-peak with no peak row is a shape this parser doesn't understand. Leaving the
    // price out makes validation reject it instead of storing the discounted rate.
    return hasCell(table[start], 'OFF-PEAK') ? undefined : table[start].slice(-count);
  };
  const featureValues = (label: RegExp): string[] | undefined =>
    table.find((r) => label.test(r[0] ?? ''))?.slice(-count);

  const cacheHit = priceValues('CACHE HIT');
  const cacheMiss = priceValues('CACHE MISS');
  const output = priceValues('OUTPUT TOKENS');
  const contextRow = table.find((r) => /CONTEXT LENGTH/i.test(r[0] ?? ''));
  const tools = featureValues(/^TOOL CALLS/i);
  const vision = featureValues(/^VISION/i);

  const models: ScrapedModelPricing[] = modelIds.map((id, i) => {
    const capabilityTags = [
      ...(tools?.[i]?.includes('✓') ? ['tools'] : []),
      ...(vision?.[i]?.includes('✓') ? ['vision'] : []),
    ];
    return {
      id,
      cachedInputCostPerMillion: parseStrictDollars(cacheHit?.[i]),
      inputCostPerMillion: parseStrictDollars(cacheMiss?.[i]),
      outputCostPerMillion: parseStrictDollars(output?.[i]),
      // A merged cell when every model shares one context length.
      contextLength: parseContextTokens(contextRow?.[contextRow.length > 2 ? i + 1 : 1]),
      ...(capabilityTags.length > 0 ? { capabilityTags } : {}),
    };
  });

  // The page's footnote names retired ids that are still accepted and billed as the
  // current model. Configs can still hold them, so they keep resolving to a price.
  const current = pageText.match(/Use\s+(deepseek-[\w.-]+)\s+as the model name/i)?.[1];
  const legacy = pageText.match(/legacy names?\s+(.+?)\s+(?:is|are)\s+still accepted/i)?.[1];
  const base = models.find((m) => m.id === current);
  if (base && legacy) {
    for (const [id] of legacy.matchAll(/deepseek-[\w.-]*\w/g)) {
      if (!models.some((m) => m.id === id)) models.push({ ...base, id });
    }
  }
  return models;
}

// ─── Google (Gemini) ──────────────────────────────────────────────────────────

/**
 * First per-million amount at the start of a paid-tier cell. Tiered and dated cells list
 * the current or base price first ("$2.00 through November 30, 2026.$4.00 starting...").
 * An amount priced per something else ("$0.039 per image", "$4.50 / 1,000,000 tokens per
 * hour") isn't a per-token price and returns undefined.
 */
function parseGooglePerMillion(cell: string | undefined): number | undefined {
  const m = cell?.match(/^\s*\$(\d+(?:\.\d+)?)\s*(per\b|\/)?/i);
  return m && !m[2] ? Number(m[1]) : undefined;
}

export function parseGoogleSections(
  sections: Array<{ id: string; rows: string[][] }>,
): ScrapedModelPricing[] {
  const models: ScrapedModelPricing[] = [];
  for (const { id, rows } of sections) {
    if (models.some((m) => m.id === id)) continue;
    const paidCell = (label: RegExp) => {
      const row = rows.find((r) => label.test(r[0] ?? ''));
      return row?.[row.length - 1];
    };
    const inputCell = paidCell(/input price/i);
    const outputCell = paidCell(/output price/i);
    if (inputCell === undefined && outputCell === undefined) continue;
    const inputCostPerMillion = parseGooglePerMillion(inputCell);
    const outputCostPerMillion = parseGooglePerMillion(outputCell);
    if (inputCostPerMillion === undefined && outputCostPerMillion === undefined) continue;
    // An output row with no per-token amount (priced per image, say): there's no honest
    // figure to store, so the model stays out rather than carrying a wrong one.
    if (outputCell !== undefined && outputCostPerMillion === undefined) continue;
    const cachedInputCostPerMillion = parseGooglePerMillion(paidCell(/context caching price/i));
    models.push({
      id,
      inputCostPerMillion,
      outputCostPerMillion,
      ...(cachedInputCostPerMillion !== undefined ? { cachedInputCostPerMillion } : {}),
    });
  }
  return models;
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

const OPENAI_CHAT_MODEL_ID = /^(gpt-|o[1-9]|chatgpt|chat-latest)/i;

interface OpenAIColumns {
  model: number;
  input: number;
  output: number;
  cached: number;
  cacheWrite: number;
}

/**
 * Column positions for a token-priced chat table, by header name, or undefined for any
 * other table on the page (per-modality realtime and image pricing, transcription use
 * cases, fine-tuning, named configurations). The page's column order has changed before
 * and silently swapped output with cached input.
 */
function mapOpenAIColumns(headers: string[]): OpenAIColumns | undefined {
  const names = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));
  if (names.some((n) => n === 'modality' || n === 'use case' || n === 'training')) return undefined;
  const model = names.indexOf('model');
  const input = names.indexOf('input');
  const output = names.indexOf('output');
  const cached = names.indexOf('cached input');
  if (model === -1 || input === -1 || output === -1 || cached === -1) return undefined;
  const thirtyMinute = names.indexOf('30m write');
  const cacheWrite =
    thirtyMinute !== -1 ? thirtyMinute : names.findIndex((n) => n.includes('write'));
  return { model, input, output, cached, cacheWrite };
}

function openAIModel(
  id: string,
  columns: OpenAIColumns,
  cellAt: (column: number) => number | undefined,
): ScrapedModelPricing | undefined {
  const inputCostPerMillion = cellAt(columns.input);
  const outputCostPerMillion = cellAt(columns.output);
  if (inputCostPerMillion === undefined && outputCostPerMillion === undefined) return undefined;
  const cached = cellAt(columns.cached);
  const write = columns.cacheWrite === -1 ? undefined : cellAt(columns.cacheWrite);
  return {
    id,
    inputCostPerMillion,
    outputCostPerMillion,
    ...(cached !== undefined ? { cachedInputCostPerMillion: cached } : {}),
    ...(write !== undefined ? { cacheWriteCostPerMillion: write } : {}),
  };
}

/**
 * Each chat family renders as several same-shaped tables, one per pricing tier, with
 * Standard first in the DOM, so only the first occurrence of an id is kept. A grouped
 * table's first cell is a merged category on the group's first row only, so cells are
 * aligned from the end of the row rather than the start.
 */
export function parseOpenAITables(tables: TableRows[]): ScrapedModelPricing[] {
  const models: ScrapedModelPricing[] = [];
  for (const rows of tables) {
    const header = rows.find((r) => mapOpenAIColumns(r));
    const columns = header && mapOpenAIColumns(header);
    if (!header || !columns) continue;
    for (const row of rows) {
      const offset = header.length - row.length;
      if (offset < 0) continue;
      const id = row[columns.model - offset];
      if (!id || !OPENAI_CHAT_MODEL_ID.test(id) || models.some((m) => m.id === id)) continue;
      const m = openAIModel(id, columns, (c) => parseFirstDollarAmount(row[c - offset]));
      if (m) models.push(m);
    }
  }
  return models;
}

/** Astro's serialized props: `[0, value]` is a plain value and `[1, items]` an array. */
function reviveIslandProp(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value[0] === 0 && value.length === 2) return reviveIslandProp(value[1]);
    if (value[0] === 1 && value.length === 2 && Array.isArray(value[1])) {
      return value[1].map(reviveIslandProp);
    }
    return value.map(reviveIslandProp);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, reviveIslandProp(v)] as const),
    );
  }
  return value;
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

interface OpenAIGroupedProps {
  headings?: unknown[];
  groups?: Array<{ model?: unknown; rows?: unknown[][] }>;
}

/**
 * Safety net for when the rendered tables yield nothing: the same data sits in the raw
 * HTML as component props. Only payloads carrying their own `headings` are read, so
 * columns are mapped by name. The main chat tables' payload is a bare positional tuple
 * with no headings and is skipped on purpose, which leaves this fallback with too few
 * models to pass validation by itself: it recovers a partial list, loudly, not silently.
 */
export function parseOpenAIFlightPayload(html: string): ScrapedModelPricing[] {
  const models: ScrapedModelPricing[] = [];
  for (const [, rawProps] of html.matchAll(/<astro-island\b[^>]*?\bprops="([^"]*)"/g)) {
    let props: OpenAIGroupedProps;
    try {
      props = reviveIslandProp(JSON.parse(decodeHtmlAttribute(rawProps))) as OpenAIGroupedProps;
    } catch {
      continue;
    }
    if (!Array.isArray(props.headings) || !Array.isArray(props.groups)) continue;
    const headers = props.headings.map((h) => {
      if (typeof h === 'string') return h;
      const label = (h as { label?: unknown } | null)?.label;
      return typeof label === 'string' ? label : '';
    });
    const columns = mapOpenAIColumns(headers);
    if (!columns) continue;
    for (const group of props.groups) {
      for (const row of group.rows ?? []) {
        // A group's `model` fills the first heading, so a row starts at the second.
        const cell = (column: number) => row[column - 1];
        const id = columns.model === 0 ? group.model : cell(columns.model);
        if (typeof id !== 'string' || !OPENAI_CHAT_MODEL_ID.test(id)) continue;
        if (models.some((m) => m.id === id)) continue;
        const m = openAIModel(id, columns, (c) => {
          const value = cell(c);
          return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
        });
        if (m) models.push(m);
      }
    }
  }
  return models;
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

/** "Opus 4.8" -> "claude-opus-4-8" (matches the live API's hyphenated-minor-version ids). */
export function anthropicDisplayNameToId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/(\d)\.(\d)/g, '$1-$2');
  return `claude-${slug}`;
}

const ANTHROPIC_FIELD = {
  Input: 'inputCostPerMillion',
  Output: 'outputCostPerMillion',
  Read: 'cachedInputCostPerMillion',
  Write: 'cacheWriteCostPerMillion',
} as const;

/**
 * Walks the API tab's innerText a line at a time, because the order of a card's blocks
 * has changed before (caching now comes ahead of input and output) and a single regex
 * over the card matched nothing. A label's price is the first "$x / MTok" after it. On a
 * card with prompt-size tiers the smaller tier is listed first and later ones are ignored.
 */
export function parseAnthropicPricing(text: string): ScrapedModelPricing[] {
  const models: ScrapedModelPricing[] = [];
  let card: ScrapedModelPricing | undefined;
  let pending: keyof typeof ANTHROPIC_FIELD | undefined;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/^[A-Z][a-zA-Z]+ \d+(?:\.\d+)?$/.test(line)) {
      card = { id: anthropicDisplayNameToId(line) };
      pending = undefined;
      models.push(card);
      continue;
    }
    if (!card) continue;
    const label = line.match(/^(Input|Output|Read|Write)\*?$/)?.[1];
    if (label) {
      pending = label as keyof typeof ANTHROPIC_FIELD;
      continue;
    }
    const price = line.match(/^\$?(\d+(?:\.\d+)?)\s*\/\s*MTok$/)?.[1];
    if (price && pending) {
      const field = ANTHROPIC_FIELD[pending];
      if (card[field] === undefined) card[field] = Number(price);
      pending = undefined;
    }
  }
  const seen = new Set<string>();
  return models.filter((m) => {
    const priced = Object.values(ANTHROPIC_FIELD).some((field) => m[field] !== undefined);
    if (!priced || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

const MIN_COUNT_RATIO = 0.6;
const MAX_PRICE_FACTOR = 5;
const MAX_LOST_CACHE_PRICE_RATIO = 0.2;

const PRICE_FIELDS = [
  ['input', 'inputCostPerMillion'],
  ['output', 'outputCostPerMillion'],
  ['cached', 'cachedInputCostPerMillion'],
  ['cacheWrite', 'cacheWriteCostPerMillion'],
] as const;

const isValidPrice = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * Reasons to refuse a provider's new result, empty when it's acceptable. Embedding
 * models are exempt from needing an output price: they bill input only, and the bundled
 * snapshot legitimately has them that way.
 */
export function validateProviderResult(
  previous: ScrapedModelPricing[] | undefined,
  next: ScrapedModelPricing[],
): string[] {
  if (next.length === 0) return ['0 models scraped'];
  const reasons: string[] = [];
  if (previous && next.length < previous.length * MIN_COUNT_RATIO) {
    reasons.push(
      `${next.length} models is fewer than ${MIN_COUNT_RATIO * 100}% of the previous ${previous.length}`,
    );
  }

  for (const m of next) {
    const input = m.inputCostPerMillion;
    const output = m.outputCostPerMillion;
    if (!isValidPrice(input)) reasons.push(`${m.id}: input price missing or invalid (${input})`);
    if (!isValidPrice(output) && !(output === undefined && /embedding/i.test(m.id))) {
      reasons.push(`${m.id}: output price missing or invalid (${output})`);
    }
    if (isValidPrice(input) && isValidPrice(output) && output < input) {
      reasons.push(`${m.id}: output ${output} is below input ${input}`);
    }
    const cached = m.cachedInputCostPerMillion;
    if (cached !== undefined && !isValidPrice(cached)) {
      reasons.push(`${m.id}: cached price invalid (${cached})`);
    }
    if (isValidPrice(cached) && isValidPrice(input) && cached > input) {
      reasons.push(`${m.id}: cached ${cached} is above input ${input}`);
    }
    const write = m.cacheWriteCostPerMillion;
    if (write !== undefined && !isValidPrice(write)) {
      reasons.push(`${m.id}: cacheWrite price invalid (${write})`);
    }

    const before = previous?.find((p) => p.id === m.id);
    if (!before) continue;
    for (const [label, field] of PRICE_FIELDS) {
      const from = before[field];
      const to = m[field];
      if (!isValidPrice(from) || !isValidPrice(to) || from === to) continue;
      const factor = Math.min(from, to) === 0 ? Infinity : Math.max(from, to) / Math.min(from, to);
      if (factor > MAX_PRICE_FACTOR) {
        reasons.push(
          `${m.id}: ${label} moved ${from} -> ${to}, above a factor of ${MAX_PRICE_FACTOR}`,
        );
      }
    }
  }

  // A parser that stops finding a cache column loses that price everywhere without any
  // single value looking wrong. Models missing from the scrape aren't counted: their old
  // rows are carried forward, prices included.
  for (const [label, field] of PRICE_FIELDS) {
    if (label !== 'cached' && label !== 'cacheWrite') continue;
    const had = (previous ?? []).filter((p) => p[field] !== undefined);
    const remaining = had.filter((p) => next.some((m) => m.id === p.id));
    const lost = remaining.filter((p) => next.find((m) => m.id === p.id)?.[field] === undefined);
    if (lost.length > remaining.length * MAX_LOST_CACHE_PRICE_RATIO) {
      reasons.push(
        `${label} price disappeared from ${lost.length} of ${remaining.length} models that had it`,
      );
    }
  }
  return reasons;
}

export interface PriceChange {
  id: string;
  field: (typeof PRICE_FIELDS)[number][0];
  from: number | undefined;
  to: number | undefined;
}

export interface ProviderDiff {
  added: string[];
  removed: string[];
  changed: PriceChange[];
}

export function diffProviderModels(
  previous: ScrapedModelPricing[],
  next: ScrapedModelPricing[],
): ProviderDiff {
  const changed: PriceChange[] = [];
  for (const m of next) {
    const before = previous.find((p) => p.id === m.id);
    if (!before) continue;
    for (const [field, key] of PRICE_FIELDS) {
      if (before[key] !== m[key]) changed.push({ id: m.id, field, from: before[key], to: m[key] });
    }
  }
  return {
    added: next.filter((m) => !previous.some((p) => p.id === m.id)).map((m) => m.id),
    removed: previous.filter((p) => !next.some((m) => m.id === p.id)).map((p) => p.id),
    changed,
  };
}

export interface ProviderReport {
  oldCount: number;
  newCount: number;
  diff: ProviderDiff;
  /** Previous models the page no longer lists, whose old rows were carried forward. */
  keptUnlisted: string[];
  /** Set when the new result was refused and the existing data kept. */
  rejected?: string[];
}

export interface AppliedResults {
  /** The snapshot to write, or undefined when no provider was accepted. */
  data?: { generatedAt: string; providers: Record<string, ScrapedProviderResult> };
  reports: Record<string, ProviderReport>;
  anyRejected: boolean;
}

/**
 * Merges scraped results over the existing snapshot, accepted providers only. `failures`
 * holds providers whose scrape threw, by message. A provider outside `results` and
 * `failures` (a single-provider run) is left alone without being reported. `generatedAt`
 * only moves when something was accepted, and `scrapedAt` says which providers that was;
 * a rejected provider with no `scrapedAt` yet is dated by the old `generatedAt`.
 *
 * A model the page stops listing keeps its old row: lookups are by exact id, and a model
 * can stay callable after leaving a pricing page. `pruneUnlisted` drops those rows instead.
 */
export function applyProviderResults(
  existing: PricingSnapshot,
  results: Record<string, ScrapedProviderResult>,
  failures: Record<string, string>,
  now: string,
  options: { pruneUnlisted?: boolean } = {},
): AppliedResults {
  const providers = { ...existing.providers };
  const reports: Record<string, ProviderReport> = {};
  let anyAccepted = false;

  const keepExisting = (name: string) => {
    const old = existing.providers?.[name];
    if (old && !old.scrapedAt && existing.generatedAt) {
      providers[name] = {
        sourceUrl: old.sourceUrl,
        scrapedAt: existing.generatedAt,
        models: old.models,
      };
    }
  };

  for (const [name, message] of Object.entries(failures)) {
    keepExisting(name);
    const oldCount = existing.providers?.[name]?.models.length ?? 0;
    reports[name] = {
      oldCount,
      newCount: 0,
      diff: { added: [], removed: [], changed: [] },
      keptUnlisted: [],
      rejected: [`scrape failed: ${message}`],
    };
  }

  for (const [name, result] of Object.entries(results)) {
    const previous = existing.providers?.[name]?.models;
    const rejected = validateProviderResult(previous, result.models);
    const diff = diffProviderModels(previous ?? [], result.models);
    if (rejected.length > 0) {
      keepExisting(name);
      reports[name] = {
        oldCount: previous?.length ?? 0,
        newCount: result.models.length,
        diff,
        keptUnlisted: [],
        rejected,
      };
      continue;
    }
    const carried = options.pruneUnlisted
      ? []
      : (previous ?? []).filter((p) => diff.removed.includes(p.id));
    const models = [...result.models, ...carried];
    reports[name] = {
      oldCount: previous?.length ?? 0,
      newCount: models.length,
      diff,
      keptUnlisted: carried.map((m) => m.id),
    };
    anyAccepted = true;
    providers[name] = { sourceUrl: result.sourceUrl, scrapedAt: now, models };
  }

  return {
    ...(anyAccepted ? { data: { generatedAt: now, providers } } : {}),
    reports,
    anyRejected: Object.values(reports).some((r) => r.rejected),
  };
}

export function formatPricingSummary(reports: Record<string, ProviderReport>): string {
  const lines: string[] = ['Pricing summary:'];
  const show = (value: number | undefined) => (value === undefined ? '-' : String(value));
  for (const [name, report] of Object.entries(reports)) {
    const { oldCount, newCount, diff, keptUnlisted, rejected } = report;
    lines.push(
      rejected
        ? `  ${name}: REJECTED, keeping ${oldCount} existing model(s) (scraped ${newCount})`
        : `  ${name}: ${oldCount} -> ${newCount} model(s)`,
    );
    for (const reason of rejected ?? []) lines.push(`    reason: ${reason}`);
    if (diff.added.length > 0) lines.push(`    added: ${diff.added.join(', ')}`);
    const removed = diff.removed.filter((id) => !keptUnlisted.includes(id));
    if (keptUnlisted.length > 0) {
      lines.push(`    kept, not listed on page: ${keptUnlisted.join(', ')}`);
    }
    if (removed.length > 0) {
      lines.push(`    ${rejected ? 'not listed on page' : 'removed'}: ${removed.join(', ')}`);
    }
    for (const c of diff.changed) {
      lines.push(`    changed: ${c.id} ${c.field} ${show(c.from)} -> ${show(c.to)}`);
    }
  }
  return lines.join('\n');
}
