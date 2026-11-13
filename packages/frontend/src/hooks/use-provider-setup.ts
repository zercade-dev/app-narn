import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  applySimpleRule,
  enableProvider,
  FREE_KEY_PROVIDERS,
  providerInstanceId,
  providerKeyFor,
} from '../lib/simple-provider.js';
import { getErrorMessage } from '../lib/utils.js';
import { useGuideStore } from '../stores/guide-store.js';
import { accessFor, useProjectStore } from '../stores/project-store.js';
import { useVaultStore } from '../stores/vault-store.js';

/**
 * The setup done on the person's behalf wherever the Global Config and Routing
 * tabs are hidden. It runs for as long as `enabled` (Simple mode, or a guided
 * first run restarted in Advanced), whether or not the guide is on screen: a
 * key added from "Provider keys" after skipping the guide counts too. Every
 * part waits for an unlocked vault that holds the key (enabling a provider is
 * refused without one), so the order of choice and vault does not matter.
 *
 * 1. A change of mind: the person chose "Use my own provider" and then saved a
 *    free key without ever saving the chosen provider's. The choice is dropped,
 *    so the free key is used (part 2) and no project is pointed at a provider
 *    that was never switched on.
 * 2. Enable the provider behind each usable key: the chosen provider's, or
 *    every free key present. Each provider is enabled once ever (remembered in
 *    the guide store), and one the person has switched off stays off.
 * 3. Point the active project at the chosen provider, but only when the
 *    project is theirs and has no routing rules yet.
 */
export function useProviderSetup(enabled: boolean): void {
  const { t } = useTranslation('guide-tour');
  const unlocked = useVaultStore((s) => s.unlocked);
  const keys = useVaultStore((s) => s.keys);
  const simpleProvider = useGuideStore((s) => s.simpleProvider);
  const enabledProviders = useGuideStore((s) => s.enabledProviders);
  const ready = enabled && unlocked;

  // Free keys the vault held when it was last looked at; null = not seen yet
  // (a reload, or the return from the cloud vault page), where any free key
  // without the chosen provider's key means the same change of mind.
  const freeKeysSeen = useRef<string[] | null>(null);
  useEffect(() => {
    if (!ready) return;
    const free = FREE_KEY_PROVIDERS.map((p) => p.key as string).filter((k) => keys.includes(k));
    const before = freeKeysSeen.current;
    freeKeysSeen.current = free;
    if (simpleProvider === null) return;
    const ownKey = providerKeyFor(simpleProvider);
    if (ownKey !== undefined && keys.includes(ownKey)) return;
    const freeKeyArrived =
      before === null ? free.length > 0 : free.some((k) => !before.includes(k));
    if (freeKeyArrived) useGuideStore.getState().setSimpleProvider(null);
  }, [ready, keys, simpleProvider]);

  const toEnable = useMemo(() => {
    if (!ready) return '';
    const ownKey = simpleProvider ? providerKeyFor(simpleProvider) : undefined;
    const bases = simpleProvider
      ? ownKey !== undefined && keys.includes(ownKey)
        ? [simpleProvider.split(':')[0]]
        : []
      : FREE_KEY_PROVIDERS.filter((p) => keys.includes(p.key)).map((p) => p.base);
    return bases.filter((base) => !enabledProviders.includes(providerInstanceId(base))).join(',');
  }, [ready, keys, simpleProvider, enabledProviders]);

  // One attempt per provider per mount, so a failure cannot loop.
  const attempted = useRef(new Set<string>());
  useEffect(() => {
    for (const base of toEnable ? toEnable.split(',') : []) {
      if (attempted.current.has(base)) continue;
      attempted.current.add(base);
      void enableProvider(base)
        .then((id) => {
          // null: the person switched it off themselves. Not theirs to undo,
          // and not marked, so nothing is pointed at it.
          if (id !== null) useGuideStore.getState().markProviderEnabled(id);
        })
        .catch((err: unknown) => {
          toast.error(
            t('providerChoice.failed', { provider: base, message: getErrorMessage(err) }),
          );
        });
    }
  }, [toEnable, t]);

  const ownProviderReady =
    ready && simpleProvider !== null && enabledProviders.includes(simpleProvider);
  const projectWithoutRouting = useProjectStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    if (!project || accessFor(s, project.id).role !== 'owner') return null;
    return (project.routingRules?.length ?? 0) === 0 ? project.id : null;
  });
  const ruleAttempted = useRef(new Set<string>());
  useEffect(() => {
    if (!ownProviderReady || simpleProvider === null || projectWithoutRouting === null) return;
    const attempt = `${projectWithoutRouting}:${simpleProvider}`;
    if (ruleAttempted.current.has(attempt)) return;
    ruleAttempted.current.add(attempt);
    void applySimpleRule(projectWithoutRouting, simpleProvider)
      .then(() => useProjectStore.getState().fetchProjects())
      .catch((err: unknown) => {
        toast.error(
          t('providerChoice.failed', { provider: simpleProvider, message: getErrorMessage(err) }),
        );
      });
  }, [ownProviderReady, simpleProvider, projectWithoutRouting, t]);
}
