/**
 * CSV parser for the game's dialect (Miliastra Wonderland exports), plus
 * header→language-code mapping and raw-newline detection built on top of it.
 * Lives in shared so both the server importer and the frontend's pre-import
 * checks (DataTab.tsx) parse with the exact same rules — no duplicated,
 * potentially-drifting parser on the client side.
 *
 * The game wraps every cell in one pair of double quotes but does NOT escape
 * inner quotes by doubling them (it is not RFC-4180). A cell whose content is
 * `"quoted-text"` (quotes included) is written as `""quoted-text""`, never as
 * the RFC form `"""quoted-text"""`. Hand-edited files may also mix unquoted
 * cells (`"a",b`) and spaces around cells.
 *
 * Parsing rule: inside a quoted cell, a `"` closes the cell only when the next
 * non-space/tab character is a delimiter (`,`), a line break, or end of input;
 * otherwise the quote is literal content. This makes all of these round-trip:
 *   `"text"`            → text
 *   `""quoted-text""`   → "quoted-text"
 *   `""quoted, text""`  → "quoted, text"
 *   `text2`             → text2 (quotes are optional)
 *
 * Known, inherent ambiguity of the dialect: content containing a quote
 * immediately followed by a delimiter (e.g. `a","b`) cannot be distinguished
 * from a cell boundary and will mis-split. The game format itself cannot
 * represent such content unambiguously, so fidelity with the game wins over
 * strict-RFC self-consistency. (The server's `utils/game-csv.ts` covers this
 * case separately as `isRoundTripUnsafe`/`findRoundTripUnsafeCells`.)
 */
import { LANGUAGE_REGISTRY } from './types/language.js';
import { LANGUAGE_COLUMN_ALIASES } from './csv-headers.js';

export interface ParsedGameCSV {
  headers: string[];
  /** Header-keyed data rows. Cells missing from a short row default to ''. */
  rows: Record<string, string>[];
  /**
   * Count of data rows dropped because real content spilled past the last
   * header column. That only happens when a cell's content contained an
   * unescaped quote+delimiter (e.g. `","`) or quote+newline and the dialect's
   * ambiguity (see file header) mis-split the row. Keeping such a row would
   * shift every following column — landing one field's content in the wrong
   * column (notably a translation fragment in the Source column), which is
   * unrecoverable. They are excluded from `rows` and reported here instead.
   */
  malformedRows: number;
}

function splitRows(content: string, maxRows: number | undefined): string[][] {
  // Strip a UTF-8 BOM so the first header matches by name.
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  // True while the current cell has seen only spaces/tabs — a quote there
  // opens a quoted cell (leading whitespace before the quote is discarded).
  let atCellStart = true;
  const len = content.length;

  // If the quote at `i` closes the cell, returns the index of the delimiter
  // (or `len` at EOF) after optional spaces/tabs; -1 means the quote is content.
  const closesAt = (i: number): number => {
    let j = i + 1;
    while (j < len && (content[j] === ' ' || content[j] === '\t')) j++;
    if (j >= len || content[j] === ',' || content[j] === '\n' || content[j] === '\r') return j;
    return -1;
  };

  const endCell = (): void => {
    row.push(cell);
    cell = '';
    atCellStart = true;
  };
  const endRow = (): void => {
    endCell();
    rows.push(row);
    row = [];
  };

  let i = 0;
  while (i < len) {
    if (maxRows !== undefined && rows.length > maxRows) break;
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        const j = closesAt(i);
        if (j !== -1) {
          inQuotes = false;
          i = j; // resume at the delimiter / EOF; handled by the outer loop
          continue;
        }
        cell += '"';
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }

    if (ch === ',') {
      endCell();
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      endRow();
      i++;
      continue;
    }
    if (ch === '"' && atCellStart) {
      inQuotes = true;
      cell = ''; // discard leading whitespace captured before the quote
      atCellStart = false;
      i++;
      continue;
    }
    cell += ch;
    if (ch !== ' ' && ch !== '\t') atCellStart = false;
    i++;
  }

  // Flush a final row without a trailing line break (tolerates an
  // unterminated quote at EOF: the cell keeps what was read).
  if (cell.length > 0 || row.length > 0) endRow();

  // Skip raw empty lines (a row of exactly one empty cell).
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}

