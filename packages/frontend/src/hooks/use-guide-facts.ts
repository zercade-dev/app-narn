import { useEffect, useMemo, useState } from 'react';
import { RunStatusCode, type RunStatus } from '@zercade-dev/narn-shared';
import { isRunActive, isTranslationRun } from '../lib/run-kind.js';
import { FREE_KEYS, providerKeyFor } from '../lib/simple-provider.js';
import type { RunStall } from '../lib/tour/first-run.js';
import { hasUntranslatedEntry } from '../lib/tour/quick-test.js';
import type { GuideFacts } from '../lib/tour/types.js';
import { useGuideStore } from '../stores/guide-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { useRunStore } from '../stores/run-store.js';
import { useSelectionStore } from '../stores/selection-store.js';
import { useStringStore } from '../stores/string-store.js';
import { useVaultStore } from '../stores/vault-store.js';
import { useUiMode } from './use-ui-mode.js';

export type { GuideFacts };

/** The id of the active project, when it is one that exists. */
function activeProjectIdOf(s: {
  projects: ReadonlyArray<{ id: string }>;
  activeProjectId: string | null;
}): string | null {
  return s.projects.some((p) => p.id === s.activeProjectId) ? s.activeProjectId : null;
}

/**
 * Whether the guided first run can still matter: Simple mode (or a restart
 * from the Guide that stays in Advanced) and not finished.
 */
export function useGuideRelevant(): boolean {
  const simple = useUiMode() === 'simple';
  const forced = useGuideStore((s) => s.firstRunForced);
  const finished = useGuideStore((s) => s.firstRunFinished);
  return (simple || forced) && !finished;
}

/** A translation run of `projectId` that ended having translated something. */
function producedTranslations(run: RunStatus, projectId: string): boolean {
  return (
    run.projectId === projectId &&
    isTranslationRun(run) &&
    run.completed > 0 &&
    !isRunActive(run) &&
    run.status !== RunStatusCode.Paused
  );
}

/**
 * What the app knows about the person's progress, read from real state (the
 * vault, the project list, the loaded strings, the runs) so the guide resumes
 * in the right place after a reload or on another device. Read-only: it
 * fetches nothing. The returned object keeps its identity until a fact changes.
 *
 * The project's strings, runs and selection are only looked at while the guide
 * can still matter (Simple mode, not finished); otherwise those facts read
 * false and a string, run or selection update re-renders nothing.
 */
export function useGuideFacts(): GuideFacts {
  const relevant = useGuideRelevant();
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);
  const setupRequired = useVaultStore((s) => s.setupRequired ?? false);
  const hasVault = useVaultStore((s) => s.hasVault);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);
  const simpleProvider = useGuideStore((s) => s.simpleProvider);
  const ownKey = simpleProvider ? providerKeyFor(simpleProvider) : undefined;
  // `keys` is only trusted while unlocked: a list seen earlier says nothing
  // about what the person can use now.
  const usableKey = useVaultStore(
    (s) =>
      s.unlocked &&
      (FREE_KEYS.some((k) => s.keys.includes(k)) ||
        (ownKey !== undefined && s.keys.includes(ownKey))),
  );
  const exported = useGuideStore((s) => s.exportedOnce);
  const activeProjectId = useProjectStore(activeProjectIdOf);
  const projectHasLanguages = useProjectStore(
    (s) => (s.projects.find((p) => p.id === s.activeProjectId)?.activeLanguages.length ?? 0) > 0,
  );
  const isCollaboratorOnly = useProjectStore(
    (s) =>
      s.projects.length > 0 && s.projects.every((p) => s.access[p.id]?.role === 'collaborator'),
  );
  const projectHasEntries = useStringStore(
    (s) =>
      relevant &&
      activeProjectId !== null &&
      s.loadedProjectId === activeProjectId &&
      s.entries.some((e) => !e.orphanedAt),
  );
  const translationExists = useRunStore(
    (s) =>
      relevant &&
      activeProjectId !== null &&
      s.runs.some((run) => producedTranslations(run, activeProjectId)),
  );
  // The selection store drops its ids itself when the active project changes.
  const hasSelection = useSelectionStore(
    (s) => relevant && activeProjectId !== null && s.selectedIds.size > 0,
  );
  // The project's target languages, as a string so the selector stays stable.
  const targetLanguages = useProjectStore((s) => {
    const p = s.projects.find((x) => x.id === s.activeProjectId);
    return p ? p.activeLanguages.filter((l) => l !== p.sourceLanguage).join('\n') : '';
  });
  const untranslatedRemain = useStringStore(
    (s) =>
      relevant &&
      activeProjectId !== null &&
      s.loadedProjectId === activeProjectId &&
      targetLanguages !== '' &&
      hasUntranslatedEntry(s.entries, targetLanguages.split('\n')),
  );
  const quickTest = useGuideStore((s) => s.quickTest);
  const quickTestPending =
    quickTest !== null &&
    quickTest.projectId === activeProjectId &&
    quickTest.decision === 'pending' &&
    quickTest.runId !== null &&
    translationExists &&
    untranslatedRemain;

  return useMemo(() => {
    const cloud = cloudManaged || setupRequired;
    return {
      cloud,
      vaultExists: cloud ? !setupRequired : hasVault,
      vaultUnlocked,
      usableKey,
      projectExists: activeProjectId !== null,
      projectHasLanguages,
      projectHasEntries,
      translationExists,
      exported,
      hasSelection,
      isCollaboratorOnly,
      untranslatedRemain,
      quickTestPending,
    };
  }, [
    cloudManaged,
    setupRequired,
    hasVault,
    vaultUnlocked,
    usableKey,
    exported,
    hasSelection,
    activeProjectId,
    projectHasLanguages,
    projectHasEntries,
    translationExists,
    isCollaboratorOnly,
    untranslatedRemain,
    quickTestPending,
  ]);
}

