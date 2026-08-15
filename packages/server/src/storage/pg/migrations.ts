/**
 * Ordered schema migrations as inline SQL statement lists. Inline (not .sql
 * files) so `tsc` ships them in dist without a copy step, and so a single
 * statement per array element runs portably on both pg.Pool and pglite
 * (pglite's query() runs one statement at a time).
 *
 * Early migrations give tables a `tenant_id` column defaulted to 'local' for
 * forward compatibility, before RLS / project_members exist; later
 * migrations add both.
 */
export const MIGRATIONS: ReadonlyArray<{ name: string; statements: readonly string[] }> = [
  {
    name: '0001_projects',
    statements: [
      `create table if not exists projects (
         id text primary key,
         tenant_id text not null default 'local',
         data jsonb not null
       )`,
      `create table if not exists active_project (
         tenant_id text primary key,
         project_id text not null
       )`,
    ],
  },
  {
    name: '0002_templates',
    statements: [
      `create table if not exists templates (
         id text primary key,
         tenant_id text not null default 'local',
         data jsonb not null
       )`,
    ],
  },
  {
    name: '0003_global_config',
    statements: [
      `create table if not exists module_instances (
         tenant_id text not null default 'local',
         instance_id text not null,
         base_module_id text not null,
         display_name text not null,
         primary key (tenant_id, instance_id)
       )`,
      `create table if not exists module_configs (
         tenant_id text not null default 'local',
         module_id text not null,
         enabled boolean,
         active boolean,
         config jsonb not null default '{}'::jsonb,
         primary key (tenant_id, module_id)
       )`,
      `create table if not exists workspace_settings (
         tenant_id text primary key default 'local',
         data jsonb not null default '{}'::jsonb
       )`,
      `create table if not exists global_config_meta (
         tenant_id text primary key default 'local',
         schema_version integer
       )`,
    ],
  },
  {
    // Translation memory is GLOBAL (cross-project by design): one 'local'
    // tenant, NO project_id. Row-per-variant — a TmSegment is the set of rows
    // sharing (tenant_id, source_hash, target_lang); the segment vanishes when
    // its last variant row is deleted.
    name: '0004_translation_memory',
    statements: [
      `create table if not exists translation_memory (
         id text primary key,
         tenant_id text not null default 'local',
         source_hash text not null,
         source_masked text not null,
         target_lang text not null,
         translated_text text not null,
         module_id text not null,
         lqa_passed boolean not null,
         ts bigint not null,
         fingerprint jsonb not null
       )`,
      `create index if not exists translation_memory_lookup
         on translation_memory (tenant_id, source_hash, target_lang)`,
    ],
  },
  {
    // Glossaries are PER-PROJECT: keyed (project_id, id), tenant_id defaulted to
    // 'local' (no RLS yet). `glossary_overrides` is one row per project holding
    // the enabled/disabled toggles for the static global glossaries.
    name: '0005_glossaries',
    statements: [
      `create table if not exists glossaries (
         project_id text not null,
         id text not null,
         tenant_id text not null default 'local',
         data jsonb not null,
         primary key (project_id, id)
       )`,
      `create table if not exists glossary_overrides (
         project_id text not null,
         tenant_id text not null default 'local',
         overrides jsonb not null default '{}'::jsonb,
         primary key (project_id)
       )`,
    ],
  },
  {
    // Strings are PER-PROJECT, one row per entry: keyed (project_id, id),
    // tenant_id defaulted to 'local' (no RLS yet). The full StringEntry lives in
    // `data jsonb`; `seq bigserial` is the insertion-order surrogate (today's
    // order = JS array order) so `load` can ORDER BY it and bulkUpsert/save
    // keep "existing-first, new appended" stable.
    name: '0006_strings',
    statements: [
      `create table if not exists strings (
         project_id text not null,
         id text not null,
         tenant_id text not null default 'local',
         seq bigserial,
         data jsonb not null,
         primary key (project_id, id)
       )`,
      `create index if not exists strings_project on strings (project_id)`,
    ],
  },
  {
    // Runs are PER-PROJECT, one row per run: keyed (run_id), tenant_id defaulted
    // to 'local' (no RLS yet). The whole RunStatus lives in `data jsonb`; the
    // scalar columns are write-mirrors for ordering/filtering only (reads return
    // `data`, so JS-number timestamps round-trip intact). `run_sidecars` holds
    // the large per-run payloads (details/verdicts/judge-logs/source-review/
    // glossary-suggestions/category-suggestions) one row per (run_id, kind), kept
    // out of `runs` so the hot-path progress upserts stay small — mirroring the
    // file store's `<kind>-<runId>.json` sidecars.
    name: '0007_runs',
    statements: [
      `create table if not exists runs (
         run_id text primary key,
         project_id text not null,
         tenant_id text not null default 'local',
         status text not null,
         kind text,
         total integer not null,
         completed integer not null,
         failed integer not null,
         started_at bigint not null,
         finished_at bigint,
         queue_position integer,
         source_run_id text,
         ai_score double precision,
         estimated_cost_usd double precision,
         data jsonb not null
       )`,
      `create index if not exists runs_project on runs (project_id, started_at)`,
      `create table if not exists run_sidecars (
         run_id text not null,
         kind text not null,
         tenant_id text not null default 'local',
         data jsonb not null,
         primary key (run_id, kind)
       )`,
    ],
  },
  {
    // The review-order pre-sort's "last sorted" META is PER-PROJECT, one row per
    // project: keyed (project_id), tenant_id defaulted to 'local' (no RLS yet).
    // The per-entry `reviewSortIndex` itself persists through `strings.data`
    // (set via StringStore.setReviewSortIndices) — only this tiny sidecar meta
    // (version/computedAt/count, ex `projects/<id>/review-order.json`) lives
    // here. `computed_at` is `bigint` (epoch ms); the adapter coerces it back to
    // a JS number on read (pg returns bigint as a string).
    name: '0008_review_order',
    statements: [
      `create table if not exists review_order (
         project_id text primary key,
         tenant_id text not null default 'local',
         version integer not null,
         computed_at bigint not null,
         count integer not null
       )`,
    ],
  },
  {
    // This migration makes the schema multi-tenant-capable. project_members
    // is the membership anchor (v1 = one owner row per project). app_user is
    // the NOLOGIN non-owner role every tenant-scoped statement runs as (the
    // owner/superuser bypasses RLS, so SET ROLE app_user is what makes RLS
    // bite). DDL here runs as the owner (the migration runner uses
    // withTransaction, NOT withTenantTransaction).
    name: '0009_tenant_rls',
    statements: [
      `create table if not exists project_members (
         project_id text not null,
         user_id text not null,
         role text not null default 'owner',
         primary key (project_id, user_id)
       )`,
      // Idempotent by schema_migrations tracking (runs once per DB), but a deploy
      // whose cluster already has app_user from a prior attempt (or a sibling DB
      // sharing the cluster's role catalog) would still hit `42710 role already
      // exists`. Guard the CREATE ROLE so a re-run is a no-op instead of an error.
      // pglite + real PG both accept this DO block.
      `do $$ begin
         if not exists (select 1 from pg_roles where rolname = 'app_user') then
           create role app_user nologin;
         end if;
       end $$`,
      `grant usage on schema public to app_user`,
      `grant select, insert, update, delete on all tables in schema public to app_user`,
      // The blanket grant above also handed app_user write on `schema_migrations`
      // (the migration bookkeeping table). app_user is the tenant-request role and
      // must never mutate migration history, so revoke write back off it — its
      // read/write on the tenant tables is untouched.
      `revoke insert, update, delete on schema_migrations from app_user`,
      `grant usage, select on all sequences in schema public to app_user`,
      // --- enable + force RLS on every tenant table ---
      `alter table projects enable row level security`,
      `alter table projects force row level security`,
      `alter table active_project enable row level security`,
      `alter table active_project force row level security`,
      `alter table templates enable row level security`,
      `alter table templates force row level security`,
      `alter table module_instances enable row level security`,
      `alter table module_instances force row level security`,
      `alter table module_configs enable row level security`,
      `alter table module_configs force row level security`,
      `alter table workspace_settings enable row level security`,
      `alter table workspace_settings force row level security`,
      `alter table global_config_meta enable row level security`,
      `alter table global_config_meta force row level security`,
      `alter table translation_memory enable row level security`,
      `alter table translation_memory force row level security`,
      `alter table glossaries enable row level security`,
      `alter table glossaries force row level security`,
      `alter table glossary_overrides enable row level security`,
      `alter table glossary_overrides force row level security`,
      `alter table strings enable row level security`,
      `alter table strings force row level security`,
      `alter table runs enable row level security`,
      `alter table runs force row level security`,
      `alter table run_sidecars enable row level security`,
      `alter table run_sidecars force row level security`,
      `alter table review_order enable row level security`,
      `alter table review_order force row level security`,
      `alter table project_members enable row level security`,
      `alter table project_members force row level security`,
      // --- one tenant_isolation policy per table (USING = WITH CHECK) ---
      // projects: membership keyed on the project's own id.
      `create policy tenant_isolation on projects using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = projects.id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = projects.id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      // project-data tables: membership via the row's project_id.
      `create policy tenant_isolation on strings using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = strings.project_id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = strings.project_id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      `create policy tenant_isolation on glossaries using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = glossaries.project_id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = glossaries.project_id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      `create policy tenant_isolation on glossary_overrides using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = glossary_overrides.project_id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = glossary_overrides.project_id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      `create policy tenant_isolation on runs using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = runs.project_id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = runs.project_id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      `create policy tenant_isolation on review_order using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = review_order.project_id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = review_order.project_id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      // run_sidecars has no project_id → follow the parent run's visibility
      // (runs' own RLS scopes the subquery to member-visible runs).
      `create policy tenant_isolation on run_sidecars using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from runs r where r.run_id = run_sidecars.run_id)
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from runs r where r.run_id = run_sidecars.run_id)
       )`,
      // global-per-tenant tables: tenant_id = the current user. The extra
      // `current_setting(...) <> ''` defends in depth against a MISSING GUC: an
      // unset `app.user_id` reads as '' (the `true`/missing_ok form returns '',
      // not NULL), so without it a tenant-less session (a misrouted statement
      // outside withTenantTransaction, or a future column defaulting tenant_id to
      // '') could match every '' row. Belt-and-braces with the fail-closed
      // requireTenant() at the app layer.
      `create policy tenant_isolation on templates using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on translation_memory using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on module_instances using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on module_configs using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on workspace_settings using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on global_config_meta using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on active_project using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      // project_members: you see/insert only your own membership rows (same empty-GUC guard).
      `create policy tenant_isolation on project_members using (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
    ],
  },
  {
    // Per-device cloud vault. Holds the passphrase+device-key encrypted vault
    // envelope, one row per (user_id, device_id). USER-scoped like the other
    // global-per-tenant tables (templates/translation_memory/...): visibility
    // is tenant_id = the current user, here named `user_id` (the PK already
    // carries it, so no separate tenant_id column). DDL runs as the owner
    // (the migration runner uses withTransaction, NOT withTenantTransaction),
    // mirroring 0009.
    //
    // Known consumers of this table's columns — check BOTH before renaming/
    // dropping a column, since they live in two independently-deployed
    // codebases (this table's schema is owned here, in this package) with no
    // compile-time link between them:
    //   - ciphertext/kdf_salt (secret material): the vault unlock/setup read+write
    //     path, and the unscoped `delete from device_vaults` in the vault-clear
    //     handler — both in the cloud composition root that deploys this package.
    //   - device_id/created_at/updated_at (metadata only, never
    //     ciphertext/kdf_salt): storage/pg-device-vault-store.ts
    //     (PgDeviceVaultStore), in THIS repo, backing the cloud composition
    //     root's `/auth/devices` routes.
    name: '0010_device_vaults',
    statements: [
      `create table if not exists device_vaults (
         user_id text not null,
         device_id text not null,
         ciphertext text not null,
         kdf_salt text not null,
         created_at timestamptz not null default now(),
         updated_at timestamptz not null default now(),
         primary key (user_id, device_id)
       )`,
      `alter table device_vaults enable row level security`,
      `alter table device_vaults force row level security`,
      // user-scoped: you see/insert/update/delete only your own device rows. The
      // `<> ''` guard mirrors 0009: a missing GUC reads as '' (not NULL) via the
      // `true` form, so without it a tenant-less session could match an '' row.
      `create policy tenant_isolation on device_vaults using (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `grant select, insert, update, delete on device_vaults to app_user`,
    ],
  },
  {
    // Project backups move from on-disk .backups/ zips into PG so a
    // read-only cloud container (only /tmp writable) can snapshot. The gzip'd
    // ProjectSnapshot JSON lives in `payload bytea`; the scalar columns are a
    // searchable mirror so listing never decompresses. PROJECT-scoped (a backup
    // belongs to a project), so RLS uses the membership-EXISTS form (like
    // strings/glossaries), not the global tenant_id = current_setting(...) form.
    // DDL runs as the owner (withTransaction), mirroring 0009/0010.
    name: '0011_project_backups',
    statements: [
      `create table if not exists project_backups (
         id text primary key,
         project_id text not null,
         tenant_id text not null default 'local',
         trigger text not null,
         schema_version integer not null,
         created_at timestamptz not null default now(),
         size_bytes integer,
         uncompressed_bytes integer,
         sha256 text,
         label text,
         project_name text,
         string_count integer,
         language_count integer,
         run_count integer,
         created_by text,
         payload bytea not null
       )`,
      `create index if not exists project_backups_project
         on project_backups (project_id, created_at)`,
      `alter table project_backups enable row level security`,
      `alter table project_backups force row level security`,
      // project-scoped membership policy (USING = WITH CHECK), same form as
      // strings/glossaries in 0009: visible iff the caller is a member of the
      // backup's project; the `<> ''` empty-GUC guard fails closed on a missing
      // app.user_id (which the `true` form reads as '' not NULL).
      `create policy tenant_isolation on project_backups using (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = project_backups.project_id
                 and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and
         exists (select 1 from project_members m where m.project_id = project_backups.project_id
                 and m.user_id = current_setting('app.user_id', true))
       )`,
      // The blanket grant in 0009 only covered tables that existed then; a table
      // created in 0011 needs its own explicit grant (mirrors 0010 re-granting
      // device_vaults).
      `grant select, insert, update, delete on project_backups to app_user`,
    ],
  },
  {
    // Cloud login accept-gate: records that a user accepted the published
    // policies at sign-in, one row per (user_id, policy_version). USER-scoped
    // like device_vaults (0010) — visibility is `user_id = the current user`, so
    // the PK already carries the tenant and there is no separate tenant_id
    // column. `accepted_at` defaults to the DB clock. No IP is stored (data
    // minimisation — acceptance is by an authenticated user). DDL runs as the
    // owner (the migration runner uses withTransaction, NOT
    // withTenantTransaction), mirroring 0009/0010/0011.
    name: '0012_policy_acceptances',
    statements: [
      `create table if not exists policy_acceptances (
         user_id text not null,
         policy_version text not null,
         accepted_at timestamptz not null default now(),
         primary key (user_id, policy_version)
       )`,
      `alter table policy_acceptances enable row level security`,
      `alter table policy_acceptances force row level security`,
      // user-scoped: you see/insert only your own acceptance rows. The `<> ''`
      // guard mirrors 0009/0010: a missing GUC reads as '' (not NULL) via the
      // `true` form, so without it a tenant-less session could match an '' row.
      `create policy tenant_isolation on policy_acceptances using (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      // A table created after 0009's blanket grant needs its own explicit grant
      // (mirrors 0010 device_vaults / 0011 project_backups).
      `grant select, insert, update, delete on policy_acceptances to app_user`,
    ],
  },
  {
    // Cloud account-deletion one-time tokens. A single-use, short-lived token is
    // emailed to the user as the possession factor for irreversible account
    // deletion (anti-session-theft). Stored HASHED (sha256) at rest; one pending
    // token per user (PK = user_id) so a re-request replaces the prior. USER-scoped
    // RLS like device_vaults/policy_acceptances. DDL runs as owner (withTransaction).
    name: '0013_account_deletion_tokens',
    statements: [
      `create table if not exists account_deletion_tokens (
         user_id    text        not null,
         token_hash text        not null,
         expires_at timestamptz not null,
         created_at timestamptz not null default now(),
         primary key (user_id)
       )`,
      `alter table account_deletion_tokens enable row level security`,
      `alter table account_deletion_tokens force row level security`,
      // user-scoped: you see/insert/update/delete only your own pending token.
      // The `<> ''` guard mirrors 0009/0010/0012: a missing GUC reads as '' (not
      // NULL) via the `true` form, so without it a tenant-less session could
      // match an '' row.
      `create policy tenant_isolation on account_deletion_tokens using (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      // A table created after 0009's blanket grant needs its own explicit grant
      // (mirrors 0010 device_vaults / 0011 project_backups / 0012 policy_acceptances).
      `grant select, insert, update, delete on account_deletion_tokens to app_user`,
    ],
  },
  {
    // Closed-beta invite tokens. GLOBAL admin table — NOT tenant data: there is
    // no logged-in user at registration time, so this is read/written by the
    // owner-role pool WITHOUT a tenant GUC. Therefore: NO row-level security and
    // NO app_user grant (the opposite of every tenant table in 0009). Only the
    // sha256 hash of each token is stored; the raw token exists only at mint time.
    name: '0014_beta_invites',
    statements: [
      `create table if not exists beta_invites (
         token_hash text primary key,
         created_at timestamptz not null default now(),
         expires_at timestamptz,
         used_at timestamptz,
         used_email text
       )`,
      // Defense in depth: even though app_user gets a blanket grant on new tables
      // from 0009's "grant ... on all tables" only at THAT migration's time (not
      // retroactively), revoke explicitly so a future blanket grant can't expose it.
      `revoke all on beta_invites from app_user`,
    ],
  },
  {
    // This migration tightens project_members INSERT so a tenant cannot
    // self-join an arbitrary/foreign project. Two additive, forward-only changes:
    //  (1) A partial UNIQUE index = AT MOST ONE 'owner' per project. Integrity
    //      constraints BYPASS RLS (enforced across ALL rows, even those a policy
    //      hides), so an attacker's self-inserted 'owner' row into a project that
    //      already has an owner is rejected — even though RLS hides that owner row
    //      from the attacker. (A self-referential RLS subquery could not see it.)
    //  (2) Re-create tenant_isolation with `role = 'owner'` added to WITH CHECK so
    //      EVERY insert is an owner row (and thus subject to the unique index); a
    //      NON-owner self-insert (which the other tables' membership-EXISTS still
    //      honours) is rejected. USING is unchanged (a member still sees/deletes
    //      their own row). v1 only ever inserts the single owner row
    //      (createProject / duplicateProject / restoreProject), so this is
    //      behaviour-preserving for every legitimate path; the restore ON CONFLICT
    //      (project_id, user_id) DO NOTHING still no-ops a same-user re-restore (PK
    //      arbiter fires before the partial index), while a cross-tenant restore
    //      collides on the partial index and rolls back.
    name: '0015_project_members_owner_guard',
    statements: [
      `create unique index if not exists project_members_single_owner
         on project_members (project_id) where role = 'owner'`,
      `drop policy if exists tenant_isolation on project_members`,
      `create policy tenant_isolation on project_members using (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         user_id = current_setting('app.user_id', true)
         and current_setting('app.user_id', true) <> ''
         and role = 'owner'
       )`,
    ],
  },
  {
    // The app's RUNTIME connection is the unprivileged login role `narn_app`
    // (provisioned by an ops db-migrate one-shot, NOT here). Grant it MEMBERSHIP in
    // app_user so (a) `set local role app_user` in withTenantTransaction succeeds and
    // (b) via INHERIT it uses app_user's table grants, so a statement that never sets
    // the role/GUC is RLS-filtered to ZERO rows (fail-closed) instead of erroring.
    //
    // Runs on the SUPERUSER migration pool (MIGRATION_DATABASE_URL), after 0009 created
    // app_user. GUARDED on narn_app's existence: in pnpm dev / pglite / any single-URL
    // deploy there is no narn_app, so this is a clean no-op (backward compatible).
    name: '0016_grant_app_user_to_narn_app',
    statements: [
      `do $$ begin
         if exists (select 1 from pg_roles where rolname = 'narn_app') then
           grant app_user to narn_app with inherit true;
         end if;
       end $$`,
    ],
  },
  {
    // In-app notifications, broadcast-only for v1 — fanned out ONE ROW PER
    // ADDRESSEE at insert time (no nullable-user_id / shared-broadcast-row
    // pattern). USER-scoped like device_vaults (0010) / policy_acceptances
    // (0012) / account_deletion_tokens (0013): visibility is
    // `user_id = current_setting('app.user_id')`. Unlike those three, the PK is
    // a synthetic `id` (not composite on user_id) — mirroring project_backups
    // (0011) — because one user accumulates many notifications, each
    // individually addressable for markRead/delete. `severity` defaults to
    // 'info' (info | warning | critical). `broadcast_id` groups the fan-out
    // rows produced by one admin broadcast (nullable — a future non-broadcast/
    // targeted send would leave it null); nothing reads it yet (a future
    // ops/admin unit will). No retention/expiry job for v1 — the store caps
    // reads to latest-50 (no pagination), so the unbounded row growth this
    // implies is covered by two indexes: `notifications_user` for that
    // capped/ordered read, and the partial `notifications_user_unread` for the
    // unread count/mark-all-read predicate (`where read_at is null`), which
    // `notifications_user` doesn't cover. `notifications_user_broadcast` is a
    // UNIQUE index (not just a lookup aid) backing `insertNotificationForUser`'s
    // `on conflict (user_id, broadcast_id) do nothing` — retry-safe re-delivery
    // of the same broadcast to the same addressee; Postgres treats each NULL
    // `broadcast_id` as distinct, so it only dedupes actual broadcast rows.
    // DDL runs as the owner (the migration runner uses withTransaction, NOT
    // withTenantTransaction), mirroring 0010/0012/0013.
    name: '0017_notifications',
    statements: [
      `create table if not exists notifications (
         id text primary key,
         user_id text not null,
         title text not null,
         body text not null,
         severity text not null default 'info',
         broadcast_id text,
         created_at timestamptz not null default now(),
         read_at timestamptz
       )`,
      `create index if not exists notifications_user
         on notifications (user_id, created_at desc)`,
      // Partial index covering the unread-only predicate PgNotificationStore's
      // countUnread/markAllRead both filter on — not covered by
      // notifications_user above (which is ordered for the capped list read,
      // not filtered by read_at). Partial-index precedent:
      // project_members_single_owner (0015) uses the same `where` idiom.
      `create index if not exists notifications_user_unread
         on notifications (user_id) where read_at is null`,
      // Backs insertNotificationForUser's `on conflict (user_id, broadcast_id)
      // do nothing` — a re-delivery of the same broadcast to the same
      // addressee (e.g. an ops-script retry) no-ops instead of duplicating.
      `create unique index if not exists notifications_user_broadcast
         on notifications (user_id, broadcast_id)`,
      `alter table notifications enable row level security`,
      `alter table notifications force row level security`,
      // user-scoped: you see/insert/update/delete only your own notification
      // rows. The `<> ''` guard mirrors 0010/0012/0013: a missing GUC reads as
      // '' (not NULL) via the `true` form, so without it a tenant-less session
      // could match an '' row.
      `create policy tenant_isolation on notifications using (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         user_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      // A table created after 0009's blanket grant needs its own explicit grant
      // (mirrors 0010 device_vaults / 0011 project_backups / 0012
      // policy_acceptances / 0013 account_deletion_tokens).
      `grant select, insert, update, delete on notifications to app_user`,
    ],
  },
  {
    // Relink tab: rank orphan relink candidates by how similar their
    // sourceText is to the orphan's sourceText, using native Postgres pg_trgm
    // trigram similarity instead of a hand-rolled string heuristic. Strings are
    // stored one-row-per-entry with the full StringEntry in `data jsonb` (see
    // 0006_strings) — sourceText has no dedicated column, so the trigram index
    // is a functional GIN index over `data->>'sourceText'`, and the orphans
    // route's candidates query orders by `similarity(data->>'sourceText', $1)
    // desc`.
    //
    // Wrapped in a single guarded DO block (EXCEPTION WHEN OTHERS ⇒ no-op),
    // mirroring 0009's guarded `create role`: most of the existing pglite test
    // doubles (`new PGlite()`, predating this migration) never registered the
    // `pg_trgm` contrib extension, so a bare `create extension` there would
    // abort the whole migration run and take down every unrelated pg-store
    // test. When the extension genuinely can't be installed, this
    // migration is a harmless no-op; the candidates query degrades to a plain
    // substring/insertion-order fallback rather than throwing (still correct,
    // just unranked) — see the orphans route's candidates query for that guard.
    name: '0018_orphan_relink_trgm',
    statements: [
      `do $$ begin
         create extension if not exists pg_trgm;
         create index if not exists strings_source_text_trgm
           on strings using gin ((data->>'sourceText') gin_trgm_ops);
       exception when others then
         null;
       end $$`,
    ],
  },
  {
    // One-time cleanup for an orphaning bug: before the deleteProject fix
    // (pg-project-store.ts), the project_members row for a project was removed
    // WITHOUT first deleting its project_backups rows. project_backups' RLS
    // policy is a membership-EXISTS over project_members, so once membership was
    // gone those backup rows became RLS-invisible and undeletable — orphaned
    // forever, surviving even account deletion. This migration removes any such
    // existing orphans. project_backups has FORCE row level security, and
    // migrations run as the table owner (which FORCE also subjects to RLS) with
    // no app.user_id GUC set, so a plain DELETE would match nothing — toggle
    // FORCE off for the delete, then restore it. Idempotent: a re-run (or a DB
    // with no orphans) deletes 0 rows.
    name: '0019_cleanup_orphaned_project_backups',
    statements: [
      `alter table project_backups no force row level security`,
      `delete from project_backups pb where not exists (
         select 1 from project_members m where m.project_id = pb.project_id
       )`,
      `alter table project_backups force row level security`,
    ],
  },
  {
    // 0014 revoked app_user on beta_invites and granted nothing else — written
    // when the raw pool connected as the superuser (which bypasses ACLs, so no
    // grant was needed). The runtime pool was later demoted to `narn_app`,
    // which inherits ONLY app_user's privileges via the membership 0016
    // grants it — leaving the table reachable by NO runtime role: invite
    // minting (the beta-invite CLI) and redemption (POST /auth/register →
    // claimInvite) both failed with 42501.
    // Grant narn_app DIRECT access: tenant-scoped statements still `set local
    // role app_user`, which stays revoked, so 0014's isolation intent holds.
    // Guarded on narn_app's existence (mirrors 0016) — pglite / pnpm dev /
    // single-URL deploys have no narn_app and must no-op cleanly.
    name: '0020_grant_beta_invites_to_narn_app',
    statements: [
      `do $$ begin
         if exists (select 1 from pg_roles where rolname = 'narn_app') then
           grant select, insert, update on beta_invites to narn_app;
         end if;
       end $$`,
    ],
  },
  {
    // Collaborators are member rows with role='collaborator' and a per-member
    // writable-language set.
    //
    // The 0015 policy allowed only self-row visibility and owner-only self-
    // inserts. Collaboration needs: (a) the OWNER to read/insert/update/delete
    // collaborator rows of their own projects (Sharing tab; invite redemption
    // runs under the owner's explicit tenant — the insertNotificationForUser
    // pattern); (b) a collaborator to read (and delete = leave) their OWN row.
    // A policy on project_members cannot subquery project_members (Postgres
    // raises "infinite recursion detected in policy"), so the owner check is a
    // SECURITY DEFINER function. It must be owned by a role that bypasses RLS:
    // the migration runner connects as the cluster owner/superuser
    // (MIGRATION_DATABASE_URL; plain superuser in pglite/pnpm dev), which
    // Postgres always exempts from RLS — revisit if migrations ever run as a
    // non-superuser role (it would need BYPASSRLS).
    //
    // NOT changed: project_members_single_owner (0015) still enforces exactly
    // one owner row per project; the WITH CHECK below still refuses
    // self-service collaborator inserts — only a project's owner tenant can
    // create/modify collaborator rows, so a bug elsewhere cannot let a user
    // self-join an arbitrary project (defense in depth; the app layer is the
    // primary gate).
    name: '0021_collaborator_members',
    statements: [
      `alter table project_members add column if not exists writable_languages text[] not null default '{}'`,
      `alter table project_members add column if not exists joined_at timestamptz not null default now()`,
      `create or replace function narn_is_project_owner(pid text, uid text)
         returns boolean
         language sql
         stable
         security definer
         set search_path = public
         as $fn$
           select exists (
             select 1 from project_members
             where project_id = pid and user_id = uid and role = 'owner'
           )
         $fn$`,
      `drop policy if exists tenant_isolation on project_members`,
      `create policy tenant_isolation on project_members using (
         current_setting('app.user_id', true) <> '' and (
           user_id = current_setting('app.user_id', true)
           or narn_is_project_owner(project_members.project_id, current_setting('app.user_id', true))
         )
       ) with check (
         current_setting('app.user_id', true) <> '' and (
           (user_id = current_setting('app.user_id', true) and role = 'owner')
           or (role = 'collaborator'
               and narn_is_project_owner(project_members.project_id, current_setting('app.user_id', true)))
         )
       )`,
    ],
  },
  {
    // Cloud-only identity tables, following the beta_invites precedent
    // (0014/0020) — NOT tenant-scoped, NO RLS: app_user is fully revoked so
    // the open-core app layer can never read or write them; only the cloud
    // composition root (narn_app direct grants) can, and every access is
    // mediated by the cloud routes' own authorization.
    //
    // nicknames: immutable display alias over an identity-provider user id
    // (email privacy).
    //   PK = nickname (uniqueness); user_id unique (one nickname per account),
    //   NULLed when state='locked' (account deleted, nickname permanently
    //   unavailable). Freeing = deleting the row.
    // project_invites: one-use bearer codes, sha256 hash at rest (the
    //   beta_invites idiom). created_by is ALWAYS the project owner (enforced
    //   at create), which is what lets redemption insert the collaborator row
    //   under the owner's explicit tenant without a cross-tenant lookup.
    //
    // narn_is_project_owner was PUBLIC-executable. Revoke PUBLIC, grant
    // app_user — the project_members policy evaluates AS app_user, so
    // without this grant every membership check would start failing
    // (narn_app inherits app_user's grants).
    name: '0022_collab_identity',
    statements: [
      `create table if not exists nicknames (
         nickname text primary key,
         user_id text unique,
         state text not null default 'active',
         claimed_at timestamptz not null default now()
       )`,
      `create table if not exists project_invites (
         id text primary key,
         project_id text not null,
         created_by text not null,
         code_hash text not null unique,
         created_at timestamptz not null default now(),
         expires_at timestamptz not null,
         redeemed_by text,
         redeemed_at timestamptz,
         revoked_at timestamptz
       )`,
      `create index if not exists project_invites_project on project_invites (project_id)`,
      `revoke all on nicknames from app_user`,
      `revoke all on project_invites from app_user`,
      `do $$ begin
         if exists (select 1 from pg_roles where rolname = 'narn_app') then
           grant select, insert, update, delete on nicknames to narn_app;
           grant select, insert, update, delete on project_invites to narn_app;
         end if;
       end $$`,
      `revoke execute on function narn_is_project_owner(text, text) from public`,
      `grant execute on function narn_is_project_owner(text, text) to app_user`,
    ],
  },
  {
    // Cloud-only owner lookup: a cloud composition root's invite/join flow
    // needs to resolve a project's owner user id WITHOUT a project_members
    // row of its own (it isn't a tenant on the project yet). EXECUTE is
    // granted to narn_app only — the app layer (app_user's RLS-scoped
    // sessions) never needs this, it always has its own membership context —
    // so PUBLIC execute is revoked and app_user is deliberately NOT granted.
    // Also adds a CHECK constraint on nicknames.state that was missing from
    // 0022; added here via a guarded DO block so re-running this migration
    // (or applying it after a manual constraint add) is a no-op rather than
    // an error.
    name: '0023_collab_owner_lookup',
    statements: [
      `create or replace function narn_project_owner(pid text)
         returns text
         language sql
         stable
         security definer
         set search_path = public
         as $fn$
           select user_id from project_members
           where project_id = pid and role = 'owner'
         $fn$`,
      `revoke execute on function narn_project_owner(text) from public`,
      `do $$ begin
         if exists (select 1 from pg_roles where rolname = 'narn_app') then
           grant execute on function narn_project_owner(text) to narn_app;
         end if;
       end $$`,
      `do $$ begin
         if not exists (select 1 from pg_constraint where conname = 'nicknames_state_check') then
           alter table nicknames add constraint nicknames_state_check check (state in ('active','locked'));
         end if;
       end $$`,
    ],
  },
  {
    // Run attribution. Mirrors project_backups' created_by: stamped from the
    // app.user_id GUC at INSERT (the enqueue-time ambient tenant = the
    // creator), deliberately ABSENT from the upsert's DO UPDATE SET so later
    // status flushes — which run under the same detached creator tenant
    // anyway — can never reassign a run. Nullable: runs persisted before this
    // migration have no creator and are treated as owner-created.
    name: '0024_run_created_by',
    statements: [`alter table runs add column if not exists created_by text`],
  },
  {
    // Per-USER routing for collaboration projects — one document per tenant,
    // shared across every project the user collaborates on (their own
    // projects keep per-project routing). Tenant-global table exactly like
    // templates: tenant_id-scoped RLS (0009 idiom).
    name: '0025_collab_routing',
    statements: [
      `create table if not exists collab_routing (
         tenant_id text primary key,
         config jsonb not null,
         updated_at timestamptz not null default now()
       )`,
      `alter table collab_routing enable row level security`,
      `alter table collab_routing force row level security`,
      `create policy tenant_isolation on collab_routing using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      // A table created after 0009's blanket grant needs its own explicit grant
      // (mirrors 0010 device_vaults / 0011 project_backups / 0012
      // policy_acceptances / 0013 account_deletion_tokens / 0017 notifications).
      `grant select, insert, update, delete on collab_routing to app_user`,
    ],
  },
  {
    // An append-only audit trail of manual (human) edits to translated
    // entries, one row per edit. Tenant-scoped by project_members like
    // strings/glossaries (0009 idiom) — visible/insertable iff the caller is
    // a member of the edit's project. app_user is deliberately
    // NOT granted UPDATE: edits are immutable once written (append + delete
    // only — delete is for the sweep/manual removal, not editing history).
    //
    // narn_sweep_expired_manual_edits() is a SECURITY DEFINER cleanup function
    // that deletes rows past `expires_at` across ALL tenants in one call — a
    // system/cron operation, not a per-tenant one, so it must bypass the
    // tenant_isolation policy above (which requires a per-request app.user_id
    // GUC the sweep caller won't have). It runs with the migration-owner
    // role's privileges (mirrors narn_is_project_owner in 0021, which relies
    // on the same DEFINER-bypasses-force-RLS behavior to avoid self-recursion
    // in the project_members policy). EXECUTE is revoked from PUBLIC and
    // granted only to app_user, mirroring narn_is_project_owner's grant.
    name: '0026_manual_edits',
    statements: [
      `create table if not exists manual_edits (
         id           text primary key,
         project_id   text not null,
         entry_id     text not null,
         language     text not null,
         before_text  text,
         after_text   text not null,
         created_by   text not null,
         created_at   timestamptz not null default now(),
         expires_at   timestamptz not null default (now() + interval '7 days')
       )`,
      `create index if not exists manual_edits_project_created_idx on manual_edits (project_id, created_at desc)`,
      `create index if not exists manual_edits_expires_idx on manual_edits (expires_at)`,
      `alter table manual_edits enable row level security`,
      `alter table manual_edits force row level security`,
      `create policy tenant_isolation on manual_edits using (
         current_setting('app.user_id', true) <> '' and exists (
           select 1 from project_members m
           where m.project_id = manual_edits.project_id
             and m.user_id = current_setting('app.user_id', true))
       ) with check (
         current_setting('app.user_id', true) <> '' and exists (
           select 1 from project_members m
           where m.project_id = manual_edits.project_id
             and m.user_id = current_setting('app.user_id', true))
       )`,
      `grant select, insert, delete on manual_edits to app_user`,
      `create or replace function narn_sweep_expired_manual_edits() returns bigint
         language sql security definer set search_path = public as $$
           with del as (delete from manual_edits where expires_at <= now() returning 1)
           select count(*)::bigint from del
         $$`,
      `revoke execute on function narn_sweep_expired_manual_edits() from public`,
      `grant execute on function narn_sweep_expired_manual_edits() to app_user`,
    ],
  },
  {
    // NARN Freeway: per-tenant quota ledger. `freeway_usage`
    // holds additive counters per (bucket, window); `freeway_buckets` holds
    // slow-moving bucket state (cooldowns, disable reasons, quality EMAs).
    // bucket_key = '<moduleOrInstanceId>::<modelId>'. Tenant-global tables
    // exactly like templates/collab_routing (0009/0025 idiom): tenant_id-scoped
    // RLS, not the project_members-membership form. app_user is granted
    // directly (no existence guard) because app_user is unconditionally
    // created by 0009's guarded `create role` earlier in the same migration
    // run — mirrors 0010/0011/0012/0013/0017/0025.
    name: '0027_freeway',
    statements: [
      `create table if not exists freeway_usage (
         tenant_id text not null default 'local',
         bucket_key text not null,
         window_kind text not null,
         window_start bigint not null,
         requests bigint not null default 0,
         input_tokens bigint not null default 0,
         output_tokens bigint not null default 0,
         chars bigint not null default 0,
         primary key (tenant_id, bucket_key, window_kind, window_start)
       )`,
      `create table if not exists freeway_buckets (
         tenant_id text not null default 'local',
         bucket_key text not null,
         cooldown_until bigint,
         disabled_reason text,
         flap_count integer not null default 0,
         stats jsonb not null default '{}'::jsonb,
         updated_at bigint not null default 0,
         primary key (tenant_id, bucket_key)
       )`,
      `alter table freeway_usage enable row level security`,
      `alter table freeway_usage force row level security`,
      `alter table freeway_buckets enable row level security`,
      `alter table freeway_buckets force row level security`,
      `create policy tenant_isolation on freeway_usage using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      `create policy tenant_isolation on freeway_buckets using (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       ) with check (
         tenant_id = current_setting('app.user_id', true) and current_setting('app.user_id', true) <> ''
       )`,
      // A table created after 0009's blanket grant needs its own explicit grant
      // (mirrors 0010 device_vaults / 0011 project_backups / 0012
      // policy_acceptances / 0013 account_deletion_tokens / 0017 notifications /
      // 0025 collab_routing).
      `grant select, insert, update, delete on freeway_usage to app_user`,
      `grant select, insert, update, delete on freeway_buckets to app_user`,
    ],
  },
  {
    // Pruning for freeway_usage's rpm/tpm minute cells. Those windows are
    // now written once per bucket per MINUTE (per-minute rate pacing),
    // versus rpd/monthly_chars' once per bucket per day/month — left
    // unpruned that grows the table roughly 1400x faster with no bound, on
    // a shared multi-tenant database. Nothing reads a minute cell once its
    // own window is stale.
    //
    // Mirrors narn_sweep_expired_manual_edits() (0026) exactly: a SECURITY
    // DEFINER cleanup function that bypasses freeway_usage's tenant_isolation
    // policy (0027) and deletes across ALL tenants in one call — a
    // system/cron operation, not a per-tenant one — with EXECUTE revoked
    // from PUBLIC and granted only to app_user.
    //
    // Retention is 5 minutes measured from a row's window_start, which is
    // itself floored to the START of its minute (see windowStart() in
    // packages/shared/src/freeway/windows.ts) — so a row's window doesn't
    // even CLOSE until window_start + 60s. A 5-minute cutoff therefore
    // leaves at least 4 minutes of margin past the window's own close,
    // comfortably covering both the current minute and the previous one
    // (which an in-flight request or a skewed clock may still be reading
    // headroom from) — a few minutes, not the handful of seconds
    // "nothing reads this anymore" would technically allow. rpd/monthly_chars
    // rows are excluded by window_kind regardless of age: those are the
    // day/month quota ledger, and deleting one would silently refund a
    // tenant's spent quota.
    name: '0028_freeway_minute_prune',
    statements: [
      // Supports the sweep's window_kind + window_start predicate; the
      // table's primary key leads with tenant_id/bucket_key, neither of
      // which the sweep filters on.
      `create index if not exists freeway_usage_window_kind_start_idx on freeway_usage (window_kind, window_start)`,
      `create or replace function narn_sweep_expired_freeway_windows() returns bigint
         language sql security definer set search_path = public as $$
           with del as (
             delete from freeway_usage
             where window_kind in ('rpm', 'tpm')
               and window_start < (extract(epoch from now()) * 1000)::bigint - 300000
             returning 1
           )
           select count(*)::bigint from del
         $$`,
      `revoke execute on function narn_sweep_expired_freeway_windows() from public`,
      `grant execute on function narn_sweep_expired_freeway_windows() to app_user`,
    ],
  },
];
