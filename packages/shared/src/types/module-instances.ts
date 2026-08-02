/**
 * Module instances — named copies of a base translation module.
 *
 * An instance id is `<baseModuleId>:<slug>` (e.g. `generic-ai:my-ollama`).
 * The slug is user-chosen at creation time and immutable; the display name is
 * freely editable. The bare base module id (e.g. `generic-ai`) keeps working
 * as the implicit default instance, so existing configs, routing rules and
 * historic `TranslationRecord.moduleId` values need no migration.
 *
 * The mechanism is base-module-agnostic: any registered base module can have
 * instances; generic-ai is simply the first user.
 */

/** Registry entry for a named module instance (stored in global-config.json). */
export interface ModuleInstance {
  /** Full id: `<baseModuleId>:<slug>`. Immutable. */
  instanceId: string;
  /** Id of the base module this instance is a copy of (e.g. `generic-ai`). */
  baseModuleId: string;
  /** Human-readable name shown in the UI. Freely editable. */
  displayName: string;
}

/** Separator between the base module id and the instance slug. */
export const MODULE_INSTANCE_SEPARATOR = ':';

/**
 * Valid instance slugs: lowercase `[a-z0-9-]`, must start and end with an
 * alphanumeric character, 1–32 characters.
 */
export const MODULE_INSTANCE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function isValidInstanceSlug(slug: string): boolean {
  return MODULE_INSTANCE_SLUG_PATTERN.test(slug);
}

/** Build the full instance id from a base module id and a slug. */
export function buildModuleInstanceId(baseModuleId: string, slug: string): string {
  return `${baseModuleId}${MODULE_INSTANCE_SEPARATOR}${slug}`;
}

/**
 * Split a module id of the form `<baseModuleId>:<slug>` into its parts.
 * Returns `null` for plain (non-instance) module ids.
 */
export function parseModuleInstanceId(
  moduleId: string,
): { baseModuleId: string; slug: string } | null {
  const idx = moduleId.indexOf(MODULE_INSTANCE_SEPARATOR);
  if (idx <= 0 || idx === moduleId.length - 1) return null;
  return { baseModuleId: moduleId.slice(0, idx), slug: moduleId.slice(idx + 1) };
}

/** True when the id has the `<base>:<slug>` instance shape. */
export function isModuleInstanceId(moduleId: string): boolean {
  return parseModuleInstanceId(moduleId) !== null;
}

/**
 * Slug of the auto-created default instance (`<base>:default`). M27's one-time
 * migration creates one per instanceable base module, and it is recreated at
 * startup if missing — so it is the base module's configuration home and must
 * NOT be user-deletable. Shared so the server route and the frontend agree on
 * which instances to protect.
 */
export const DEFAULT_INSTANCE_SLUG = 'default';

/** True when the id is a `<base>:default` instance (the protected default). */
export function isDefaultInstanceId(moduleId: string): boolean {
  return parseModuleInstanceId(moduleId)?.slug === DEFAULT_INSTANCE_SLUG;
}

/**
 * Derive the per-instance vault key for one of the base module's declared
 * `requiredEnvVars`, e.g. `GENERIC_API_KEY` + `my-ollama` →
 * `GENERIC_API_KEY__MY-OLLAMA`. The derived key still contains the base
 * credential-shaped name (`…API_KEY…`), so log redaction's key-shape pattern
 * keeps matching it.
 */
export function deriveInstanceCredentialKey(baseEnvVar: string, slug: string): string {
  return `${baseEnvVar}__${slug.toUpperCase()}`;
}
