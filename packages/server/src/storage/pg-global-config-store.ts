import type {
  GlobalConfig,
  GlobalModuleConfigEntry,
  ModuleInstance,
  WorkspaceSettings,
} from '@zercade-dev/narn-shared';
// Import the schema from the schema-only module (NOT from
// `M19-global-config-store.ts`): the latter transitively imports `utils/fs.ts`,
// which would pull the M15 logger into the storage registry's eager import graph
// (the server test setup imports that registry) and break logger-mocking suites
// such as fs-utils.coverage. The schema module imports no I/O.
import { globalConfigSchema } from '../modules/M19-global-config-schema.js';
import type { Queryable } from './pg/pool.js';
import { withTransaction } from './pg/pool.js';
import { getCurrentTenant, requireTenant } from './pg/tenant-context.js';
import type { GlobalConfigStore } from './types.js';

interface ModuleConfigRow {
  module_id: string;
  enabled: boolean | null;
  active: boolean | null;
  config: Record<string, unknown>;
}

export class PgGlobalConfigStore implements GlobalConfigStore {
  private readonly db: Queryable;
  // Per-tenant in-process cache. A singleton store instance is shared across
  // tenants in the cloud, so a single GlobalConfig field would let tenant A's
  // cached config be returned to tenant B with no SQL — invisible to RLS. Key
  // by the request's tenant (the app.user_id GUC). One 'local' key locally.
  private readonly cache = new Map<string, GlobalConfig>();
  constructor(db: Queryable) {
    this.db = db;
  }

  async load(): Promise<GlobalConfig> {
    const key = requireTenant().userId;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const [cfgRows, instRows, setRows, metaRows] = await Promise.all([
      this.db.query<ModuleConfigRow>(
        'select module_id, enabled, active, config from module_configs',
      ),
      this.db.query<{ instance_id: string; base_module_id: string; display_name: string }>(
        'select instance_id, base_module_id, display_name from module_instances',
      ),
      this.db.query<{ data: WorkspaceSettings }>('select data from workspace_settings'),
      this.db.query<{ schema_version: number | null }>(
        'select schema_version from global_config_meta',
      ),
    ]);
    const moduleConfigs: Record<string, GlobalModuleConfigEntry> = {};
    for (const r of cfgRows.rows) {
      const entry: GlobalModuleConfigEntry = { config: r.config ?? {} };
      if (r.enabled !== null) entry.enabled = r.enabled;
      if (r.active !== null) entry.active = r.active;
      // Lazy legacy split: active absent but enabled present ⇒ active := enabled.
      if (entry.active === undefined && entry.enabled !== undefined) entry.active = entry.enabled;
      moduleConfigs[r.module_id] = entry;
    }
    const cfg: GlobalConfig = { moduleConfigs };
    const instances = instRows.rows.map((r) => ({
      instanceId: r.instance_id,
      baseModuleId: r.base_module_id,
      displayName: r.display_name,
    }));
    if (instances.length > 0) cfg.moduleInstances = instances;
    if (setRows.rows[0]?.data) cfg.settings = setRows.rows[0].data;
    const sv = metaRows.rows[0]?.schema_version;
    if (sv !== null && sv !== undefined) cfg.schemaVersion = sv;
    this.cache.set(key, cfg);
    return cfg;
  }

  cachedSettings(): WorkspaceSettings | undefined {
    const t = getCurrentTenant();
    return t ? this.cache.get(t.userId)?.settings : undefined;
  }
  async getSettings(): Promise<WorkspaceSettings> {
    return (await this.load()).settings ?? {};
  }
  async listModuleInstances(): Promise<ModuleInstance[]> {
    return (await this.load()).moduleInstances ?? [];
  }

  /** Whole-config write: validate (strips unknown keys exactly like the file
   *  store did) then reconcile every table in one transaction. */
  async save(cfg: GlobalConfig): Promise<void> {
    const parsed = globalConfigSchema.parse(cfg) as GlobalConfig;
    await withTransaction(this.db, async (tx) => {
      await tx.query('delete from module_configs');
      for (const [moduleId, e] of Object.entries(parsed.moduleConfigs)) {
        await tx.query(
          `insert into module_configs (tenant_id, module_id, enabled, active, config)
           values (current_setting('app.user_id'), $1, $2, $3, $4)`,
          [moduleId, e.enabled ?? null, e.active ?? null, JSON.stringify(e.config ?? {})],
        );
      }
      await tx.query('delete from module_instances');
      for (const i of parsed.moduleInstances ?? []) {
        await tx.query(
          `insert into module_instances (tenant_id, instance_id, base_module_id, display_name)
           values (current_setting('app.user_id'), $1, $2, $3)`,
          [i.instanceId, i.baseModuleId, i.displayName],
        );
      }
      await tx.query(
        `insert into workspace_settings (tenant_id, data)
         values (current_setting('app.user_id'), $1)
         on conflict (tenant_id) do update set data = excluded.data`,
        [JSON.stringify(parsed.settings ?? {})],
      );
      await tx.query(
        `insert into global_config_meta (tenant_id, schema_version)
         values (current_setting('app.user_id'), $1)
         on conflict (tenant_id) do update set schema_version = excluded.schema_version`,
        [parsed.schemaVersion ?? null],
      );
    });
    this.cache.set(requireTenant().userId, parsed);
  }

