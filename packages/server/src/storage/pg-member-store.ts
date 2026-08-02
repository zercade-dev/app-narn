import type { Queryable } from './pg/pool.js';
import type { MemberStore, ProjectMember } from './types.js';

interface MemberRow {
  project_id: string;
  user_id: string;
  role: 'owner' | 'collaborator';
  writable_languages: string[];
  joined_at: Date;
}

const COLS = 'project_id, user_id, role, writable_languages, joined_at';

/**
 * PG membership store. Every statement runs inside a tenant transaction
 * (TenantDb), so the 0021 policy applies: an owner sees/manages every row of
 * their projects; a collaborator sees only their own row. addCollaborator is
 * only legal under the OWNER's tenant (WITH CHECK role='collaborator' requires
 * narn_is_project_owner) — the cloud join flow establishes that context
 * explicitly (insertNotificationForUser pattern).
 */
export class PgMemberStore implements MemberStore {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  private rowToMember(row: MemberRow): ProjectMember {
    return {
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      writableLanguages: row.writable_languages ?? [],
      joinedAt: row.joined_at.toISOString(),
    };
  }

  async getMembership(projectId: string): Promise<ProjectMember | null> {
    const { rows } = await this.db.query<MemberRow>(
      `select ${COLS} from project_members
       where project_id = $1 and user_id = current_setting('app.user_id', true)`,
      [projectId],
    );
    return rows.length > 0 ? this.rowToMember(rows[0]!) : null;
  }

  async listMembers(projectId: string): Promise<ProjectMember[]> {
    const { rows } = await this.db.query<MemberRow>(
      `select ${COLS} from project_members
       where project_id = $1
       order by joined_at asc, user_id asc`,
      [projectId],
    );
    return rows.map((row) => this.rowToMember(row));
  }

  async addCollaborator(projectId: string, userId: string): Promise<ProjectMember> {
    const { rows } = await this.db.query<MemberRow>(
      `insert into project_members (project_id, user_id, role)
       values ($1, $2, 'collaborator')
       returning ${COLS}`,
      [projectId, userId],
    );
    return this.rowToMember(rows[0]!);
  }

  async updateWritableLanguages(
    projectId: string,
    userId: string,
    writableLanguages: string[],
  ): Promise<ProjectMember | null> {
    const { rows } = await this.db.query<MemberRow>(
      `update project_members set writable_languages = $3
       where project_id = $1 and user_id = $2 and role = 'collaborator'
       returning ${COLS}`,
      [projectId, userId, writableLanguages],
    );
    return rows.length > 0 ? this.rowToMember(rows[0]!) : null;
  }

  async removeMember(projectId: string, userId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ user_id: string }>(
      `delete from project_members
       where project_id = $1 and user_id = $2 and role = 'collaborator'
       returning user_id`,
      [projectId, userId],
    );
    return rows.length > 0;
  }

  async listMyMemberships(): Promise<ProjectMember[]> {
    const { rows } = await this.db.query<MemberRow>(
      `select ${COLS} from project_members
       where user_id = current_setting('app.user_id', true)
       order by joined_at asc, project_id asc`,
    );
    return rows.map((row) => this.rowToMember(row));
  }

  async countMembersByProject(): Promise<Record<string, number>> {
    const { rows } = await this.db.query<{ project_id: string; n: string | number }>(
      `select project_id, count(*) as n from project_members group by project_id`,
    );
    return Object.fromEntries(rows.map((r) => [r.project_id, Number(r.n)]));
  }
}
