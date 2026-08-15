/**
 * Assembles live BucketViews by joining the bundled free-tier snapshot against
 * the quota ledger and the module registry's credential/enable state, plus the
 * write-discipline helpers that keep the ledger current (dispatch recording,
 * cooldown, gate-outcome stats). Nothing else in M32 reads storage directly —
 * this is the one seam between the pure decision core and persistence.
 */
import type { FreeTierModel, FreeTierProvider, FreewayWindowKind } from '@zercade-dev/narn-shared';
import {
  buildModuleInstanceId,
  DEFAULT_INSTANCE_SLUG,
  freeTierModel,
  freeTierProvider,
  getFreeTierSnapshot,
  hasSharedPool,
  nextReset,
  windowStart,
} from '@zercade-dev/narn-shared';
import type {
  FreewayLedgerStore,
  FreewayWindowRef,
  FreewayWindowUsage,
} from '../../storage/types.js';
import { getFreewayLedgerStore } from '../../storage/registry.js';
import { isCloudMode } from '../../identity/registry.js';
import { moduleRegistry } from '../M6-module-registry.js';
import { COPILOT_MODULE_ID } from '../../utils/copilot-config.js';
import type { BucketView } from './types.js';
import { updateGatePassEma } from './stats.js';

const FLAP_WINDOW_MS = 5 * 60_000;

/**
 * Upper bound on how long a shared-pool cooldown may sideline the buckets that
 * were NOT struck. Their exhaustion is inferred from a sibling's 429, never
 * observed, so the blast radius stays bounded: if the pool really is drained
 * for the day, each sibling re-cools itself on its own next 429, at a cost of
 * at most one request; if the limit was minute-scale or model-specific, the
 * siblings are back within the minute instead of parked until the daily reset.
 */
export const POOL_SIBLING_COOLDOWN_CAP_MS = 70_000;

export function freewayBucketKey(moduleId: string, modelId: string): string {
  return `${moduleId}::${modelId}`;
}

/**
 * Recovers the snapshot's base module id from a bucket key — the inverse of
 * the `moduleId` half of {@link freewayBucketKey}. `bucketKey` always keys on
 * the base id even when a bucket's `dispatchModuleId` is a named instance, so
 * callers that only have a bucket key in hand (not the BucketView) use this to
 * get back to the id `freewayModuleOverrides` and the snapshot lookups expect.
 */
export function freewayBucketBaseModuleId(bucketKey: string): string {
  const sep = bucketKey.indexOf('::');
  return sep === -1 ? bucketKey : bucketKey.slice(0, sep);
}

/**
 * Module-config values Freeway imposes on the instance serving a bucket, over
 * and above the model id — dispatch-time facts about the model, not user
 * preferences, so they are applied LAST and win over the effective
 * global/project config in BOTH directions (forcing a setting on and forcing
 * it off). Keys absent from the snapshot are absent here too, leaving the
 * user's config (and the module's own default) untouched.
 *
 * Freeway-routed jobs only: direct routing to the same module stays governed
 * by the user's configuration, which is why this is applied at the Freeway
 * dispatch sites rather than inside the shared config resolution.
 */
export function freewayModuleOverrides(moduleId: string, modelId: string): Record<string, unknown> {
  const model = freeTierModel(moduleId, modelId);
  if (model?.useStructuredOutput === undefined) return {};
  // Structured-output support is upstream-dependent and measured per model: a
  // model that mis-parses under a schema constraint (or pays a quality tax for
  // it) must run without it however the workspace has the module configured.
  return { useStructuredOutput: model.useStructuredOutput };
}

