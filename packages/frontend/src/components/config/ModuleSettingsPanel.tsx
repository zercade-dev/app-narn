import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ModuleCapability,
  CostTier,
  ModelInfo,
  ModelConfidenceContext,
} from '@zercade-dev/narn-shared';
import { isDefaultInstanceId } from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { relativeTime } from '@/lib/utils';
import { ComboboxInput } from '@/components/ui/combobox-input';
import { ModuleModelSelector } from './ModuleModelSelector.js';
import { ModelPicker } from './ModelPicker.js';
import { useConfidenceContext } from '../../hooks/use-confidence-context.js';
import {
  CopilotModelsContext,
  type UseCopilotModelsResult,
} from '../../hooks/use-copilot-models.js';
import { useModuleModels } from '../../hooks/use-module-models.js';
import { useModuleHealth } from '../../hooks/use-module-health.js';
import { ModuleHealthStrip } from './ModuleHealthStrip.js';
import { AddInstanceForm, instanceSlugsOf } from './AddInstanceForm.js';
import { ReasoningEffortSelect } from './ReasoningEffortSelect.js';
import { ModuleReasoningEffortSelect } from './ModuleReasoningEffortSelect.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, Info, Plus, Trash2, PowerOff, AlertTriangle } from 'lucide-react';

interface ModuleMetadata {
  id: string;
  name: string;
  version: string;
  capabilities: ModuleCapability[];
  costTier: CostTier;
  configSchema: Record<string, unknown>;
  requiredEnvVars: string[];
  credentialsAvailable: boolean;
  /** Tri-state credential availability: locked vault vs genuinely missing keys. */
  credentialStatus?: 'ok' | 'vault-locked' | 'missing';
  /** The keys actually missing (populated when credentialStatus === 'missing'). */
  missingKeys?: string[];
  /** Set for named module instances: the id of the base module they copy. */
  baseModuleId?: string;
  /** Whether named instances may be created for this module (absent ⇒ true). */
  instanceable?: boolean;
}

interface ConfigSchemaField {
  type?: string;
  format?: string;
  enum?: string[];
  suggestions?: Array<string | { label: string; value: string }>;
  default?: unknown;
  description?: string;
  /** When true, the field is only shown in project-level settings, not global. */
  projectOnly?: boolean;
}

type ConfigValue = string | boolean;
type CopilotBatchMode = 'language' | 'entry';

export type ModuleSettingsMode = 'project' | 'global';

interface ProjectModuleEntry {
  active?: boolean;
  inheritGlobal?: boolean;
  config?: Record<string, unknown>;
}

interface GlobalModuleEntry {
  enabled?: boolean;
  active?: boolean;
  config?: Record<string, unknown>;
}

export interface ModuleSettingsPanelProps {
  /** When `mode === 'project'`, configs are scoped to the project and may inherit from global. */
  mode?: ModuleSettingsMode;
  /** Required when `mode === 'project'`. */
  projectId?: string;
  /** Increment to force the panel to re-fetch all module configs. */
  refreshTrigger?: number;
  /** Called after the module list itself changed (instance created/deleted/renamed). */
  onModulesChanged?: () => void;
  /** Called when a module's global `enabled` gate is toggled off (global mode). */
  onModuleDisabled?: (moduleId: string) => void;
  /** Opens the vault unlock flow (shown when a module's credentials are vault-locked). */
  onUnlockVault?: () => void;
  /** Opens the vault editor focused on the given key (used to prompt for a new instance's credentials). */
  onEditVaultKey?: (key: string) => void;
}

