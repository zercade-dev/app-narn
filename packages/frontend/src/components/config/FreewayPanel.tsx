/**
 * FreewayPanel — Global Config section for NARN Freeway: a checklist of the
 * bundled free-tier providers (which have a key) plus a live status table of
 * every snapshot bucket (state, remaining quota, next reset, observed pass
 * rate).
 *
 * Collapsed by default (it otherwise dominates the Global Config page) and
 * fetches `GET /api/freeway/status` (read-only, session-aware — a locked
 * vault simply reports every bucket 'uncredentialed') only after the first
 * expand; collapsing again keeps the already-loaded data.
 *
 * Module enable/disable is deliberately NOT duplicated here: a provider whose
 * key is set but whose module is toggled off shows a hint plus a button that
 * scrolls to where the user can turn it back on — see
 * {@link scrollToEnableTarget}.
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
import type { ModuleInstance } from '@zercade-dev/narn-shared';
import { apiRequest, ApiError } from '../../hooks/use-api.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { relativeTime } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

/** Sentinel `Select` value that clears a provider's `freewayInstanceOverrides`
 * entry (automatic candidate resolution). Instance ids always contain a `:`
 * (`<base>:<slug>`), so this bare word can never collide with a real one. */
const AUTOMATIC_OVERRIDE_VALUE = 'automatic';

/** Sentinel `Select` value that excludes a provider from Freeway's automatic
 * pool entirely (`WorkspaceSettings.freewayDisabledProviders`). Same
 * bare-word reasoning as {@link AUTOMATIC_OVERRIDE_VALUE} — instance ids
 * always contain a `:`. */
const DISABLED_OVERRIDE_VALUE = 'disabled';

/**
 * Load state for `freewayInstanceOverrides`. Three states, not two: `{}` is a
 * legitimate loaded value (no provider has an override) and must stay
 * distinguishable from "the GET hasn't succeeded yet" — collapsing them would
 * let a silent load failure masquerade as an empty map, and the first edit made
 * against that empty map would overwrite every other provider's real override.
 */
type OverridesLoadState = 'loading' | 'loaded' | 'failed';

type FreewayBucketState = 'ready' | 'cooling' | 'exhausted' | 'disabled' | 'uncredentialed';

interface FreewayStatusBucket {
  bucketKey: string;
  providerKey: string;
  moduleId: string;
  modelId: string;
  qualityTier: 1 | 2 | 3 | 4;
  remainingRequests: number;
  remainingChars?: number;
  nextResetAt: number;
  state: FreewayBucketState;
  disabledReason?: string;
  gatePassByLanguage?: Record<string, number>;
  /** Set when this bucket shares a day-scale pool with sibling buckets; equals providerKey. */
  poolKey?: string;
  /** The module/instance id actually serving this LIVE bucket, when it differs from `moduleId`. */
  dispatchModuleId?: string;
  /** For a 'disabled' missing row: the candidate id "Enable it" should scroll to / turn on. */
  enableTargetModuleId?: string;
  /**
   * The Freeway candidate that actually carries the bad-credential mark, present
   * only when `disabledReason` is the bad-credentials reason. Always paired with
   * {@link credentialKeyName}. Pass to `POST /freeway/credential-marks/:id/clear`.
   */
  credentialMarkModuleId?: string;
  /** The vault key writing would clear {@link credentialMarkModuleId}'s mark. */
  credentialKeyName?: string;
}

interface FreewayStatusResponse {
  buckets: FreewayStatusBucket[];
  generatedAt: number;
}

const EMPTY_STATUS: FreewayStatusResponse = {
  buckets: [],
  generatedAt: 0,
};

/** Mirrors the server's `MODULE_DISABLED_REASON` (routes/freeway.ts). */
const MODULE_DISABLED_REASON = 'module-disabled';

/** Mirrors the server's `FREEWAY_DISABLED_REASON` (routes/freeway.ts). */
const FREEWAY_DISABLED_REASON = 'freeway-disabled';

/**
 * Display names for the bundled snapshot's providers — a small, stable set;
 * falls back to the raw key for any future provider added to the snapshot.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  google: 'Google',
  openrouter: 'OpenRouter',
  deepl: 'DeepL',
  copilot: 'GitHub Copilot',
  groq: 'Groq',
};

function providerDisplayName(providerKey: string): string {
  return PROVIDER_DISPLAY_NAMES[providerKey] ?? providerKey;
}

/** Formats a bucket's (or a pool's) day-scale remaining allowance the same way for both. */
function formatRemaining(
  bucket: Pick<FreewayStatusBucket, 'remainingChars' | 'remainingRequests'>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return bucket.remainingChars !== undefined
    ? t('freeway.remainingChars', { count: bucket.remainingChars })
    : t('freeway.remainingRequests', { count: bucket.remainingRequests });
}

