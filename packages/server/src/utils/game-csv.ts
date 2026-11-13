/**
 * Server-only CSV helpers for the game's dialect. The parser, the serializer
 * and the round-trip check live in `@zercade-dev/narn-shared` so the frontend
 * runs the identical dialect rules client-side (DataTab's pre-import checks,
 * the orphans tour's import file). This file re-exports them and keeps the
 * export path's unsafe-cell scan below.
 */

import { isRoundTripUnsafe } from '@zercade-dev/narn-shared';

export {
  parseGameCSV,
  serializeGameCSV,
  isRoundTripUnsafe,
  type ParsedGameCSV,
  type FormulaGuardMode,
} from '@zercade-dev/narn-shared';

/**
 * Scans serialized rows for cells that will not survive a re-import (see
 * {@link isRoundTripUnsafe}). Returns the total unsafe-cell count and the set of
 * column headers affected, so the export path can warn the user.
 */
export function findRoundTripUnsafeCells(
  headers: string[],
  rows: Record<string, string>[],
): { count: number; columns: string[] } {
  let count = 0;
  const columns = new Set<string>();
  for (const row of rows) {
    for (const h of headers) {
      const value = row[h];
      if (value && isRoundTripUnsafe(value)) {
        count++;
        columns.add(h);
      }
    }
  }
  return { count, columns: [...columns] };
}
