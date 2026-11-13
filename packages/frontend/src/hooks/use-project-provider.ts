import { useEffect, useMemo } from 'react';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import {
  effectiveProviderOf,
  routingGroupsOf,
  type EffectiveProvider,
  type ProviderTarget,
} from '../lib/provider-choice.js';
import { useCollabRoutingStore } from '../stores/collab-routing-store.js';
import { accessFor, useProjectStore } from '../stores/project-store.js';
import { useRunStore } from '../stores/run-store.js';

export interface ProjectProvider {
  /** Who translates the project now; null until known (no project, or loading). */
  provider: EffectiveProvider | null;
  /** Where a new choice is written: the project, or the collaborator's own routing. */
  target: ProviderTarget | null;
  role: 'owner' | 'collaborator';
  /** Only a collaborator's routing is loaded separately. */
  loadState: 'loaded' | 'loading' | 'error';
  /** A translation of this project is queued or running: the choice waits for it. */
  translationsInProgress: boolean;
}

/**
 * Who translates `projectId`, read from the routing that really applies: the
 * project's own for its owner, the person's collaborator routing (loaded once)
 * for a collaborator.
 */
export function useProjectProvider(projectId: string | null): ProjectProvider {
  const role = useProjectStore((s) =>
    projectId === null ? 'owner' : accessFor(s, projectId).role,
  );
  const isCollaborator = role === 'collaborator';
  const rules = useProjectStore((s) => s.projects.find((p) => p.id === projectId)?.routingRules);
  const groups = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.routingRuleGroups,
  );
  const projectKnown = useProjectStore((s) => s.projects.some((p) => p.id === projectId));
  const collabDoc = useCollabRoutingStore((s) => s.doc);
  const collabState = useCollabRoutingStore((s) => s.state);
  const loadCollab = useCollabRoutingStore((s) => s.load);
  useEffect(() => {
    if (isCollaborator) void loadCollab();
  }, [isCollaborator, loadCollab]);

  const translationsInProgress = useRunStore((s) =>
    s.runs.some(
      (r) =>
        r.projectId === projectId &&
        (r.status === RunStatusCode.Pending || r.status === RunStatusCode.Running),
    ),
  );

  return useMemo(() => {
    if (projectId === null || !projectKnown) {
      return {
        provider: null,
        target: null,
        role,
        loadState: 'loaded',
        translationsInProgress,
      };
    }
    if (isCollaborator) {
      const loaded = collabState === 'loaded' && collabDoc !== null;
      return {
        provider: loaded
          ? effectiveProviderOf(
              routingGroupsOf(collabDoc.routingRules, collabDoc.routingRuleGroups),
            )
          : null,
        target: { kind: 'collab' },
        role,
        loadState: loaded ? 'loaded' : collabState === 'error' ? 'error' : 'loading',
        translationsInProgress,
      };
    }
    return {
      provider: effectiveProviderOf(routingGroupsOf(rules, groups)),
      target: { kind: 'project', projectId },
      role,
      loadState: 'loaded',
      translationsInProgress,
    };
  }, [
    projectId,
    projectKnown,
    isCollaborator,
    collabState,
    collabDoc,
    rules,
    groups,
    role,
    translationsInProgress,
  ]);
}
