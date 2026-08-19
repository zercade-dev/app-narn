/**
 * PgFreewayLedgerStore — Postgres adapter for the NARN Freeway quota ledger
 * (tables from migration 0027_freeway): `freeway_usage` holds additive
 * counters per (bucket, window) cell; `freeway_buckets` holds one
 * slow-moving state row per bucket (cooldowns, disable reason, quality
 * EMAs). Both tables are tenant-global (no `project_id`), RLS-scoped by the
 * `app.user_id` GUC exactly like `collab_routing`/`workspace_settings` — every
 * statement below relies on RLS rather than an explicit `tenant_id = …`
 * filter, mirroring `PgCollabRoutingStore`.
 */
import { withTransaction, type Queryable } from './pg/pool.js';
import type {
  FreewayBucketState,
  FreewayBucketStats,
  FreewayLedgerStore,
  FreewayUsageDelta,
  FreewayWindowRef,
  FreewayWindowUsage,
} from './types.js';

const ZERO: Required<FreewayUsageDelta> = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  chars: 0,
};

interface FreewayUsageRow {
  requests: number | string;
  input_tokens: number | string;
  output_tokens: number | string;
  chars: number | string;
}

interface FreewayBucketRow {
  bucket_key: string;
  cooldown_until: number | string | null;
  disabled_reason: string | null;
  flap_count: number | string;
  stats: FreewayBucketStats | null;
  updated_at: number | string;
}

export class PgFreewayLedgerStore implements FreewayLedgerStore {
  private readonly db: Queryable;

  constructor(db: Queryable) {
    this.db = db;
  }

  /**
   * Additive upsert of one window cell per listed window, ALL in one
   * transaction (via `withTransaction` — see `pg/pool.ts`) so a multi-window
   * write is atomic: either every cell is bumped or none is. `tenant_id` is
   * stamped from the GUC (never a bound param — mirrors
   * `PgCollabRoutingStore.save` / `PgRunStore.upsert`), and the four counters
   * are summed against the existing row via `excluded.*` on conflict.
   */
  async recordAttempt(
    bucketKey: string,
    windows: FreewayWindowRef[],
    delta: FreewayUsageDelta,
  ): Promise<void> {
    const d = { ...ZERO, ...delta };
    await withTransaction(this.db, async (tx) => {
      for (const w of windows) {
        await tx.query(
          `insert into freeway_usage
             (tenant_id, bucket_key, window_kind, window_start, requests, input_tokens, output_tokens, chars)
           values (current_setting('app.user_id'), $1, $2, $3, $4, $5, $6, $7)
           on conflict (tenant_id, bucket_key, window_kind, window_start) do update set
             requests = freeway_usage.requests + excluded.requests,
             input_tokens = freeway_usage.input_tokens + excluded.input_tokens,
             output_tokens = freeway_usage.output_tokens + excluded.output_tokens,
             chars = freeway_usage.chars + excluded.chars`,
          [bucketKey, w.kind, w.start, d.requests, d.inputTokens, d.outputTokens, d.chars],
        );
      }
    });
  }

  async usage(bucketKey: string, windows: FreewayWindowRef[]): Promise<FreewayWindowUsage[]> {
    const out: FreewayWindowUsage[] = [];
    for (const w of windows) {
      const { rows } = await this.db.query<FreewayUsageRow>(
        `select requests, input_tokens, output_tokens, chars
           from freeway_usage
          where bucket_key = $1 and window_kind = $2 and window_start = $3`,
        [bucketKey, w.kind, w.start],
      );
      const row = rows[0];
      out.push({
        ...w,
        requests: Number(row?.requests ?? 0),
        inputTokens: Number(row?.input_tokens ?? 0),
        outputTokens: Number(row?.output_tokens ?? 0),
        chars: Number(row?.chars ?? 0),
      });
    }
    return out;
  }

  async listBuckets(): Promise<FreewayBucketState[]> {
    // No explicit WHERE — RLS confines this to the ambient tenant's own rows,
    // exactly like PgCollabRoutingStore.get().
    const { rows } = await this.db.query<FreewayBucketRow>(
      `select bucket_key, cooldown_until, disabled_reason, flap_count, stats, updated_at
         from freeway_buckets order by bucket_key`,
    );
    return rows.map((row) => ({
      bucketKey: row.bucket_key,
      cooldownUntil: row.cooldown_until == null ? undefined : Number(row.cooldown_until),
      disabledReason: row.disabled_reason ?? undefined,
      flapCount: Number(row.flap_count ?? 0),
      stats: row.stats ?? {},
      updatedAt: Number(row.updated_at ?? 0),
    }));
  }

