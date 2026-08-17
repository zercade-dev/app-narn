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
  FreewayBucketState,
  FreewayLedgerStore,
  FreewayWindowRef,
  FreewayWindowUsage,
} from '../../storage/types.js';
import { getFreewayLedgerStore, getGlobalConfigStore } from '../../storage/registry.js';
import { isCloudMode } from '../../identity/registry.js';
import { moduleRegistry } from '../M6-module-registry.js';
import { COPILOT_MODULE_ID } from '../../utils/copilot-config.js';
import type { BucketView } from './types.js';
import { recordGatePass } from './stats.js';

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
  /**
   * Test seam: base module id -> instance id, consulted ahead of
   * {@link freewayCandidateIds}' automatic order. Default reads
   * `WorkspaceSettings.freewayInstanceOverrides` from the global config
   * store. A stale entry (renamed/deleted/disabled/uncredentialed instance)
   * is never dispatched to — {@link freewayCandidateIds} only moves it to the
   * front of the list when it still names a live instance, and the
   * usability scan below falls through the rest of that list exactly as it
   * does for the fully-automatic case.
   */
  freewayInstanceOverrides?: Record<string, string>;
  cloudMode?: boolean;
  /**
   * Bucket states the caller already read this tick. Supplied so a caller that
   * needs them for its own resolution — M9 threads them into the Freeway
   * probe's dispatch-id lookup so the probe and this function can never
   * disagree — does not pay a second `listBuckets()` round trip for the same
   * rows. Absent means read them here, which is what every other caller does.
   */
  bucketStates?: readonly FreewayBucketState[];
}

/**
 * Default `moduleStatus`: a thin adapter over M6's metadata builder. Called
 * with no session/vault/global context, so it reports the module-registry's
 * baseline view only — real dispatch call sites inject a session-scoped
 * `moduleStatus` closure (mirroring how M9's callers thread `sessionId`
 * through `selectCapableModule`) rather than relying on this default.
 */
