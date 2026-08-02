import type { Project } from '@zercade-dev/narn-shared';
import { ProjectNotFoundError } from '../types/errors.js';
import { KeyedAsyncLock } from '../utils/keyed-lock.js';
import { slugify } from '../utils/slugify.js';
import type { Queryable } from './pg/pool.js';
import { withTransaction } from './pg/pool.js';
import type { ProjectStore } from './types.js';
import {
  normalizeLoadedProject,
  normalizeProjectRouting,
  normalizeRuleList,
  normalizeRoutingGroups,
} from './project-normalize.js';

export class PgProjectStore implements ProjectStore {
  private readonly db: Queryable;
  // Serialize the per-project read-modify-write in updateProject/duplicateProject
  // (mirrors the former M1 ProjectStore / M3 StringStore in-process lock) so
  // concurrent callers can't race the load → mutate → persist cycle.
  private readonly writeLock = new KeyedAsyncLock();

  constructor(db: Queryable) {
    this.db = db;
  }

  async loadProject(id: string): Promise<Project> {
    const { rows } = await this.db.query<{ data: Project }>(
      'select data from projects where id = $1',
      [id],
    );
    if (rows.length === 0) throw new ProjectNotFoundError(id);
    return normalizeLoadedProject(rows[0]!.data);
  }

  async listProjects(): Promise<Project[]> {
    const { rows } = await this.db.query<{ data: Project }>('select data from projects');
    return rows.map((r) => normalizeProjectRouting(r.data));
  }

  async getActiveProjectId(): Promise<string | null> {
    const { rows } = await this.db.query<{ project_id: string }>(
      'select project_id from active_project',
    );
    return rows[0]?.project_id ?? null;
  }

  async createProject(
    name: string,
    sourceLanguage: string,
    activeLanguages: string[],
    icon?: string,
  ): Promise<Project> {
    const slug = slugify(name);
    const id = `${slug}-${Date.now()}`;
    return this.writeLock.withLock(id, async () => {
      const now = Date.now();
      const project: Project = {
        id,
        name,
        ...(icon !== undefined ? { icon } : {}),
        sourceLanguage,
        activeLanguages,
        routingRules: [],
        routingRuleGroups: [{ id: 'default-group', name: 'Default Group', rules: [] }],
        activeRoutingRuleGroupId: 'default-group',
        moduleConfigs: {},
        // Translation memory is off by default; the user opts in via the Config
        // tab. Set explicitly so new projects are self-describing.
        tmPolicy: 'disabled',
        createdAt: now,
        updatedAt: now,
      };
      // Membership row first, then the project: the project's RLS WITH CHECK is
      // an EXISTS over project_members, so it must already see the owner row
      // within the same tenant tx. `this.db` is a TenantDb, so withTransaction
      // routes both inserts through one withTenantTransaction (role + GUC set
      // once). tenant_id is sourced from current_setting('app.user_id') (the
      // active tenant — 'local' in the single-user app) — the first cutover off
      // the hardcoded LOCAL_TENANT literal.
      await withTransaction(this.db, async (tx) => {
        await tx.query(
          "insert into project_members (project_id, user_id, role) values ($1, current_setting('app.user_id'), 'owner')",
          [id],
        );
        await tx.query(
          "insert into projects (id, tenant_id, data) values ($1, current_setting('app.user_id'), $2)",
          [id, JSON.stringify(project)],
        );
      });
      return project;
    });
  }

  async updateProject(
    id: string,
    partial: Partial<Omit<Project, 'id' | 'createdAt'>>,
  ): Promise<Project> {
    return this.writeLock.withLock(id, async () => {
      const existing = await this.loadProject(id);
      const updated: Project = {
        ...existing,
        ...partial,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
      };
      if (partial.routingRules !== undefined && partial.routingRuleGroups === undefined) {
        const ng = normalizeRoutingGroups(
          updated.routingRuleGroups,
          partial.routingRules,
          updated.activeRoutingRuleGroupId,
        );
        updated.routingRuleGroups = ng.groups.map((g) =>
          g.id === ng.activeGroupId ? { ...g, rules: normalizeRuleList(partial.routingRules) } : g,
        );
        updated.activeRoutingRuleGroupId = ng.activeGroupId;
      }
      const normalized = normalizeProjectRouting(updated);
      await this.db.query('update projects set data = $2 where id = $1', [
        id,
        JSON.stringify(normalized),
      ]);
      return normalized;
    });
  }

  async switchProject(id: string): Promise<void> {
    return this.writeLock.withLock(id, async () => {
      await this.loadProject(id); // validate it exists
      await this.db.query(
        `insert into active_project (tenant_id, project_id) values (current_setting('app.user_id'), $1)
         on conflict (tenant_id) do update set project_id = excluded.project_id`,
        [id],
      );
    });
  }