  async updateModule(moduleId: string, entry: GlobalModuleConfigEntry): Promise<GlobalConfig> {
    const current = await this.load();
    // Resurrect-after-remove guard: an instance-id config whose instance is gone
    // must not be re-created (mirrors M19 updateModule).
    const isInstanceId = moduleId.includes(':');
    const liveInstance = (current.moduleInstances ?? []).some((i) => i.instanceId === moduleId);
    if (isInstanceId && !liveInstance) return current;
    // Partial-update merge: the route forwards exactly the fields the caller sent,
    // so an omitted `enabled`/`active` must PRESERVE the stored gate, not null it.
    // A config save (PUT { active, config }, no `enabled`) would otherwise wipe a
    // module's `enabled: true` and make it vanish from the config tab (which filters
    // on enabled === true); the enable selector (PUT { enabled, config }, no
    // `active`) would symmetrically clobber an explicit `active: false`. `??` keeps
    // an explicit `false` (only null/undefined falls through to the prior value).
    const existing = current.moduleConfigs[moduleId];
    const enabled = entry.enabled ?? existing?.enabled ?? null;
    const active = entry.active ?? existing?.active ?? null;
    await this.db.query(
      `insert into module_configs (tenant_id, module_id, enabled, active, config)
       values (current_setting('app.user_id'), $1, $2, $3, $4)
       on conflict (tenant_id, module_id) do update
         set enabled = excluded.enabled, active = excluded.active, config = excluded.config`,
      [moduleId, enabled, active, JSON.stringify(entry.config ?? {})],
    );
    this.cache.delete(requireTenant().userId);
    return this.load();
  }

  async addModuleInstance(instance: ModuleInstance): Promise<GlobalConfig> {
    const dup = await this.db.query('select 1 from module_instances where instance_id = $1', [
      instance.instanceId,
    ]);
    if (dup.rows.length > 0)
      throw new Error(`Module instance already exists: ${instance.instanceId}`);
    await this.db.query(
      `insert into module_instances (tenant_id, instance_id, base_module_id, display_name)
       values (current_setting('app.user_id'), $1, $2, $3)`,
      [instance.instanceId, instance.baseModuleId, instance.displayName],
    );
    this.cache.delete(requireTenant().userId);
    return this.load();
  }

  async renameModuleInstance(
    instanceId: string,
    displayName: string,
  ): Promise<ModuleInstance | undefined> {
    const existing = await this.db.query<{ base_module_id: string }>(
      'select base_module_id from module_instances where instance_id = $1',
      [instanceId],
    );
    if (existing.rows.length === 0) return undefined;
    await this.db.query('update module_instances set display_name = $2 where instance_id = $1', [
      instanceId,
      displayName,
    ]);
    this.cache.delete(requireTenant().userId);
    return { instanceId, baseModuleId: existing.rows[0]!.base_module_id, displayName };
  }

  async removeModuleInstance(instanceId: string): Promise<boolean> {
    return withTransaction(this.db, async (tx) => {
      const found = await tx.query('select 1 from module_instances where instance_id = $1', [
        instanceId,
      ]);
      if (found.rows.length === 0) return false;
      await tx.query('delete from module_instances where instance_id = $1', [instanceId]);
      await tx.query('delete from module_configs where module_id = $1', [instanceId]);
      this.cache.delete(requireTenant().userId);
      return true;
    });
  }

  async updateSettings(settings: Partial<WorkspaceSettings>): Promise<GlobalConfig> {
    const current = await this.load();
    // null/undefined means "clear this setting" → delete the key so the runtime
    // default applies (a literal null would fail workspaceSettingsSchema).
    const mergedSettings: Record<string, unknown> = { ...current.settings };
    for (const [k, v] of Object.entries(settings)) {
      if (v === null || v === undefined) delete mergedSettings[k];
      else mergedSettings[k] = v;
    }
    const merged = globalConfigSchema.parse({
      ...current,
      settings: mergedSettings,
    }) as GlobalConfig;
    await this.db.query(
      `insert into workspace_settings (tenant_id, data)
       values (current_setting('app.user_id'), $1)
       on conflict (tenant_id) do update set data = excluded.data`,
      [JSON.stringify(merged.settings ?? {})],
    );
    this.cache.set(requireTenant().userId, merged);
    return merged;
  }
}
