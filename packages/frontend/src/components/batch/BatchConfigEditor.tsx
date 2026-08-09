import { useState, useRef, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, X, AlertTriangle, Pencil, RotateCcw, ChevronDown } from 'lucide-react';
import type {
  RoutingRule,
  RoutingRuleGroup,
  ReasoningEffort,
  PromptOptions,
  ModelInfo,
} from '@zercade-dev/narn-shared';
import { PSEUDO_MODULE_ID, getSourceLabel } from '@zercade-dev/narn-shared';
import { CopilotModelsContext } from '../../hooks/use-copilot-models.js';
import { useModuleModels } from '../../hooks/use-module-models.js';
import { ModelPicker } from '../config/ModelPicker.js';
import { useConfidenceContext } from '../../hooks/use-confidence-context.js';
import type { AutoSaveStatus as AutoSaveStatusValue } from '../../hooks/use-auto-save.js';
import { AutoSaveStatus } from '../config/AutoSaveStatus.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Checkbox } from '../ui/checkbox.js';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../ui/collapsible.js';
import { ComboboxInput } from '../ui/combobox-input.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs.js';
import { isOfferableModule, basesWithInstances } from '@/lib/module-options';
import { RoutingModeToggle } from './SimpleRoutingConfig.js';

/** Module shape the routing UI needs to decide selectability and render labels. */
export interface RoutingModuleOption {
  id: string;
  name: string;
  /** Set for named instances of a base module. */
  baseModuleId?: string;
  /** Whether named instances may be created for this module (absent ⇒ true). */
  instanceable?: boolean;
}

/**
 * Which modules a routing rule (or template) may target. To keep credentials and
 * config per-instance, rules point at a *named instance* of an instanceable base
 * module — never the bare base. Modules that can't have instances at all (e.g.
 * DeepL, `instanceable: false`) remain selectable as themselves. The pseudo
 * module is excluded: it's bound to the synthetic pseudo-test language and M7
 * ignores any rule pointing at it (see M7-router), so offering it is a no-op.
 */
export function isSelectableRoutingModule(
  m: RoutingModuleOption,
  withInstances?: ReadonlySet<string>,
): boolean {
  if (m.id === PSEUDO_MODULE_ID) return false;
  return isOfferableModule(m, withInstances);
}

/** Patch a single field in PromptOptions, clearing the object when all fields are empty. */
function patchPromptOptions(
  current: PromptOptions | undefined,
  key: keyof PromptOptions,
  value: string,
): PromptOptions | undefined {
  const updated = { ...current, [key]: value || undefined };
  return Object.values(updated).some(Boolean) ? updated : undefined;
}

/**
 * Resolve the display label for a rule's moduleId. Ids of deleted module
 * instances (`<base>:<slug>` not present in the module list) get a greyed
 * tombstone label instead of the dead raw id.
 */
