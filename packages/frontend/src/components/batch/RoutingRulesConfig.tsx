import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoutingRule, RoutingRuleGroup } from '@zercade-dev/narn-shared';
import { LANGUAGE_REGISTRY } from '@zercade-dev/narn-shared';
import { downloadBlob } from '@/lib/utils';
import { apiRequest } from '../../hooks/use-api.js';
import { useAutoSave } from '../../hooks/use-auto-save.js';
import {
  BatchConfigEditor,
  isSelectableRoutingModule,
  type RoutingModuleOption,
} from './BatchConfigEditor.js';
import { basesWithInstances } from '@/lib/module-options';
import { useStringStore } from '../../stores/string-store.js';

/** The whole-document payload `save()` PUTs — same shape for both the
 * project-scoped and per-user collab-routing endpoints. */
export interface RoutingSavePayload {
  rules: RoutingRule[];
  groups: RoutingRuleGroup[];
  activeGroupId: string;
}

/**
 * Injectable save target: by default the auto-save PUTs to the
 * project-scoped `/projects/:id/routing-rules` route. Passing
 * `routingBackend` overrides ONLY where the save request goes — everything
 * else (the editor UI, auto-save scheduling, group switching) is unchanged.
 * Used to redirect collaborators' saves to the per-user `/collab-routing`
 * endpoint instead.
 */
export interface RoutingBackend {
  save(payload: RoutingSavePayload): Promise<unknown>;
}

export interface RoutingRulesConfigProps {
  projectId: string;
  rules: RoutingRule[];
  routingRuleGroups?: RoutingRuleGroup[];
  activeRoutingRuleGroupId?: string | null;
  modules: RoutingModuleOption[];
  availableLanguages: string[];
  availableCategories: string[];
  translationsInProgress?: boolean;
  disabledModuleIds?: Set<string>;
  /** Overrides the save target; omit for the default project-scoped PUT. */
  routingBackend?: RoutingBackend;
  onSave?: (rules: RoutingRule[]) => void;
}

function newRule(priority: number): RoutingRule {
  return {
    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    priority,
    moduleId: '',
  };
}

function normalizeRules(rules: RoutingRule[]): RoutingRule[] {
  return [...rules]
    .sort((a, b) => a.priority - b.priority)
    .map((rule, index) => ({ ...rule, priority: index + 1 }));
}

function makeDefaultGroup(rules: RoutingRule[]): RoutingRuleGroup {
  return {
    id: 'default-group',
    name: 'Default Group',
    rules: normalizeRules(rules),
  };
}

function normalizeGroups(
  groups: RoutingRuleGroup[] | undefined,
  fallbackRules: RoutingRule[],
): RoutingRuleGroup[] {
  if (!groups || groups.length === 0) return [makeDefaultGroup(fallbackRules)];
  return groups.map((group, index) => ({
    id: group.id || `group-${index + 1}`,
    name: group.name || `Rule Group ${index + 1}`,
    rules: normalizeRules(group.rules ?? []),
  }));
}

function resolveInitialActiveGroupId(
  groups: RoutingRuleGroup[],
  activeRoutingRuleGroupId: string | null | undefined,
): string {
  if (activeRoutingRuleGroupId && groups.some((group) => group.id === activeRoutingRuleGroupId)) {
    return activeRoutingRuleGroupId;
  }
  return groups[0]?.id ?? 'default-group';
}

/**
 * Builds the whole-document save payload from raw (not-yet-committed) state —
 * used by every mutator below so it can `schedule()` the auto-save with the
 * FRESH next value in the same tick, rather than reacting to the (stale,
 * pre-render) `mergedGroups` memo.
 */
function buildPayload(
  groupsArg: RoutingRuleGroup[],
  activeGroupIdArg: string,
  draftArg: RoutingRule[],
): RoutingSavePayload {
  const merged = groupsArg.map((group) =>
    group.id === activeGroupIdArg ? { ...group, rules: normalizeRules(draftArg) } : group,
  );
  const groupsToSave = merged.map((group) => ({ ...group, rules: normalizeRules(group.rules) }));
  const activeRules = groupsToSave.find((group) => group.id === activeGroupIdArg)?.rules ?? [];
  return { rules: activeRules, groups: groupsToSave, activeGroupId: activeGroupIdArg };
}

