/**
 * /api/global-config routes
 *
 * GET    /api/global-config            - return stored GlobalConfig
 * PUT    /api/global-config/:moduleId  - upsert a module's enabled/config
 *
 * Module instances (named copies of a base module, id `<base>:<slug>`):
 * GET    /api/global-config/instances               - list instances
 * POST   /api/global-config/instances               - create an instance
 * PATCH  /api/global-config/instances/:instanceId   - rename (displayName only)
 * DELETE /api/global-config/instances/:instanceId   - delete an instance
 *
 * `enabled` is the global-only availability gate (makes the module visible
 * in project config UIs when true). `active` is the on/off flag that controls
 * whether the module participates in translation jobs.
 *
 * The `inheritGlobal` flag is project-only and is ignored if present in
 * PUT bodies. Config values for fields whose manifest declares
 * `format: 'password'` are rejected with HTTP 400 - those secrets belong in
 * the encrypted vault.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ModuleInstance, WorkspaceSettings } from '@zercade-dev/narn-shared';
import {
  buildModuleInstanceId,
  isDefaultInstanceId,
  isValidInstanceSlug,
  parseModuleInstanceId,
  BATCH_GROUPING_DIMENSIONS,
} from '@zercade-dev/narn-shared';
import { validateBody } from '../middleware/validate.js';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { ModuleNotFoundError } from '../types/errors.js';
import { getGlobalConfigStore, getProjectStore } from '../storage/registry.js';
import { isCloudMode } from '../identity/registry.js';
import { logger } from '../modules/M15-console-logger.js';
import { asyncHandler } from '../http/index.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { assertSafeBaseURL, assertNoPasswordFields } from '../utils/validate-module-config.js';

export const globalConfigRouter: Router = Router();

// Bound module-instance creation so it cannot be used to spam the config store.
const instanceCreateRateLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

const updateBodySchema = z.object({
  enabled: z.boolean().optional(),
  active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()),
});

// Comfortably above NARN's current ~10 Freeway-eligible base modules (with
// room for new ones) — bounds the map without constraining real usage; a
// legitimate workspace never approaches this.
const MAX_FREEWAY_INSTANCE_OVERRIDES = 64;

// Each value must have the `<baseModuleId>:<slug>` shape freewayCandidateIds
// expects — anything else already falls through as inert there (a
// non-instance-shaped override never matches a candidate and the automatic
// order takes over), so rejecting it here is a payload-hygiene bound on the
// settings blob, not a behavior change.
const freewayInstanceOverrideValueSchema = z.string().refine(
  (value) => {
    const parsed = parseModuleInstanceId(value);
    return parsed !== null && parsed.baseModuleId.length > 0 && isValidInstanceSlug(parsed.slug);
  },
  { message: 'must be a "<module>:<instance>" module-instance id' },
);

const settingsBodySchema = z.object({
  maxBackupsPerProject: z.number().int().min(1).optional(),
  overflowRatio: z.number().positive().nullable().optional(),
  requestsPerSecond: z.number().min(0).nullable().optional(),
  batchGrouping: z.enum(BATCH_GROUPING_DIMENSIONS).optional(),
  ignoreBatchSizeLimit: z.boolean().optional(),
  requestTimeoutMs: z.number().int().min(1000).nullable().optional(),
  // 0 = unlimited (omit the per-request cap; see core.ts DEFAULT_MAX_OUTPUT_TOKENS).
  maxOutputTokens: z.number().int().min(0).max(200000).nullable().optional(),
  // Base module id -> instance id. null clears the whole map, matching the
  // other nullable settings fields above. Bounded (key count + value shape)
  // so a tenant can't persist arbitrary junk into their settings blob.
  freewayInstanceOverrides: z
    .record(z.string().min(1).max(64), freewayInstanceOverrideValueSchema)
    .refine((map) => Object.keys(map).length <= MAX_FREEWAY_INSTANCE_OVERRIDES, {
      message: `freewayInstanceOverrides may not exceed ${MAX_FREEWAY_INSTANCE_OVERRIDES} entries`,
    })
    .nullable()
    .optional(),
});

globalConfigRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cfg = await getGlobalConfigStore().load();
    res.json(cfg);
  }),
);

// GET /api/global-config/settings — return workspace-wide settings
globalConfigRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const settings = await getGlobalConfigStore().getSettings();
    res.json(settings);
  }),
);

// PUT /api/global-config/settings — update workspace-wide settings
globalConfigRouter.put(
  '/settings',
  validateBody(settingsBodySchema),
  asyncHandler(async (req, res) => {
    const body = { ...(req.body as z.infer<typeof settingsBodySchema>) };
    // Cloud: backup retention is env-only (see resolveMaxBackupsPerProject) — never
    // accept maxBackupsPerProject from the client, even via a crafted request body.
    if (isCloudMode()) delete body.maxBackupsPerProject;
    // Cast: the four nullable fields carry null to signal "clear this setting";
    // updateSettings handles null by deleting the key (see pg-global-config-store).
    const updated = await getGlobalConfigStore().updateSettings(
      body as unknown as Partial<WorkspaceSettings>,
    );
    logger.info('global-config:settings-updated', { settings: body });
    res.json(updated.settings ?? {});
  }),
);

const createInstanceBodySchema = z.object({
  baseModuleId: z.string().min(1),
  slug: z.string().min(1),
  displayName: z.string().optional(),
});

const renameInstanceBodySchema = z.object({
  displayName: z.string().min(1),
});

// GET /api/global-config/instances — list named module instances
globalConfigRouter.get(
  '/instances',
  asyncHandler(async (_req, res) => {
    const instances = await getGlobalConfigStore().listModuleInstances();
    res.json({ instances });
  }),
);

// POST /api/global-config/instances — create a named module instance
globalConfigRouter.post(
  '/instances',
  instanceCreateRateLimiter,
  validateBody(createInstanceBodySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createInstanceBodySchema>;
    const { baseModuleId, slug } = body;

    // The base must be a loaded plain module (instances of instances are not allowed).
    const baseMeta = moduleRegistry.getMetadata(baseModuleId);
    if (parseModuleInstanceId(baseModuleId) !== null || !baseMeta) {
      throw new ModuleNotFoundError(baseModuleId);
    }

    // The base module must opt in to instancing (e.g. deepl opts out).
    if (!baseMeta.instanceable) {
      res.status(400).json({
        error: 'module-not-instanceable',
        message: `Module does not support named instances: ${baseModuleId}`,
      });
      return;
    }

    if (!isValidInstanceSlug(slug)) {
      res.status(400).json({
        error: 'invalid-instance-slug',
        message:
          'Instance slug must be 1-32 lowercase characters [a-z0-9-], starting and ending with a letter or digit.',
      });
      return;
    }

    // The slug MAY equal the instance's own base module id (e.g. a copilot
    // instance named "copilot" → copilot:copilot, the base-named instance), but
    // must not shadow a DIFFERENT registered module id, which would be confusing
    // (e.g. a generic-ai instance named "openai"). This is a pure id-collision
    // check, but the enable/active-bearing signature is threaded the global
    // config for consistency with the other metadata callers.
    const global = await getGlobalConfigStore().load();
    if (
      slug !== baseModuleId &&
      moduleRegistry.listModules(undefined, false, global).some((m) => m.id === slug)
    ) {
      res.status(400).json({
        error: 'slug-collides-with-module',
        message: `Instance slug must not collide with a different module id: ${slug}`,
      });
      return;
    }

    const instanceId = buildModuleInstanceId(baseModuleId, slug);
    const existing = await getGlobalConfigStore().listModuleInstances();
    if (existing.some((i) => i.instanceId === instanceId)) {
      res.status(409).json({
        error: 'instance-exists',
        message: `Module instance already exists: ${instanceId}`,
      });
      return;
    }

    const baseName = moduleRegistry.getMetadata(baseModuleId)?.name ?? baseModuleId;
    const instance: ModuleInstance = {
      instanceId,
      baseModuleId,
      displayName: body.displayName?.trim() || `${baseName} (${slug})`,
    };
    await getGlobalConfigStore().addModuleInstance(instance);
    moduleRegistry.registerInstance(instance);
    logger.info('global-config:instance-created', { instanceId, baseModuleId });
    res.status(201).json(instance);
  }),
);

// PATCH /api/global-config/instances/:instanceId — rename an instance
globalConfigRouter.patch(
  '/instances/:instanceId',
  validateBody(renameInstanceBodySchema),
  asyncHandler(async (req, res) => {
    const instanceId = req.params.instanceId as string;
    const body = req.body as z.infer<typeof renameInstanceBodySchema>;
    const renamed = await getGlobalConfigStore().renameModuleInstance(
      instanceId,
      body.displayName.trim(),
    );
    if (!renamed) throw new ModuleNotFoundError(instanceId);
    moduleRegistry.renameInstance(instanceId, renamed.displayName);
    logger.info('global-config:instance-renamed', { instanceId });
    res.json(renamed);
  }),
);

// DELETE /api/global-config/instances/:instanceId — delete an instance.
// Routing rules and historic translation records keep the dead id; execution
// fails like any unknown module id and the UI renders a tombstone.
globalConfigRouter.delete(
  '/instances/:instanceId',
  asyncHandler(async (req, res) => {
    const instanceId = req.params.instanceId as string;
    // The `<base>:default` instance is the base module's configuration home and
    // is recreated by the M27 migration at startup — refuse to delete it rather
    // than briefly removing it only for it to return on the next boot.
    if (isDefaultInstanceId(instanceId)) {
      res.status(400).json({
        error: 'cannot-delete-default-instance',
        message: `The default instance cannot be deleted: ${instanceId}`,
      });
      return;
    }
    const removed = await getGlobalConfigStore().removeModuleInstance(instanceId);
    if (!removed) throw new ModuleNotFoundError(instanceId);
    moduleRegistry.unregisterInstance(instanceId);
    logger.info('global-config:instance-deleted', { instanceId });
    res.status(204).end();
  }),
);

globalConfigRouter.put(
  '/:moduleId',
  // Gated like the project-level module-config twin: this persists module config,
  // including the SSRF-adjacent baseURL, so it requires an unlocked vault.
  requireUnlockedVault,
  validateBody(updateBodySchema),
  asyncHandler(async (req, res) => {
    const moduleId = req.params.moduleId as string;
    const meta = moduleRegistry.getMetadata(moduleId);
    if (!meta) throw new ModuleNotFoundError(moduleId);

    const body = req.body as z.infer<typeof updateBodySchema>;
    if (!assertNoPasswordFields(res, body.config, meta.configSchema, 'global config')) return;

    // SSRF guard: reject a link-local/metadata or otherwise-unsafe baseURL at
    // persistence time so stored global config can never hold an endpoint that a
    // later outbound call would trust.
    if (!assertSafeBaseURL(res, body.config)) return;

    // Detect a newly-enabled transition (enabled !== true → enabled === true)
    // by reading the module's prior `enabled` state from the global store
    // before applying the update.
    const before = await getGlobalConfigStore().load();
    const wasEnabled = before.moduleConfigs[moduleId]?.enabled === true;

    const updated = await getGlobalConfigStore().updateModule(moduleId, {
      enabled: body.enabled,
      active: body.active,
      config: body.config,
    });

    // On a newly-enabled transition only, fan out `active: false` to every
    // project's per-module entry so a freshly available module stays switched
    // off until each project explicitly opts in. Existing entries preserve
    // their `inheritGlobal`/`config`; missing entries default to inheriting.
    //
    // The fan-out applies ONLY to instanceable BASE modules — those surface in
    // projects through their named instances, which are the opt-in unit. Two
    // kinds are EXCLUDED because they are meant active-by-default in projects:
    //  - Named instances (`<base>:<slug>`): creating one auto-enables it
    //    (AddInstanceForm PUTs `enabled:true` right after POST); fanning out
    //    `active:false` would switch the brand-new instance off everywhere.
    //  - Non-instanceable modules (e.g. `deepl`): they have no instance layer to
    //    opt in through, so off-by-default would force a manual per-project
    //    toggle — the opposite of the "enable once, use everywhere" intent for a
    //    classic MT provider. `meta.instanceable === false` flags both kinds.
    const isInstance = parseModuleInstanceId(moduleId) !== null;
    const isNonInstanceable = meta.instanceable === false;
    const isNewlyEnabled = body.enabled === true && !wasEnabled;
    if (isNewlyEnabled && !isInstance && !isNonInstanceable) {
      const projects = await getProjectStore().listProjects();
      for (const project of projects) {
        const existingEntry = project.moduleConfigs[moduleId];
        const moduleConfigs = {
          ...project.moduleConfigs,
          [moduleId]: existingEntry
            ? { ...existingEntry, active: false }
            : { active: false, inheritGlobal: true, config: {} },
        };
        await getProjectStore().updateProject(project.id, { moduleConfigs });
      }
      logger.info('global-config:module-enabled-fan-out', {
        moduleId,
        projectCount: projects.length,
      });
    }

    logger.info('global-config:updated', { moduleId });
    res.json(updated);
  }),
);