/**
 * Parses game-dialect CSV into header-keyed records.
 * `maxRows` bounds the number of DATA rows kept (memory guard); callers detect
 * overflow by passing `limit + 1` and checking `rows.length > limit`.
 */
export function parseGameCSV(content: string, opts: { maxRows?: number } = {}): ParsedGameCSV {
  const maxTotal = opts.maxRows === undefined ? undefined : opts.maxRows + 1; // + header row
  const raw = splitRows(content, maxTotal);
  const headers = raw[0] ?? [];
  const rows: Record<string, string>[] = [];
  let malformedRows = 0;
  for (let r = 1; r < raw.length; r++) {
    if (opts.maxRows !== undefined && rows.length >= opts.maxRows) break;
    const cells = raw[r];
    // A correctly-formed row has exactly `headers.length` cells. Extra cells
    // carrying real content mean the row mis-split on an unescaped
    // quote+delimiter inside a cell (the dialect is not RFC-4180; see file
    // header). Importing it would shift every following column, so drop the row
    // rather than write corrupted, column-shifted data. Trailing empty cells
    // (e.g. a stray comma) are tolerated, matching the short-row leniency.
    if (cells.length > headers.length && cells.slice(headers.length).some((c) => c !== '')) {
      malformedRows++;
      continue;
    }
    // Null-prototype record so header keys (`__proto__`, `constructor`,
    // `toString`, …) become plain own data properties — prevents prototype
    // pollution AND avoids reading an inherited non-string back out downstream
    // (a `__proto__` header otherwise leaves the value unset and yields
    // `Object.prototype` on read, crashing the formula-guard strip with a
    // `TypeError`).
    const record: Record<string, string> = Object.create(null) as Record<string, string>;
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = cells[c] ?? '';
    }
    rows.push(record);
  }
  return { headers, rows, malformedRows };
}

/**
 * Builds a map of CSV header name → language code by matching against the
 * language registry (by code and by name) plus common CSV aliases. Also
 * reports headers beyond the FIRST that map to a language code already
 * claimed by an earlier header — those columns still import (last non-empty
 * cell wins per row), but the caller surfaces them as a warning so a CSV with
 * accidental duplicate language columns doesn't silently merge data.
 */
export function buildCsvColumnMap(headers: string[]): {
  colToCode: Map<string, string>;
  duplicateLanguageHeaders: string[];
} {
  const nameToCode = new Map<string, string>();
  for (const lang of LANGUAGE_REGISTRY) {
    nameToCode.set(lang.code.toLowerCase(), lang.code);
    nameToCode.set(lang.name.toLowerCase(), lang.code);
    nameToCode.set(lang.nativeName.toLowerCase(), lang.code);
  }
  for (const [alias, code] of Object.entries(LANGUAGE_COLUMN_ALIASES)) {
    nameToCode.set(alias, code);
  }
  const result = new Map<string, string>();
  const codeToFirstHeader = new Map<string, string>();
  const duplicateLanguageHeaders: string[] = [];
  for (const header of headers) {
    const code = nameToCode.get(header.toLowerCase());
    if (!code) continue;
    if (codeToFirstHeader.has(code)) {
      duplicateLanguageHeaders.push(header);
    } else {
      codeToFirstHeader.set(code, header);
    }
    result.set(header, code);
  }
  return { colToCode: result, duplicateLanguageHeaders };
}

/**
 * Returns the language codes (LANGUAGE_REGISTRY order) that have at least one
 * cell containing a raw newline byte (`\r` or `\n`) in a language-mapped CSV
 * column — as opposed to the literal two-character `\n` escape sequence game
 * text uses for an intentional in-game line break. A raw newline usually means
 * someone pasted multi-line text into a spreadsheet cell by mistake, which can
 * cause unexpected behavior in the game engine.
 */
export function findRawNewlineLanguages(
  rows: Record<string, string>[],
  colToCode: Map<string, string>,
): string[] {
  const found = new Set<string>();
  for (const row of rows) {
    for (const [header, code] of colToCode) {
      const value = row[header];
      if (value && /[\r\n]/.test(value)) found.add(code);
    }
  }
  const order = new Map(LANGUAGE_REGISTRY.map((lang, idx) => [lang.code, idx]));
  return [...found].sort(
    (a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
}
