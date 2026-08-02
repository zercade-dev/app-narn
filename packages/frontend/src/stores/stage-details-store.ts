/**
 * Stage details store — UI-only state plus the two mutating API actions.
 * Deliberately THIN: `project.stageDetails` on the current project
 * (project-store) stays the single source of truth. `patch()` PATCHes the
 * server, then merges the response into the project-store's projects array (the
 * same local-merge pattern `updateProject`/`setManualEditAuditEnabled` use — no
 * refetch) so components re-render from the updated project. This store never
 * caches `StageDetails` itself: components read `project.stageDetails` directly
 * and derive staleness with `isStaleTranslation` from `@zercade-dev/narn-shared`.
 */
import { create } from 'zustand';
import type { StageDetails, StageDetailFieldId } from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';
import { useProjectStore } from './project-store.js';

export type StageDetailsPatchBody = Partial<
  Record<
    StageDetailFieldId,
    {
      sourceText?: string;
      maxLength?: number | null;
      translations?: Record<string, { text: string; moduleId?: 'manual' | 'chat' }>;
    }
  >
>;

export type StageDetailsTranslateBody = {
  languages?: string[];
  fields?: StageDetailFieldId[];
  staleOnly?: boolean;
  moduleId?: string;
  model?: string;
  reasoningEffort?: string;
};

interface StageDetailsStore {
  selectedLang: string | null;
  chatOpen: boolean;
  chatFocus: { field: StageDetailFieldId; lang: string | null } | null;
  setSelectedLang: (lang: string) => void;
  setChatOpen: (open: boolean) => void;
  setChatFocus: (f: StageDetailsStore['chatFocus']) => void;
  /** PATCHes `/projects/:id/stage-details`, then merges the result into the project store. */
  patch: (projectId: string, body: StageDetailsPatchBody) => Promise<StageDetails>;
  /** POSTs `/projects/:id/stage-details/translate`; the run itself is tracked via the run store. */
  startTranslate: (
    projectId: string,
    body: StageDetailsTranslateBody,
  ) => Promise<{ runId: string }>;
}

export const useStageDetailsStore = create<StageDetailsStore>()((set) => ({
  selectedLang: null,
  chatOpen: false,
  chatFocus: null,

  setSelectedLang: (lang) => set({ selectedLang: lang }),
  setChatOpen: (open) => set({ chatOpen: open }),
  setChatFocus: (f) => set({ chatFocus: f }),

  patch: async (projectId, body) => {
    const updated = await apiRequest<StageDetails>(`/projects/${projectId}/stage-details`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    // stageDetails lives on the project object; merge the server's full
    // updated StageDetails into the projects array locally (sibling pattern:
    // project-store's updateProject / setManualEditAuditEnabled) so components
    // reading `project.stageDetails` re-render — no second network call.
    useProjectStore.setState((s) => ({
      projects: s.projects.map((p) => (p.id === projectId ? { ...p, stageDetails: updated } : p)),
    }));
    return updated;
  },

  startTranslate: async (projectId, body) => {
    const { runId } = await apiRequest<{ runId: string; status: string }>(
      `/projects/${projectId}/stage-details/translate`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
    return { runId };
  },
}));
