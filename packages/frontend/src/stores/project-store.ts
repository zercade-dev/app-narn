import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project } from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';
import { runAction } from './store-helpers.js';
import { CollabApiError, getNickname, listSharedProjects } from '../lib/collab-api.js';

/**
 * A project's collaboration access for the CURRENT user. Mirrors the
 * server's `GET /api/projects` `access` map entries
 * (`packages/server/src/routes/projects.ts`).
 */
export interface ProjectAccessInfo {
  role: 'owner' | 'collaborator';
  /** Languages this member may write. Ignored (and empty) for owners. */
  writableLanguages: string[];
  /** True once a project has ever had more than one member (owner-only signal). */
  sharedEver: boolean;
}

/**
 * The default-owner rule (Global Constraints): a project with no access
 * entry — local/open-core mode, or a fetch race before `access` populates —
 * behaves exactly as full, unshared ownership.
 */
export const DEFAULT_ACCESS: ProjectAccessInfo = {
  role: 'owner',
  writableLanguages: [],
  sharedEver: false,
};

/**
 * Pure lookup: the caller's access to `projectId`, defaulting to
 * {@link DEFAULT_ACCESS} when `projectId` is null/absent from `state.access`.
 * Takes a minimal state shape (not the full store) so it's usable both from
 * `useProjectStore.getState()` and directly in components/tests.
 */
export function accessFor(
  state: { access: Record<string, ProjectAccessInfo> },
  projectId: string | null,
): ProjectAccessInfo {
  if (!projectId) return DEFAULT_ACCESS;
  return state.access[projectId] ?? DEFAULT_ACCESS;
}

interface ProjectListResponse {
  projects: Project[];
  activeId: string | null;
  access?: Record<string, ProjectAccessInfo>;
  selfUserId?: string | null;
}

interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;
  /** Per-project access for the current user; refetch-derived, not persisted. */
  access: Record<string, ProjectAccessInfo>;
  /** Owner display nickname per shared project id; refetch-derived, not persisted. */
  ownerNicknames: Record<string, string | null>;
  /** The current user's own id (cloud mode), or `null` (local/open-core, or before first fetch). */
  selfUserId: string | null;
  /**
   * The current user's own claimed nickname (cloud mode), or `null` when
   * unclaimed / local/open-core / before first fetch. Refetch-derived, not
   * persisted — mirrors `ownerNicknames`/`selfUserId` above.
   */
  selfNickname: string | null;

  fetchProjects: () => Promise<void>;
  createProject: (
    name: string,
    sourceLanguage: string,
    activeLanguages: string[],
    icon?: string,
  ) => Promise<Project>;
  updateProject: (id: string, partial: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<Project>;
  activateProject: (id: string) => Promise<void>;
  /**
   * Client-only active-project set, used by URL sync to apply ?project
   * synchronously (so URL canonicalization doesn't race the server round-trip).
   * Persisted by the store's persist middleware; does NOT call the server.
   * Explicit user switches still go through `activateProject` (client + server).
   */
  setActiveProjectId: (id: string | null) => void;
  updateLanguages: (
    id: string,
    activeLanguages: string[],
    sourceLanguage?: string,
  ) => Promise<void>;
  getActiveProject: () => Project | undefined;
  /**
   * Owner-only toggle (manual-edit-audit feature): PATCHes
   * `/projects/:id/manual-edit-audit` and applies the server's echoed
   * `enabled` value to the project's `manualEditAuditEnabled` field in place.
   */
  setManualEditAuditEnabled: (id: string, enabled: boolean) => Promise<void>;
  /**
   * Fetches the owner display nickname for every project the current user
   * collaborates on (via `listSharedProjects()`) and merges the result into
   * `ownerNicknames`. Swallows (and logs) `CollabApiError` rather than
   * surfacing a store error — open-core servers 404 this cloud-only route,
   * and a missing nickname map is a cosmetic gap, not a failure worth
   * blocking on.
   */
  loadSharedProjectNicknames: () => Promise<void>;
  /**
   * Fetches the current user's own claimed nickname (via `getNickname()`)
   * and sets `selfNickname`. Swallows (and logs) `CollabApiError` the same
   * way `loadSharedProjectNicknames` does — open-core servers 404 this
   * cloud-only route, and a missing self-nickname is a cosmetic gap (the
   * `displayName` helper falls back to `me`), not a failure worth blocking on.
   */
  loadSelfNickname: () => Promise<void>;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      loading: false,
      error: null,
      access: {},
      ownerNicknames: {},
      selfUserId: null,
      selfNickname: null,

      fetchProjects: async () => {
        await runAction<ProjectStore, void>(
          set,
          async () => {
            const data = await apiRequest<ProjectListResponse>('/projects');
            set((s) => ({
              projects: data.projects,
              // Adopt the server's active id only on the *initial* load (no client
              // active project chosen yet). On later fetches keep the current
              // client active id, so Back/Forward navigation (which sets the
              // active id client-side) isn't snapped back to a stale project by a
              // refetch re-imposing the server's value.
              activeProjectId: s.activeProjectId ?? data.activeId,
              access: data.access ?? {},
              selfUserId: data.selfUserId ?? null,
            }));
          },
          { loading: true },
        );
      },

      createProject: async (name, sourceLanguage, activeLanguages, icon) => {
        const project = await apiRequest<Project>('/projects', {
          method: 'POST',
          body: JSON.stringify({ name, sourceLanguage, activeLanguages, icon }),
        });
        set((s) => ({ projects: [...s.projects, project] }));
        return project;
      },

      updateProject: async (id, partial) => {
        const updated = await apiRequest<Project>(`/projects/${id}`, {
          method: 'PUT',
          body: JSON.stringify(partial),
        });
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
      },

      deleteProject: async (id) => {
        await apiRequest(`/projects/${id}`, { method: 'DELETE' });
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        }));
      },

      duplicateProject: async (id) => {
        const project = await apiRequest<Project>(`/projects/${id}/duplicate`, {
          method: 'POST',
        });
        set((s) => ({ projects: [...s.projects, project] }));
        return project;
      },

      activateProject: async (id) => {
        await apiRequest(`/projects/${id}/activate`, { method: 'POST' });
        set({ activeProjectId: id });
      },

      setActiveProjectId: (id) => set({ activeProjectId: id }),

      updateLanguages: async (id, activeLanguages, sourceLanguage) => {
        const updated = await apiRequest<Project>(`/projects/${id}/languages`, {
          method: 'PUT',
          body: JSON.stringify({ activeLanguages, sourceLanguage }),
        });
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? updated : p)),
        }));
      },

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId);
      },

      setManualEditAuditEnabled: async (id, enabled) => {
        const result = await apiRequest<{ enabled: boolean }>(`/projects/${id}/manual-edit-audit`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled }),
        });
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, manualEditAuditEnabled: result.enabled } : p,
          ),
        }));
      },

      loadSharedProjectNicknames: async () => {
        try {
          const shared = await listSharedProjects();
          set((s) => ({
            ownerNicknames: {
              ...s.ownerNicknames,
              ...Object.fromEntries(shared.map((p) => [p.projectId, p.ownerNickname])),
            },
          }));
        } catch (err) {
          if (!(err instanceof CollabApiError)) throw err;
          // Open-core (no cloud collab surface) 404s here, and any other
          // collab-layer failure is a nice-to-have miss, not worth a store
          // error — see the interface doc above.
          console.error('[project-store] loadSharedProjectNicknames failed:', err.code);
        }
      },

      loadSelfNickname: async () => {
        try {
          const nickname = await getNickname();
          set({ selfNickname: nickname });
        } catch (err) {
          if (!(err instanceof CollabApiError)) throw err;
          console.error('[project-store] loadSelfNickname failed:', err.code);
        }
      },
    }),
    {
      name: 'translator-project-store',
      partialize: (s) => ({ activeProjectId: s.activeProjectId }),
    },
  ),
);
