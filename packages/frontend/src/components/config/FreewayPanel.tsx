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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, RotateCcw } from 'lucide-react';
import type { ModuleInstance } from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
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
  /** The module/instance id actually serving this LIVE bucket, when it differs from `moduleId`. */
  dispatchModuleId?: string;
  /** For a 'disabled' missing row: the candidate id "Enable it" should scroll to / turn on. */
  enableTargetModuleId?: string;
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
   * 'module-disabled' (e.g. a ledger-recorded hard stop like bad
   * credentials) — shown as a state chip instead of the enable-module hint,
   * since enabling the module wouldn't fix it.
   */
  otherDisabledReason?: string;
  /** First non-empty `enableTargetModuleId` seen across this provider's buckets. */
  enableTargetModuleId?: string;
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
      } else if (bucket.disabledReason) {
        summary.otherDisabledReason = bucket.disabledReason;
      }
    }
    if (!summary.enableTargetModuleId && bucket.enableTargetModuleId) {
      summary.enableTargetModuleId = bucket.enableTargetModuleId;
    }
    if (!summary.dispatchModuleId && bucket.dispatchModuleId) {
      summary.dispatchModuleId = bucket.dispatchModuleId;
    }
  }
  return order.map((key) => byKey.get(key)!);
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

export function FreewayPanel(): React.JSX.Element {
  const { t } = useTranslation('config');
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

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

  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [overridesState, setOverridesState] = useState<OverridesLoadState>('loading');
  // Serializes writes to /global-config/settings: each write's PUT is chained behind
  // the previous one's completion (not just its optimistic local-state update), so two
  // rapid provider changes can never have their network requests land out of order —
  // a reordered arrival would let an earlier, smaller payload overwrite a later one.
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  const loadOverrides = useCallback(() => {
    setOverridesState('loading');
    return apiRequest<{ freewayInstanceOverrides?: Record<string, string> }>(
      '/global-config/settings',
    )
      .then((res) => {
        setOverrides(res.freewayInstanceOverrides ?? {});
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

  // Persists a per-provider instance override (or clears it on "Automatic"),
  // read-modify-write of the whole map so an unrelated provider's override is
  // never disturbed by this one's change. Guarded by `overridesState === 'loaded'`
  // (selectors are also disabled in that case) so a write is never built from a map
  // that either hasn't arrived yet or is known to have failed to load. A failed PUT
  // means the local map may have diverged from the server's, so it re-fetches the
  // authoritative map rather than leaving the panel willing to write a now-stale one
  // on the next edit.
  const handleInstanceOverrideChange = (baseModuleId: string, value: string | null) => {
    if (overridesState !== 'loaded') return;
    const next = { ...overrides };
    if (!value || value === AUTOMATIC_OVERRIDE_VALUE) {
      delete next[baseModuleId];
    } else {
      next[baseModuleId] = value;
    }
    setOverrides(next);
    writeChainRef.current = writeChainRef.current
      .then(() =>
        apiRequest('/global-config/settings', {
          method: 'PUT',
          body: JSON.stringify({ freewayInstanceOverrides: next }),
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
                        const selectedValue =
                          provider.dispatchModuleId === undefined
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
                            </div>
                            <div className="flex items-center gap-2">
                              {providerInstances.length > 0 && (
                                <Select
                                  value={selectedValue}
                                  onValueChange={(value) => {
                                    // base-ui's Select calls onValueChange on every
                                    // item commit, including re-picking the option
                                    // already shown (no equality check upstream).
                                    // Re-picking a displayed OVERRIDE is a no-op
                                    // PUT (next[base] = sameId) and skipping it is
                                    // a pure optimization. Automatic is different:
                                    // when `overrideId` is still persisted (the
                                    // selector is only showing "Automatic" because
                                    // the override's instance is currently
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
                                    handleInstanceOverrideChange(provider.moduleId, value);
                                  }}
                                  disabled={
                                    providerInstances.length < 2 || overridesState !== 'loaded'
                                  }
                                >
                                  <SelectTrigger
                                    size="sm"
                                    className="w-40"
                                    data-testid={`freeway-instance-select-${provider.providerKey}`}
                                    aria-label={t('freeway.instanceSelectorAria', {
                                      provider: providerDisplayName(provider.providerKey),
                                    })}
                                    title={
                                      selectedValue === AUTOMATIC_OVERRIDE_VALUE
                                        ? t('freeway.automaticOption')
                                        : (providerInstances.find(
                                            (instance) => instance.instanceId === selectedValue,
                                          )?.displayName ?? String(selectedValue))
                                    }
                                  >
                                    <SelectValue>
                                      {(value) =>
                                        value === AUTOMATIC_OVERRIDE_VALUE
                                          ? t('freeway.automaticOption')
                                          : (providerInstances.find(
                                              (instance) => instance.instanceId === value,
                                            )?.displayName ?? String(value))
                                      }
                                    </SelectValue>
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
                                  </SelectContent>
                                </Select>
                              )}
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
                        {status.buckets.map((bucket) => (
                          <TableRow
                            key={bucket.bucketKey}
                            data-testid={`freeway-bucket-row-${bucket.bucketKey}`}
                          >
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
                                {bucket.state === 'disabled' &&
                                bucket.disabledReason !== MODULE_DISABLED_REASON
                                  ? t('freeway.state.badCredentials')
                                  : t(`freeway.state.${bucket.state}`)}
                              </Badge>
                            </TableCell>
                            <TableCell data-testid={`freeway-remaining-${bucket.bucketKey}`}>
                              {bucket.remainingChars !== undefined
                                ? t('freeway.remainingChars', { count: bucket.remainingChars })
                                : t('freeway.remainingRequests', {
                                    count: bucket.remainingRequests,
                                  })}
                            </TableCell>
                            <TableCell data-testid={`freeway-next-reset-${bucket.bucketKey}`}>
                              {new Date(bucket.nextResetAt).toLocaleString()}
                            </TableCell>
                            <TableCell data-testid={`freeway-pass-rate-${bucket.bucketKey}`}>
                              {worstPassRates(bucket.gatePassByLanguage, 2)
                                .map(([language, rate]) =>
                                  t('freeway.passRateEntry', {
                                    language,
                                    rate: Math.round(rate * 100),
                                  }),
                                )
                                .join(' · ')}
                            </TableCell>
                          </TableRow>
                        ))}
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