function isFieldSchema(value: unknown): value is ConfigSchemaField {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function isPasswordField(schema: ConfigSchemaField): boolean {
  return schema.format === 'password';
}

/**
 * Acronyms that must stay upper-cased (and never be letter-spaced) when a
 * camelCase field key is humanized into a label. Order doesn't matter; matching
 * is whole-word, case-insensitive, against the split words.
 */
const LABEL_ACRONYMS = new Set([
  'url',
  'http',
  'https',
  'api',
  'id',
  'ai',
  'json',
  'csv',
  'html',
  'uri',
  'tm',
  'lqa',
]);

/**
 * Humanizes a camelCase config field key into a sentence-case label.
 * Splits on camelCase boundaries without shattering acronyms (so `baseURL` →
 * "Base URL", not "Base U R L"), keeps known acronyms upper-cased, and lowercases
 * the remaining words to match the surrounding sentence-case copy
 * (`allowInsecureHttp` → "Allow insecure HTTP").
 */
function fieldKeyToLabel(key: string): string {
  // Split camelCase/PascalCase into words while keeping acronym runs intact:
  // a lowercase→uppercase boundary, or an acronym-run followed by a capitalized word.
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter(Boolean);
  return words
    .map((word, index) => {
      if (LABEL_ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      const lower = word.toLowerCase();
      // First word is sentence-cased; the rest stay lowercase.
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

function defaultValue(schema: ConfigSchemaField): ConfigValue {
  if (schema.type === 'boolean') {
    return typeof schema.default === 'boolean' ? schema.default : false;
  }
  if (typeof schema.default === 'string') return schema.default;
  // Numeric defaults are stored as strings like every other config value, so the
  // input pre-populates (e.g. generic-ai maxParallel "1") and the module coerces.
  if (typeof schema.default === 'number') return String(schema.default);
  return '';
}

function normalizeCopilotBatchMode(value: unknown): CopilotBatchMode {
  return value === 'language' ? 'language' : 'entry';
}

/**
 * Stable fallback used when no `CopilotModelsContext` provider is present, so the
 * panel doesn't allocate a fresh object (and `refetch` closure) on every render.
 */
const EMPTY_COPILOT_MODELS: UseCopilotModelsResult = {
  models: [],
  loading: false,
  error: null,
  errorDetail: null,
  cachedAt: null,
  refetch: () => {},
};

/**
 * Stable signature of a module's editable state, used to detect unsaved
 * changes by comparing against the snapshot taken on load / last save.
 * `inherit` is `undefined` in global mode (and dropped by JSON.stringify).
 */
function moduleSignature(
  config: Record<string, ConfigValue> | undefined,
  active: boolean,
  inherit: boolean | undefined,
): string {
  return JSON.stringify({ config: config ?? {}, active, inherit });
}

/**
 * Renders `ModuleModelSelector` for modules that support live models, even when
 * the current list is empty. Falls back to a manifest-suggestion `ModelPicker`
 * only when the module explicitly reports that it does not support `listModels`.
 * Must be a component (not inline JSX) so `useModuleModels` can be called unconditionally.
 */
function ModuleModelSelectorWithFallback({
  moduleId,
  id,
  value,
  onValueChange,
  disabled,
  suggestions,
  local,
  enabled = true,
  confidenceContext,
}: Readonly<{
  moduleId: string;
  id: string;
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  suggestions: Array<string | { label: string; value: string }>;
  /** Whether this module is a free, local LLM (drives the picker's local layout). */
  local?: boolean;
  /** Forwarded to `useModuleModels`: when `false`, no `/models` request is made. */
  enabled?: boolean;
  /** Forwarded to the model picker: enables the Confidence column for this run context. */
  confidenceContext?: ModelConfidenceContext;
}>) {
  const { t } = useTranslation('config');
  const { error } = useModuleModels(moduleId, enabled);
  if (!error || !/does not support listmodels/i.test(error)) {
    return (
      <ModuleModelSelector
        moduleId={moduleId}
        id={id}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        local={local}
        enabled={enabled}
        confidenceContext={confidenceContext}
      />
    );
  }
  // No live model discovery: surface the manifest's curated suggestions as
  // (price-less) picker rows so search + free-text entry still work uniformly.
  const fallbackModels: ModelInfo[] = suggestions.map((s) =>
    typeof s === 'string' ? { id: s } : { id: s.value, name: s.label },
  );
  return (
    <ModelPicker
      id={id}
      models={fallbackModels}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      placeholder={t('models.enterName')}
      triggerTestId="module-model-picker-trigger"
      local={local}
      confidenceContext={confidenceContext}
    />
  );
}

/** Display-name editor shown on instance cards (global mode). */
function InstanceNameEditor({
  instance,
  onRenamed,
}: Readonly<{
  instance: ModuleMetadata;
  onRenamed: () => void;
}>): React.JSX.Element {
  const { t } = useTranslation('config');
  const [name, setName] = useState(instance.name);

  const { run: handleRename, busy: saving } = useAsyncAction(
    async () => {
      await apiRequest(`/global-config/instances/${encodeURIComponent(instance.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: name.trim() }),
      });
      onRenamed();
    },
    {
      errorFallback: '',
      onError: (err) => {
        toast.error(t('instances.renameFailed', { message: (err as Error).message }));
        return true;
      },
    },
  );

  return (
    <div className="flex items-end gap-2">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`instance-rename-${instance.id}`}>{t('instances.nameLabel')}</Label>
        <Input
          id={`instance-rename-${instance.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full min-w-0 max-w-64"
          data-testid={`instance-rename-input-${instance.id}`}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={saving || !name.trim() || name.trim() === instance.name}
        onClick={() => void handleRename()}
        data-testid={`instance-rename-save-${instance.id}`}
      >
        {t('instances.nameSave')}
      </Button>
    </div>
  );
}

export function ModuleSettingsPanel({
  mode = 'project',
  projectId,
  refreshTrigger,
  onModulesChanged,
  onModuleDisabled,
  onUnlockVault,
  onEditVaultKey,
}: Readonly<ModuleSettingsPanelProps>): React.JSX.Element {
  const { t } = useTranslation('config');
  const { t: tCommon } = useTranslation('common');
  const vaultUnlocked = useVaultStore((s) => s.unlocked);
  const vaultKeys = useVaultStore((s) => s.keys);
  // Derived primitive so a credential save (which updates the vault `keys`
  // array) re-fires the data-load effect and clears stale "credential missing"
  // warnings. Using the joined string keeps the dependency stable across
  // renders (the array reference itself changes identity each render).
  const vaultKeysSignature = vaultKeys.join(',');
  // Confidence run context for the translate hot path. Called unconditionally
  // (Rules of Hooks); its use is gated to project mode — in global mode there is
  // no current project, so no honest entry-count/prompt-size totals to score.
  const translateConfidenceContext = useConfidenceContext('translate');
  const confidenceContext = mode === 'project' ? translateConfidenceContext : undefined;
  const [modules, setModules] = useState<ModuleMetadata[]>([]);
  const [values, setValues] = useState<Record<string, Record<string, ConfigValue>>>({});
  const [inheritFlags, setInheritFlags] = useState<Record<string, boolean>>({});
  const [activeFlags, setActiveFlags] = useState<Record<string, boolean>>({});
  const [globalEnabledFlags, setGlobalEnabledFlags] = useState<Record<string, boolean>>({});
  const [globalValues, setGlobalValues] = useState<Record<string, Record<string, ConfigValue>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // Per-module signature of the last persisted state, used to highlight the
  // Save button while a module has unsaved edits.
  const [savedSignatures, setSavedSignatures] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  // Latest-value refs mirroring the edit state above, read (not depended on) by
  // the data-load effect below so a reload triggered by an unrelated dep
  // (vault unlock, credential save, instance CRUD) can detect and preserve
  // modules the user has unsaved edits on instead of clobbering them. Synced
  // in a post-commit effect (not during render) so the ref is current by the
  // time the data-load effect's async `.then()` callback reads it.
  const valuesRef = useRef(values);
  const inheritFlagsRef = useRef(inheritFlags);
  const activeFlagsRef = useRef(activeFlags);
  const savedSignaturesRef = useRef(savedSignatures);
  useEffect(() => {
    valuesRef.current = values;
    inheritFlagsRef.current = inheritFlags;
    activeFlagsRef.current = activeFlags;
    savedSignaturesRef.current = savedSignatures;
  });
  // Tracks the last (mode, projectId) the data-load effect actually loaded, so
  // a genuine scope change (e.g. switching projects) still does a full reset
  // even though the values above are only refs (not effect deps).
  const loadScopeKeyRef = useRef<string | null>(null);
  // Module-instance UI state (global mode only).
  const [instanceFormFor, setInstanceFormFor] = useState<string | null>(null);
  const [pendingInstanceDelete, setPendingInstanceDelete] = useState<string | null>(null);
  const [localRefresh, setLocalRefresh] = useState(0);
  const [serverCacheStatus, setServerCacheStatus] = useState<{
    fresh: boolean;
    ageMs: number | null;
    updatedAt: string | null;
  } | null>(null);
  const copilotModelsResult: UseCopilotModelsResult =
    useContext(CopilotModelsContext) ?? EMPTY_COPILOT_MODELS;
  const {
    models: copilotModels,
    loading: copilotModelsLoading,
    cachedAt: copilotModelsCachedAt,
  } = copilotModelsResult;
  const { byModule: healthByModule } = useModuleHealth(refreshTrigger);

  // The copilot cache-status footer (and the request that backs it) only renders
  // when copilot is present in the resolved module list and globally enabled, so
  // gate the fetch on that to avoid a wasted request in views without copilot.
  const copilotEnabled = modules.some((m) => m.id === 'copilot' && globalEnabledFlags['copilot']);

  // Re-fetch server cache status on mount and whenever models are refreshed so the
  // "Server cache: fresh/stale" indicator reflects the current server-side state
  // (including the updated billing and reasoning metadata).
  useEffect(() => {
    if (!copilotEnabled) return;
    apiRequest<{ fresh: boolean; ageMs: number | null; updatedAt: string | null; ttlMs: number }>(
      '/modules/copilot/models/cache-status',
    )
      .then((data) =>
        setServerCacheStatus({ fresh: data.fresh, ageMs: data.ageMs, updatedAt: data.updatedAt }),
      )
      .catch(() => {
        // Non-critical — ignore failures silently.
      });
  }, [copilotEnabled, copilotModelsCachedAt]);

  useEffect(() => {
    let cancelled = false;
    const scopeKey = `${mode}:${projectId ?? ''}`;
    // A genuine scope change (switching projects, or project<->global) must
    // still do a full reset — the dirty-preservation pass below is only for
    // reloads within the SAME scope (vault unlock, credential save, instance
    // CRUD), where carrying over another scope's edits would be wrong.
    const isScopeChange = loadScopeKeyRef.current !== scopeKey;

    const fetchScope = async () => {
      if (mode === 'project') {
        if (!projectId) return null;
        return apiRequest<{ moduleConfigs?: Record<string, ProjectModuleEntry> }>(
          `/projects/${projectId}`,
        );
      }
      return apiRequest<{ moduleConfigs?: Record<string, GlobalModuleEntry> }>('/global-config');
    };

    Promise.all([
      apiRequest<{ modules: ModuleMetadata[] } | ModuleMetadata[]>('/modules'),
      fetchScope(),
      mode === 'project'
        ? apiRequest<{ moduleConfigs?: Record<string, GlobalModuleEntry> }>('/global-config')
        : Promise.resolve(null),
    ])
      .then(([modulesRes, scope, globalScope]) => {
        if (cancelled) return;
        const list = Array.isArray(modulesRes) ? modulesRes : modulesRes.modules;
        setModules(list);
        const savedConfigs = scope?.moduleConfigs ?? {};
        const initial: Record<string, Record<string, ConfigValue>> = {};
        const globals: Record<string, Record<string, ConfigValue>> = {};
        const inherits: Record<string, boolean> = {};
        const actives: Record<string, boolean> = {};
        const globalEnableds: Record<string, boolean> = {};
        const globalConfigs = globalScope?.moduleConfigs ?? {};
        for (const m of list) {
          const fields: Record<string, ConfigValue> = {};
          const gFields: Record<string, ConfigValue> = {};
          for (const [key, schema] of Object.entries(m.configSchema)) {
            if (!isFieldSchema(schema)) continue;
            fields[key] = defaultValue(schema);
            gFields[key] = defaultValue(schema);
          }
          const saved = (savedConfigs as Record<string, ProjectModuleEntry | undefined>)[m.id];
          for (const [key, val] of Object.entries(saved?.config ?? {})) {
            if (typeof val === 'boolean' || typeof val === 'string') {
              fields[key] = val;
            }
          }
          const gsaved = (globalConfigs as Record<string, GlobalModuleEntry | undefined>)[m.id];
          for (const [key, val] of Object.entries(gsaved?.config ?? {})) {
            if (typeof val === 'boolean' || typeof val === 'string') {
              gFields[key] = val;
            }
          }
          initial[m.id] = fields;
          globals[m.id] = gFields;
          inherits[m.id] = saved?.inheritGlobal !== false;
          actives[m.id] = saved?.active !== false;
          // globalEnabledFlags: in global mode `savedConfigs` IS the GlobalModuleEntry;
          // in project mode use `gsaved` (the separately fetched global entry).
          const globalEntry =
            mode === 'global'
              ? (savedConfigs as Record<string, GlobalModuleEntry | undefined>)[m.id]
              : gsaved;
          globalEnableds[m.id] = globalEntry?.enabled === true;
        }
        const signatures: Record<string, string> = {};
        for (const m of list) {
          signatures[m.id] = moduleSignature(
            initial[m.id],
            actives[m.id] ?? true,
            mode === 'project' ? (inherits[m.id] ?? true) : undefined,
          );
        }

        // Preserve unsaved edits on reload. This effect re-fires on vault
        // unlock, credential save, and instance CRUD (see the dependency list
        // below), none of which should discard edits the user hasn't saved
        // yet. A module counts as "dirty" if its live edit state (as of just
        // before this reload) no longer matches the signature recorded at its
        // last successful save/load — modules with no prior baseline (first
        // load) are never dirty, and a genuine scope change always resets.
        if (!isScopeChange) {
          const prevValues = valuesRef.current;
          const prevInherits = inheritFlagsRef.current;
          const prevActives = activeFlagsRef.current;
          const prevSignatures = savedSignaturesRef.current;
          for (const m of list) {
            const prevSignature = prevSignatures[m.id];
            if (prevSignature === undefined) continue;
            const liveSignature = moduleSignature(
              prevValues[m.id],
              prevActives[m.id] ?? true,
              mode === 'project' ? (prevInherits[m.id] ?? true) : undefined,
            );
            if (liveSignature === prevSignature) continue;
            initial[m.id] = prevValues[m.id] ?? initial[m.id];
            inherits[m.id] = prevInherits[m.id] ?? inherits[m.id];
            actives[m.id] = prevActives[m.id] ?? actives[m.id];
            signatures[m.id] = prevSignature;
          }
        }
        loadScopeKeyRef.current = scopeKey;

        setValues(initial);
        setGlobalValues(globals);
        setInheritFlags(inherits);
        setActiveFlags(actives);
        setGlobalEnabledFlags(globalEnableds);
        setSavedSignatures(signatures);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, projectId, vaultUnlocked, vaultKeysSignature, refreshTrigger, localRefresh]);

  /** Re-fetch after the module list itself changed (instance CRUD). */
  const requestModulesRefresh = () => {
    if (onModulesChanged) {
      // Parent bumps `refreshTrigger`, which re-fires the load effect.
      onModulesChanged();
    } else {
      setLocalRefresh((k) => k + 1);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await apiRequest(`/global-config/instances/${encodeURIComponent(instanceId)}`, {
        method: 'DELETE',
      });
      toast.success(t('instances.deleted'));
      setPendingInstanceDelete(null);
      requestModulesRefresh();
    } catch (err) {
      toast.error(t('instances.deleteFailed', { message: (err as Error).message }));
    }
  };

  if (mode === 'project' && (!projectId || projectId === '')) {
    return (
      <div data-testid="module-settings-panel" className="p-4 text-muted-foreground">
        {t('module.selectProjectFirst')}
      </div>
    );
  }

  const handleChange = (moduleId: string, key: string, value: ConfigValue) => {
    setValues((prev) => ({
      ...prev,
      [moduleId]: { ...(prev[moduleId] ?? {}), [key]: value },
    }));
  };

  const handleToggleInherit = (moduleId: string, inherit: boolean) => {
    setInheritFlags((prev) => ({ ...prev, [moduleId]: inherit }));
  };

  const handleToggleActive = (moduleId: string, active: boolean) => {
    setActiveFlags((prev) => ({ ...prev, [moduleId]: active }));
  };

  const handleDisableModule = async (moduleId: string) => {
    try {
      const mod = modules.find((m) => m.id === moduleId);
      const currentConfig: Record<string, unknown> = Object.fromEntries(
        Object.entries(values[moduleId] ?? {}).filter(([k]) => {
          const schema = mod?.configSchema[k];
          return !isFieldSchema(schema) || !isPasswordField(schema);
        }),
      );
      await apiRequest(`/global-config/${moduleId}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: false, config: currentConfig }),
      });
      setGlobalEnabledFlags((prev) => ({ ...prev, [moduleId]: false }));
      // Let the parent (GlobalConfigView) drop this id from its enabled set so
      // the module reappears in the enable-module selector.
      onModuleDisabled?.(moduleId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSave = async (moduleId: string) => {
    setSavingId(moduleId);
    setError(null);
    // Snapshot the field values as of the moment the save starts. Fields
    // aren't disabled while the request is in flight, so the user may keep
    // editing; comparing the post-save live value against this snapshot
    // (below) is how a concurrent edit is detected and preserved rather than
    // clobbered by the save response.
    const snapshotAtSaveStart = values[moduleId] ?? {};
    try {
      const moduleValues = {
        ...snapshotAtSaveStart,
        ...(moduleId === 'copilot'
          ? { batchMode: normalizeCopilotBatchMode(snapshotAtSaveStart['batchMode']) }
          : {}),
      };

      if (mode === 'project') {
        const isInheriting = inheritFlags[moduleId] ?? true;
        const projectMod = modules.find((m) => m.id === moduleId);
        // Vault-managed credentials never belong in project config — the server
        // rejects any password-format key (assertNoPasswordFields). Strip them so
        // a seeded empty value (e.g. deepl `apiKey: ''`) can't 400 the save.
        const sanitizedValues = Object.fromEntries(
          Object.entries(moduleValues).filter(([k]) => {
            const schema = projectMod?.configSchema[k];
            return !isFieldSchema(schema) || !isPasswordField(schema);
          }),
        );
        const body: ProjectModuleEntry = {
          // Always send the real values, even while inheriting. Per M19
          // `resolveEffectiveModuleConfig`, an inheriting module resolves to
          // the global config MERGED with the project's non-empty values
          // (project wins; empty-string/undefined fall through to global) —
          // so these stored values are the project's intended per-project
          // overrides and must be preserved, not blanked. Sending `{}` here
          // would erase them, silently dropping those overrides now and
          // losing everything the moment the user toggles back to
          // not-inheriting. Sending sanitizedValues preserves them.
          config: sanitizedValues,
          inheritGlobal: isInheriting,
          active: activeFlags[moduleId] ?? true,
        };
        await apiRequest(`/projects/${projectId}/module-config/${moduleId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        const globalMod = modules.find((m) => m.id === moduleId);
        const filteredModuleValues = Object.fromEntries(
          Object.entries(moduleValues).filter(([k]) => {
            const schema = globalMod?.configSchema[k];
            return !isFieldSchema(schema) || !isPasswordField(schema);
          }),
        );
        const body: GlobalModuleEntry = {
          config: filteredModuleValues,
          active: activeFlags[moduleId] ?? true,
        };
        await apiRequest(`/global-config/${moduleId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      // Persisted successfully. Reflect the normalized values back into state so
      // the in-memory `values` match what the server now holds (e.g. copilot's
      // `batchMode` normalized to 'entry'); otherwise the next data-load would
      // round-trip the normalized value back in and re-light the Save button as
      // "unsaved" even though nothing was edited.
      //
      // Fields aren't disabled during the in-flight request, so the user may
      // have typed a further edit while this save was pending — a field whose
      // live value has already diverged from `snapshotAtSaveStart` was
      // changed after the snapshot was taken, so the save response doesn't
      // describe it; keep the newer live value instead of clobbering it with
      // the (stale, pre-edit) persisted value.
      setValues((prev) => {
        const current = prev[moduleId] ?? {};
        const merged: Record<string, ConfigValue> = { ...current };
        for (const [key, val] of Object.entries(moduleValues)) {
          if (current[key] === snapshotAtSaveStart[key]) {
            merged[key] = val;
          }
        }
        return { ...prev, [moduleId]: merged };
      });
      // Refresh the baseline (from the same normalized object) so the Save button
      // returns to its resting colour until the next edit.
      setSavedSignatures((prev) => ({
        ...prev,
        [moduleId]: moduleSignature(
          moduleValues,
          activeFlags[moduleId] ?? true,
          mode === 'project' ? (inheritFlags[moduleId] ?? true) : undefined,
        ),
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingId(null);
    }
  };

  // In project mode the module cards are grouped into an "Enabled" section
  // followed by a de-emphasized "Disabled" section. The groups are flattened
  // into a single list (heading markers + modules) so one `.map` renders both
  // sections; the grouping derives from the same `activeFlags` state the
  // Active checkbox toggles, so toggling moves the card between sections.
  type SectionHeading = {
    headingKey: 'modulesEnabledSection' | 'modulesDisabledSection';
    count: number;
  };
  const isModuleActive = (m: ModuleMetadata) => activeFlags[m.id] ?? true;
  // Instanceable base modules that already have at least one named instance are
  // hidden as standalone cards: their config now lives on the named instances
  // (the base stays a behind-the-scenes template/fallback). Non-instanceable
  // modules (e.g. deepl) and bases with no instances yet still render normally.
  const basesWithInstances = new Set(
    modules.flatMap((m) => (m.baseModuleId ? [m.baseModuleId] : [])),
  );
  const isHiddenBaseCard = (m: ModuleMetadata) =>
    !m.baseModuleId && m.instanceable !== false && basesWithInstances.has(m.id);
  const displayModules = modules.filter((m) => !isHiddenBaseCard(m));
  // Only globally-enabled modules render in either mode (in project mode the enabled
  // gate also hides inheriting-from-disabled cards). Applying it here keeps the
  // filter in one place rather than re-checking per card in the render loop.
  const enabledModules = displayModules.filter((m) => globalEnabledFlags[m.id]);
  let listItems: Array<ModuleMetadata | SectionHeading> = enabledModules;
  if (mode === 'project') {
    const section = (
      headingKey: SectionHeading['headingKey'],
      mods: ModuleMetadata[],
    ): Array<ModuleMetadata | SectionHeading> =>
      mods.length > 0 ? [{ headingKey, count: mods.length }, ...mods] : [];
    listItems = [
      ...section('modulesEnabledSection', enabledModules.filter(isModuleActive)),
      ...section(
        'modulesDisabledSection',
        enabledModules.filter((m) => !isModuleActive(m)),
      ),
    ];
  }

  return (
    <div
      data-testid="module-settings-panel"
      className={
        mode === 'global'
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 min-[3840px]:grid-cols-5 gap-4 items-start'
          : 'space-y-4'
      }
    >
      {error && (
        <div
          className={`text-sm text-destructive${mode === 'global' ? ' col-span-full' : ''}`}
          role="alert"
        >
          {error}
        </div>
      )}
      {listItems.map((item) => {
        if ('headingKey' in item) {
          return (
            <h3
              key={item.headingKey}
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              data-testid={
                item.headingKey === 'modulesEnabledSection'
                  ? 'modules-enabled-heading'
                  : 'modules-disabled-heading'
              }
            >
              {t(item.headingKey, { count: item.count })}
            </h3>
          );
        }
        const mod = item;
        // `listItems` is already filtered to globally-enabled modules above.
        const inheriting = mode === 'project' && (inheritFlags[mod.id] ?? true);
        // When inheriting, show the global value (falling back to the local one
        // if global is unset); otherwise show the project/local value.
        const resolveFieldValue = (key: string): ConfigValue | undefined =>
          inheriting && globalValues[mod.id]?.[key] !== undefined
            ? globalValues[mod.id]?.[key]
            : values[mod.id]?.[key];
        const isActive = isModuleActive(mod);
        const savedSignature = savedSignatures[mod.id];
        const hasUnsavedChanges =
          savedSignature !== undefined &&
          moduleSignature(
            values[mod.id],
            activeFlags[mod.id] ?? true,
            mode === 'project' ? (inheritFlags[mod.id] ?? true) : undefined,
          ) !== savedSignature;
        const isInstance = Boolean(mod.baseModuleId);
        const baseName = isInstance
          ? (modules.find((m) => m.id === mod.baseModuleId)?.name ?? mod.baseModuleId)
          : undefined;
        // Instances are always created FROM a base module, so an instance card's
        // "add another instance" form targets that base, not the instance itself.
        const instanceFormBase = isInstance
          ? (modules.find((m) => m.id === mod.baseModuleId) ?? mod)
          : mod;
        // Only fetch this module's live model list when it is globally enabled.
        // Cards are already filtered to globally-enabled modules, but keeping the
        // gate explicit means a not-enabled module never issues a `/models`
        // request (the 401/423 console-spam fix). The vault-locked case is NOT
        // gated here: an enabled module's card legitimately attempts the fetch,
        // and `useModuleModels` already treats the resulting 401/423 as an empty,
        // error-free state — gating on the vault would needlessly blank the model
        // dropdowns (and break model selection) while the vault is still locked.
        const modelsFetchEnabled = globalEnabledFlags[mod.id] ?? false;
        // Collapsed-summary health dot: shown only when this module has recorded
        // runs (total > 0). Unknown health renders nothing in the summary — the
        // full "no data yet" strip lives inside the expanded panel (see below).
        const healthStats = healthByModule[mod.id];
        const healthKnown = Boolean(healthStats && healthStats.total > 0);
        const healthRatePct =
          healthStats && healthStats.successRate != null
            ? Math.round(healthStats.successRate * 100)
            : null;
        const healthDotClass =
          healthRatePct == null
            ? 'bg-muted-foreground'
            : healthRatePct >= 90
              ? 'bg-status-pass'
              : healthRatePct >= 50
                ? 'bg-status-warn'
                : 'bg-destructive';
        // Compact credential status for the collapsed summary chip (global only).
        const credentialsMissing = mode === 'global' && !mod.credentialsAvailable;
        return (
          <Collapsible key={mod.id} defaultOpen={false}>
            <Card
              data-testid={`module-card-${mod.id}`}
              className={mode === 'project' && !isActive ? 'opacity-60' : undefined}
            >
              <CardHeader>
                <div className="flex min-w-0 items-start gap-2">
                  <CollapsibleTrigger
                    className="group flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
                    data-testid={`module-card-toggle-${mod.id}`}
                  >
                    <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                    {/* Container-driven layout: stacked (name / instance tag /
                        status chips, one per line) in narrow contexts like the
                        global-config grid columns; collapsed onto a single row
                        once the card's own width (the `card-header` container,
                        see Card.tsx) reaches ~640px — the full-width project
                        Config-tab list. Responds to the card's actual width
                        rather than the panel `mode`, so it also does the right
                        thing if a wide card ever appears in a narrow column
                        (or vice versa). */}
                    <div className="flex min-w-0 flex-col gap-1 @[640px]/card-header:flex-row @[640px]/card-header:flex-wrap @[640px]/card-header:items-center @[640px]/card-header:gap-x-3 @[640px]/card-header:gap-y-1">
                      <CardTitle className="min-w-0 truncate leading-tight">
                        {mod.name}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          v{mod.version}
                        </span>
                      </CardTitle>
                      {isInstance && (
                        <Badge
                          variant="outline"
                          className="max-w-full justify-start text-[10px] font-normal"
                          data-testid={`instance-badge-${mod.id}`}
                        >
                          <span className="min-w-0 truncate">
                            {t('instances.instanceOf', { base: baseName })}
                          </span>
                        </Badge>
                      )}
                      {/* Compact status summary — visible whether the card is
                          collapsed or expanded, so a dozen collapsed cards read
                          at a glance instead of a wall of full panels. */}
                      <div
                        className="flex flex-wrap items-center gap-1.5"
                        data-testid={`module-card-summary-${mod.id}`}
                      >
                        <Badge
                          variant={isActive ? 'secondary' : 'outline'}
                          className="text-[10px] font-normal"
                          data-testid={`module-card-status-${mod.id}`}
                        >
                          {isActive ? t('activeLabel') : t('inactiveLabel')}
                        </Badge>
                        {credentialsMissing && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] font-normal"
                            data-testid={`module-card-credentials-chip-${mod.id}`}
                          >
                            {mod.credentialStatus === 'vault-locked'
                              ? t('credentialsVaultLockedChip')
                              : t('credentialsMissingChip')}
                          </Badge>
                        )}
                        {healthKnown && (
                          <span
                            className={`inline-block size-2 shrink-0 rounded-full ${healthDotClass}`}
                            aria-label={t('health.successRate', { rate: healthRatePct ?? 0 })}
                            title={t('health.successRate', { rate: healthRatePct ?? 0 })}
                            data-testid={`module-card-health-dot-${mod.id}`}
                          />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  {mode === 'global' && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      {(isInstance || mod.instanceable !== false) && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t('instances.addButton')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInstanceFormFor((cur) => (cur === mod.id ? null : mod.id));
                                }}
                                data-testid={`module-add-instance-${mod.id}`}
                              >
                                <Plus />
                              </Button>
                            }
                          />
                          <TooltipContent>{t('instances.addButton')}</TooltipContent>
                        </Tooltip>
                      )}
                      {isInstance &&
                        !isDefaultInstanceId(mod.id) &&
                        (pendingInstanceDelete === mod.id ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteInstance(mod.id);
                            }}
                            data-testid={`module-delete-instance-${mod.id}`}
                          >
                            {t('instances.deleteConfirm')}
                          </Button>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={t('instances.deleteButton')}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPendingInstanceDelete(mod.id);
                                  }}
                                  data-testid={`module-delete-instance-${mod.id}`}
                                >
                                  <Trash2 />
                                </Button>
                              }
                            />
                            <TooltipContent>{t('instances.deleteButton')}</TooltipContent>
                          </Tooltip>
                        ))}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t('disableModule')}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDisableModule(mod.id);
                              }}
                              data-testid={`module-disable-${mod.id}`}
                            >
                              <PowerOff />
                            </Button>
                          }
                        />
                        <TooltipContent>{t('disableModule')}</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
                {mode === 'global' && instanceFormFor === mod.id && (
                  <AddInstanceForm
                    baseModule={instanceFormBase}
                    reservedSlugs={modules.filter((m) => !m.baseModuleId).map((m) => m.id)}
                    takenSlugs={instanceSlugsOf(modules, instanceFormBase.id)}
                    unlocked={vaultUnlocked}
                    existingKeys={vaultKeys}
                    onEditVaultKey={onEditVaultKey}
                    onCreated={() => {
                      setInstanceFormFor(null);
                      requestModulesRefresh();
                    }}
                    onCancel={() => setInstanceFormFor(null)}
                  />
                )}
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  {/* Full reliability detail strip — expanded view only. The
                      collapsed card surfaces just a health dot (above). */}
                  <ModuleHealthStrip moduleId={mod.id} stats={healthByModule[mod.id]} />
                  {mode === 'global' && isInstance && (
                    <InstanceNameEditor
                      key={`${mod.id}-${mod.name}`}
                      instance={mod}
                      onRenamed={requestModulesRefresh}
                    />
                  )}
                  {!mod.credentialsAvailable && mode === 'global' && (
                    <div
                      className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-2"
                      data-testid={`module-credentials-warning-${mod.id}`}
                    >
                      {mod.credentialStatus === 'vault-locked' ? (
                        <div className="flex items-center justify-between gap-2">
                          <span>{t('credentialsVaultLocked')}</span>
                          {onUnlockVault && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={onUnlockVault}
                              data-testid={`module-unlock-vault-${mod.id}`}
                            >
                              {t('credentialsUnlockButton')}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span>
                          {t('credentialsMissing', {
                            keys:
                              (mod.missingKeys?.length
                                ? mod.missingKeys
                                : mod.requiredEnvVars
                              ).join(', ') || '(none)',
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => handleToggleActive(mod.id, e.target.checked)}
                      data-testid={`module-active-${mod.id}`}
                    />{' '}
                    {t('activeLabel')}
                  </label>
                  {isActive && (
                    <>
                      {mode === 'project' && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={inheriting}
                            onChange={(e) => handleToggleInherit(mod.id, e.target.checked)}
                            data-testid={`module-inherit-${mod.id}`}
                          />
                          {t('module.inheritGlobal')}
                        </label>
                      )}
                      <div className="space-y-3" aria-disabled={inheriting}>
                        {Object.entries(mod.configSchema).map(([key, schema]) => {
                          if (!isFieldSchema(schema)) return null;

                          // Batch mode and reasoning effort are rendered with dedicated copilot-only
                          // controls below (they require model-context-aware UI). Skipping them here
                          // prevents duplicate id="module-copilot-field-{key}" attributes that would
                          // cause e2e selectors and accessibility tools to match the wrong element.
                          if (mod.id === 'copilot' && key === 'batchMode') return null;
                          if (key === 'reasoningEffort') return null;

                          // Skip project-only fields when rendering global config.
                          if (schema.projectOnly && mode === 'global') return null;

                          // Credentials are vault-managed in every scope. Password fields
                          // are stripped from both save payloads (see handleSave) and the
                          // server rejects any password key on a project module-config save
                          // (assertNoPasswordFields), so rendering an input for them — in
                          // global OR project mode — is a dead control. The real key always
                          // belongs in the encrypted vault (M18).
                          if (isPasswordField(schema)) return null;

                          const current = resolveFieldValue(key);
                          const fieldId = `module-${mod.id}-field-${key}`;
                          const disabled = inheriting;

                          if (schema.type === 'boolean') {
                            const enabled = Boolean(current ?? schema.default);
                            // Structured output is the stable, original path only for
                            // generic-ai (openai-compatible). For the cloud providers
                            // (openai/google/deepseek/anthropic) it is experimental — the
                            // copy advises testing both on and off, so the note shows for
                            // the field regardless of the toggle's current state.
                            const showStructuredWarning =
                              key === 'useStructuredOutput' && mod.id !== 'generic-ai';
                            // gpt-5.6-luna has a known, unfixed limitation under OpenAI's
                            // schema-less JSON mode (the only structured-output path this
                            // app sends for openai — see model-factory.ts's
                            // nativeStructuredOutputSettings): it frequently refuses to
                            // translate — an error/refusal string or a malformed reply in
                            // place of the real translation/review. Surfaced as a
                            // known-model-limitation notice (no behavioral/request-path
                            // change) whenever the selected model matches and structured
                            // output is on for this instance.
                            const currentModelId = resolveFieldValue('model');
                            const showLunaStructuredOutputWarning =
                              key === 'useStructuredOutput' &&
                              enabled &&
                              typeof currentModelId === 'string' &&
                              /gpt-5\.6-luna/i.test(currentModelId);
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <input
                                    id={fieldId}
                                    type="checkbox"
                                    // Reflect the schema default when the value is unset,
                                    // so default-on flags (e.g. generic-ai `free`) render checked.
                                    checked={enabled}
                                    onChange={(e) => handleChange(mod.id, key, e.target.checked)}
                                    disabled={disabled}
                                  />
                                  <Label htmlFor={fieldId}>{fieldKeyToLabel(key)}</Label>
                                  {/* The "experimental" note is condensed to an Info
                                      tooltip so the expanded card stays tight. */}
                                  {showStructuredWarning && (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <button
                                            type="button"
                                            className="text-muted-foreground inline-flex cursor-help items-center"
                                            aria-label={t('structuredOutputExperimentalWarning')}
                                            data-testid={`module-${mod.id}-structured-output-warning`}
                                          >
                                            <Info className="size-3.5 shrink-0" aria-hidden />
                                          </button>
                                        }
                                      />
                                      <TooltipContent>
                                        {t('structuredOutputExperimentalWarning')}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {showLunaStructuredOutputWarning && (
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <button
                                            type="button"
                                            className="text-destructive inline-flex cursor-help items-center"
                                            aria-label={t('structuredOutputLunaWarning')}
                                            data-testid={`module-${mod.id}-structured-output-luna-warning`}
                                          >
                                            <AlertTriangle
                                              className="size-3.5 shrink-0"
                                              aria-hidden
                                            />
                                          </button>
                                        }
                                      />
                                      <TooltipContent>
                                        {t('structuredOutputLunaWarning')}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (schema.type === 'number') {
                            return (
                              <div key={key} className="space-y-1">
                                <Label htmlFor={fieldId}>{fieldKeyToLabel(key)}</Label>
                                <Input
                                  id={fieldId}
                                  type="number"
                                  min="1"
                                  step="1"
                                  className="w-full min-w-0 max-w-64"
                                  // Stored as a string like every other config value;
                                  // the module coerces. State is seeded via `defaultValue`,
                                  // so the schema default already lives in `current`.
                                  value={typeof current === 'string' ? current : ''}
                                  onChange={(e) => handleChange(mod.id, key, e.target.value)}
                                  disabled={disabled}
                                />
                                {schema.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {schema.description}
                                  </p>
                                )}
                              </div>
                            );
                          }

                          if (Array.isArray(schema.enum) && schema.enum.length > 0) {
                            return (
                              <div key={key} className="space-y-1">
                                <Label htmlFor={fieldId}>{fieldKeyToLabel(key)}</Label>
                                <Select
                                  value={typeof current === 'string' ? current : ''}
                                  onValueChange={(v) => {
                                    if (typeof v === 'string') handleChange(mod.id, key, v);
                                  }}
                                  disabled={disabled}
                                >
                                  <SelectTrigger
                                    className="w-full min-w-0 max-w-64"
                                    id={fieldId}
                                    data-testid={fieldId}
                                  >
                                    <SelectValue>{(v: string | null) => v ?? ''}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {schema.enum.map((opt) => (
                                      <SelectItem key={opt} value={opt}>
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }

                          return (
                            <div key={key} className="space-y-1">
                              <Label htmlFor={fieldId}>{fieldKeyToLabel(key)}</Label>
                              {key === 'model' ? (
                                <ModuleModelSelectorWithFallback
                                  moduleId={mod.id}
                                  id={fieldId}
                                  value={typeof current === 'string' ? current : ''}
                                  onValueChange={(v) => handleChange(mod.id, key, v)}
                                  disabled={disabled}
                                  enabled={modelsFetchEnabled}
                                  suggestions={
                                    Array.isArray(schema.suggestions) ? schema.suggestions : []
                                  }
                                  // A module is a local LLM when it exposes a `free`
                                  // flag that isn't switched off (default on). Modules
                                  // without the flag leave it undefined (inferred).
                                  local={
                                    mod.configSchema.free !== undefined
                                      ? resolveFieldValue('free') !== false
                                      : undefined
                                  }
                                  // Score against this module's own configured
                                  // reasoning effort (per-card — different modules
                                  // can be set to different efforts), keeping the
                                  // project-mode gating from the shared context.
                                  confidenceContext={
                                    confidenceContext && {
                                      ...confidenceContext,
                                      effort:
                                        (resolveFieldValue(
                                          'reasoningEffort',
                                        ) as ModelConfidenceContext['effort']) || undefined,
                                    }
                                  }
                                />
                              ) : (
                                <ComboboxInput
                                  id={fieldId}
                                  suggestions={
                                    Array.isArray(schema.suggestions) ? schema.suggestions : []
                                  }
                                  value={typeof current === 'string' ? current : ''}
                                  onValueChange={(v) => handleChange(mod.id, key, v)}
                                  disabled={disabled}
                                />
                              )}
                              {schema.description && (
                                <p className="text-xs text-muted-foreground">
                                  {schema.description}
                                </p>
                              )}
                            </div>
                          );
                        })}
                        {mod.id === 'copilot' &&
                          (() => {
                            const currentBatchMode = normalizeCopilotBatchMode(
                              resolveFieldValue('batchMode'),
                            );
                            const batchModeFieldId = `module-${mod.id}-field-batchMode`;
                            const selectedModelId = resolveFieldValue('model') as
                              string | undefined;
                            const selectedModel = copilotModels.find(
                              (m) => m.id === selectedModelId,
                            );
                            const supported = selectedModel?.supportedReasoningEfforts ?? [];

                            // While models are still loading, show a skeleton placeholder
                            // so the user knows reasoning info is being fetched.
                            if (copilotModelsLoading && copilotModels.length === 0) {
                              return (
                                <div key="reasoningEffort-loading" className="space-y-1">
                                  <Skeleton className="h-4 w-32" />
                                  <Skeleton className="h-9 w-64" />
                                </div>
                              );
                            }

                            // Batch mode is independent of the optional cache-status
                            // request: render it whether or not `serverCacheStatus`
                            // loaded (a failed cache-status fetch must not hide it).
                            const batchModeSelect = (
                              <div key="batchMode" className="space-y-1">
                                <Label htmlFor={batchModeFieldId}>{t('module.batchMode')}</Label>
                                <Select
                                  value={currentBatchMode}
                                  onValueChange={(v) => {
                                    if (typeof v === 'string') handleChange(mod.id, 'batchMode', v);
                                  }}
                                  disabled={inheriting}
                                >
                                  <SelectTrigger
                                    className="w-full min-w-0 max-w-64"
                                    id={batchModeFieldId}
                                    data-testid={batchModeFieldId}
                                  >
                                    <SelectValue>
                                      {(v: string | null) =>
                                        v === 'entry'
                                          ? t('module.batchByEntry')
                                          : t('module.batchByLanguage')
                                      }
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="language">
                                      {t('module.batchByLanguage')}
                                    </SelectItem>
                                    <SelectItem value="entry">
                                      {t('module.batchByEntry')}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            );

                            const cacheStatusFooter = serverCacheStatus ? (
                              <p
                                className="text-xs text-muted-foreground"
                                data-testid="copilot-server-cache-status"
                              >
                                {t('module.serverCache')}{' '}
                                <span
                                  className={
                                    serverCacheStatus.fresh
                                      ? 'text-status-pass'
                                      : 'text-status-warn'
                                  }
                                >
                                  {serverCacheStatus.fresh
                                    ? t('module.cacheFresh')
                                    : t('module.cacheStale')}
                                </span>
                                {serverCacheStatus.updatedAt &&
                                  ` · ${relativeTime(new Date(serverCacheStatus.updatedAt))}`}
                              </p>
                            ) : null;

                            if (supported.length === 0) {
                              return (
                                <>
                                  {batchModeSelect}
                                  {cacheStatusFooter}
                                </>
                              );
                            }

                            const currentEffort = resolveFieldValue('reasoningEffort') as
                              string | undefined;
                            return (
                              <>
                                {batchModeSelect}
                                <div key="reasoningEffort" className="space-y-1">
                                  <ReasoningEffortSelect
                                    supported={supported}
                                    value={currentEffort}
                                    onChange={(value) =>
                                      handleChange(mod.id, 'reasoningEffort', value)
                                    }
                                    id={`module-${mod.id}-field-reasoningEffort`}
                                    label={t('module.reasoningEffort')}
                                    triggerClassName="w-full min-w-0 max-w-64"
                                    includeDisabledItem
                                    disabled={inheriting}
                                  />
                                  {!copilotModelsLoading && copilotModelsCachedAt && (
                                    <p className="text-xs text-muted-foreground">
                                      {t('module.modelInfoUpdated', {
                                        time: relativeTime(copilotModelsCachedAt),
                                      })}
                                    </p>
                                  )}
                                  {cacheStatusFooter}
                                </div>
                              </>
                            );
                          })()}
                        {mod.id !== 'copilot' && 'reasoningEffort' in mod.configSchema && (
                          <ModuleReasoningEffortSelect
                            moduleId={mod.id}
                            model={resolveFieldValue('model') as string | undefined}
                            value={resolveFieldValue('reasoningEffort') as string | undefined}
                            id={`module-${mod.id}-field-reasoningEffort`}
                            label={t('module.reasoningEffort')}
                            triggerClassName="w-full min-w-0 max-w-64"
                            disabled={inheriting}
                            enabled={modelsFetchEnabled}
                            clearStaleEffort={{ inheriting }}
                            onChange={(value) => handleChange(mod.id, 'reasoningEffort', value)}
                          />
                        )}
                      </div>
                    </>
                  )}
                  <div>
                    <Button
                      variant={hasUnsavedChanges ? 'default' : 'outline'}
                      onClick={() => handleSave(mod.id)}
                      disabled={savingId === mod.id}
                      data-unsaved={hasUnsavedChanges ? 'true' : undefined}
                      data-testid={`module-save-${mod.id}`}
                    >
                      {savingId === mod.id ? tCommon('saving') : tCommon('save')}
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
