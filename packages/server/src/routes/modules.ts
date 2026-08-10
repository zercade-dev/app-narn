import { Router, type Response } from 'express';
import { z } from 'zod';
import { promises as fsp } from 'node:fs';
import { resolve } from 'node:path';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { getGlobalConfigStore, getProjectStore } from '../storage/registry.js';
import { validateBody } from '../middleware/validate.js';
import { logger } from '../modules/M15-console-logger.js';
import { ModuleNotFoundError, MissingCredentialError, VaultLockedError } from '../types/errors.js';
import { getSessionId } from '../middleware/session.js';
import { credentialStore } from '../modules/M16-credential-store.js';
import { metricsCollector } from '../modules/metrics-collector.js';
import { getCopilotClient } from '@zercade-dev/narn-module-copilot';
import {
  inspectOllamaFootprint,
  resolveEndpointType,
  toErrorMessage,
} from '@zercade-dev/narn-shared';
import { atomicWrite } from '../utils/fs.js';
import { getVaultStore } from '../identity/registry.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { assertSafeBaseURL, assertNoPasswordFields } from '../utils/validate-module-config.js';
import { COPILOT_MODULE_ID, normalizeCopilotConfig } from '../utils/copilot-config.js';
import { requireUnlockedVault } from '../middleware/require-vault.js';
import { requireTenant } from '../storage/pg/tenant-context.js';
import { resolveProjectPath } from '../utils/project-path.js';
import { PathTraversalError } from '../errors/PathTraversalError.js';
import { getModelsCacheBase } from '../config/env.js';
import { assertProjectAccess } from '../middleware/authz.js';

const MODELS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Caches live under <cwd>/.cache so the permission sandbox (start:secure) can
// allowlist a single directory instead of individual files in the server root.
// CWD is packages/server/ for both `pnpm dev` and `start:secure`.
// Honors MODELS_CACHE_DIR so the read-only cloud container can point the cache at
// a writable tmpfs (/tmp/...); defaults to <cwd>/.cache locally so the start:secure
// single-dir allowlist (see note above) is unchanged.
const MODELS_CACHE_DIR = resolve(getModelsCacheBase(), '.cache');

// The model-cache is written using one tenant's BYOK token (it embeds the
// provider model list + token-derived state), so it MUST be tenant-scoped —
// otherwise tenant B serves (and can poison) tenant A's cache on a shared
// filesystem. Files live at `<cwd>/.cache/<tenantId>/<id>-models-cache.json`.
// Every modules route runs inside the HTTP tenant context, so requireTenant() is
// always satisfied here (fail-closed off a request). In local mode the tenant is
// 'local', so this is `<cwd>/.cache/local/<id>-models-cache.json`.
function getTenantModelsCacheDir(): string {
  const tenantId = requireTenant().userId;
  // Validate `tenantId` as a single safe path segment (defense-in-depth).
  return resolveProjectPath(MODELS_CACHE_DIR, tenantId);
}

/**
 * Module ids that may be turned into a models-cache filename: a base module id,
 * optionally followed by `:<instance-slug>`. Both halves carry the same
 * lowercase `[a-z0-9-]` shape that `MODULE_INSTANCE_SLUG_PATTERN` enforces when
 * an instance is created, and every base module id is spelled that way too — so
 * this admits every id a registered module can actually have.
 */
