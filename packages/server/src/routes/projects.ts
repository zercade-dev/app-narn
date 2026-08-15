import { Router } from 'express';
import { z } from 'zod';
import {
  getGlossaryStore,
  getMemberStore,
  getProjectStore,
  getRunStore,
} from '../storage/registry.js';
import { languageConfig } from '../modules/M4-language-config.js';
import { validateBody } from '../middleware/validate.js';
import { assertSafeBaseURL, assertNoForbiddenConfigKeys } from '../utils/validate-module-config.js';
import {
  forbiddenModuleConfigKeys,
  mergeStoredModuleConfigSecrets,
  redactModuleConfigSecrets,
} from '../utils/module-config-secrets.js';
import { assertProjectAccess } from '../middleware/authz.js';
import { logger } from '../modules/M15-console-logger.js';
import { translationEngine } from '../modules/M9-translation-engine.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { reviewOrderService } from '../modules/review-order.js';
import { requireTenant } from '../storage/pg/tenant-context.js';
import { PROJECT_ICONS, BATCH_GROUPING_DIMENSIONS } from '@zercade-dev/narn-shared';

export const projectsRouter: Router = Router();

// Validate the project id against path traversal for every route below (400
// centrally on a hostile id). Both param names are used: most routes use `:id`,
// the review-order routes use `:projectId`. Handlers then read the pre-validated
// value directly.
projectsRouter.param('id', projectIdParam);
projectsRouter.param('projectId', projectIdParam);

/** Exported for unit tests (icon enum validation). */
export const createProjectSchema = z.object({
  name: z.string().min(1).max(128).trim(),
  sourceLanguage: z.string().min(1),
  activeLanguages: z.array(z.string()).default([]),
  /** Cosmetic icon from the curated set; arbitrary strings are rejected. */
  icon: z.enum(PROJECT_ICONS).optional(),
});

const promptOptionsSchema = z
  .object({
    character: z.string().optional(),
    tone: z.string().optional(),
    gender: z.string().optional(),
    notes: z.string().optional(),
  })
  .optional();

/** Shared with the templates router (template snapshots store routing rules). */
export const routingRuleSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  sources: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  tones: z.array(z.string()).optional(),
  achievementTypes: z.array(z.enum(['name', 'description'])).optional(),
  targetLanguages: z.array(z.string()).optional(),
  targetLanguage: z.string().optional(),
  maxLength: z.number().int().nonnegative().optional(),
  moduleId: z.string(),
  priority: z.number(),
  promptOptions: promptOptionsSchema,
  modelOverride: z.string().optional(),
  reasoningEffortOverride: z.enum(['low', 'medium', 'high', 'xhigh', 'disabled']).optional(),
});

/** Shared with the templates router (template snapshots store module configs). */
export const moduleConfigEntrySchema = z.object({
  config: z.record(z.string(), z.unknown()),
  active: z.boolean().optional(),
  inheritGlobal: z.boolean(),
});

const lqaCheckConfigSchema = z.object({
  enabled: z.boolean().optional(),
  severity: z.enum(['blocking', 'warning']).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const lqaConfigSchema = z.object({
  checks: z.record(z.string(), lqaCheckConfigSchema).optional(),
});

// Exported so its shape can be tested directly (schema-only, no Express/mocking) —
// its shape is kept in parity with Project by a schema-parity test.
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(128).trim().optional(),
  icon: z.enum(PROJECT_ICONS).optional(),
  /** LLM-as-judge settings for AI review runs (absent = cheapest module). */
  judgeConfig: z
    .object({
      moduleId: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      reasoningEffort: z.string().min(1).optional(),
    })
    .optional(),
  /** Last-used source-review selection (absent = cheapest review-capable module). */
  sourceReviewConfig: z
    .object({
      moduleId: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      reasoningEffort: z.string().min(1).optional(),
    })
    .optional(),
  routingRules: z.array(routingRuleSchema).optional(),
  moduleConfigs: z.record(z.string(), moduleConfigEntrySchema).optional(),
  forcedGlossaryIds: z.array(z.string()).optional(),
  lqaConfig: lqaConfigSchema.optional(),
  tmPolicy: z.enum(['strict', 'relaxed', 'source-only', 'disabled']).optional(),
  /** Per-project override for related-entry batch grouping (absent/null = inherit workspace). */
  batchGrouping: z.enum(BATCH_GROUPING_DIMENSIONS).nullable().optional(),
  /** Per-project override for the ignore-batch-size-limit toggle (absent/null = inherit workspace). */
  ignoreBatchSizeLimit: z.boolean().nullable().optional(),
  /** Per-category descriptions, keyed by category name (max 500 chars each). */
  categoryDescriptions: z.record(z.string(), z.string().max(500)).optional(),
});

const languagesSchema = z.object({
  activeLanguages: z.array(z.string()),
  sourceLanguage: z.string().optional(),
});

