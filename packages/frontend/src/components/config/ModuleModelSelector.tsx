/**
 * Generic model selector for any module that exposes a `/modules/:moduleId/models` endpoint.
 * Supports both selecting from discovered models and entering custom model names.
 * Opens a searchable, pricing-sortable model table (ModelPicker) whose search
 * box doubles as free-text entry for custom model ids.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { recommendedModelsFor } from '@zercade-dev/narn-shared';
import type { ModelConfidenceContext } from '@zercade-dev/narn-shared';
import { useModuleModels } from '@/hooks/use-module-models';
import { useModelFootprints } from '@/hooks/use-model-footprints';
import { useBetaUi } from '@/hooks/use-beta-ui';
import { ModelPicker } from './ModelPicker.js';
import { useAutoSelectModel } from './use-auto-select-model.js';
import {
  ModelRefreshControl,
  ModelsLoadingPlaceholder,
  ModelsStatusFooter,
  useRelativeTimeTick,
} from './ModelRefreshControl.js';

export interface ModuleModelSelectorProps {
  moduleId: string;
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  /**
   * Preferred default to auto-select on first discovery (e.g. the module's
   * globally-configured model). Used only when it's among the discovered
   * models; otherwise the cheapest model is selected instead.
   */
  preferredModel?: string;
  /**
   * Whether this module is a free, local LLM. Drives the picker's local-LLM
   * layout (pricing hidden, size/VRAM footprint shown). Defaults to inferring
   * from whether discovered models report a disk size.
   */
  local?: boolean;
  /**
   * Extra classes for the picker trigger button (merged over its default
   * `w-64`), e.g. `w-full` to let it span its container.
   */
  triggerClassName?: string;
  /**
   * When `false`, no `/models` request is made (the picker shows whatever is in
   * the local cache, if any). Forwarded to `useModuleModels`; defaults to `true`.
   */
  enabled?: boolean;
  /** Forwarded to ModelPicker: enables the Confidence column for this run context. */
  confidenceContext?: ModelConfidenceContext;
}

export function ModuleModelSelector(props: Readonly<ModuleModelSelectorProps>): React.JSX.Element {
  const {
    moduleId,
    id,
    value,
    onValueChange,
    disabled,
    preferredModel,
    local,
    triggerClassName,
    enabled = true,
    confidenceContext,
  } = props;
  const { models, loading, error, errorDetail, cachedAt, refetch } = useModuleModels(
    moduleId,
    enabled,
  );
  const { footprints, inspecting, progress, inspect } = useModelFootprints(moduleId);
  const { t } = useTranslation('config');

  // Base provider (strip any `:instance` suffix) — the base id IS the
  // provider name for the AI modules — resolves the curated recommended set.
  //
  // Beta-gated: `undefined` (→ ModelPicker renders no Recommended badge and
  // keeps its normal cost/name ordering) unless useBetaUi() allows it — the
  // recommended-model UI is beta-slot-only for now. `undefined` rather than an
  // empty Set so the intent reads as "feature off", not "nothing recommended".
  const betaUi = useBetaUi();
  const provider = moduleId.split(':')[0];
  const recommendedModelIds = React.useMemo(
    () =>
      betaUi ? new Set(recommendedModelsFor(provider).map((s) => s.toLowerCase())) : undefined,
    [betaUi, provider],
  );

  // Whether to use the local-LLM layout: the explicit `local` flag (from the
  // module's `free` config) wins; otherwise infer from discovery (only local
  // models report a disk size).
  const hasSizeData = models.some((m) => m.sizeBytes !== undefined);
  const isLocal = local ?? hasSizeData;
  // VRAM footprint inspection only works against Ollama, which is also the only
  // source of per-model disk size — so gate the inspect UI on having that data.
  const canInspect = isLocal && hasSizeData;

  // Tick every 30 s so the "Updated Xm ago" label stays current.
  useRelativeTimeTick(cachedAt);

  useAutoSelectModel(value, models, loading, disabled, onValueChange, preferredModel);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          {loading && models.length === 0 ? (
            <ModelsLoadingPlaceholder />
          ) : (
            <ModelPicker
              id={id}
              models={models}
              value={value}
              onValueChange={onValueChange}
              disabled={disabled}
              placeholder={models.length === 0 ? t('models.enterName') : t('models.selectOrType')}
              triggerTestId="module-model-picker-trigger"
              triggerClassName={triggerClassName}
              local={isLocal}
              confidenceContext={confidenceContext}
              recommendedModelIds={recommendedModelIds}
              {...(canInspect
                ? {
                    footprints,
                    inspecting,
                    inspectProgress: progress,
                    onInspectFootprints: () => inspect(models),
                  }
                : {})}
            />
          )}
        </div>
        <div className="shrink-0">
          <ModelRefreshControl
            loading={loading}
            hasModels={models.length > 0}
            cachedAt={cachedAt}
            onRefresh={refetch}
            disabled={disabled}
          />
        </div>
      </div>
      <ModelsStatusFooter
        loading={loading}
        cachedAt={cachedAt}
        error={error}
        errorTestId="module-models-error"
        errorDetail={errorDetail}
        errorDetailTestId="module-models-error-detail"
      />
    </div>
  );
}
