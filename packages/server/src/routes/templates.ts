import { Router } from 'express';
import { z } from 'zod';
import type {
  ProjectModuleConfigEntry,
  ProjectTemplateConfig,
  TemplateApplyWarning,
} from '@zercade-dev/narn-shared';
import { PROJECT_ICONS } from '@zercade-dev/narn-shared';
import { buildTemplateConfig } from '../modules/M24-template-store.js';
import { forbiddenModuleConfigKeys } from '../utils/module-config-secrets.js';
import {
  assertNoForbiddenConfigKeys,
  assertSafeBaseURL,
  moduleConfigBaseURLError,
} from '../utils/validate-module-config.js';
import { getGlossaryStore, getProjectStore, getTemplateStore } from '../storage/registry.js';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { languageConfig } from '../modules/M4-language-config.js';
import { validateBody } from '../middleware/validate.js';
import { assertProjectAccess } from '../middleware/authz.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { logger } from '../modules/M15-console-logger.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { routingRuleSchema, moduleConfigEntrySchema } from './projects.js';

export const templatesRouter: Router = Router();

// Validate `:projectId` (the snapshot-from-project route) against path traversal,
// 400 centrally on a hostile id. NB: the `:id` routes here carry a TEMPLATE id,
// not a project id, so only `:projectId` is guarded.
templatesRouter.param('projectId', projectIdParam);

// Bound template imports — each one parses and persists an attacker-supplied blob.
const templateImportRateLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

const templateNameSchema = z.object({
  name: z.string().min(1).max(128).trim(),
});

// Per-field caps bound a schema-valid but oversized import: even within the
// 10 MB express.json limit, unbounded arrays/records would otherwise make a
// crafted template slow to validate and apply.
const templateConfigSchema = z.object({
  icon: z.enum(PROJECT_ICONS).optional(),
  sourceLanguage: z.string().min(1),
  activeLanguages: z.array(z.string()).max(1000).default([]),
  routingRules: z.array(routingRuleSchema).max(1000).default([]),
  routingRuleGroups: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        rules: z.array(routingRuleSchema).max(1000),
      }),
    )
    .max(1000)
    .optional(),
  activeRoutingRuleGroupId: z.string().min(1).nullable().optional(),
  moduleConfigs: z.record(z.string(), moduleConfigEntrySchema).default({}),
  forcedGlossaryIds: z.array(z.string()).max(1000).optional(),
  globalGlossaryOverrides: z.record(z.string(), z.boolean()).optional(),
});

// Accepts the exported template file shape; unknown keys (id, timestamps)
// are stripped by zod so imports always get fresh identity.
const importTemplateSchema = z.object({
  name: z.string().min(1).max(128).trim(),
  config: templateConfigSchema,
});

/**
 * Collects non-fatal warnings for template references that don't resolve in
 * this workspace / the freshly created project. Unknown ids are kept on the
 * project (same posture as M9, which treats unknown module ids as routable
 * but fails them at execution) and only reported here.
 */