  /** Single-row read of one bucket's state, or undefined when the row is absent. */
  async getBucket(bucketKey: string): Promise<FreewayBucketState | undefined> {
    const { rows } = await this.db.query<FreewayBucketRow>(
      `select bucket_key, cooldown_until, disabled_reason, flap_count, stats, updated_at
         from freeway_buckets where bucket_key = $1`,
      [bucketKey],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      bucketKey: row.bucket_key,
      cooldownUntil: row.cooldown_until == null ? undefined : Number(row.cooldown_until),
      disabledReason: row.disabled_reason ?? undefined,
      flapCount: Number(row.flap_count ?? 0),
      stats: row.stats ?? {},
      updatedAt: Number(row.updated_at ?? 0),
    };
  }

  async setCooldown(bucketKey: string, until: number, opts?: { flap?: boolean }): Promise<void> {
    const flapDelta = opts?.flap ? 1 : 0;
    const now = Date.now();
    await this.db.query(
      `insert into freeway_buckets (tenant_id, bucket_key, cooldown_until, flap_count, updated_at)
       values (current_setting('app.user_id'), $1, $2, $3, $4)
       on conflict (tenant_id, bucket_key) do update set
         cooldown_until = excluded.cooldown_until,
         flap_count = freeway_buckets.flap_count + $3,
         updated_at = excluded.updated_at`,
      [bucketKey, until, flapDelta, now],
    );
  }

  /** No-op when the row is absent (plain UPDATE, not an upsert). */
  async clearCooldown(bucketKey: string): Promise<void> {
    await this.db.query(
      `update freeway_buckets set cooldown_until = null, flap_count = 0, updated_at = $2
        where bucket_key = $1`,
      [bucketKey, Date.now()],
    );
  }

  /** No-op when the row is absent or already at 0 (plain UPDATE, not an upsert). */
  async resetFlap(bucketKey: string): Promise<void> {
    await this.db.query(
      `update freeway_buckets set flap_count = 0, updated_at = $2
        where bucket_key = $1 and flap_count > 0`,
      [bucketKey, Date.now()],
    );
  }

  async setDisabled(bucketKey: string, reason: string | null): Promise<void> {
    await this.db.query(
      `insert into freeway_buckets (tenant_id, bucket_key, disabled_reason, updated_at)
       values (current_setting('app.user_id'), $1, $2, $3)
       on conflict (tenant_id, bucket_key) do update set
         disabled_reason = excluded.disabled_reason,
         updated_at = excluded.updated_at`,
      [bucketKey, reason, Date.now()],
    );
  }

  /**
   * Top-level shallow merge: `stats || $2::jsonb` replaces each incoming
   * top-level key wholesale (e.g. a new `gatePassByLanguage` map replaces the
   * stored map, it does not merge per-language) — callers always send the
   * full map they hold. On first insert there is nothing to merge with, so
   * the row's `stats` is simply the incoming value.
   */
  async mergeStats(bucketKey: string, stats: FreewayBucketStats): Promise<void> {
    await this.db.query(
      `insert into freeway_buckets (tenant_id, bucket_key, stats, updated_at)
       values (current_setting('app.user_id'), $1, $2::jsonb, $3)
       on conflict (tenant_id, bucket_key) do update set
         stats = freeway_buckets.stats || excluded.stats,
         updated_at = excluded.updated_at`,
      [bucketKey, JSON.stringify(stats), Date.now()],
    );
  }

  /**
   * Overwrite a window cell with authoritative usage from a provider probe
   * (DeepL /v2/usage, OpenRouter /api/v1/key) — sets, does not add.
   */
  async syncAuthoritativeUsage(
    bucketKey: string,
    window: FreewayWindowRef,
    usage: FreewayUsageDelta,
  ): Promise<void> {
    const d = { ...ZERO, ...usage };
    await this.db.query(
      `insert into freeway_usage
         (tenant_id, bucket_key, window_kind, window_start, requests, input_tokens, output_tokens, chars)
       values (current_setting('app.user_id'), $1, $2, $3, $4, $5, $6, $7)
       on conflict (tenant_id, bucket_key, window_kind, window_start) do update set
         requests = excluded.requests,
         input_tokens = excluded.input_tokens,
         output_tokens = excluded.output_tokens,
         chars = excluded.chars`,
      [bucketKey, window.kind, window.start, d.requests, d.inputTokens, d.outputTokens, d.chars],
    );
  }
}
