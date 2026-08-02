import {
  LANGUAGE_REGISTRY,
  PSEUDO_LANGUAGE_CODE,
  SOURCE_COLUMN_NAMES,
  NEEDS_TRANSLATION_COLUMN_NAMES,
  CONTEXT_COLUMN_NAMES,
  DEFAULT_OVERFLOW_RATIO,
  buildCsvColumnMap,
  findRawNewlineLanguages,
  type StringEntry,
  type TranslationRecord,
} from '@zercade-dev/narn-shared';
import { atomicWriteText } from '../utils/fs.js';
import { generateEntryId } from '../utils/entry-id.js';
import { parseGameCSV, serializeGameCSV, findRoundTripUnsafeCells } from '../utils/game-csv.js';
import { stripFormulaGuard } from '../utils/formula-guard.js';
import type { ProjectStore, StringStore } from '../storage/types.js';
import { getProjectStore, getStringStore } from '../storage/registry.js';

export interface ImportDiff {
  newEntries: StringEntry[];
  changed: StringEntry[];
  removed: string[];
}

export interface ImportResult {
  entries: StringEntry[];
  diff: ImportDiff;
  unrecognizedHeaders: string[];
  /**
   * Headers beyond the first that map to a language code already claimed by
   * an earlier header (e.g. two "French" columns). Those columns still
   * import — the later column's non-empty cells win per row — but this list
   * lets the caller warn that the columns were merged rather than kept
   * separate.
   */
  duplicateLanguageHeaders: string[];
  skippedRows: number;
  /**
   * Rows dropped because they mis-split on the dialect's unescaped-quote
   * ambiguity (content spilled past the last column). See {@link parseGameCSV}.
   * Surfaced so the user can fix the source CSV rather than silently importing
   * column-shifted data.
   */
  malformedRows: number;
  /**
   * Language codes (excluding the project's source language) whose CSV column
   * carried at least one non-empty translation, in LANGUAGE_REGISTRY order.
   * Used by the import pipeline to auto-activate languages found in the file.
   */
  languagesWithData: string[];
  /**
   * Language codes (LANGUAGE_REGISTRY order) with at least one cell
   * containing a raw newline byte (`\r`/`\n`) in a language-mapped column —
   * as opposed to the literal two-character `\n` escape sequence. Advisory
   * only: the import always proceeds. The frontend runs the same check
   * client-side (via `findRawNewlineLanguages`) to gate confirmation BEFORE
   * upload; this field exists so the post-import summary reports it too, even
   * if that client-side gate is ever bypassed (e.g. a direct API call).
   */
  rawNewlineLanguages: string[];
}

// Constant for import limits
const MAX_CSV_ROWS = 200000; // 200k rows default

export class CSVImporter {
  // Resolve the project store lazily so a later setProjectStore() (e.g. per-test
  // injection) is honored even by the module-level singleton.
  private readonly _ps?: ProjectStore;
  private get ps(): ProjectStore {
    return this._ps ?? getProjectStore();
  }
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _ss?: StringStore;
  private get ss(): StringStore {
    return this._ss ?? getStringStore();
  }

  constructor(ps?: ProjectStore, ss?: StringStore) {
    this._ps = ps;
    this._ss = ss;
  }

