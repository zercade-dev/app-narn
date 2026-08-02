import { randomUUID } from 'node:crypto';

import type { NotificationRecord, NotificationSeverity } from '@zercade-dev/narn-shared';
import { TenantDb } from './pg/pool.js';
import type { Queryable } from './pg/pool.js';
import { runWithTenant } from './pg/tenant-context.js';
import type { NotificationStore } from './types.js';

/**
 * Shape of one `notifications` row as returned by `pg`/pglite. `timestamptz`
 * columns come back as a JS `Date` (coerced to ISO strings in
 * {@link rowToRecord}, mirroring PgBackupStore); every other column is a plain
 * string (`broadcast_id` nullable).
 */
interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  broadcast_id: string | null;
  created_at: Date;
  read_at: Date | null;
}

/** The full column list, selected by {@link PgNotificationStore.listForCurrentUser}. */
const COLUMNS = `id, user_id, title, body, severity, broadcast_id, created_at, read_at`;

function rowToRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    broadcastId: row.broadcast_id,
    createdAt: row.created_at.toISOString(),
    readAt: row.read_at ? row.read_at.toISOString() : null,
  };
}

/**
 * PG-backed in-app notification store. Constructed exactly like every other
 * PG store — `new PgNotificationStore(new TenantDb(getPool()))`
 * — so each statement runs inside a `withTenantTransaction` (role `app_user` +
 * the `app.user_id` GUC) and RLS applies; every method below is scoped to the
 * AMBIENT tenant only (no explicit `user_id` filter anywhere — mirrors
 * PgTranslationMemory.list()), so there is no WHERE clause to get wrong and no
 * way to widen the blast radius from the app layer.
 *
 * v1 is the user-facing read/ack/dismiss surface only: broadcast fan-out
 * writes go through the separate module-level {@link insertNotificationForUser}
 * helper (the future admin/ops path), never through this class.
 */
export class PgNotificationStore implements NotificationStore {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  /** Newest 50 notifications for the current tenant. No pagination in v1. */
  async listForCurrentUser(): Promise<NotificationRecord[]> {
    const { rows } = await this.db.query<NotificationRow>(
      `select ${COLUMNS}
       from notifications
       order by created_at desc, id desc
       limit 50`,
    );
    return rows.map(rowToRecord);
  }

  /** Count of unread notifications for the current tenant (not windowed to the 50-row listing cap). */
  async countUnread(): Promise<number> {
    const { rows } = await this.db.query<{ n: number }>(
      `select count(*)::int as n from notifications where read_at is null`,
    );
    // `count(*)` with no GROUP BY always returns exactly one row (0 on an empty
    // set), so `rows[0]` is never actually missing — `?? 0` mirrors the
    // defensive style PgTranslationMemory.clearAll/PgRunStore.countActiveRuns
    // use for the identical `count(*)::int as n` idiom.
    return rows[0]?.n ?? 0;
  }

  /** Idempotent: a re-call on an already-read (or foreign/missing) id leaves `readAt` untouched. */
  async markRead(id: string): Promise<void> {
    await this.db.query(
      `update notifications set read_at = now() where id = $1 and read_at is null`,
      [id],
    );
  }

  /** Marks every currently-unread notification for the current tenant read. */
  async markAllRead(): Promise<{ count: number }> {
    // `returning id` + `rows.length` is portable across pg + pglite (mirrors
    // PgBackupStore.delete) — the `Queryable` surface only types `{ rows }`, so
    // we never rely on `rowCount`.
    const { rows } = await this.db.query<{ id: string }>(
      `update notifications set read_at = now() where read_at is null returning id`,
    );
    return { count: rows.length };
  }

  /** Dismiss one notification. A foreign/missing id is a silent no-op (RLS-scoped). */
  async delete(id: string): Promise<void> {
    await this.db.query(`delete from notifications where id = $1`, [id]);
  }
}

/**
 * Input for {@link insertNotificationForUser} — everything but `id` (generated
 * internally) and `userId` (the explicit tenant arg). `severity` defaults to
 * `'info'` and `broadcastId` to `null` when omitted, mirroring the column
 * defaults.
 */
export interface NewNotificationInput {
  title: string;
  body: string;
  severity?: NotificationSeverity;
  broadcastId?: string | null;
}

/**
 * Explicit-tenant insert of ONE notification for ONE addressee, used ONLY by
 * the future admin/ops broadcast path (a sibling unit) — never by user-facing
 * routes, which go through {@link PgNotificationStore} under the ambient
 * request tenant instead. Mirrors `recordPolicyAcceptanceToDb`'s idiom, except
 * `pool` is passed explicitly (not resolved via `getPool()`) because the
 * caller is a detached ops script with no ambient request context and may own
 * its own pool/connection.
 *
 * Broadcast fan-out is the CALLER's loop: call this once per addressee,
 * SEQUENTIALLY (`for`/`await`, not `Promise.all`), with the SAME `broadcastId`
 * (generated once by the caller up front) and a different `userId` each time —
 * this helper generates each row's own `id` internally, so every addressee
 * gets a distinct, individually markRead/delete-able row even though they
 * share one `broadcastId`. Sequential is a real requirement, not just a style
 * choice: each call's `runWithTenant`+`TenantDb` opens its own
 * `withTenantTransaction` (`SET LOCAL ROLE` + a transaction-scoped
 * `app.user_id` GUC), which is connection/session-scoped — safe to call
 * concurrently ONLY when `pool` is a real `pg.Pool` (each call then checks out
 * its own client); a single shared non-Pool connection (e.g. a raw client)
 * would let concurrent calls' role/GUC settings race and misattribute rows to
 * the wrong tenant. RLS's own per-row `user_id = current_setting(...)`
 * cross-tenant check also structurally rules out a single bulk multi-row
 * INSERT here: one transaction carries exactly one `app.user_id` GUC value, so
 * a multi-row VALUES list spanning several addressees could never satisfy
 * every row's WITH CHECK at once — the per-addressee loop isn't just simpler,
 * it's what the RLS design requires.
 *
 * Retry-safe: `(user_id, broadcast_id)` is unique (see migration
 * `0017_notifications`), so re-calling this for the same addressee of the
 * same broadcast — e.g. an ops-script retry after a timeout — silently
 * no-ops instead of creating a duplicate row. Only applies when `broadcastId`
 * is set; Postgres treats each NULL as distinct, so non-broadcast callers
 * (broadcastId omitted) are never deduplicated against each other.
 */
export async function insertNotificationForUser(
  pool: Queryable,
  userId: string,
  input: NewNotificationInput,
): Promise<void> {
  // Fail closed on a blank tenant id up front, mirroring teardownTenant /
  // collectTenantExport: a blank `app.user_id` GUC is the one value the RLS
  // policies treat as "match nothing" (see the `<> ''` guard in migration
  // 0017), so without this guard a bad caller-resolved userId would surface
  // only as an opaque row-level-security-violation deep inside Postgres.
  if (!userId || !userId.trim()) throw new Error('insertNotificationForUser: empty userId');
  await runWithTenant({ userId }, () =>
    new TenantDb(pool).query(
      `insert into notifications (id, user_id, title, body, severity, broadcast_id)
       values ($1, current_setting('app.user_id'), $2, $3, $4, $5)
       on conflict (user_id, broadcast_id) do nothing`,
      [randomUUID(), input.title, input.body, input.severity ?? 'info', input.broadcastId ?? null],
    ),
  );
}