const CACHEABLE_MODULE_ID =
  /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?(?::[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?)?$/;

function getModuleModelsCachePath(id: string): string {
  // `id` reaches here from `req.params.id`. Every caller has already rejected
  // ids the registry doesn't know, which is the real guard — but a registry
  // lookup is a dynamic property read, so neither a reader nor a static
  // analyser can see that it constrains the string. Restate it as an explicit
  // allowlist on the way into a path: nothing that fails this could have named
  // a registered module, so no reachable request changes behaviour.
  if (!CACHEABLE_MODULE_ID.test(id)) {
    throw new PathTraversalError(`Invalid module id: ${id}`);
  }
  return resolveProjectPath(getTenantModelsCacheDir(), `${id}-models-cache.json`);
}

async function writeModuleModelsCache(id: string, cache: ModelsCache): Promise<void> {
  await fsp.mkdir(getTenantModelsCacheDir(), { recursive: true });
  await atomicWrite(getModuleModelsCachePath(id), cache);
}

interface ModelsCache {
  updatedAt: string;
  models: unknown[];
}

async function readModelsCache(): Promise<ModelsCache | null> {
  return readModuleModelsCache(COPILOT_MODULE_ID);
}

async function readModuleModelsCache(id: string): Promise<ModelsCache | null> {
  try {
    const raw = await fsp.readFile(getModuleModelsCachePath(id), 'utf-8');
    return JSON.parse(raw) as ModelsCache;
  } catch {
    return null;
  }
}

// Age of a model cache vs. the TTL — the single "fresh?" predicate shared by the
// cache-status and serve-from-cache paths.
function cacheAge(cache: ModelsCache): { ageMs: number; fresh: boolean } {
  const ageMs = Date.now() - new Date(cache.updatedAt).getTime();
  return { ageMs, fresh: ageMs < MODELS_CACHE_TTL_MS };
}

// Shared shape for the two /models/cache-status endpoints (copilot + per-module).
function respondCacheStatus(res: Response, cache: ModelsCache | null): void {
  if (!cache) {
    res.json({ updatedAt: null, ageMs: null, ttlMs: MODELS_CACHE_TTL_MS, fresh: false });
    return;
  }
  const { ageMs, fresh } = cacheAge(cache);
  res.json({
    updatedAt: cache.updatedAt,
    ageMs,
    ttlMs: MODELS_CACHE_TTL_MS,
    fresh,
  });
}

// Serve a fresh cache hit for the two /models endpoints. Returns true when the
// response was sent from cache (with a Cache-Control reflecting remaining TTL).
function serveFreshModelsCache(res: Response, cache: ModelsCache | null): boolean {
  if (!cache) return false;
  const { ageMs, fresh } = cacheAge(cache);
  if (!fresh) return false;
  const remainingSecs = Math.max(0, Math.floor((MODELS_CACHE_TTL_MS - ageMs) / 1000));
  res.setHeader('Cache-Control', `private, max-age=${remainingSecs}`);
  res.json(cache.models);
  return true;
}

// Persist freshly-fetched models (best-effort) and respond with a full-TTL
// Cache-Control header.
function persistAndRespondModels(res: Response, id: string, models: unknown[]): void {
  writeModuleModelsCache(id, {
    updatedAt: new Date().toISOString(),
    models,
  }).catch((err: unknown) => logger.warn(`Failed to write models cache for ${id}: ${String(err)}`));
  res.setHeader('Cache-Control', `private, max-age=${Math.floor(MODELS_CACHE_TTL_MS / 1000)}`);
  res.json(models);
}

// True for the base Copilot module id and any of its named instances
// (`copilot:<slug>`). Instance ids are always `<base>:<slug>` and base module
// ids never contain a colon, so this string check resolves both forms.
function isCopilotId(id: string): boolean {
  return id === COPILOT_MODULE_ID || id.startsWith(`${COPILOT_MODULE_ID}:`);
}

// Serve Copilot's live model list from the Copilot SDK client. Copilot discovers
// models via the client (keyed only by GITHUB_TOKEN), not the
// TranslationModule.listModels() contract — the copilot module doesn't implement
// it — so the base module and every named instance share this path and the
// single token-scoped cache under COPILOT_MODULE_ID.
async function serveCopilotModels(res: Response, forceRefresh: boolean): Promise<void> {
  if (!forceRefresh && serveFreshModelsCache(res, await readModelsCache())) {
    return;
  }

  let client: Awaited<ReturnType<typeof getCopilotClient>> | undefined;
  try {
    const sessionId = getSessionId(res);
    const token = credentialStore.getOptional('GITHUB_TOKEN', sessionId);
    if (!token) {
      if (
        forceRefresh &&
        (await getVaultStore().exists()) &&
        !credentialStore.isUnlocked(sessionId)
      ) {
        res.status(423).json({ error: 'Vault is locked' });
        return;
      }
      res.status(401).json({ error: 'No GitHub token configured' });
      return;
    }
    client = await getCopilotClient(token);
    if (typeof client.listModels !== 'function') {
      res.status(503).json({ error: 'Copilot client does not support listModels' });
      return;
    }
    const models = await client.listModels();
    persistAndRespondModels(res, COPILOT_MODULE_ID, models);
  } finally {
    if (client?.destroy) {
      try {
        await client.destroy();
      } catch {
        // best-effort cleanup
      }
    }
  }
}

export const modulesRouter: Router = Router();

// GET /api/modules — list discovered modules with metadata
modulesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const sessionId = getSessionId(res);
    // Needed for the tri-state credentialStatus: a vault file that exists but
    // is not unlocked reports 'vault-locked' instead of 'missing'.
    const hasVault = await getVaultStore().exists();
    // Global config supplies each id's enabled/active gate so AI-feature pickers
    // can filter to instances that are actually enabled+active in global config.
    const global = await getGlobalConfigStore().load();
    res.json({ modules: moduleRegistry.listModules(sessionId, hasVault, global) });
  }),
);

