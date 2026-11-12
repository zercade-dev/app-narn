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
  completedTours: string[];
  declinedTours: string[];
  /** Not persisted. */
  activeTourId: string | null;
  dismissFirstRun: () => void;
  restartFirstRun: () => void;
  finishFirstRun: () => void;
  setSimpleProvider: (id: string | null) => void;
  markExported: () => void;
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
      completedTours: [],
      declinedTours: [],
      activeTourId: null,
      dismissFirstRun: () => set({ firstRunDismissed: true }),
      restartFirstRun: () => set({ firstRunDismissed: false, firstRunFinished: false }),
      finishFirstRun: () => set({ firstRunFinished: true }),
      setSimpleProvider: (simpleProvider) => set({ simpleProvider }),
      markExported: () => set({ exportedOnce: true }),
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
        completedTours: state.completedTours,
        declinedTours: state.declinedTours,
      }),
    },
  ),
);
