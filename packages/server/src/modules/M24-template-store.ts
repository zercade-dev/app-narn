import type { Project, ProjectTemplateConfig } from '@zercade-dev/narn-shared';
import { withheldModuleConfigKeys } from '../utils/module-config-secrets.js';

/**
 * M24: Template config snapshot helper.
 *
 * Template persistence now lives in the storage seam (`PgTemplateStore`,
 * resolved via `getTemplateStore()`). This module retains only the pure helper
 * that builds the config-shaped snapshot of a project — the bit of template
 * logic that is about the *project*, not about storage.
 *
 * A template snapshot contains ONLY the config-shaped subset of a project
 * (see `buildTemplateConfig`): never entries/translations, runs, the project
 * id/name/timestamps, or anything secret-shaped — secrets live in the
 * credential vault, not in project JSON.
 */

/**
 * Module-config keys that are stripped from a template snapshot by NAME. These
 * carry connection/transport settings (e.g. a generic-ai `baseURL`, or an
 * `allowInsecureHttp` downgrade), or — defensively — a credential value. A
 * template is meant to be shareable, so it must not silently re-point an
 * imported project's module at a different endpoint or weaken its transport.
 * `apiKey` stays in the list as a floor even though the schema-driven pass below
 * subsumes it for every module that declares it (only deepl does).
 */
const TEMPLATE_EXCLUDED_CONFIG_KEYS = new Set(['baseURL', 'allowInsecureHttp', 'apiKey']);

/**
 * A template is an EXPORT surface — the file is downloadable and meant to be
 * shared out of band — so it is stripped with the read-side classifier
 * ({@link withheldModuleConfigKeys}): a registered module keeps everything but
 * its `format: 'password'` fields, and a module the registry cannot resolve
 * contributes no config at all (nothing there can be proven non-secret, and an
 * unregistered module's settings are already reported as `unknown-module` when
 * the template is applied).
 */
function stripSensitiveModuleConfigKeys(
  moduleId: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  const clone = structuredClone(config);
  for (const key of TEMPLATE_EXCLUDED_CONFIG_KEYS) {
    delete clone[key];
  }
  for (const key of withheldModuleConfigKeys(moduleId, clone)) {
    delete clone[key];
  }
  return clone;
}

/**
 * Builds the config-shaped snapshot of a project. Explicit field picking
 * (rather than object spread) guarantees entries, runs, ids, timestamps and
 * any future non-config fields never leak into a template.
 */
export function buildTemplateConfig(
  project: Project,
  globalGlossaryOverrides: Record<string, boolean>,
): ProjectTemplateConfig {
  const config: ProjectTemplateConfig = {
    sourceLanguage: project.sourceLanguage,
    activeLanguages: [...project.activeLanguages],
    routingRules: structuredClone(project.routingRules ?? []),
    moduleConfigs: Object.fromEntries(
      Object.entries(project.moduleConfigs ?? {}).map(([moduleId, entry]) => [
        moduleId,
        {
          active: entry.active,
          inheritGlobal: entry.inheritGlobal,
          config: stripSensitiveModuleConfigKeys(moduleId, entry.config ?? {}),
        },
      ]),
    ),
  };
  if (project.icon !== undefined) {
    config.icon = project.icon;
  }
  if (project.routingRuleGroups !== undefined) {
    config.routingRuleGroups = structuredClone(project.routingRuleGroups);
  }
  if (project.activeRoutingRuleGroupId !== undefined) {
    config.activeRoutingRuleGroupId = project.activeRoutingRuleGroupId;
  }
  if (project.forcedGlossaryIds !== undefined) {
    config.forcedGlossaryIds = [...project.forcedGlossaryIds];
  }
  if (Object.keys(globalGlossaryOverrides).length > 0) {
    config.globalGlossaryOverrides = { ...globalGlossaryOverrides };
  }
  return config;
}