/**
 * Whether the guided first run is the person's current path: Simple mode, not
 * skipped, not finished, and not someone who only has projects shared with
 * them (they cannot create, import or export).
 */
export function useFirstRunActive(): boolean {
  const relevant = useGuideRelevant();
  const dismissed = useGuideStore((s) => s.firstRunDismissed);
  const collaboratorOnly = useProjectStore(
    (s) =>
      s.projects.length > 0 && s.projects.every((p) => s.access[p.id]?.role === 'collaborator'),
  );
  return relevant && !dismissed && !collaboratorOnly;
}

/** Why a run that ended with nothing translated stopped. */
function endedCause(run: RunStatus): 'auth' | 'quota' | 'other' {
  const codes = [run.stopCause, ...run.errors.map((e) => e.code)];
  if (codes.includes('auth')) return 'auth';
  if (codes.includes('rate-limit')) return 'quota';
  return 'other';
}

/** How the guide words a run that is not simply working; `null` when it is, or all is well. */
function stallOf(run: RunStatus): RunStall | null {
  if (run.status === RunStatusCode.Paused) {
    // Paused by the person: their call, and theirs to resume.
    if (!run.waitingForQuota) return null;
    // Parked by the app. Two kinds resume by themselves; anything else
    // (provider errors, or no reason given) holds the queue until dealt with.
    if (run.waitingForQuota.reason === 'quota') return 'waiting-quota';
    if (run.waitingForQuota.reason === 'below-target') return 'waiting-model';
    return 'parked';
  }
  if (isRunActive(run) || run.completed > 0) return null;
  return endedCause(run);
}

export interface FirstRunStall {
  runId: string;
  stall: RunStall;
  /** A newer run is already queued behind it, so there is no need to start another. */
  queuedBehind: boolean;
}

/**
 * Where the active project's latest translation run stands when it is not
 * simply working: ended with nothing translated, parked by the app, or
 * waiting to resume. Runs still queued are skipped to find it: they only wait
 * behind the run that matters. Older runs never count, whatever their state.
 */
export function useFirstRunStall(): FirstRunStall | null {
  const relevant = useGuideRelevant();
  const activeProjectId = useProjectStore(activeProjectIdOf);
  // A string, so the selector's result is stable between unrelated run updates.
  const encoded = useRunStore((s) => {
    if (!relevant || activeProjectId === null) return null;
    let head: RunStatus | undefined;
    let newestQueuedAt = -Infinity;
    for (const run of s.runs) {
      if (run.projectId !== activeProjectId || !isTranslationRun(run)) continue;
      if (run.status === RunStatusCode.Queued) {
        newestQueuedAt = Math.max(newestQueuedAt, run.startedAt);
      } else if (!head || run.startedAt > head.startedAt) {
        head = run;
      }
    }
    const stall = head && stallOf(head);
    if (!head || !stall) return null;
    const queuedBehind = newestQueuedAt >= head.startedAt;
    return [stall, queuedBehind ? 'queued' : 'alone', head.runId].join(':');
  });
  return useMemo(() => {
    if (encoded === null) return null;
    const [stall, queued, ...runId] = encoded.split(':');
    return { stall: stall as RunStall, queuedBehind: queued === 'queued', runId: runId.join(':') };
  }, [encoded]);
}

/**
 * Strings are fetched per tab and runs per visit to a tab that shows them, so
 * the guide loads the active project's itself while `enabled`; without them it
 * could not tell an imported project from an empty one, or a translated one
 * from one still waiting. Returns true once both loads have settled (or none
 * is needed), so the caller can hold the guide back instead of flashing an
 * earlier step.
 */
export function useGuideDataReady(enabled: boolean): boolean {
  const activeProjectId = useProjectStore(activeProjectIdOf);
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);
  const [entriesSettledFor, setEntriesSettledFor] = useState<string | null>(null);
  const [runsSettledFor, setRunsSettledFor] = useState<string | null>(null);
  const wanted = enabled ? activeProjectId : null;
  const entriesNeeded = wanted !== null && loadedProjectId !== wanted;

  useEffect(() => {
    if (!entriesNeeded || wanted === null) return;
    let cancelled = false;
    void Promise.resolve(useStringStore.getState().fetchEntries(wanted))
      .catch(() => {
        // The store keeps the error; the guide just treats the project as empty.
      })
      .finally(() => {
        if (!cancelled) setEntriesSettledFor(wanted);
      });
    return () => {
      cancelled = true;
    };
  }, [entriesNeeded, wanted]);

  useEffect(() => {
    if (wanted === null) return;
    let cancelled = false;
    void Promise.resolve(useRunStore.getState().fetchRuns(wanted))
      .catch(() => {
        // Without the runs the guide resumes at "translate", which is safe.
      })
      .finally(() => {
        if (!cancelled) setRunsSettledFor(wanted);
      });
    return () => {
      cancelled = true;
    };
  }, [wanted]);

  if (wanted === null) return true;
  return (!entriesNeeded || entriesSettledFor === wanted) && runsSettledFor === wanted;
}
