import type { ProjectTemplate, ProjectTemplateConfig } from '@zercade-dev/narn-shared';
import { KeyedAsyncLock } from '../utils/keyed-lock.js';
import { slugify } from '../utils/slugify.js';
import { TemplateNotFoundError } from '../types/errors.js';
import type { Queryable } from './pg/pool.js';
import type { TemplateStore } from './types.js';

export class PgTemplateStore implements TemplateStore {
  private readonly db: Queryable;
  private readonly writeLock = new KeyedAsyncLock();
  constructor(db: Queryable) {
    this.db = db;
  }

  async listTemplates(): Promise<ProjectTemplate[]> {
    const { rows } = await this.db.query<{ data: ProjectTemplate }>(
      `select data from templates order by (data->>'createdAt')::bigint asc`,
    );
    return rows.map((r) => r.data);
  }

  async getTemplate(templateId: string): Promise<ProjectTemplate> {
    const { rows } = await this.db.query<{ data: ProjectTemplate }>(
      'select data from templates where id = $1',
      [templateId],
    );
    if (rows.length === 0) throw new TemplateNotFoundError(templateId);
    return rows[0]!.data;
  }

  async createTemplate(name: string, config: ProjectTemplateConfig): Promise<ProjectTemplate> {
    const id = `${slugify(name) || 'template'}-${Date.now()}`;
    return this.writeLock.withLock(id, async () => {
      const now = Date.now();
      const template: ProjectTemplate = { id, name, createdAt: now, updatedAt: now, config };
      await this.db.query(
        "insert into templates (id, tenant_id, data) values ($1, current_setting('app.user_id'), $2)",
        [id, JSON.stringify(template)],
      );
      return template;
    });
  }

  async deleteTemplate(templateId: string): Promise<void> {
    return this.writeLock.withLock(templateId, async () => {
      const existing = await this.db.query('select 1 from templates where id = $1', [templateId]);
      if (existing.rows.length === 0) throw new TemplateNotFoundError(templateId);
      await this.db.query('delete from templates where id = $1', [templateId]);
    });
  }
}
