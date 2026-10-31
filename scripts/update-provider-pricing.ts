#!/usr/bin/env npx tsx
/**
 * update-provider-pricing.ts
 *
 * Maintenance script: scrapes each AI-SDK provider's OFFICIAL pricing page and
 * persists the result to pricing-data/provider-pricing.json, which
 * `pricing-oracle.ts` reads as static bundled data (no OpenRouter, no runtime
 * network call from the running server).
 *
 * WHY A SCRIPT INSTEAD OF A LIVE FETCH: none of the 4 providers expose a
 * machine-readable pricing API — their `/models` list endpoints return ids and
 * capabilities, never prices. The only place prices exist is each provider's
 * marketing/docs pricing page. So this is a periodic "extract and persist"
 * maintenance step (re-run by a maintainer, or wire into a scheduled CI job),
 * not something the server can self-refresh at request time.
 *
 * Uses Playwright (headless Chromium) uniformly across all 4 providers: three
 * (DeepSeek, Google, OpenAI) render their pricing tables server-side, but
 * Anthropic's pricing page is a client-rendered SPA with ZERO pricing content
 * in the raw pre-JS HTML (verified via curl — 0 occurrences of any model name).
 * Using a real browser for all 4 is one uniform, redesign-proof code path
 * rather than a plain-fetch/Playwright split that would silently break the day
 * any one of the other three switches to client-side rendering too.
 *
 * Usage (from the workspace root):
 *   npx tsx scripts/update-provider-pricing.ts
 *   npx tsx scripts/update-provider-pricing.ts --provider=google   (single provider)
 *
 * Re-run periodically (prices change without notice) and commit the diff in
 * pricing-data/provider-pricing.json. A provider whose new result fails the checks in
 * provider-pricing-lib.ts keeps its existing data and makes this exit non-zero; the others
 * are still written.
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import {
  applyProviderResults,
  formatPricingSummary,
  parseAnthropicPricing,
  parseDeepSeekPricing,
  parseGoogleSections,
  parseOpenAIFlightPayload,
  parseOpenAITables,
  type PricingSnapshot,
  type ScrapedProviderResult,
  type TableRows,
} from './provider-pricing-lib.js';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(
  SCRIPT_DIR,
  '../packages/shared/src/ai-sdk-provider/pricing-data/provider-pricing.json',
);

async function extractTables(page: Page): Promise<TableRows[]> {
  return page.$$eval('table', (tables) =>
    tables.map((t) =>
      Array.from(t.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td,th')).map((c) => (c.textContent ?? '').trim()),
      ),
    ),
  );
}

// ─── DeepSeek ─────────────────────────────────────────────────────────────────

const DEEPSEEK_URL = 'https://api-docs.deepseek.com/quick_start/pricing';

async function scrapeDeepSeek(page: Page): Promise<ScrapedProviderResult> {
  await page.goto(DEEPSEEK_URL, { waitUntil: 'networkidle' });
  const tables = await extractTables(page);
  const pageText = await page.locator('body').innerText();
  return { sourceUrl: DEEPSEEK_URL, models: parseDeepSeekPricing(tables, pageText) };
}

// ─── Google (Gemini) ────────────────────────────────────────────────────────

const GOOGLE_URL = 'https://ai.google.dev/gemini-api/docs/pricing';

async function scrapeGoogle(page: Page): Promise<ScrapedProviderResult> {
  await page.goto(GOOGLE_URL, { waitUntil: 'networkidle' });

  const sections = await page.evaluate(() => {
    const out: Array<{ id: string; rows: string[][] }> = [];
    const anchors = Array.from(document.querySelectorAll('code, table'));
    // Model ids and their pricing table are usually adjacent (CODE, TABLE), but
    // the page occasionally lists several ids back-to-back with no table
    // between them (e.g. a "-customtools" variant sharing its base model's
    // table) — batch consecutive un-tabled ids and assign them ALL the same
    // next table, instead of only pairing the single id right before it.
    let pendingIds: string[] = [];
    for (const el of anchors) {
      if (el.tagName === 'CODE') {
        const text = (el.textContent ?? '').trim();
        if (/^gemini-[\w.-]+$/i.test(text)) pendingIds.push(text);
        continue;
      }
      if (pendingIds.length === 0) continue;
      const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td,th')).map((c) => (c.textContent ?? '').trim()),
      );
      for (const id of pendingIds) out.push({ id, rows });
      pendingIds = [];
    }
    return out;
  });

  return { sourceUrl: GOOGLE_URL, models: parseGoogleSections(sections) };
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

const OPENAI_URL = 'https://developers.openai.com/api/docs/pricing';

/**
 * Each model's own detail page at this base URL (`{base}/<id>`) — NOT the
 * pricing page — carries a "Features" section with a "Function calling:
 * Supported|Not supported" row, a plain-text "N context window" figure, and a
 * "Modalities" section with per-modality Image/Audio input support.
 * (Confirmed via live Playwright inspection on 2026-07-06: the pricing page
 * has zero per-model capability fields, only price tables; the catalog index
 * page at `/api/docs/models` has a "Tools" comma-list field but only for the
 * 3 models it shows by default, hiding `-pro`/`-nano` variants behind a
 * client-side "View more" that doesn't expand into new DOM text. Each
 * model's OWN detail page, by contrast, reliably renders the "Features" and
 * "Modalities" blocks and the context-window figure for every model id,
 * including variants absent from the catalog index — confirmed for all 6
 * ids scraped from the pricing tables.)
 */