  /**
   * Parses a CSV buffer into StringEntry[] and generates a diff against existing entries.
   * Source column is identified by matching the project's sourceLanguage code or name.
   * Translation columns are imported into each entry's translations map.
   * A "Source" column, if present, is parsed into entry categories.
   */
  async importCSV(
    csvContent: string,
    projectId: string,
    opts?: { defaultOverflowRatio?: number; maxRows?: number },
  ): Promise<ImportResult> {
    const project = await this.ps.loadProject(projectId);
    const sourceLanguageCode = project.sourceLanguage;

    const maxRows = opts?.maxRows ?? MAX_CSV_ROWS;

    // Game-dialect parse (optional quotes, literal inner quotes — see
    // utils/game-csv.ts) with a row limit to prevent memory exhaustion;
    // maxRows + 1 lets us detect overflow.
    const parsed = parseGameCSV(csvContent, { maxRows: maxRows + 1 });

    if (parsed.rows.length > maxRows) {
      throw new Error(`CSV exceeds maximum row limit of ${maxRows}`);
    }

    const headers = parsed.headers;
    const { colToCode, duplicateLanguageHeaders } = buildCsvColumnMap(headers);

    // Locate special-purpose columns using translated name sets so CSVs
    // authored in any supported language are handled correctly.
    const sourceMetaColName = headers.find((h) => SOURCE_COLUMN_NAMES.has(h.toLowerCase()));
    const needsTransColName = headers.find((h) =>
      NEEDS_TRANSLATION_COLUMN_NAMES.has(h.toLowerCase()),
    );
    const contextColName = headers.find((h) => CONTEXT_COLUMN_NAMES.has(h.toLowerCase()));

    // Any header that is neither a language column nor a recognised special
    // column is considered unrecognised and passed back to the caller.
    const recognisedHeaders = new Set<string>([
      ...colToCode.keys(),
      ...(sourceMetaColName ? [sourceMetaColName] : []),
      ...(needsTransColName ? [needsTransColName] : []),
      ...(contextColName ? [contextColName] : []),
    ]);
    const unrecognizedHeaders = headers.filter((h) => !recognisedHeaders.has(h));

    // Find the CSV column that maps to the source language
    const sourceColName = headers.find((h) => colToCode.get(h) === sourceLanguageCode);

    const now = Date.now();
    const seen = new Set<string>();
    const imported: StringEntry[] = [];
    let skippedRows = 0;

    let rowIndex = 0;
    for (const row of parsed.rows) {
      for (const header of headers) {
        const cell = row[header];
        if (cell) row[header] = stripFormulaGuard(cell);
      }
      const entry = this.parseRow(row, {
        headers,
        sourceColName,
        sourceLanguageCode,
        colToCode,
        sourceMetaColName,
        needsTransColName,
        contextColName,
        defaultOverflowRatio: opts?.defaultOverflowRatio,
        seen,
        now,
        rowIndex,
      });
      if (entry) {
        imported.push(entry);
      } else {
        skippedRows++;
      }
      rowIndex++;
    }

    // StringStore.load returns [] for a missing/corrupt strings file (it never
    // throws for "no existing entries"), so a thrown error here is a genuine
    // failure that should surface rather than be masked as a fresh project.
    const existing = await this.ss.load(projectId);

    const diff = this.generateDiff(existing, imported);

    // Flag only the genuinely-new side of the diff (entries with no prior id
    // match) so the Multi-language Text tab can filter to "just imported"
    // entries. `diff.newEntries` holds the SAME object references as `imported`
    // (see generateDiff below), so mutating here is reflected in the returned
    // `entries` array too. Never set for `changed`/unchanged entries — an
    // update to an existing entry is not a new entry.
    for (const entry of diff.newEntries) {
      entry.flaggedNew = true;
    }

    // Languages that actually carry data in this file (parseRow only records
    // non-empty cells), ordered by registry for stable display.
    const codesWithData = new Set<string>();
    for (const entry of imported) {
      for (const code of Object.keys(entry.translations)) codesWithData.add(code);
    }
    const languagesWithData = LANGUAGE_REGISTRY.map((l) => l.code).filter((code) =>
      codesWithData.has(code),
    );

    const rawNewlineLanguages = findRawNewlineLanguages(parsed.rows, colToCode);

    return {
      entries: imported,
      diff,
      unrecognizedHeaders,
      duplicateLanguageHeaders,
      skippedRows,
      malformedRows: parsed.malformedRows,
      languagesWithData,
      rawNewlineLanguages,
    };
  }

  /**
   * Parses a single CSV row into a StringEntry. Returns null only when the row
   * is empty across every recognized column (no source text, no translations,
   * no Source/Context metadata). Rows whose source-language cell is empty are
   * still imported so that downstream entries (e.g. `Need translation? = FALSE`
   * passthroughs) round-trip through export.
   */
  private parseRow(
    row: Record<string, string>,
    context: {
      headers: string[];
      sourceColName: string | undefined;
      sourceLanguageCode: string;
      colToCode: Map<string, string>;
      sourceMetaColName: string | undefined;
      needsTransColName: string | undefined;
      contextColName: string | undefined;
      defaultOverflowRatio: number | undefined;
      seen: Set<string>;
      now: number;
      rowIndex: number;
    },
  ): StringEntry | null {
    const {
      headers,
      sourceColName,
      sourceLanguageCode,
      colToCode,
      sourceMetaColName,
      needsTransColName,
      contextColName,
      defaultOverflowRatio,
      seen,
      now,
      rowIndex,
    } = context;
    const sourceText = sourceColName ? (row[sourceColName] ?? '') : '';

    const translations: Record<string, TranslationRecord> = {};
    for (const [colName, langCode] of colToCode) {
      if (langCode === sourceLanguageCode) continue;
      const text = row[colName] ?? '';
      if (text) {
        translations[langCode] = {
          text,
          status: 'translated',
          moduleId: 'csv-import',
          timestamp: now,
          needsReview: false,
        };
      }
    }

    const needsTranslationCell = needsTransColName ? (row[needsTransColName] ?? 'TRUE') : 'TRUE';
    const needsTranslation = needsTranslationCell.trim().toUpperCase() !== 'FALSE';

    const sourceCell = sourceMetaColName ? (row[sourceMetaColName] ?? '') : '';
    const sources = sourceCell
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const hasTranslations = Object.keys(translations).length > 0;
    // Skip rows that contain no translatable content. A non-empty Source
    // category alone is not sufficient — without source text or at least one
    // translation there is nothing to translate or preserve.
    if (!sourceText && !hasTranslations) return null;

    // Build a deterministic id. For rows with source text, hash the source text
    // (preserves dedup semantics). For sourceless rows (passthroughs that have
    // `Need translation? = FALSE`), hash the entire row content so the id is
    // stable across re-imports while still being unique per row.
    const rowSignature = headers.map((h) => `${h}=${row[h] ?? ''}`).join('\x1f');
    const idInput = sourceText || `__no-source__\x1f${rowSignature}`;
    const id = generateEntryId(idInput);
    if (seen.has(id)) return null;
    seen.add(id);

    return {
      id,
      sourceText,
      sources,
      needsTranslation,
      categories: [],
      context: contextColName ? (row[contextColName] ?? '') : '',
      overflowRatio: defaultOverflowRatio ?? DEFAULT_OVERFLOW_RATIO,
      metadata: {},
      translations,
      lqaResults: {},
      createdAt: now,
      updatedAt: now,
      sortIndex: rowIndex,
    };
  }