function collectApplyWarnings(
  config: ProjectTemplateConfig,
  knownModuleIds: Set<string>,
  knownGlossaryIds: Set<string>,
): TemplateApplyWarning[] {
  const warnings: TemplateApplyWarning[] = [];
  const seen = new Set<string>();
  const add = (code: TemplateApplyWarning['code'], subject: string, message: string) => {
    const key = `${code}:${subject}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ code, subject, message });
  };

  const allRules = [
    ...(config.routingRules ?? []),
    ...(config.routingRuleGroups ?? []).flatMap((group) => group.rules),
  ];
  for (const rule of allRules) {
    if (!knownModuleIds.has(rule.moduleId)) {
      add(
        'unknown-module',
        rule.moduleId,
        `Routing rule references unknown module "${rule.moduleId}"`,
      );
    }
  }
  for (const moduleId of Object.keys(config.moduleConfigs ?? {})) {
    if (!knownModuleIds.has(moduleId)) {
      add('unknown-module', moduleId, `Module config references unknown module "${moduleId}"`);
    }
  }
  for (const glossaryId of config.forcedGlossaryIds ?? []) {
    if (!knownGlossaryIds.has(glossaryId)) {
      add(
        'unknown-glossary',
        glossaryId,
        `Forced glossary "${glossaryId}" does not exist in the new project`,
      );
    }
  }
  for (const glossaryId of Object.keys(config.globalGlossaryOverrides ?? {})) {
    if (!knownGlossaryIds.has(glossaryId)) {
      add(
        'unknown-glossary',
        glossaryId,
        `Glossary override references unknown glossary "${glossaryId}"`,
      );
    }
  }
  return warnings;
}

/**
 * Apply-time sanitation of a STORED template's module configs.
 *
 * `POST /:id/apply` writes `config.moduleConfigs` straight into a new project
 * through `updateProject`, bypassing the per-module PUT's guards — so this is a
 * module-config WRITE path in its own right. Import now rejects a hostile
 * payload up front (below) and `buildTemplateConfig` strips secrets and
 * transport keys at snapshot time, which leaves exactly one way for a bad key to
 * reach here: a template PERSISTED BEFORE those guards existed. Stripping, not
 * 400ing, is the right call for that: the row is already stored and the user has
 * no way to edit a template in place, so rejecting would strand it permanently
 * while stripping still produces the project they asked for, minus a value that
 * was never supposed to be there. Credential-class keys use the write-side
 * classifier (`forbiddenModuleConfigKeys`, which fails closed on an unregistered
 * module id); an unsafe `baseURL` is dropped alongside its `allowInsecureHttp`
 * opt-in so the module falls back to its built-in endpoint rather than an
 * attacker-chosen one. Both are logged by key name only — never by value.
 */
function sanitizeTemplateModuleConfigs(moduleConfigs: Record<string, ProjectModuleConfigEntry>): {
  sanitized: Record<string, ProjectModuleConfigEntry>;
  stripped: string[];
} {
  const sanitized: Record<string, ProjectModuleConfigEntry> = {};
  const stripped: string[] = [];
  for (const [moduleId, entry] of Object.entries(moduleConfigs)) {
    const config = (entry?.config ?? {}) as Record<string, unknown>;
    const drop = new Set(forbiddenModuleConfigKeys(moduleId, config));
    if (moduleConfigBaseURLError(config)) {
      drop.add('baseURL');
      drop.add('allowInsecureHttp');
    }
    if (drop.size === 0) {
      sanitized[moduleId] = entry;
      continue;
    }
    for (const key of drop) if (key in config) stripped.push(`${moduleId}.${key}`);
    sanitized[moduleId] = {
      ...entry,
      config: Object.fromEntries(
        Object.entries(config).filter(([key]) => !drop.has(key)),
      ) as ProjectModuleConfigEntry['config'],
    };
  }
  return { sanitized, stripped };
}

// GET /api/templates
templatesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const templates = await getTemplateStore().listTemplates();
    res.json({ templates });
  }),
);

// POST /api/templates/from-project/:projectId — snapshot a project as a template
templatesRouter.post(
  '/from-project/:projectId',
  requireUnlockedVault,
  validateBody(templateNameSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    const { name } = req.body as z.infer<typeof templateNameSchema>;
    // Snapshotting a project's whole configuration (routing rules, module
    // configs, glossary overrides) is a manage-shaped action, so gate it the way
    // every other manage action does rather than relying on RLS membership
    // alone — a read-only collaborator could otherwise lift the owner's entire
    // project configuration into a template of their own. Non-member → 404 (no
    // existence leak); member without `manage` → 403.
    await assertProjectAccess(projectId, { type: 'manage' });
    const project = await getProjectStore().loadProject(projectId);
    const overrides = await getGlossaryStore().getEnabledOverrides(projectId);
    const config = buildTemplateConfig(project, overrides);
    const template = await getTemplateStore().createTemplate(name, config);
    logger.info('Template saved from project', { projectId, templateId: template.id, name });
    res.status(201).json(template);
  }),
);

// POST /api/templates/import — upload a previously exported template JSON
templatesRouter.post(
  '/import',
  requireUnlockedVault,
  templateImportRateLimiter,
  validateBody(importTemplateSchema),
  asyncHandler(async (req, res) => {
    const { name, config } = req.body as z.infer<typeof importTemplateSchema>;
    // An imported template is a fully attacker-supplied blob whose
    // `moduleConfigs` are later written verbatim into a project by `/:id/apply`
    // — the same shape the bulk project PUT guards, so it gets the same
    // treatment. REJECT rather than strip here: import is a fresh authoring
    // action on a file the user still holds, so a 400 naming the offending
    // fields is actionable (fix the file, re-import) and refuses to persist a
    // credential that, silently stripped, would look like it had been accepted.
    // A credential in a shared template file is most likely someone else's key.
    for (const [moduleId, entry] of Object.entries(config.moduleConfigs ?? {})) {
      const entryConfig = (entry?.config ?? {}) as Record<string, unknown>;
      if (
        !assertNoForbiddenConfigKeys(
          res,
          forbiddenModuleConfigKeys(moduleId, entryConfig),
          'project config',
        )
      )
        return;
      // SSRF: apply() persists these configs without re-validating, so a crafted
      // template could otherwise plant a link-local/metadata `baseURL` that
      // receives the vault credential on the project's first run.
      if (!assertSafeBaseURL(res, entryConfig)) return;
    }
    const template = await getTemplateStore().createTemplate(name, config);
    logger.info('Template imported', { templateId: template.id, name });
    res.status(201).json(template);
  }),
);

// GET /api/templates/:id/export — download a template as a JSON file
templatesRouter.get(
  '/:id/export',
  asyncHandler(async (req, res) => {
    const template = await getTemplateStore().getTemplate(req.params.id as string);
    res.setHeader('Content-Disposition', `attachment; filename="${template.id}.json"`);
    res.json(template);
  }),
);

// POST /api/templates/:id/apply — create a new project from a template
templatesRouter.post(
  '/:id/apply',
  requireUnlockedVault,
  validateBody(templateNameSchema),
  asyncHandler(async (req, res) => {
    const template = await getTemplateStore().getTemplate(req.params.id as string);
    const { name } = req.body as z.infer<typeof templateNameSchema>;
    const { config } = template;

    try {
      languageConfig.validateCode(config.sourceLanguage);
      for (const code of config.activeLanguages) languageConfig.validateCode(code);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }

    const created = await getProjectStore().createProject(
      name,
      config.sourceLanguage,
      config.activeLanguages,
      config.icon,
    );
    // Match the regular creation flow: every new project gets a Default glossary.
    try {
      await getGlossaryStore().createGlossary(created.id, 'Default');
    } catch {
      // Non-fatal: glossary creation failure should not block project creation
    }

    const { sanitized, stripped } = sanitizeTemplateModuleConfigs(config.moduleConfigs ?? {});
    if (stripped.length > 0) {
      logger.warn('Template apply: dropped unsafe module config keys', {
        templateId: template.id,
        keys: stripped,
      });
    }
    const project = await getProjectStore().updateProject(created.id, {
      routingRules: config.routingRules,
      routingRuleGroups: config.routingRuleGroups,
      activeRoutingRuleGroupId: config.activeRoutingRuleGroupId,
      moduleConfigs: sanitized,
      forcedGlossaryIds: config.forcedGlossaryIds,
    });
    if (config.globalGlossaryOverrides) {
      await getGlossaryStore().setEnabledOverrides(created.id, config.globalGlossaryOverrides);
    }

    const knownModuleIds = new Set(moduleRegistry.listModules().map((m) => m.id));
    const glossaries = await getGlossaryStore().listGlossaries(created.id);
    const knownGlossaryIds = new Set(glossaries.map((g) => g.id));
    const warnings = collectApplyWarnings(config, knownModuleIds, knownGlossaryIds);

    logger.info('Project created from template', {
      templateId: template.id,
      projectId: project.id,
      warnings: warnings.length,
    });
    res.status(201).json({ project, warnings });
  }),
);

// DELETE /api/templates/:id
templatesRouter.delete(
  '/:id',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    await getTemplateStore().deleteTemplate(req.params.id as string);
    logger.info('Template deleted', { templateId: req.params.id });
    res.status(204).send();
  }),
);
