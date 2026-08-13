/**
 * M7 — Router
 *
 * Pure, synchronous routing of a (StringEntry, targetLanguage) pair through
 * a list of user-configured RoutingRules. The first matching rule (in
 * ascending priority order) wins; otherwise the decision has moduleId=null
 * and the caller (M9) must treat that as a failure.
 */
import type { RoutingDecision, RoutingRule, StringEntry } from '@zercade-dev/narn-shared';
import {
  FREEWAY_MODULE_ID,
  PSEUDO_LANGUAGE_CODE,
  PSEUDO_MODULE_ID,
} from '@zercade-dev/narn-shared';

export interface RouterAvailableModule {
  id: string;
}

export class Router {
  /**
   * Caches the priority-sorted view of a rules array by its identity. M9 calls
   * `route` once per (entry × targetLanguage) pair within a run, always passing
   * the same `project.routingRules` reference, so the sort runs once per run
   * instead of O(entries × languages) times. The cached array is never mutated,
   * keeping `route` pure for the caller.
   */
  private readonly sortedRulesCache = new WeakMap<RoutingRule[], RoutingRule[]>();

  /**
   * Caches the set of available module ids by the `availableModules` array
   * identity, mirroring {@link sortedRulesCache}. M9 passes the same array
   * reference for every (entry × language) route in a run, so the membership
   * test in the rule loop becomes O(1) instead of re-scanning the array per rule.
   */
  private readonly availableIdsCache = new WeakMap<RouterAvailableModule[], Set<string>>();

  private sortedRules(rules: RoutingRule[]): RoutingRule[] {
    const cached = this.sortedRulesCache.get(rules);
    if (cached) return cached;
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    this.sortedRulesCache.set(rules, sorted);
    return sorted;
  }

  private availableIds(availableModules: RouterAvailableModule[]): Set<string> {
    const cached = this.availableIdsCache.get(availableModules);
    if (cached) return cached;
    const set = new Set(availableModules.map((m) => m.id));
    this.availableIdsCache.set(availableModules, set);
    return set;
  }

  route(
    entry: StringEntry,
    targetLanguage: string,
    rules: RoutingRule[],
    availableModules: RouterAvailableModule[],
  ): RoutingDecision {
    // The synthetic pseudo-test language is bound two-way to the pseudo
    // module: it always routes there (no rule needed), and no other language
    // may route there. Real translations can therefore never be overwritten
    // by pseudo text, and pseudo-test jobs are never sent to a costed module.
    const availableIds = this.availableIds(availableModules);
    if (targetLanguage === PSEUDO_LANGUAGE_CODE) {
      const available = availableIds.has(PSEUDO_MODULE_ID);
      return {
        entry,
        targetLanguage,
        moduleId: available ? PSEUDO_MODULE_ID : null,
        ruleId: null,
        promptOptions: undefined,
      };
    }
    const sorted = this.sortedRules(rules);
    for (const rule of sorted) {
      if (rule.moduleId === PSEUDO_MODULE_ID) continue;
      if (!Router.matches(rule, entry, targetLanguage)) continue;
      if (rule.moduleId !== FREEWAY_MODULE_ID && !availableIds.has(rule.moduleId)) continue;
      return {
        entry,
        targetLanguage,
        moduleId: rule.moduleId,
        ruleId: rule.id ?? null,
        promptOptions: rule.promptOptions,
        modelOverride: rule.modelOverride,
        reasoningEffortOverride: rule.reasoningEffortOverride,
      };
    }
    return { entry, targetLanguage, moduleId: null, ruleId: null, promptOptions: undefined };
  }

  private static matches(rule: RoutingRule, entry: StringEntry, targetLanguage: string): boolean {
    // Source-origin constraint: the rule matches when the entry carries ANY of
    // the rule's listed source labels. An omitted/empty list imposes no
    // constraint on this dimension (matches every entry).
    if (rule.sources !== undefined && rule.sources.length > 0) {
      const entrySources = entry.sources ?? [];
      if (!rule.sources.some((source) => entrySources.includes(source))) return false;
    }
    // Category constraint: the rule matches when the entry carries ANY of the
    // rule's listed categories. An omitted/empty list imposes no constraint on
    // this dimension (matches every entry). Mirrors the source-origin constraint.
    if (rule.categories !== undefined && rule.categories.length > 0) {
      const entryCategories = entry.categories ?? [];
      if (!rule.categories.some((category) => entryCategories.includes(category))) return false;
    }
    // Tone constraint: the rule matches when the entry's single tone value is
    // ANY of the rule's listed tones. An omitted/empty list imposes no
    // constraint on this dimension. Mirrors the category constraint, except
    // the entry side is a single value (StringEntry.metadata.tone), not a list.
    if (rule.tones !== undefined && rule.tones.length > 0) {
      if (!entry.metadata?.tone || !rule.tones.includes(entry.metadata.tone)) return false;
    }
    // Achievement-type constraint: matches when the entry's single
    // achievementType is ANY of the rule's listed types. An omitted/empty list
    // imposes no constraint. Mirrors the tone constraint (single-valued entry
    // side).
    if (rule.achievementTypes !== undefined && rule.achievementTypes.length > 0) {
      if (!entry.achievementType || !rule.achievementTypes.includes(entry.achievementType))
        return false;
    }
    if (rule.maxLength !== undefined && entry.sourceText.length > rule.maxLength) return false;
    if (rule.targetLanguages !== undefined && rule.targetLanguages.length > 0) {
      if (!rule.targetLanguages.includes('*') && !rule.targetLanguages.includes(targetLanguage))
        return false;
    } else if (
      rule.targetLanguage !== undefined &&
      rule.targetLanguage !== '*' &&
      rule.targetLanguage !== targetLanguage
    ) {
      return false;
    }
    return true;
  }
}

export const router = new Router();