const OPENAI_MODEL_DETAIL_BASE = 'https://developers.openai.com/api/docs/models';

async function scrapeOpenAI(page: Page): Promise<ScrapedProviderResult> {
  await page.goto(OPENAI_URL, { waitUntil: 'networkidle' });
  const tables = await extractTables(page);

  let models = parseOpenAITables(tables);
  if (models.length === 0) models = parseOpenAIFlightPayload(await page.content());

  // Real per-model data from each model's own detail page: the Features
  // section's "Function calling: Supported|Not supported" field, the plain-
  // text context-window figure, and the Modalities section's per-modality
  // Image/Audio input support (unlike the pricing/catalog pages, which only
  // carry page-level blanket vision/audio statements).
  for (const m of models) {
    const detailUrl = `${OPENAI_MODEL_DETAIL_BASE}/${m.id}`;
    let response;
    try {
      response = await page.goto(detailUrl, { waitUntil: 'networkidle' });
    } catch {
      continue;
    }
    if (!response?.ok()) continue;
    const bodyText = await page.locator('body').innerText();
    const match = bodyText.match(/Function calling\s*\n\s*(Supported|Not supported)/i);
    if (match?.[1]?.toLowerCase() === 'supported') {
      m.capabilityTags = ['tools'];
    }

    // Context window: real per-model figure stated as plain text on this
    // same page (e.g. "1,050,000 context window").
    const contextMatch = bodyText.match(/([\d,]+)\s*context window/i);
    if (contextMatch) {
      const contextLength = Number(contextMatch[1].replace(/,/g, ''));
      if (Number.isFinite(contextLength) && contextLength > 0) m.contextLength = contextLength;
    }

    // Modalities: real per-model vision/audio input support from this same
    // page's "Modalities" section (e.g. "Image\nInput only", "Audio\nNot
    // supported") — replaces the OpenRouter gap-fill for OpenAI entirely (see
    // the updated GAPS config below, which no longer includes 'openai').
    const modalityTags: string[] = [];
    const imageModality = bodyText.match(
      /Image\s*\n\s*(Input only|Input and output|Not supported)/i,
    );
    if (imageModality && !/Not supported/i.test(imageModality[1])) modalityTags.push('vision');
    const audioModality = bodyText.match(
      /Audio\s*\n\s*(Input only|Input and output|Not supported)/i,
    );
    if (audioModality && !/Not supported/i.test(audioModality[1])) modalityTags.push('audio');
    if (modalityTags.length > 0) {
      m.capabilityTags = [...new Set([...(m.capabilityTags ?? []), ...modalityTags])];
    }
  }

  return { sourceUrl: OPENAI_URL, models };
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

const ANTHROPIC_URL = 'https://claude.com/pricing';

async function scrapeAnthropic(page: Page): Promise<ScrapedProviderResult> {
  await page.goto(ANTHROPIC_URL, { waitUntil: 'networkidle' });
  // The page defaults to the consumer "Individual" plan tab; API model pricing
  // cards only render after switching to the "API" tab (confirmed via
  // Playwright inspection on 2026-07-06 — the default tab has zero model
  // cards in its innerText).
  await page.getByRole('tab', { name: 'API', exact: true }).click();
  await page.waitForTimeout(1000);
  const text = await page.locator('body').innerText();

  return { sourceUrl: ANTHROPIC_URL, models: parseAnthropicPricing(text) };
}

// ─── OpenRouter capability gap-fill (scrape-time only, capabilities never pricing) ──

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

interface OpenRouterCapabilityModel {
  id: string;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
}

/**
 * Google has no honest per-model tools/vision/audio source: its own docs only
 * state a blanket "all current models support X" claim, not real per-model
 * flags. This queries OpenRouter's public models feed ONCE (plain fetch, no
 * browser) at scrape time and merges vision/audio/tools tags for JUST that gap
 * into the already-scraped snapshot. Never reads or merges `pricing` —
 * capability fields only. OpenAI no longer needs this: its own per-model detail
 * pages (see `OPENAI_MODEL_DETAIL_BASE`) state real context-window, tools, and
 * vision/audio data directly, scraped in `scrapeOpenAI`. Anthropic and DeepSeek
 * are never queried here either; they don't need it.
 */
async function mergeOpenRouterCapabilityGaps(
  results: Record<string, ScrapedProviderResult>,
): Promise<void> {
  const GAPS: Record<string, string[]> = {
    google: ['tools', 'vision', 'audio'],
  };
  const providersToFill = Object.keys(GAPS).filter((p) => results[p]);
  if (providersToFill.length === 0) return;

  let orModels: OpenRouterCapabilityModel[];
  try {
    const res = await fetch(OPENROUTER_MODELS_URL);
    if (!res.ok) {
      console.warn(
        `[openrouter-capabilities] fetch failed (HTTP ${res.status}); skipping capability gap-fill`,
      );
      return;
    }
    const json = (await res.json()) as { data?: OpenRouterCapabilityModel[] };
    orModels = json.data ?? [];
  } catch (err) {
    console.warn('[openrouter-capabilities] fetch error; skipping capability gap-fill', err);
    return;
  }

  // OpenRouter ids are `<provider>/<model>` (e.g. `openai/gpt-5.4`); our
  // snapshot ids are the bare provider-native id.
  const byNativeId = new Map<string, OpenRouterCapabilityModel>();
  for (const m of orModels) {
    const native = m.id.includes('/') ? m.id.slice(m.id.lastIndexOf('/') + 1) : m.id;
    byNativeId.set(native, m);
  }

  for (const [provider, wantedTags] of Object.entries(GAPS)) {
    const providerResult = results[provider];
    if (!providerResult) continue;
    for (const model of providerResult.models) {
      const match = byNativeId.get(model.id);
      if (!match) continue;
      const modalities = new Set(match.architecture?.input_modalities ?? []);
      const params = new Set(match.supported_parameters ?? []);
      const found: string[] = [];
      if (wantedTags.includes('tools') && params.has('tools')) found.push('tools');
      if (wantedTags.includes('vision') && modalities.has('image')) found.push('vision');
      if (wantedTags.includes('audio') && modalities.has('audio')) found.push('audio');
      if (found.length === 0) continue;
      model.capabilityTags = [...new Set([...(model.capabilityTags ?? []), ...found])];
    }
  }
}

// ─── Live model coverage check (maintainer-only, warn-only, never blocks) ────

/**
 * Approximate, script-local filter for non-text-output models (image/audio/
 * tts/embedding/video/live/realtime models, etc.) — deliberately NOT the
 * production filter in packages/shared/src/ai-sdk-provider/reasoning-resolvers.ts,
 * to keep this maintenance script decoupled from runtime internals. This is
 * an advisory warning, not a strict gate, so an approximate match is fine.
 */
const NON_TEXT_MODEL_ID_PATTERN =
  /image|audio|tts|embed|video|live|realtime|transcri|veo|lyria|music|aqa|banana|whisper|sora|moderation/i;

interface LiveCoverageConfig {
  /** Same env var name as the module's manifest.json requiredEnvVars. */
  envVar: string;
  /** Fetches the provider's live model list; returns raw (unfiltered) ids. */
  fetchLiveModelIds: () => Promise<string[]>;
}

const LIVE_COVERAGE_CONFIGS: Record<string, LiveCoverageConfig> = {
  openai: {
    envVar: 'OPENAI_API_KEY',
    fetchLiveModelIds: async () => {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? []).map((m) => m.id);
    },
  },
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    fetchLiveModelIds: async () => {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
          'anthropic-version': '2023-06-01',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? []).map((m) => m.id);
    },
  },
  google: {
    envVar: 'GOOGLE_API_KEY',
    fetchLiveModelIds: async () => {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': process.env.GOOGLE_API_KEY ?? '' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      // Strip "models/" prefix, matching resolveGoogleModels' runtime convention
      // (packages/shared/src/ai-sdk-provider/reasoning-resolvers.ts).
      return (json.models ?? []).map((m) =>
        m.name.startsWith('models/') ? m.name.slice('models/'.length) : m.name,
      );
    },
  },
  deepseek: {
    envVar: 'DEEPSEEK_API_KEY',
    fetchLiveModelIds: async () => {
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? []).map((m) => m.id);
    },
  },
};

