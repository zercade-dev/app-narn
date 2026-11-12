import { useEffect, useMemo, useState } from 'react';
import { RunStatusCode, type RunStatus } from '@zercade-dev/narn-shared';
import { isRunActive, isTranslationRun } from '../lib/run-kind.js';
import { FREE_KEYS, providerKeyFor } from '../lib/simple-provider.js';
import type { RunFailure } from '../lib/tour/first-run.js';
import type { GuideFacts } from '../lib/tour/types.js';
import { useGuideStore } from '../stores/guide-store.js';
import { useProjectStore } from '../stores/project-store.js';
import { useRunStore } from '../stores/run-store.js';
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

/** Whether the guided first run can still matter: Simple mode and not finished. */
function useGuideRelevant(): boolean {
  const simple = useUiMode() === 'simple';
  const finished = useGuideStore((s) => s.firstRunFinished);
  return simple && !finished;
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
 * The project's strings and runs are only looked at while the guide can still
 * matter (Simple mode, not finished); otherwise those two facts read false and
 * a string or run update re-renders nothing.
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
      isCollaboratorOnly,
    };
  }, [
    cloudManaged,
    setupRequired,
    hasVault,
    vaultUnlocked,
    usableKey,
    exported,
    activeProjectId,
    projectHasLanguages,
    projectHasEntries,
    translationExists,
    isCollaboratorOnly,
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

/** Why a run that translated nothing stopped, in the guide's three wordings. */
function failureOf(run: RunStatus): RunFailure {
  const codes = [run.stopCause, ...run.errors.map((e) => e.code)];
  if (codes.includes('auth')) return 'auth';
  if (codes.includes('rate-limit') || run.waitingForQuota?.reason === 'quota') return 'quota';
  return 'other';
}

/** A run the app parked on a provider (quota, errors) before it translated anything. */
function parkedEmpty(run: RunStatus): boolean {
  return (
    run.status === RunStatusCode.Paused && run.waitingForQuota !== undefined && run.completed === 0
  );
}

export interface FirstRunFailure {
  runId: string;
  cause: RunFailure;
  /** Still parked (not ended): it holds the project's queue until cancelled or resumed. */
  parked: boolean;
  /** A newer run is already queued behind it, so there is no need to start another. */
  queuedBehind: boolean;
}

/**
 * The active project's translation run that stopped without translating
 * anything, when that is where things stand: nothing is working right now and
 * either a run is parked waiting on a provider (later runs only queue behind
 * it), or the latest run ended (failed, cancelled, or completed with every
 * string failing). `null` while a run is working, once the latest run has
 * translated something, and when there is no run.
 */
export function useFirstRunFailure(): FirstRunFailure | null {
  const relevant = useGuideRelevant();
  const activeProjectId = useProjectStore(activeProjectIdOf);
  // A string, so the selector's result is stable between unrelated run updates.
  const encoded = useRunStore((s) => {
    if (!relevant || activeProjectId === null) return null;
    const runs = s.runs
      .filter((run) => run.projectId === activeProjectId && isTranslationRun(run))
      .sort((a, b) => b.startedAt - a.startedAt);
    const working = (run: RunStatus) =>
      run.status === RunStatusCode.Running || run.status === RunStatusCode.Pending;
    if (runs.length === 0 || runs.some(working)) return null;
    const parked = runs.find(parkedEmpty);
    const failed = parked ?? runs[0];
    if (failed.completed > 0 || isRunActive(failed)) return null;
    if (failed.status === RunStatusCode.Paused && !parked) return null;
    const queuedBehind = runs.some(
      (run) => run.status === RunStatusCode.Queued && run.startedAt >= failed.startedAt,
    );
    return [
      failureOf(failed),
      parked ? 'parked' : 'ended',
      queuedBehind ? 'queued' : 'alone',
      failed.runId,
    ].join(':');
  });
  return useMemo(() => {
    if (encoded === null) return null;
    const [cause, parked, queued, ...runId] = encoded.split(':');
    return {
      cause: cause as RunFailure,
      parked: parked === 'parked',
      queuedBehind: queued === 'queued',
      runId: runId.join(':'),
    };
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
