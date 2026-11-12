/**
 * Provider setup for Simple mode, where the Global Config and Routing tabs are
 * hidden. These helpers do what those tabs would: enable a provider globally and
 * point a project's routing at it. No new server routes.
 */
import { ApiError, apiRequest } from '../hooks/use-api.js';
import { resolveDefaultReasoningEffort } from './default-reasoning-effort.js';
import { makeSimpleRule } from './routing-mode.js';

/** Vault keys of the providers Freeway can use for free. */
export const FREE_KEYS = [
  'GOOGLE_API_KEY',
  'GROQ_API_KEY',
  'OPENROUTER_API_KEY',
  'DEEPL_API_KEY',
] as const;

export const GOOGLE_KEY_URL = 'https://aistudio.google.com/apikey';

/** Providers that work from an API key alone and have no instance layer. */
const NON_INSTANCEABLE = new Set(['deepl']);

/** Providers offered under "Use my own provider" (key alone is enough). */
const KEY_ONLY_PROVIDERS = [
  'anthropic',
  'openai',
  'deepseek',
  'openrouter',
  'groq',
  'google',
  'deepl',
] as const;

/** Base ids offered under "Use my own provider"; GitHub Copilot is local-only. */
export function ownProviderChoices(cloud: boolean): readonly string[] {
  return cloud ? KEY_ONLY_PROVIDERS : [...KEY_ONLY_PROVIDERS, 'copilot'];
}

/**
 * Vault key each offered provider reads. Mirrors the module manifests'
 * `requiredEnvVars`, so the guide can tell whether a chosen provider is usable
 * without waiting for the module list.
 */
const PROVIDER_KEYS: Readonly<Record<string, string>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  google: 'GOOGLE_API_KEY',
  deepl: 'DEEPL_API_KEY',
  copilot: 'GITHUB_TOKEN',
};

/** Free keys in the order the guide prefers them, with the provider each one unlocks. */
export const FREE_KEY_PROVIDERS: ReadonlyArray<{ key: (typeof FREE_KEYS)[number]; base: string }> =
  [
    { key: 'GOOGLE_API_KEY', base: 'google' },
    { key: 'GROQ_API_KEY', base: 'groq' },
    { key: 'OPENROUTER_API_KEY', base: 'openrouter' },
    { key: 'DEEPL_API_KEY', base: 'deepl' },
  ];

/**
 * The id `enableProvider(base)` returns, known without asking the server:
 * `<base>:default`, or the bare id for a module with no instance layer.
 */
export function providerInstanceId(baseModuleId: string): string {
  return NON_INSTANCEABLE.has(baseModuleId) ? baseModuleId : `${baseModuleId}:default`;
}

/** The vault key behind a base module or instance id (`openai`, `openai:default`), if known. */
export function providerKeyFor(moduleId: string): string | undefined {
  return PROVIDER_KEYS[moduleId.split(':')[0]];
}

interface GlobalConfigDoc {
  moduleConfigs?: Record<string, { enabled?: boolean | null; config?: Record<string, unknown> }>;
}

/**
 * Enable a base module's `default` instance globally (what the Global Config
 * "Enable a module" picker does), so Freeway or a routing rule can use it.
 * Idempotent: an existing instance (409) is reused with its stored config
 * untouched, and one that is already enabled is left alone. Non-instanceable
 * modules (deepl) are enabled directly. Returns the id to route to.
 */
export async function enableProvider(baseModuleId: string): Promise<string> {
  const instanceable = !NON_INSTANCEABLE.has(baseModuleId);
  const id = providerInstanceId(baseModuleId);
  let config: Record<string, unknown> = {};
  let existed = !instanceable;
  if (instanceable) {
    try {
      await apiRequest('/global-config/instances', {
        method: 'POST',
        body: JSON.stringify({ baseModuleId, slug: 'default' }),
      });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err;
      existed = true;
    }
  }
  if (existed) {
    // PUT replaces `config`, so carry over whatever is already stored.
    const doc = await apiRequest<GlobalConfigDoc>('/global-config');
    const current = doc.moduleConfigs?.[id];
    if (current?.enabled === true) return id;
    config = current?.config ?? {};
  } else {
    // Brand-new instance: same first-enable default as the Global Config flow.
    const effort = await resolveDefaultReasoningEffort(id);
    if (effort) config.reasoningEffort = effort;
  }
  await apiRequest(`/global-config/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled: true, config }),
  });
  return id;
}

/**
 * Write the single catch-all rule for `instanceId` on a project: the same
 * document the Routing tab's simple selector saves.
 */
export async function applySimpleRule(projectId: string, instanceId: string): Promise<void> {
  const rule = makeSimpleRule(instanceId);
  const groupId = 'default-group';
  await apiRequest(`/projects/${projectId}/routing-rules`, {
    method: 'PUT',
    body: JSON.stringify({
      rules: [rule],
      groups: [{ id: groupId, name: 'Default Group', rules: [rule] }],
      activeGroupId: groupId,
    }),
  });
}
