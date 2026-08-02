/**
 * Glossary bulk import/export helpers — CSV and TBX serialization, parsing,
 * and the add/update/conflict diff used by the import dry-run preview
 * (same pattern as M2 CsvImporter's ImportDiff).
 *
 * ## CSV format
 *
 * One row per term. Columns:
 *   - `source`   — the source-language term (required on import)
 *   - one column per language code (e.g. `es`, `fr`) — the translations.
 *     On import, headers are matched case-insensitively against the language
 *     registry by code, English name, native name, and the common CSV aliases.
 *   - `constant` — TRUE/FALSE (empty keeps the existing value on update)
 *   - `note`     — free-text notes (`notes` is accepted as an alias on import)
 *
 * Export applies the same `escapeFormulae` guard as the project string CSV
 * export; import strips it again so the round-trip is lossless.
 *
 * ## TBX format (supported subset)
 *
 * A minimal TBX-Basic (ISO 30042) dialect. Only the following elements are
 * read/written — anything else in an imported file is ignored:
 *
 *   <tbx type="TBX-Basic" xml:lang="…" xmlns="urn:iso:std:iso:30042:ed-2">
 *     <tbxHeader>…</tbxHeader>            (written, ignored on import)
 *     <text><body>
 *       <conceptEntry id="…">
 *         <descrip type="note">…</descrip>   (optional — maps to `notes`)
 *         <admin type="constant">true</admin> (optional — maps to `constant`)
 *         <langSec xml:lang="en">
 *           <termSec><term>…</term></termSec>
 *         </langSec>                          (one per language)
 *       </conceptEntry>
 *     </body></text>
 *   </tbx>
 *
 * The `langSec` whose `xml:lang` resolves to the project source language
 * supplies the term `source`; every other `langSec` becomes a translation.
 * As with the CSV path, each `xml:lang` is resolved against the language
 * registry, so a `langSec` with an unrecognized code is dropped. Only the
 * first `termSec` of each `langSec` is read. Character data must use the
 * standard XML entities (`&amp; &lt; &gt; &quot; &apos;`) or numeric
 * references; CDATA sections are not supported.
 */
import Papa from 'papaparse';
import {
  LANGUAGE_REGISTRY,
  LANGUAGE_COLUMN_ALIASES,
  type Glossary,
  type GlossaryTerm,
} from '@zercade-dev/narn-shared';
import { stripFormulaGuard } from './formula-guard.js';

/** A term parsed from an uploaded file — no id yet. */
export type ParsedGlossaryTerm = Omit<GlossaryTerm, 'id'>;

export interface GlossaryParseResult {
  terms: ParsedGlossaryTerm[];
  /** CSV headers that could not be mapped to a language or known column. */
  unrecognizedHeaders: string[];
  /** Rows skipped because the source cell was empty or duplicated in-file. */
  skippedRows: number;
}

export const MAX_GLOSSARY_IMPORT_ROWS = 50_000;

/** Maps a CSV header to a registry language code, or undefined. */
function buildLanguageLookup(): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const lang of LANGUAGE_REGISTRY) {
    lookup.set(lang.code.toLowerCase(), lang.code);
    lookup.set(lang.name.toLowerCase(), lang.code);
    lookup.set(lang.nativeName.toLowerCase(), lang.code);
  }
  for (const [alias, code] of Object.entries(LANGUAGE_COLUMN_ALIASES)) {
    lookup.set(alias.toLowerCase(), code);
  }
  return lookup;
}

/**
 * Orders the language columns for export: project active languages first
 * (in their configured order, source excluded), then any remaining languages
 * found in the terms, sorted alphabetically.
 */
