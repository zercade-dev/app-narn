/**
 * Simple routing view (issue app-narn#60) — one selector that sends every
 * string in the project to one provider instance.
 *
 * Purely presentational: `RoutingRulesConfig` remains the sole owner of draft
 * state and auto-save, and renders this instead of `BatchConfigEditor` when the
 * user prefers simple mode AND the project's rules can honestly be represented
 * this way (see lib/routing-mode.ts). The card keeps the
 * `routing-rules-config` testid the advanced editor uses, so anything that just
 * asserts "the routing editor is on screen" is mode-agnostic.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { AutoSaveStatus as AutoSaveStatusValue } from '../../hooks/use-auto-save.js';
import { AutoSaveStatus } from '../config/AutoSaveStatus.js';
import { Button } from '../ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { basesWithInstances } from '@/lib/module-options';
import { isSelectableRoutingModule, type RoutingModuleOption } from './BatchConfigEditor.js';

/**
 * Portion of a `<base>:<slug>` module id after the colon; the whole id if
 * there is none. Mirrors `moduleLabel()` in BatchConfigEditor.tsx so the
 * shared `routing.deletedInstance` i18n key interpolates identically in both
 * the simple and advanced views.
 */
function instanceSlug(moduleId: string): string {
  const sep = moduleId.indexOf(':');
  return sep > 0 ? moduleId.slice(sep + 1) : moduleId;
}

/**
 * Segmented Simple/Advanced control. Rendered in BOTH views' headers so the
 * mode is never unreachable from whichever one is on screen.
 */
export function RoutingModeToggle({
  advanced,
  onChange,
}: Readonly<{ advanced: boolean; onChange: (advanced: boolean) => void }>): React.JSX.Element {
  const { t } = useTranslation('config');
  return (
    <div
      role="group"
      aria-label={t('routing.modeAriaLabel')}
      className="flex items-center gap-1 rounded-lg border p-0.5"
      data-testid="routing-mode-toggle"
    >
      <Button
        size="xs"
        variant={advanced ? 'ghost' : 'default'}
        aria-pressed={!advanced}
        onClick={() => onChange(false)}
        data-testid="routing-mode-simple"
      >
        {t('routing.modeSimple')}
      </Button>
      <Button
        size="xs"
        variant={advanced ? 'default' : 'ghost'}
        aria-pressed={advanced}
        onClick={() => onChange(true)}
        data-testid="routing-mode-advanced"
      >
        {t('routing.modeAdvanced')}
      </Button>
    </div>
  );
}

export interface SimpleRoutingConfigProps {
  /** Same module list the advanced editor receives; filtered here identically. */
  modules: RoutingModuleOption[];
  /** The single rule's module, or null when the project has no rule yet. */
  selectedModuleId: string | null;
  /** Instances that cannot currently run (disabled, or missing credentials). */
  disabledModuleIds?: Set<string>;
  translationsInProgress?: boolean;
  autoSaveStatus: AutoSaveStatusValue;
  autoSaveError: string | null;
  advanced: boolean;
  onToggleAdvanced: (advanced: boolean) => void;
  onSelectModule: (moduleId: string) => void;
}

export function SimpleRoutingConfig({
  modules,
  selectedModuleId,
  disabledModuleIds,
  translationsInProgress,
  autoSaveStatus,
  autoSaveError,
  advanced,
  onToggleAdvanced,
  onSelectModule,
}: Readonly<SimpleRoutingConfigProps>): React.JSX.Element {
  const { t } = useTranslation('config');
  const baseInstanceSet = basesWithInstances(modules);
  const selectable = modules.filter((m) => isSelectableRoutingModule(m, baseInstanceSet));
  // Resolve the selected module's name/deleted-state against the RAW module
  // list, not `selectable`. `selectable` is filtered to what the dropdown may
  // currently offer; a module id that still exists but is no longer *offered*
  // (e.g. a bare instanceable base that has since gained a named instance, so
  // isSelectableRoutingModule now excludes it) must still resolve to its real
  // name here, not read as deleted. Mirrors moduleLabel() in
  // BatchConfigEditor.tsx, which searches the unfiltered `modules` list.
  const selected = modules.find((m) => m.id === selectedModuleId);
  // Only claim an instance was deleted once the module list has actually
  // loaded — an empty list is "not loaded yet", not "everything is gone".
  const deleted = selectedModuleId !== null && !selected && modules.length > 0;
  const disabled = selectedModuleId !== null && (disabledModuleIds?.has(selectedModuleId) ?? false);

  return (
    <Card data-testid="routing-rules-config">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{t('routing.title')}</CardTitle>
          <RoutingModeToggle advanced={advanced} onChange={onToggleAdvanced} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="routing-simple-select">{t('routing.simpleLabel')}</Label>
          <Select
            value={selectedModuleId}
            onValueChange={(v: string | null) => {
              if (v) onSelectModule(v);
            }}
            disabled={translationsInProgress}
          >
            <SelectTrigger
              id="routing-simple-select"
              className="h-9 w-full md:max-w-md"
              data-testid="routing-simple-select"
            >
              <SelectValue placeholder={t('routing.simplePlaceholder')}>
                {(v: string | null) =>
                  v ? (modules.find((m) => m.id === v)?.name ?? v) : t('routing.simplePlaceholder')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {selectable
                // Runnable instances first; the rest sort after and render
                // muted. `.filter` above already returned a fresh array and V8
                // sort is stable, so the original order holds within each group.
                .slice()
                .sort(
                  (a, b) =>
                    (disabledModuleIds?.has(a.id) ? 1 : 0) - (disabledModuleIds?.has(b.id) ? 1 : 0),
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
          <p className="text-xs text-muted-foreground">{t('routing.simpleHint')}</p>
        </div>

        {disabled && (
          <p
            className="flex items-center gap-1 text-xs text-status-warn"
            data-testid="routing-simple-disabled-warning"
          >
            <AlertTriangle className="size-3" />
            {t('routing.moduleDisabledWarning')}
          </p>
        )}

        {deleted && (
          <p
            className="flex items-center gap-1 text-xs text-status-warn"
            data-testid="routing-simple-deleted-warning"
          >
            <AlertTriangle className="size-3" />
            {t('routing.deletedInstance', { slug: instanceSlug(selectedModuleId ?? '') })}
          </p>
        )}

        {translationsInProgress && (
          <p className="text-xs text-status-warn" data-testid="routing-simple-lock">
            {t('routing.groupSwitchLocked')}
          </p>
        )}

        <div className="flex justify-end">
          <AutoSaveStatus status={autoSaveStatus} error={autoSaveError} />
        </div>
      </CardContent>
    </Card>
  );
}