  /**
   * Generates a diff report comparing existing entries to imported entries.
   * Uses SHA-256 IDs for comparison — same ID means same source text.
   */
  generateDiff(existing: StringEntry[], imported: StringEntry[]): ImportDiff {
    const existingMap = new Map(existing.map((e) => [e.id, e]));
    const importedMap = new Map(imported.map((e) => [e.id, e]));

    const newEntries: StringEntry[] = [];
    const removed: string[] = [];
    const changed: StringEntry[] = [];

    for (const [id, entry] of importedMap) {
      const prev = existingMap.get(id);
      if (!prev) {
        newEntries.push(entry);
      } else if (prev.sourceText !== entry.sourceText) {
        // With SHA-256 ids on sourceText this branch is unreachable in normal
        // operation (any source change yields a new id). Kept for completeness
        // so callers that construct entries with non-hash ids see meaningful
        // diffs.
        changed.push(entry);
      }
    }

    for (const [id] of existingMap) {
      if (!importedMap.has(id)) {
        removed.push(id);
      }
    }

    return { newEntries, changed, removed };
  }

  /**
   * Exports entries for a project to CSV format, returning the CSV string.
   *
   * Column order is fixed:
   *   1. `Source` — comma-joined values from `entry.sources` (entry categories)
   *   2. `Need translation?` — driven by `entry.needsTranslation`
   *   3. Source language column (registry name, e.g. "English")
   *   4. Remaining active languages in `LANGUAGE_REGISTRY` order
   *   5. `Context` — appended only when `options.includeContext` is true
   *
   * Row order follows `entry.sortIndex` ascending (stable). Entries without a
   * `sortIndex` are appended after the indexed entries in their stored order.
   *
   * `options.languages` restricts the exported translation columns to the given
   * language codes (still ordered by registry). The source language column is
   * always emitted regardless of the filter.
   *
   * `options.pseudoAs` substitutes the synthetic pseudo-test column into a
   * real language's column: the chosen language's cells are filled from the
   * entry's `pseudo-test` translation (its real translations are NOT exported)
   * and the pseudo-test column itself is omitted. This lets pseudo text be
   * loaded in the game under a shippable language without ever touching the
   * stored translations. It may not be the source language or `pseudo-test`.
   */
  async exportCSVString(
    projectId: string,
    options?: {
      includeContext?: boolean;
      languages?: string[];
      pseudoAs?: string;
      discardUntranslatable?: boolean;
    },
  ): Promise<string> {
    const { headerOrder, rows } = await this.buildExportRows(projectId, options);
    return serializeGameCSV(headerOrder, rows);
  }

  /**
   * Like {@link exportCSVString} but also reports cells that will not survive a
   * re-import because their content mis-splits on the game dialect's
   * unescaped-quote ambiguity (see {@link findRoundTripUnsafeCells}). The export
   * still succeeds — the warning is advisory so the caller can surface it.
   */
  async exportCSVWithWarnings(
    projectId: string,
    options?: {
      includeContext?: boolean;
      languages?: string[];
      pseudoAs?: string;
      discardUntranslatable?: boolean;
    },
  ): Promise<{ csv: string; roundTripWarnings: { count: number; columns: string[] } }> {
    const { headerOrder, rows } = await this.buildExportRows(projectId, options);
    return {
      csv: serializeGameCSV(headerOrder, rows),
      roundTripWarnings: findRoundTripUnsafeCells(headerOrder, rows),
    };
  }