export function exportLanguageOrder(
  terms: GlossaryTerm[],
  activeLanguages: string[],
  sourceLanguage: string,
): string[] {
  const present = new Set<string>();
  for (const term of terms) {
    for (const code of Object.keys(term.translations)) present.add(code);
  }
  // The source language is represented by the `source` column/langSec, never
  // as a translation column.
  present.delete(sourceLanguage);
  const ordered: string[] = [];
  for (const code of activeLanguages) {
    if (code === sourceLanguage) continue;
    ordered.push(code);
    present.delete(code);
  }
  ordered.push(...Array.from(present).sort());
  return ordered;
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function glossaryToCsv(glossary: Glossary, languages: string[]): string {
  const fields = ['source', ...languages, 'constant', 'note'];
  const rows = glossary.terms.map((term) => {
    const row: Record<string, string> = { source: term.source };
    for (const code of languages) {
      row[code] = term.translations[code] ?? '';
    }
    row['constant'] = term.constant ? 'TRUE' : 'FALSE';
    row['note'] = term.notes ?? '';
    return row;
  });
  // escapeFormulae: same spreadsheet formula/DDE-injection guard as the
  // project string export; parseGlossaryCsv strips the guard on re-import.
  return Papa.unparse({ fields, data: rows }, { escapeFormulae: true });
}

export function parseGlossaryCsv(content: string): GlossaryParseResult {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    preview: MAX_GLOSSARY_IMPORT_ROWS + 1,
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error at row ${first.row ?? 'unknown'}: ${first.message}`);
  }
  if (parsed.data.length > MAX_GLOSSARY_IMPORT_ROWS) {
    throw new Error(`CSV exceeds maximum row limit of ${MAX_GLOSSARY_IMPORT_ROWS}`);
  }

  const headers = parsed.meta.fields ?? [];
  const langLookup = buildLanguageLookup();

  let sourceCol: string | undefined;
  let constantCol: string | undefined;
  let noteCol: string | undefined;
  const langCols = new Map<string, string>(); // header → code
  const unrecognizedHeaders: string[] = [];

  for (const header of headers) {
    const lower = header.trim().toLowerCase();
    if (lower === 'source' && !sourceCol) {
      sourceCol = header;
    } else if (lower === 'constant' && !constantCol) {
      constantCol = header;
    } else if ((lower === 'note' || lower === 'notes') && !noteCol) {
      noteCol = header;
    } else {
      const code = langLookup.get(lower);
      if (code && !langCols.has(code)) {
        langCols.set(code, header);
      } else {
        unrecognizedHeaders.push(header);
      }
    }
  }
  if (!sourceCol) {
    throw new Error("CSV is missing the required 'source' column");
  }

  const terms: ParsedGlossaryTerm[] = [];
  const seen = new Set<string>();
  let skippedRows = 0;

  for (const row of parsed.data) {
    const source = stripFormulaGuard((row[sourceCol] ?? '').trim());
    if (!source || seen.has(source)) {
      skippedRows++;
      continue;
    }
    seen.add(source);

    const translations: Record<string, string> = {};
    for (const [code, header] of langCols) {
      const text = stripFormulaGuard((row[header] ?? '').trim());
      if (text) translations[code] = text;
    }

    const term: ParsedGlossaryTerm = { source, translations };

    if (constantCol) {
      const cell = (row[constantCol] ?? '').trim().toUpperCase();
      if (cell === 'TRUE') term.constant = true;
      else if (cell === 'FALSE') term.constant = false;
      // empty → leave undefined (keeps existing value on update)
    }
    if (noteCol) {
      const note = stripFormulaGuard((row[noteCol] ?? '').trim());
      if (note) term.notes = note;
    }
    terms.push(term);
  }

  return { terms, unrecognizedHeaders, skippedRows };
}

// ─── TBX ─────────────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function unescapeXml(value: string): string {
  return value.replaceAll(
    /&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g,
    (match, entity: string): string => {
      switch (entity) {
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        case 'quot':
          return '"';
        case 'apos':
          return "'";
        default: {
          const code = entity.startsWith('#x')
            ? Number.parseInt(entity.slice(2), 16)
            : Number.parseInt(entity.slice(1), 10);
          return Number.isFinite(code) ? String.fromCodePoint(code) : match;
        }
      }
    },
  );
}

export function glossaryToTbx(
  glossary: Glossary,
  sourceLanguage: string,
  languages: string[],
): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<tbx type="TBX-Basic" style="dca" xml:lang="${escapeXml(sourceLanguage)}" xmlns="urn:iso:std:iso:30042:ed-2">`,
    '  <tbxHeader>',
    '    <fileDesc>',
    `      <titleStmt><title>${escapeXml(glossary.name)}</title></titleStmt>`,
    '      <sourceDesc><p>Exported from translator-v2 glossary</p></sourceDesc>',
    '    </fileDesc>',
    '  </tbxHeader>',
    '  <text>',
    '    <body>',
  ];

  for (const term of glossary.terms) {
    lines.push(`      <conceptEntry id="${escapeXml(term.id)}">`);
    if (term.notes) {
      lines.push(`        <descrip type="note">${escapeXml(term.notes)}</descrip>`);
    }
    if (term.constant !== undefined) {
      lines.push(`        <admin type="constant">${term.constant ? 'true' : 'false'}</admin>`);
    }
    lines.push(
      `        <langSec xml:lang="${escapeXml(sourceLanguage)}"><termSec><term>${escapeXml(term.source)}</term></termSec></langSec>`,
    );
    for (const code of languages) {
      const text = term.translations[code];
      if (!text) continue;
      lines.push(
        `        <langSec xml:lang="${escapeXml(code)}"><termSec><term>${escapeXml(text)}</term></termSec></langSec>`,
      );
    }
    lines.push('      </conceptEntry>');
  }

  lines.push('    </body>', '  </text>', '</tbx>', '');
  return lines.join('\n');
}

