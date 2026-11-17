/**
 * Simple-vs-advanced routing mode (issue app-narn#60).
 *
 * The Routing tab defaults to a single "translate everything with X" selector.
 * That view can only faithfully represent a routing document that really does
 * send everything to one place, so this module defines — strictly — which
 * documents qualify. Anything richer renders the full editor no matter what the
 * user's mode preference says, which is what keeps a preference set once and
 * forgotten from ever hiding a configuration someone built by hand.
 *
 * Choosing Simple on such a project is an explicit decision, and it sets the
 * rules aside rather than deleting them: they stay in their own group, and a
 * group of their own ({@link SIMPLE_GROUP_ID}) holding one catch-all rule
 * becomes the active one. The server routes with the active group only, so
 * the rules set aside stop applying. Choosing Advanced makes their group
 * active again ({@link toAdvancedRouting}).
 */
import { PSEUDO_MODULE_ID } from '@zercade-dev/narn-shared';
import type { RoutingRule, RoutingRuleGroup } from '@zercade-dev/narn-shared';

/**
 * True when the rule imposes no constraint beyond its module. `name` is
 * cosmetic and does not disqualify; a `targetLanguages` of `['*']` (or the
 * legacy `targetLanguage: '*'`) is a wildcard, so it constrains nothing either.
 * Empty arrays are treated as absent, matching M7's `matches()`.
 */
function isUnconstrainedRule(rule: RoutingRule): boolean {
  if (rule.maxLength !== undefined) return false;
  if (rule.modelOverride !== undefined) return false;
  if (rule.reasoningEffortOverride !== undefined) return false;
  if (rule.promptOptions !== undefined) return false;
  if (rule.sources !== undefined && rule.sources.length > 0) return false;
  if (rule.categories !== undefined && rule.categories.length > 0) return false;
  if (rule.tones !== undefined && rule.tones.length > 0) return false;
  if (rule.achievementTypes !== undefined && rule.achievementTypes.length > 0) return false;
  if (rule.targetLanguages !== undefined && rule.targetLanguages.length > 0) {
    if (rule.targetLanguages.length !== 1 || rule.targetLanguages[0] !== '*') return false;
  }
  if (rule.targetLanguage !== undefined && rule.targetLanguage !== '*') return false;
  return true;
}

/** The group Simple mode routes with while Advanced rules are set aside. */
export const SIMPLE_GROUP_ID = 'simple-group';
/** Stored group name (user data, like every group name, so not translated). */
const SIMPLE_GROUP_NAME = 'Simple';

/**
 * The groups that decide who translates. While the Simple group is active the
 * other groups are set aside (the server routes with the active group only),
 * so only the Simple group counts; otherwise the whole document does.
 */
export function effectiveRoutingGroups(
  groups: RoutingRuleGroup[],
  activeGroupId: string | null | undefined,
): RoutingRuleGroup[] {
  if (activeGroupId !== SIMPLE_GROUP_ID) return groups;
  const simple = groups.find((g) => g.id === SIMPLE_GROUP_ID);
  return simple ? [simple] : groups;
}

/** Groups set aside behind an active Simple group (none when it is not active). */
export function setAsideGroups(
  groups: RoutingRuleGroup[],
  activeGroupId: string | null | undefined,
): RoutingRuleGroup[] {
  if (activeGroupId !== SIMPLE_GROUP_ID) return [];
  return groups.filter((g) => g.id !== SIMPLE_GROUP_ID);
}

/**
 * True when `groups` is exactly one group holding at most one unconstrained
 * rule. Zero rules qualifies: that is the empty state a fresh project starts
 * in, and it is what the simple selector's placeholder represents. Pass the
 * result of {@link effectiveRoutingGroups} to judge a document whose Advanced
 * rules are set aside.
 */
export function isSimpleRouting(groups: RoutingRuleGroup[]): boolean {
  if (groups.length !== 1) return false;
  const rules = groups[0].rules;
  if (rules.length === 0) return true;
  if (rules.length > 1) return false;
  return isUnconstrainedRule(rules[0]);
}

/**
 * The catch-all rule simple mode writes. `existingId` is reused when present so
 * swapping providers does not churn the rule id — `RoutingDecision.ruleId`
 * carries it downstream. Deliberately emits the exact shape
 * {@link isSimpleRouting} accepts, so write-then-read is stable.
 */
export function makeSimpleRule(moduleId: string, existingId?: string): RoutingRule {
  return {
    id: existingId ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    priority: 1,
    moduleId,
  };
}

