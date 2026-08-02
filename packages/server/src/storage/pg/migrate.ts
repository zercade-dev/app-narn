import type { Queryable } from './pool.js';
import { withTransaction } from './pool.js';
import { MIGRATIONS } from './migrations.js';

type Migration = { name: string; statements: readonly string[] };

/** Apply a specific ordered list (idempotent, transactional per migration). */
export async function runMigrationList(
  db: Queryable,
  migrations: ReadonlyArray<Migration>,
): Promise<void> {
  await db.query(
    `create table if not exists schema_migrations (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
  const { rows } = await db.query<{ name: string }>('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    // Atomic: a failure mid-migration rolls back its statements AND its
    // schema_migrations row, so the next boot retries it cleanly.
    await withTransaction(db, async (tx) => {
      for (const statement of migration.statements) {
        await tx.query(statement);
      }
      await tx.query('insert into schema_migrations (name) values ($1)', [migration.name]);
    });
  }
}

/** Apply all not-yet-applied migrations in order. */
export async function runMigrations(db: Queryable): Promise<void> {
  await runMigrationList(db, MIGRATIONS);
}
