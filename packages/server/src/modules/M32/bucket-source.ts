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
  deriveInstanceCredentialKey,
  freeTierModel,
  freeTierProvider,
  getFreeTierSnapshot,
  hasSharedPool,
  nextReset,
  parseModuleInstanceId,
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
 * Ledger key holding a candidate module's bad-credential mark. A credential is
 * a fact about a module id, not about one bucket: marking the shared
 * `<base>::<model>` bucket key would disable every sibling instance that could
 * still serve it. `credential::` is a reserved namespace — a bucket key is
 * `<moduleId>::<modelId>` and no module id is the literal `credential`.
 */
export function freewayCredentialKey(moduleId: string): string {
  return `credential::${moduleId}`;
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
 * Candidate module ids that can serve one snapshot provider, best first:
 * `<base>:default`, then the base's remaining instances in id order, then the
 * bare base LAST. The product's enablement UX only ever enables named
 * instances, and M27 leaves a migrated workspace's bare base enabled and
 * credentialed but invisible in the UI — so preferring the base would dispatch
 * through configuration the user cannot see or edit. The base remains a
 * last-resort fallback for pre-instance workspaces, where it is the only
 * candidate.
 */
export function freewayCandidateIds(
  baseModuleId: string,
  instanceIds: readonly string[],
): string[] {
  const preferred = buildModuleInstanceId(baseModuleId, DEFAULT_INSTANCE_SLUG);
  const rest = instanceIds.filter((id) => id !== preferred).sort((a, b) => a.localeCompare(b));
  const ordered = [...(instanceIds.includes(preferred) ? [preferred] : []), ...rest, baseModuleId];
  return [...new Set(ordered)];
}

/**
 * Base module id → its first declared manifest env var, read from the static
 * module index — imported LAZILY, inside the one function that needs it.
 *
 * `module-index.js` imports all ten module packages (each re-exporting its
 * `manifest.json`), so a static edge from this file would graft the entire
 * module registry onto every importer of bucket-source — M9, M25, M26,
 * M9/module-selection, routes/freeway, routes/vault — and through them onto
 * most of the server. That mapping is needed only when a credential is
 * written, so the import is paid there and nowhere else. The registry
 * (`moduleRegistry.getMetadata`) is NOT an alternative source here: it is
 * populated by `loadStatic` at boot, and this must also resolve manifest env
 * vars in contexts that never boot the registry.
 */
async function loadEnvVarLookup(): Promise<(baseModuleId: string) => string | undefined> {
  const { STATIC_MODULES } = await import('../module-index.js');
  const byBaseId = new Map(
    STATIC_MODULES.map((e) => [e.manifest.id, e.manifest.requiredEnvVars?.[0]] as const),
  );
  return (baseModuleId) => byBaseId.get(baseModuleId);
}

/**
 * Clear the bad-credential marks of every Freeway candidate whose vault key
 * appears in `updatedVaultKeys`. Called after a credential write: replacing the
 * key IS the recovery path, so the mark must not outlive it. A candidate's
 * vault key is the base module's manifest env var for the bare base, and
 * `deriveInstanceCredentialKey(envVar, slug)` for each instance.
 */
export async function clearFreewayCredentialMarks(
  updatedVaultKeys: readonly string[],
  deps: BucketSourceDeps = {},
): Promise<void> {
  const updated = new Set(updatedVaultKeys);
  if (updated.size === 0) return;
  const ledger = deps.ledger ?? getFreewayLedgerStore();
  const snapshot = getFreeTierSnapshot();
  const instanceIdsFor = deps.instanceIdsFor ?? defaultInstanceIdsFor;
  const envVarFor = await loadEnvVarLookup();

  const cleared = new Set<string>();
  for (const provider of Object.values(snapshot.providers)) {
    const envVar = envVarFor(provider.moduleId);
    if (envVar === undefined) continue;
    for (const candidateId of freewayCandidateIds(
      provider.moduleId,
      instanceIdsFor(provider.moduleId),
    )) {
      const parsed = parseModuleInstanceId(candidateId);
      const vaultKey = parsed ? deriveInstanceCredentialKey(envVar, parsed.slug) : envVar;
      if (!updated.has(vaultKey) || cleared.has(candidateId)) continue;
      cleared.add(candidateId);
      await ledger.setDisabled(freewayCredentialKey(candidateId), null);
    }
  }
}

/**
 * Resolve a Freeway probe's credential for a base module's manifest env var,
 * walking the candidates in {@link freewayCandidateIds}' ORDER — each instance
 * of that base module first, read from its DERIVED vault key
 * (`deriveInstanceCredentialKey`), then the bare env var last. Instance
 * credentials are never stored under the bare env var, so a workspace whose
 * only configured provider is a named instance (e.g. `openrouter:default`)
 * needs this fallback or the probe silently finds nothing.
 *
 * Order only — this is NOT mark-aware, so it can differ from the candidate
 * `loadBucketViews` would actually dispatch with: with `openrouter:default`
 * credential-marked and `openrouter:work` serving, the probe still returns
 * `:default`'s key and its usage call just fails (a probe failure is a silent
 * skip, never a run failure). `lookup` is a raw vault-key reader (no module-id
 * awareness); `instanceIdsFor` defaults to the live registry.
 */
export function resolveFreewayProbeCredential(
  baseModuleId: string,
  envVar: string,
  lookup: (vaultKey: string) => string | undefined,
  instanceIdsFor: (baseModuleId: string) => string[] = defaultInstanceIdsFor,
): string | undefined {
  for (const candidateId of freewayCandidateIds(baseModuleId, instanceIdsFor(baseModuleId))) {
    const parsed = parseModuleInstanceId(candidateId);
    const value = parsed
      ? lookup(deriveInstanceCredentialKey(envVar, parsed.slug))
      : lookup(envVar);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** The window that governs day-scale headroom for one snapshot model. */
interface DayWindow {
  kind: FreewayWindowKind;
  limit: number;
}

/**
 * `rpd` governs when present; char-only providers (no `rpd`) are governed by
 * `monthly_chars` instead. `rpm`/`tpm` never govern here — day-scale stock is
 * a separate concern from minute pacing, resolved by {@link resolveMinuteWindows}.
 * Undefined when a model has neither.
 */
function resolveDayWindow(model: FreeTierModel): DayWindow | undefined {
  const rpd = model.limits.find((l) => l.window === 'rpd');
  if (rpd) return { kind: 'rpd', limit: rpd.limit };
  const monthly = model.limits.find((l) => l.window === 'monthly_chars');
  if (monthly) return { kind: 'monthly_chars', limit: monthly.limit };
  return undefined;
}

/** The per-minute ceilings governing one snapshot model, when declared. */
interface MinuteWindow {
  rpm?: number;
  tpm?: number;
}

/**
 * The declared rpm/tpm ceilings for one snapshot model — the minute-scale
 * sibling of {@link resolveDayWindow}. Unlike the day window, rpm and tpm are
 * independent pacing constraints rather than alternatives: a model may
 * declare both (neither field wins over the other), either one, or neither.
 */
function resolveMinuteWindows(model: FreeTierModel): MinuteWindow {
  return {
    rpm: model.limits.find((l) => l.window === 'rpm')?.limit,
    tpm: model.limits.find((l) => l.window === 'tpm')?.limit,
  };
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
  const moduleId = freewayBucketBaseModuleId(bucketKey);
  const modelId = bucketKey.slice(sep + 2);
  const provider = freeTierProvider(moduleId);
  if (!provider) return undefined;
  const model = provider.models.find((m) => m.id === modelId);
  if (!model) return undefined;
  const dayWindow = resolveDayWindow(model);
  if (!dayWindow) return undefined;
  return { provider, model, dayWindow };
}

/** One model's day-scale and minute-scale windows, plus the usage already read for both. */
interface ModelUsage {
  model: FreeTierModel;
  dayWindow: DayWindow;
  bucketKey: string;
  usage: FreewayWindowUsage;
  minuteWindow: MinuteWindow;
  /** This minute's rpm cell, read only when the model declares rpm. */
  rpmUsage?: FreewayWindowUsage;
  /** This minute's tpm cell, read only when the model declares tpm. */
  tpmUsage?: FreewayWindowUsage;
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

/**
 * Minute headroom of a provider's account-wide pool — its shared `rpm` limit
 * minus the requests every model spent THIS MINUTE against its own rpm cell.
 * Pure, like {@link sharedPoolRemaining}: folds the per-model minute usage the
 * caller already read, so nothing here issues a ledger call of its own. A
 * shared per-minute cap is a pacing constraint rather than a day-scale
 * allowance (see `hasSharedPool`'s rpd-only rule), so this checks the
 * provider's `sharedLimits` directly instead of gating on `hasSharedPool` —
 * a provider can have a shared rpm without a shared rpd, or vice versa.
 * Undefined when the provider declares no shared rpm.
 */
function sharedPoolMinuteRemaining(
  provider: FreeTierProvider,
  models: readonly ModelUsage[],
): number | undefined {
  const sharedRpm = provider.sharedLimits?.find((l) => l.window === 'rpm')?.limit;
  if (sharedRpm === undefined) return undefined;
  let spent = 0;
  for (const entry of models) {
    if (entry.rpmUsage === undefined) continue;
    spent += entry.rpmUsage.requests;
  }
  return Math.max(0, sharedRpm - spent);
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
  const credentialBad = (id: string): boolean =>
    stateByKey.get(freewayCredentialKey(id))?.disabledReason !== undefined;

  const views: BucketView[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    if (cloudMode && provider.moduleId === COPILOT_MODULE_ID) continue;

    // A candidate rejected ONLY for a bad credential is remembered: if no
    // candidate survives, the provider's buckets are still emitted carrying
    // that reason, so the panel can explain the state (selector/planner
    // exclude any bucket with a disabledReason, so nothing dispatches to it).
    let markedCandidate: string | undefined;
    const usableModuleId = freewayCandidateIds(
      provider.moduleId,
      instanceIdsFor(provider.moduleId),
    ).find((id) => {
      const status = moduleStatus(id);
      if (status?.credentialed !== true || !status.enabled) return false;
      if (credentialBad(id)) {
        markedCandidate ??= id;
        return false;
      }
      return true;
    });
    const dispatchModuleId = usableModuleId ?? markedCandidate;
    if (dispatchModuleId === undefined) continue;
    const badCredentials = usableModuleId === undefined;

    // ONE usage read per model, covering the day cell AND whichever minute
    // cells (rpm/tpm) that model declares in the same round trip — shared by
    // that model's own headroom and by the provider's pool sums. Never a
    // second ledger call per model for the minute figures.
    const models: ModelUsage[] = [];
    for (const model of provider.models) {
      const dayWindow = resolveDayWindow(model);
      if (!dayWindow) continue;
      const bucketKey = freewayBucketKey(provider.moduleId, model.id);
      const minuteWindow = resolveMinuteWindows(model);
      // rpm/tpm float to the same zone-independent minute regardless of the
      // provider's day-scale reset zone (windowStart ignores the zone
      // argument for these two kinds) — passed through only because the
      // shared signature takes one.
      const minuteStart = windowStart('rpm', now, provider.resetTimeZone);
      const windows: FreewayWindowRef[] = [
        { kind: dayWindow.kind, start: windowStart(dayWindow.kind, now, provider.resetTimeZone) },
      ];
      if (minuteWindow.rpm !== undefined) windows.push({ kind: 'rpm', start: minuteStart });
      if (minuteWindow.tpm !== undefined) windows.push({ kind: 'tpm', start: minuteStart });
      const usageResults = await ledger.usage(bucketKey, windows);
      const usageByKind = new Map(usageResults.map((u) => [u.kind, u] as const));
      const usage = usageByKind.get(dayWindow.kind)!;
      models.push({
        model,
        dayWindow,
        bucketKey,
        usage,
        minuteWindow,
        rpmUsage: usageByKind.get('rpm'),
        tpmUsage: usageByKind.get('tpm'),
      });
    }
    const poolRemainingRequests = sharedPoolRemaining(provider, models);
    const poolRemainingMinuteRequests = sharedPoolMinuteRemaining(provider, models);

    for (const { model, dayWindow, bucketKey, usage, minuteWindow, rpmUsage, tpmUsage } of models) {
      const remainingRequests =
        dayWindow.kind === 'monthly_chars'
          ? Number.MAX_SAFE_INTEGER
          : Math.max(0, dayWindow.limit - usage.requests);
      const remainingChars =
        dayWindow.kind === 'monthly_chars' ? Math.max(0, dayWindow.limit - usage.chars) : undefined;
      const remainingMinuteRequests =
        minuteWindow.rpm === undefined
          ? undefined
          : Math.max(0, minuteWindow.rpm - (rpmUsage?.requests ?? 0));
      const remainingMinuteTokens =
        minuteWindow.tpm === undefined
          ? undefined
          : Math.max(
              0,
              minuteWindow.tpm - ((tpmUsage?.inputTokens ?? 0) + (tpmUsage?.outputTokens ?? 0)),
            );
      // A bucket can be capped by a shared rpm pool even when its OWN model
      // declares no rpm/tpm (an rpm-less model of an rpm-pooled provider), so
      // the reset time must follow whichever of "this model's own minute
      // window" or "a pool minute figure applies to it" is true — not just
      // the model's own declaration, or a drained pool would leave the
      // bucket ineligible with nowhere to resume to.
      const minuteResetAt =
        minuteWindow.rpm !== undefined ||
        minuteWindow.tpm !== undefined ||
        poolRemainingMinuteRequests !== undefined
          ? nextReset('rpm', now, provider.resetTimeZone)
          : undefined;
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
        remainingMinuteRequests,
        remainingMinuteTokens,
        minuteResetAt,
        poolRemainingMinuteRequests,
        nextResetAt: nextReset(dayWindow.kind, now, provider.resetTimeZone),
        cooldownUntil: state?.cooldownUntil,
        // Bucket-keyed disable rows written by pre-upgrade code are
        // deliberately no longer read here — a credential mark lives under
        // `freewayCredentialKey`, keyed on the module that actually failed,
        // not the shared bucket.
        disabledReason: badCredentials ? 'bad credentials' : undefined,
        stats: state?.stats ?? {},
      });
    }
  }
  return views;
}

/**
 * Record one dispatch attempt (requests=1 + token/char tallies) against a
 * bucket's day-scale window, plus whichever minute-scale windows (rpm/tpm)
 * the model actually declares. One `recordAttempt` call carries the SAME
 * delta to every listed cell — the day cell, and (when declared) the current
 * minute's rpm and/or tpm cell — so token tallies land in the tpm cell the
 * same way {@link loadBucketViews} sums them back out
 * (`inputTokens + outputTokens`) when computing minute headroom. A model
 * declaring neither rpm nor tpm gets no minute cell at all: writing one
 * nobody will ever read is pure row growth on a table with no pruning below
 * the day scale.
 */
export async function recordDispatch(
  bucketKey: string,
  now: number,
  usage: { inputTokens?: number; outputTokens?: number; chars?: number },
  deps?: BucketSourceDeps,
): Promise<void> {
  const resolved = resolveSnapshotBucket(bucketKey);
  if (!resolved) return;
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const { provider, model, dayWindow } = resolved;
  const windows: FreewayWindowRef[] = [
    { kind: dayWindow.kind, start: windowStart(dayWindow.kind, now, provider.resetTimeZone) },
  ];
  const minuteWindow = resolveMinuteWindows(model);
  if (minuteWindow.rpm !== undefined || minuteWindow.tpm !== undefined) {
    // Same zone-independent floor loadBucketViews reads back from — rpm/tpm
    // ignore the zone argument, passed through only because the shared
    // windowStart signature takes one.
    const minuteStart = windowStart('rpm', now, provider.resetTimeZone);
    if (minuteWindow.rpm !== undefined) windows.push({ kind: 'rpm', start: minuteStart });
    if (minuteWindow.tpm !== undefined) windows.push({ kind: 'tpm', start: minuteStart });
  }
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
