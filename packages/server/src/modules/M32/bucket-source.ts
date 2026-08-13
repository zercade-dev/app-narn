/**
 * Assembles live BucketViews by joining the bundled free-tier snapshot against
 * the quota ledger and the module registry's credential/enable state, plus the
 * write-discipline helpers that keep the ledger current (dispatch recording,
 * cooldown, gate-outcome stats). Nothing else in M32 reads storage directly —
 * this is the one seam between the pure decision core and persistence.
 */
import type { FreeTierModel, FreeTierProvider, FreewayWindowKind } from '@zercade-dev/narn-shared';
import {
  freeTierProvider,
  getFreeTierSnapshot,
  nextReset,
  windowStart,
} from '@zercade-dev/narn-shared';
import type { FreewayLedgerStore, FreewayWindowRef } from '../../storage/types.js';
import { getFreewayLedgerStore } from '../../storage/registry.js';
import { isCloudMode } from '../../identity/registry.js';
import { moduleRegistry } from '../M6-module-registry.js';
import { COPILOT_MODULE_ID } from '../../utils/copilot-config.js';
import type { BucketView } from './types.js';
import { updateGatePassEma } from './stats.js';

const FLAP_WINDOW_MS = 5 * 60_000;

export function freewayBucketKey(moduleId: string, modelId: string): string {
  return `${moduleId}::${modelId}`;
}

export interface BucketSourceDeps {
  ledger?: FreewayLedgerStore;
  /** Test seam: candidate module metadata; default derives from the registry. */
  moduleStatus?: (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined;
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

/**
 * Day headroom of a provider's account-wide pool — its `sharedLimits` rpd minus
 * the requests EVERY one of its models spent in the same day window (OpenRouter
 * counts all `:free` models against one allowance). Undefined for providers
 * without such a pool, whose models are limited individually only.
 */
async function sharedPoolRemaining(
  provider: FreeTierProvider,
  now: number,
  ledger: FreewayLedgerStore,
): Promise<number | undefined> {
  const sharedRpd = provider.sharedLimits?.find((l) => l.window === 'rpd')?.limit;
  if (sharedRpd === undefined) return undefined;
  const start = windowStart('rpd', now, provider.resetTimeZone);
  let spent = 0;
  for (const model of provider.models) {
    const key = freewayBucketKey(provider.moduleId, model.id);
    const [usage] = await ledger.usage(key, [{ kind: 'rpd', start }]);
    spent += usage.requests;
  }
  return Math.max(0, sharedRpd - spent);
}

/** Assemble live BucketViews for every snapshot bucket usable RIGHT NOW-ish. */
export async function loadBucketViews(now: number, deps?: BucketSourceDeps): Promise<BucketView[]> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const moduleStatus = deps?.moduleStatus ?? defaultModuleStatus;
  const cloudMode = deps?.cloudMode ?? isCloudMode();
  const snapshot = getFreeTierSnapshot();
  const states = await ledger.listBuckets();
  const stateByKey = new Map(states.map((s) => [s.bucketKey, s]));

  const views: BucketView[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    if (cloudMode && provider.moduleId === COPILOT_MODULE_ID) continue;
    const status = moduleStatus(provider.moduleId);
    if (!status || !status.credentialed || !status.enabled) continue;

    const poolRemainingRequests = await sharedPoolRemaining(provider, now, ledger);

    for (const model of provider.models) {
      const dayWindow = resolveDayWindow(model);
      if (!dayWindow) continue;
      const bucketKey = freewayBucketKey(provider.moduleId, model.id);
      const start = windowStart(dayWindow.kind, now, provider.resetTimeZone);
      const [usage] = await ledger.usage(bucketKey, [{ kind: dayWindow.kind, start }]);
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
 * against the same exhausted pool. Flap detection stays a property of the bucket
 * that was actually struck. On a provider WITHOUT a shared pool the scope is
 * inert — a model-specific 429 must never sideline unrelated siblings.
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
  if (scope !== 'pool' || !resolved?.provider.sharedLimits) return;
  for (const model of resolved.provider.models) {
    const siblingKey = freewayBucketKey(resolved.provider.moduleId, model.id);
    if (siblingKey === bucketKey) continue;
    await ledger.setCooldown(siblingKey, until);
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