function moduleLabel(
  moduleId: string,
  modules: { id: string; name: string }[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): { label: string; deletedInstance: boolean } {
  const found = modules.find((m) => m.id === moduleId);
  if (found) return { label: found.name, deletedInstance: false };
  const sep = moduleId.indexOf(':');
  // Only flag as deleted once the module list has loaded.
  if (sep > 0 && modules.length > 0) {
    return {
      label: t('routing.deletedInstance', { slug: moduleId.slice(sep + 1) }),
      deletedInstance: true,
    };
  }
  return { label: moduleId, deletedInstance: false };
}

/**
 * Per-rule agent settings block (model override + reasoning effort override).
 * Extracted as a component so hooks can be called unconditionally inside the
 * `draft.map()` loop in `BatchConfigEditor`.
 */
function RuleAgentSettings(
  props: Readonly<{
    rule: RoutingRule;
    onUpdate: (patch: Partial<RoutingRule>) => void;
  }>,
): React.JSX.Element | null {
  const { rule, onUpdate } = props;
  const { t } = useTranslation('config');
  const copilotCtx = useContext(CopilotModelsContext);
  // Always call useModuleModels (Rules of Hooks). Copilot's models come from its
  // own dedicated `/api/modules/copilot/models` route — which `useModuleModels`
  // targets directly — so we can fetch them here too rather than relying solely
  // on a `CopilotModelsContext` provider that may not be populated in this view
  // (e.g. the Batch tab, where no copilot config card has fetched them yet). The
  // placeholder id is used only when there is no module selected yet — gate the
  // fetch off in that case so the `__noop__` id never hits the network.
  const moduleResult = useModuleModels(rule.moduleId || '__noop__', Boolean(rule.moduleId));
  const confidenceContext = useConfidenceContext('translate', rule.reasoningEffortOverride ?? '');

  if (!rule.moduleId) return null;

  // For copilot, prefer the shared context when it already has models (so a
  // refresh in one place reflects everywhere), else fall back to this row's own
  // fetch. Both write the same localStorage cache, so they stay in sync.
  const isCopilot = rule.moduleId === 'copilot';
  const copilotResult = copilotCtx && copilotCtx.models.length > 0 ? copilotCtx : moduleResult;
  const { models, loading, error, refetch } = isCopilot ? copilotResult : moduleResult;

  let overrideModel: ModelInfo | undefined;
  if (rule.modelOverride) {
    overrideModel = models.find((m) => m.id === rule.modelOverride);
  }
  let reasoningEfforts: readonly ReasoningEffort[] = [];
  if (overrideModel?.supportedReasoningEfforts?.length) {
    reasoningEfforts = overrideModel.supportedReasoningEfforts;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <div className="flex items-center gap-1">
          <Label htmlFor={`model-${rule.id}`}>{t('routing.labelModelOverride')}</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0"
            onClick={refetch}
            title={t('routing.refreshModels')}
            aria-label={t('routing.refreshModels')}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
        <ModelPicker
          id={`model-${rule.id}`}
          models={models}
          value={rule.modelOverride ?? '__default__'}
          onValueChange={(v) =>
            onUpdate({ modelOverride: !v || v === '__default__' ? undefined : v })
          }
          disabled={loading}
          specialOption={{ value: '__default__', label: t('routing.modelDefault') }}
          triggerClassName="h-9 w-full"
          triggerTestId={`routing-model-picker-${rule.id}`}
          confidenceContext={confidenceContext}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </div>
      {reasoningEfforts.length > 0 && (
        <div>
          <Label htmlFor={`effort-${rule.id}`}>{t('routing.labelReasoningEffort')}</Label>
          <Select
            value={rule.reasoningEffortOverride ?? '__default__'}
            onValueChange={(v) =>
              onUpdate({
                reasoningEffortOverride: v === '__default__' ? undefined : (v as ReasoningEffort),
              })
            }
          >
            <SelectTrigger id={`effort-${rule.id}`} className="h-9 w-full">
              <SelectValue>
                {(v: string | null) =>
                  !v || v === '__default__'
                    ? t('routing.modelDefault')
                    : v.charAt(0).toUpperCase() + v.slice(1)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">{t('routing.modelDefault')}</SelectItem>
              {reasoningEfforts.map((effort) => (
                <SelectItem key={effort} value={effort}>
                  {effort.charAt(0).toUpperCase() + effort.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/**
 * Two-click delete-confirm control for a routing rule: a single trash button
 * that, once armed (`pendingDeleteId === ruleId`), swaps to a confirm/cancel
 * pair. Shared by the editing-row and collapsed-row branches; the trash button's
 * sizing differs between them, so it's passed in via `removeClassName`/`iconClassName`.
 */
function DeleteRuleControls({
  ruleId,
  index,
  pendingDeleteId,
  onRemove,
  onSetPendingDeleteId,
  t,
  removeClassName,
  iconClassName,
}: Readonly<{
  ruleId: string;
  index: number;
  pendingDeleteId: string | null;
  onRemove: (index: number) => void;
  onSetPendingDeleteId: (id: string | null) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
  removeClassName?: string;
  iconClassName: string;
}>): React.JSX.Element {
  if (pendingDeleteId === ruleId) {
    return (
      <>
        <Button
          size="sm"
          variant="destructive"
          className="h-6 text-xs px-2"
          onClick={() => onRemove(index)}
          data-testid="routing-remove-confirm"
        >
          {t('routing.removeConfirm')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={() => onSetPendingDeleteId(null)}
          data-testid="routing-remove-cancel"
        >
          {t('routing.removeCancel')}
        </Button>
      </>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      className={removeClassName}
      onClick={() => onRemove(index)}
      aria-label="remove"
      data-testid="routing-remove"
    >
      <X className={iconClassName} />
    </Button>
  );
}

type EditorTab = 'rules' | 'templates' | 'advanced';

export interface BatchConfigEditorProps {
  // Group state
  mergedGroups: RoutingRuleGroup[];
  activeGroupId: string;
  activeGroup: RoutingRuleGroup | undefined;
  // Draft state
  draft: RoutingRule[];
  editingIds: Set<string>;
  pendingDeleteId: string | null;
  // Status
  error: string | null;
  autoSaveStatus: AutoSaveStatusValue;
  autoSaveError: string | null;
  onFlush: () => void;
  translationsInProgress?: boolean;
  /** Current routing editor mode; drives the header Simple/Advanced toggle. */
  advanced: boolean;
  onToggleAdvanced: (advanced: boolean) => void;
  /**
   * True when the user prefers simple mode but this project's rules are too
   * rich to represent that way, so the full editor is shown instead. Renders a
   * one-line explanation of why the simple view did not appear.
   */
  simpleFallbackNotice: boolean;
  // Config
  modules: RoutingModuleOption[];
  availableLanguages: string[];
  availableCategories: string[];
  /** Source origin labels present in the project (raw stored values; displayed translated). */
  availableSources: string[];
  availableTones: string[];
  disabledModuleIds?: Set<string>;
  defaultRules: RoutingRule[];
  // Handlers
  onAdd: () => void;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onUpdate: (index: number, patch: Partial<RoutingRule>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onStartEdit: (id: string) => void;
  onDoneEdit: (id: string) => void;
  onSetPendingDeleteId: (id: string | null) => void;
  onSwitchGroup: (groupId: string | null) => void;
  onAddGroup: () => void;
  onRemoveActiveGroup: () => void;
  onRenameActiveGroup: (name: string) => void;
  onAddFromTemplate: (template: RoutingRule) => void;
}

export function BatchConfigEditor({
  mergedGroups,
  activeGroupId,
  activeGroup,
  draft,
  editingIds,
  pendingDeleteId,
  error,
  autoSaveStatus,
  autoSaveError,
  onFlush,
  translationsInProgress,
  advanced,
  onToggleAdvanced,
  simpleFallbackNotice,
  modules,
  availableLanguages,
  availableCategories,
  availableSources,
  availableTones,
  disabledModuleIds,
  defaultRules,
  onAdd,
  onImportChange,
  onExport,
  onUpdate,
  onMove,
  onRemove,
  onStartEdit,
  onDoneEdit,
  onSetPendingDeleteId,
  onSwitchGroup,
  onAddGroup,
  onRemoveActiveGroup,
  onRenameActiveGroup,
  onAddFromTemplate,
}: Readonly<BatchConfigEditorProps>): React.JSX.Element {
  const { t, i18n } = useTranslation('config');
  // Reuses the existing `batch` namespace notice (previously the standalone
  // BatchPanel card below the Routing tab) — see AppShell.tsx, which no
  // longer renders <BatchPanel />.
  const { t: tBatch } = useTranslation('batch');
  const importRef = useRef<HTMLInputElement>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('rules');
  // Base modules that already have named instances are routed via those
  // instances, not the bare base; instanceable bases without instances stay
  // selectable as themselves.
  const baseInstanceSet = basesWithInstances(modules);
  const handleAddFromTemplate = (template: RoutingRule) => {
    onAddFromTemplate(template);
    setEditorTab('rules');
  };

  return (
    <Card data-testid="routing-rules-config">
      <CardHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{t('routing.title')}</CardTitle>
            <RoutingModeToggle advanced={advanced} onChange={onToggleAdvanced} />
          </div>

          {simpleFallbackNotice && (
            <p
              className="text-xs text-muted-foreground"
              data-testid="routing-simple-fallback-notice"
            >
              {t('routing.simpleAdvancedNotice')}
            </p>
          )}

          <div className="grid gap-2 md:grid-cols-[220px_1fr_auto_auto] md:items-end">
            <div>
              <Label htmlFor="routing-group-select">{t('routing.groupSelectLabel')}</Label>
              <Select
                value={activeGroupId}
                onValueChange={onSwitchGroup}
                disabled={translationsInProgress}
              >
                <SelectTrigger id="routing-group-select" data-testid="routing-group-select">
                  <SelectValue>
                    {(v: string | null) => mergedGroups.find((g) => g.id === v)?.name ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {mergedGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="routing-group-name">{t('routing.activeGroupNameLabel')}</Label>
              <Input
                id="routing-group-name"
                value={activeGroup?.name ?? ''}
                onChange={(e) => onRenameActiveGroup(e.target.value)}
                onBlur={() => onFlush()}
                disabled={!activeGroup}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onAddGroup}
              disabled={translationsInProgress}
              data-testid="routing-group-add"
            >
              {t('routing.addGroup')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={onRemoveActiveGroup}
              disabled={mergedGroups.length <= 1 || translationsInProgress}
              data-testid="routing-group-remove"
            >
              {t('routing.removeGroup')}
            </Button>
          </div>
          {translationsInProgress && (
            <p className="text-xs text-status-warn">{t('routing.groupSwitchLocked')}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex min-w-0 items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1">
              <span className="shrink-0">{t('routing.groupStatusLabel')}</span>
              <span
                className="min-w-0 truncate font-medium text-foreground"
                data-testid="routing-active-group-name"
              >
                {activeGroup?.name ?? t('routing.defaultGroupName')}
              </span>
            </span>
            <span aria-hidden="true" className="shrink-0">
              ·
            </span>
            <span className="shrink-0">{t('routing.ruleCount', { count: draft.length })}</span>
          </div>
          <AutoSaveStatus status={autoSaveStatus} error={autoSaveError} />
        </div>

        {error && (
          <p className="text-sm text-destructive" data-testid="routing-error">
            {error}
          </p>
        )}

        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={onImportChange}
        />

        <Tabs
          value={editorTab}
          onValueChange={(v) => {
            if (v !== null) setEditorTab(v as EditorTab);
          }}
        >
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="rules">
              {t('routing.tabRules', { count: draft.length })}
            </TabsTrigger>
            <TabsTrigger value="templates">
              {t('routing.tabTemplates', { count: defaultRules.length })}
            </TabsTrigger>
            <TabsTrigger value="advanced">{t('routing.tabImportExport')}</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-3 pt-3">
            {draft.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('routing.noRules')}</p>
            )}

            <ul className="space-y-2">
              {draft.map((rule, index) => (
                <li key={rule.id} data-testid="routing-rule-row" data-rule-id={rule.id}>
                  {editingIds.has(rule.id) ? (
                    <div className="rounded-lg border ring-1 ring-primary/30 bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {draft.length > 1 && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => onMove(index, -1)}
                                aria-label="up"
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => onMove(index, 1)}
                                aria-label="down"
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">
                            {t('routing.ruleEditing', { priority: rule.priority })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <DeleteRuleControls
                            ruleId={rule.id}
                            index={index}
                            pendingDeleteId={pendingDeleteId}
                            onRemove={onRemove}
                            onSetPendingDeleteId={onSetPendingDeleteId}
                            t={t}
                            iconClassName="size-4"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs px-2"
                            onClick={() => onDoneEdit(rule.id)}
                          >
                            {t('routing.doneEdit')}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_2fr] gap-2 items-start">
                        <div>
                          <Label htmlFor={`mod-${rule.id}`}>{t('routing.labelModule')}</Label>
                          <Select
                            value={rule.moduleId || null}
                            onValueChange={(v) =>
                              // Changing the module invalidates any override picked for the
                              // PREVIOUS module (a model/reasoning-effort id from one provider
                              // is meaningless — or actively wrong — for another), so clear
                              // both alongside the module id itself.
                              onUpdate(index, {
                                moduleId: v ?? '',
                                modelOverride: undefined,
                                reasoningEffortOverride: undefined,
                              })
                            }
                          >
                            <SelectTrigger
                              id={`mod-${rule.id}`}
                              className="h-9 w-full"
                              data-testid={`routing-module-select-${rule.id}`}
                            >
                              <SelectValue placeholder={t('routing.selectPlaceholder')}>
                                {(v: string | null) =>
                                  v
                                    ? moduleLabel(v, modules, t).label
                                    : t('routing.selectPlaceholder')
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {modules
                                .filter((m) => isSelectableRoutingModule(m, baseInstanceSet))
                                // Modules active in this project come first; the
                                // inactive ones (disabled instances, or modules
                                // switched off for the project) sort after and
                                // render muted. `.filter` already returns a fresh
                                // array and V8 sort is stable, so the base-then-
                                // instance order is preserved within each group.
                                .sort(
                                  (a, b) =>
                                    (disabledModuleIds?.has(a.id) ? 1 : 0) -
                                    (disabledModuleIds?.has(b.id) ? 1 : 0),
                                )
                                .map((m) => {
                                  const inactive = disabledModuleIds?.has(m.id) ?? false;
                                  return (
                                    <SelectItem
                                      key={m.id}
                                      value={m.id}
                                      className={inactive ? 'text-muted-foreground' : undefined}
                                    >
                                      {m.name}
                                      {inactive ? t('routing.moduleDisabledSuffix') : ''}
                                    </SelectItem>
                                  );
                                })}
                            </SelectContent>
                          </Select>
                          {rule.moduleId && disabledModuleIds?.has(rule.moduleId) && (
                            <p className="text-xs text-status-warn flex items-center gap-1 mt-1">
                              <AlertTriangle className="size-3" />
                              {t('routing.moduleDisabledWarning')}
                            </p>
                          )}
                          {rule.moduleId &&
                            moduleLabel(rule.moduleId, modules, t).deletedInstance && (
                              <p
                                className="text-xs text-status-warn flex items-center gap-1 mt-1"
                                data-testid={`routing-deleted-instance-warning-${rule.id}`}
                              >
                                <AlertTriangle className="size-3" />
                                {t('routing.deletedInstanceWarning')}
                              </p>
                            )}
                        </div>
                        <div>
                          <Label htmlFor={`rule-name-${rule.id}`}>
                            {t('routing.ruleNameOptional')}
                          </Label>
                          <Input
                            id={`rule-name-${rule.id}`}
                            placeholder={t('routing.ruleNameOptional')}
                            value={rule.name ?? ''}
                            onChange={(e) => onUpdate(index, { name: e.target.value || undefined })}
                            onBlur={() => onFlush()}
                            className="w-full"
                            data-testid="routing-rule-name"
                          />
                        </div>
                      </div>

                      <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex w-full items-center justify-between px-2 text-sm font-medium"
                            >
                              <span>{t('routing.sectionFiltering')}</span>
                              <ChevronDown className="h-4 w-4 transition-transform [[data-open]_&]:rotate-180" />
                            </Button>
                          }
                        />
                        <CollapsibleContent>
                          <div className="mt-2 space-y-3 rounded-md border bg-background/60 p-3">
                            <div>
                              <Label htmlFor={`max-${rule.id}`}>
                                {t('routing.labelMaxLength')}
                              </Label>
                              <Input
                                id={`max-${rule.id}`}
                                type="number"
                                value={rule.maxLength ?? ''}
                                onChange={(e) =>
                                  onUpdate(index, {
                                    maxLength:
                                      e.target.value === '' ? undefined : Number(e.target.value),
                                  })
                                }
                                onBlur={() => onFlush()}
                              />
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t('routing.maxLengthHelp')}
                              </p>
                            </div>

                            <div>
                              <Label>{t('routing.labelSources')}</Label>
                              {availableSources.length === 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t('routing.sourcesHint')}
                                </p>
                              ) : (
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
                                  {availableSources.map((source) => (
                                    <label
                                      key={source}
                                      className="flex items-center gap-2 text-sm cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={rule.sources?.includes(source) ?? false}
                                        onCheckedChange={(checked: boolean) => {
                                          const curr = rule.sources ?? [];
                                          onUpdate(index, {
                                            sources: checked
                                              ? [...curr, source]
                                              : curr.filter((s) => s !== source),
                                          });
                                        }}
                                      />
                                      {getSourceLabel(source, i18n.language)}
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="mb-1.5 text-xs font-medium">
                                {t('routing.achievementTypes')}
                              </p>
                              <div
                                className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5"
                                data-testid="rule-achievement-types"
                              >
                                {(['name', 'description'] as const).map((opt) => (
                                  <label
                                    key={opt}
                                    className="flex items-center gap-2 text-sm cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={rule.achievementTypes?.includes(opt) ?? false}
                                      onCheckedChange={(checked: boolean) => {
                                        const curr = rule.achievementTypes ?? [];
                                        const next = checked
                                          ? [...curr, opt]
                                          : curr.filter((v) => v !== opt);
                                        onUpdate(index, {
                                          achievementTypes: next.length > 0 ? next : undefined,
                                        });
                                      }}
                                    />
                                    {t(
                                      opt === 'name'
                                        ? 'routing.achievementName'
                                        : 'routing.achievementDescription',
                                    )}
                                  </label>
                                ))}
                              </div>
                            </div>

                            <div>
                              <p className="mb-1.5 text-xs font-medium">
                                {t('routing.labelCategories')}
                              </p>
                              {availableCategories.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {t('routing.categoriesConfiguredHint')}
                                </p>
                              ) : (
                                <Popover>
                                  <PopoverTrigger
                                    render={
                                      <Button variant="outline" size="sm" className="h-7 text-xs">
                                        {rule.categories?.length
                                          ? t('routing.nSelected', {
                                              count: rule.categories.length,
                                            })
                                          : t('routing.allCategories')}
                                        <ChevronDown className="ml-1 h-3 w-3" />
                                      </Button>
                                    }
                                  />
                                  <PopoverContent className="w-56 p-2">
                                    <div className="space-y-1">
                                      {availableCategories.map((cat) => (
                                        <label
                                          key={cat}
                                          className="flex items-center gap-2 text-xs cursor-pointer"
                                        >
                                          <Checkbox
                                            checked={rule.categories?.includes(cat) ?? false}
                                            onCheckedChange={(checked) => {
                                              const current = rule.categories ?? [];
                                              onUpdate(index, {
                                                categories: checked
                                                  ? [...current, cat]
                                                  : current.filter((c) => c !== cat),
                                              });
                                            }}
                                          />
                                          {cat}
                                        </label>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {(rule.categories?.length ?? 0) > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {rule.categories?.map((cat) => (
                                    <Badge key={cat} variant="secondary" className="text-xs">
                                      {cat}
                                      <button
                                        className="ml-1"
                                        onClick={() =>
                                          onUpdate(index, {
                                            categories: rule.categories?.filter((c) => c !== cat),
                                          })
                                        }
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="mb-1.5 text-xs font-medium">
                                {t('routing.labelTones')}
                              </p>
                              {availableTones.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  {t('routing.tonesHint')}
                                </p>
                              ) : (
                                <Popover>
                                  <PopoverTrigger
                                    render={
                                      <Button variant="outline" size="sm" className="h-7 text-xs">
                                        {rule.tones?.length
                                          ? t('routing.nSelected', { count: rule.tones.length })
                                          : t('routing.allTones')}
                                        <ChevronDown className="ml-1 h-3 w-3" />
                                      </Button>
                                    }
                                  />
                                  <PopoverContent className="w-56 p-2">
                                    <div className="space-y-1">
                                      {availableTones.map((tone) => (
                                        <label
                                          key={tone}
                                          className="flex items-center gap-2 text-xs cursor-pointer"
                                        >
                                          <Checkbox
                                            checked={rule.tones?.includes(tone) ?? false}
                                            onCheckedChange={(checked) => {
                                              const current = rule.tones ?? [];
                                              onUpdate(index, {
                                                tones: checked
                                                  ? [...current, tone]
                                                  : current.filter((tn) => tn !== tone),
                                              });
                                            }}
                                          />
                                          {tone}
                                        </label>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {(rule.tones?.length ?? 0) > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {rule.tones?.map((tone) => (
                                    <Badge key={tone} variant="secondary" className="text-xs">
                                      {tone}
                                      <button
                                        className="ml-1"
                                        onClick={() =>
                                          onUpdate(index, {
                                            tones: rule.tones?.filter((tn) => tn !== tone),
                                          })
                                        }
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <Label>{t('routing.labelTargetLanguage')}</Label>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5">
                                {availableLanguages.map((lang) => (
                                  <label
                                    key={lang}
                                    className="flex items-center gap-2 text-sm cursor-pointer"
                                  >
                                    <Checkbox
                                      checked={rule.targetLanguages?.includes(lang) ?? false}
                                      onCheckedChange={(checked: boolean) => {
                                        const curr = rule.targetLanguages ?? [];
                                        onUpdate(index, {
                                          targetLanguages: checked
                                            ? [...curr, lang]
                                            : curr.filter((l) => l !== lang),
                                        });
                                      }}
                                    />
                                    {lang}
                                  </label>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                      <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex w-full items-center justify-between px-2 text-sm font-medium"
                            >
                              <span>{t('routing.sectionAgentSettings')}</span>
                              <ChevronDown className="h-4 w-4 transition-transform [[data-open]_&]:rotate-180" />
                            </Button>
                          }
                        />
                        <CollapsibleContent>
                          <div className="mt-2 space-y-3 rounded-md border bg-background/60 p-3">
                            <RuleAgentSettings
                              rule={rule}
                              onUpdate={(patch) => onUpdate(index, patch)}
                            />

                            <div>
                              <p className="mb-2 text-sm font-medium">
                                {t('routing.labelPromptOptions')}
                              </p>
                              <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
                                {t('routing.promptOptionsOptional')}
                              </p>
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <div>
                                  <Label htmlFor={`po-char-${rule.id}`} className="text-xs">
                                    {t('routing.promptCharacter')}
                                  </Label>
                                  <Input
                                    id={`po-char-${rule.id}`}
                                    className="mt-0.5 h-8 text-sm"
                                    value={rule.promptOptions?.character ?? ''}
                                    onChange={(e) =>
                                      onUpdate(index, {
                                        promptOptions: patchPromptOptions(
                                          rule.promptOptions,
                                          'character',
                                          e.target.value,
                                        ),
                                      })
                                    }
                                    onBlur={() => onFlush()}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`po-tone-${rule.id}`} className="text-xs">
                                    {t('routing.defaultToneLabel')}
                                  </Label>
                                  {/* The rule's promptOptions.tone is the DEFAULT tone for
                                      entries this rule routes — the server's
                                      effectivePromptOptions() merges the entry's own
                                      metadata.tone OVER this whenever the entry has one.
                                      A wrapping onBlur (React normalizes focus/blur to
                                      bubble) mirrors the other promptOptions fields'
                                      flush-on-blur, since ComboboxInput doesn't forward
                                      onBlur itself. */}
                                  <div onBlur={() => onFlush()}>
                                    <ComboboxInput
                                      id={`po-tone-${rule.id}`}
                                      className="mt-0.5 h-8 text-sm"
                                      suggestions={availableTones}
                                      value={rule.promptOptions?.tone ?? ''}
                                      onValueChange={(value) =>
                                        onUpdate(index, {
                                          promptOptions: patchPromptOptions(
                                            rule.promptOptions,
                                            'tone',
                                            value,
                                          ),
                                        })
                                      }
                                      data-testid={`routing-default-tone-${rule.id}`}
                                    />
                                  </div>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {t('routing.defaultToneHelp')}
                                  </p>
                                </div>
                                <div>
                                  <Label htmlFor={`po-gender-${rule.id}`} className="text-xs">
                                    {t('routing.promptGender')}
                                  </Label>
                                  <Input
                                    id={`po-gender-${rule.id}`}
                                    className="mt-0.5 h-8 text-sm"
                                    value={rule.promptOptions?.gender ?? ''}
                                    onChange={(e) =>
                                      onUpdate(index, {
                                        promptOptions: patchPromptOptions(
                                          rule.promptOptions,
                                          'gender',
                                          e.target.value,
                                        ),
                                      })
                                    }
                                    onBlur={() => onFlush()}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`po-notes-${rule.id}`} className="text-xs">
                                    {t('routing.promptNotes')}
                                  </Label>
                                  <Input
                                    id={`po-notes-${rule.id}`}
                                    className="mt-0.5 h-8 text-sm"
                                    value={rule.promptOptions?.notes ?? ''}
                                    onChange={(e) =>
                                      onUpdate(index, {
                                        promptOptions: patchPromptOptions(
                                          rule.promptOptions,
                                          'notes',
                                          e.target.value,
                                        ),
                                      })
                                    }
                                    onBlur={() => onFlush()}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 rounded-lg border bg-card text-sm overflow-hidden">
                      <div className="flex flex-col gap-0.5 shrink-0 pl-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => onMove(index, -1)}
                          aria-label="up"
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0"
                          onClick={() => onMove(index, 1)}
                          aria-label="down"
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                      </div>

                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 px-2 py-2 hover:bg-muted/40 text-left"
                        onClick={() => onStartEdit(rule.id)}
                        aria-label={`Edit rule ${rule.priority}`}
                      >
                        {rule.name && (
                          <Badge variant="secondary" className="font-medium max-w-[160px]">
                            <span className="min-w-0 truncate">{rule.name}</span>
                          </Badge>
                        )}
                        <span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 shrink-0">
                          #{rule.priority}
                        </span>

                        <div className="flex items-center gap-3 flex-1 min-w-0 text-muted-foreground">
                          <span className="truncate">
                            {rule.sources?.length ? (
                              rule.sources
                                .map((s) => getSourceLabel(s, i18n.language))
                                .join(' \u00b7 ')
                            ) : (
                              <em>{t('routing.anySource')}</em>
                            )}
                          </span>
                          <span className="shrink-0" aria-hidden="true">
                            →
                          </span>
                          <span className="sr-only">{t('routing.routesTo')}</span>
                          <span className="flex items-center gap-1 flex-wrap min-w-0">
                            {rule.targetLanguages?.length ? (
                              (() => {
                                const MAX_LANG_CHIPS = 6;
                                const langs = rule.targetLanguages;
                                const visible = langs.slice(0, MAX_LANG_CHIPS);
                                const overflow = langs.length - visible.length;
                                return (
                                  <>
                                    {visible.map((lang) => (
                                      <span
                                        key={lang}
                                        className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                                      >
                                        {lang}
                                      </span>
                                    ))}
                                    {overflow > 0 && (
                                      <span
                                        className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium"
                                        title={langs.join(', ')}
                                      >
                                        {t('routing.langsMore', { count: overflow })}
                                      </span>
                                    )}
                                  </>
                                );
                              })()
                            ) : (
                              <em>{t('routing.anyLang')}</em>
                            )}
                          </span>
                          <span className="shrink-0">
                            {rule.maxLength === undefined
                              ? '—'
                              : `≤ ${rule.maxLength.toLocaleString()}`}
                          </span>
                          {rule.categories?.length ? (
                            <span className="shrink-0 text-xs bg-muted rounded px-1.5 py-0.5">
                              {rule.categories.join(' · ')}
                            </span>
                          ) : null}
                          {rule.tones?.length ? (
                            <span className="shrink-0 text-xs bg-muted rounded px-1.5 py-0.5">
                              {rule.tones.join(' · ')}
                            </span>
                          ) : null}
                          {rule.modelOverride && (
                            <span className="shrink-0 font-mono text-xs bg-muted rounded px-1.5 py-0.5">
                              {rule.modelOverride}
                            </span>
                          )}
                          {rule.promptOptions &&
                            Object.values(rule.promptOptions).some(Boolean) && (
                              <span className="shrink-0 text-xs bg-muted rounded px-1.5 py-0.5">
                                {t('routing.promptBadge')}
                              </span>
                            )}
                        </div>

                        {rule.moduleId ? (
                          (() => {
                            const { label, deletedInstance } = moduleLabel(
                              rule.moduleId,
                              modules,
                              t,
                            );
                            const disabled = disabledModuleIds?.has(rule.moduleId);
                            return (
                              <span className="shrink-0 flex items-center gap-1">
                                {(disabled || deletedInstance) && (
                                  <AlertTriangle className="size-3 text-status-warn" />
                                )}
                                <span className="text-muted-foreground font-normal">
                                  {t('routing.via')}
                                </span>
                                <span
                                  className={`font-medium ${
                                    disabled
                                      ? 'text-status-warn'
                                      : deletedInstance
                                        ? 'text-muted-foreground italic'
                                        : ''
                                  }`}
                                >
                                  {label}
                                </span>
                              </span>
                            );
                          })()
                        ) : (
                          <span className="shrink-0 text-destructive font-medium flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            {t('routing.noModule')}
                          </span>
                        )}
                      </button>

                      <div className="flex items-center gap-1 shrink-0 pr-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onStartEdit(rule.id)}
                          aria-label="edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <DeleteRuleControls
                          ruleId={rule.id}
                          index={index}
                          pendingDeleteId={pendingDeleteId}
                          onRemove={onRemove}
                          onSetPendingDeleteId={onSetPendingDeleteId}
                          t={t}
                          removeClassName="h-7 w-7 p-0"
                          iconClassName="size-3.5"
                        />
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-col items-end gap-1 pt-1">
              <div className="flex w-full items-center justify-between gap-3">
                <Button onClick={onAdd} variant="outline" size="sm" data-testid="routing-add">
                  {t('routing.addRule')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="routing-saved-rules-notice">
                {tBatch('savedRulesNotice')}
              </p>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="pt-3">
            <div className="space-y-1">
              {defaultRules.map((dr) => (
                <div
                  key={dr.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
                >
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-xs">
                      {dr.moduleId}
                    </Badge>
                    <span>
                      {t('routing.templateMeta', {
                        maxLength: dr.maxLength?.toLocaleString() ?? '',
                      })}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleAddFromTemplate(dr)}
                  >
                    {t('routing.useTemplate')}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="pt-3 space-y-3">
            <p className="text-sm text-muted-foreground">{t('routing.importExportHint')}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => importRef.current?.click()}
                data-testid="routing-import"
              >
                {t('routing.importBtn')}
              </Button>
              <Button variant="outline" size="sm" onClick={onExport} data-testid="routing-export">
                {t('routing.exportBtn')}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
