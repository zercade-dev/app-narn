/**
 * M27 — Module-instance migration
 *
 * One-time, idempotent data migration that converts every configured base
 * module (except those that opt out of instancing, e.g. deepl/pseudo) into a
 * named default instance `<base>:default`. After this migration each
 * instanceable module's configuration lives under its `<base>:default` instance
 * id and the bare base module is left as a clean template; routing rules,
 * per-project module configs and `judgeConfig.moduleId` that referenced the
 * bare base id are rewritten to the new default instance id.
 *
 * The migration mirrors the lazy `enabled→active` normalization elsewhere but
 * is guarded by a `schemaVersion` marker on the global config so it runs
 * exactly once and re-running is a no-op.
 *
 * Historic `TranslationRecord.moduleId` values are deliberately NOT rewritten:
 * base modules still resolve, and the run history should reflect what actually
 * ran.
 */
import type {
  GlobalConfig,
  GlobalModuleConfigEntry,
  ModuleInstance,
  Project,
} from '@zercade-dev/narn-shared';
import {
  buildModuleInstanceId,
  isModuleInstanceId,
  DEFAULT_INSTANCE_SLUG,
} from '@zercade-dev/narn-shared';
import type { GlobalConfigStore, ProjectStore } from '../storage/types.js';
import { getGlobalConfigStore, getProjectStore } from '../storage/registry.js';
import { logger } from './M15-console-logger.js';

/** Schema version that introduces named default instances. */
export const INSTANCE_MIGRATION_SCHEMA_VERSION = 1;

/**
 * Slug used for the default instance created from a bare base module. The
 * source of truth now lives in `@zercade-dev/narn-shared`; re-exported here so
 * existing M27 call sites keep importing it from this module.
 */
export { DEFAULT_INSTANCE_SLUG };

/**
 * Compute, for a set of instanceable base module ids, the bare-base-id →
 * `<base>:default` rewrite map. Only includes bases that are instanceable and
 * actually present in the global config's `moduleConfigs` under their bare id.
 */
function buildRewriteMap(
  config: GlobalConfig,
  instanceableBaseIds: ReadonlySet<string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const moduleId of Object.keys(config.moduleConfigs)) {
    if (isModuleInstanceId(moduleId)) continue;
    if (!instanceableBaseIds.has(moduleId)) continue;
    map.set(moduleId, buildModuleInstanceId(moduleId, DEFAULT_INSTANCE_SLUG));
  }
  return map;
}

/**
 * Rewrite the global config in place-free fashion: move each migrated base
 * module's config under its `<base>:default` key, register the instance, and
 * leave the bare base module as a clean template. Returns the migrated config
 * (always with the up-to-date `schemaVersion`).
 */
function migrateGlobalConfig(
  config: GlobalConfig,
  rewrite: ReadonlyMap<string, string>,
  displayName: (baseModuleId: string) => string,
): { config: GlobalConfig; instances: ModuleInstance[] } {
  const existingInstanceIds = new Set((config.moduleInstances ?? []).map((i) => i.instanceId));

  const moduleConfigs: Record<string, GlobalModuleConfigEntry> = { ...config.moduleConfigs };
  const newInstances: ModuleInstance[] = [];

  for (const [baseId, instanceId] of rewrite) {
    const baseEntry = moduleConfigs[baseId];
    if (!baseEntry) continue;

    // Copy (do NOT move) the base module's config to the default instance.
    //
    // The base module stays a fully-working template with its config intact:
    //   - bare-base routing rules / judge refs the rewrite map didn't cover and
    //     new projects that route to the bare base id keep working;
    //   - the base-module settings panel, model discovery and footprint routes
    //     (which read `moduleConfigs[baseId].config`) keep working;
    //   - back-translation preview's first-enabled fallback still resolves.
    // The `<base>:default` instance is an independent editable copy. We never
    // clobber an existing `<base>:default` config (idempotency).
    if (moduleConfigs[instanceId] === undefined) {
      moduleConfigs[instanceId] = {
        enabled: baseEntry.enabled,
        active: baseEntry.active,
        config: { ...(baseEntry.config ?? {}) },
      };
    }

    // Ensure the instance record exists even when its config entry was already
    // present (e.g. a hand-edited or partially-migrated config), so the
    // instance is always registered at startup.
    if (!existingInstanceIds.has(instanceId)) {
      newInstances.push({
        instanceId,
        baseModuleId: baseId,
        displayName: displayName(baseId),
      });
      existingInstanceIds.add(instanceId);
    }
  }

  const migrated: GlobalConfig = {
    ...config,
    schemaVersion: INSTANCE_MIGRATION_SCHEMA_VERSION,
    moduleConfigs,
    moduleInstances: [...(config.moduleInstances ?? []), ...newInstances],
  };
  return { config: migrated, instances: migrated.moduleInstances ?? [] };
}

