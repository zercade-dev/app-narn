/**
 * The formula guard lives in `@zercade-dev/narn-shared` (`formula-guard.ts`) so
 * the frontend builds import files with the same rules. Re-exported here so
 * server imports are unchanged.
 */
export {
  FORMULA_TRIGGER,
  escapeFormulaGuard,
  escapeForReimport,
  hasFormulaGuard,
  stripFormulaGuard,
} from '@zercade-dev/narn-shared';
