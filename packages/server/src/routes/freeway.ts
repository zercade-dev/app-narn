/**
 * /api/freeway routes — NARN Freeway status + one-click preset creation.
 *
 * GET  /api/freeway/status              - live bucket status for the UI checklist
 * POST /api/freeway/presets/:presetKey  - create the pre-shaped generic-ai preset
 *                                          instance for a supported free provider
 *
 * Both routes are read-only or metadata-only with respect to secrets: status
 * never touches the vault (a locked vault simply reports every bucket
 * 'uncredentialed', which is the correct signal, not an error) and the preset
 * route creates a module-instance record + config, mirroring the module-instance
 * routes' middleware chain (`POST /api/global-config/instances`) exactly — no
 * `requireUnlockedVault`, since no secret is read or written here. The vault
 * key itself is only derived and returned so the UI can prompt for it.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { GlobalConfig, ModuleInstance } from '@zercade-dev/narn-shared';
import {
  buildModuleInstanceId,
  deriveInstanceCredentialKey,
  freeTierProvider,
} from '@zercade-dev/narn-shared';
import { asyncHandler } from '../http/index.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { validateBody } from '../middleware/validate.js';
import { getSessionId } from '../middleware/session.js';
import { loadBucketViews } from '../modules/M32/bucket-source.js';
import { effectiveRemainingRequests } from '../modules/M32/selector.js';
import type { BucketView } from '../modules/M32/types.js';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { resolveEffectiveModuleConfig } from '../modules/M19-global-config-store.js';
import { logger } from '../modules/M15-console-logger.js';
import { getFreewayLedgerStore, getGlobalConfigStore } from '../storage/registry.js';
import { isCloudMode } from '../identity/registry.js';

export const freewayRouter: Router = Router();

const GENERIC_AI_BASE_MODULE_ID = 'generic-ai';

const PRESET_KEYS = ['groq', 'mistral', 'cerebras'] as const;
type PresetKey = (typeof PRESET_KEYS)[number];
const presetKeySchema = z.enum(PRESET_KEYS);
// The preset route takes no body fields. `express.json()` leaves `req.body`
// `undefined` for a bodyless POST (no Content-Type), so this must accept that
// too; when a body IS sent, unknown keys are dropped rather than reflected back.
const presetBodySchema = z.object({}).optional();

const PRESET_DISPLAY_NAMES: Record<PresetKey, string> = {
  groq: 'Groq',
  mistral: 'Mistral',
  cerebras: 'Cerebras',
};

// Bound preset creation like module-instance creation's own rate limiter
// (routes/global-config.ts `instanceCreateRateLimiter`) so it cannot be used
// to spam the config store.
const presetCreateRateLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

type BucketStatusState = 'ready' | 'cooling' | 'exhausted' | 'disabled' | 'uncredentialed';

interface FreewayStatusBucket {
  bucketKey: string;
  providerKey: string;
  moduleId: string;
  modelId: string;
  qualityTier: 1 | 2 | 3 | 4;
  remainingRequests: number;
  remainingChars?: number;
  nextResetAt: number;
  state: BucketStatusState;
  disabledReason?: string;
  gatePassByLanguage?: Record<string, number>;
}

/**
 * disabledReason wins first (a ledger-recorded hard stop, e.g. bad
 * credentials); then an active cooldown; then exhaustion. Exhaustion is
 * judged on whichever counter this bucket's day-scale window actually
 * governs: char-scale (DeepL-style) buckets carry a real `remainingChars`
 * (their `remainingRequests` is the MAX_SAFE_INTEGER sentinel — see
 * bucket-source.ts's loadBucketViews — so it never signals exhaustion),
 * request-scale buckets have no `remainingChars` and are judged on the
 * pool-clamped request stock instead — the same figure the selector spends
 * against, so a drained account-wide pool doesn't render every sibling ready.
 */
function deriveBucketState(
  view: Pick<
    BucketView,
    | 'disabledReason'
    | 'cooldownUntil'
    | 'remainingRequests'
    | 'remainingChars'
    | 'poolRemainingRequests'
  >,
  now: number,
): BucketStatusState {
  if (view.disabledReason) return 'disabled';
  if (view.cooldownUntil !== undefined && view.cooldownUntil > now) return 'cooling';
  const exhausted =
    view.remainingChars !== undefined
      ? view.remainingChars === 0
      : effectiveRemainingRequests(view) === 0;
  if (exhausted) return 'exhausted';
  return 'ready';
}

