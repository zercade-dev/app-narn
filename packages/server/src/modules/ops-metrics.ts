/**
 * Ops-metrics snapshot — a dependency-free, in-process view of app health for an
 * external scraper. A cloud composition root's prom-client `/metrics` endpoint
 * imports this via `@zercade-dev/narn-server/metrics` and translates it to the
 * Prometheus exposition format; the open-core app stays prom-client-free.
 *
 * Carries module-provider health (success/latency/429 per module) + DB-pool
 * saturation. HTTP metrics live in a cloud composition root's prom-client
 * middleware; run-engine queue depth is a deferred follow-up (needs
 * cross-tenant counting + M9 recorder wiring).
 */
import { metricsCollector, type ModuleHealthSnapshot } from './metrics-collector.js';
import { getPoolStats } from '../storage/pg/pool.js';

export interface OpsMetricsSnapshot {
  generatedAt: number;
  modules: ModuleHealthSnapshot;
  db: ReturnType<typeof getPoolStats>;
}

export function opsMetricsSnapshot(): OpsMetricsSnapshot {
  return {
    generatedAt: Date.now(),
    modules: metricsCollector.snapshot(),
    db: getPoolStats(),
  };
}