/**
 * Rewrite a single project's references to migrated bare base ids:
 *  - routing rules' `moduleId` (across all rule groups and the legacy flat list)
 *  - per-project `moduleConfigs` keys
 *  - `judgeConfig.moduleId`
 * Returns the rewritten project and whether anything changed.
 */
export function migrateProject(
  project: Project,
  rewrite: ReadonlyMap<string, string>,
): { project: Project; changed: boolean } {
  let changed = false;
  const rewriteId = (id: string | undefined): string | undefined => {
    if (id === undefined) return id;
    const next = rewrite.get(id);
    if (next !== undefined && next !== id) {
      changed = true;
      return next;
    }
    return id;
  };

  // Per-project moduleConfigs: copy a migrated base's entry to the
  // default-instance key (so routing rules now pointing at `<base>:default`
  // keep their per-project override), while leaving the bare-base entry intact
  // for any rule that still references the bare base id. An existing instance
  // entry is never clobbered.
  const moduleConfigs = { ...project.moduleConfigs };
  for (const [baseId, instanceId] of rewrite) {
    const baseEntry = moduleConfigs[baseId];
    if (baseEntry === undefined) continue;
    if (moduleConfigs[instanceId] === undefined) {
      moduleConfigs[instanceId] = baseEntry;
      changed = true;
    }
  }

  // Routing rule groups (and the legacy flat list mirrors the active group, so
  // M1's normalization keeps them in sync after the write).
  const routingRuleGroups = project.routingRuleGroups?.map((group) => ({
    ...group,
    rules: group.rules.map((rule) => {
      const moduleId = rewriteId(rule.moduleId);
      return moduleId === rule.moduleId ? rule : { ...rule, moduleId: moduleId! };
    }),
  }));
  const routingRules = project.routingRules.map((rule) => {
    const moduleId = rewriteId(rule.moduleId);
    return moduleId === rule.moduleId ? rule : { ...rule, moduleId: moduleId! };
  });

  // judgeConfig.moduleId
  let judgeConfig = project.judgeConfig;
  if (judgeConfig?.moduleId !== undefined) {
    const moduleId = rewriteId(judgeConfig.moduleId);
    if (moduleId !== judgeConfig.moduleId) {
      judgeConfig = { ...judgeConfig, moduleId };
    }
  }

  return {
    project: { ...project, moduleConfigs, routingRuleGroups, routingRules, judgeConfig },
    changed,
  };
}

/**
 * Run the one-time instance migration. Idempotent: a no-op once the global
 * config's `schemaVersion` is already at or beyond
 * {@link INSTANCE_MIGRATION_SCHEMA_VERSION}.
 *
 * @param instanceableBaseIds base module ids that may have instances (deepl /
 *   pseudo excluded by the caller from the manifest's `instanceable` flag).
 * @param displayName maps a base module id to the default instance's display name.
 */
