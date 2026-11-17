import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from '@/lib/toast';
import { applyProviderTo, targetOfKey } from '../lib/provider-choice.js';
import {
  enableProvider,
  FREE_KEY_PROVIDERS,
  markProviderChecked,
  providerCheckedThisLoad,
  providerInstanceId,
  providerKeyFor,
  providerName,
  resetProviderChecks,
} from '../lib/simple-provider.js';
import { getErrorMessage } from '../lib/utils.js';
import { useGuideStore } from '../stores/guide-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { useVaultStore } from '../stores/vault-store.js';

/** Choices already told "no key yet, Freeway translates meanwhile" in this tab. */
const waitingNoticeShown = new Set<string>();

/** For tests: forget which notices were shown and which providers were checked (a page load). */
export function resetProviderNotices(): void {
  waitingNoticeShown.clear();
  resetProviderChecks();
}

/**
 * The setup done on the person's behalf wherever the Global Config and Routing
 * tabs are hidden. It runs for as long as `enabled` (Simple mode, or a guided
 * first run restarted in Advanced), whether or not the guide is on screen: a
 * key added from "Provider keys" after skipping the guide counts too. Every
 * part waits for an unlocked vault that holds the key (enabling a provider is
 * refused without one), so the order of choice and vault does not matter.
 *
 * 1. Enable the provider behind each usable key: the chosen provider's once
 *    its key is saved, else every free key present (Freeway translates until
 *    then). Each provider is enabled once ever (remembered in the guide
 *    store), and one the person has switched off stays off, with a notice.
 * 2. Finish each choice made before its key was saved (`pendingProviders`:
 *    `chooseProvider`'s `needs-key`, or a project created meanwhile): point
 *    each target at its provider. A target is forgotten once written, once
 *    its routing turns out to be custom (it says so), or quietly when the
 *    project is gone. Routing changed since the choice (in Advanced, or
 *    another tab) is kept and the person is told, like custom routing; one
 *    whose routing could not be read is kept for later.
 *    A choice written now is announced, since it lands long after the click.
 * 3. Never drop an explicit choice. A free key saved while the chosen
 *    provider's key is missing only gets a notice: Freeway translates until
 *    the person saves that key or chooses Freeway on the provider card.
 */
/**
 * The base modules to enable for the keys in the vault: the chosen provider's
 * once its key is saved (else every free provider with a key), plus pending
 * choices whose key has arrived.
 */
export function providersWithKeys(
  keys: readonly string[],
  simpleProvider: string | null,
  pendingProviders: Readonly<Record<string, string>>,
): string[] {
  const withKey = (id: string) => {
    const key = providerKeyFor(id);
    return key !== undefined && keys.includes(key);
  };
  const ownKeySaved = simpleProvider !== null && withKey(simpleProvider);
  const bases = [
    ...(simpleProvider && ownKeySaved
      ? [simpleProvider]
      : FREE_KEY_PROVIDERS.filter((p) => keys.includes(p.key)).map((p) => p.base)),
    ...Object.values(pendingProviders).filter(withKey),
  ].map((id) => id.split(':')[0]);
  return [...new Set(bases)];
}

/**
 * Enable one provider and record the outcome: marked when on; when the person
 * switched it off themselves it stays off, and they are told once.
 */
async function enableOne(base: string, t: TFunction<'guide-tour'>): Promise<void> {
  try {
    const id = await enableProvider(base);
    const guide = useGuideStore.getState();
    if (id !== null) {
      guide.markProviderEnabled(id);
      return;
    }
    const instance = providerInstanceId(base);
    if (guide.switchedOffNoticed.includes(instance)) return;
    guide.markSwitchedOffNoticed(instance);
    toast.warning(t('providerChoice.switchedOff', { provider: providerName(base) }));
  } catch (err) {
    toast.error(
      t('providerChoice.failed', { provider: providerName(base), message: getErrorMessage(err) }),
    );
    throw err;
  }
}

/**
 * Enable now every provider the vault has a key for (see `providersWithKeys`),
 * for a retry after a run found nothing able to translate. Resolves when done.
 */
export async function enableProvidersWithKeys(t: TFunction<'guide-tour'>): Promise<void> {
  const { keys, unlocked } = useVaultStore.getState();
  if (!unlocked) return;
  const { simpleProvider, pendingProviders } = useGuideStore.getState();
  await Promise.allSettled(
    providersWithKeys(keys, simpleProvider, pendingProviders).map((base) => enableOne(base, t)),
  );
}

