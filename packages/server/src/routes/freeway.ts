/**
 * /api/freeway routes — NARN Freeway status.
 *
 * GET  /api/freeway/status                              - live bucket status for the UI checklist
 * POST /api/freeway/credential-marks/:moduleId/clear     - manually clear one candidate's bad-credential mark
 *
 * Read-only with respect to secrets: status never touches the vault (a
 * locked vault simply reports every bucket 'uncredentialed', which is the
 * correct signal, not an error). The clear route is a mutation, but only of
 * the Freeway quota ledger's mark row — it never reads or writes a
 * credential itself, so it needs no vault access either.
 */
import { Router } from 'express';
import {
  deriveInstanceCredentialKey,
  getFreeTierSnapshot,
  parseModuleInstanceId,
  type GlobalConfig,
} from '@zercade-dev/narn-shared';
import { asyncHandler } from '../http/index.js';
import { getSessionId } from '../middleware/session.js';
import { credentialStore } from '../modules/M16-credential-store.js';
import {
  defaultInstanceIdsFor,
  freewayCandidateIds,
  freewayCredentialKey,
  loadBucketViews,
  loadEnvVarLookup,
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
  /** Set when this bucket shares a day-scale pool with sibling buckets; equals providerKey. */
  poolKey?: string;
  /** The module/instance id actually serving this LIVE bucket. */
  dispatchModuleId?: string;
  /** For a 'disabled' missing row: the candidate id "Enable it" should scroll to / turn on. */
  enableTargetModuleId?: string;
  /**
   * The Freeway candidate that actually carries the bad-credential mark
   * (`credential::<moduleId>` in the ledger) — present only when
   * `disabledReason` is {@link CREDENTIAL_BAD_REASON}. This is deliberately a
   * separate field from `dispatchModuleId`: that one already means "the id
   * this bucket dispatches through" and is populated for healthy buckets
   * too, so overloading it with a second meaning here would make both
   * unreadable. Clear it via `POST /credential-marks/:moduleId/clear`.
   */
  credentialMarkModuleId?: string;
  /** The vault key writing would clear {@link credentialMarkModuleId}'s mark. */
  credentialKeyName?: string;
}

/** disabledReason bucket-source.ts's loadBucketViews sets when every usable candidate is credential-marked. */
const CREDENTIAL_BAD_REASON = 'bad credentials';

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
 * Walks the same candidate order Freeway dispatch would (`overrideInstanceId`
 * first when it still names a live instance, then `<base>:default`, then
 * remaining instances, then the bare base last — see
 * {@link freewayCandidateIds}): the first candidate that IS credentialed but
 * not enabled names the "Enable it" target (`enableTargetModuleId`), since
 * that is the concrete card the UI can actually turn on. No credentialed
 * candidate at all is 'uncredentialed' regardless of enablement.
 */
