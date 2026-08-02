/**
 * Single source of truth for the per-achievement translated-text byte budget.
 * BOTH consumers — the M10 `achievement-length-limit` LQA check and M9's
 * achievement prompt context — resolve through this helper from the same
 * per-project options bag (`project.lqaConfig.checks['achievement-length-limit']
 * .options`), so the budget the model is told and the budget the gate checks
 * can never disagree.
 */
export const DEFAULT_ACHIEVEMENT_NAME_MAX_BYTES = 20;
export const DEFAULT_ACHIEVEMENT_DESCRIPTION_MAX_BYTES = 40;

/**
 * Positive-integer option with fallback. Deliberately integer-only (the
 * former M10 helper floored fractional values); fractional/invalid configs
 * fall back to the default.
 */
function positiveIntOption(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

export function resolveAchievementMaxBytes(
  type: 'name' | 'description',
  options: Record<string, unknown>,
): number {
  return type === 'name'
    ? positiveIntOption(options.nameMaxBytes, DEFAULT_ACHIEVEMENT_NAME_MAX_BYTES)
    : positiveIntOption(options.descriptionMaxBytes, DEFAULT_ACHIEVEMENT_DESCRIPTION_MAX_BYTES);
}