// SRV-PARSE-01: bound the attribute-list scan inside every opener tag. The
// `[^>]` runs below match a tag's attributes up to its `>`; capping them at
// MAX_TAG_ATTRS_SCAN means a pathological unterminated tag (e.g. a 20 MB
// `<langSec ` with no closing `>` and no `xml:lang="`) cannot drive the engine
// into quadratic backtracking — it gives up after the bound instead. A real
// opener tag's attributes are far under this limit.
const MAX_TAG_ATTRS_SCAN = 8_000;
const CONCEPT_ENTRY_RE = new RegExp(
  `<conceptEntry\\b[^>]{0,${MAX_TAG_ATTRS_SCAN}}>([\\s\\S]*?)<\\/conceptEntry>`,
  'g',
);
const LANG_SEC_RE = new RegExp(
  `<langSec\\b[^>]{0,${MAX_TAG_ATTRS_SCAN}}\\bxml:lang="([^"]*)"[^>]{0,${MAX_TAG_ATTRS_SCAN}}>([\\s\\S]*?)<\\/langSec>`,
  'g',
);
const TERM_RE = /<term\b[^>]*>([\s\S]*?)<\/term>/;
const NOTE_RE = /<descrip\b[^>]*\btype="note"[^>]*>([\s\S]*?)<\/descrip>/;
const CONSTANT_RE = /<admin\b[^>]*\btype="constant"[^>]*>([\s\S]*?)<\/admin>/;

export function parseGlossaryTbx(content: string, sourceLanguage: string): GlossaryParseResult {
  if (!/<tbx\b/.test(content)) {
    throw new Error('Not a TBX document: missing <tbx> root element');
  }

  const terms: ParsedGlossaryTerm[] = [];
  const seen = new Set<string>();
  let skippedRows = 0;

  // SRV-GLOSS-03: resolve every langSec's xml:lang through the same registry
  // lookup the CSV path uses, so junk codes (and reserved keys like __proto__)
  // never become translation keys. The resolved canonical code is used as the
  // key, matching the CSV behaviour.
  const langLookup = buildLanguageLookup();
  const sourceCode = langLookup.get(sourceLanguage.toLowerCase()) ?? sourceLanguage.toLowerCase();

  for (const conceptMatch of content.matchAll(CONCEPT_ENTRY_RE)) {
    if (terms.length + skippedRows >= MAX_GLOSSARY_IMPORT_ROWS) {
      throw new Error(`TBX exceeds maximum entry limit of ${MAX_GLOSSARY_IMPORT_ROWS}`);
    }
    const block = conceptMatch[1];

    let source = '';
    const translations: Record<string, string> = {};
    for (const langMatch of block.matchAll(LANG_SEC_RE)) {
      const code = langLookup.get(langMatch[1].toLowerCase());
      // Skip langSecs whose xml:lang does not resolve to a known language code
      // (this also excludes reserved keys such as __proto__/constructor/prototype,
      // which never appear in the registry).
      if (!code) continue;
      const termMatch = TERM_RE.exec(langMatch[2]);
      if (!termMatch) continue;
      const text = unescapeXml(termMatch[1].trim());
      if (!text) continue;
      if (code === sourceCode) {
        if (!source) source = text;
      } else if (!Object.hasOwn(translations, code)) {
        translations[code] = text;
      }
    }

    if (!source || seen.has(source)) {
      skippedRows++;
      continue;
    }
    seen.add(source);

    const term: ParsedGlossaryTerm = { source, translations };

    const noteMatch = NOTE_RE.exec(block);
    if (noteMatch) {
      const note = unescapeXml(noteMatch[1].trim());
      if (note) term.notes = note;
    }
    const constantMatch = CONSTANT_RE.exec(block);
    if (constantMatch) {
      term.constant = constantMatch[1].trim().toLowerCase() === 'true';
    }
    terms.push(term);
  }

  return { terms, unrecognizedHeaders: [], skippedRows };
}

