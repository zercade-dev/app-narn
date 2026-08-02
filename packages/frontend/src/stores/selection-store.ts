import { create } from 'zustand';
import { useProjectStore } from './project-store.js';

interface SelectionState {
  selectedIds: Set<string>;
  /**
   * The active project id the current selection belongs to. Tracked so a
   * project switch can drop stale ids in the store itself (see
   * {@link SelectionState.resetForProject}) rather than relying only on a
   * render-time compare inside StringTable — which stops running the moment
   * StringTable unmounts, letting project-A ids reach project-B endpoints.
   */
  activeProjectId: string | null;
  toggle: (id: string) => void;
  setPage: (ids: string[], checked: boolean) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  /**
   * Reconcile the selection with `projectId`: when it differs from the project
   * the current selection belongs to, drop every selected id (a fresh project
   * starts with nothing selected). A no-op when the project is unchanged, so it
   * is safe to call on every project-store change.
   */
  resetForProject: (projectId: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: new Set<string>(),
  activeProjectId: null,

  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  setPage: (ids, checked) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return { selectedIds: next };
    }),

  selectAll: (ids) => set({ selectedIds: new Set(ids) }),

  clear: () => set({ selectedIds: new Set() }),

  resetForProject: (projectId) =>
    set((s) => {
      if (s.activeProjectId === projectId) return s;
      return { activeProjectId: projectId, selectedIds: new Set<string>() };
    }),
}));

// Clear the per-project selection in the store whenever the active project
// changes. The project store owns the active id, so subscribing here keeps the
// reset working even when no StringTable is mounted to run its render-time
// compare (the previous, gap-prone guard). project-store never imports this
// store, so this dependency direction introduces no import cycle.
useProjectStore.subscribe((state, prev) => {
  if (state.activeProjectId !== prev.activeProjectId) {
    useSelectionStore.getState().resetForProject(state.activeProjectId);
  }
});