// GET /api/projects
projectsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const projects = await getProjectStore().listProjects();
    const activeId = await getProjectStore().getActiveProjectId();
    // Collaboration access map: the caller's own membership rows give
    // role + writable languages; a member count > 1 on an owned project marks
    // it "currently shared", widened by run HISTORY below — a project stays
    // `sharedEver` once any run was ever created by someone else, even after
    // every other member has since left (current membership count alone would
    // wrongly flip back to false).
    const memberships = await getMemberStore().listMyMemberships();
    const byProject = new Map(memberships.map((m) => [m.projectId, m]));
    const counts = await getMemberStore().countMembersByProject();
    const foreignRunProjects = new Set(await getRunStore().listProjectsWithForeignRuns());
    const access = Object.fromEntries(
      projects.map((p) => {
        const m = byProject.get(p.id);
        const role = m?.role ?? 'owner';
        return [
          p.id,
          {
            role,
            writableLanguages: m?.writableLanguages ?? [],
            sharedEver:
              role === 'owner' && ((counts[p.id] ?? 1) > 1 || foreignRunProjects.has(p.id)),
          },
        ];
      }),
    );
    const selfUserId = requireTenant().userId;
    // Strip `format: 'password'` module-config values before serializing: this
    // list is visible to every MEMBER of a project (RLS), including read-only
    // collaborators, and a legacy project row can still hold a credential under
    // such a key. See utils/module-config-secrets.ts.
    res.json({
      projects: projects.map((p) => redactModuleConfigSecrets(p)),
      activeId,
      access,
      selfUserId,
    });
  }),
);

// POST /api/projects
projectsRouter.post(
  '/',
  requireUnlockedVault,
  validateBody(createProjectSchema),
  asyncHandler(async (req, res) => {
    const { name, sourceLanguage, activeLanguages, icon } = req.body as z.infer<
      typeof createProjectSchema
    >;
    try {
      languageConfig.validateCode(sourceLanguage);
      for (const code of activeLanguages) languageConfig.validateCode(code);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
      return;
    }
    const project = await getProjectStore().createProject(
      name,
      sourceLanguage,
      activeLanguages,
      icon,
    );
    // Auto-create a Default glossary folder for every new project
    try {
      await getGlossaryStore().createGlossary(project.id, 'Default');
    } catch {
      // Non-fatal: glossary creation failure should not block project creation
    }
    logger.info('Project created', { projectId: project.id, name });
    res.status(201).json(project);
  }),
);

// GET /api/projects/:id
projectsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const project = await getProjectStore().loadProject(projectId);
    // Same redaction as the list route: membership RLS alone decides visibility
    // here, so a read-only collaborator must not receive the owner's legacy
    // password-format module config.
    res.json(redactModuleConfigSecrets(project));
  }),
);

// PUT /api/projects/:id
projectsRouter.put(
  '/:id',
  requireUnlockedVault,
  validateBody(updateProjectSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const body = req.body as z.infer<typeof updateProjectSchema>;
    for (const [moduleId, entry] of Object.entries(body.moduleConfigs ?? {})) {
      // Credential hygiene: password-format keys belong in the vault, never in
      // project config. This bulk route was the only module-config write path
      // missing the guard its two siblings apply (routes/modules.ts,
      // routes/global-config.ts) — same 400 shape and message, resolved per
      // entry because this route writes a MAP of module ids. Unlike those
      // siblings the id here is NOT registry-checked (an unknown module id is a
      // legal, warned-about state on a project), so the classifier fails closed
      // on a schema miss instead of waving the entry through.
      if (
        !assertNoForbiddenConfigKeys(
          res,
          forbiddenModuleConfigKeys(moduleId, entry.config),
          'project config',
        )
      )
        return;
      // SSRF: a bulk project update can set a module's baseURL (its `config` is an open
      // record). Validate each before persisting so an imported/scripted PUT can't plant
      // a link-local/metadata endpoint that would later receive the vault credential.
      if (!assertSafeBaseURL(res, entry.config)) return;
    }
    // `updateProject` replaces `moduleConfigs` wholesale, and the read paths now
    // redact password-format values — so a GET → edit → PUT round-trip would
    // otherwise ERASE a legacy stored credential the client never saw. Carry the
    // persisted values forward for the entries this request re-sends; combined
    // with the guard above the route is password-key-neutral (it can neither set
    // nor clear them).
    const update = body.moduleConfigs
      ? {
          ...body,
          moduleConfigs: mergeStoredModuleConfigSecrets(
            (await getProjectStore().loadProject(projectId)).moduleConfigs,
            body.moduleConfigs,
          ),
        }
      : body;
    const updated = await getProjectStore().updateProject(projectId, update);
    res.json(redactModuleConfigSecrets(updated));
  }),
);

// POST /api/projects/:id/duplicate
projectsRouter.post(
  '/:id/duplicate',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const duplicate = await getProjectStore().duplicateProject(projectId);
    logger.info('Project duplicated', { sourceId: req.params.id, newId: duplicate.id });
    res.status(201).json(redactModuleConfigSecrets(duplicate));
  }),
);