  async deleteProject(id: string): Promise<void> {
    return this.writeLock.withLock(id, async () => {
      // Project + its sibling per-project rows are removed atomically — one
      // transaction restores the crash-atomicity on-disk atomicWrite gave file
      // stores. Existence pre-check + deletes go through the `Queryable.query`
      // surface (no driver-specific `rowCount` cast) so it works identically on
      // pg and the pglite test double. project_backups is covered below (0011);
      // more sibling tables are appended here by later project-coupled store
      // tasks.
      await withTransaction(this.db, async (tx) => {
        const existing = await tx.query('select 1 from projects where id = $1', [id]);
        if (existing.rows.length === 0) throw new ProjectNotFoundError(id);
        await tx.query('delete from glossaries where project_id = $1', [id]);
        await tx.query('delete from glossary_overrides where project_id = $1', [id]);
        await tx.query('delete from strings where project_id = $1', [id]);
        await tx.query('delete from review_order where project_id = $1', [id]);
        // Runs are execution log, not project config. Cascade-delete the run
        // sidecars first (FK-less, so order is by hand) then the runs themselves.
        await tx.query(
          'delete from run_sidecars where run_id in (select run_id from runs where project_id = $1)',
          [id],
        );
        await tx.query('delete from runs where project_id = $1', [id]);
        // FK-less (0011), and its RLS policy is a membership-EXISTS over
        // project_members — so this MUST run before the project_members delete
        // below, or the rows become RLS-invisible and orphaned forever.
        await tx.query('delete from project_backups where project_id = $1', [id]);
        await tx.query('delete from projects where id = $1', [id]);
        const active = await tx.query<{ project_id: string }>(
          'select project_id from active_project',
        );
        if (active.rows[0]?.project_id === id) {
          await tx.query('delete from active_project where project_id = $1', [id]);
        }
        // Membership row LAST: every preceding delete/select is RLS-gated on an
        // EXISTS over this membership (the project row's own `using` policy
        // included), so removing it earlier would make those rows invisible
        // under app_user and leave orphans. With the project gone, drop the
        // owner membership so the project id is fully reclaimed.
        await tx.query('delete from project_members where project_id = $1', [id]);
      });
    });
  }

  async duplicateProject(id: string): Promise<Project> {
    // Lock on the source id so the copy can't read a source mid-delete
    // (deleteProject locks on the same id).
    return this.writeLock.withLock(id, async () => {
      const source = await this.loadProject(id);
      const newName = `${source.name} (copy)`;
      const newId = `${slugify(newName)}-${Date.now()}`;
      const now = Date.now();
      const newProject: Project = {
        ...source,
        id: newId,
        name: newName,
        createdAt: now,
        updatedAt: now,
      };

      // Project row + its sibling per-project rows are copied atomically. More
      // sibling tables are appended here by later project-coupled store tasks.
      // Runs/run_sidecars are deliberately NOT copied: `runs.run_id` is a global
      // UUID PK, so cloning source run rows under a new project_id would violate
      // the PK, and run history is execution log (not project config) — the old
      // fs.cp copied it only incidentally.
      await withTransaction(this.db, async (tx) => {
        // Fresh owner membership for the copy FIRST (so the new project's RLS
        // WITH CHECK — an EXISTS over project_members — and the child-row copies'
        // WITH CHECK are satisfied within the tx), then the project sourcing
        // tenant_id from current_setting('app.user_id'). The child-copy `select
        // …, tenant_id, … where project_id = $1` reads stay member-visible (the
        // SOURCE project's membership exists from createProject) and keep the
        // source rows' tenant_id (= the tenant).
        await tx.query(
          "insert into project_members (project_id, user_id, role) values ($1, current_setting('app.user_id'), 'owner')",
          [newId],
        );
        await tx.query(
          "insert into projects (id, tenant_id, data) values ($1, current_setting('app.user_id'), $2)",
          [newId, JSON.stringify(newProject)],
        );
        await tx.query(
          'insert into glossaries (project_id, id, tenant_id, data) select $2, id, tenant_id, data from glossaries where project_id = $1',
          [id, newId],
        );
        await tx.query(
          'insert into glossary_overrides (project_id, tenant_id, overrides) select $2, tenant_id, overrides from glossary_overrides where project_id = $1',
          [id, newId],
        );
        // Copy strings ordered by `seq` and OMIT `seq` so the copies get fresh,
        // monotonically-increasing sequence values that preserve the source order.
        await tx.query(
          'insert into strings (project_id, id, tenant_id, data) select $2, id, tenant_id, data from strings where project_id = $1 order by seq',
          [id, newId],
        );
        // Copy the review-order "last sorted" meta (per-entry reviewSortIndex
        // rides along inside the copied `strings.data` above).
        await tx.query(
          'insert into review_order (project_id, tenant_id, version, computed_at, count) select $2, tenant_id, version, computed_at, count from review_order where project_id = $1',
          [id, newId],
        );
      });

      return newProject;
    });
  }
}
