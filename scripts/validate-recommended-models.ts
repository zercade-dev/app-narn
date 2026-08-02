/**
 * Offline validator for the curated recommended-model ids
 * (`packages/shared/src/recommended-models.ts`). For each provider with a
 * locally-available API key, it fetches the provider's live model list and
 * reports which curated ids are MISSING from it; OpenRouter is validated via
 * its public catalog (no key); Copilot is always skipped (no local token).
 *
 * Keys are read from an env file (default `scripts/.env`, override with
 * `NARN_ENV_FILE`) — NEVER passed on argv and NEVER printed. The script only
 * emits per-id present/missing booleans, so secrets never reach stdout/logs.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-recommended-models.ts
 *   NARN_ENV_FILE=/abs/path/to/.env pnpm exec tsx scripts/validate-recommended-models.ts
 *
 * Exit code is 0 even when ids are missing — this is an advisory report, not a
 * gate (the curated list is best-effort and a provider can rename ids anytime).
 */
import { readFileSync } from 'node:fs';
// Imported by relative source path (not the package name) to match the other
// scripts/ entries and to work without a built `packages/shared/dist`.
import { RECOMMENDED_MODELS } from '../packages/shared/src/recommended-models.js';

/** Parse `KEY=VALUE` lines from an env file into a map. Missing file ⇒ {}. */
function readEnvFile(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
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
    // Strip a single layer of surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/** GET JSON with a short timeout; returns null on any failure. */
async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/** Pull a string-id list out of the common `{data:[{id}]}` / Google shapes. */
function idsFrom(payload: unknown): string[] {
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    // OpenAI / DeepSeek / OpenRouter: { data: [{ id }] }
    if (Array.isArray(obj.data)) {
      return obj.data
        .map((m) => (m as Record<string, unknown>)?.id)
        .filter((id): id is string => typeof id === 'string');
    }
    // Anthropic: { data: [{ id }] } (handled above); Google: { models: [{ name }] }
    if (Array.isArray(obj.models)) {
      return obj.models
        .map((m) => (m as Record<string, unknown>)?.name)
        .filter((n): n is string => typeof n === 'string')
        .map((n) => n.replace(/^models\//, '')); // "models/gemini-2.5-pro" → "gemini-2.5-pro"
    }
  }
  return [];
}

interface ProviderCheck {
  provider: keyof typeof RECOMMENDED_MODELS;
  fetchIds: (env: Record<string, string>) => Promise<string[] | null>;
}

const CHECKS: ProviderCheck[] = [
  {
    provider: 'openai',
    fetchIds: async (env) => {
      const key = env.OPENAI_API_KEY;
      if (!key) return null;
      return idsFrom(await getJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` }));
    },
  },
  {
    provider: 'anthropic',
    fetchIds: async (env) => {
      const key = env.ANTHROPIC_API_KEY;
      if (!key) return null;
      return idsFrom(
        await getJson('https://api.anthropic.com/v1/models', {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        }),
      );
    },
  },
  {
    provider: 'google',
    fetchIds: async (env) => {
      const key = env.GOOGLE_API_KEY;
      if (!key) return null;
      return idsFrom(
        await getJson(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1000`,
          {},
        ),
      );
    },
  },
  {
    provider: 'deepseek',
    fetchIds: async (env) => {
      const key = env.DEEPSEEK_API_KEY;
      if (!key) return null;
      return idsFrom(await getJson('https://api.deepseek.com/models', { Authorization: `Bearer ${key}` }));
    },
  },
  {
    provider: 'openrouter',
    // Public catalog — no key needed.
    fetchIds: async () => idsFrom(await getJson('https://openrouter.ai/api/v1/models', {})),
  },
];

async function main(): Promise<void> {
  const envPath = process.env.NARN_ENV_FILE ?? 'scripts/.env';
  const env = readEnvFile(envPath);

  console.log(`# Recommended-model id validation (env: ${envPath})\n`);

  for (const { provider, fetchIds } of CHECKS) {
    const curated = RECOMMENDED_MODELS[provider];
    let live: string[] | null = null;
    try {
      live = await fetchIds(env);
    } catch {
      live = null;
    }
    if (live === null) {
      console.log(`${provider}: SKIPPED (no local key or fetch failed) — ${curated.length} id(s) unvalidated`);
      continue;
    }
    const liveSet = new Set(live.map((id) => id.trim().toLowerCase()));
    const missing = curated.filter((id) => !liveSet.has(id.trim().toLowerCase()));
    if (process.env.NARN_LIST_LIVE && missing.length > 0) {
      console.log(`  [live ${provider} ids] ${live.slice().sort().join(', ')}`);
    }
    if (missing.length === 0) {
      console.log(`${provider}: OK — all ${curated.length} curated id(s) present in the live list (${live.length} models)`);
    } else {
      console.log(`${provider}: MISSING ${missing.length}/${curated.length} — ${missing.join(', ')} (live list has ${live.length} models)`);
    }
  }

  // Copilot is never validated locally.
  console.log(`copilot: SKIPPED (no local GITHUB_TOKEN) — ${RECOMMENDED_MODELS.copilot.length} id(s) unvalidated`);
}

void main();
