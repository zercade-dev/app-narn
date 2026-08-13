/**
 * FreewayPanel — Global Config section for NARN Freeway: a checklist of the
 * bundled free-tier providers (which have a key, one-click "Add" for the
 * generic-ai presets that don't yet) plus a live status table of every
 * snapshot bucket (state, remaining quota, next reset, observed pass rate).
 *
 * Data comes from `GET /api/freeway/status` (read-only, session-aware — a
 * locked vault simply reports every bucket 'uncredentialed'). The one-click
 * "Add" button posts `POST /api/freeway/presets/:key` for the three
 * generic-ai-backed providers (groq, mistral, cerebras); on success it opens
 * the shared vault-key editor via `onEditVaultKey`, the same callback prop
 * `ModuleSettingsPanel` uses, and refreshes the status table. That preset
 * route is local-mode-only (v1): the status payload's `presetsAvailable` flag
 * (same condition the preset POST route itself gates creation on) tells the
 * panel up front whether to offer the Add buttons at all; the client-side
 * `presetsUnavailable` fallback below still catches the rare case where a
 * click's own POST reports `presets-unavailable` (e.g. a race with a mode
 * change mid-session).
 *
 * Module enable/disable is deliberately NOT duplicated here: a provider whose
 * key is set but whose module is toggled off shows a hint plus a button that
 * scrolls the existing module card (in `ModuleSettingsPanel`, rendered
 * alongside this panel) into view — the toggle itself lives there.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import { apiRequest, ApiError } from '../../hooks/use-api.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { relativeTime } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

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
}

interface FreewayStatusResponse {
  buckets: FreewayStatusBucket[];
  generatedAt: number;
  /**
   * Whether `POST /api/freeway/presets/:key` can succeed on this deployment —
   * the generic-ai base module is loaded AND the server isn't in cloud mode
   * (identical condition to that route's own guard). Gates the checklist's
   * Add buttons so cloud users never see an offer that can't work.
   */
  presetsAvailable: boolean;
}

const EMPTY_STATUS: FreewayStatusResponse = {
  buckets: [],
  generatedAt: 0,
  presetsAvailable: false,
};

/** The three generic-ai-backed providers the one-click preset route can create. */
const PRESET_PROVIDER_KEYS = new Set(['groq', 'mistral', 'cerebras']);

/** Mirrors the server's `MODULE_DISABLED_REASON` (routes/freeway.ts). */
const MODULE_DISABLED_REASON = 'module-disabled';

/**
 * Display names for the bundled snapshot's providers — a small, stable set
 * mirroring the server's own `PRESET_DISPLAY_NAMES` for the three presets;
 * falls back to the raw key for any future provider added to the snapshot.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  google: 'Google',
  openrouter: 'OpenRouter',
  deepl: 'DeepL',
  copilot: 'GitHub Copilot',
  groq: 'Groq',
  mistral: 'Mistral',
  cerebras: 'Cerebras',
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

function scrollToModuleCard(moduleId: string): void {
  document
    .querySelector(`[data-testid="module-card-${moduleId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export interface FreewayPanelProps {
  /** Open the vault-key editor focused on the given key (shared with `ModuleSettingsPanel`). */
  onEditVaultKey: (key: string) => void;
}

export function FreewayPanel({ onEditVaultKey }: Readonly<FreewayPanelProps>): React.JSX.Element {
  const { t } = useTranslation('config');
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [presetsUnavailable, setPresetsUnavailable] = useState(false);

  const {
    data: status,
    loading,
    reload,
  } = useAsyncData<FreewayStatusResponse>(
    (signal) =>
      apiRequest<Partial<FreewayStatusResponse>>('/freeway/status', { signal }).then((res) => ({
        buckets: res.buckets ?? [],
        generatedAt: res.generatedAt ?? 0,
        presetsAvailable: res.presetsAvailable ?? false,
      })),
    [],
    {
      initial: EMPTY_STATUS,
      onError: (err) => toast.error(t('freeway.loadFailed', { message: (err as Error).message })),
    },
  );

  const handleAddPreset = async (providerKey: string) => {
    setAddingKey(providerKey);
    try {
      const result = await apiRequest<{ instanceId: string; credentialKey: string }>(
        `/freeway/presets/${encodeURIComponent(providerKey)}`,
        { method: 'POST' },
      );
      onEditVaultKey(result.credentialKey);
      reload();
    } catch (err) {
      const errorCode =
        err instanceof ApiError ? (err.data as { error?: string } | undefined)?.error : undefined;
      if (errorCode === 'presets-unavailable') {
        setPresetsUnavailable(true);
        toast.error(t('freeway.presetsUnavailable'));
      } else {
        toast.error(
          t('freeway.addFailed', {
            provider: providerDisplayName(providerKey),
            message: (err as Error).message,
          }),
        );
      }
    } finally {
      setAddingKey(null);
    }
  };

  const providers = summarizeProviders(status.buckets);

  return (
    <Card data-testid="freeway-panel">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle>{t('freeway.title')}</CardTitle>
          <CardDescription>{t('freeway.description')}</CardDescription>
        </div>
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
      </CardHeader>
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
                <p className="text-sm text-muted-foreground" data-testid="freeway-sources-empty">
                  {t('freeway.empty')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {providers.map((provider) => {
                    const isPreset = PRESET_PROVIDER_KEYS.has(provider.providerKey);
                    const showAdd =
                      isPreset &&
                      !provider.keyPresent &&
                      !presetsUnavailable &&
                      status.presetsAvailable;
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
                          {provider.moduleDisabled && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => scrollToModuleCard(provider.moduleId)}
                              data-testid={`freeway-enable-module-${provider.providerKey}`}
                            >
                              {t('freeway.enableModuleButton')}
                            </Button>
                          )}
                          {showAdd && (
                            <Button
                              size="sm"
                              onClick={() => void handleAddPreset(provider.providerKey)}
                              disabled={addingKey === provider.providerKey}
                              data-testid={`freeway-add-button-${provider.providerKey}`}
                            >
                              {addingKey === provider.providerKey
                                ? t('freeway.adding')
                                : t('freeway.addButton')}
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
                            {t(`freeway.state.${bucket.state}`)}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`freeway-remaining-${bucket.bucketKey}`}>
                          {bucket.remainingChars !== undefined
                            ? t('freeway.remainingChars', { count: bucket.remainingChars })
                            : t('freeway.remainingRequests', { count: bucket.remainingRequests })}
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
    </Card>
  );
}
