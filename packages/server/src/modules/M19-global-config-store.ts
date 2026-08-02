/**
 * M19 - Global Module Config helpers + schemas
 *
 * The persistence surface (the former file-backed `GlobalConfigStore` class and
 * its `globalConfigStore` singleton) moved behind the storage seam: consumers
 * resolve the store via `getGlobalConfigStore()` (storage/registry), whose local
 * default is the Postgres `PgGlobalConfigStore`. The `GlobalConfigStore` port
 * type now lives in `storage/types.ts`.
 *
 * What remains here is I/O-free: the zod schemas (re-exported from the
 * schema-only sibling) plus the two pure helpers `findPasswordFormatKeys` and
 * `resolveEffectiveModuleConfig` that other modules (`utils/validate-module-config`,
 * `M9/module-selection`) import unchanged.
 *
 * Per-module config shape: each entry holds an `enabled` availability gate, an
 * `active` on/off toggle, and a `config` map of non-secret settings. Per-project
 * overrides live in `Project.moduleConfigs` and are resolved against the global
 * config via `resolveEffectiveModuleConfig`. Password-format keys are rejected
 * at the boundary — those credentials belong in the encrypted vault (M18).
 */
import type {
  GlobalConfig,
  GlobalModuleConfigEntry,
  ProjectModuleConfigEntry,
  ConfigSchemaField,
} from '@zercade-dev/narn-shared';
import { PSEUDO_MODULE_ID } from '@zercade-dev/narn-shared';
// Schemas live in a schema-only sibling module (it imports no I/O) so the PG
// adapter can reuse the exact same validation without dragging `utils/fs.ts`
// (and the M15 logger) into the storage registry's eager import graph — that
// edge broke logger-mocking suites (e.g. fs-utils.coverage). Re-exported here
// so M19's public schema surface is unchanged.
import { globalConfigSchema, workspaceSettingsSchema } from './M19-global-config-schema.js';

export type { GlobalModuleConfigEntry };
export { globalConfigSchema, workspaceSettingsSchema };

/**
 * Reject keys in `config` whose manifest schema field declares
 * `format: 'password'`. Returns the list of forbidden keys (empty when ok).
 */
export function findPasswordFormatKeys(
  config: Record<string, unknown>,
  configSchema: Record<string, unknown> | undefined,
): string[] {
  if (!configSchema) return [];
  const forbidden: string[] = [];
  for (const key of Object.keys(config)) {
    const field = configSchema[key] as ConfigSchemaField | undefined;
    if (field?.format === 'password') forbidden.push(key);
  }
  return forbidden;
}

/**
 * Resolve effective per-module config by merging the global entry with the
 * project entry according to the per-project `inheritGlobal` flag.
 *
 * Rules:
 * - `enabled` — availability gate: `globalEntry?.enabled === true` (default `false`).
 *   A module is available only when the global workspace has explicitly enabled it.
 * - `active`  — on/off toggle: `projectEntry?.active ?? globalEntry?.active ?? true`.
 *   Defaults `true` so that newly-added entries are switched on by default.
 * - When `projectEntry.inheritGlobal !== false`, `config` is the merged result of
 *   `globalEntry?.config` and `projectEntry?.config` (project values win), with
 *   empty-string and undefined project values excluded so they don't override globals.
 * - When `projectEntry.inheritGlobal === false`, `config` is
 *   `projectEntry?.config ?? {}` (global is ignored entirely).
 */
export function resolveEffectiveModuleConfig(
  moduleId: string,
  global: GlobalConfig,
  entry: ProjectModuleConfigEntry | undefined,
): { enabled: boolean; active: boolean; config: Record<string, unknown> } {
  const globalEntry = global.moduleConfigs[moduleId];
  const inherits = entry?.inheritGlobal !== false;
  const config = inherits
    ? {
        ...(globalEntry?.config ?? {}),
        ...Object.fromEntries(
          Object.entries(entry?.config ?? {}).filter(([, v]) => v !== undefined && v !== ''),
        ),
      }
    : (entry?.config ?? {});

  // The pseudo-localization module is a built-in QA tool: no credentials, no
  // cost, and bound one-to-one to the synthetic `pseudo-test` language by the
  // router (M7), which routes a job to it only when that language is an active
  // translation target. Its availability is therefore governed entirely by
  // whether the project translates to `pseudo-test` — there is deliberately no
  // separate enable step (it isn't even surfaced in the module config UI).
  // Force it always-on so a `pseudo-test` run never reports `module-disabled`.
  if (moduleId === PSEUDO_MODULE_ID) {
    return { enabled: true, active: true, config };
  }

  const enabled = globalEntry?.enabled === true;
  const active = entry?.active ?? globalEntry?.active ?? true;
  return { enabled, active, config };
}