export interface BucketSourceDeps {
  ledger?: FreewayLedgerStore;
  /** Test seam: candidate module metadata; default derives from the registry. */
  moduleStatus?: (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined;
  /** Test seam: instance ids of a base module; default reads the registry. */
  instanceIdsFor?: (baseModuleId: string) => string[];
  cloudMode?: boolean;
}

/**
 * Default `moduleStatus`: a thin adapter over M6's metadata builder. Called
 * with no session/vault/global context, so it reports the module-registry's
 * baseline view only — real dispatch call sites inject a session-scoped
 * `moduleStatus` closure (mirroring how M9's callers thread `sessionId`
 * through `selectCapableModule`) rather than relying on this default.
 */
function defaultModuleStatus(
  moduleId: string,
): { credentialed: boolean; enabled: boolean } | undefined {
  const meta = moduleRegistry.getMetadata(moduleId);
  if (!meta) return undefined;
  return { credentialed: meta.credentialStatus === 'ok', enabled: meta.enabled };
}

/** Default `instanceIdsFor`: every registered instance of a base module, tenant-scoped. */
export function defaultInstanceIdsFor(baseModuleId: string): string[] {
  return moduleRegistry
    .listInstances()
    .filter((i) => i.baseModuleId === baseModuleId)
    .map((i) => i.instanceId);
}

/**
 * Candidate module ids that can serve one snapshot provider, best first: the
 * bare base (pre-instance workspaces), then `<base>:default`, then the base's
 * remaining instances in id order. Freeway dispatches through whichever of
 * these is credentialed AND enabled — the product's enablement UX only ever
 * enables named instances, so a base-only lookup finds nothing in any
 * workspace created after instances shipped.
 */
export function freewayCandidateIds(
  baseModuleId: string,
  instanceIds: readonly string[],
): string[] {
  const preferred = buildModuleInstanceId(baseModuleId, DEFAULT_INSTANCE_SLUG);
  const rest = instanceIds.filter((id) => id !== preferred).sort((a, b) => a.localeCompare(b));
  const ordered = [baseModuleId, ...(instanceIds.includes(preferred) ? [preferred] : []), ...rest];
  return [...new Set(ordered)];
}

/** The window that governs day-scale headroom for one snapshot model. */
interface DayWindow {
  kind: FreewayWindowKind;
  limit: number;
}

/**
 * `rpd` governs when present; char-only providers (no `rpd`) are governed by
 * `monthly_chars` instead. `rpm`/`tpm` never govern here — they are dispatcher
 * pacing concerns, not day-scale stock. Undefined when a model has neither.
 */
function resolveDayWindow(model: FreeTierModel): DayWindow | undefined {
  const rpd = model.limits.find((l) => l.window === 'rpd');
  if (rpd) return { kind: 'rpd', limit: rpd.limit };
  const monthly = model.limits.find((l) => l.window === 'monthly_chars');
  if (monthly) return { kind: 'monthly_chars', limit: monthly.limit };
  return undefined;
}

interface ResolvedSnapshotBucket {
  provider: FreeTierProvider;
  model: FreeTierModel;
  dayWindow: DayWindow;
}

/** Reverses a `moduleId::modelId` bucket key back to its snapshot entry. */
function resolveSnapshotBucket(bucketKey: string): ResolvedSnapshotBucket | undefined {
  const sep = bucketKey.indexOf('::');
  if (sep === -1) return undefined;
  const moduleId = bucketKey.slice(0, sep);
  const modelId = bucketKey.slice(sep + 2);
  const provider = freeTierProvider(moduleId);
  if (!provider) return undefined;
  const model = provider.models.find((m) => m.id === modelId);
  if (!model) return undefined;
  const dayWindow = resolveDayWindow(model);
  if (!dayWindow) return undefined;
  return { provider, model, dayWindow };
}

/** One model's day-scale window and the usage already read for it. */
interface ModelUsage {
  model: FreeTierModel;
  dayWindow: DayWindow;
  bucketKey: string;
  usage: FreewayWindowUsage;
}

/**
 * Day headroom of a provider's account-wide pool — its shared `rpd` limit minus
 * the requests every RPD-GOVERNED model spent in that window (OpenRouter counts
 * all `:free` models against one allowance). Pure: it folds the per-model usage
 * the caller has already read, so a pooled provider's cells are queried once,
 * not once for the pool sum and again for each model's own headroom. Undefined
 * for providers without a shared day budget, whose models are limited
 * individually only.
 */
function sharedPoolRemaining(
  provider: FreeTierProvider,
  models: readonly ModelUsage[],
): number | undefined {
  if (!hasSharedPool(provider)) return undefined;
  const sharedRpd = provider.sharedLimits?.find((l) => l.window === 'rpd')?.limit;
  if (sharedRpd === undefined) return undefined;
  let spent = 0;
  for (const entry of models) {
    // A char-governed model in a pooled provider has no rpd cell to fold in.
    if (entry.dayWindow.kind !== 'rpd') continue;
    spent += entry.usage.requests;
  }
  return Math.max(0, sharedRpd - spent);
}

/** Assemble live BucketViews for every snapshot bucket usable RIGHT NOW-ish. */
export async function loadBucketViews(now: number, deps?: BucketSourceDeps): Promise<BucketView[]> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const moduleStatus = deps?.moduleStatus ?? defaultModuleStatus;
  const instanceIdsFor = deps?.instanceIdsFor ?? defaultInstanceIdsFor;
  const cloudMode = deps?.cloudMode ?? isCloudMode();
  const snapshot = getFreeTierSnapshot();
  const states = await ledger.listBuckets();
  const stateByKey = new Map(states.map((s) => [s.bucketKey, s]));

