import { Pool } from 'pg';

import { requireTenant } from './tenant-context.js';
import { getDatabaseUrl, getMigrationDatabaseUrl } from '../../config/env.js';

/**
 * Minimal query surface shared by the prod `pg.Pool` and the in-process
 * `@electric-sql/pglite` instance used in tests. Adapters depend on this, not
 * on `pg.Pool` directly, so a test can inject pglite via `setPoolForTests`.
 */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

/** The non-owner role every tenant-scoped statement runs as, so RLS applies. */
export const APP_ROLE = 'app_user';

let pool: Queryable | undefined; // runtime connection (DATABASE_URL → narn_app in cloud)
let migrationPool: Queryable | undefined; // schema-migration runner (MIGRATION_DATABASE_URL → superuser)

/** Lazily construct the pool from DATABASE_URL. Throws if it is unset. */
export function getPool(): Queryable {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set — the Postgres storage backend requires it.');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

/**
 * The pool the SCHEMA-migration runner uses. Schema DDL (CREATE ROLE, ALTER TABLE …
 * FORCE ROW LEVEL SECURITY, CREATE POLICY, GRANT) must run as the table owner /
 * a role that can create roles — i.e. the Postgres superuser — whereas the runtime
 * app connects as the unprivileged `narn_app` (subject to RLS). MIGRATION_DATABASE_URL
 * carries the superuser DSN. When it is UNSET (local `pnpm dev`, pglite tests, any
 * single-URL deploy) we fall back to the runtime pool, so those paths keep running
 * migrations on their only connection exactly as before.
 */
export function getMigrationPool(): Queryable {
  const migrationUrl = getMigrationDatabaseUrl();
  if (!migrationUrl) return getPool(); // single-URL fallback (unchanged behavior)
  if (!migrationPool) migrationPool = new Pool({ connectionString: migrationUrl });
  return migrationPool;
}

/**
 * Connection-pool saturation stats for the ops-metrics snapshot. Returns null
 * when the pool is unset or a non-pg double (pglite in tests), since those
 * have no connection accounting.
 */
export function getPoolStats(): { total: number; idle: number; waiting: number } | null {
  if (pool instanceof Pool) {
    return { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
  }
  return null;
}

/** Swap in a test double (pglite). */
export function setPoolForTests(db: Queryable): void {
  pool = db;
}

/** Close both real pools on shutdown; no-op for non-pg doubles. */
export async function closePool(): Promise<void> {
  if (pool instanceof Pool) await pool.end();
  if (migrationPool instanceof Pool) await migrationPool.end();
  pool = undefined;
  migrationPool = undefined;
}

/**
 * Run `fn` inside one transaction. On `pg.Pool` a dedicated client is checked
 * out (so BEGIN/COMMIT bind to the same connection); on a single-connection
 * Queryable (pglite in tests) BEGIN/COMMIT run on the instance itself. Restores
 * the crash-atomicity that on-disk atomicWrite gave file stores. ROLLBACK is
 * best-effort on failure; the original error is always rethrown.
 */
export async function withTransaction<T>(
  db: Queryable,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  // A TenantDb means "one tenant tx for this whole block" — unwrap to the real
  // pool and route through withTenantTransaction (sets role + GUC once), so the
  // stores' existing `withTransaction(this.db, …)` calls become tenant-scoped
  // with no change. (Defined below; hoisted function declarations are fine.)
  if (db instanceof TenantDb) return withTenantTransaction(db.pool, fn);
  if (db instanceof Pool) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
  await db.query('BEGIN');
  try {
    const result = await fn(db);
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/**
 * Run `fn` in one transaction scoped to the current tenant: switch to the
 * non-owner role (so RLS is enforced — the owner/superuser would bypass it),
 * set the `app.user_id` GUC, then run `fn`. Both `SET LOCAL ROLE` and the
 * transaction-local `set_config(..., true)` auto-clear on COMMIT/ROLLBACK.
 * Fail-closed: requireTenant() throws before any SQL when no context is set.
 */
export async function withTenantTransaction<T>(
  db: Queryable,
  fn: (tx: Queryable) => Promise<T>,
): Promise<T> {
  const { userId } = requireTenant();
  return withTransaction(db, async (tx) => {
    // APP_ROLE is a fixed identifier (not user input) → safe to inline.
    await tx.query(`set local role ${APP_ROLE}`);
    await tx.query("select set_config('app.user_id', $1, true)", [userId]);
    return fn(tx);
  });
}

/**
 * Queryable wrapper that makes every store statement tenant-scoped without
 * changing store code: a single `query()` runs inside its own
 * withTenantTransaction; a `withTransaction(tenantDb, fn)` (above) unwraps to
 * one tenant tx so a multi-statement store op shares ONE role/GUC setup.
 */
export class TenantDb implements Queryable {
  constructor(public readonly pool: Queryable) {}
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }> {
    return withTenantTransaction(this.pool, (tx) => tx.query<R>(text, params));
  }
}
