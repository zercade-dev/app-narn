#!/usr/bin/env npx tsx
/**
 * probe-cache-usage.ts
 *
 * DIAGNOSTIC — not part of the shipped app. Makes two real generateText() calls
 * per provider with an identical, long system prompt (well past the ~1024-token
 * minimum most providers require before creating/reading a prompt-cache entry),
 * so the second call should hit whatever cache the first call wrote. Prints the
 * full `usage` and `providerMetadata` from each call.
 *
 * WHY: `packages/shared/src/ai-sdk-provider/pricing-oracle.ts` already scrapes
 * and stores cachedInputCostPerMillion/cacheWriteCostPerMillion, but
 * `packages/server/src/modules/M9/usage-pricing.ts`'s costFromTokens() never
 * uses them — every run is billed at the flat input rate regardless of any
 * real cache hit. The AI SDK's own `LanguageModelUsage` type (ai@7) already has
 * a standardized `inputTokenDetails.cacheReadTokens` / `.cacheWriteTokens`
 * shape, but whether each of the 4 provider adapters actually POPULATES it from
 * real API responses (vs. it just being a type-level placeholder) needs live
 * verification — this script is that verification.
 *
 * Requires scripts/.env (same file/vars as update-provider-pricing.ts's
 * coverage check: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY,
 * DEEPSEEK_API_KEY). A provider with no key is skipped. This makes REAL,
 * BILLED API calls (2 small calls per configured provider) — only run when you
 * intend to.
 *
 * Usage (from the workspace root): npx tsx scripts/probe-cache-usage.ts
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModel } from 'ai';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// Repeated, realistic-shaped instruction block — long enough to clear every
// provider's minimum cacheable-prompt length, short on tokens-per-line so the
// count is easy to reason about (~20-25 tokens/line * 120 lines ≈ 2500-3000).
const CACHE_PROBE_SYSTEM_PROMPT =
  'You are a translation assistant. Follow these rules exactly:\n' +
  Array.from(
    { length: 120 },
    (_, i) =>
      `Rule ${i + 1}: Never translate proper nouns, brand names, or placeholder tokens like {0} or %s. Preserve original casing and punctuation exactly as given in the source text.`,
  ).join('\n');

interface ProbeConfig {
  envVar: string;
  model: () => LanguageModel;
  /** Anthropic requires an explicit opt-in provider option to create/read a cache entry. */
  providerOptions?: Record<string, unknown>;
}

const PROBES: Record<string, ProbeConfig> = {
  openai: {
    envVar: 'OPENAI_API_KEY',
    model: () => createOpenAI({ apiKey: process.env.OPENAI_API_KEY! })('gpt-5.4-mini'),
  },
  anthropic: {
    envVar: 'ANTHROPIC_API_KEY',
    model: () => createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })('claude-haiku-4-5'),
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
  google: {
    envVar: 'GOOGLE_API_KEY',
    model: () =>
      createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY! })('gemini-2.5-flash'),
  },
  deepseek: {
    envVar: 'DEEPSEEK_API_KEY',
    model: () => createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! })('deepseek-chat'),
  },
};

async function probeOne(provider: string, config: ProbeConfig): Promise<void> {
  const model = config.model();
  const calls = ['1st call (expect cache MISS / write)', '2nd call (expect cache HIT / read)'];
  for (const call of calls) {
    const result = await generateText({
      model,
      system: CACHE_PROBE_SYSTEM_PROMPT,
      prompt: 'Reply with only the word OK.',
      maxOutputTokens: 16,
      ...(config.providerOptions ? { providerOptions: config.providerOptions } : {}),
    });
    console.log(`\n=== ${provider} — ${call} ===`);
    console.log('usage:', JSON.stringify(result.usage, null, 2));
    console.log('providerMetadata:', JSON.stringify(result.providerMetadata, null, 2));
  }
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(resolve(SCRIPT_DIR, '.env'));
  } catch {
    console.error(
      'No scripts/.env found — nothing to probe. Copy scripts/.env.example and fill in keys.',
    );
    return;
  }

  for (const [provider, config] of Object.entries(PROBES)) {
    if (!process.env[config.envVar]) {
      console.log(`Skipping ${provider} (no ${config.envVar})`);
      continue;
    }
    try {
      await probeOne(provider, config);
    } catch (err) {
      console.error(`${provider} probe failed:`, err);
    }
  }
}

main();
