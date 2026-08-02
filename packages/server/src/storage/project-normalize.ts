import type {
  Project,
  ProjectModuleConfigEntry,
  RoutingRule,
  RoutingRuleGroup,
} from '@zercade-dev/narn-shared';

function isRoutingRule(value: unknown): value is RoutingRule {
  if (typeof value !== 'object' || value === null) return false;
  const rule = value as Record<string, unknown>;
  return (
    typeof rule['id'] === 'string' &&
    typeof rule['moduleId'] === 'string' &&
    typeof rule['priority'] === 'number'
  );
}

export function normalizeRuleList(rules: unknown): RoutingRule[] {
  if (!Array.isArray(rules)) return [];
  const valid = rules.filter(isRoutingRule);
  return valid
    .map((rule, index) => {
      const next = { ...rule, priority: index + 1 } as RoutingRule & {
        contentType?: unknown;
        contentTypes?: unknown;
      };
      delete next.contentType;
      delete next.contentTypes;
      return next;
    })
    .sort((a, b) => a.priority - b.priority);
}

export function normalizeRoutingGroups(
  groups: unknown,
  fallbackRules: RoutingRule[],
  requestedActiveGroupId: unknown,
): { groups: RoutingRuleGroup[]; activeGroupId: string } {
  const normalized: RoutingRuleGroup[] = Array.isArray(groups)
    ? groups
        .filter((g): g is Record<string, unknown> => typeof g === 'object' && g !== null)
        .map((group, index) => {
          const id =
            typeof group['id'] === 'string' && group['id'].trim().length > 0
              ? group['id']
              : `group-${index + 1}`;
          const name =
            typeof group['name'] === 'string' && group['name'].trim().length > 0
              ? group['name']
              : `Rule Group ${index + 1}`;
          return { id, name, rules: normalizeRuleList(group['rules']) };
        })
    : [];
  const groupsWithFallback =
    normalized.length > 0
      ? normalized
      : [{ id: 'default-group', name: 'Default Group', rules: normalizeRuleList(fallbackRules) }];
  const requested =
    typeof requestedActiveGroupId === 'string' && requestedActiveGroupId.trim().length > 0
      ? requestedActiveGroupId
      : null;
  const activeGroupId =
    requested && groupsWithFallback.some((g) => g.id === requested)
      ? requested
      : groupsWithFallback[0]!.id;
  return { groups: groupsWithFallback, activeGroupId };
}

export function normalizeProjectRouting(project: Project): Project {
  const fallbackRules = normalizeRuleList(project.routingRules);
  const normalized = normalizeRoutingGroups(
    project.routingRuleGroups,
    fallbackRules,
    project.activeRoutingRuleGroupId,
  );
  const activeGroup = normalized.groups.find((g) => g.id === normalized.activeGroupId);
  return {
    ...project,
    routingRuleGroups: normalized.groups,
    activeRoutingRuleGroupId: normalized.activeGroupId,
    routingRules: activeGroup ? normalizeRuleList(activeGroup.rules) : [],
  };
}

/** The full read-path normalization M1.loadProject performed: routing + the
 *  moduleConfigs lazy-migration (null-prototype container, enabled→active). */
export function normalizeLoadedProject(parsed: Project): Project {
  const project = normalizeProjectRouting(parsed);
  // Lazy migration: ensure each moduleConfigs entry conforms to
  // ProjectModuleConfigEntry { active?, inheritGlobal, config }. Legacy
  // shapes that stored `enabled` (on/off toggle) are renamed to `active`;
  // flat config values or missing `inheritGlobal` are also normalized.
  // The file is only rewritten on next save.
  const entries = project.moduleConfigs ?? {};
  // Null-prototype container: a restored/hand-edited config.json is untrusted, and
  // JSON.parse materializes a literal "__proto__" key as a real own property, so
  // `Object.entries` would yield it and `normalized["__proto__"] = …` on a normal
  // object would invoke the inherited prototype setter. With no prototype in the
  // chain that assignment becomes an inert own property instead — neutralizing the
  // prototype-pollution vector at the container.
  const normalized: Record<string, ProjectModuleConfigEntry> = Object.create(null);
  for (const [moduleId, rawEntry] of Object.entries(entries)) {
    const entry = (rawEntry ?? {}) as Partial<ProjectModuleConfigEntry> & {
      enabled?: boolean;
      config?: Record<string, unknown>;
    };
    normalized[moduleId] = {
      active: entry.active ?? entry.enabled,
      inheritGlobal: entry.inheritGlobal ?? true,
      config: entry.config ?? {},
    };
  }
  project.moduleConfigs = normalized;
  return project;
}
