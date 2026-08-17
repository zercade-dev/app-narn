/**
 * Does any value in `current` differ from the same key in `defaults`?
 *
 * Deliberately field-agnostic: the caller decides which of its state belongs to
 * the Advanced section and passes only those keys, because "advanced" is a
 * per-dialog layout fact that no shared helper can know.
 *
 * Compared by JSON shape so nested records (a checks map) and arrays (a
 * selected-context list) work without a deep-equal dependency. That makes a
 * pure reorder of an array read as modified; every array here is a selection
 * whose order the user does not control, and over-reporting is the safe
 * direction for a "this section is non-empty" hint.
 */
export function hasNonDefaultValues<T extends Record<string, unknown>>(
  current: T,
  defaults: T,
): boolean {
  return Object.keys(current).some(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(defaults[key]),
  );
}