const STATE_BADGE_VARIANT: Record<
  FreewayBucketState,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  ready: 'default',
  cooling: 'secondary',
  exhausted: 'destructive',
  disabled: 'outline',
  uncredentialed: 'outline',
};

interface ProviderSummary {
  providerKey: string;
  moduleId: string;
  /** The module/instance id actually serving this provider, when it differs from `moduleId`. */
  dispatchModuleId?: string;
  keyPresent: boolean;
  /** True only for the 'module-disabled' reason — a credentialed module the user toggled off. */
  moduleDisabled: boolean;
  /**
   * The disabledReason text for a 'disabled' bucket whose reason ISN'T
   * 'module-disabled' or 'freeway-disabled' (e.g. a ledger-recorded hard stop
   * like bad credentials) — shown as a state chip instead of the
   * enable-module hint, since enabling the module wouldn't fix it.
   * 'freeway-disabled' gets no chip of its own: the per-provider selector
   * below already shows "Disabled" for it, so a second chip here would be
   * redundant.
   */
  otherDisabledReason?: string;
  /** First non-empty `enableTargetModuleId` seen across this provider's buckets. */
  enableTargetModuleId?: string;
  /** First non-empty `credentialMarkModuleId`/`credentialKeyName` pair seen across this provider's buckets. */
  credentialMarkModuleId?: string;
  credentialKeyName?: string;
}

/** One row per distinct providerKey, in first-seen order. */
function summarizeProviders(buckets: readonly FreewayStatusBucket[]): ProviderSummary[] {
  const order: string[] = [];
  const byKey = new Map<string, ProviderSummary>();
  for (const bucket of buckets) {
    let summary = byKey.get(bucket.providerKey);
    if (!summary) {
      summary = {
        providerKey: bucket.providerKey,
        moduleId: bucket.moduleId,
        keyPresent: false,
        moduleDisabled: false,
      };
      byKey.set(bucket.providerKey, summary);
      order.push(bucket.providerKey);
    }
    if (bucket.state !== 'uncredentialed') summary.keyPresent = true;
    if (bucket.state === 'disabled') {
      if (bucket.disabledReason === MODULE_DISABLED_REASON) {
        summary.moduleDisabled = true;
      } else if (bucket.disabledReason && bucket.disabledReason !== FREEWAY_DISABLED_REASON) {
        summary.otherDisabledReason = bucket.disabledReason;
      }
    }
    if (!summary.enableTargetModuleId && bucket.enableTargetModuleId) {
      summary.enableTargetModuleId = bucket.enableTargetModuleId;
    }
    if (!summary.dispatchModuleId && bucket.dispatchModuleId) {
      summary.dispatchModuleId = bucket.dispatchModuleId;
    }
    if (!summary.credentialMarkModuleId && bucket.credentialMarkModuleId) {
      summary.credentialMarkModuleId = bucket.credentialMarkModuleId;
      summary.credentialKeyName = bucket.credentialKeyName;
    }
  }
  return order.map((key) => byKey.get(key)!);
}

/** One status-table row: either a standalone bucket, or a pool header plus its member buckets. */
type StatusRowItem =
  | { kind: 'bucket'; bucket: FreewayStatusBucket }
  | { kind: 'pool'; poolKey: string; members: FreewayStatusBucket[] };

/**
 * Groups buckets sharing a `poolKey` (a day-scale allowance actually shared
 * across several models, e.g. OpenRouter's free tier) into one row, so the
 * panel doesn't render the same day allowance three times over and imply
 * 3x the real headroom. First-seen order, same idiom as
 * {@link summarizeProviders}: a pool's row lands at the position of its
 * FIRST member bucket, and every later bucket sharing that poolKey folds
 * into the existing group rather than starting a new row. Buckets with no
 * `poolKey` render exactly as a standalone row, unchanged.
 *
 * A `poolKey` that (in this status snapshot) has only ever gathered ONE
 * member never gets a header: "pool" is a claim about sharing, and a header
 * row over a single model reads as implying pooling that isn't observably
 * happening, plus it costs an extra row for no information. Such an item is
 * demoted back to a plain `bucket` row before returning.
 */