export function defaultModuleStatus(
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
 * Default `freewayInstanceOverrides`: the workspace's saved map, read once
 * per {@link loadBucketViews} call (never per-provider) via the same
 * per-tenant-cached `getSettings()` every other settings read already uses.
 */
async function defaultFreewayInstanceOverrides(): Promise<Record<string, string>> {
  const settings = await getGlobalConfigStore().getSettings();
  return settings.freewayInstanceOverrides ?? {};
}

/**
 * Candidate module ids that can serve one snapshot provider, best first:
 * an `overrideInstanceId` (when it still names a live instance of this base),
 * then `<base>:default`, then the base's remaining instances in id order,
 * then the bare base LAST. The product's enablement UX only ever enables
 * named instances, and M27 leaves a migrated workspace's bare base enabled
 * and credentialed but invisible in the UI — so preferring the base would
 * dispatch through configuration the user cannot see or edit. The base
 * remains a last-resort fallback for pre-instance workspaces, where it is the
 * only candidate.
 *
 * `overrideInstanceId` only ever REORDERS this list — it can promote an
 * existing candidate, never add one that `instanceIds` doesn't already
 * contain. A workspace override naming a renamed/deleted instance is
 * therefore inert here (ignored, not appended), and the caller's usual
 * best-first scan over the returned order is what supplies the "stale
 * override falls back to automatic" behaviour — this function makes that
 * fallback possible, it doesn't special-case it.
 */
export function freewayCandidateIds(
  baseModuleId: string,
  instanceIds: readonly string[],
  overrideInstanceId?: string,
): string[] {
  const preferred = buildModuleInstanceId(baseModuleId, DEFAULT_INSTANCE_SLUG);
  const rest = instanceIds.filter((id) => id !== preferred).sort((a, b) => a.localeCompare(b));
  const automatic = [
    ...(instanceIds.includes(preferred) ? [preferred] : []),
    ...rest,
    baseModuleId,
  ];
  const promoted =
    overrideInstanceId !== undefined && instanceIds.includes(overrideInstanceId)
      ? [overrideInstanceId, ...automatic]
      : automatic;
  return [...new Set(promoted)];
}

/**
 * The one algorithm that decides which candidate module id actually serves a
 * base module's Freeway traffic: the first id (in {@link freewayCandidateIds}
 * order, override promoted) that is credentialed, enabled, and not
 * credential-marked; falling back to the first credential-marked candidate so
 * callers can still report WHY nothing qualifies (`badCredentials: true`),
 * else `dispatchModuleId: undefined` when no candidate exists at all.
 *
 * {@link loadBucketViews} and the Freeway probe's credential lookup
 * (`credentialForFreewayProbe` in M9) both call this one function to decide
 * the dispatch id, and the probe seeds its vault walk with exactly the id
 * this function returns (never a raw, unfiltered override) — that shared
 * resolution is what guarantees the two can never disagree about which
 * account a base module's traffic goes through. An override this function
 * rejects (disabled, uncredentialed, or credential-marked) is rejected
 * identically everywhere else that calls it.
 */
export function resolveDispatchModuleId(
  baseModuleId: string,
  instanceIds: readonly string[],
  moduleStatus: (moduleId: string) => { credentialed: boolean; enabled: boolean } | undefined,
  credentialBad: (moduleId: string) => boolean,
  overrideInstanceId?: string,
): { dispatchModuleId: string | undefined; badCredentials: boolean } {
  // A candidate rejected ONLY for a bad credential is remembered: if no
  // candidate survives, callers can still explain the state (e.g. the panel
  // surfaces `badCredentials`; selection/planning exclude any bucket with a
  // disabledReason, so nothing dispatches to it either way).
  let markedCandidate: string | undefined;
  const usableModuleId = freewayCandidateIds(baseModuleId, instanceIds, overrideInstanceId).find(
    (id) => {
      const status = moduleStatus(id);
      if (status?.credentialed !== true || !status.enabled) return false;
      if (credentialBad(id)) {
        markedCandidate ??= id;
        return false;
      }
      return true;
    },
  );
  return {
    dispatchModuleId: usableModuleId ?? markedCandidate,
    badCredentials: usableModuleId === undefined,
  };
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
 * walking the candidates in {@link freewayCandidateIds}' ORDER — an
 * `overrideInstanceId` first (when it still names a live instance), then
 * each instance of that base module, then the bare env var last. For each
 * instance candidate, the credential itself is resolved the way M6's
 * `buildCredentialProvider` resolves it for real dispatch: the instance's own
 * DERIVED vault key (`deriveInstanceCredentialKey`) first, falling back to
 * the bare env var when the derived key is absent (mirroring `credentialState`'s
 * `fallbackFor`) — checked for THIS candidate before the walk moves on to the
 * next one. Instances SHARE the base module's credential by default (M6,
 * `buildCredentialProvider`), so a workspace whose only configured provider
 * is a named instance with no derived key of its own (e.g. `openrouter:mine`,
 * credentialed purely via base inheritance) still resolves here to the
 * SAME credential M6 would hand that instance — not a later candidate's own
 * derived key, and not silently nothing.
 *
 * The override MUST be threaded through here, not just into dispatch: the
 * probe overwrites the shared, base-id-keyed ledger cell with whichever
 * account it reads, and that cell is exactly what the override-selected
 * instance dispatches against next. Resolving `<base>:default`'s credential
 * while a different instance actually serves the workspace would silently
 * stamp the wrong account's usage onto the ledger cell that instance reads
 * headroom from.
 *
 * This function itself is order-only — it is not enablement- or
 * mark-aware, so in isolation it can differ from the candidate
 * `loadBucketViews` would actually dispatch with. The guarantee that the
 * probe reads usage for the SAME account Freeway dispatches through is NOT
 * made here: it is made by this function's one caller,
 * `credentialForFreewayProbe` in M9, which computes `dispatchModuleId` via
 * {@link resolveDispatchModuleId} — the SAME enablement- and
 * credential-mark-aware resolution `loadBucketViews` uses, fed the same
 * override — and passes THAT id (never the raw, unfiltered override) as
 * `overrideInstanceId` here. An override naming a disabled, uncredentialed,
 * or credential-marked instance therefore never reaches this function as an
 * `overrideInstanceId`; whatever `resolveDispatchModuleId` actually picked
 * does, so the walk below always starts from the id dispatch would use.
 * Called directly with an unfiltered `overrideInstanceId` (as tests do),
 * this function has no way to enforce that agreement on its own. An
 * override naming an instance with no derived key of its own is no longer a
 * dead end: the per-candidate base-env-var fallback above resolves it to the
 * base credential first (the account M6 would actually hand that instance),
 * and only continues the outer walk to the next candidate if BOTH the
 * derived key and the base env var are absent for it — so this still returns
 * SOME credential (the automatic one) rather than undefined whenever any
 * candidate in the walk is credentialed at all. `lookup` is a raw vault-key
 * reader (no module-id awareness); `instanceIdsFor` defaults to the live
 * registry.
 */
export function resolveFreewayProbeCredential(
  baseModuleId: string,
  envVar: string,
  lookup: (vaultKey: string) => string | undefined,
  instanceIdsFor: (baseModuleId: string) => string[] = defaultInstanceIdsFor,
  overrideInstanceId?: string,
): string | undefined {
  for (const candidateId of freewayCandidateIds(
    baseModuleId,
    instanceIdsFor(baseModuleId),
    overrideInstanceId,
  )) {
    const parsed = parseModuleInstanceId(candidateId);
    // Mirror M6's `buildCredentialProvider`/`credentialState` fallback
    // exactly: an instance's own derived key wins when present, otherwise it
    // inherits the base module's credential — checked for THIS candidate
    // before moving on to the next one in the walk. Without this inner
    // fallback, an instance credentialed only via base inheritance (M6's
    // documented default) has no derived key for `lookup` to find, so the
    // walk fell through to a LATER candidate's own derived key instead —
    // reading a different account than the one M6 actually resolves for
    // this instance.
    const value = parsed
      ? (lookup(deriveInstanceCredentialKey(envVar, parsed.slug)) ?? lookup(envVar))
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
 * This provider's shared per-MINUTE request ceiling, when declared — the
 * single predicate both `recordDispatch` and `sharedPoolMinuteRemaining`
 * consult for "does a pool rpm apply to this bucket", so the write and read
 * paths can never drift into two subtly different notions of pooled. Unlike
 * `hasSharedPool` (rpd-only, gates a DAY-scale allowance), this is
 * minute-scale and independent of it: a provider can have a shared rpm
 * without a shared rpd, or vice versa.
 */
function sharedMinutePoolLimit(provider: FreeTierProvider): number | undefined {
  return provider.sharedLimits?.find((limit) => limit.window === 'rpm')?.limit;
}

/**
 * Minute headroom of a provider's account-wide pool — its shared `rpm` limit
 * minus the requests every bucket spent THIS MINUTE against it. Folds the
 * per-model minute usage the caller already read (`entry.rpmUsage`) wherever
 * present — no extra ledger call for those. But a bucket whose model declares
 * no rpm/tpm of its own is never queried in that main pass, even though the
 * pool still applies to it (`recordDispatch` writes its rpm cell exactly
 * when {@link sharedMinutePoolLimit} is defined — the same predicate this
 * function gates on) — so for those, this reads the cell directly rather
 * than silently dropping their spend from the pool sum. Undefined when the
 * provider declares no shared rpm.
 */
async function sharedPoolMinuteRemaining(
  provider: FreeTierProvider,
  models: readonly ModelUsage[],
  ledger: FreewayLedgerStore,
  minuteStart: number,
): Promise<number | undefined> {
  const sharedRpm = sharedMinutePoolLimit(provider);
  if (sharedRpm === undefined) return undefined;
  let spent = 0;
  for (const entry of models) {
    if (entry.rpmUsage !== undefined) {
      spent += entry.rpmUsage.requests;
      continue;
    }
    const [usage] = await ledger.usage(entry.bucketKey, [{ kind: 'rpm', start: minuteStart }]);
    spent += usage.requests;
  }
  return Math.max(0, sharedRpm - spent);
}

/** Assemble live BucketViews for every snapshot bucket usable RIGHT NOW-ish. */
export async function loadBucketViews(now: number, deps?: BucketSourceDeps): Promise<BucketView[]> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const moduleStatus = deps?.moduleStatus ?? defaultModuleStatus;
  const instanceIdsFor = deps?.instanceIdsFor ?? defaultInstanceIdsFor;
  const instanceOverrides =
    deps?.freewayInstanceOverrides ?? (await defaultFreewayInstanceOverrides());
  const cloudMode = deps?.cloudMode ?? isCloudMode();
  const snapshot = getFreeTierSnapshot();
  const states = deps?.bucketStates ?? (await ledger.listBuckets());
  const stateByKey = new Map(states.map((s) => [s.bucketKey, s]));
  const credentialBad = (id: string): boolean =>
    stateByKey.get(freewayCredentialKey(id))?.disabledReason !== undefined;

  const views: BucketView[] = [];
  for (const [providerKey, provider] of Object.entries(snapshot.providers)) {
    if (cloudMode && provider.moduleId === COPILOT_MODULE_ID) continue;

    const { dispatchModuleId, badCredentials } = resolveDispatchModuleId(
      provider.moduleId,
      instanceIdsFor(provider.moduleId),
      moduleStatus,
      credentialBad,
      instanceOverrides[provider.moduleId],
    );
    if (dispatchModuleId === undefined) continue;

    // ONE usage read per model, covering the day cell AND whichever minute
    // cells (rpm/tpm) that model declares in the same round trip — shared by
    // that model's own headroom and (for models that declare rpm) the
    // provider's pool sum. A model with no rpm of its own but under a
    // shared-rpm provider is still spent against by recordDispatch, so
    // sharedPoolMinuteRemaining reads that cell separately below — the one
    // deliberate exception to "no second ledger call per model" here.
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
    const poolRemainingMinuteRequests = await sharedPoolMinuteRemaining(
      provider,
      models,
      ledger,
      windowStart('rpm', now, provider.resetTimeZone),
    );

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
 * apply. One `recordAttempt` call carries the SAME delta to every listed
 * cell — the day cell, and (when applicable) the current minute's rpm and/or
 * tpm cell — so token tallies land in the tpm cell the same way
 * {@link loadBucketViews} sums them back out (`inputTokens + outputTokens`)
 * when computing minute headroom. The rpm cell is written whenever the model
 * declares its own rpm OR its provider's {@link sharedMinutePoolLimit}
 * applies — a bucket capped by a shared per-minute pool spends that pool on
 * every dispatch even when the model itself has no rpm of its own, and this
 * must write exactly the cell `sharedPoolMinuteRemaining` folds back, or the
 * spend is invisible to `hasMinuteHeadroom`. The tpm cell is written only
 * when the model declares its own tpm — there is no shared tpm pool concept.
 * A model with neither its own window nor an applicable pool gets no minute
 * cell at all: writing one nobody will ever read is pure row growth on a
 * table with no pruning below the day scale.
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
  const poolRpm = sharedMinutePoolLimit(provider);
  if (minuteWindow.rpm !== undefined || minuteWindow.tpm !== undefined || poolRpm !== undefined) {
    // Same zone-independent floor loadBucketViews reads back from — rpm/tpm
    // ignore the zone argument, passed through only because the shared
    // windowStart signature takes one.
    const minuteStart = windowStart('rpm', now, provider.resetTimeZone);
    if (minuteWindow.rpm !== undefined || poolRpm !== undefined) {
      windows.push({ kind: 'rpm', start: minuteStart });
    }
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
  now: number,
  outcomes: Array<{ language: string; passed: boolean }>,
  deps?: BucketSourceDeps,
): Promise<void> {
  const ledger = deps?.ledger ?? getFreewayLedgerStore();
  const states = await ledger.listBuckets();
  const existing = states.find((s) => s.bucketKey === bucketKey);
  let stats = existing?.stats ?? {};
  for (const outcome of outcomes) {
    stats = recordGatePass(stats, outcome.language, outcome.passed, now);
  }
  await ledger.mergeStats(bucketKey, stats);
}
