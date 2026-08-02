import { create } from 'zustand';
import type { Project, ProjectTemplate, TemplateApplyWarning } from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';
import { runAction } from './store-helpers.js';

export interface ApplyTemplateResult {
  project: Project;
  warnings: TemplateApplyWarning[];
}

interface TemplateStore {
  templates: ProjectTemplate[];
  loading: boolean;
  error: string | null;

  fetchTemplates: () => Promise<void>;
  saveFromProject: (projectId: string, name: string) => Promise<ProjectTemplate>;
  applyTemplate: (templateId: string, name: string) => Promise<ApplyTemplateResult>;
  importTemplate: (data: unknown) => Promise<ProjectTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateStore>()((set) => ({
  templates: [],
  loading: false,
  error: null,

  // Mirrors project-store's fetchProjects: runAction resets `error`, flips
  // `loading`, and on failure records the message into `error` instead of
  // swallowing it — an unreachable API previously looked identical to "no
  // templates exist yet".
  fetchTemplates: async () => {
    await runAction<TemplateStore, void>(
      set,
      async () => {
        const data = await apiRequest<{ templates: ProjectTemplate[] }>('/templates');
        set({ templates: data.templates ?? [] });
      },
      { loading: true },
    );
  },

  saveFromProject: async (projectId, name) => {
    const template = await apiRequest<ProjectTemplate>(
      `/templates/from-project/${encodeURIComponent(projectId)}`,
      { method: 'POST', body: JSON.stringify({ name }) },
    );
    set((s) => ({ templates: [...s.templates, template] }));
    return template;
  },

  applyTemplate: async (templateId, name) => {
    return apiRequest<ApplyTemplateResult>(`/templates/${encodeURIComponent(templateId)}/apply`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  importTemplate: async (data) => {
    const template = await apiRequest<ProjectTemplate>('/templates/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    set((s) => ({ templates: [...s.templates, template] }));
    return template;
  },

  deleteTemplate: async (templateId) => {
    await apiRequest(`/templates/${encodeURIComponent(templateId)}`, { method: 'DELETE' });
    set((s) => ({ templates: s.templates.filter((t) => t.id !== templateId) }));
  },
}));
