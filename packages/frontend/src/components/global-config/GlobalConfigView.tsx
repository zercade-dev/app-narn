/**
 * GlobalConfigView — workspace-wide module configuration. Renders
 * `ModuleSettingsPanel` in `global` mode against the `/global-config` endpoint.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, LockOpen } from 'lucide-react';
import type { BatchGroupingDimension, ProjectTemplate } from '@zercade-dev/narn-shared';
import { ModuleSettingsPanel } from '../config/ModuleSettingsPanel.js';
import { FreewayPanel } from '../config/FreewayPanel.js';
import { AddInstanceForm, instanceSlugsOf } from '../config/AddInstanceForm.js';
import { promptFirstMissingCredential } from '../config/credential-prompt.js';
import { useVaultStatus } from '../../hooks/useVaultStatus.js';
import { apiRequest, apiDownload } from '../../hooks/use-api.js';
import { useAutoSave } from '../../hooks/use-auto-save.js';
import { useTemplateStore } from '../../stores/template-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { resolveDefaultReasoningEffort } from '../../lib/default-reasoning-effort.js';
import { toast } from '@/lib/toast';
import { isOfferableModule, basesWithInstances } from '@/lib/module-options';
import { AutoSaveStatus } from '../config/AutoSaveStatus.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ModuleOption {
  id: string;
  name: string;
  requiredEnvVars: string[];
  /** Whether named instances may be created for this module (absent ⇒ true). */
  instanceable?: boolean;
  /** Set for named module instances: the id of the base module they copy. */
  baseModuleId?: string;
}

/**
 * A snapshot of every workspace-settings control, atomic input to
 * `useAutoSave`'s `save` — each control's onChange composes this from the
 * current state plus its own new value before scheduling, so a debounced save
 * always persists a consistent whole rather than a single field.
 */
interface WorkspaceSettingsDraft {
  maxBackups: string;
  overflowRatio: string;
  requestsPerSecond: string;
  requestTimeoutSec: string;
  maxOutputTokens: string;
  batchGrouping: BatchGroupingDimension;
  ignoreBatchSizeLimit: boolean;
}

/**
 * Sentinel value prefix for the enable-module picker items that open the
 * "add another instance" form instead of enabling a module. Module ids are
 * slug-like, so the `__`-prefixed value can never collide with a real id.
 */
const ADD_INSTANCE_VALUE_PREFIX = '__add-instance__:';

interface GlobalConfigViewProps {
  onUnlockVault: () => void;
  onManageVault: () => void;
  onEditVaultKey: (key: string) => void;
}

