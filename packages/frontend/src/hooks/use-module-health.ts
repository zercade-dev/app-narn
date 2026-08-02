/**
 * useModuleHealth — fetches the in-process per-module reliability metrics
 * exposed by `GET /api/modules/health` and indexes the per-module aggregates
 * by moduleId for the config-card health strips.
 *
 * Metrics are best-effort (in-memory on the server, reset on restart), so
 * failures are swallowed and surface as "no data" in the UI.
 */
import { useEffect, useState } from 'react';
import { apiRequest } from './use-api.js';

export interface ModuleHealthLatency {
  count: number;
  p50: number | null;
  p95: number | null;
}

export interface ModuleHealthAggregate {
  moduleId: string;
  success: number;
  failure: number;
  total: number;
  successRate: number | null;
  rateLimit429Retries: number;
  lqaRetries: number;
  maskMismatches: number;
  latency: ModuleHealthLatency;
  /** Recent 429 timestamps (epoch ms, ascending). */
  recent429s: number[];
}

interface ModuleHealthResponse {
  generatedAt: number;
  modules: ModuleHealthAggregate[];
}

export interface UseModuleHealthResult {
  /** Per-module aggregates keyed by moduleId. Empty until loaded. */
  byModule: Record<string, ModuleHealthAggregate>;
  loading: boolean;
}

export function useModuleHealth(refreshTrigger?: number): UseModuleHealthResult {
  const [byModule, setByModule] = useState<Record<string, ModuleHealthAggregate>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiRequest<ModuleHealthResponse>('/modules/health');
        if (!cancelled && res && Array.isArray(res.modules)) {
          setByModule(Object.fromEntries(res.modules.map((m) => [m.moduleId, m])));
        }
      } catch {
        // Non-critical — the strip falls back to "no data yet".
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  return { byModule, loading };
}
