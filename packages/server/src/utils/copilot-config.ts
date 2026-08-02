/** Module id of the built-in GitHub Copilot translation module. */
export const COPILOT_MODULE_ID = 'copilot';

/**
 * Ensures a Copilot module config carries a valid `batchMode`, defaulting to
 * `'entry'` when unset or invalid. Single source of truth shared by
 * `routes/modules.ts` and `M6-module-registry.ts`.
 */
export function normalizeCopilotConfig(config: Record<string, unknown>): Record<string, unknown> {
  const mode = config.batchMode;
  if (mode === 'language' || mode === 'entry') {
    return config;
  }
  return { ...config, batchMode: 'entry' };
}
