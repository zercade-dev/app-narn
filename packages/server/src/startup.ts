import { logger } from './modules/M15-console-logger.js';
import { moduleRegistry } from './modules/M6-module-registry.js';
import type { StaticModuleEntry } from './modules/M6-module-registry.js';
import { STATIC_MODULES } from './modules/module-index.js';
import { isCloudMode } from './identity/registry.js';
import { runInstanceMigration } from './modules/M27-instance-migration.js';
import { runEndpointTypeMigration } from './modules/M27b-endpoint-type-migration.js';
import { getGlobalConfigStore, getMigrationPool, runMigrations } from './storage/index.js';
import { NoTenantContextError, runWithTenant } from './storage/pg/tenant-context.js';
import { hasLegacyTrustCfClientIp } from './config/env.js';

/** The single tenant this local app runs as (mirrors the test harness default). */
const LOCAL_TENANT = 'local';

/**
 * The modules to load for this deployment. In multi-tenant cloud mode, any
 * module whose manifest sets `cloudDisabled` is excluded; the local single-user
 * app loads everything. Copilot is the first opt-out: its bundled CLI keeps one
 * process-global `COPILOT_HOME` (session/cache state + a keytar plaintext-token
 * fallback on a headless host) that would be shared across tenants in the single
 * cloud process. Pure + exported for unit testing.
 */
export function selectActiveModules(
  modules: StaticModuleEntry[],
  cloud: boolean,
): StaticModuleEntry[] {
  return cloud ? modules.filter((m) => !m.manifest.cloudDisabled) : modules;
}

// Runs the post-migration module load + the non-fatal idempotent migrations.
// Instance/endpoint-migration failures stay warn-only (behavior preserved); a
// missing tenant context, however, is a boot-time programming/config bug, so it
// is re-thrown to become fatal in index.ts (defense-in-depth — after the
// runWithTenant wrap below this path no longer throws it).
export async function loadModulesAndInstances(): Promise<void> {
  const activeModules = selectActiveModules(STATIC_MODULES, isCloudMode());
  moduleRegistry.loadStatic(activeModules);
  logger.info('module:static-load-complete', {
    loaded: activeModules.map((m) => m.manifest.id),
  });
  // This local, single-user app runs as exactly one tenant ('local' — the same
  // RLS GUC the request middleware and the test harness establish), so the boot
  // path provisions that one tenant. (For cloud mode, where the tenant is the
  // authenticated user, this same `initTenant` runs lazily per user via
  // `ensureTenantProvisioned` instead — see ./storage/ensure-provisioned.ts.)
  await initTenant(LOCAL_TENANT);
}

/**
 * Provision a single tenant: run the (idempotent) M27 instance migration + the
 * M27b endpoint-type backfill, then register the resulting `<base>:default`
 * module instances in M6 — all inside that tenant's RLS context.
 *
 * Everything here touches the TenantDb-wrapped registry stores (the M27/M27b
 * migrations + listModuleInstances), so it needs an ambient tenant or every
 * .query() fails closed with NoTenantContextError; the `runWithTenant({ userId })`
 * wrap supplies it. Instance/endpoint-migration failures stay warn-only
 * (behavior preserved); a missing tenant context, however, is a programming bug
 * and is re-thrown to become fatal in the caller (defense-in-depth — after the
 * wrap this path no longer throws it).
 *
 * Idempotent: a re-run is a no-op once M27 has stamped the tenant's
 * `schemaVersion`. Boot calls `initTenant('local')`; cloud calls it per user.
 */
export async function initTenant(userId: string): Promise<void> {
  await runWithTenant({ userId }, async () => {
    const activeModules = selectActiveModules(STATIC_MODULES, isCloudMode());
    const instanceableBaseIds = new Set(
      activeModules.filter((m) => m.manifest.instanceable !== false).map((m) => m.manifest.id),
    );
    await runInstanceMigration(instanceableBaseIds, (baseId) => {
      const name = activeModules.find((m) => m.manifest.id === baseId)?.manifest.name ?? baseId;
      return name;
    }).catch(rethrowMissingTenant('Instance migration failed'));
    await runEndpointTypeMigration().catch(rethrowMissingTenant('Endpoint-type migration failed'));
    const instances = await getGlobalConfigStore()
      .listModuleInstances()
      .catch((err: unknown) => {
        if (err instanceof NoTenantContextError) throw err;
        logger.warn(`Failed to load module instances: ${String(err)}`);
        return [];
      });
    for (const instance of instances ?? []) {
      try {
        moduleRegistry.registerInstance(instance);
      } catch (err) {
        logger.warn('module:instance-register-failed', {
          instanceId: instance.instanceId,
          error: String(err),
        });
      }
    }
  });
}

/**
 * Warn-and-swallow handler for the non-fatal boot migrations, EXCEPT a
 * NoTenantContextError: that signals a missing ambient tenant at boot (a
 * programming/config bug, not a tolerable data hiccup), so it is logged at
 * ERROR and re-thrown to fire the fatal process.exit(1) in index.ts.
 */
function rethrowMissingTenant(label: string): (err: unknown) => void {
  return (err: unknown) => {
    if (err instanceof NoTenantContextError) {
      logger.error(`${label}: missing tenant context at startup`, { error: String(err) });
      throw err;
    }
    logger.warn(`${label}: ${String(err)}`);
  };
}

// Schema migrations are mandatory: a failure here means the server cannot serve
// any store correctly, so it is FATAL (not a warn). Everything after migrations
// is best-effort and stays non-fatal inside loadModulesAndInstances.
export async function startupSequence(): Promise<void> {
  if (hasLegacyTrustCfClientIp()) {
    console.error(
      '[narn] TRUST_CF_CLIENT_IP is set but is no longer read — it was renamed to ' +
        'TRUST_PROXY_CLIENT_IP. Proxy client-IP headers are currently NOT trusted. ' +
        'Rename the variable to restore the previous behavior.',
    );
  }
  await runMigrations(getMigrationPool()); // superuser DDL connection; falls back to DATABASE_URL if MIGRATION_DATABASE_URL unset
  await loadModulesAndInstances();
}
