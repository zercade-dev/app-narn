/**
 * Model-label helpers for the Copilot models API. The billing suffix and label
 * are consumed by `ModelPicker` to render model rows with their pricing.
 */
import type { ModelInfo } from '@/hooks/use-copilot-models';

/**
 * Terse billing suffix appended to model labels in dropdowns and selected
 * values: ` (2×)` with an input multiplier only, ` (2× in / 4× out)` when an
 * output multiplier is also available, ` (4× out)` with output only.
 */
export function buildBillingSuffix(
  multiplier: number | undefined,
  outputMultiplier?: number,
): string {
  if (multiplier !== undefined && outputMultiplier !== undefined) {
    return ` (${multiplier}× in / ${outputMultiplier}× out)`;
  }
  if (multiplier !== undefined) return ` (${multiplier}×)`;
  if (outputMultiplier !== undefined) return ` (${outputMultiplier}× out)`;
  return '';
}

/** Display label for a model: name (falling back to id) plus billing suffix. */
export function buildModelLabel(model: ModelInfo): string {
  return (
    (model.name ?? model.id) +
    buildBillingSuffix(model.billing?.multiplier, model.billing?.outputMultiplier)
  );
}
