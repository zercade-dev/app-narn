/**
 * Choosing who translates in Simple mode: NARN Freeway, or one provider of the
 * person's own. The one write path shared by the project's provider card and
 * the guide's "Use my own provider" sheet, so the two cannot drift. No new
 * server routes: it writes what Global Config and the Routing tab's simple
 * selector write.
 */
import {
  FREEWAY_MODULE_ID,
  type RoutingRule,
  type RoutingRuleGroup,
} from '@zercade-dev/narn-shared';
import { isSimpleRouting, makeSimpleRule, simpleRuleModuleId } from './routing-mode.js';
import {
  applySimpleRule,
  enableProvider,
  providerInstanceId,
  providerKeyFor,
} from './simple-provider.js';
import { useCollabRoutingStore } from '../stores/collab-routing-store.js';
import { useGuideStore } from '../stores/guide-store.js';
import { accessFor, useProjectStore } from '../stores/project-store.js';
import { useVaultStore } from '../stores/vault-store.js';

/** Whose routing the choice is written to. */
export type ProviderTarget =
  | { kind: 'project'; projectId: string }
  /** The collaborator's own routing, used in every project shared with them. */
  | { kind: 'collab' };

/** Who translates, read from a routing document. */
export type EffectiveProvider =
  | { kind: 'freeway' }
  | { kind: 'own'; moduleId: string }
  /** Routing built in Advanced that one choice cannot describe. */
  | { kind: 'custom' };

export type ProviderChoiceResult =
  /** The routing now sends everything to `moduleId`. */
  | { status: 'applied'; moduleId: string }
  /**
   * Remembered, and applied by `useProviderSetup` once `vaultKey` is saved in
   * an unlocked vault (enabling a provider is refused without its key).
   */
  | { status: 'needs-key'; vaultKey: string | undefined }
  /** The provider is switched off in Advanced (Global Config): nothing written. */
  | { status: 'switched-off' }
  /** The routing is custom, not someone else's to change, or not loaded: nothing written. */
  | { status: 'routing-kept' };

/** A routing document as groups: a project saved before groups existed has only `rules`. */
export function routingGroupsOf(
  rules: RoutingRule[] | undefined,
  groups: RoutingRuleGroup[] | undefined,
): RoutingRuleGroup[] {
  if (groups && groups.length > 0) return groups;
  return [{ id: 'default-group', name: 'Default Group', rules: rules ?? [] }];
}

export function effectiveProviderOf(groups: RoutingRuleGroup[]): EffectiveProvider {
  if (!isSimpleRouting(groups)) return { kind: 'custom' };
  const moduleId = simpleRuleModuleId(groups);
  if (moduleId === null || moduleId === FREEWAY_MODULE_ID) return { kind: 'freeway' };
  return { kind: 'own', moduleId };
}

/** The target's routing, or null when it is not known or not the person's to change. */
function writableGroups(target: ProviderTarget): RoutingRuleGroup[] | null {
  if (target.kind === 'collab') {
    const { doc, state } = useCollabRoutingStore.getState();
    // Never write over a document that was not read: it would replace the saved one.
    if (state !== 'loaded' || !doc) return null;
    return routingGroupsOf(doc.routingRules, doc.routingRuleGroups);
  }
  const projects = useProjectStore.getState();
  const project = projects.projects.find((p) => p.id === target.projectId);
  if (!project || accessFor(projects, project.id).role !== 'owner') return null;
  return routingGroupsOf(project.routingRules, project.routingRuleGroups);
}

/** `pendingProviderTarget`'s encoding of a target. */
export const targetKey = (target: ProviderTarget): string =>
  target.kind === 'collab' ? 'collab' : target.projectId;

export function targetOfKey(key: string): ProviderTarget {
  return key === 'collab' ? { kind: 'collab' } : { kind: 'project', projectId: key };
}

/**
 * Point the target's routing at `moduleId` with one catch-all rule, unless the
 * routing is custom (built in Advanced), which is never overwritten.
 */
export async function applyProviderTo(
  target: ProviderTarget,
  moduleId: string,
): Promise<ProviderChoiceResult> {
  const groups = writableGroups(target);
  if (groups === null || !isSimpleRouting(groups)) return { status: 'routing-kept' };
  if (target.kind === 'collab') {
    const rule = makeSimpleRule(moduleId, groups[0]?.rules[0]?.id);
    const groupId = groups[0]?.id ?? 'default-group';
    await useCollabRoutingStore.getState().save({
      rules: [rule],
      groups: [{ id: groupId, name: groups[0]?.name ?? 'Default Group', rules: [rule] }],
      activeGroupId: groupId,
    });
  } else {
    await applySimpleRule(target.projectId, moduleId);
    await useProjectStore.getState().fetchProjects();
  }
  return { status: 'applied', moduleId };
}

/**
 * Choose who translates: `base` (a base module id such as `anthropic`), or
 * `null` for NARN Freeway. Applies to `target` (none before a project exists)
 * and is remembered for the projects the person creates next.
 *
 * An own provider whose key is not in an unlocked vault yet is remembered with
 * its target and applied once the key is saved (`needs-key`). One switched off
 * in Advanced is left off (`switched-off`), and the earlier choice stays.
 */
export async function chooseProvider(
  base: string | null,
  target: ProviderTarget | null,
): Promise<ProviderChoiceResult> {
  const guide = useGuideStore.getState();
  if (base === null) {
    guide.setSimpleProvider(null);
    guide.setPendingProviderTarget(null);
    return target
      ? applyProviderTo(target, FREEWAY_MODULE_ID)
      : { status: 'applied', moduleId: FREEWAY_MODULE_ID };
  }

  const vaultKey = providerKeyFor(base);
  const { unlocked, keys } = useVaultStore.getState();
  if (vaultKey !== undefined && !(unlocked && keys.includes(vaultKey))) {
    guide.setSimpleProvider(providerInstanceId(base));
    guide.setPendingProviderTarget(target ? targetKey(target) : null);
    return { status: 'needs-key', vaultKey };
  }

  const moduleId = await enableProvider(base);
  if (moduleId === null) return { status: 'switched-off' };
  // Marked before it is chosen, so `useProviderSetup` never sees the choice
  // without the mark and enables it a second time.
  guide.markProviderEnabled(moduleId);
  guide.setSimpleProvider(moduleId);
  guide.setPendingProviderTarget(null);
  return target ? applyProviderTo(target, moduleId) : { status: 'applied', moduleId };
}