/**
 * Strips a trailing dated-snapshot suffix (e.g. "-2024-08-06", "-20251101") so
 * a live provider's dated snapshot id can also be checked against its base
 * family id — several providers keep the bare family name priced on their
 * pricing page while /models additionally lists every dated snapshot
 * separately (e.g. Anthropic's claude-opus-4-5-20251101 alongside the priced
 * claude-opus-4-5).
 */
function stripDatedSnapshotSuffix(id: string): string {
  return id.replace(/-\d{4}-\d{2}-\d{2}$/, '').replace(/-\d{8}$/, '');
}

/**
 * For each provider with a key present in scripts/.env, calls its live
 * model-list endpoint and warns (never blocks — process.exitCode is never
 * touched here) about any live model id with no scraped price. A missing
 * key, a provider not present in `results` (e.g. a --provider=x single-
 * provider run), or a failed fetch each just narrow what gets checked rather
 * than failing the whole run.
 */
async function checkLiveModelCoverage(
  results: Record<string, ScrapedProviderResult>,
): Promise<void> {
  const gaps: Array<{ provider: string; id: string }> = [];

  for (const [provider, config] of Object.entries(LIVE_COVERAGE_CONFIGS)) {
    if (!process.env[config.envVar]) continue;
    const scraped = results[provider];
    if (!scraped) continue;

    let liveIds: string[];
    try {
      liveIds = await config.fetchLiveModelIds();
    } catch (err) {
      console.warn(
        `[coverage-check] ${provider} fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const scrapedIds = new Set(scraped.models.map((m) => m.id.toLowerCase()));
    for (const liveId of liveIds) {
      if (NON_TEXT_MODEL_ID_PATTERN.test(liveId)) continue;
      const normalized = liveId.toLowerCase();
      const family = stripDatedSnapshotSuffix(normalized);
      if (scrapedIds.has(normalized) || scrapedIds.has(family)) continue;
      gaps.push({ provider, id: liveId });
    }
  }

  if (gaps.length === 0) return;
  console.log(`\n⚠ ${gaps.length} live model(s) have no scraped price:`);
  for (const gap of gaps) {
    console.log(`  ${gap.provider}: ${gap.id}`);
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────

const SCRAPERS: Record<string, (page: Page) => Promise<ScrapedProviderResult>> = {
  deepseek: scrapeDeepSeek,
  google: scrapeGoogle,
  openai: scrapeOpenAI,
  anthropic: scrapeAnthropic,
};

async function main(): Promise<void> {
  try {
    process.loadEnvFile(resolve(SCRIPT_DIR, '.env'));
  } catch {
    // No scripts/.env — the coverage-check feature is simply unavailable
    // this run; everything else behaves exactly as if this line didn't exist.
  }

  const onlyArg = process.argv.find((a) => a.startsWith('--provider='));
  const only = onlyArg?.split('=')[1];
  const providers = only ? [only] : Object.keys(SCRAPERS);

  const browser = await chromium.launch();
  const results: Record<string, ScrapedProviderResult> = {};
  const failures: Record<string, string> = {};
  try {
    for (const provider of providers) {
      const scrape = SCRAPERS[provider];
      if (!scrape) {
        console.error(`Unknown provider "${provider}". Known: ${Object.keys(SCRAPERS).join(', ')}`);
        failures[provider] = 'unknown provider';
        continue;
      }
      const page = await browser.newPage();
      try {
        console.log(`Scraping ${provider}...`);
        const result = await scrape(page);
        results[provider] = result;
        console.log(`  ${result.models.length} priced model(s) found`);
        for (const m of result.models) {
          console.log(
            `    ${m.id}: in=${m.inputCostPerMillion ?? '?'} out=${m.outputCostPerMillion ?? '?'}` +
              (m.cachedInputCostPerMillion !== undefined
                ? ` cacheRead=${m.cachedInputCostPerMillion}`
                : '') +
              (m.cacheWriteCostPerMillion !== undefined
                ? ` cacheWrite=${m.cacheWriteCostPerMillion}`
                : ''),
          );
        }
      } catch (err) {
        console.error(`  FAILED to scrape ${provider}:`, err);
        failures[provider] = err instanceof Error ? err.message : String(err);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  await mergeOpenRouterCapabilityGaps(results);

  await checkLiveModelCoverage(results);

  // Merge into any existing file so a single-provider re-run (--provider=x)
  // doesn't wipe out the other three.
  let existing: PricingSnapshot = {};
  try {
    existing = (await import(OUTPUT_PATH, { with: { type: 'json' } })).default;
  } catch {
    // No existing file yet — first run.
  }

  const { data, reports, anyRejected } = applyProviderResults(
    existing,
    results,
    failures,
    new Date().toISOString(),
  );
  console.log(`\n${formatPricingSummary(reports)}`);
  if (anyRejected) process.exitCode = 1;

  if (!data) {
    console.error('\nNo provider was accepted; not writing output.');
    process.exitCode = 1;
    return;
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  // Format with this repo's own prettier config so `pnpm format:check` doesn't
  // flag the freshly-scraped snapshot (prettier collapses short arrays like
  // `capabilityTags` onto one line; plain JSON.stringify never does).
  const config = await prettier.resolveConfig(OUTPUT_PATH);
  const formatted = await prettier.format(JSON.stringify(data, null, 2), {
    ...config,
    filepath: OUTPUT_PATH,
  });
  writeFileSync(OUTPUT_PATH, formatted);
  console.log(`\nWrote ${OUTPUT_PATH}`);
  if (anyRejected) {
    console.error('Rejected providers kept their existing data. See the summary above.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
