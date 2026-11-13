import { create } from 'zustand';
import type { RoutingRule, RoutingRuleGroup } from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';

/** A collaborator's own routing document (`/api/collab-routing`). */
export interface CollabRoutingDoc {
  routingRules: RoutingRule[];
  routingRuleGroups?: RoutingRuleGroup[];
  activeRoutingRuleGroupId?: string | null;
}

interface CollabRoutingState {
  doc: CollabRoutingDoc | null;
  state: 'idle' | 'loading' | 'loaded' | 'error';
  /** Loads the document unless it is loaded or loading already (`force` reloads). */
  load: (force?: boolean) => Promise<void>;
  save: (payload: {
    rules: RoutingRule[];
    groups: RoutingRuleGroup[];
    activeGroupId: string;
  }) => Promise<void>;
}

/**
 * A collaborator's routing rules, for Simple's provider card and the
 * "Translated by" line. They are per person, not per project: they follow the
 * collaborator into every project shared with them. The Routing tab keeps its
 * own copy (AppShell's `RoutingTabContent`).
 */
export const useCollabRoutingStore = create<CollabRoutingState>()((set, get) => ({
  doc: null,
  state: 'idle',
  load: async (force = false) => {
    const { state } = get();
    if (!force && (state === 'loading' || state === 'loaded')) return;
    set({ state: 'loading' });
    try {
      const doc = await apiRequest<CollabRoutingDoc>('/collab-routing');
      set({ doc, state: 'loaded' });
    } catch {
      set({ state: 'error' });
    }
  },
  save: async (payload) => {
    const doc = await apiRequest<CollabRoutingDoc>('/collab-routing', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    set({ doc, state: 'loaded' });
  },
}));