  const views: BucketView[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    if (cloudMode && provider.moduleId === COPILOT_MODULE_ID) continue;
    // The bare base is checked first and, when usable, wins outright without
    // ever consulting instances — this keeps a pre-instance workspace's
    // resolution exactly as cheap (and as observable) as before instances
    // existed. Only a base that is NOT itself usable pays for the instance
    // lookup, walking the rest of freewayCandidateIds' ordered list.
    const baseStatus = moduleStatus(provider.moduleId);
    const dispatchModuleId =
      baseStatus?.credentialed === true && baseStatus.enabled
        ? provider.moduleId
        : freewayCandidateIds(provider.moduleId, instanceIdsFor(provider.moduleId)).find((id) => {
            const status = moduleStatus(id);
            return status?.credentialed === true && status.enabled;
          });
    if (dispatchModuleId === undefined) continue;

    // ONE usage read per model, shared by that model's own headroom and by the
    // provider's pool sum.
    const models: ModelUsage[] = [];
    for (const model of provider.models) {
      const dayWindow = resolveDayWindow(model);
      if (!dayWindow) continue;
      const bucketKey = freewayBucketKey(provider.moduleId, model.id);
      const start = windowStart(dayWindow.kind, now, provider.resetTimeZone);
      const [usage] = await ledger.usage(bucketKey, [{ kind: dayWindow.kind, start }]);
      models.push({ model, dayWindow, bucketKey, usage });
    }
    const poolRemainingRequests = sharedPoolRemaining(provider, models);

    for (const { model, dayWindow, bucketKey, usage } of models) {
      const remainingRequests =
        dayWindow.kind === 'monthly_chars'
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, dayWindow.limit - usage.requests);
      const remainingChars =
        dayWindow.kind === 'monthly_chars' ? Math.max(0, dayWindow.limit - usage.chars) : undefined;
      const state = stateByKey.get(bucketKey);
      views.push({
        bucketKey,
        moduleId: provider.moduleId,
        dispatchModuleId,
        providerKey,
        modelId: model.id,
        qualityTier: model.qualityTier,
        maxBatch: model.maxBatch,
        weakLanguages: model.weakLanguages,
        remainingRequests,
        remainingChars,
        poolKey: poolRemainingRequests === undefined ? undefined : providerKey,
        poolRemainingRequests,
        nextResetAt: nextReset(dayWindow.kind, now, provider.resetTimeZone),
        cooldownUntil: state?.cooldownUntil,
        disabledReason: state?.disabledReason,
        stats: state?.stats ?? {},
      });
    }
  }
  return views;
}

