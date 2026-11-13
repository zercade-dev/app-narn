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
  /** The routing is custom (built in Advanced): never overwritten, nothing written. */
  | { status: 'routing-kept' }
  /**
   * The routing could not be read (a collaborator document that failed to
   * load) or is not the person's: nothing written. Not a decision, so a
   * pending choice is kept and retried.
   */
  | { status: 'unavailable' }
  /** The project no longer exists: nothing to write to. */
  | { status: 'gone' };

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

/**
 * The target's routing as it is now. A collaborator's document is always
 * re-read first: the Routing tab saves it through its own copy, so the cached
 * one may be stale, and judging "simple or custom" on a stale copy could
 * overwrite routing built in Advanced.
 */
async function currentGroups(
  target: ProviderTarget,
): Promise<RoutingRuleGroup[] | 'unavailable' | 'gone'> {
  if (target.kind === 'collab') {
    const store = useCollabRoutingStore.getState();
    await store.load(true);
    const { doc, state } = useCollabRoutingStore.getState();
    // Never write over a document that was not read: it would replace the saved one.
    if (state !== 'loaded' || !doc) return 'unavailable';
    return routingGroupsOf(doc.routingRules, doc.routingRuleGroups);
  }
  const projects = useProjectStore.getState();
  const project = projects.projects.find((p) => p.id === target.projectId);
  if (!project) return 'gone';
  if (accessFor(projects, project.id).role !== 'owner') return 'unavailable';
  return routingGroupsOf(project.routingRules, project.routingRuleGroups);
}

/** The key of a target in `pendingProviders`. */
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
  const groups = await currentGroups(target);
  if (groups === 'unavailable' || groups === 'gone') return { status: groups };
  if (!isSimpleRouting(groups)) return { status: 'routing-kept' };
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
    if (target) guide.setPendingProvider(targetKey(target), null);
    return target
      ? applyProviderTo(target, FREEWAY_MODULE_ID)
      : { status: 'applied', moduleId: FREEWAY_MODULE_ID };
  }

  const vaultKey = providerKeyFor(base);
  const { unlocked, keys } = useVaultStore.getState();
  if (vaultKey !== undefined && !(unlocked && keys.includes(vaultKey))) {
    guide.setSimpleProvider(providerInstanceId(base));
    if (target) guide.setPendingProvider(targetKey(target), providerInstanceId(base));
    return { status: 'needs-key', vaultKey };
  }

  const moduleId = await enableProvider(base);
  if (moduleId === null) return { status: 'switched-off' };
  // Marked before it is chosen, so `useProviderSetup` never sees the choice
  // without the mark and enables it a second time.
  guide.markProviderEnabled(moduleId);
  guide.setSimpleProvider(moduleId);
  if (target) guide.setPendingProvider(targetKey(target), null);
  return target ? applyProviderTo(target, moduleId) : { status: 'applied', moduleId };
}