// GET /api/modules/health — in-process per-module reliability metrics collected by M9.
// In-memory only: counters reset on server restart. Must be registered BEFORE the
// dynamic /:id route so Express matches the static segment first.
modulesRouter.get('/health', requireUnlockedVault, (_req, res) => {
  res.json(metricsCollector.snapshot());
});

// GET /api/modules/copilot/models/cache-status — returns metadata about the server-side model cache.
// Useful for diagnostic dashboards and tests without triggering a live Copilot SDK call.
modulesRouter.get(
  '/copilot/models/cache-status',
  asyncHandler(async (_req, res) => {
    respondCacheStatus(res, await readModelsCache());
  }),
);

// GET /api/modules/copilot/models — list live models from the Copilot SDK.
// Must be registered BEFORE the dynamic /:id route so Express matches the static segment first.
// Pass ?refresh=true to bypass the 1-hour file cache.
modulesRouter.get(
  '/copilot/models',
  asyncHandler(async (req, res) => {
    await serveCopilotModels(res, req.query['refresh'] === 'true');
  }),
);

// GET /api/modules/:id/models/cache-status — per-module model cache metadata.
// Must be registered BEFORE /:id so Express matches the longer static path first.
modulesRouter.get(
  '/:id/models/cache-status',
  asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Copilot (base or any named instance) shares the single token-scoped cache
    // written under COPILOT_MODULE_ID. The bare id is served by the static
    // /copilot/models/cache-status route; instances fall through to here.
    if (isCopilotId(id)) {
      respondCacheStatus(res, await readModelsCache());
      return;
    }

    // Validate id against the registry before using it in a file path (prevents path traversal).
    if (!moduleRegistry.getModule(id)) {
      res.status(404).json({ error: 'Module not found' });
      return;
    }

    respondCacheStatus(res, await readModuleModelsCache(id));
  }),
);

// GET /api/modules/:id/models — list live models for any module that exposes listModels().
// Must be registered BEFORE the dynamic /:id route so Express matches the longer path first.
// Pass ?refresh=true to bypass the 1-hour file cache.
// Copilot is handled by its own static /copilot/models route above; this handles all other modules.
modulesRouter.get(
  '/:id/models',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const forceRefresh = req.query['refresh'] === 'true';

    // Copilot discovers via the SDK client, not the listModels() contract (the
    // copilot module doesn't implement it). The bare `copilot` id is served by
    // the dedicated static route above; named instances (`copilot:<slug>`) reach
    // this generic route, so dispatch them to the shared Copilot path here —
    // otherwise they 404 with "Module does not support listModels".
    if (isCopilotId(id)) {
      await serveCopilotModels(res, forceRefresh);
      return;
    }

    const mod = moduleRegistry.getModule(id);
    if (!mod || typeof mod.listModels !== 'function') {
      res.status(404).json({ error: 'Module does not support listModels' });
      return;
    }

    if (!forceRefresh && serveFreshModelsCache(res, await readModuleModelsCache(id))) {
      return;
    }

    const sessionId = getSessionId(res);
    if (
      forceRefresh &&
      (await getVaultStore().exists()) &&
      !credentialStore.isUnlocked(sessionId)
    ) {
      res.status(423).json({ error: 'Vault is locked' });
      return;
    }

    try {
      // Load the module's configuration from the global config store so listModels()
      // has access to settings like baseURL for Ollama/vLLM endpoints.
      const globalConfig = await getGlobalConfigStore().load();
      const moduleConfig = globalConfig.moduleConfigs[id]?.config ?? {};

      // Reject an unsafe baseURL with the same 400 'invalid-base-url' contract the
      // other baseURL-bearing routes use, instead of letting module construction
      // throw the SSRF error into the generic 503 catch below.
      if (!assertSafeBaseURL(res, moduleConfig)) return;

      // Create a new module instance with the configuration and sessionId.
      // This allows the module to retrieve actual credentials from an unlocked vault,
      // while also supporting self-contained config (like generic-ai with Ollama) if sessionId is not unlocked.
      const sessionMod = moduleRegistry.createWithConfig(id, moduleConfig, sessionId) ?? mod;
      const models = await sessionMod.listModels!();
      persistAndRespondModels(res, id, models);
    } catch (err) {
      logger.error(
        `modules:/:id/models error for ${id}: ${String(err)} (name=${err && typeof err === 'object' ? (err as { name?: string }).name : 'unknown'})`,
      );
      if (err instanceof MissingCredentialError) {
        res.status(401).json({ error: 'Missing required credentials' });
        return;
      }
      // VaultLockedError can occur when trying to resolve credentials without a valid session
      if (err instanceof VaultLockedError) {
        res.status(401).json({ error: 'Vault is locked' });
        return;
      }
      // Redact before returning to the client: the resolver error can embed a raw
      // provider response body / URL / key (see throwIfAuthOrRateLimitStatus), so
      // route it through toErrorMessage exactly as the footprint route below does.
      res.status(503).json({ error: toErrorMessage(err) });
    }
  }),
);

