import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  /** Not persisted. */
  activeTourId: string | null;
  /**
   * Not persisted. The person restarted the first run from the Guide and
   * chose to stay in Advanced: it runs there too, until finished or skipped.
   */
  firstRunForced: boolean;
  dismissFirstRun: () => void;
  /** `forced` runs it in Advanced as well (see `firstRunForced`). */
  restartFirstRun: (forced?: boolean) => void;
  finishFirstRun: () => void;
  setSimpleProvider: (id: string | null) => void;
  markExported: () => void;
  markProviderEnabled: (id: string) => void;
  startTour: (id: string) => void;
  endTour: (completed: boolean) => void;
  declineTour: (id: string) => void;
}

const addOnce = (list: string[], id: string): string[] =>
  list.includes(id) ? list : [...list, id];

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
      activeTourId: null,
      firstRunForced: false,
      dismissFirstRun: () => set({ firstRunDismissed: true }),
      restartFirstRun: (forced = false) =>
        set({ firstRunDismissed: false, firstRunFinished: false, firstRunForced: forced }),
      finishFirstRun: () => set({ firstRunFinished: true }),
      setSimpleProvider: (simpleProvider) => set({ simpleProvider }),
      markExported: () => set({ exportedOnce: true }),
      markProviderEnabled: (id) =>
        set((s) => ({ enabledProviders: addOnce(s.enabledProviders, id) })),
      startTour: (id) => set({ activeTourId: id }),
      endTour: (completed) =>
        set((s) => ({
          activeTourId: null,
          completedTours:
            completed && s.activeTourId
              ? addOnce(s.completedTours, s.activeTourId)
              : s.completedTours,
        })),
      declineTour: (id) => set((s) => ({ declinedTours: addOnce(s.declinedTours, id) })),
    }),
    {
      name: 'translator-guide',
      partialize: (state) => ({
        firstRunDismissed: state.firstRunDismissed,
        firstRunFinished: state.firstRunFinished,
        simpleProvider: state.simpleProvider,
        exportedOnce: state.exportedOnce,
        enabledProviders: state.enabledProviders,
        completedTours: state.completedTours,
        declinedTours: state.declinedTours,
      }),
    },
  ),
);