export function GlobalConfigView({
  onUnlockVault,
  onManageVault,
  onEditVaultKey,
}: GlobalConfigViewProps) {
  const { t } = useTranslation('config');
  const { t: tVault } = useTranslation('vault');
  const batchGroupingLabel = (value: BatchGroupingDimension): string => {
    switch (value) {
      case 'category':
        return t('batchGroupingCategory');
      case 'glossary':
        return t('batchGroupingGlossary');
      case 'both':
        return t('batchGroupingBoth');
      case 'tone':
        return t('batchGroupingTone');
      default:
        return t('batchGroupingNone');
    }
  };
  const { unlocked, hasVault, keys, name: vaultName } = useVaultStatus();
  // Cloud locks backup retention to an env var, so the input is hidden there
  // (the server also drops the field from the PUT body). Self-hosted keeps it.
  const cloudManaged = useVaultStore((s) => s.cloudManaged);
  const [maxBackups, setMaxBackups] = useState<string>('');
  const [overflowRatio, setOverflowRatio] = useState<string>('');
  const [requestsPerSecond, setRequestsPerSecond] = useState<string>('');
  const [requestTimeoutSec, setRequestTimeoutSec] = useState<string>('');
  const [maxOutputTokens, setMaxOutputTokens] = useState<string>('0');
  const [batchGrouping, setBatchGrouping] = useState<BatchGroupingDimension>('none');
  const [ignoreBatchSizeLimit, setIgnoreBatchSizeLimit] = useState(false);
  const [availableModules, setAvailableModules] = useState<ModuleOption[]>([]);
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  const [enablingModule, setEnablingModule] = useState(false);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  /** Base module the inline "add another instance" form is open for. */
  const [addInstanceBase, setAddInstanceBase] = useState<ModuleOption | null>(null);
  const templates = useTemplateStore((s) => s.templates);
  const fetchTemplates = useTemplateStore((s) => s.fetchTemplates);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const importTemplate = useTemplateStore((s) => s.importTemplate);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const handleExportTemplate = async (templateId: string) => {
    try {
      await apiDownload(
        `/templates/${encodeURIComponent(templateId)}/export`,
        `${templateId}.json`,
      );
    } catch (err) {
      toast.error(t('templateExportFailed', { message: (err as Error).message }));
    }
  };

  const handleDeleteTemplate = async (template: ProjectTemplate) => {
    try {
      await deleteTemplate(template.id);
      toast.success(t('templateDeleted', { name: template.name }));
    } catch (err) {
      toast.error(t('templateDeleteFailed', { message: (err as Error).message }));
    }
  };

  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as unknown;
      const template = await importTemplate(data);
      toast.success(t('templateImported', { name: template.name }));
    } catch (err) {
      toast.error(t('templateImportFailed', { message: (err as Error).message }));
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const {
    status: settingsStatus,
    error: settingsSaveError,
    schedule: scheduleSettingsSave,
    flush: flushSettingsSave,
  } = useAutoSave<WorkspaceSettingsDraft>({
    save: async (s) => {
      const payload: Record<string, unknown> = {
        batchGrouping: s.batchGrouping,
        ignoreBatchSizeLimit: s.ignoreBatchSizeLimit,
      };
      if (s.maxBackups.trim()) payload.maxBackupsPerProject = parseInt(s.maxBackups, 10);
      // The four numeric overrides below: empty input clears the override (null) so
      // the system default applies, rather than silently keeping the old value.
      payload.overflowRatio = s.overflowRatio.trim() ? parseFloat(s.overflowRatio) : null;
      payload.requestsPerSecond = s.requestsPerSecond.trim()
        ? parseFloat(s.requestsPerSecond)
        : null;
      payload.requestTimeoutMs = s.requestTimeoutSec.trim()
        ? Math.round(parseFloat(s.requestTimeoutSec) * 1000)
        : null;
      payload.maxOutputTokens = s.maxOutputTokens.trim() ? parseInt(s.maxOutputTokens, 10) : null;
      await apiRequest('/global-config/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
  });

  // Composes the full settings snapshot (current state + this change) and
  // schedules it — every control feeds the same debounced save so a burst of
  // edits across several fields persists as one consistent PUT.
  const scheduleSettings = (overrides: Partial<WorkspaceSettingsDraft>) => {
    scheduleSettingsSave({
      maxBackups,
      overflowRatio,
      requestsPerSecond,
      requestTimeoutSec,
      maxOutputTokens,
      batchGrouping,
      ignoreBatchSizeLimit,
      ...overrides,
    });
  };

  // Module list + global config are both re-fetched whenever the panel reports
  // module-list changes (instance CRUD), so they load together in one pass.
  // `allSettled` keeps the two fetches independent: a failure in one must not
  // blank the other's state (e.g. a transient /global-config error should still
  // leave the module list populated).
  useEffect(() => {
    void Promise.allSettled([
      apiRequest<{ modules: ModuleOption[] } | ModuleOption[]>('/modules'),
      apiRequest<{
        moduleConfigs?: Record<
          string,
          { enabled?: boolean; active?: boolean; config?: Record<string, unknown> }
        >;
      }>('/global-config'),
    ]).then(([modulesResult, cfgResult]) => {
      if (modulesResult.status === 'fulfilled') {
        const res = modulesResult.value;
        setAvailableModules(Array.isArray(res) ? res : res.modules);
      }
      if (cfgResult.status === 'fulfilled') {
        const ids = new Set(
          Object.entries(cfgResult.value.moduleConfigs ?? {})
            .filter(([, v]) => v.enabled === true)
            .map(([k]) => k),
        );
        setEnabledIds(ids);
      }
    });
  }, [panelRefreshKey]);

  useEffect(() => {
    void apiRequest<{
      maxBackupsPerProject?: number;
      overflowRatio?: number;
      requestsPerSecond?: number;
      requestTimeoutMs?: number;
      maxOutputTokens?: number;
      batchGrouping?: BatchGroupingDimension;
      ignoreBatchSizeLimit?: boolean;
    }>('/global-config/settings')
      .then((s) => {
        if (s.maxBackupsPerProject !== undefined) {
          setMaxBackups(String(s.maxBackupsPerProject));
        }
        if (s.overflowRatio !== undefined) {
          setOverflowRatio(String(s.overflowRatio));
        }
        if (s.requestsPerSecond !== undefined) {
          setRequestsPerSecond(String(s.requestsPerSecond));
        }
        if (s.requestTimeoutMs !== undefined) {
          setRequestTimeoutSec(String(Math.round(s.requestTimeoutMs / 1000)));
        }
        if (s.maxOutputTokens !== undefined) {
          setMaxOutputTokens(String(s.maxOutputTokens));
        }
        if (s.batchGrouping !== undefined) {
          setBatchGrouping(s.batchGrouping);
        }
        if (s.ignoreBatchSizeLimit !== undefined) {
          setIgnoreBatchSizeLimit(s.ignoreBatchSizeLimit);
        }
      })
      .catch(() => undefined);
  }, []);

  // Base modules that already have named instances are managed through those
  // instances, so they are not offered as standalone enable options below.
  const baseInstanceSet = basesWithInstances(availableModules);

  return (
    <div className="space-y-4" data-testid="global-config-view">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{t('globalConfigTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('globalConfigDescription')}</p>
      </header>

      <section
        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
          unlocked
            ? 'border-status-pass/30 bg-status-pass/5'
            : 'border-status-warn/30 bg-status-warn/5'
        }`}
        data-testid="vault-status-card"
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
              unlocked ? 'bg-status-pass/10 text-status-pass' : 'bg-status-warn/10 text-status-warn'
            }`}
            aria-hidden="true"
          >
            {unlocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
          </span>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span data-testid="vault-status-name">
                {hasVault && vaultName ? vaultName : tVault('statusLabel')}
              </span>
              {unlocked ? (
                <Badge variant="secondary" data-testid="vault-status-badge-unlocked">
                  {tVault('statusUnlocked')}
                </Badge>
              ) : (
                <Badge variant="outline" data-testid="vault-status-badge-locked">
                  {hasVault ? tVault('statusLocked') : tVault('statusNotCreated')}
                </Badge>
              )}
            </div>
            {unlocked && keys.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {tVault('keysCount', { count: keys.length })}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={unlocked ? 'outline' : 'default'}
          onClick={unlocked ? onManageVault : onUnlockVault}
          data-testid="vault-unlock-button"
        >
          {unlocked ? tVault('manage') : hasVault ? tVault('unlock') : tVault('create')}
        </Button>
      </section>

      <section
        className="rounded-md border bg-card px-3 py-2 space-y-2"
        data-testid="enable-module-selector"
      >
        <Label className="text-sm font-medium">{t('enableModuleSelectLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('enableModuleHelp')}</p>
        <Select
          value=""
          onValueChange={async (moduleId) => {
            if (!moduleId) return;
            if (moduleId.startsWith(ADD_INSTANCE_VALUE_PREFIX)) {
              const baseId = moduleId.slice(ADD_INSTANCE_VALUE_PREFIX.length);
              const base = availableModules.find((m) => m.id === baseId);
              if (base) setAddInstanceBase(base);
              return;
            }
            setEnablingModule(true);
            try {
              const cfg = await apiRequest<{
                moduleConfigs?: Record<string, { config?: Record<string, unknown> }>;
              }>('/global-config');
              const existingConfig = cfg.moduleConfigs?.[moduleId]?.config ?? {};
              // First enable: default reasoningEffort to 'disabled' when the
              // resolved model (any model already set on a leftover config, else
              // the cheapest one that will get auto-selected) supports an
              // explicit disabled state and no reasoningEffort is set yet.
              // Leaves an already-set reasoningEffort (a leftover from a prior
              // enable) untouched.
              const config = { ...existingConfig };
              if (config.reasoningEffort === undefined) {
                const preferredModel = typeof config.model === 'string' ? config.model : undefined;
                const reasoningEffort = await resolveDefaultReasoningEffort(
                  moduleId,
                  preferredModel,
                );
                if (reasoningEffort) config.reasoningEffort = reasoningEffort;
              }
              await apiRequest(`/global-config/${moduleId}`, {
                method: 'PUT',
                body: JSON.stringify({ enabled: true, config }),
              });
              setPanelRefreshKey((k) => k + 1);
              const mod = availableModules.find((m) => m.id === moduleId);
              promptFirstMissingCredential(mod?.requiredEnvVars ?? [], keys, {
                unlocked,
                onEditVaultKey,
              });
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setEnablingModule(false);
            }
          }}
          disabled={enablingModule}
        >
          <SelectTrigger className="w-full max-w-md" data-testid="enable-module-trigger">
            <SelectValue placeholder={t('enableModulePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {availableModules
              // Named instances and non-instanceable modules (e.g. deepl) are
              // directly enable-able here. An instanceable base is managed through
              // instances, so it is offered solely via the "Add instance" items
              // below: isOfferableModule already excludes a base that *has*
              // instances, and the extra guard excludes a bare instanceable base
              // with *no* instances yet (which would otherwise show up twice —
              // once bare here and once as "Add instance" below).
              .filter(
                (m) =>
                  !enabledIds.has(m.id) &&
                  isOfferableModule(m, baseInstanceSet) &&
                  !(m.instanceable !== false && !m.baseModuleId && !baseInstanceSet.has(m.id)),
              )
              .map((m) => (
                <SelectItem key={m.id} value={m.id} data-testid={`enable-module-option-${m.id}`}>
                  {m.name}
                </SelectItem>
              ))}
            {/* Always offered (even when the base module is already enabled and
                filtered out above) so adding more instances stays discoverable. */}
            {availableModules
              .filter((m) => m.instanceable !== false && !m.baseModuleId)
              .map((m) => (
                <SelectItem
                  key={`${ADD_INSTANCE_VALUE_PREFIX}${m.id}`}
                  value={`${ADD_INSTANCE_VALUE_PREFIX}${m.id}`}
                  data-testid={`enable-module-add-instance-${m.id}`}
                >
                  {t('enableModuleAddInstance', { name: m.name })}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {addInstanceBase && (
          <AddInstanceForm
            // Key by base id so switching the form to a different base remounts
            // it, resetting the (blank) mount-time slug field — without the key it
            // would keep the previous base's typed value.
            key={addInstanceBase.id}
            baseModule={addInstanceBase}
            reservedSlugs={availableModules.filter((m) => !m.baseModuleId).map((m) => m.id)}
            takenSlugs={instanceSlugsOf(availableModules, addInstanceBase.id)}
            unlocked={unlocked}
            existingKeys={keys}
            onEditVaultKey={onEditVaultKey}
            onCreated={() => {
              setAddInstanceBase(null);
              setPanelRefreshKey((k) => k + 1);
            }}
            onCancel={() => setAddInstanceBase(null)}
          />
        )}
      </section>

      <ModuleSettingsPanel
        mode="global"
        refreshTrigger={panelRefreshKey}
        onModulesChanged={() => setPanelRefreshKey((k) => k + 1)}
        onModuleDisabled={(moduleId) =>
          setEnabledIds((prev) => {
            const next = new Set(prev);
            next.delete(moduleId);
            return next;
          })
        }
        onUnlockVault={onUnlockVault}
        onEditVaultKey={onEditVaultKey}
      />

      <FreewayPanel onEditVaultKey={onEditVaultKey} />

      <Card>
        <CardHeader>
          <CardTitle>{t('workspaceSettingsTitle')}</CardTitle>
          <CardDescription>{t('workspaceSettingsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Cloud: retention is env-only — hide the input entirely. Auto-save
              still persists the other workspace settings below. */}
          {!cloudManaged && (
            <div className="space-y-1.5">
              <Label htmlFor="max-backups-input">{t('maxBackupsLabel')}</Label>
              <p className="text-xs text-muted-foreground">{t('maxBackupsDescription')}</p>
              <Input
                id="max-backups-input"
                type="number"
                min={1}
                className="w-24"
                placeholder="20"
                value={maxBackups}
                onChange={(e) => {
                  setMaxBackups(e.target.value);
                  scheduleSettings({ maxBackups: e.target.value });
                }}
                onBlur={() => void flushSettingsSave()}
                data-testid="max-backups-input"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="overflow-ratio-input">{t('overflowRatioLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('overflowRatioDescription')}</p>
            <Input
              id="overflow-ratio-input"
              type="number"
              min={0.1}
              step={0.05}
              className="w-24"
              placeholder="1.75"
              value={overflowRatio}
              onChange={(e) => {
                setOverflowRatio(e.target.value);
                scheduleSettings({ overflowRatio: e.target.value });
              }}
              onBlur={() => void flushSettingsSave()}
              data-testid="overflow-ratio-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requests-per-second-input">{t('requestsPerSecondLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('requestsPerSecondDescription')}</p>
            <Input
              id="requests-per-second-input"
              type="number"
              min={0}
              step={0.5}
              className="w-24"
              placeholder="0"
              value={requestsPerSecond}
              onChange={(e) => {
                setRequestsPerSecond(e.target.value);
                scheduleSettings({ requestsPerSecond: e.target.value });
              }}
              onBlur={() => void flushSettingsSave()}
              data-testid="requests-per-second-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="max-output-tokens-input">{t('maxOutputTokensLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('maxOutputTokensDescription')}</p>
            <Input
              id="max-output-tokens-input"
              type="number"
              min={0}
              step={256}
              className="w-24"
              placeholder="0"
              value={maxOutputTokens}
              onChange={(e) => {
                setMaxOutputTokens(e.target.value);
                scheduleSettings({ maxOutputTokens: e.target.value });
              }}
              onBlur={() => void flushSettingsSave()}
              data-testid="max-output-tokens-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="request-timeout-input">{t('requestTimeoutLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('requestTimeoutDescription')}</p>
            <Input
              id="request-timeout-input"
              type="number"
              min={1}
              step={10}
              className="w-24"
              placeholder="300"
              value={requestTimeoutSec}
              onChange={(e) => {
                setRequestTimeoutSec(e.target.value);
                scheduleSettings({ requestTimeoutSec: e.target.value });
              }}
              onBlur={() => void flushSettingsSave()}
              data-testid="request-timeout-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="batch-grouping-trigger">{t('batchGroupingLabel')}</Label>
            <p className="text-xs text-muted-foreground">{t('batchGroupingDescription')}</p>
            <Select
              value={batchGrouping}
              onValueChange={(v) => {
                const next = v as BatchGroupingDimension;
                setBatchGrouping(next);
                scheduleSettings({ batchGrouping: next });
              }}
            >
              <SelectTrigger
                className="w-64"
                id="batch-grouping-trigger"
                data-testid="batch-grouping-trigger"
              >
                <SelectValue>
                  {(value) => batchGroupingLabel(value as BatchGroupingDimension)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('batchGroupingNone')}</SelectItem>
                <SelectItem value="category">{t('batchGroupingCategory')}</SelectItem>
                <SelectItem value="glossary">{t('batchGroupingGlossary')}</SelectItem>
                <SelectItem value="both">{t('batchGroupingBoth')}</SelectItem>
                <SelectItem value="tone">{t('batchGroupingTone')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="ignore-batch-size-limit"
              className="mt-0.5"
              checked={ignoreBatchSizeLimit}
              onCheckedChange={(c) => {
                const next = c === true;
                setIgnoreBatchSizeLimit(next);
                scheduleSettings({ ignoreBatchSizeLimit: next });
              }}
              data-testid="ignore-batch-size-limit"
            />
            <div className="space-y-1">
              <Label htmlFor="ignore-batch-size-limit">{t('ignoreBatchSizeLimitLabel')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('ignoreBatchSizeLimitDescription')}
              </p>
            </div>
          </div>
          <AutoSaveStatus status={settingsStatus} error={settingsSaveError} />
        </CardContent>
      </Card>

      <Card data-testid="project-templates-card">
        <CardHeader>
          <CardTitle>{t('templatesTitle')}</CardTitle>
          <CardDescription>{t('templatesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="templates-empty">
              {t('templatesEmpty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  data-testid={`template-row-${template.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('templateMeta', {
                        languages: template.config.activeLanguages.length,
                        rules: template.config.routingRules.length,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleExportTemplate(template.id)}
                      data-testid={`template-export-${template.id}`}
                    >
                      {t('templateExport')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeleteTemplate(template)}
                      data-testid={`template-delete-${template.id}`}
                    >
                      {t('templateDelete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportTemplate}
            data-testid="template-import-input"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            data-testid="template-import-button"
          >
            {t('templateImport')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