/** Record one dispatch attempt (requests=1 + token/char tallies) against a bucket's day-scale window(s). */
export async function recordDispatch(
  bucketKey: string,
  now: number,
  usage: { inputTokens?: number; outputTokens?: number; chars?: number },
  deps?: BucketSourceDeps,
): Promise<void> {
  const resolved = resolveSnapshotBucket(bucketKey);
  if (!resolved) return;
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const { provider, dayWindow } = resolved;
  const start = windowStart(dayWindow.kind, now, provider.resetTimeZone);
  const windows: FreewayWindowRef[] = [{ kind: dayWindow.kind, start }];
  await ledger.recordAttempt(bucketKey, windows, {
    requests: 1,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    chars: usage.chars,
  });
}

/**
 * 429/quota error: cooldown until retryAfterMs (when given) else the bucket's
 * next day-scale reset; flap-bumps when already recently cooled.
 *
 * `scope: 'pool'` widens the cooldown to every bucket of a provider whose quota
 * is account-wide (`sharedLimits`): a 429 there is a statement about the shared
 * allowance, so rerouting to a sibling model would only spend another request
 * against the same exhausted pool. The struck bucket keeps the full `until`;
 * siblings get a capped, never-shortening cool (see
 * {@link POOL_SIBLING_COOLDOWN_CAP_MS}). Flap detection stays a property of the
 * bucket that was actually struck. On a provider WITHOUT a shared pool the scope
 * is inert — a model-specific 429 must never sideline unrelated siblings.
 */
export async function coolBucket(
  bucketKey: string,
  now: number,
  retryAfterMs: number | undefined,
  deps?: BucketSourceDeps,
  scope: 'bucket' | 'pool' = 'bucket',
): Promise<void> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const states = await ledger.listBuckets();
  const existing = states.find((s) => s.bucketKey === bucketKey);
  const flap =
    existing?.cooldownUntil !== undefined &&
    existing.cooldownUntil <= now &&
    now - existing.cooldownUntil < FLAP_WINDOW_MS;
  const resolved = resolveSnapshotBucket(bucketKey);
  let until: number;
  if (retryAfterMs !== undefined) {
    until = now + retryAfterMs;
  } else {
    until = resolved
      ? nextReset(resolved.dayWindow.kind, now, resolved.provider.resetTimeZone)
      : now;
  }
  await ledger.setCooldown(bucketKey, until, flap ? { flap: true } : undefined);
  if (scope !== 'pool' || !resolved || !hasSharedPool(resolved.provider)) return;
  const siblingUntil = Math.min(until, now + POOL_SIBLING_COOLDOWN_CAP_MS);
  for (const model of resolved.provider.models) {
    const siblingKey = freewayBucketKey(resolved.provider.moduleId, model.id);
    if (siblingKey === bucketKey) continue;
    const prior = states.find((s) => s.bucketKey === siblingKey)?.cooldownUntil ?? 0;
    // Never shorten: a sibling already sidelined for longer (its own 429, or a
    // provider-error cool on a retired model) must stay sidelined.
    await ledger.setCooldown(siblingKey, Math.max(prior, siblingUntil));
  }
}

/** Fold one run's gate outcomes into stats: ONE read + ONE mergeStats per bucket. */
export async function recordGateOutcomes(
  bucketKey: string,
  outcomes: Array<{ language: string; passed: boolean }>,
  deps?: BucketSourceDeps,
): Promise<void> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const states = await ledger.listBuckets();
  const existing = states.find((s) => s.bucketKey === bucketKey);
  let stats = existing?.stats ?? {};
  for (const outcome of outcomes) {
    stats = updateGatePassEma(stats, outcome.language, outcome.passed);
  }
  await ledger.mergeStats(bucketKey, stats);
}