export async function runInstanceMigration(
  instanceableBaseIds: ReadonlySet<string>,
  displayName: (baseModuleId: string) => string,
  stores: { gcs?: GlobalConfigStore; ps?: ProjectStore } = {},
): Promise<{ migrated: boolean; instances: ModuleInstance[] }> {
  const gcs = stores.gcs ?? getGlobalConfigStore();
  const ps = stores.ps ?? getProjectStore();

  const current = await gcs.load();
  if ((current.schemaVersion ?? 0) >= INSTANCE_MIGRATION_SCHEMA_VERSION) {
    return { migrated: false, instances: current.moduleInstances ?? [] };
  }

  const rewrite = buildRewriteMap(current, instanceableBaseIds);
  const { config: migratedConfig, instances } = migrateGlobalConfig(current, rewrite, displayName);

  // The marker-free copy of the migrated config (instances registered, but
  // `schemaVersion` withheld) — the state we persist when a project rewrite
  // straggler must force a re-run next startup. Strip the marker by omission
  // rather than reconstructing the config field-by-field, so adding a new
  // top-level GlobalConfig field never silently drops it here.
  const unmarkedConfig: GlobalConfig = { ...migratedConfig };
  delete unmarkedConfig.schemaVersion;

  // Rewrite every project FIRST, then write the global config + version
  // marker in a SINGLE atomic `gcs.save` (one transaction — see
  // PgGlobalConfigStore.save). Previously the instances were saved WITHOUT the
  // marker, then the marker was stamped in a second save; a crash in that window
  // left instances registered under an un-stamped (re-runnable) config, and the
  // two-write window let a concurrent global-config writer (e.g. two lazy
  // `ensureTenantProvisioned` first-requests racing for the same tenant) lose the
  // blob to last-write-wins. Persisting instances + marker together collapses
  // that window to a single transaction: a crash rolls the whole save back (no
  // partial state), and the straggler-retry guarantee is preserved by writing the
  // UNMARKED config when a project failed (instances still register; the missing
  // marker forces a safe idempotent re-run). Project rewrites don't touch the
  // global-config blob and are independently idempotent, so they stay outside the
  // single save. `updateProject` does not validate module ids against registered
  // instances, so doing the rewrites before the instances are saved is safe.
  let allProjectsOk = true;
  if (rewrite.size > 0) {
    const projects = await ps.listProjects();
    for (const summary of projects) {
      let project: Project;
      try {
        project = await ps.loadProject(summary.id);
      } catch (err) {
        allProjectsOk = false;
        logger.warn('instance-migration: failed to load project', {
          projectId: summary.id,
          error: String(err),
        });
        continue;
      }
      const { project: migratedProject, changed } = migrateProject(project, rewrite);
      if (!changed) continue;
      try {
        // Only the grouped routing config is rewritten; M1's `updateProject`
        // re-derives the legacy flat `routingRules` from the active group.
        await ps.updateProject(summary.id, {
          moduleConfigs: migratedProject.moduleConfigs,
          routingRuleGroups: migratedProject.routingRuleGroups,
          activeRoutingRuleGroupId: migratedProject.activeRoutingRuleGroupId,
          judgeConfig: migratedProject.judgeConfig,
        });
      } catch (err) {
        allProjectsOk = false;
        logger.warn('instance-migration: failed to rewrite project', {
          projectId: summary.id,
          error: String(err),
        });
      }
    }
  }

  // Single atomic write: instances + marker together when every project was
  // rewritten, else the marker-free config (instances register; the run repeats
  // next startup to repair the stragglers). Either way it is ONE `gcs.save`
  // transaction, so there is never an instances-but-no-marker on-disk state from
  // a crash, and no two-save window for a concurrent writer to interleave.
  if (allProjectsOk) {
    await gcs.save(migratedConfig);
  } else {
    await gcs.save(unmarkedConfig);
    logger.warn('instance-migration: some projects failed; marker not written, will retry');
  }

  logger.info('instance-migration:complete', {
    schemaVersion: allProjectsOk ? INSTANCE_MIGRATION_SCHEMA_VERSION : (current.schemaVersion ?? 0),
    createdInstances: instances.map((i) => i.instanceId),
  });
  return { migrated: true, instances };
}
