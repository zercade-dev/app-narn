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
  /** "Continue setup" after a skip: the guide comes back where it was. */
  resumeFirstRun: () => void;
  finishFirstRun: () => void;
  setSimpleProvider: (id: string | null) => void;
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
      exportedOnce: false,
      enabledProviders: [],
      completedTours: [],
      declinedTours: [],
      tourProgress: {},
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
          // A restarted run is not completed until it is finished again.
          tourProgress: { ...s.tourProgress, [FIRST_RUN_PROGRESS_ID]: NO_PROGRESS },
        })),
      resumeFirstRun: () => set({ firstRunDismissed: false }),
      finishFirstRun: () =>
        set((s) => ({
          firstRunFinished: true,
          tourProgress: withCompleted(s.tourProgress, FIRST_RUN_PROGRESS_ID),
        })),
      setSimpleProvider: (simpleProvider) => set({ simpleProvider }),
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
      version: 1,
      // Stored fields only; the persist merge fills in the rest.
      migrate: (persisted, version) => migrateGuideState(persisted, version) as GuideState,
      partialize: (state) => ({
        firstRunDismissed: state.firstRunDismissed,
        firstRunFinished: state.firstRunFinished,
        simpleProvider: state.simpleProvider,
        exportedOnce: state.exportedOnce,
        enabledProviders: state.enabledProviders,
        completedTours: state.completedTours,
        declinedTours: state.declinedTours,
        tourProgress: state.tourProgress,
      }),
    },
  ),
);
