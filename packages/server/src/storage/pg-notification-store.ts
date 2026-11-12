import { randomUUID } from 'node:crypto';

import { PROBLEM_NOTIFICATION_KINDS } from '@zercade-dev/narn-shared';
import type {
  CollabDigestData,
  NotificationKind,
  NotificationRecord,
  NotificationSeverity,
  RunNotificationData,
} from '@zercade-dev/narn-shared';
import { withTenantTransaction } from './pg/pool.js';
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
  kind: NotificationKind | null;
  data: RunNotificationData | CollabDigestData | null;
  created_at: Date;
  read_at: Date | null;
}

/** The full column list, selected by {@link PgNotificationStore.listForCurrentUser}. */
const COLUMNS = `id, user_id, title, body, severity, broadcast_id, kind, data, created_at, read_at`;

/** Per-user cap on typed (kind) rows; older ones are pruned on each typed insert. */
export const NOTIFICATION_KEEP_NEWEST = 200;
/** Typed (kind) rows older than this are pruned on each typed insert. */
export const NOTIFICATION_MAX_AGE_DAYS = 30;

/**
 * SQL list literal of the problem kinds, for `not in (...)`. Built from a fixed
 * shared constant (never user input), so inlining it is safe.
 */
const PROBLEM_KINDS_SQL = PROBLEM_NOTIFICATION_KINDS.map((k) => `'${k}'`).join(', ');

function rowToRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    broadcastId: row.broadcast_id,
    kind: row.kind,
    data: row.data,
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

  /**
   * The newest {@link NOTIFICATION_KEEP_NEWEST} notifications for the current
   * tenant, plus every unread one older than that, newest first. The unread
   * rows are always included so the unread count never names a row the list
   * leaves out. No pagination.
   */
  async listForCurrentUser(): Promise<NotificationRecord[]> {
    const { rows } = await this.db.query<NotificationRow>(
      `select ${COLUMNS}
       from notifications
       where read_at is null
          or id in (
            select id from notifications
            order by created_at desc, id desc
            limit ${NOTIFICATION_KEEP_NEWEST}
          )
       order by created_at desc, id desc`,
    );
    return rows.map(rowToRecord);
  }

  /** Count of unread notifications for the current tenant; the listing always includes all of them. */
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

  /**
   * Marks every unread notification read except the problem kinds
   * (PROBLEM_NOTIFICATION_KINDS), which stay unread until the user deals with
   * them. Free-text broadcasts (`kind is null`) count as informational.
   */
  async markInformationalRead(): Promise<{ count: number }> {
    const { rows } = await this.db.query<{ id: string }>(
      `update notifications set read_at = now()
       where read_at is null and (kind is null or kind not in (${PROBLEM_KINDS_SQL}))
       returning id`,
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
 *
 * Two shapes: a free-text broadcast passes `title`/`body`; a typed row passes
 * `kind` + `data` instead (the stored title is the kind and body is empty —
 * the UI renders from kind + data). `bornRead` inserts the row already read
 * (e.g. a run-started note that should not raise the unread badge).
 */
export type NewNotificationInput =
  | {
      title: string;
      body: string;
      severity?: NotificationSeverity;
      broadcastId?: string | null;
      kind?: undefined;
      data?: undefined;
      bornRead?: boolean;
    }
  | {
      kind: NotificationKind;
      data?: object;
      severity?: NotificationSeverity;
      broadcastId?: string | null;
      bornRead?: boolean;
      title?: undefined;
      body?: undefined;
    };

/**
 * Explicit-tenant insert of ONE notification for ONE addressee, used by the
 * admin/ops broadcast path and by server code writing typed (kind) rows for a
 * specific user — never by user-facing routes, which go through
 * {@link PgNotificationStore} under the ambient request tenant instead.
 * Mirrors `recordPolicyAcceptanceToDb`'s idiom, except `pool` is passed
 * explicitly (not resolved via `getPool()`) because the caller may have no
 * ambient request context (or one for a different user) and may own its own
 * pool/connection.
 *
 * Typed rows are pruned in the same transaction: this user's kind rows older
 * than {@link NOTIFICATION_MAX_AGE_DAYS} days, then all but the newest
 * {@link NOTIFICATION_KEEP_NEWEST}. Broadcast rows are never pruned.
 *
 * Broadcast fan-out is the CALLER's loop: call this once per addressee,
 * SEQUENTIALLY (`for`/`await`, not `Promise.all`), with the SAME `broadcastId`
 * (generated once by the caller up front) and a different `userId` each time —
 * this helper generates each row's own `id` internally, so every addressee
 * gets a distinct, individually markRead/delete-able row even though they
 * share one `broadcastId`. Sequential is a real requirement, not just a style
 * choice: each call's `runWithTenant`+`withTenantTransaction` opens its own
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
  const kind = input.kind ?? null;
  await runWithTenant({ userId }, () =>
    // ONE tenant transaction for the insert and the pruning deletes, so they
    // share the role + `app.user_id` GUC and commit (or roll back) together.
    withTenantTransaction(pool, async (tx) => {
      await tx.query(
        `insert into notifications (id, user_id, title, body, severity, broadcast_id, kind, data, read_at)
         values ($1, current_setting('app.user_id'), $2, $3, $4, $5, $6, $7::jsonb,
                 case when $8::boolean then now() end)
         on conflict (user_id, broadcast_id) do nothing`,
        [
          randomUUID(),
          kind ?? input.title,
          kind ? '' : input.body,
          input.severity ?? 'info',
          input.broadcastId ?? null,
          kind,
          input.data === undefined ? null : JSON.stringify(input.data),
          input.bornRead === true,
        ],
      );
      if (!kind) return;
      // Prune this user's typed rows only. RLS already scopes every statement
      // to the GUC user; the explicit `user_id` filter is belt-and-braces on a
      // destructive statement. Broadcasts (`kind is null`) are never pruned.
      await tx.query(
        `delete from notifications
         where user_id = current_setting('app.user_id') and kind is not null
           and created_at < now() - make_interval(days => $1::int)`,
        [NOTIFICATION_MAX_AGE_DAYS],
      );
      await tx.query(
        `delete from notifications
         where id in (
           select id from notifications
           where user_id = current_setting('app.user_id') and kind is not null
           order by created_at desc, id desc
           offset $1::int
         )`,
        [NOTIFICATION_KEEP_NEWEST],
      );
    }),
  );
}
