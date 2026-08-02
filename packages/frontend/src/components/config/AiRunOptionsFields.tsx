/**
 * Shared per-run AI module → model → reasoning-effort field group, used by the
 * AI-review dialog and the orphan relink confirm sheet. Purely controlled: the
 * caller owns the module list filtering, the default-derivation chain, and the
 * module-switch reset semantics (clear model so it auto-picks, drop the stale
 * effort) — this component only renders the three fields. Ids and testids
 * derive from `idPrefix` so existing per-dialog test hooks are preserved.
 */
import type { ModelConfidenceContext } from '@zercade-dev/narn-shared';
import { Label } from '../ui/label';
import { ModuleSelect, type ModuleSelectOption } from '../ui/module-select';
import { ModuleModelSelector } from './ModuleModelSelector.js';
import { ModuleReasoningEffortSelect } from './ModuleReasoningEffortSelect.js';

export interface AiRunOptionsFieldsProps {
  /** Prefix for ids/testids, e.g. `ai-review` → `ai-review-module-trigger`. */
  idPrefix: string;
  /** Modules to offer — already capability-filtered and enabled-gated by the caller. */
  modules: readonly ModuleSelectOption[];
  moduleId: string;
  model: string;
  /** Current effort; `''` means "model default" (no override sent). */
  reasoningEffort: string;
  onModuleChange: (id: string) => void;
  onModelChange: (model: string) => void;
  onReasoningEffortChange: (effort: string) => void;
  /** Per-module globally-configured model map (seeds the model auto-pick). */
  configuredModels: Record<string, string>;
  moduleLabel: string;
  modelLabel: string;
  reasoningEffortLabel: string;
  modulePlaceholder?: string;
  /** Forwarded to the model picker: enables the Confidence column for this run context. */
  confidenceContext?: ModelConfidenceContext;
}

export function AiRunOptionsFields({
  idPrefix,
  modules,
  moduleId,
  model,
  reasoningEffort,
  onModuleChange,
  onModelChange,
  onReasoningEffortChange,
  configuredModels,
  moduleLabel,
  modelLabel,
  reasoningEffortLabel,
  modulePlaceholder,
  confidenceContext,
}: Readonly<AiRunOptionsFieldsProps>): React.JSX.Element {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-module`}>{moduleLabel}</Label>
        <ModuleSelect
          id={`${idPrefix}-module`}
          triggerTestId={`${idPrefix}-module-trigger`}
          value={moduleId}
          onValueChange={onModuleChange}
          modules={modules}
          placeholder={modulePlaceholder}
        />
      </div>

      {moduleId && (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-model`}>{modelLabel}</Label>
          <ModuleModelSelector
            key={moduleId}
            id={`${idPrefix}-model`}
            moduleId={moduleId}
            value={model}
            onValueChange={onModelChange}
            preferredModel={configuredModels[moduleId]}
            confidenceContext={confidenceContext}
          />
        </div>
      )}

      {moduleId && (
        <ModuleReasoningEffortSelect
          id={`${idPrefix}-reasoning-effort`}
          moduleId={moduleId}
          model={model}
          value={reasoningEffort}
          onChange={onReasoningEffortChange}
          label={reasoningEffortLabel}
        />
      )}
    </>
  );
}
