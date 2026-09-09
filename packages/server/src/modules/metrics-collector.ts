/**
 * MetricsCollector — lightweight in-process per-module health metrics.
 *
 * The collector exposes a record-* API (success/failure, 429 retries, LQA
 * retries, mask mismatches, module-call latency) intended to be called from the
 * translation hot path right next to its structured log events. Metrics are
 * keyed by an opaque `(moduleId, model)` pair, kept in bounded ring buffers,
 * held in memory only, and reset on server restart (v1 — no persistence by
 * design).
 *
 * Wiring status: today only `snapshot()` is consumed, via
 * `GET /api/modules/health`. The translation engine (M9) does NOT yet call the
 * recorders, so the health endpoint's success/latency/retry fields read 0/null
 * until that wiring lands — only the shape contract is live. The recorders are
 * kept rather than trimmed because they are the documented, tested public API
 * the typed health snapshot is built around; wiring them up lives in M9, which
 * is outside this module.
 *
 * Tenancy: a key's `moduleId` is a named instance id (`<base>:<slug>`, the slug
 * user-chosen) and its `model` comes straight from that tenant's module config,
 * so both halves are tenant-private strings, and the counters beside them are
 * that tenant's activity volume. Buckets are therefore partitioned by the
 * ambient tenant at record time, and there are two deliberately distinct reads:
 * {@link MetricsCollector.snapshot} is process-wide (the operator/Prometheus
 * view) and {@link MetricsCollector.snapshotForTenant} is what a cloud tenant
 * may see.
 *
 * Exposed via `GET /api/modules/health`.
 */
import { getCurrentTenant } from '../storage/pg/tenant-context.js';

/** Max latency samples retained per (tenant, moduleId, model) key. */
const LATENCY_BUFFER_SIZE = 256;
/** Max recent-429 timestamps retained per (tenant, moduleId, model) key. */
const RATE_LIMIT_BUFFER_SIZE = 100;

/**
 * Fixed-capacity ring buffer of numbers. Once full, the oldest sample is
 * overwritten, so memory stays bounded regardless of run volume.
 */
export class RingBuffer {
  private readonly buffer: number[] = [];
  private writeIndex = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error(`RingBuffer capacity must be a positive integer, got ${capacity}`);
    }
  }

  push(value: number): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(value);
    } else {
      this.buffer[this.writeIndex] = value;
      this.writeIndex = (this.writeIndex + 1) % this.capacity;
    }
  }

  get size(): number {
    return this.buffer.length;
  }

  /** Returns a copy of the retained samples (unordered). */
  values(): number[] {
    return [...this.buffer];
  }
}

/**
 * Nearest-rank percentile over an unsorted sample array.
 * Returns null when there are no samples.
 */
export function percentile(samples: number[], q: number): number | null {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[rank];
}

export interface LatencyStats {
  count: number;
  p50: number | null;
  p95: number | null;
}

export interface ModuleHealthKeyStats {
  moduleId: string;
  model: string | null;
  success: number;
  failure: number;
  total: number;
  /** success / (success + failure), or null when no outcomes recorded yet. */
  successRate: number | null;
  rateLimit429Retries: number;
  lqaRetries: number;
  maskMismatches: number;
  latency: LatencyStats;
  /** Retained 429 timestamps (epoch ms, ascending). */
  recent429s: number[];
}

/** Per-moduleId aggregate across all models (used by the UI health strip). */
export type ModuleHealthAggregate = Omit<ModuleHealthKeyStats, 'model'>;

export interface ModuleHealthSnapshot {
  generatedAt: number;
  /** One row per opaque (moduleId, model) key. */
  stats: ModuleHealthKeyStats[];
  /** One row per moduleId, aggregated across models. */
  modules: ModuleHealthAggregate[];
}

interface MetricEntry {
  /**
   * The tenant whose activity this bucket counts — the ambient tenant at record
   * time — or undefined for activity recorded outside any tenant context
   * (open-core boot, background sweeps). It selects which rows a tenant may
   * read and is never a reported field, so the payload shape is unchanged.
   */
  tenantId: string | undefined;
  moduleId: string;
  model: string | null;
  success: number;
  failure: number;
  rateLimit429Retries: number;
  lqaRetries: number;
  maskMismatches: number;
  latencies: RingBuffer;
  recent429s: RingBuffer;
}

const KEY_SEPARATOR = '\u0000';

export class MetricsCollector {
  private readonly entries = new Map<string, MetricEntry>();