function deriveMissingState(
  moduleId: string,
  moduleStatus: (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined,
  instanceIdsFor: (baseModuleId: string) => string[],
  overrideInstanceId: string | undefined,
): { state: BucketStatusState; disabledReason?: string; enableTargetModuleId?: string } {
  for (const candidateId of freewayCandidateIds(
    moduleId,
    instanceIdsFor(moduleId),
    overrideInstanceId,
  )) {
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

/**
 * Derive the credential-mark fields for a bucket whose `disabledReason` is
 * {@link CREDENTIAL_BAD_REASON}. `resolveDispatchModuleId` (bucket-source.ts)
 * only ever falls back to returning a credential-marked candidate AS
 * `dispatchModuleId` when no OTHER candidate is usable — which is exactly
 * the condition that produces this disabledReason — so `view.dispatchModuleId`
 * is guaranteed to BE the marked candidate here, not merely a plausible
 * stand-in. `envVarFor` resolves the marked candidate's base module id to its
 * manifest env var.
 *
 * The key name is that env var for a bare-base candidate. For an instance
 * candidate it's the per-instance derived key ONLY when that key actually
 * exists in `existingVaultKeys` — otherwise the instance is credentialed
 * purely via base inheritance, so the key that would actually clear the mark
 * is the base env var, not a derived key the user has never written. This
 * mirrors condition 2 of `clearFreewayCredentialMarks` (the same
 * instance→base fallback M6's `buildCredentialProvider` resolves credentials
 * with, and {@link resolveFreewayProbeCredential} reads usage with) —
 * without it, an inheriting instance would report a derived key that isn't
 * the credential actually in use.
 */
function deriveCredentialMark(
  view: BucketView,
  envVarFor: (baseModuleId: string) => string | undefined,
  existingVaultKeys: ReadonlySet<string>,
): Pick<FreewayStatusBucket, 'credentialMarkModuleId' | 'credentialKeyName'> {
  const moduleId = view.dispatchModuleId;
  if (moduleId === undefined) return {};
  const envVar = envVarFor(view.moduleId);
  if (envVar === undefined) return {};
  const parsed = parseModuleInstanceId(moduleId);
  const derivedKey = parsed ? deriveInstanceCredentialKey(envVar, parsed.slug) : undefined;
  const keyName =
    derivedKey !== undefined && existingVaultKeys.has(derivedKey) ? derivedKey : envVar;
  return { credentialMarkModuleId: moduleId, credentialKeyName: keyName };
}

function toStatusBucket(
  view: BucketView,
  now: number,
  envVarFor: (baseModuleId: string) => string | undefined,
  existingVaultKeys: ReadonlySet<string>,
): FreewayStatusBucket {
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
    poolKey: view.poolKey,
    ...(view.dispatchModuleId !== undefined ? { dispatchModuleId: view.dispatchModuleId } : {}),
    ...(view.disabledReason === CREDENTIAL_BAD_REASON
      ? deriveCredentialMark(view, envVarFor, existingVaultKeys)
      : {}),
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
    const settings = await getGlobalConfigStore().getSettings();
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

    // Only paid for when at least one live bucket is actually credential-marked
    // (the common case has none): loadEnvVarLookup's dynamic import of the
    // module registry is cheap once cached, but there is no reason to pay it
    // on every poll of a healthy workspace. Same reasoning for the vault key
    // set — read once per request (not per bucket) via the credential
    // store's own presence check, mirroring how `clearFreewayCredentialMarks`
    // consults `existingVaultKeys`.
    const hasCredentialMark = liveViews.some((v) => v.disabledReason === CREDENTIAL_BAD_REASON);
    const envVarFor = hasCredentialMark
      ? await loadEnvVarLookup()
      : (): string | undefined => undefined;
    const existingVaultKeys: ReadonlySet<string> = hasCredentialMark
      ? new Set(sessionId ? credentialStore.listKeys(sessionId) : [])
      : new Set();

    const buckets: FreewayStatusBucket[] = [
      ...liveViews.map((v) => toStatusBucket(v, now, envVarFor, existingVaultKeys)),
      ...missingViews.map((v) => {
        const { state, disabledReason, enableTargetModuleId } = deriveMissingState(
          v.moduleId,
          moduleStatus,
          defaultInstanceIdsFor,
          settings.freewayInstanceOverrides?.[v.moduleId],
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

/**
 * Every module id the ledger's bad-credential mark could legitimately be
 * keyed on right now: each free-tier provider's own candidate set
 * ({@link freewayCandidateIds}), unioned across providers. Computed fresh per
 * request — instance registration can change between requests, and this is
 * only ever a handful of providers/instances, not worth caching.
 */
function validCredentialMarkIds(): Set<string> {
  const snapshot = getFreeTierSnapshot();
  const ids = new Set<string>();
  for (const provider of Object.values(snapshot.providers)) {
    for (const id of freewayCandidateIds(
      provider.moduleId,
      defaultInstanceIdsFor(provider.moduleId),
    )) {
      ids.add(id);
    }
  }
  return ids;
}

// POST /api/freeway/credential-marks/:moduleId/clear — manual recovery path
// alongside clearFreewayCredentialMarks' automatic one (fired when the vault
// writes a matching credential). Lets a user unstick a bucket stuck reporting
// bad credentials without having to re-save (or already know) the exact
// vault key that would trigger the automatic clear.
freewayRouter.post(
  '/credential-marks/:moduleId/clear',
  asyncHandler(async (req, res) => {
    const { moduleId } = req.params;
    // moduleId is a path param, so it must be checked against the real
    // candidate set before it ever reaches the ledger — otherwise a caller
    // could write an arbitrary `credential::<anything>` row.
    if (!validCredentialMarkIds().has(moduleId)) {
      res.status(400).json({ error: `Not a Freeway candidate module id: ${moduleId}` });
      return;
    }
    await getFreewayLedgerStore().setDisabled(freewayCredentialKey(moduleId), null);
    res.json({ cleared: true, moduleId });
  }),
);
