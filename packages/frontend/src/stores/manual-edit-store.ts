import { create } from 'zustand';
import { apiRequest } from '../hooks/use-api.js';
import { runAction } from './store-helpers.js';

/**
 * One manual (human) text edit recorded by the server's manual-edit-audit
 * feature. Mirrors `GET /api/projects/:id/manual-edits`'s response
 * shape (`packages/server/src/routes/manual-edits.ts`) — not re-exported
 * from `@zercade-dev/narn-shared` (a route-local shape), so declared here
 * like `SourceReviewRecord` in `run-store.ts`.
 */
export interface ManualEditRecord {
  id: string;
  entryId: string;
  /** The joined string's own id, or `entryId` once the source entry has since been deleted. */
  entryKey: string;
  /** Source text preview, `null` once the source entry has since been deleted. */
  sourcePreview: string | null;
  language: string;
  /** `null` when there was no prior value (e.g. a from-scratch translation). */
  beforeText: string | null;
  afterText: string;
  createdBy: string;
  createdAt: string; // ISO 8601
}

interface ManualEditStore {
  /** Per-project manual-edit history, newest-first (as returned by the API). */
  editsByProject: Record<string, ManualEditRecord[]>;
  loading: boolean;
  error: string | null;
  /**
   * Fetches (and replaces) the manual-edit history for `projectId`. Owners
   * get every project edit; collaborators only their own (server-side
   * scoping — see the route doc above).
   */
  fetchManualEdits: (projectId: string) => Promise<void>;
}

export const useManualEditStore = create<ManualEditStore>()((set) => ({
  editsByProject: {},
  loading: false,
  error: null,

  fetchManualEdits: async (projectId) => {
    await runAction<ManualEditStore, void>(
      set,
      async () => {
        const edits = await apiRequest<ManualEditRecord[]>(`/projects/${projectId}/manual-edits`);
        set((s) => ({ editsByProject: { ...s.editsByProject, [projectId]: edits } }));
      },
      { loading: true },
    );
  },
}));