/** Runtime guard: verify an imported item has the minimum required RoutingRule fields. */
function isValidRoutingRule(item: unknown): item is RoutingRule {
  if (typeof item !== 'object' || item === null) return false;
  const r = item as Record<string, unknown>;
  return (
    typeof r['id'] === 'string' &&
    typeof r['priority'] === 'number' &&
    typeof r['moduleId'] === 'string'
  );
}

export function RoutingRulesConfig({
  projectId,
  rules,
  routingRuleGroups,
  activeRoutingRuleGroupId,
  modules,
  availableLanguages,
  availableCategories,
  translationsInProgress,
  disabledModuleIds,
  routingBackend,
  onSave,
}: Readonly<RoutingRulesConfigProps>): React.JSX.Element {
  const { t } = useTranslation('config');
  // Source origin labels present in the active project's entries (raw stored
  // values). Rules match on these exact labels; the editor displays them
  // translated into the app language.
  const entries = useStringStore((s) => s.entries);
  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) for (const src of entry.sources ?? []) set.add(src);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);
  const availableTones = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.metadata?.tone) set.add(entry.metadata.tone);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);
  // Compute the normalized initial groups + active id exactly once at mount so
  // the three `useState` initializers below share one sort+map rather than each
  // recomputing it. (The post-mount sync path uses `savedGroups` further down.)
  const initialRef = useRef<{ groups: RoutingRuleGroup[]; activeGroupId: string } | null>(null);
  const initial = (initialRef.current ??= (() => {
    const initialGroups = normalizeGroups(routingRuleGroups, rules);
    return {
      groups: initialGroups,
      activeGroupId: resolveInitialActiveGroupId(initialGroups, activeRoutingRuleGroupId),
    };
  })());
  const [groups, setGroups] = useState<RoutingRuleGroup[]>(initial.groups);
  const [activeGroupId, setActiveGroupId] = useState<string>(initial.activeGroupId);
  const [draft, setDraft] = useState<RoutingRule[]>(() =>
    normalizeRules(initial.groups.find((group) => group.id === initial.activeGroupId)?.rules ?? []),
  );
  const [error, setError] = useState<string | null>(null);

  // Per-rule edit mode: contains ids of rules currently open in edit form
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());

  // Id of the rule pending inline delete confirmation (two-click pattern)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Ref used by the scroll-to-new-rule effect
  const pendingScrollId = useRef<string | null>(null);

  // Single source of truth for the last-saved (server-provided) groups. Pure
  // and reused by the sync block and `savedById` below so the full sort+map
  // only runs when the props that feed it actually change.
  const savedGroups = useMemo(
    () => normalizeGroups(routingRuleGroups, rules),
    [routingRuleGroups, rules],
  );
  const savedActiveGroupId = useMemo(
    () => resolveInitialActiveGroupId(savedGroups, activeRoutingRuleGroupId),
    [savedGroups, activeRoutingRuleGroupId],
  );

  const mergedGroups = useMemo(
    () =>
      groups.map((group) =>
        group.id === activeGroupId ? { ...group, rules: normalizeRules(draft) } : group,
      ),
    [groups, activeGroupId, draft],
  );
  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0],
    [groups, activeGroupId],
  );

  // Auto-save: every mutator below computes its own fresh next-state values and
  // calls `schedule()` with the resulting payload directly (rather than a
  // `useEffect` watching `mergedGroups`) — the props-sync block just below
  // resets local state to the server's last-saved shape after OUR OWN save
  // completes (via the parent's `onSave` → `fetchProjects`), and reacting to
  // that echo would re-trigger an identical, redundant save in a loop.
  const {
    status: autoSaveStatus,
    error: autoSaveError,
    schedule,
    flush,
  } = useAutoSave<RoutingSavePayload>({
    save: async (payload) => {
      if (routingBackend) {
        await routingBackend.save(payload);
      } else {
        await apiRequest(`/projects/${projectId}/routing-rules`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      onSave?.(payload.rules);
    },
  });

  // Re-derive local editing state during render when the server-provided props
  // change (the initializers above cover the mount case).
  const [prevSync, setPrevSync] = useState({ routingRuleGroups, activeRoutingRuleGroupId, rules });
  if (
    prevSync.routingRuleGroups !== routingRuleGroups ||
    prevSync.activeRoutingRuleGroupId !== activeRoutingRuleGroupId ||
    prevSync.rules !== rules
  ) {
    setPrevSync({ routingRuleGroups, activeRoutingRuleGroupId, rules });
    setGroups(savedGroups);
    setActiveGroupId(savedActiveGroupId);
    setDraft(
      normalizeRules(savedGroups.find((group) => group.id === savedActiveGroupId)?.rules ?? []),
    );
  }

  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'routing-rules.json');
    } catch {
      setError(t('routing.exportFailed'));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Expected an array of rules');
      if (!parsed.every(isValidRoutingRule))
        throw new Error('One or more rules have missing required fields');
      setDraft(parsed);
      schedule(buildPayload(groups, activeGroupId, parsed));
    } catch {
      setError(t('routing.importFailed'));
    }
  };

  // Map of id → original saved rule for the group CURRENTLY being viewed
  // (`activeGroupId`, local state) — not `savedActiveGroupId` (the server's
  // last-saved active group). Using the server's active group here would bypass
  // the two-click delete confirm for a saved rule of a group the user switched
  // to locally but hasn't saved as active yet: `savedById.has(rule.id)` would
  // look it up against the WRONG group's rule set and miss it, treating an
  // already-saved rule as brand-new (skip-the-confirm) instead.
  const savedById = useMemo(() => {
    const selectedRules = savedGroups.find((group) => group.id === activeGroupId)?.rules ?? [];
    return new Map(selectedRules.map((rule) => [rule.id, rule]));
  }, [savedGroups, activeGroupId]);

  // Templates mirror the selectable routing targets: named instances plus
  // non-instanceable modules (e.g. DeepL) — never bare instanceable bases.
  // Memoized so the Templates tab and any downstream memo see a stable identity
  // (it only depends on `modules`); without this the LANGUAGE_REGISTRY.map runs
  // on every render and churns the array reference each keystroke.
  const defaultRules: RoutingRule[] = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules
      .filter((m) => isSelectableRoutingModule(m, withInstances))
      .map((mod) => ({
        id: `default-${mod.id}`,
        name: `Default — ${mod.name}`,
        priority: 999,
        moduleId: mod.id,
        // No `sources` constraint ⇒ the rule matches every entry's origin.
        maxLength: 10000,
        targetLanguages: LANGUAGE_REGISTRY.map((l) => l.code),
      }));
  }, [modules]);

  function startEdit(id: string): void {
    setEditingIds((prev) => new Set([...prev, id]));
  }

  function doneEdit(id: string): void {
    setEditingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // Scroll newly added rule into view
  useEffect(() => {
    if (!pendingScrollId.current) return;
    const el = document.querySelector(`[data-rule-id="${pendingScrollId.current}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    pendingScrollId.current = null;
  }, [draft.length]);

  function update(index: number, patch: Partial<RoutingRule>): void {
    const nextDraft = draft.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setDraft(nextDraft);
    schedule(buildPayload(groups, activeGroupId, nextDraft));
  }

  function move(index: number, dir: -1 | 1): void {
    const target = index + dir;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    const nextDraft = next.map((r, i) => ({ ...r, priority: i + 1 }));
    setDraft(nextDraft);
    schedule(buildPayload(groups, activeGroupId, nextDraft));
  }

  function remove(index: number): void {
    const rule = draft[index];
    if (savedById.has(rule.id)) {
      if (pendingDeleteId !== rule.id) {
        setPendingDeleteId(rule.id);
        return;
      }
    }
    setPendingDeleteId(null);
    const nextDraft = draft
      .filter((_, i) => i !== index)
      .map((r, i) => ({ ...r, priority: i + 1 }));
    setDraft(nextDraft);
    doneEdit(rule.id);
    schedule(buildPayload(groups, activeGroupId, nextDraft));
  }

  function add(): void {
    const rule = newRule(draft.length + 1);
    pendingScrollId.current = rule.id;
    const nextDraft = [...draft, rule];
    setDraft(nextDraft);
    setEditingIds((prev) => new Set([...prev, rule.id]));
    schedule(buildPayload(groups, activeGroupId, nextDraft));
  }

  function addFromTemplate(template: RoutingRule): void {
    const rule: RoutingRule = {
      ...newRule(draft.length + 1),
      moduleId: template.moduleId,
      maxLength: template.maxLength,
      sources: template.sources,
      targetLanguages: template.targetLanguages,
    };
    pendingScrollId.current = rule.id;
    const nextDraft = [...draft, rule];
    setDraft(nextDraft);
    setEditingIds((prev) => new Set([...prev, rule.id]));
    schedule(buildPayload(groups, activeGroupId, nextDraft));
  }

  function switchGroup(nextGroupId: string | null): void {
    if (!nextGroupId) return;
    if (nextGroupId === activeGroupId) return;
    if (translationsInProgress) {
      setError(t('routing.groupSwitchInProgress'));
      return;
    }
    const nextGroup = mergedGroups.find((group) => group.id === nextGroupId);
    if (!nextGroup) return;
    setError(null);
    setGroups(mergedGroups);
    setActiveGroupId(nextGroupId);
    const nextDraft = normalizeRules(nextGroup.rules);
    setDraft(nextDraft);
    setEditingIds(new Set());
    setPendingDeleteId(null);
    schedule(buildPayload(mergedGroups, nextGroupId, nextDraft));
  }

  function addGroup(): void {
    if (translationsInProgress) {
      setError(t('routing.groupSwitchInProgress'));
      return;
    }
    const next = mergedGroups;
    const id = `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newGroup: RoutingRuleGroup = {
      id,
      name: `Rule Group ${next.length + 1}`,
      rules: [],
    };
    const nextGroups = [...next, newGroup];
    setGroups(nextGroups);
    setActiveGroupId(id);
    setDraft([]);
    setEditingIds(new Set());
    setPendingDeleteId(null);
    setError(null);
    schedule(buildPayload(nextGroups, id, []));
  }

  function removeActiveGroup(): void {
    if ((activeGroup?.id ?? null) === null || mergedGroups.length <= 1) return;
    if (translationsInProgress) {
      setError(t('routing.groupSwitchInProgress'));
      return;
    }
    const remaining = mergedGroups.filter((group) => group.id !== activeGroupId);
    const nextActiveGroup = remaining[0];
    if (!nextActiveGroup) return;
    setGroups(remaining);
    setActiveGroupId(nextActiveGroup.id);
    const nextDraft = normalizeRules(nextActiveGroup.rules);
    setDraft(nextDraft);
    setEditingIds(new Set());
    setPendingDeleteId(null);
    setError(null);
    schedule(buildPayload(remaining, nextActiveGroup.id, nextDraft));
  }

  function renameActiveGroup(name: string): void {
    if (!activeGroup) return;
    const nextGroups = mergedGroups.map((group) =>
      group.id === activeGroup.id ? { ...group, name: name || t('routing.untitledGroup') } : group,
    );
    setGroups(nextGroups);
    schedule(buildPayload(nextGroups, activeGroupId, draft));
  }

  return (
    <BatchConfigEditor
      mergedGroups={mergedGroups}
      activeGroupId={activeGroupId}
      activeGroup={activeGroup}
      draft={draft}
      editingIds={editingIds}
      pendingDeleteId={pendingDeleteId}
      error={error}
      autoSaveStatus={autoSaveStatus}
      autoSaveError={autoSaveError}
      onFlush={flush}
      translationsInProgress={translationsInProgress}
      modules={modules}
      availableLanguages={availableLanguages}
      availableCategories={availableCategories}
      availableSources={availableSources}
      availableTones={availableTones}
      disabledModuleIds={disabledModuleIds}
      defaultRules={defaultRules}
      onAdd={add}
      onImportChange={handleImport}
      onExport={handleExport}
      onUpdate={update}
      onMove={move}
      onRemove={remove}
      onStartEdit={startEdit}
      onDoneEdit={doneEdit}
      onSetPendingDeleteId={setPendingDeleteId}
      onSwitchGroup={switchGroup}
      onAddGroup={addGroup}
      onRemoveActiveGroup={removeActiveGroup}
      onRenameActiveGroup={renameActiveGroup}
      onAddFromTemplate={addFromTemplate}
    />
  );
}