// DELETE /api/projects/:id
projectsRouter.delete(
  '/:id',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    await getProjectStore().deleteProject(projectId);
    logger.info('Project deleted', { projectId: req.params.id });
    res.status(204).send();
  }),
);

// POST /api/projects/:id/activate
projectsRouter.post(
  '/:id/activate',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    // `switchProject` only writes the caller's own `active_project` pointer
    // (per-tenant, i.e. per-user) — it touches no shared project data, so a
    // collaborator switching to a project they're a member of needs plain
    // membership, not the owner-only `manage` capability the other mutating
    // routes on this router require.
    await assertProjectAccess(projectId, { type: 'read' });
    await getProjectStore().switchProject(projectId);
    res.json({ activeId: req.params.id });
  }),
);

// PUT /api/projects/:id/languages
projectsRouter.put(
  '/:id/languages',
  requireUnlockedVault,
  validateBody(languagesSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { activeLanguages, sourceLanguage } = req.body as z.infer<typeof languagesSchema>;
    const filteredActiveLanguages = sourceLanguage
      ? activeLanguages.filter((l: string) => l !== sourceLanguage)
      : activeLanguages;
    await languageConfig.setActiveLanguages(projectId, filteredActiveLanguages);
    if (sourceLanguage) {
      await languageConfig.setSourceLanguage(projectId, sourceLanguage);
    }
    const project = await getProjectStore().loadProject(projectId);
    res.json(redactModuleConfigSecrets(project));
  }),
);

const manualEditAuditSchema = z.object({ enabled: z.boolean() });

// PATCH /api/projects/:id/manual-edit-audit — owner-only toggle for the
// manual-edit-audit feature (records manual text edits made through the
// string write path on a shared project). Not vault-gated: it flips a
// project setting, not a credential-touching mutation.
projectsRouter.patch(
  '/:id/manual-edit-audit',
  validateBody(manualEditAuditSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { enabled } = req.body as z.infer<typeof manualEditAuditSchema>;
    await getProjectStore().updateProject(projectId, { manualEditAuditEnabled: enabled });
    res.json({ enabled });
  }),
);

// GET /api/projects/registry/languages
projectsRouter.get('/registry/languages', (_req, res) => {
  res.json(languageConfig.getRegistry());
});

// Also reused verbatim by routes/collab-routing.ts (per-user collab routing)
// — exported so that route imports it rather than duplicating the schema.
export const routingRulesBodySchema = z.object({
  rules: z.array(routingRuleSchema),
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        rules: z.array(routingRuleSchema),
      }),
    )
    .optional(),
  activeGroupId: z.string().min(1).optional(),
});

// PUT /api/projects/:id/routing-rules
projectsRouter.put(
  '/:id/routing-rules',
  requireUnlockedVault,
  validateBody(routingRulesBodySchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const { rules, groups, activeGroupId } = req.body as z.infer<typeof routingRulesBodySchema>;
    const current = await getProjectStore().loadProject(projectId);
    const requestedActiveGroupId = activeGroupId ?? current.activeRoutingRuleGroupId ?? null;
    const switchingActiveGroup =
      requestedActiveGroupId !== null &&
      requestedActiveGroupId !== current.activeRoutingRuleGroupId;
    if (switchingActiveGroup && translationEngine.hasInProgressProjectRun(projectId)) {
      res.status(409).json({
        error: 'routing-group-switch-blocked',
        message: 'Cannot switch routing group while translations are in progress.',
      });
      return;
    }

    const rulesToPersist =
      groups && requestedActiveGroupId
        ? (groups.find((group) => group.id === requestedActiveGroupId)?.rules ?? [])
        : rules;
    const updated = await getProjectStore().updateProject(projectId, {
      routingRules: rulesToPersist,
      routingRuleGroups: groups,
      activeRoutingRuleGroupId: requestedActiveGroupId,
    });
    logger.info('Routing rules updated', {
      projectId: req.params.id,
      count: rulesToPersist.length,
      groups: groups?.length,
      activeGroupId: requestedActiveGroupId,
    });
    res.json(redactModuleConfigSecrets(updated));
  }),
);

// POST /api/projects/:id/review-order/compute
// Runs the local word-similarity pre-sort: writes a reviewSortIndex onto every
// entry (mutates strings.json) and records a "last sorted" sidecar.
projectsRouter.post(
  '/:projectId/review-order/compute',
  requireUnlockedVault,
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    const result = await reviewOrderService.computeAndPersist(projectId, Date.now());
    logger.info('Review order computed', { projectId, count: result.count });
    res.json(result);
  }),
);

// GET /api/projects/:id/review-order
// Returns the "last sorted" meta, or { computed: false } when never pre-sorted.
projectsRouter.get(
  '/:projectId/review-order',
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    await getProjectStore().loadProject(projectId); // 404 when the project is missing
    const meta = await reviewOrderService.loadMeta(projectId);
    if (!meta) {
      res.json({ computed: false });
      return;
    }
    res.json(meta);
  }),
);
