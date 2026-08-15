/**
 * /api/freeway routes — NARN Freeway status.
 *
 * GET  /api/freeway/status  - live bucket status for the UI checklist
 *
 * Read-only with respect to secrets: status never touches the vault (a
 * locked vault simply reports every bucket 'uncredentialed', which is the
 * correct signal, not an error).
 */
import { Router } from 'express';
import type { GlobalConfig } from '@zercade-dev/narn-shared';
import { asyncHandler } from '../http/index.js';
import { getSessionId } from '../middleware/session.js';
import {
  defaultInstanceIdsFor,
  freewayCandidateIds,
  loadBucketViews,
} from '../modules/M32/bucket-source.js';
import { effectiveRemainingRequests } from '../modules/M32/selector.js';
import type { BucketView } from '../modules/M32/types.js';
import { moduleRegistry } from '../modules/M6-module-registry.js';
import { resolveEffectiveModuleConfig } from '../modules/M19-global-config-store.js';
import { getFreewayLedgerStore, getGlobalConfigStore } from '../storage/registry.js';
import { isCloudMode } from '../identity/registry.js';

export const freewayRouter: Router = Router();

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
  /** The module/instance id actually serving this LIVE bucket, when it differs from `moduleId`. */
  dispatchModuleId?: string;
  /** For a 'disabled' missing row: the candidate id "Enable it" should scroll to / turn on. */
  enableTargetModuleId?: string;
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
 *
 * Walks the same candidate order Freeway dispatch would (base, then
 * `<base>:default`, then remaining instances — see
 * {@link freewayCandidateIds}): the first candidate that IS credentialed but
 * not enabled names the "Enable it" target (`enableTargetModuleId`), since
 * that is the concrete card the UI can actually turn on. No credentialed
 * candidate at all is 'uncredentialed' regardless of enablement.
 */
function deriveMissingState(
  moduleId: string,
  moduleStatus: (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined,
  instanceIdsFor: (baseModuleId: string) => string[],
): { state: BucketStatusState; disabledReason?: string; enableTargetModuleId?: string } {
  for (const candidateId of freewayCandidateIds(moduleId, instanceIdsFor(moduleId))) {
    const status = moduleStatus(candidateId);
    if (status && status.credentialed && !status.enabled) {
      return {
        state: 'disabled',
        disabledReason: MODULE_DISABLED_REASON,
        enableTargetModuleId: candidateId,
      };
    }
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
    ...(view.dispatchModuleId !== undefined ? { dispatchModuleId: view.dispatchModuleId } : {}),
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

    const buckets: FreewayStatusBucket[] = [
      ...liveViews.map((v) => toStatusBucket(v, now)),
      ...missingViews.map((v) => {
        const { state, disabledReason, enableTargetModuleId } = deriveMissingState(
          v.moduleId,
          moduleStatus,
          defaultInstanceIdsFor,
        );
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
          ...(enableTargetModuleId !== undefined ? { enableTargetModuleId } : {}),
        };
      }),
    ];

    res.json({ buckets, generatedAt: now });
  }),
);
