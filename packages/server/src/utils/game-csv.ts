/**
 * Server-only CSV helpers for the game's dialect. The parser itself
 * (`parseGameCSV`/`ParsedGameCSV`) lives in `@zercade-dev/narn-shared` so the
 * frontend can run the identical dialect parser client-side (e.g. the
 * pre-import raw-newline check in DataTab.tsx) without duplicating it. This
 * file re-exports it and keeps the serialize/round-trip-safety helpers below,
 * which depend on the server-only `escapeFormulaGuard`.
 */

import { escapeFormulaGuard } from './formula-guard.js';

export { parseGameCSV, type ParsedGameCSV } from '@zercade-dev/narn-shared';

/**
 * Serializes rows to game-dialect CSV: every cell (headers included) wrapped
 * in exactly one pair of double quotes, inner quotes emitted literally
 * (no RFC doubling), rows joined with CRLF. The formula/DDE guard
 * (`escapeFormulaGuard`) is applied per cell; importCSV's stripFormulaGuard
 * reverses it.
 */
export function serializeGameCSV(headers: string[], rows: Record<string, string>[]): string {
  const cell = (value: string): string => `"${escapeFormulaGuard(value)}"`;
  const lines: string[] = [headers.map(cell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => cell(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

/**
 * A cell value is round-trip-unsafe when it contains a `"` immediately followed
 * (modulo spaces/tabs) by a `,` or a line break — the exact sequence the
 * shared parser's cell-closing rule treats as a cell boundary (see the file
 * header in `@zercade-dev/narn-shared`'s `game-csv.ts`). Such content (e.g. a
 * JSON array `["a","b"]` or a leaked LLM payload) serializes fine but
 * mis-splits on re-import, shifting every following column. A trailing `"` at
 * the cell's end is safe (it round-trips), so only an *internal* quote+delimiter
 * is flagged.
 */
const ROUNDTRIP_UNSAFE = /"[ \t]*[\r\n,]/;

export function isRoundTripUnsafe(value: string): boolean {
  return ROUNDTRIP_UNSAFE.test(value);
}

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