export function useProviderSetup(enabled: boolean): void {
  const { t } = useTranslation('guide-tour');
  const unlocked = useVaultStore((s) => s.unlocked);
  const keys = useVaultStore((s) => s.keys);
  const simpleProvider = useGuideStore((s) => s.simpleProvider);
  const enabledProviders = useGuideStore((s) => s.enabledProviders);
  const pendingProviders = useGuideStore((s) => s.pendingProviders);
  const ready = enabled && unlocked;

  const ownKey = simpleProvider ? providerKeyFor(simpleProvider) : undefined;
  const ownKeySaved = ownKey !== undefined && keys.includes(ownKey);

  // Free keys the vault held when it was last looked at; null = not seen yet
  // (a reload, or the return from the cloud vault page).
  const freeKeysSeen = useRef<string[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    const free = FREE_KEY_PROVIDERS.map((p) => p.key as string).filter((k) => keys.includes(k));
    const before = freeKeysSeen.current;
    freeKeysSeen.current = free;
    if (simpleProvider === null || ownKeySaved) return;
    const freeKeyArrived =
      before === null ? free.length > 0 : free.some((k) => !before.includes(k));
    if (!freeKeyArrived || waitingNoticeShown.has(simpleProvider)) return;
    waitingNoticeShown.add(simpleProvider);
    toast.warning(t('providerChoice.waitingForKey', { provider: providerName(simpleProvider) }));
  }, [ready, keys, simpleProvider, ownKeySaved, t]);

  // Every provider with a usable key, enabled or not: the server's config is
  // the truth (it can be reset or restored), so each is checked once per page
  // load. `enableProvider` leaves one the person switched off alone.
  const toEnable = useMemo(
    () => (ready ? providersWithKeys(keys, simpleProvider, pendingProviders).join(',') : ''),
    [ready, keys, simpleProvider, pendingProviders],
  );

  // One attempt per provider per page load, so a failure cannot loop.
  useEffect(() => {
    for (const base of toEnable ? toEnable.split(',') : []) {
      // Checked already in this page load (here, or by a provider choice).
      if (providerCheckedThisLoad(base)) continue;
      markProviderChecked(base);
      void enableOne(base, t).catch(() => {});
    }
  }, [toEnable, t]);

  // Pending targets whose provider is enabled now, as "target=module" lines.
  const applicable = useMemo(
    () =>
      ready
        ? Object.entries(pendingProviders)
            .filter(([, moduleId]) => enabledProviders.includes(moduleId))
            .map(([target, moduleId]) => `${target}=${moduleId}`)
            .join('\n')
        : '',
    [ready, pendingProviders, enabledProviders],
  );
  // One attempt per target and provider per mount, so a failure cannot loop.
  const ruleAttempted = useRef(new Set<string>());
  useEffect(() => {
    for (const line of applicable ? applicable.split('\n') : []) {
      if (ruleAttempted.current.has(line)) continue;
      ruleAttempted.current.add(line);
      const at = line.indexOf('=');
      const target = line.slice(0, at);
      const moduleId = line.slice(at + 1);
      const routedFrom = useGuideStore.getState().pendingRoutedFrom?.[target];
      void applyProviderTo(targetOfKey(target), moduleId, routedFrom)
        .then((result) => {
          // Not read (a collaborator document that failed to load): kept for later.
          if (result.status === 'unavailable') return;
          const guide = useGuideStore.getState();
          // Only the choice this attempt was for: a newer one stays pending.
          if (guide.pendingProviders[target] === moduleId) guide.setPendingProvider(target, null);
          // Custom routing, or routing changed since the choice: kept, and said so.
          if (result.status === 'routing-kept' || result.status === 'superseded') {
            toast.info(t('providerChoice.existingRouting'));
          }
          if (result.status === 'applied') {
            // Written later than it was chosen, so the person is told it happened.
            const provider = providerName(moduleId);
            const project =
              useProjectStore.getState().projects.find((p) => p.id === target)?.name ?? target;
            toast.success(
              target === 'collab'
                ? t('providerChoice.appliedCollab', { provider })
                : t('providerChoice.applied', { provider, project }),
            );
          }
        })
        .catch((err: unknown) => {
          toast.error(
            t('providerChoice.failed', {
              provider: providerName(moduleId),
              message: getErrorMessage(err),
            }),
          );
        });
    }
  }, [applicable, t]);
}