/** disabledReason surfaced for a missing-pass row whose module IS credentialed but toggled off. */
const MODULE_DISABLED_REASON = 'module-disabled';

/**
 * Classify a bucket that `loadBucketViews`' live pass excluded. `moduleStatus`
 * excludes a bucket for one of two distinct reasons that the UI needs to tell
 * apart: no usable credential (`add key`) vs a credentialed module the user
 * simply hasn't enabled (`enable module`) — `loadBucketViews` itself collapses
 * both into "not usable", so this re-derives which one applies from the same
 * `moduleStatus` the live pass used.
 */
function deriveMissingState(
  moduleId: string,
  moduleStatus: (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined,
): { state: BucketStatusState; disabledReason?: string } {
  const status = moduleStatus(moduleId);
  if (status && status.credentialed && !status.enabled) {
    return { state: 'disabled', disabledReason: MODULE_DISABLED_REASON };
  }
  return { state: 'uncredentialed' };
}

function toStatusBucket(view: BucketView, now: number): FreewayStatusBucket {
  return {
    bucketKey: view.bucketKey,
    providerKey: view.providerKey,
    moduleId: view.moduleId,
    modelId: view.modelId,
    qualityTier: view.qualityTier,
    remainingRequests: effectiveRemainingRequests(view),
    remainingChars: view.remainingChars,
    nextResetAt: view.nextResetAt,
    state: deriveBucketState(view, now),
    disabledReason: view.disabledReason,
    gatePassByLanguage: view.stats.gatePassByLanguage,
  };
}

/**
 * Session-scoped `moduleStatus` for the bucket source — mirrors M9
 * TranslationEngine's `freewayBucketDeps` pattern (enablement from the
 * effective module config, credentials from the registry's per-session
 * metadata) but with no project-level override: this route has no project
 * context, so only the global config's enable/active gate applies.
 */
function freewayModuleStatus(
  global: GlobalConfig,
  sessionId: string | undefined,
): (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined {
  return (moduleId: string) => {
    const effective = resolveEffectiveModuleConfig(moduleId, global, undefined);
    const enabled = effective.enabled && effective.active !== false;
    const metadata = moduleRegistry.getMetadata(moduleId, sessionId, false, global);
    if (!metadata) return undefined;
    return { credentialed: metadata.credentialStatus === 'ok', enabled };
  };
}

const alwaysCredentialed = (): { credentialed: boolean; enabled: boolean } => ({
  credentialed: true,
  enabled: true,
});

// GET /api/freeway/status — live bucket status for the setup/status UI.
freewayRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const sessionId = getSessionId(res);
    const global = await getGlobalConfigStore().load();
    const ledger = getFreewayLedgerStore();
    const cloudMode = isCloudMode();
    const moduleStatus = freewayModuleStatus(global, sessionId);

    const liveViews = await loadBucketViews(now, {
      ledger,
      moduleStatus,
      cloudMode,
    });

    // loadBucketViews excludes any bucket whose module isn't credentialed AND
    // enabled (by design — it only ever plans against usable buckets). The
    // status UI additionally wants a checklist row for every snapshot bucket
    // that ISN'T usable yet, so it can prompt "add key" / "enable module".
    // Re-run with a permissive moduleStatus to get the full snapshot's quota
    // shape (still respecting the structural cloud-mode copilot exclusion),
    // then diff against the live pass for what's missing.
    const allViews = await loadBucketViews(now, {
      ledger,
      moduleStatus: alwaysCredentialed,
      cloudMode,
    });
    const liveKeys = new Set(liveViews.map((v) => v.bucketKey));
    const missingViews = allViews.filter((v) => !liveKeys.has(v.bucketKey));

    // Same condition the preset POST route gates creation on: the generic-ai
    // base module must be loaded (never true in cloud mode, where its
    // manifest's `cloudDisabled` keeps it out of the registry) AND the server
    // itself must not be in cloud mode. Surfaced here so the panel can gate
    // its Add buttons up front instead of discovering unavailability from a
    // failed POST.
    const presetsAvailable =
      moduleRegistry.getMetadata(GENERIC_AI_BASE_MODULE_ID) !== undefined && !isCloudMode();

    const buckets: FreewayStatusBucket[] = [
      ...liveViews.map((v) => toStatusBucket(v, now)),
      ...missingViews.map((v) => {
        const { state, disabledReason } = deriveMissingState(v.moduleId, moduleStatus);
        return {
          bucketKey: v.bucketKey,
          providerKey: v.providerKey,
          moduleId: v.moduleId,
          modelId: v.modelId,
          qualityTier: v.qualityTier,
          remainingRequests: effectiveRemainingRequests(v),
          remainingChars: v.remainingChars,
          nextResetAt: v.nextResetAt,
          state,
          ...(disabledReason ? { disabledReason } : {}),
        };
      }),
    ];

    res.json({ buckets, generatedAt: now, presetsAvailable });
  }),
);

