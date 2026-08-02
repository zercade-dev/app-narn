/**
 * Standalone, controlled reasoning-effort selector — the per-run counterpart to
 * the config panel's `ModuleReasoningEffortSection`. Given a module + currently
 * selected model, it renders a dropdown of that model's
 * `supportedReasoningEfforts` and reports the choice via `onChange`. An empty
 * string means "model default" (no override sent).
 *
 * Renders `null` when the selected model advertises no reasoning efforts, so
 * callers can drop it into a form unconditionally without guarding.
 */
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useModuleModels } from '../../hooks/use-module-models.js';
import { ReasoningEffortSelect } from './ReasoningEffortSelect.js';

export interface ModuleReasoningEffortSelectProps {
  /** Module whose model list supplies the supported efforts. */
  moduleId: string;
  /** Currently selected model id; efforts are read from this model. */
  model: string | undefined;
  /** Current effort value; `''`/undefined means "model default". */
  value: string | undefined;
  /** Called with the new effort, or `''` when "Default" is chosen. */
  onChange: (value: string) => void;
  /** Optional id for the trigger (label association). */
  id?: string;
  /** Optional label text; defaults to the localized "Reasoning effort". */
  label?: string;
  /** Optional className forwarded to the underlying select trigger. */
  triggerClassName?: string;
  disabled?: boolean;
  /**
   * Config-panel opt-in: when set, reconcile a leftover `reasoningEffort` with
   * the selected model once it is discovered — clear it when the model advertises
   * no reasoning support, or snap it to the lowest supported effort when the
   * stored value isn't one the model offers (a stale effort sent to a backend
   * that rejects it is either dropped or silently falls back to the model
   * default). Off for the per-run dialog, which keeps its override only in
   * transient UI state.
   */
  clearStaleEffort?: {
    /** Don't mutate an inherited config. */
    inheriting: boolean;
  };
  /**
   * When `false`, the underlying `useModuleModels` makes no `/models` request
   * (falling back to the local cache). Defaults to `true`.
   */
  enabled?: boolean;
}

export function ModuleReasoningEffortSelect({
  moduleId,
  model,
  value,
  onChange,
  id,
  label,
  triggerClassName,
  disabled,
  clearStaleEffort,
  enabled = true,
}: Readonly<ModuleReasoningEffortSelectProps>): React.JSX.Element | null {
  const { t } = useTranslation('config');
  const { models } = useModuleModels(moduleId, enabled);
  const selectedModel = models.find((m) => m.id === model);
  const supported = useMemo(() => selectedModel?.supportedReasoningEfforts ?? [], [selectedModel]);

  // Only act on discovered models — an unknown/custom id leaves `selectedModel`
  // undefined and we can't classify it — and never mutate an inherited config.
  const modelDiscovered = selectedModel !== undefined;
  const hasReasoningSupport = supported.length > 0;
  const inheriting = clearStaleEffort?.inheriting ?? false;
  // A set value the discovered model doesn't advertise is stale — e.g.
  // `disabled` left over from a model that supported it, now on gpt-5 which only
  // offers low/medium/high. Snap it to the lowest supported effort instead of
  // silently sending an option the model rejects (which falls back to the
  // model's own default and bills reasoning the user thought they'd turned off).
  const effortOutOfRange =
    modelDiscovered && hasReasoningSupport && !!value && !(supported as string[]).includes(value);
  useEffect(() => {
    if (!clearStaleEffort || inheriting || !modelDiscovered) return;
    if (!hasReasoningSupport) {
      if (value) onChange('');
      return;
    }
    if (effortOutOfRange) onChange(supported[0]);
  }, [
    clearStaleEffort,
    inheriting,
    modelDiscovered,
    hasReasoningSupport,
    effortOutOfRange,
    supported,
    value,
    onChange,
  ]);

  if (supported.length === 0) return null;

  return (
    <ReasoningEffortSelect
      supported={supported}
      value={value}
      onChange={onChange}
      id={id ?? `reasoning-effort-${moduleId}`}
      label={label ?? t('module.reasoningEffort')}
      triggerTestId="reasoning-effort-trigger"
      triggerClassName={triggerClassName}
      disabled={disabled}
    />
  );
}