// POST /api/modules/:id/footprint — measure one local model's runtime VRAM footprint.
// Loads the model at its configured context via the module's Ollama endpoint,
// reads /api/ps, then unloads it. Local (Ollama) endpoints only.
modulesRouter.post(
  '/:id/footprint',
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const body = (req.body ?? {}) as { modelId?: unknown; numCtx?: unknown };
    const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
    if (!modelId) {
      res.status(400).json({ error: 'modelId is required' });
      return;
    }
    const numCtx =
      typeof body.numCtx === 'number' && Number.isFinite(body.numCtx) && body.numCtx > 0
        ? Math.floor(body.numCtx)
        : undefined;

    const globalConfig = await getGlobalConfigStore().load();
    const moduleConfig = (globalConfig.moduleConfigs[id]?.config ?? {}) as {
      baseURL?: string;
      endpointType?: string;
    };
    const baseURL = moduleConfig.baseURL;
    if (!baseURL) {
      res
        .status(400)
        .json({ error: 'Footprint inspection requires a local module with a baseURL' });
      return;
    }
    // VRAM footprint probing is Ollama-only: LM Studio's REST API reports no
    // VRAM/size bytes, and a generic endpoint has no ps/unload concept. Gate on
    // the explicit endpoint type (falling back to the baseURL heuristic).
    if (resolveEndpointType({ endpointType: moduleConfig.endpointType, baseURL }) !== 'ollama') {
      res
        .status(400)
        .json({ error: 'Footprint inspection is only supported for Ollama endpoints' });
      return;
    }

    // SSRF guard: the stored baseURL is fetched server-side below, so a
    // link-local/metadata or otherwise-unsafe endpoint must be rejected here —
    // the same guard validateBaseURL applies on every credential-carrying path.
    if (!assertSafeBaseURL(res, moduleConfig)) return;

    try {
      const footprint = await inspectOllamaFootprint({ baseURL, modelId, numCtx });
      res.json(footprint);
    } catch (err) {
      const message = toErrorMessage(err);
      logger.error(`modules:/:id/footprint error for ${id}/${modelId}: ${message}`);
      res.status(503).json({ error: message });
    }
  }),
);

// GET /api/modules/:id — get metadata for a single module
modulesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sessionId = getSessionId(res);
    const hasVault = await getVaultStore().exists();
    const global = await getGlobalConfigStore().load();
    const meta = moduleRegistry.getMetadata(req.params.id, sessionId, hasVault, global);
    if (!meta) throw new ModuleNotFoundError(req.params.id);
    res.json(meta);
  }),
);

const moduleConfigSchema = z.object({
  config: z.record(z.string(), z.unknown()),
  active: z.boolean().optional(),
  inheritGlobal: z.boolean().optional(),
});

// PUT /api/projects/:projectId/module-config/:moduleId — persist per-project module config
export const projectModuleConfigRouter: Router = Router({ mergeParams: true });

// Validate `:projectId` against path traversal (400 centrally on a hostile id);
// the handler then reads the pre-validated value directly.
projectModuleConfigRouter.param('projectId', projectIdParam);

projectModuleConfigRouter.put(
  '/:projectId/module-config/:moduleId',
  requireUnlockedVault,
  validateBody(moduleConfigSchema),
  asyncHandler(async (req, res) => {
    const { moduleId, projectId } = req.params as Record<string, string>;
    await assertProjectAccess(projectId, { type: 'manage' });
    const meta = moduleRegistry.getMetadata(moduleId);
    if (!meta) throw new ModuleNotFoundError(moduleId);

    const body = req.body as z.infer<typeof moduleConfigSchema>;
    if (!assertNoPasswordFields(res, body.config, meta.configSchema, 'project config')) return;

    // SSRF guard: reject an unsafe baseURL before it is persisted to project config.
    if (!assertSafeBaseURL(res, body.config)) return;

    const project = await getProjectStore().loadProject(projectId);
    const config =
      moduleId === COPILOT_MODULE_ID ? normalizeCopilotConfig(body.config) : body.config;
    const entry = {
      config,
      active: body.active,
      inheritGlobal: body.inheritGlobal ?? true,
    };
    const moduleConfigs = { ...project.moduleConfigs, [moduleId]: entry };
    const updated = await getProjectStore().updateProject(projectId, { moduleConfigs });
    logger.info('module:config-updated', { projectId, moduleId });
    res.json(updated);
  }),
);