/**
 * The module the simple selector should show as chosen, or null when nothing is
 * chosen yet. Only meaningful when {@link isSimpleRouting} is true.
 */
export function simpleRuleModuleId(groups: RoutingRuleGroup[]): string | null {
  const rule = groups[0]?.rules[0];
  // A pseudo rule never routes a real language, so it counts as nothing chosen
  // (the router falls back to Freeway).
  if (rule?.moduleId === PSEUDO_MODULE_ID) return null;
  return rule?.moduleId ? rule.moduleId : null;
}

/**
 * True when the rule matches every string in every language: no filter. Model,
 * reasoning and prompt overrides change how it translates, not what it takes.
 */
function matchesEverything(rule: RoutingRule): boolean {
  return isUnconstrainedRule({
    ...rule,
    modelOverride: undefined,
    reasoningEffortOverride: undefined,
    promptOptions: undefined,
  });
}

export interface RoutingDoc {
  groups: RoutingRuleGroup[];
  activeGroupId: string;
}

/**
 * Simple mode on a document Simple cannot show: its rules are set aside, not
 * deleted. A Simple group left by an earlier switch is made active again with
 * its own choice; otherwise a new one sends everything to the provider the
 * active group's catch-all rule uses (its last rule with no filter), or to
 * nothing chosen (Freeway) when there is none. A Simple group edited into
 * rules of its own in Advanced is kept as an ordinary group.
 *
 * `setAside` is the group whose rules stop applying, for
 * {@link toAdvancedRouting} to bring back. Returns null when the document is
 * already simple.
 */
export function toSimpleRouting(doc: RoutingDoc): (RoutingDoc & { setAside: string }) | null {
  const view = effectiveRoutingGroups(doc.groups, doc.activeGroupId);
  if (isSimpleRouting(view)) return null;
  const active = doc.groups.find((g) => g.id === doc.activeGroupId) ?? doc.groups[0];
  if (!active) return null;
  const existing = doc.groups.find((g) => g.id === SIMPLE_GROUP_ID);
  if (existing && existing.id !== active.id && isSimpleRouting([existing])) {
    return { groups: doc.groups, activeGroupId: SIMPLE_GROUP_ID, setAside: active.id };
  }
  const catchAll = [...active.rules]
    .sort((a, b) => a.priority - b.priority)
    .reverse()
    .find((r) => r.moduleId && r.moduleId !== PSEUDO_MODULE_ID && matchesEverything(r));
  const simple: RoutingRuleGroup = {
    id: SIMPLE_GROUP_ID,
    name: SIMPLE_GROUP_NAME,
    rules: catchAll ? [makeSimpleRule(catchAll.moduleId)] : [],
  };
  // The Simple group itself was edited into rules: it becomes an ordinary
  // group under a new id, and is the one set aside.
  const renamedId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const kept = doc.groups.map((g) =>
    g.id === SIMPLE_GROUP_ID ? { ...g, id: renamedId, name: `Rule Group ${doc.groups.length}` } : g,
  );
  return {
    groups: [...kept, simple],
    activeGroupId: SIMPLE_GROUP_ID,
    setAside: active.id === SIMPLE_GROUP_ID ? renamedId : active.id,
  };
}

/**
 * Advanced mode on a document whose rules are set aside: the group set aside
 * (`preferred`, when it still exists; else the first one) is active again, and
 * the Simple group stays for the next switch. Returns null when nothing is set
 * aside.
 */
export function toAdvancedRouting(doc: RoutingDoc, preferred?: string | null): RoutingDoc | null {
  const aside = setAsideGroups(doc.groups, doc.activeGroupId);
  const back = aside.find((g) => g.id === preferred) ?? aside[0];
  if (!back) return null;
  return { groups: doc.groups, activeGroupId: back.id };
}

/**
 * The document with everything sent to `moduleId` by one catch-all rule in its
 * active group: the Simple group while Advanced rules are set aside (they stay
 * as they are), else the only group.
 */
export function withSimpleRule(
  doc: RoutingDoc,
  moduleId: string,
): RoutingDoc & { rules: RoutingRule[] } {
  const target = doc.groups.find((g) => g.id === doc.activeGroupId) ?? doc.groups[0];
  const rule = makeSimpleRule(moduleId, target?.rules[0]?.id);
  if (!target) {
    return {
      rules: [rule],
      groups: [{ id: 'default-group', name: 'Default Group', rules: [rule] }],
      activeGroupId: 'default-group',
    };
  }
  return {
    rules: [rule],
    groups: doc.groups.map((g) => (g.id === target.id ? { ...g, rules: [rule] } : g)),
    activeGroupId: target.id,
  };
}
