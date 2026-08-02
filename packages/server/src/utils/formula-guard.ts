/**
 * Spreadsheet formula / DDE-injection guard shared by every CSV path
 * (project-string CSV, glossary CSV, game-dialect CSV).
 *
 * A cell whose content starts with one of these trigger characters would be
 * executed as a formula or DDE command when opened in a spreadsheet, so on
 * export it is prefixed with an apostrophe (`escapeFormulaGuard`); on import
 * that exact `apostrophe + trigger` prefix is stripped (`stripFormulaGuard`)
 * so the round-trip is lossless. Keeping the trigger set in one place means a
 * divergence (e.g. adding a trigger char) can't silently break round-tripping.
 *
 * This matches the trigger set Papa Parse's `escapeFormulae` option uses.
 */

/** Matches a cell whose first character would trigger formula/DDE execution. */
export const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Matches a cell that ALREADY, genuinely begins with a (possibly multi-`'`)
 * run of apostrophes immediately followed by a trigger character (e.g.
 * literal source text `'=1` or `''=1`). Such a value must ALSO be guarded on
 * export — otherwise it round-trips indistinguishably from a plain
 * trigger-prefixed value that {@link escapeFormulaGuard} guarded, and
 * {@link stripFormulaGuard} would strip a genuine leading apostrophe on
 * import, corrupting the text (and, since entry ids are hashes of the
 * source, silently orphaning the entry).
 *
 * Symmetric with {@link ESCAPED_FORMULA_GUARD} by construction: escape adds
 * exactly one `'` whenever this matches, and strip removes exactly one `'`
 * whenever the result of escape is fed back in — for ANY length of leading
 * apostrophe run, not just zero or one.
 */
const LEADING_APOSTROPHE_TRIGGER = /^'*[=+\-@\t\r]/;

/**
 * Inverse of {@link escapeFormulaGuard}: strips exactly the ONE leading
 * apostrophe that escape added, regardless of how many genuine apostrophes
 * originally preceded the trigger character. The lookahead requires a
 * leading `'` followed by zero-or-more further apostrophes and then a
 * trigger, so `'=x` → `=x`, `''=x` → `'=x`, `'''=x` → `''=x`, etc. — always
 * removing exactly the one apostrophe {@link escapeFormulaGuard} prepended.
 */
const ESCAPED_FORMULA_GUARD = /^'(?='*[=+\-@\t\r])/;

/**
 * Prefixes `value` with an apostrophe when it would otherwise be interpreted
 * as a spreadsheet formula — either because it starts with a trigger
 * character, or because it already starts with a run of apostrophes
 * followed by a trigger (genuine leading apostrophes that would otherwise be
 * indistinguishable from our own guard on import). Inverse of
 * {@link stripFormulaGuard}.
 */
export function escapeFormulaGuard(value: string): string {
  return FORMULA_TRIGGER.test(value) || LEADING_APOSTROPHE_TRIGGER.test(value)
    ? `'${value}`
    : value;
}

/** Removes the export-time formula guard, restoring the original cell value. */
export function stripFormulaGuard(value: string): string {
  return value.replace(ESCAPED_FORMULA_GUARD, '');
}
