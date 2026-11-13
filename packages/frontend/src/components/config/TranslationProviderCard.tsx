/**
 * Simple mode's "who translates" control, at the top of the project's Config
 * tab: NARN Freeway (free), or one provider of the person's own. It writes
 * through `chooseProvider`, the same function the guide's "Use my own
 * provider" sheet uses, so the two cannot drift. Routing built in Advanced
 * that one choice cannot describe is shown read-only and never overwritten.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFirstRunActive } from '../../hooks/use-guide-facts.js';
import { useProjectProvider } from '../../hooks/use-project-provider.js';
import { goToVaultSetup } from '../../lib/auth-redirect.js';
import { navigateOrOffer } from '../../lib/mode-gating.js';
import { chooseProvider, type ProviderChoiceResult } from '../../lib/provider-choice.js';
import {
  FREE_KEY_PROVIDERS,
  isFreeKeyProvider,
  isPaidProvider,
  ownProviderChoices,
  providerKeyFor,
  providerName,
} from '../../lib/simple-provider.js';
import { getErrorMessage } from '../../lib/utils.js';
import { vaultEditorOpenEvent } from '../../lib/vault-events.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useCollabRoutingStore } from '../../stores/collab-routing-store.js';
import { useVaultStore } from '../../stores/vault-store.js';

const GOOGLE_KEY = 'GOOGLE_API_KEY';

/**
 * Ask for `key`: the in-app key editor locally, the vault page in cloud
 * (guided while the first run is on, so the person comes back to it).
 */
function askForKey(key: string, cloud: boolean, guided: boolean): void {
  if (cloud) goToVaultSetup({ guided, key });
  else globalThis.dispatchEvent(vaultEditorOpenEvent({ focusKey: key }));
}

type Notice = { kind: 'switched-off' | 'routing-kept' | 'unavailable'; base: string } | null;