  private async buildExportHeader(
    projectId: string,
    options?: { includeContext?: boolean; languages?: string[]; pseudoAs?: string },
  ): Promise<{
    headerOrder: string[];
    translationLangs: string[];
    sourceLangName: string;
    codeToName: Map<string, string>;
  }> {
    const project = await this.ps.loadProject(projectId);
    const pseudoAs = options?.pseudoAs;
    if (
      pseudoAs !== undefined &&
      (pseudoAs === PSEUDO_LANGUAGE_CODE || pseudoAs === project.sourceLanguage)
    ) {
      throw new Error(`pseudoAs cannot be "${pseudoAs}"`);
    }
    const codeToName = new Map<string, string>();
    const registryIndex = new Map<string, number>();
    LANGUAGE_REGISTRY.forEach((lang, idx) => {
      codeToName.set(lang.code, lang.name);
      registryIndex.set(lang.code, idx);
    });
    const sourceLangName = codeToName.get(project.sourceLanguage) ?? project.sourceLanguage;
    const languageFilter = options?.languages ? new Set(options.languages) : null;
    const filteredLangs = project.activeLanguages
      .filter((code) => code !== project.sourceLanguage)
      .filter((code) => (languageFilter ? languageFilter.has(code) : true))
      .filter((code) => (pseudoAs !== undefined ? code !== PSEUDO_LANGUAGE_CODE : true));
    if (pseudoAs !== undefined && !filteredLangs.includes(pseudoAs)) filteredLangs.push(pseudoAs);
    const translationLangs = filteredLangs.sort(
      (a, b) =>
        (registryIndex.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (registryIndex.get(b) ?? Number.MAX_SAFE_INTEGER),
    );
    const headerOrder: string[] = ['Source', 'Need translation?', sourceLangName];
    for (const code of translationLangs) headerOrder.push(codeToName.get(code) ?? code);
    if (options?.includeContext === true) headerOrder.push('Context');
    return { headerOrder, translationLangs, sourceLangName, codeToName };
  }

  private async buildExportRows(
    projectId: string,
    options?: {
      includeContext?: boolean;
      languages?: string[];
      pseudoAs?: string;
      discardUntranslatable?: boolean;
    },
  ): Promise<{ headerOrder: string[]; rows: Record<string, string>[] }> {
    const allEntries = await this.ss.load(projectId);
    const entries =
      options?.discardUntranslatable === true
        ? allEntries.filter((e) => e.needsTranslation !== false)
        : allEntries;
    const { headerOrder, translationLangs, sourceLangName, codeToName } =
      await this.buildExportHeader(projectId, options);
    const pseudoAs = options?.pseudoAs;

    // Sort entries by sortIndex (stable). Undefined sortIndex sorts last.
    const ordered = entries
      .map((entry, idx) => ({ entry, idx }))
      .sort((a, b) => {
        const aIdx = a.entry.sortIndex ?? Number.MAX_SAFE_INTEGER;
        const bIdx = b.entry.sortIndex ?? Number.MAX_SAFE_INTEGER;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.idx - b.idx;
      })
      .map(({ entry }) => entry);

    const rows = ordered.map((entry) => {
      const row: Record<string, string> = {
        Source: entry.sources.join(', '),
        'Need translation?': entry.needsTranslation ? 'TRUE' : 'FALSE',
        [sourceLangName]: entry.sourceText,
      };

      for (const code of translationLangs) {
        const header = codeToName.get(code) ?? code;
        const sourceCode = code === pseudoAs ? PSEUDO_LANGUAGE_CODE : code;
        row[header] = entry.translations[sourceCode]?.text ?? '';
      }

      if (options?.includeContext === true) {
        row['Context'] = entry.context ?? '';
      }

      return row;
    });

    return { headerOrder, rows };
  }

  /**
   * Builds a blank import template: the active-language header row plus one
   * illustrative example row (no real project entries). Reuses the export header
   * so the template always matches a real export's columns.
   */
  async exportTemplateCSVString(
    projectId: string,
    options?: { includeContext?: boolean; languages?: string[] },
  ): Promise<string> {
    const { headerOrder, translationLangs, sourceLangName, codeToName } =
      await this.buildExportHeader(projectId, options);
    const example: Record<string, string> = {
      Source: 'example_key',
      'Need translation?': 'TRUE',
      [sourceLangName]: 'Example source text',
    };
    for (const code of translationLangs) {
      example[codeToName.get(code) ?? code] = '';
    }
    if (options?.includeContext === true) example['Context'] = 'Optional translator note';
    return serializeGameCSV(headerOrder, [example]);
  }

  /**
   * Exports entries for a project to a CSV file on disk.
   */
  async exportCSV(
    projectId: string,
    outputPath: string,
    options?: {
      includeContext?: boolean;
      languages?: string[];
      pseudoAs?: string;
      discardUntranslatable?: boolean;
    },
  ): Promise<void> {
    const csv = await this.exportCSVString(projectId, options);
    await atomicWriteText(outputPath, csv);
  }
}

export const csvImporter = new CSVImporter();