  private entry(moduleId: string, model: string | null): MetricEntry {
    // Partitioned by the ambient tenant. Both halves of the old key are
    // tenant-private strings — moduleId is a named instance id (<base>:<slug>,
    // the slug user-chosen) and model comes from that tenant's own module
    // config — and the counters beside them are that tenant's activity volume.
    const tenantId = getCurrentTenant()?.userId;
    const key = `${tenantId ?? ''}${KEY_SEPARATOR}${moduleId}${KEY_SEPARATOR}${model ?? ''}`;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        tenantId,
        moduleId,
        model,
        success: 0,
        failure: 0,
        rateLimit429Retries: 0,
        lqaRetries: 0,
        maskMismatches: 0,
        latencies: new RingBuffer(LATENCY_BUFFER_SIZE),
        recent429s: new RingBuffer(RATE_LIMIT_BUFFER_SIZE),
      };
      this.entries.set(key, entry);
    }
    return entry;
  }

  /**
   * Records a successful module.translate() outcome, optionally with its
   * latency. Latency contract: pass `latencyMs` here OR call {@link recordLatency}
   * for the same call, never both — each pushes one latency sample, so doing both
   * double-counts that call in the percentile buffer.
   */
  recordSuccess(moduleId: string, model: string | null, latencyMs?: number): void {
    const entry = this.entry(moduleId, model);
    entry.success++;
    if (latencyMs !== undefined && Number.isFinite(latencyMs) && latencyMs >= 0) {
      entry.latencies.push(latencyMs);
    }
  }

  recordFailure(moduleId: string, model: string | null): void {
    this.entry(moduleId, model).failure++;
  }

  /**
   * Records the duration of a successful module.translate() call. See the
   * latency contract on {@link recordSuccess}: do not also pass `latencyMs` to
   * `recordSuccess` for the same call, or the sample is counted twice.
   */
  recordLatency(moduleId: string, model: string | null, latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;
    this.entry(moduleId, model).latencies.push(latencyMs);
  }

  record429Retry(moduleId: string, model: string | null, timestamp = Date.now()): void {
    const entry = this.entry(moduleId, model);
    entry.rateLimit429Retries++;
    entry.recent429s.push(timestamp);
  }

  recordLqaRetry(moduleId: string, model: string | null): void {
    this.entry(moduleId, model).lqaRetries++;
  }

  recordMaskMismatch(moduleId: string, model: string | null): void {
    this.entry(moduleId, model).maskMismatches++;
  }

  /**
   * Every partition, unfiltered — the OPERATOR view. `ops-metrics.ts` feeds
   * this to the cloud Prometheus exporter, whose success/failure series are
   * the live error-rate alert signal, so it must stay process-wide: scoping it
   * would silently blind that alerting. In a multi-tenant process it must
   * never be served to a tenant — see {@link snapshotForTenant}.
   */
  snapshot(): ModuleHealthSnapshot {
    return this.build(() => true);
  }

  /**
   * Only the buckets recorded under `tenantId` — the view a cloud tenant may
   * read. Fail-closed: an undefined tenantId matches nothing, so a caller with
   * no tenant context sees an empty snapshot rather than everything.
   */
  snapshotForTenant(tenantId: string | undefined): ModuleHealthSnapshot {
    if (tenantId === undefined) return this.build(() => false);
    return this.build((e) => e.tenantId === tenantId);
  }

  private build(include: (entry: MetricEntry) => boolean): ModuleHealthSnapshot {
    const stats: ModuleHealthKeyStats[] = [];
    const byModule = new Map<string, MetricEntry[]>();

    for (const entry of this.entries.values()) {
      if (!include(entry)) continue;
      stats.push(this.toStats(entry));
      const group = byModule.get(entry.moduleId);
      if (group) group.push(entry);
      else byModule.set(entry.moduleId, [entry]);
    }

    const modules: ModuleHealthAggregate[] = [];
    for (const [moduleId, group] of byModule) {
      const latencySamples = group.flatMap((e) => e.latencies.values());
      const success = group.reduce((sum, e) => sum + e.success, 0);
      const failure = group.reduce((sum, e) => sum + e.failure, 0);
      const total = success + failure;
      modules.push({
        moduleId,
        success,
        failure,
        total,
        successRate: total > 0 ? success / total : null,
        rateLimit429Retries: group.reduce((sum, e) => sum + e.rateLimit429Retries, 0),
        lqaRetries: group.reduce((sum, e) => sum + e.lqaRetries, 0),
        maskMismatches: group.reduce((sum, e) => sum + e.maskMismatches, 0),
        latency: {
          count: latencySamples.length,
          p50: percentile(latencySamples, 0.5),
          p95: percentile(latencySamples, 0.95),
        },
        recent429s: group.flatMap((e) => e.recent429s.values()).sort((a, b) => a - b),
      });
    }

    return { generatedAt: Date.now(), stats, modules };
  }

  /** Clears all recorded metrics (used by tests). */
  reset(): void {
    this.entries.clear();
  }

  private toStats(entry: MetricEntry): ModuleHealthKeyStats {
    const samples = entry.latencies.values();
    const total = entry.success + entry.failure;
    return {
      moduleId: entry.moduleId,
      model: entry.model,
      success: entry.success,
      failure: entry.failure,
      total,
      successRate: total > 0 ? entry.success / total : null,
      rateLimit429Retries: entry.rateLimit429Retries,
      lqaRetries: entry.lqaRetries,
      maskMismatches: entry.maskMismatches,
      latency: {
        count: samples.length,
        p50: percentile(samples, 0.5),
        p95: percentile(samples, 0.95),
      },
      recent429s: entry.recent429s.values().sort((a, b) => a - b),
    };
  }
}

/** Process-wide singleton used by M9 and the /api/modules/health route. */
export const metricsCollector = new MetricsCollector();
