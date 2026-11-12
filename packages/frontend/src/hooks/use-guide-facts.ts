import { useEffect, useMemo, useState } from 'react';
import { FREE_KEYS, providerKeyFor } from '../lib/simple-provider.js';
import type { GuideFacts } from '../lib/tour/types.js';
import { useGuideStore } from '../stores/guide-store.js';
import { useOnboardingStore } from '../stores/onboarding-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { useStringStore } from '../stores/string-store.js';
import { useVaultStore } from '../stores/vault-store.js';
import { useUiMode } from './use-ui-mode.js';

export type { GuideFacts };

/**
 * What the app knows about the person's progress, read from real state (the
 * vault, the project list, the loaded strings) so the guide resumes in the
 * right place after a reload or on another device. Read-only: it fetches
 * nothing. The returned object keeps its identity until a fact changes.
 */
export function useGuideFacts(): GuideFacts {
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);
  const setupRequired = useVaultStore((s) => s.setupRequired ?? false);
  const hasVault = useVaultStore((s) => s.hasVault);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);
  const keys = useVaultStore((s) => s.keys);
  const simpleProvider = useGuideStore((s) => s.simpleProvider);
  const exported = useGuideStore((s) => s.exportedOnce);
  const firstTranslationSeen = useOnboardingStore((s) => s.firstTranslationSeen);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const access = useProjectStore((s) => s.access);
  const entries = useStringStore((s) => s.entries);
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);

  return useMemo(() => {
    const cloud = cloudManaged || setupRequired;
    // `keys` is only trusted while unlocked: a list seen earlier says nothing
    // about what the person can use now.
    const ownKey = simpleProvider ? providerKeyFor(simpleProvider) : undefined;
    const usableKey =
      vaultUnlocked &&
      (FREE_KEYS.some((k) => keys.includes(k)) || (ownKey !== undefined && keys.includes(ownKey)));

    const activeProject = projects.find((p) => p.id === activeProjectId);
    const activeEntries =
      activeProject && loadedProjectId === activeProject.id
        ? entries.filter((e) => !e.orphanedAt)
        : [];

    return {
      cloud,
      vaultExists: cloud ? !setupRequired : hasVault,
      vaultUnlocked,
      usableKey,
      projectExists: activeProject !== undefined,
      projectHasLanguages: (activeProject?.activeLanguages.length ?? 0) > 0,
      projectHasEntries: activeEntries.length > 0,
      translationExists:
        firstTranslationSeen ||
        activeEntries.some((e) =>
          Object.values(e.translations ?? {}).some((record) => Boolean(record?.text)),
        ),
      exported,
      isCollaboratorOnly:
        projects.length > 0 && projects.every((p) => access[p.id]?.role === 'collaborator'),
    };
  }, [
    cloudManaged,
    setupRequired,
    hasVault,
    vaultUnlocked,
    keys,
    simpleProvider,
    exported,
    firstTranslationSeen,
    projects,
    activeProjectId,
    access,
    entries,
    loadedProjectId,
  ]);
}

/**
 * Whether the guided first run is the person's current path: Simple mode, not
 * skipped, not finished, and not someone who only has projects shared with
 * them (they cannot create, import or export).
 */
export function useFirstRunActive(): boolean {
  const simple = useUiMode() === 'simple';
  const dismissed = useGuideStore((s) => s.firstRunDismissed);
  const finished = useGuideStore((s) => s.firstRunFinished);
  const collaboratorOnly = useProjectStore(
    (s) =>
      s.projects.length > 0 && s.projects.every((p) => s.access[p.id]?.role === 'collaborator'),
  );
  return simple && !dismissed && !finished && !collaboratorOnly;
}

/**
 * Strings are fetched per tab, so the guide loads the active project's itself
 * while `enabled`; without them it could not tell an imported project from an
 * empty one. Returns true once that load has settled (or none is needed), so
 * the caller can hold the guide back instead of flashing an earlier step.
 */
export function useGuideEntriesReady(enabled: boolean): boolean {
  const activeProjectId = useProjectStore((s) =>
    s.projects.some((p) => p.id === s.activeProjectId) ? s.activeProjectId : null,
  );
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);
  const [settledFor, setSettledFor] = useState<string | null>(null);
  const needed = enabled && activeProjectId !== null && loadedProjectId !== activeProjectId;

  useEffect(() => {
    if (!needed || activeProjectId === null) return;
    let cancelled = false;
    void Promise.resolve(useStringStore.getState().fetchEntries(activeProjectId))
      .catch(() => {
        // The store keeps the error; the guide just treats the project as empty.
      })
      .finally(() => {
        if (!cancelled) setSettledFor(activeProjectId);
      });
    return () => {
      cancelled = true;
    };
  }, [needed, activeProjectId]);

  return !needed || settledFor === activeProjectId;
}
