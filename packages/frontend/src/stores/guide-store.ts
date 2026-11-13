import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Where a person is in one tour. `last` and `furthest` are 0-based indices
 * among the tour's counted steps (variants are not counted, see `variantOf`).
 */
export interface TourProgress {
  last: number;
  furthest: number;
  completed: boolean;
}

/**
 * The first run's quick test (three entries translated first). `runId` is
 * null until the run it asked for is listed; `decision` is the person's
 * answer to "translate the rest?". `restRunId` is the run that answer
 * produced: the decision is recorded together with it, once it is listed.
 */
export interface QuickTest {
  projectId: string;
  runId: string | null;
  decision: 'pending' | 'rest' | 'skip';
  restRunId?: string;
}

/**
 * The orphans tour's practice orphan: the entry the tour removed with a
 * re-import, so it can be put back even after a reload or an abandoned tour.
 * `position` is its index among the project's live main entries (sortIndex
 * order) when it was removed; `backupId` is the backup taken first, if any.
 */
export interface OrphanSim {
  projectId: string;
  entryId: string;
  position: number;
  backupId: string | null;
}

/**
 * Progress through the guided first run and the per-area tours. Persisted per
 * browser; only the active tour is transient.
 */
interface GuideState {
  /** The person chose "Skip the tour". */
  firstRunDismissed: boolean;
  /** The closing callout was acknowledged. */
  firstRunFinished: boolean;
  /** Module instance id chosen via "Use my own provider", e.g. `openai:default`. */
  simpleProvider: string | null;
  /**
   * Choices still to be applied once their provider's key is saved, keyed by
   * target (a project id, or `collab` for the person's own collaborator
   * routing), valued by module instance id. Set when a provider was chosen
   * for a target, or a project was created, before the key was in the vault.
   */
  pendingProviders: Record<string, string>;
  exportedOnce: boolean;
  /**
   * Module ids the guide has already enabled for the person (`google:default`,
   * `deepl`). Each is enabled once: one they later switch off in Advanced is
   * not switched back on.
   */
  enabledProviders: string[];
  completedTours: string[];
  declinedTours: string[];
  /** Per tour id, including `first-run`. */
  tourProgress: Record<string, TourProgress>;
  /** The first run's quick test, once one was asked for. */
  quickTest: QuickTest | null;
  /** The orphans tour's practice orphan, until it is put back. */
  orphanSim: OrphanSim | null;
  /**
   * Not persisted. The first run's closing step is on screen: a switch to
   * Advanced now starts the Advanced sections tour.
   */
  closingShown: boolean;
  /** Not persisted. */
  activeTourId: string | null;
  /** Not persisted. The counted step index the active tour opens at. */
  activeTourStart: number;
  /**
   * Not persisted. Bumped by every `startTour`, so a start request for the
   * tour already running still reopens it at `activeTourStart`.
   */
  activeTourSeq: number;
  /**
   * Not persisted. The person restarted the first run from the Guide and
   * chose to stay in Advanced: it runs there too, until finished or skipped.
   */
  firstRunForced: boolean;
  dismissFirstRun: () => void;
  /**
   * Start over from the Guide. The earlier export stops counting (it is the
   * one fact kept here rather than read from the app), so the tour does not
   * open on its last step. `forced` runs it in Advanced as well (see
   * `firstRunForced`).
   */
  restartFirstRun: (forced?: boolean) => void;
  /**
   * "Continue setup" after a skip: the guide comes back where it was.
   * `forced` runs it in Advanced as well (see `firstRunForced`).
   */
  resumeFirstRun: (forced?: boolean) => void;
  finishFirstRun: () => void;
  setSimpleProvider: (id: string | null) => void;
  /** Remember (`moduleId`) or forget (`null`) the pending choice for `target`. */
  setPendingProvider: (target: string, moduleId: string | null) => void;
  clearPendingProviders: () => void;
  setQuickTest: (quickTest: QuickTest | null) => void;
  /** The answer to "translate the rest?"; nothing without a quick test. */
  decideQuickTest: (decision: 'rest' | 'skip') => void;
  setClosingShown: (shown: boolean) => void;
  setOrphanSim: (sim: OrphanSim) => void;
  clearOrphanSim: () => void;
  markExported: () => void;
  markProviderEnabled: (id: string) => void;
  /** `at`: the counted step index to open at (default 0). */
  startTour: (id: string, opts?: { at?: number }) => void;
  /** The person is on counted step `counted` (0-based) of tour `id`. */
  recordTourStep: (id: string, counted: number) => void;
  /** Tour `id` was finished: it reopens at its start. */
  completeTour: (id: string) => void;
  endTour: (completed: boolean) => void;
  declineTour: (id: string) => void;
}

const addOnce = (list: string[], id: string): string[] =>
  list.includes(id) ? list : [...list, id];

/** The first run's id (`FIRST_RUN_TOUR_ID`), not imported to keep the store free of tour code. */
const FIRST_RUN_PROGRESS_ID = 'first-run';

const NO_PROGRESS: TourProgress = { last: 0, furthest: 0, completed: false };