// ─── Diff ────────────────────────────────────────────────────────────────────

export interface GlossaryImportUpdate {
  termId: string;
  source: string;
  before: ParsedGlossaryTerm;
  /** The merged term that will be written when the import is applied. */
  after: ParsedGlossaryTerm;
  /**
   * Languages where a non-empty existing translation would be overwritten
   * with a different non-empty imported value.
   */
  conflictLanguages: string[];
}

export interface GlossaryImportDiff {
  added: ParsedGlossaryTerm[];
  /** Existing terms changed without overwriting any non-empty translation. */
  updated: GlossaryImportUpdate[];
  /** Existing terms where at least one non-empty translation differs. */
  conflicts: GlossaryImportUpdate[];
  unchanged: number;
}

function toComparable(term: ParsedGlossaryTerm): string {
  const translations = Object.fromEntries(
    Object.entries(term.translations)
      .filter(([, v]) => v !== '')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify({
    source: term.source,
    translations,
    notes: term.notes ?? '',
    constant: term.constant ?? false,
  });
}

/**
 * Computes the add/update/conflict diff between the glossary's current terms
 * and the parsed import. Terms are matched by exact `source`. Imported values
 * are merged over existing ones: empty/omitted cells never clear existing
 * data, and omitted `constant`/`note` keep the current value.
 */
export function diffGlossaryImport(
  existing: GlossaryTerm[],
  imported: ParsedGlossaryTerm[],
): GlossaryImportDiff {
  const bySource = new Map<string, GlossaryTerm>();
  for (const term of existing) {
    if (!bySource.has(term.source)) bySource.set(term.source, term);
  }

  const diff: GlossaryImportDiff = { added: [], updated: [], conflicts: [], unchanged: 0 };

  for (const incoming of imported) {
    const current = bySource.get(incoming.source);
    if (!current) {
      diff.added.push({
        source: incoming.source,
        translations: incoming.translations,
        ...(incoming.notes !== undefined && { notes: incoming.notes }),
        ...(incoming.constant !== undefined && { constant: incoming.constant }),
      });
      continue;
    }

    const after: ParsedGlossaryTerm = {
      source: current.source,
      translations: { ...current.translations, ...incoming.translations },
      notes: incoming.notes ?? current.notes,
      constant: incoming.constant ?? current.constant,
    };

    if (toComparable(after) === toComparable(current)) {
      diff.unchanged++;
      continue;
    }

    const conflictLanguages = Object.entries(incoming.translations)
      .filter(([code, text]) => {
        const prev = current.translations[code];
        return Boolean(prev) && Boolean(text) && prev !== text;
      })
      .map(([code]) => code)
      .sort();

    const update: GlossaryImportUpdate = {
      termId: current.id,
      source: current.source,
      before: {
        source: current.source,
        translations: current.translations,
        notes: current.notes,
        constant: current.constant,
      },
      after,
      conflictLanguages,
    };
    if (conflictLanguages.length > 0) diff.conflicts.push(update);
    else diff.updated.push(update);
  }

  return diff;
}
