import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { applyProviderTo, targetOfKey } from '../lib/provider-choice.js';
import {
  enableProvider,
  FREE_KEY_PROVIDERS,
  providerInstanceId,
  providerKeyFor,
  providerName,
} from '../lib/simple-provider.js';
import { getErrorMessage } from '../lib/utils.js';
import { useGuideStore } from '../stores/guide-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { useVaultStore } from '../stores/vault-store.js';

/** Choices already told "no key yet, Freeway translates meanwhile" in this tab. */
const waitingNoticeShown = new Set<string>();

/** For tests: forget which notices were shown. */
export function resetProviderNotices(): void {
  waitingNoticeShown.clear();
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

  const toEnable = useMemo(() => {
    if (!ready) return '';
    const withKey = (id: string) => {
      const key = providerKeyFor(id);
      return key !== undefined && keys.includes(key);
    };
    // Pending choices whose key has arrived, whatever is chosen now.
    const pending = Object.values(pendingProviders).filter(withKey);
    const bases = [
      ...(simpleProvider && ownKeySaved
        ? [simpleProvider]
        : FREE_KEY_PROVIDERS.filter((p) => keys.includes(p.key)).map((p) => p.base)),
      ...pending,
    ].map((id) => id.split(':')[0]);
    return [...new Set(bases)]
      .filter((base) => !enabledProviders.includes(providerInstanceId(base)))
      .join(',');
  }, [ready, keys, simpleProvider, ownKeySaved, enabledProviders, pendingProviders]);

  // One attempt per provider per mount, so a failure cannot loop.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    for (const base of toEnable ? toEnable.split(',') : []) {
      if (attempted.current.has(base)) continue;
      attempted.current.add(base);
      void enableProvider(base)
        .then((id) => {
          // null: the person switched it off themselves. Not theirs to undo,
          // and not marked, so nothing is pointed at it; they are told.
          if (id !== null) useGuideStore.getState().markProviderEnabled(id);
          else toast.warning(t('providerChoice.switchedOff', { provider: providerName(base) }));
        })
        .catch((err: unknown) => {
          toast.error(
            t('providerChoice.failed', {
              provider: providerName(base),
              message: getErrorMessage(err),
            }),
          );
        });
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