function withCompleted(
  progress: Record<string, TourProgress>,
  id: string,
): Record<string, TourProgress> {
  const prev = progress[id] ?? NO_PROGRESS;
  return { ...progress, [id]: { ...prev, last: 0, completed: true } };
}

/**
 * v0 (unversioned) had no `tourProgress`: every field is kept, and each tour
 * already completed, plus the first run when it was finished, counts as
 * completed.
 */
export function migrateGuideState(persisted: unknown, version: number): unknown {
  if (version !== 0 || typeof persisted !== 'object' || persisted === null) return persisted;
  const old = persisted as { completedTours?: unknown; firstRunFinished?: unknown };
  const ids = Array.isArray(old.completedTours)
    ? old.completedTours.filter((id): id is string => typeof id === 'string')
    : [];
  if (old.firstRunFinished === true) ids.push(FIRST_RUN_PROGRESS_ID);
  const tourProgress: Record<string, TourProgress> = {};
  for (const id of ids) tourProgress[id] = { last: 0, furthest: 0, completed: true };
  return { ...persisted, tourProgress };
}

export const useGuideStore = create<GuideState>()(
  persist(
    (set) => ({
      firstRunDismissed: false,
      firstRunFinished: false,
      simpleProvider: null,
      pendingProviders: {},
      exportedOnce: false,
      enabledProviders: [],
      completedTours: [],
      declinedTours: [],
      tourProgress: {},
      quickTest: null,
      orphanSim: null,
      closingShown: false,
      activeTourId: null,
      activeTourStart: 0,
      activeTourSeq: 0,
      firstRunForced: false,
      dismissFirstRun: () => set({ firstRunDismissed: true }),
      restartFirstRun: (forced = false) =>
        set((s) => ({
          firstRunDismissed: false,
          firstRunFinished: false,
          firstRunForced: forced,
          exportedOnce: false,
          quickTest: null,
          // A restarted run is not completed until it is finished again.
          tourProgress: { ...s.tourProgress, [FIRST_RUN_PROGRESS_ID]: NO_PROGRESS },
        })),
      resumeFirstRun: (forced = false) => set({ firstRunDismissed: false, firstRunForced: forced }),
      finishFirstRun: () =>
        set((s) => ({
          firstRunFinished: true,
          tourProgress: withCompleted(s.tourProgress, FIRST_RUN_PROGRESS_ID),
        })),
      setSimpleProvider: (simpleProvider) => set({ simpleProvider }),
      setPendingProvider: (target, moduleId) =>
        set((s) => {
          const { [target]: _dropped, ...rest } = s.pendingProviders;
          return { pendingProviders: moduleId === null ? rest : { ...rest, [target]: moduleId } };
        }),
      clearPendingProviders: () => set({ pendingProviders: {} }),
      setQuickTest: (quickTest) => set({ quickTest }),
      decideQuickTest: (decision) =>
        set((s) => (s.quickTest ? { quickTest: { ...s.quickTest, decision } } : s)),
      setClosingShown: (closingShown) => set({ closingShown }),
      setOrphanSim: (orphanSim) => set({ orphanSim }),
      clearOrphanSim: () => set({ orphanSim: null }),
      markExported: () => set({ exportedOnce: true }),
      markProviderEnabled: (id) =>
        set((s) => ({ enabledProviders: addOnce(s.enabledProviders, id) })),
      startTour: (id, opts) =>
        set((s) => ({
          activeTourId: id,
          activeTourStart: opts?.at ?? 0,
          activeTourSeq: s.activeTourSeq + 1,
        })),
      recordTourStep: (id, counted) =>
        set((s) => {
          const prev = s.tourProgress[id] ?? NO_PROGRESS;
          return {
            tourProgress: {
              ...s.tourProgress,
              [id]: { ...prev, last: counted, furthest: Math.max(prev.furthest, counted) },
            },
          };
        }),
      completeTour: (id) => set((s) => ({ tourProgress: withCompleted(s.tourProgress, id) })),
      endTour: (completed) =>
        set((s) => ({
          activeTourId: null,
          activeTourStart: 0,
          completedTours:
            completed && s.activeTourId
              ? addOnce(s.completedTours, s.activeTourId)
              : s.completedTours,
        })),
      declineTour: (id) => set((s) => ({ declinedTours: addOnce(s.declinedTours, id) })),
    }),
    {
      name: 'translator-guide',
      // `quickTest`, `orphanSim` and `pendingProviders` were added within v1: a state saved
      // without them rehydrates with the default (null), so no version bump
      // is needed.
      version: 1,
      // Stored fields only; the persist merge fills in the rest.
      migrate: (persisted, version) => migrateGuideState(persisted, version) as GuideState,
      partialize: (state) => ({
        firstRunDismissed: state.firstRunDismissed,
        firstRunFinished: state.firstRunFinished,
        simpleProvider: state.simpleProvider,
        pendingProviders: state.pendingProviders,
        exportedOnce: state.exportedOnce,
        enabledProviders: state.enabledProviders,
        completedTours: state.completedTours,
        declinedTours: state.declinedTours,
        tourProgress: state.tourProgress,
        quickTest: state.quickTest,
        orphanSim: state.orphanSim,
      }),
    },
  ),
);