// POST /api/freeway/presets/:presetKey — one-click preset generic-ai instance.
freewayRouter.post(
  '/presets/:presetKey',
  presetCreateRateLimiter,
  validateBody(presetBodySchema),
  asyncHandler(async (req, res) => {
    const parsedKey = presetKeySchema.safeParse(req.params.presetKey);
    if (!parsedKey.success) {
      res.status(400).json({
        error: 'invalid-preset-key',
        message: `Unknown Freeway preset: ${req.params.presetKey}`,
      });
      return;
    }
    const presetKey = parsedKey.data;

    const provider = freeTierProvider(presetKey);
    if (!provider?.presetBaseUrl || !provider.presetDefaultModel) {
      // Defensive: every preset enum key must carry preset shaping data in
      // the bundled snapshot (see free-tier-data.json).
      res.status(500).json({
        error: 'preset-data-missing',
        message: `No Freeway preset shaping data for: ${presetKey}`,
      });
      return;
    }

    // Freeway presets are local-mode-only v1: `generic-ai`'s manifest sets
    // `cloudDisabled`, so the base module is never loaded in cloud mode and
    // `getMetadata` naturally returns undefined there — but gate on
    // `isCloudMode()` explicitly too, so this stays graceful (400, not a raw
    // 404 module-not-found) even if that manifest flag ever changes.
    const baseMeta = moduleRegistry.getMetadata(GENERIC_AI_BASE_MODULE_ID);
    if (!baseMeta || isCloudMode()) {
      res.status(400).json({
        error: 'presets-unavailable',
        message: 'NARN Freeway presets are only available in local mode.',
      });
      return;
    }
    const baseVar = baseMeta.requiredEnvVars[0];
    if (!baseVar) {
      res.status(500).json({
        error: 'preset-data-missing',
        message: `Base module has no credential var: ${GENERIC_AI_BASE_MODULE_ID}`,
      });
      return;
    }

    const instanceId = buildModuleInstanceId(GENERIC_AI_BASE_MODULE_ID, presetKey);
    const credentialKey = deriveInstanceCredentialKey(baseVar, presetKey);

    // Idempotent: an existing preset instance returns the same payload rather
    // than duplicating (or re-clobbering) it.
    const existingInstances = await getGlobalConfigStore().listModuleInstances();
    if (existingInstances.some((i) => i.instanceId === instanceId)) {
      res.status(200).json({ instanceId, credentialKey });
      return;
    }

    // REUSE the same store/registry calls the module-instances route uses
    // (routes/global-config.ts `POST /instances`) — no separate persistence path.
    const instance: ModuleInstance = {
      instanceId,
      baseModuleId: GENERIC_AI_BASE_MODULE_ID,
      displayName: `${PRESET_DISPLAY_NAMES[presetKey]} (Free)`,
    };
    await getGlobalConfigStore().addModuleInstance(instance);
    moduleRegistry.registerInstance(instance);
    // Pre-shape the instance's config with the preset's baseURL + default
    // model. These values come from the bundled snapshot (trusted, not
    // client-supplied), so this skips the SSRF baseURL guard the
    // user-facing `PUT /api/global-config/:moduleId` route applies to
    // arbitrary client input.
    await getGlobalConfigStore().updateModule(instanceId, {
      enabled: true,
      active: true,
      config: { baseURL: provider.presetBaseUrl, model: provider.presetDefaultModel },
    });

    logger.info('freeway:preset-created', { instanceId, presetKey });
    res.status(201).json({ instanceId, credentialKey });
  }),
);
