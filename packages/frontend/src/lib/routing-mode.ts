/**
 * Simple-vs-advanced routing mode (issue app-narn#60).
 *
 * The Routing tab defaults to a single "translate everything with X" selector.
 * That view can only faithfully represent a routing document that really does
 * send everything to one place, so this module defines — strictly — which
 * documents qualify. Anything richer renders the full editor no matter what the
 * user's mode preference says, which is what keeps a preference set once and
 * forgotten from ever hiding a configuration someone built by hand.
 */
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

/**
 * True when `groups` is exactly one group holding at most one unconstrained
 * rule. Zero rules qualifies: that is the empty state a fresh project starts
 * in, and it is what the simple selector's placeholder represents.
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
  return rule?.moduleId ? rule.moduleId : null;
}
