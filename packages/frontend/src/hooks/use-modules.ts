/**
 * Shared best-effort fetch hooks for the module list and the per-module
 * globally-configured model. Both effects were previously copy-pasted across the
 * AI-review dialog, the source-review tab, the category tab, and the batch tab;
 * each is best-effort (errors are swallowed) and falls back to an empty result.
 */
import { useEffect, useState } from 'react';
import type { ModuleInfo } from '../components/batch/ModulesPanel.js';
import { apiRequest } from './use-api.js';

/**
 * Discover the available modules. The list is small and rarely changes; on
 * failure the result stays an empty array so callers degrade to "no options"
 * rather than throwing.
 *
 * By default the fetch runs once on mount. Pass `{ enabled }` to defer it — the
 * fetch (re-)runs each time `enabled` transitions to `true` and is skipped while
 * `false`, matching the "fetch each time the dialog opens" pattern used by the
 * glossary generation dialogs.
 */
export function useModules(options?: { enabled?: boolean }): ModuleInfo[] {
  const enabled = options?.enabled ?? true;
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void apiRequest<{ modules: ModuleInfo[] }>('/modules')
      .then((res) => {
        if (!cancelled) setModules(res.modules);
      })
      .catch(() => {
        /* non-critical — the caller just shows no options */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return modules;
}

/**
 * Read each module's globally-configured model into a `{ moduleId: model }` map
 * so a module switch can default to it rather than the cheapest. Best-effort:
 * on failure the map stays empty and callers fall back to the cheapest model.
 */
export function useConfiguredModels(): Record<string, string> {
  const [configuredModels, setConfiguredModels] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ moduleConfigs?: Record<string, { config?: { model?: unknown } }> }>(
      '/global-config',
    )
      .then((cfg) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const [id, entry] of Object.entries(cfg.moduleConfigs ?? {})) {
          const configured = entry?.config?.model;
          if (typeof configured === 'string' && configured) map[id] = configured;
        }
        setConfiguredModels(map);
      })
      .catch(() => {
        /* non-critical — falls back to the cheapest model */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return configuredModels;
}
