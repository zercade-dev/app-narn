/**
 * Password-format hygiene for per-project `moduleConfigs`.
 *
 * Module credentials belong in the encrypted vault (M18), never in project or
 * global config — every module-config WRITE path enforces that with
 * `assertNoPasswordFields`. Two things still needed closing:
 *
 *  1. The project READ paths (`GET /api/projects`, `GET /api/projects/:id`)
 *     serialized `moduleConfigs` verbatim. Visibility there is decided solely by
 *     the `projects` RLS membership policy, so any member — including a
 *     read-only `collaborator` with `writableLanguages: []` — received whatever
 *     a LEGACY project row still holds under a `format: 'password'` key (e.g.
 *     deepl's `apiKey`, which `resolveApiKey()` reads from config before falling
 *     back to the vault). {@link redactModuleConfigSecrets} strips those keys on
 *     the way out.
 *  2. The bulk `PUT /api/projects/:id` replaces `moduleConfigs` wholesale, so a
 *     GET→edit→PUT round-trip of a now-redacted payload would silently ERASE a
 *     legacy stored value. {@link mergeStoredModuleConfigSecrets} carries the
 *     persisted password-format values forward for every entry the request
 *     re-sends. Combined with the route's `assertNoPasswordFields` guard, the
 *     bulk PUT becomes password-key-NEUTRAL: it can neither set nor clear them.
 *
 * Redaction removes the key rather than substituting a sentinel: a sentinel
 * would render as a real value in the config UI's password input and, echoed
 * back by any client unaware of it, risks being persisted as a literal. An
 * absent key is unambiguous, matches what the frontend already sends (it strips
 * password fields before every save — `ModuleSettingsPanel`), and degrades to
 * the schema default in the UI.
 *
 * Redaction is applied to EVERY caller, owner included — no HTTP read surface
 * needs to emit a vault-class secret, and a role-conditional response shape
 * would have to branch per project inside the list route while still leaking on
 * owned ones. Server-internal reads (`loadProject` in M9/M5/M31/deepl) are
 * untouched: this operates only on the outbound HTTP copy.
 */
import { parseModuleInstanceId } from '@zercade-dev/narn-shared';
import type { ProjectModuleConfigEntry } from '@zercade-dev/narn-shared';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { findPasswordFormatKeys } from '../modules/M19-global-config-store.js';

/** Any object carrying a project-shaped `moduleConfigs` map. */
type WithModuleConfigs = { moduleConfigs?: Record<string, ProjectModuleConfigEntry> };

/**
 * Manifest config schema backing a `moduleConfigs` key — the single classifier
 * both the read (redaction) and write (`assertNoPasswordFields`) sides use, so
 * they can never disagree about which keys are secrets.
 *
 * Resolves named instances (`<base>:<slug>`) through the registry and, when the
 * instance is not registered in this process/tenant, falls back to the BASE
 * module's schema — an instance always inherits its base's config schema, so
 * the fallback keeps classification working for a stored entry whose instance
 * row hasn't been loaded. An id that resolves to nothing yields `undefined` —
 * which is NOT "no secrets here": see {@link withheldModuleConfigKeys} and
 * {@link forbiddenModuleConfigKeys} for how each side fails closed on it.
 */
export function moduleConfigSchemaFor(moduleId: string): Record<string, unknown> | undefined {
  const direct = moduleRegistry.getMetadata(moduleId)?.configSchema;
  if (direct) return direct;
  const base = parseModuleInstanceId(moduleId)?.baseModuleId;
  return base ? moduleRegistry.getMetadata(base)?.configSchema : undefined;
}

/**
 * Credential-shaped key names, matched as a SUFFIX of the normalized
 * (lower-cased, non-alphanumerics removed) key. Suffix rather than substring so
 * `maxTokens` / `tokensPerMinute` don't collide with `authToken`, and so the
 * list stays short: `key` covers apiKey/licenseKey/subscriptionKey, `secret`
 * covers clientSecret, `token` covers access/auth/apiToken.
 */
const CREDENTIAL_KEY_SUFFIXES = [
  'key',
  'secret',
  'token',
  'password',
  'passwd',
  'credential',
  'credentials',
  'authorization',
];

/**
 * Name-only credential heuristic — the SECONDARY classifier, reachable only
 * when {@link moduleConfigSchemaFor} resolves nothing.
 *
 * The schema (`format: 'password'`) stays the single source of truth for every
 * registered module, so the two classifiers cannot drift on any config a real
 * module actually reads. This exists purely so an UNREGISTERED module id — a
 * removed module, an instance whose base is gone, a wholly invented id in an
 * imported/restored blob — cannot be used as a hole through which a
 * credential-shaped value is written into project config.
 */
function looksLikeCredentialKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return CREDENTIAL_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Keys of `config` that must NOT be emitted on a read/export surface for
 * `moduleId` — the read-side classifier.
 *
 * Registered module → exactly its `format: 'password'` keys (schema-driven, no
 * over-redaction: the config UI keeps every non-secret field).
 *
 * UNRESOLVABLE module → EVERY key. Nothing can be *proven* non-secret without a
 * schema, and a security control that silently no-ops on a lookup miss is the
 * wrong default; the name heuristic is deliberately not used here because a
 * whole-config withhold is strictly stronger and costs nothing visible — a
 * module absent from the registry is also absent from `GET /api/modules`, so no
 * client has a schema to render a form from anyway. The paired carry-forward in
 * {@link mergeStoredModuleConfigSecrets} uses this SAME function, so a withheld
 * config is restored verbatim on write-back and a GET→PUT round-trip cannot
 * erase it (the consequence being that the bulk PUT can neither read nor edit an
 * unresolvable module's config — fail-closed in both directions).
 */
export function withheldModuleConfigKeys(
  moduleId: string,
  config: Record<string, unknown>,
): string[] {
  const schema = moduleConfigSchemaFor(moduleId);
  if (!schema) return Object.keys(config);
  return findPasswordFormatKeys(config, schema);
}

/**
 * Keys of `config` a WRITE path must refuse for `moduleId` — the write-side
 * classifier, shared by the bulk project PUT, template import/apply and backup
 * restore.
 *
 * Registered module → its `format: 'password'` keys (identical to the guard the
 * per-module PUT already applies). UNRESOLVABLE module → the name heuristic
 * ({@link looksLikeCredentialKey}), NOT every key: an unknown module id is an
 * explicitly supported state on the write side (`collectApplyWarnings` keeps
 * unknown module configs on the project and only warns), so refusing its whole
 * config would break legitimate edits/restores of projects that carry one. The
 * narrower rule still closes the smuggling hole, and whatever slips past a
 * name check is contained on the way out by {@link withheldModuleConfigKeys}.
 */
export function forbiddenModuleConfigKeys(
  moduleId: string,
  config: Record<string, unknown>,
): string[] {
  const schema = moduleConfigSchemaFor(moduleId);
  if (schema) return findPasswordFormatKeys(config, schema);
  return Object.keys(config).filter(looksLikeCredentialKey);
}

/**
 * Outbound copy of `project` with every {@link withheldModuleConfigKeys} key
 * removed from each `moduleConfigs` entry's `config` — the entry's
 * `format: 'password'` keys for a registered module, its whole `config` for one
 * the registry cannot resolve. Returns the input unchanged (same reference) when
 * there is nothing to strip, so the common case allocates nothing.
 */
export function redactModuleConfigSecrets<T extends WithModuleConfigs>(project: T): T {
  const moduleConfigs = project.moduleConfigs;
  if (!moduleConfigs) return project;
  const redacted: Record<string, ProjectModuleConfigEntry> = {};
  let changed = false;
  for (const [moduleId, entry] of Object.entries(moduleConfigs)) {
    const config = entry?.config as Record<string, unknown> | undefined;
    const secrets = config ? withheldModuleConfigKeys(moduleId, config) : [];
    if (!config || secrets.length === 0) {
      redacted[moduleId] = entry;
      continue;
    }
    changed = true;
    redacted[moduleId] = {
      ...entry,
      config: Object.fromEntries(
        Object.entries(config).filter(([key]) => !secrets.includes(key)),
      ) as ProjectModuleConfigEntry['config'],
    };
  }
  return changed ? { ...project, moduleConfigs: redacted } : project;
}

/**
 * Carry persisted WITHHELD values forward into an incoming bulk-update
 * `moduleConfigs` map — the exact inverse of {@link redactModuleConfigSecrets},
 * computed from the same {@link withheldModuleConfigKeys}, so anything a read
 * refused to show is anything a write refuses to lose. Only keys already stored
 * are re-added, and only for module ids the request itself sends (an entry the
 * request omits is dropped by the store's wholesale replace, exactly as before).
 * The request can never supply such a key itself — the route rejects that with
 * 400 — so this cannot launder a client value into storage; it only prevents a
 * redacted GET→PUT round-trip from erasing what the owner already had.
 */
export function mergeStoredModuleConfigSecrets(
  stored: Record<string, ProjectModuleConfigEntry> | undefined,
  incoming: Record<string, ProjectModuleConfigEntry>,
): Record<string, ProjectModuleConfigEntry> {
  if (!stored) return incoming;
  const merged: Record<string, ProjectModuleConfigEntry> = {};
  for (const [moduleId, entry] of Object.entries(incoming)) {
    const storedConfig = stored[moduleId]?.config as Record<string, unknown> | undefined;
    const secrets = storedConfig ? withheldModuleConfigKeys(moduleId, storedConfig) : [];
    if (secrets.length === 0) {
      merged[moduleId] = entry;
      continue;
    }
    merged[moduleId] = {
      ...entry,
      config: {
        ...entry.config,
        ...Object.fromEntries(secrets.map((key) => [key, storedConfig![key]])),
      } as ProjectModuleConfigEntry['config'],
    };
  }
  return merged;
}