function groupStatusRows(buckets: readonly FreewayStatusBucket[]): StatusRowItem[] {
  const items: StatusRowItem[] = [];
  const poolIndex = new Map<string, number>();
  for (const bucket of buckets) {
    if (bucket.poolKey === undefined) {
      items.push({ kind: 'bucket', bucket });
      continue;
    }
    const existingIndex = poolIndex.get(bucket.poolKey);
    if (existingIndex === undefined) {
      poolIndex.set(bucket.poolKey, items.length);
      items.push({ kind: 'pool', poolKey: bucket.poolKey, members: [bucket] });
    } else {
      const item = items[existingIndex];
      if (item.kind === 'pool') item.members.push(bucket);
    }
  }
  return items.map((item) =>
    item.kind === 'pool' && item.members.length === 1
      ? { kind: 'bucket', bucket: item.members[0] }
      : item,
  );
}

/** The N languages with the lowest observed LQA-gate pass rate, lowest first. */
function worstPassRates(
  byLanguage: Record<string, number> | undefined,
  count: number,
): Array<[string, number]> {
  if (!byLanguage) return [];
  return Object.entries(byLanguage)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count);
}

/**
 * Scroll to where the user can actually turn this module back on: its settings
 * card when one is rendered (enabled-but-inactive), else the "Enable a module"
 * selector — a disabled module renders no card at all.
 */