export function TranslationProviderCard({ projectId }: Readonly<{ projectId: string }>) {
  const { t } = useTranslation('config');
  const { t: tGuide } = useTranslation('guide-tour');
  const { provider, target, role, loadState, translationsInProgress } =
    useProjectProvider(projectId);
  const cloud = useVaultStore((s) => (s.cloudManaged ?? false) || (s.setupRequired ?? false));
  const unlocked = useVaultStore((s) => s.unlocked);
  const keys = useVaultStore((s) => s.keys);
  const pendingProviders = useGuideStore((s) => s.pendingProviders);
  const guideActive = useFirstRunActive();
  const retryLoad = useCollabRoutingStore((s) => s.load);
  // A collaborator's routing is saved by the Routing tab through its own copy:
  // re-read it whenever the card opens, so it never shows a stale choice.
  const isCollaborator = role === 'collaborator';
  useEffect(() => {
    if (isCollaborator) void retryLoad(true);
  }, [isCollaborator, retryLoad]);
  const [ownPicked, setOwnPicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const keySaved = (key: string | undefined) => unlocked && key !== undefined && keys.includes(key);
  // A choice made before its key was saved, for this project: shown as chosen
  // whenever it is not what translates now (Freeway, or another own provider).
  const pendingChoice = pendingProviders[target?.kind === 'collab' ? 'collab' : projectId];
  const currentBase = provider?.kind === 'own' ? provider.moduleId.split(':')[0] : null;
  const pendingBase =
    (provider?.kind === 'freeway' || provider?.kind === 'own') &&
    pendingChoice !== undefined &&
    pendingChoice.split(':')[0] !== currentBase &&
    !keySaved(providerKeyFor(pendingChoice))
      ? pendingChoice.split(':')[0]
      : null;
  const ownBase = pendingBase ?? currentBase;
  const ownSelected = ownBase !== null || ownPicked;

  const choose = (base: string | null) => {
    if (!target) return;
    setBusy(true);
    setNotice(null);
    void chooseProvider(base, target)
      .then((result: ProviderChoiceResult) => {
        if (
          result.status === 'switched-off' ||
          result.status === 'routing-kept' ||
          result.status === 'unavailable'
        ) {
          setNotice({ kind: result.status, base: base ?? '' });
          return;
        }
        if (base === null) setOwnPicked(false);
      })
      .catch((err: unknown) =>
        toast.error(
          tGuide('providerChoice.failed', {
            provider: base ? providerName(base) : t('providerCard.freeway'),
            message: getErrorMessage(err),
          }),
        ),
      )
      .finally(() => setBusy(false));
  };

  const disabled = busy || translationsInProgress;
  const scope = role === 'collaborator' ? t('providerCard.scopeCollab') : t('providerCard.scope');

  let body: React.ReactNode;
  if (loadState === 'loading' || (provider === null && loadState === 'loaded')) {
    body = <p className="text-sm text-muted-foreground">{t('providerCard.loading')}</p>;
  } else if (loadState === 'error' || provider === null) {
    body = (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{t('collab:routing.loadFailed')}</p>
        <Button
          variant="outline"
          size="sm"
          data-testid="provider-card-retry"
          onClick={() => void retryLoad(true)}
        >
          {t('collab:routing.retry')}
        </Button>
      </div>
    );
  } else if (provider.kind === 'custom') {
    body = (
      <div className="space-y-2" data-testid="provider-card-custom">
        <p className="text-sm text-muted-foreground">{t('providerCard.customRouting')}</p>
        <Button
          variant="outline"
          size="sm"
          data-testid="provider-card-open-advanced"
          onClick={() => navigateOrOffer({ kind: 'tab', tab: 'routing' })}
        >
          {t('providerCard.openAdvanced')}
        </Button>
      </div>
    );
  } else {
    const ownKey = ownBase ? providerKeyFor(ownBase) : undefined;
    const ownKeySaved = keySaved(ownKey);
    const anyFreeKey = FREE_KEY_PROVIDERS.some((p) => keySaved(p.key));
    body = (
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="sr-only">{t('providerCard.title')}</legend>
        <div className="space-y-1.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name={`provider-${projectId}`}
              checked={!ownSelected}
              disabled={disabled}
              onChange={() => choose(null)}
              data-testid="provider-card-freeway"
            />
            {t('providerCard.freeway')}
          </label>
          {!ownSelected && (
            <div className="space-y-1.5 pl-6">
              <p className="text-xs text-muted-foreground">{t('providerCard.freewayHint')}</p>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {FREE_KEY_PROVIDERS.map(({ key, base }) => {
                  const saved = keySaved(key);
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-1"
                      data-testid={`provider-card-free-key-${key}`}
                      data-saved={saved}
                    >
                      {saved ? (
                        <Check className="size-3 text-status-pass" aria-hidden="true" />
                      ) : (
                        <X className="size-3 text-muted-foreground" aria-hidden="true" />
                      )}
                      <span className={saved ? undefined : 'text-muted-foreground'}>
                        {providerName(base)}
                      </span>
                      <span className="sr-only">
                        {saved ? t('providerCard.keySaved') : t('providerCard.noKey')}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {!anyFreeKey && (
                <p className="text-xs text-status-warn">{t('providerCard.noFreeKey')}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                data-testid="provider-card-add-free-key"
                onClick={() => askForKey(GOOGLE_KEY, cloud, guideActive)}
              >
                {t('providerCard.addFreeKey')}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name={`provider-${projectId}`}
              checked={ownSelected}
              disabled={disabled}
              onChange={() => setOwnPicked(true)}
              data-testid="provider-card-own"
            />
            {t('providerCard.own')}
          </label>
          {ownSelected && (
            <div className="space-y-1.5 pl-6">
              <Select
                value={ownBase}
                onValueChange={(v: string | null) => {
                  if (v) choose(v);
                }}
                disabled={disabled}
              >
                <SelectTrigger
                  className="h-9 w-full md:max-w-md"
                  data-testid="provider-card-select"
                  aria-label={t('providerCard.own')}
                >
                  <SelectValue placeholder={t('providerCard.ownPlaceholder')}>
                    {(v: string | null) => (v ? providerName(v) : t('providerCard.ownPlaceholder'))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ownProviderChoices(cloud).map((base) => (
                    <SelectItem
                      key={base}
                      value={base}
                      data-testid={`provider-card-option-${base}`}
                    >
                      {isFreeKeyProvider(base)
                        ? t('providerCard.freeOnlyOption', { provider: providerName(base) })
                        : providerName(base)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ownBase !== null && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    data-testid="provider-card-key-status"
                    className={ownKeySaved ? 'text-status-pass' : 'text-status-warn'}
                  >
                    {ownKeySaved
                      ? t('providerCard.keySaved')
                      : unlocked
                        ? t('providerCard.keyMissing', { provider: providerName(ownBase) })
                        : t('providerCard.vaultLocked')}
                  </span>
                  {!ownKeySaved && ownKey !== undefined && (
                    <Button
                      variant="outline"
                      size="xs"
                      data-testid="provider-card-add-key"
                      onClick={() => askForKey(ownKey, cloud, guideActive)}
                    >
                      {t('providerCard.addKey')}
                    </Button>
                  )}
                </div>
              )}
              {ownBase !== null && isPaidProvider(ownBase) && (
                <p className="text-xs text-muted-foreground" data-testid="provider-card-cost">
                  {t('providerCard.paidNote', { provider: providerName(ownBase) })}
                </p>
              )}
              {ownBase !== null && isFreeKeyProvider(ownBase) && (
                <p className="text-xs text-muted-foreground" data-testid="provider-card-free-only">
                  {t('providerCard.freeOnlyNote', { provider: providerName(ownBase) })}
                </p>
              )}
              {pendingBase !== null && (
                <p className="text-xs text-status-warn" data-testid="provider-card-pending">
                  {currentBase === null
                    ? t('providerCard.pendingNote', { provider: providerName(pendingBase) })
                    : t('providerCard.pendingNoteOwn', {
                        provider: providerName(pendingBase),
                        current: providerName(currentBase),
                      })}
                </p>
              )}
            </div>
          )}
        </div>
      </fieldset>
    );
  }

  return (
    <Card data-testid="translation-provider-card" data-tour="translation-provider-card">
      <CardHeader>
        <CardTitle>{t('providerCard.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{scope}</p>
        {body}
        {notice && (
          <p
            className="flex items-start gap-1 text-xs text-status-warn"
            data-testid="provider-card-notice"
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            {notice.kind === 'switched-off'
              ? tGuide('providerChoice.switchedOff', { provider: providerName(notice.base) })
              : notice.kind === 'unavailable'
                ? t('collab:routing.loadFailed')
                : t('providerCard.customRouting')}
          </p>
        )}
        {translationsInProgress && (
          <p className="text-xs text-status-warn" data-testid="provider-card-running">
            {t('routing.freewayOnboardDisabledHint')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
