import type { Project, RoutingRule } from '@zercade-dev/narn-shared';
import { getCollabRoutingStore, getMemberStore } from '../../storage/registry.js';

/**
 * The routing rules THIS tenant's runs must use for `project`: owners (and local
 * mode) get the project's rules; collaborators get their personal collab-routing
 * document (empty rules when never configured — their runs then route nowhere and
 * fail fast with the existing no-module handling, which is the correct signal to
 * configure the Routing tab). Ambient-tenant-driven: engine bodies re-establish
 * the creator's tenant, so enqueue-time and mid-run resolution agree.
 */
export async function resolveRoutingRules(project: Project): Promise<RoutingRule[]> {
  // Ambient tenant: local mode has no membership row (null) → owner path.
  const membership = await getMemberStore().getMembership(project.id);
  if (!membership || membership.role !== 'collaborator') {
    return project.routingRules;
  }
  // Collaborator: their user-global routing document, or an empty rule set when
  // never configured (routes nowhere → existing no-module fail-fast).
  const doc = await getCollabRoutingStore().get();
  return doc?.routingRules ?? [];
}