function scrollToEnableTarget(moduleId: string | undefined): void {
  const card = moduleId ? document.querySelector(`[data-testid="module-card-${moduleId}"]`) : null;
  const target = card ?? document.querySelector('[data-testid="enable-module-selector"]');
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * A 'disabled' bucket's badge text depends on WHY, not just that it is:
 * `module-disabled` and `freeway-disabled` each have their own label; any
 * other reason (e.g. a ledger-recorded hard stop like bad credentials) falls
 * back to "Bad credentials". Non-disabled states map straight to their own key.
 */
function bucketStateLabel(
  bucket: Pick<FreewayStatusBucket, 'state' | 'disabledReason'>,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (bucket.state !== 'disabled') return t(`freeway.state.${bucket.state}`);
  if (bucket.disabledReason === MODULE_DISABLED_REASON) return t('freeway.state.disabled');
  if (bucket.disabledReason === FREEWAY_DISABLED_REASON) return t('freeway.state.freewayDisabled');
  return t('freeway.state.badCredentials');
}

/**
 * One status-table row for a single bucket. `showRemaining` is false for a
 * pool's member rows — their shared day allowance is already shown once on
 * the pool header row above them, so repeating it per model would recreate
 * the "3x the real headroom" illusion this grouping exists to kill.
 */
function BucketRow({
  bucket,
  showRemaining,
  t,
}: {
  bucket: FreewayStatusBucket;
  showRemaining: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}): React.JSX.Element {
  return (
    <TableRow data-testid={`freeway-bucket-row-${bucket.bucketKey}`}>
      <TableCell>
        <div className="font-mono text-xs">{bucket.modelId}</div>
        <div className="text-xs text-muted-foreground">
          {providerDisplayName(bucket.providerKey)}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={STATE_BADGE_VARIANT[bucket.state]}
          data-testid={`freeway-state-${bucket.bucketKey}`}
        >
          {bucketStateLabel(bucket, t)}
        </Badge>
      </TableCell>
      {showRemaining ? (
        <TableCell data-testid={`freeway-remaining-${bucket.bucketKey}`}>
          {formatRemaining(bucket, t)}
        </TableCell>
      ) : (
        // Suppressed for a pool member: the shared allowance already shows
        // once on the pool header row above. An em dash (not a blank cell)
        // marks that as intentional rather than a missing value.
        <TableCell
          className="text-muted-foreground"
          data-testid={`freeway-remaining-suppressed-${bucket.bucketKey}`}
        >
          —
        </TableCell>
      )}
      <TableCell data-testid={`freeway-next-reset-${bucket.bucketKey}`}>
        {new Date(bucket.nextResetAt).toLocaleString()}
      </TableCell>
      <TableCell data-testid={`freeway-pass-rate-${bucket.bucketKey}`}>
        {worstPassRates(bucket.gatePassByLanguage, 2)
          .map(([language, rate]) =>
            t('freeway.passRateEntry', { language, rate: Math.round(rate * 100) }),
          )
          .join(' · ')}
      </TableCell>
    </TableRow>
  );
}

export function FreewayPanel(): React.JSX.Element {
  const { t } = useTranslation('config');
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);

  const {
    data: status,
    loading,
    reload,
  } = useAsyncData<FreewayStatusResponse>(
    (signal) =>
      hasOpened
        ? apiRequest<Partial<FreewayStatusResponse>>('/freeway/status', { signal }).then((res) => ({
            buckets: res.buckets ?? [],
            generatedAt: res.generatedAt ?? 0,
          }))
        : Promise.resolve(EMPTY_STATUS),
    [hasOpened],
    {
      initial: EMPTY_STATUS,
      onError: (err) => toast.error(t('freeway.loadFailed', { message: (err as Error).message })),
    },
  );

  const providers = summarizeProviders(status.buckets);
  const statusRows = groupStatusRows(status.buckets);

  // Module instances (for the per-provider "which instance serves this"
  // picker) and the persisted overrides map — both loaded once, alongside the
  // status fetch above, the first time the panel is opened.
  const { data: instances } = useAsyncData<ModuleInstance[]>(
    (signal) =>
      hasOpened
        ? apiRequest<{ instances?: ModuleInstance[] }>('/global-config/instances', {
            signal,
          }).then((res) => res.instances ?? [])
        : Promise.resolve([]),
    [hasOpened],
    {
      initial: [],
      // Without this, a failure here silently empties the instance list —
      // the per-provider selector just disappears with no explanation,
      // unlike every other Freeway-panel load (status, overrides) which
      // toasts. `[]` on failure still degrades safely (no selector, no crash),
      // this just tells the user why.
      onError: (err) =>
        toast.error(t('freeway.instancesLoadFailed', { message: (err as Error).message })),
    },
  );

  // Credential-mark ids currently being cleared, so their "Try again" button can
  // be disabled for the duration of the request — otherwise a double click could
  // fire the clear POST twice.
  const [retryingCredentialMarkIds, setRetryingCredentialMarkIds] = useState<Set<string>>(
    new Set(),
  );

  const handleCredentialMarkRetry = (moduleId: string) => {
    if (retryingCredentialMarkIds.has(moduleId)) return;
    setRetryingCredentialMarkIds((prev) => new Set(prev).add(moduleId));
    apiRequest(`/freeway/credential-marks/${encodeURIComponent(moduleId)}/clear`, {
      method: 'POST',
    })
      .then(() => reload())
      .catch((err) => {
        const code =
          err instanceof ApiError ? (err.data as { error?: string } | undefined)?.error : undefined;
        toast.error(
          code === 'not-freeway-candidate'
            ? t('freeway.credentialMarkErrorNotCandidate')
            : t('freeway.credentialMarkClearFailed', { message: (err as Error).message }),
        );
      })
      .finally(() => {
        setRetryingCredentialMarkIds((prev) => {
          const next = new Set(prev);
          next.delete(moduleId);
          return next;
        });
      });
  };

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [disabledProviders, setDisabledProviders] = useState<Set<string>>(new Set());
  const [overridesState, setOverridesState] = useState<OverridesLoadState>('loading');
  // Serializes writes to /global-config/settings: each write's PUT is chained behind
  // the previous one's completion (not just its optimistic local-state update), so two
  // rapid provider changes can never have their network requests land out of order —
  // a reordered arrival would let an earlier, smaller payload overwrite a later one.
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  const loadOverrides = useCallback(() => {
    setOverridesState('loading');
    return apiRequest<{
      freewayInstanceOverrides?: Record<string, string>;
      freewayDisabledProviders?: string[];
    }>('/global-config/settings')
      .then((res) => {
        setOverrides(res.freewayInstanceOverrides ?? {});
        setDisabledProviders(new Set(res.freewayDisabledProviders ?? []));
        setOverridesState('loaded');
      })
      .catch((err) => {
        setOverridesState('failed');
        toast.error(t('freeway.instanceOverridesLoadFailed', { message: (err as Error).message }));
      });
  }, [t]);

  useEffect(() => {
    // `loadOverrides`'s own reset (setOverridesState('loading')) is independent of the
    // fetch result — only its .then/.catch reflect what the fetch actually returned —
    // so this can't cause the cascading render react-hooks/set-state-in-effect guards
    // against; same reasoning useAsyncData documents for its own unconditional
    // setLoading(true).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hasOpened) void loadOverrides();
  }, [hasOpened, loadOverrides]);

  // Persists a per-provider routing choice: a specific instance, "Automatic"
  // (clears the override), or "Disabled" (excludes the provider from
  // Freeway's automatic pool entirely). Read-modify-write of the whole
  // override map / disabled set so an unrelated provider's setting is never
  // disturbed by this one's change. Guarded by `overridesState === 'loaded'`
  // (selectors are also disabled in that case) so a write is never built from
  // state that either hasn't arrived yet or is known to have failed to load.
  // A failed PUT means local state may have diverged from the server's, so it
  // re-fetches the authoritative settings rather than leaving the panel
  // willing to write a now-stale value on the next edit.
  //
  // The two settings are independent — disabling a provider does not touch
  // its pinned instance, so re-enabling it restores that choice — but PUT
  // only ever carries `freewayDisabledProviders` when leaving or entering the
  // disabled set, matching the existing convention that an unrelated field
  // is never sent in a write it didn't change.
  const handleProviderRoutingChange = (baseModuleId: string, value: string | null) => {
    if (overridesState !== 'loaded') return;
    const wasDisabled = disabledProviders.has(baseModuleId);
    const body: {
      freewayInstanceOverrides?: Record<string, string>;
      freewayDisabledProviders?: string[];
    } = {};

    if (value === DISABLED_OVERRIDE_VALUE) {
      const nextDisabled = new Set(disabledProviders).add(baseModuleId);
      setDisabledProviders(nextDisabled);
      body.freewayDisabledProviders = [...nextDisabled];
    } else {
      const nextOverrides = { ...overrides };
      if (!value || value === AUTOMATIC_OVERRIDE_VALUE) {
        delete nextOverrides[baseModuleId];
      } else {
        nextOverrides[baseModuleId] = value;
      }
      setOverrides(nextOverrides);
      body.freewayInstanceOverrides = nextOverrides;
      if (wasDisabled) {
        const nextDisabled = new Set(disabledProviders);
        nextDisabled.delete(baseModuleId);
        setDisabledProviders(nextDisabled);
        body.freewayDisabledProviders = [...nextDisabled];
      }
    }

    writeChainRef.current = writeChainRef.current
      .then(() =>
        apiRequest('/global-config/settings', {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      )
      .then(() => undefined)
      .catch((err) => {
        toast.error(t('freeway.instanceOverrideSaveFailed', { message: (err as Error).message }));
        void loadOverrides();
      });
  };

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setHasOpened(true);
      }}
    >
      <Card data-testid="freeway-panel">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <CollapsibleTrigger
            className="group flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
            data-testid="freeway-toggle"
            aria-label={t('freeway.toggleAria')}
          >
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            <div className="min-w-0">
              <CardTitle>{t('freeway.title')}</CardTitle>
              <CardDescription>{t('freeway.description')}</CardDescription>
            </div>
          </CollapsibleTrigger>
          {open && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => reload()}
              disabled={loading}
              data-testid="freeway-refresh-button"
            >
              <RotateCcw className="size-3.5" />
              {t('freeway.refresh')}
            </Button>
          )}
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {!vaultUnlocked && (
              <p
                className="text-sm text-muted-foreground"
                data-testid="freeway-vault-locked-notice"
              >
                {t('freeway.vaultLockedNotice')}
              </p>
            )}
            {loading && status.buckets.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="freeway-loading">
                {t('freeway.loading')}
              </p>
            ) : (
              <>
                {status.generatedAt > 0 && (
                  <p className="text-xs text-muted-foreground" data-testid="freeway-generated-at">
                    {t('freeway.generatedAtLabel', {
                      time: relativeTime(new Date(status.generatedAt)),
                    })}
                  </p>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t('freeway.sourcesTitle')}</h3>
                  {providers.length === 0 ? (
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid="freeway-sources-empty"
                    >
                      {t('freeway.empty')}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {providers.map((provider) => {
                        const providerInstances = instances.filter(
                          (instance) => instance.baseModuleId === provider.moduleId,
                        );
                        const overrideId = overrides[provider.moduleId];
                        // `dispatchModuleId` is absent for a "missing" bucket
                        // (routes/freeway.ts) and for every bucket while the
                        // vault is locked — that means "the server couldn't
                        // tell us what it's dispatching to", not "it rejected
                        // your override". Only demote to Automatic when the
                        // server DID resolve a dispatch target and it names a
                        // DIFFERENT live instance — the same usability scan
                        // freewayCandidateIds performs server-side falling an
                        // unusable override through to `<base>:default`, which
                        // the selector must agree with. When dispatch is
                        // simply unknown, fall back to the workspace's own
                        // persisted choice (as long as it still names a live
                        // instance) so the user can always see their own
                        // configuration rather than a misleading "Automatic".
                        const overrideIsLiveInstance =
                          overrideId !== undefined &&
                          providerInstances.some((instance) => instance.instanceId === overrideId);
                        const isFreewayDisabled = disabledProviders.has(provider.moduleId);
                        const selectedValue = isFreewayDisabled
                          ? DISABLED_OVERRIDE_VALUE
                          : provider.dispatchModuleId === undefined
                            ? overrideIsLiveInstance
                              ? overrideId
                              : AUTOMATIC_OVERRIDE_VALUE
                            : overrideId && provider.dispatchModuleId === overrideId
                              ? overrideId
                              : AUTOMATIC_OVERRIDE_VALUE;
                        return (
                          <li
                            key={provider.providerKey}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                            data-testid={`freeway-provider-row-${provider.providerKey}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {providerDisplayName(provider.providerKey)}
                              </span>
                              <Badge
                                variant={provider.keyPresent ? 'default' : 'outline'}
                                data-testid={`freeway-key-status-${provider.providerKey}`}
                              >
                                {provider.keyPresent
                                  ? t('freeway.keyPresent')
                                  : t('freeway.keyMissing')}
                              </Badge>
                              {provider.dispatchModuleId &&
                                provider.dispatchModuleId !== `${provider.moduleId}:default` && (
                                  <span
                                    className="text-xs text-muted-foreground"
                                    data-testid={`freeway-via-${provider.providerKey}`}
                                  >
                                    {provider.dispatchModuleId === provider.moduleId
                                      ? t('freeway.viaLegacyBase', { module: provider.moduleId })
                                      : t('freeway.viaInstance', {
                                          instance: provider.dispatchModuleId,
                                        })}
                                  </span>
                                )}
                              {provider.moduleDisabled && (
                                <span className="text-xs text-muted-foreground">
                                  {t('freeway.enableModuleHint')}
                                </span>
                              )}
                              {provider.otherDisabledReason && (
                                <Badge
                                  variant="destructive"
                                  data-testid={`freeway-disabled-reason-${provider.providerKey}`}
                                >
                                  {t('freeway.disabledReasonChip', {
                                    reason: provider.otherDisabledReason,
                                  })}
                                </Badge>
                              )}
                              {provider.credentialMarkModuleId && (
                                <span
                                  className="text-xs text-muted-foreground"
                                  data-testid={`freeway-credential-mark-${provider.providerKey}`}
                                >
                                  {t('freeway.credentialMarkStatus', {
                                    module:
                                      instances.find(
                                        (instance) =>
                                          instance.instanceId === provider.credentialMarkModuleId,
                                      )?.displayName ?? provider.credentialMarkModuleId,
                                    key: provider.credentialKeyName,
                                  })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const optionLabel = (value: string): string =>
                                  value === AUTOMATIC_OVERRIDE_VALUE
                                    ? t('freeway.automaticOption')
                                    : value === DISABLED_OVERRIDE_VALUE
                                      ? t('freeway.disabledOption')
                                      : (providerInstances.find(
                                          (instance) => instance.instanceId === value,
                                        )?.displayName ?? value);
                                return (
                                  <Select
                                    value={selectedValue}
                                    onValueChange={(value) => {
                                      // base-ui's Select calls onValueChange on every
                                      // item commit, including re-picking the option
                                      // already shown (no equality check upstream).
                                      // Re-picking a displayed OVERRIDE (or Disabled)
                                      // is a no-op PUT and skipping it is a pure
                                      // optimization. Automatic is different: when
                                      // `overrideId` is still persisted (the selector
                                      // is only showing "Automatic" because the
                                      // override's instance is currently
                                      // disabled/unusable — see `selectedValue`
                                      // above), picking Automatic is the ONLY way to
                                      // clear that stale override, so the guard must
                                      // not swallow it.
                                      if (
                                        value === selectedValue &&
                                        !(
                                          value === AUTOMATIC_OVERRIDE_VALUE &&
                                          overrideId !== undefined
                                        )
                                      ) {
                                        return;
                                      }
                                      handleProviderRoutingChange(provider.moduleId, value);
                                    }}
                                    disabled={overridesState !== 'loaded'}
                                  >
                                    <SelectTrigger
                                      size="sm"
                                      className="w-40"
                                      data-testid={`freeway-instance-select-${provider.providerKey}`}
                                      aria-label={t('freeway.instanceSelectorAria', {
                                        provider: providerDisplayName(provider.providerKey),
                                      })}
                                      title={optionLabel(selectedValue)}
                                    >
                                      <SelectValue>{optionLabel}</SelectValue>
                                    </SelectTrigger>
                                    {/* Content sizes to the longest instance name instead of the
                                      160px trigger (`w-(--anchor-width)` in ui/select.tsx), so a
                                      descriptive display name (`Name (slug)`) isn't clipped in the
                                      open list. `cn` (tailwind-merge) resolves this `w-max` against
                                      the base `w-(--anchor-width)` class, so it wins outright rather
                                      than stacking. Bounded below by the trigger's own `w-40` and
                                      above by 22rem so one pathological name can't blow out the
                                      popup. */}
                                    <SelectContent className="w-max min-w-40 max-w-[22rem]">
                                      <SelectItem value={AUTOMATIC_OVERRIDE_VALUE}>
                                        {t('freeway.automaticOption')}
                                      </SelectItem>
                                      {providerInstances.map((instance) => (
                                        <SelectItem
                                          key={instance.instanceId}
                                          value={instance.instanceId}
                                        >
                                          {instance.displayName}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value={DISABLED_OVERRIDE_VALUE}>
                                        {t('freeway.disabledOption')}
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                );
                              })()}
                              {provider.moduleDisabled && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    scrollToEnableTarget(provider.enableTargetModuleId)
                                  }
                                  data-testid={`freeway-enable-module-${provider.providerKey}`}
                                >
                                  {t('freeway.enableModuleButton')}
                                </Button>
                              )}
                              {provider.credentialMarkModuleId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleCredentialMarkRetry(provider.credentialMarkModuleId!)
                                  }
                                  disabled={retryingCredentialMarkIds.has(
                                    provider.credentialMarkModuleId,
                                  )}
                                  data-testid={`freeway-credential-retry-${provider.providerKey}`}
                                >
                                  {t('freeway.credentialRetryButton')}
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">{t('freeway.statusTitle')}</h3>
                  {status.buckets.length === 0 ? (
                    <p className="text-sm text-muted-foreground" data-testid="freeway-status-empty">
                      {t('freeway.empty')}
                    </p>
                  ) : (
                    <Table data-testid="freeway-status-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('freeway.colModel')}</TableHead>
                          <TableHead>{t('freeway.colState')}</TableHead>
                          <TableHead>{t('freeway.colRemaining')}</TableHead>
                          <TableHead>{t('freeway.colNextReset')}</TableHead>
                          <TableHead>{t('freeway.colPassRate')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {statusRows.map((row) => {
                          if (row.kind === 'bucket') {
                            return (
                              <BucketRow
                                key={row.bucket.bucketKey}
                                bucket={row.bucket}
                                showRemaining
                                t={t}
                              />
                            );
                          }
                          // Pool header: the shared day-scale allowance rendered ONCE,
                          // taken from the first member (the server clamps every
                          // pooled bucket's effective remaining to the same shared
                          // figure) — never summed or re-derived here, so the panel
                          // can't drift from what the selector actually spends
                          // against.
                          const first = row.members[0];
                          return (
                            <Fragment key={`pool-${row.poolKey}`}>
                              <TableRow
                                data-testid={`freeway-pool-row-${row.poolKey}`}
                                className="bg-muted/40"
                              >
                                <TableCell>
                                  <div className="text-sm font-medium">
                                    {providerDisplayName(row.poolKey)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {t('freeway.sharedPoolLabel')}
                                  </div>
                                </TableCell>
                                <TableCell />
                                <TableCell data-testid={`freeway-pool-remaining-${row.poolKey}`}>
                                  {formatRemaining(first, t)}
                                </TableCell>
                                <TableCell>
                                  {new Date(first.nextResetAt).toLocaleString()}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                              {row.members.map((bucket) => (
                                <BucketRow
                                  key={bucket.bucketKey}
                                  bucket={bucket}
                                  showRemaining={false}
                                  t={t}
                                />
                              ))}
                            </Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
