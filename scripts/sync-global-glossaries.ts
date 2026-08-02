#!/usr/bin/env tsx
/**
 * sync-global-glossaries CLI
 *
 * Fetches the public community "GI: MW Glossary / Common Translation Sheet"
 * (Google Sheets) and merges new or updated entries into the bundled global
 * glossary JSON files under packages/server/src/data/global-glossaries/.
 *
 * Usage:
 *   pnpm exec tsx scripts/sync-global-glossaries.ts [--dry-run]
 *   make sync-glossaries [FLAGS=--dry-run]
 *
 * Behavior:
 * - Dev-time tool: it edits the source JSONs; local and cloud deployments
 *   pick the data up through the normal build/publish pipeline.
 * - Merge semantics: adds new sources, updates changed non-empty
 *   translations (sheet wins), NEVER deletes terms or stored translations.
 *   Terms missing from the sheet and unclassifiable Main Sheet tags are
 *   reported in the summary, never fatal.
 * - Idempotent: a second run immediately after a sync is a no-op.
 * - All-or-nothing: nothing is written unless every tab fetches and parses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const SHEET_ID = '1-KqhQMcI6wydUwjqYPFsg-rMYYfiOejHgWDWNHQc3zE';
const EXPORT_BASE = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const OUT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../packages/server/src/data/global-glossaries',
);

interface TabSpec {
  gid: string;
  label: string;
  /** Direct target glossary id, or null for the Main Sheet (routed per-row). */
  bucket: string | null;
}

const TABS: TabSpec[] = [
  { gid: '0', label: 'Main Sheet', bucket: null },
  { gid: '121860046', label: 'Creation Sheet', bucket: 'genshin-creations' },
  { gid: '1275347411', label: 'Stage Default Text', bucket: 'genshin-default' },
  { gid: '1306937770', label: 'Common Phrases', bucket: 'genshin-phrases' },
];

/** Language header names (native names, in sheet column order) → BCP-47 codes. */
export const LANG_HEADER_MAP: Record<string, string> = {
  简体中文: 'zh-hans',
  繁體中文: 'zh-hant',
  한국어: 'ko',
  日本語: 'ja',
  Español: 'es',
  Français: 'fr',
  Русский: 'ru',
  ไทย: 'th',
  'Tiếng Việt': 'vi',
  Deutsch: 'de',
  'Bahasa Indonesia': 'id',
  Português: 'pt-br',
  Türkçe: 'tr',
  Italiano: 'it',
};

const KNOWN_LANG_CODES = new Set(Object.values(LANG_HEADER_MAP));
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type MiscBucket =
  | 'genshin-elements'
  | 'genshin-stats'
  | 'genshin-skills'
  | 'genshin-reactions'
  | 'genshin-nations'
  | 'genshin-ranks'
  | 'genshin-characters'
  | 'miliastra-terms';

const MISC_BUCKET_IDS: MiscBucket[] = [
  'genshin-elements',
  'genshin-stats',
  'genshin-skills',
  'genshin-reactions',
  'genshin-nations',
  'genshin-ranks',
  'genshin-characters',
  'miliastra-terms',
];

const ALL_BUCKET_IDS: string[] = [
  ...MISC_BUCKET_IDS,
  'genshin-creations',
  'genshin-default',
  'genshin-phrases',
];

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SheetTerm {
  source: string;
  translations: Record<string, string>;
}

export interface GlossaryTermJson {
  id: string;
  source: string;
  translations: Record<string, string>;
}

export interface GlossaryJson {
  id: string;
  name: string;
  readOnly: true;
  createdAt: number;
  updatedAt: number;
  terms: GlossaryTermJson[];
}

export interface MergeResult {
  glossary: GlossaryJson;
  /** Sources newly added from the sheet. */
  added: string[];
  /** Existing sources whose translations changed (sheet wins on non-empty cells). */
  updated: string[];
  /** Sources present in the stored JSON but absent from the sheet — kept, reported. */
  removedKept: string[];
  /** New sources skipped because their kebab id collides with an existing term. */
  idConflicts: string[];
  changed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse CSV content using a hand-rolled RFC-4180 parser.
 * Handles quoted cells with embedded commas/newlines, escaped quotes ("" →
 * "), a leading BOM, and CRLF line endings. Rows are keyed by the header row;
 * fully blank rows are dropped.
 */
export function parseCSV(csvContent: string): Array<Record<string, string>> {
  const content = csvContent.startsWith('﻿') ? csvContent.slice(1) : csvContent;

  const lines = content.split('\n');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const nextCh = line[i + 1];

      if (inQuotes) {
        if (ch === '"' && nextCh === '"') {
          currentCell += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          currentCell += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentCell);
          currentCell = '';
        } else if (ch !== '\r') {
          currentCell += ch;
        }
      }
    }

    if (inQuotes) {
      // Embedded newline inside a quoted cell: keep accumulating.
      currentCell += '\n';
      continue;
    }

    currentRow.push(currentCell);
    currentCell = '';
    if (currentRow.some((cell) => cell.trim())) {
      rows.push(currentRow);
    }
    currentRow = [];
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim())) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  const headers = rows[0];
  const result: Array<Record<string, string>> = [];
  for (let i = 1; i < rows.length; i++) {
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = rows[i][j] ?? '';
    }
    result.push(row);
  }
  return result;
}

/** Normalize a CSV cell: trim, strip `|`-separated plural variants, empty → undefined. */
export function normalizeCell(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return undefined;
  const [primary] = trimmed.split('|');
  const primaryTrimmed = primary.trim();
  return primaryTrimmed || undefined;
}

/**
 * Convert English text to a kebab-case id suffix.
 * Lowercases, removes apostrophes (Khaenri'ah → khaenriah), replaces other
 * non-alphanumerics with hyphens, trims hyphens.
 */
export function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Classify a Main Sheet tag (first column, header `EM` or `Notes`) into a
 * misc bucket. Returns null for unknown tags — the caller reports them;
 * a community sheet edit must never break the sync.
 */
export function classifyMiscTag(tag: string): MiscBucket | null {
  if (/ Element$/.test(tag) || /\(only prefix\)$/.test(tag)) {
    return 'genshin-elements';
  }

  if (
    /^Character stat,/.test(tag) ||
    /(DMG Bonus|RES)$/.test(tag) ||
    /^Elemental Mastery(,|$)/.test(tag) ||
    [
      'Elemental Mastery',
      'CRIT Rate',
      'CRIT DMG',
      'Healing Bonus',
      'Incoming Healing Bonus',
      'Energy Recharge',
      'CD Reduction',
      'Shield Strength',
    ].includes(tag)
  ) {
    return 'genshin-stats';
  }

  if (
    /^Elemental Aura/.test(tag) ||
    ['Normal Attack', 'Elemental Skill', 'Elemental Burst', 'Skill'].includes(tag)
  ) {
    return 'genshin-skills';
  }

  if (
    /^Elemental Reactions$/.test(tag) ||
    /, Elemental Reaction$/.test(tag) ||
    /^Lunar Reaction/.test(tag) ||
    /^Moonsign,/.test(tag) ||
    /^Hexerei,/.test(tag)
  ) {
    return 'genshin-reactions';
  }

  if (/, (former )?(nation|area)/i.test(tag) || /^Teyvat,/.test(tag)) {
    return 'genshin-nations';
  }

  if (/, rank$/.test(tag)) {
    return 'genshin-ranks';
  }

  if (/character in GI/.test(tag) || /, their "given name"$/.test(tag)) {
    return 'genshin-characters';
  }

  if (
    /^MW'?s /.test(tag) ||
    /^Manekins?/.test(tag) ||
    /^(Male|Female) Manekin/.test(tag) ||
    /^Craftsperson,/.test(tag) ||
    /^Stage,/.test(tag) ||
    /^Base game name,/.test(tag)
  ) {
    return 'miliastra-terms';
  }

  return null;
}

/** Build a SheetTerm from a header-keyed row, or null when English is empty. */
export function extractTerm(row: Record<string, string>): SheetTerm | null {
  const source = normalizeCell(row['English']);
  if (!source) return null;

  const translations: Record<string, string> = {};
  for (const [header, code] of Object.entries(LANG_HEADER_MAP)) {
    const val = normalizeCell(row[header]);
    if (val) translations[code] = val;
  }
  return { source, translations };
}

/** Terms for a direct (non-Main-Sheet) tab, applying the historical special cases. */
export function buildBucketTerms(
  bucket: string,
  rows: Array<Record<string, string>>,
): { terms: SheetTerm[]; skippedEmptySource: number } {
  const terms: SheetTerm[] = [];
  let skippedEmptySource = 0;

  for (const row of rows) {
    const term = extractTerm(row);
    if (!term) {
      skippedEmptySource++;
      continue;
    }
    // Historical dedup rule: "Prismatic Crystal" also lives in the Main Sheet.
    if (bucket === 'genshin-phrases' && term.source === 'Prismatic Crystal') continue;
    terms.push(term);
  }
  return { terms, skippedEmptySource };
}

/** Route Main Sheet rows into misc buckets by their tag column. */
export function routeMiscRows(
  rows: Array<Record<string, string>>,
  tagKey: 'EM' | 'Notes',
): {
  byBucket: Map<MiscBucket, SheetTerm[]>;
  unclassified: Array<{ tag: string; source: string }>;
  skippedEmptySource: number;
} {
  const byBucket = new Map<MiscBucket, SheetTerm[]>(MISC_BUCKET_IDS.map((id) => [id, []]));
  const unclassified: Array<{ tag: string; source: string }> = [];
  let skippedEmptySource = 0;

  for (const row of rows) {
    const term = extractTerm(row);
    if (!term) {
      skippedEmptySource++;
      continue;
    }
    const tag = normalizeCell(row[tagKey]) ?? '';
    const bucket = tag ? classifyMiscTag(tag) : null;
    if (!bucket) {
      unclassified.push({ tag, source: term.source });
      continue;
    }
    byBucket.get(bucket)!.push(term);
  }
  return { byBucket, unclassified, skippedEmptySource };
}

/**
 * Merge sheet terms into an existing glossary.
 * - dedupes incoming by source (keep first);
 * - new source → new term id `<glossary-id>-<kebab(source)>` (skipped +
 *   reported if that id already belongs to a different term);
 * - existing source → non-empty sheet cells overwrite stored translations;
 *   empty cells never delete;
 * - stored terms absent from the sheet are kept and reported;
 * - terms are re-sorted by id; `updatedAt` is bumped to `now` only when
 *   content actually changed.
 */
export function mergeGlossary(
  existing: GlossaryJson,
  incoming: SheetTerm[],
  now: number,
): MergeResult {
  const terms: GlossaryTermJson[] = existing.terms.map((t) => ({
    id: t.id,
    source: t.source,
    translations: { ...t.translations },
  }));
  const bySource = new Map(terms.map((t) => [t.source, t]));
  const usedIds = new Set(terms.map((t) => t.id));

  const seenSources = new Set<string>();
  const added: string[] = [];
  const updated: string[] = [];
  const idConflicts: string[] = [];

  for (const inc of incoming) {
    if (seenSources.has(inc.source)) continue;
    seenSources.add(inc.source);

    const existingTerm = bySource.get(inc.source);
    if (existingTerm) {
      let termChanged = false;
      for (const [code, val] of Object.entries(inc.translations)) {
        if (val && existingTerm.translations[code] !== val) {
          existingTerm.translations[code] = val;
          termChanged = true;
        }
      }
      if (termChanged) updated.push(inc.source);
    } else {
      const kebabSource = kebab(inc.source);
      if (kebabSource === '') {
        idConflicts.push(inc.source);
        continue;
      }
      const id = `${existing.id}-${kebabSource}`;
      if (usedIds.has(id)) {
        idConflicts.push(inc.source);
        continue;
      }
      const term: GlossaryTermJson = {
        id,
        source: inc.source,
        translations: { ...inc.translations },
      };
      terms.push(term);
      bySource.set(term.source, term);
      usedIds.add(id);
      added.push(inc.source);
    }
  }

  const removedKept = existing.terms
    .filter((t) => !seenSources.has(t.source))
    .map((t) => t.source);

  terms.sort((a, b) => a.id.localeCompare(b.id));

  const changed = added.length > 0 || updated.length > 0;
  return {
    glossary: {
      id: existing.id,
      name: existing.name,
      readOnly: true,
      createdAt: existing.createdAt,
      updatedAt: changed ? now : existing.updatedAt,
      terms,
    },
    added,
    updated,
    removedKept,
    idConflicts,
    changed,
  };
}

/** Validate the glossary-template.schema.json shape. Returns human-readable errors. */
export function validateGlossary(g: GlossaryJson): string[] {
  const errors: string[] = [];
  if (!ID_RE.test(g.id)) errors.push(`invalid glossary id: "${g.id}"`);
  if (!g.name) errors.push(`${g.id}: empty glossary name`);
  if (g.readOnly !== true) errors.push(`${g.id}: readOnly must be true`);
  if (!Number.isFinite(g.createdAt) || !Number.isFinite(g.updatedAt)) {
    errors.push(`${g.id}: invalid timestamps`);
  }
  const seenIds = new Set<string>();
  for (const t of g.terms) {
    if (!ID_RE.test(t.id) || !t.id.startsWith(`${g.id}-`)) {
      errors.push(`${g.id}: invalid term id "${t.id}"`);
    }
    if (seenIds.has(t.id)) errors.push(`${g.id}: duplicate term id "${t.id}"`);
    seenIds.add(t.id);
    if (!t.source.trim()) errors.push(`${g.id}: empty source for term "${t.id}"`);
    for (const [code, val] of Object.entries(t.translations)) {
      if (!KNOWN_LANG_CODES.has(code)) {
        errors.push(`${g.id}: unknown lang code "${code}" in "${t.id}"`);
      }
      if (!val.trim()) errors.push(`${g.id}: empty "${code}" translation in "${t.id}"`);
    }
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH + MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function fetchTabCsv(gid: string, label: string): Promise<string> {
  const url = `${EXPORT_BASE}&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Fetch failed for tab "${label}" (gid=${gid}): HTTP ${res.status}`);
  }
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html') || text.trimStart().startsWith('<')) {
    throw new Error(
      `Tab "${label}" (gid=${gid}) returned HTML instead of CSV — is the sheet still public?`,
    );
  }
  return text;
}

function requireHeaders(rows: Array<Record<string, string>>, label: string): string[] {
  if (rows.length === 0) throw new Error(`Tab "${label}": no data rows`);
  const headers = Object.keys(rows[0]);
  if (!headers.includes('English')) {
    throw new Error(`Tab "${label}": missing required "English" column`);
  }
  return headers;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Syncing global glossaries from sheet ${SHEET_ID}${dryRun ? ' (dry run)' : ''}\n`);

  // All-or-nothing: fetch and parse every tab before any write.
  const tabRows = new Map<string, Array<Record<string, string>>>();
  for (const tab of TABS) {
    const csv = await fetchTabCsv(tab.gid, tab.label);
    const rows = parseCSV(csv);
    requireHeaders(rows, tab.label);
    tabRows.set(tab.label, rows);
    console.log(`  fetched ${tab.label}: ${rows.length} rows`);
  }

  // Build incoming terms per glossary.
  const incoming = new Map<string, SheetTerm[]>();
  let skippedEmpty = 0;

  for (const tab of TABS) {
    const rows = tabRows.get(tab.label)!;
    if (tab.bucket) {
      const { terms, skippedEmptySource } = buildBucketTerms(tab.bucket, rows);
      incoming.set(tab.bucket, terms);
      skippedEmpty += skippedEmptySource;
    }
  }

  const miscRows = tabRows.get('Main Sheet')!;
  const miscHeaders = Object.keys(miscRows[0]);
  const tagKey: 'EM' | 'Notes' = miscHeaders.includes('EM') ? 'EM' : 'Notes';
  if (!miscHeaders.includes(tagKey)) {
    throw new Error(`Main Sheet: missing tag column (expected "EM" or "Notes")`);
  }
  const routed = routeMiscRows(miscRows, tagKey);
  skippedEmpty += routed.skippedEmptySource;
  for (const [bucket, terms] of routed.byBucket) {
    incoming.set(bucket, terms);
  }

  // Merge into the existing JSON files. Writes are deferred until every
  // glossary validates, so a validation failure writes NOTHING (all-or-nothing).
  const now = Date.now();
  const results: MergeResult[] = [];
  const validationErrors: string[] = [];
  const pendingWrites: Array<{ filePath: string; json: string }> = [];

  for (const bucketId of ALL_BUCKET_IDS) {
    const filePath = path.join(OUT_DIR, `${bucketId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `Missing glossary file ${filePath} — new glossaries need a registry entry in ` +
          `packages/server/src/data/global-glossaries/index.ts and are out of scope for this sync.`,
      );
    }
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as GlossaryJson;
    const result = mergeGlossary(existing, incoming.get(bucketId) ?? [], now);
    validationErrors.push(...validateGlossary(result.glossary));
    results.push(result);

    if (result.changed) {
      pendingWrites.push({ filePath, json: JSON.stringify(result.glossary, null, 2) + '\n' });
    }
  }

  if (validationErrors.length > 0) {
    console.error('\nValidation failed — nothing written:');
    for (const err of validationErrors) console.error(`  ✗ ${err}`);
    process.exit(1);
  }

  if (!dryRun) {
    for (const w of pendingWrites) fs.writeFileSync(w.filePath, w.json);
  }

  // Summary.
  console.log('\nSummary:');
  for (const r of results) {
    const marker = r.changed ? (dryRun ? '~ (dry run)' : '✓ written') : '· unchanged';
    console.log(
      `  ${r.glossary.id.padEnd(22)} +${r.added.length} added, ~${r.updated.length} updated, ` +
        `${r.removedKept.length} kept-not-in-sheet  ${marker}`,
    );
    for (const s of r.added) console.log(`      + ${s}`);
    for (const s of r.updated) console.log(`      ~ ${s}`);
    for (const s of r.idConflicts) console.log(`      ! id conflict, skipped: ${s}`);
  }
  const keptTotal = results.reduce((n, r) => n + r.removedKept.length, 0);
  if (keptTotal > 0) {
    console.log(`\nKept ${keptTotal} stored term(s) that are no longer in the sheet:`);
    for (const r of results) {
      for (const s of r.removedKept) console.log(`  - [${r.glossary.id}] ${s}`);
    }
  }
  if (routed.unclassified.length > 0) {
    console.log(
      `\n${routed.unclassified.length} Main Sheet row(s) with unclassified tags were skipped ` +
        `(add a rule to classifyMiscTag() to include them):`,
    );
    for (const u of routed.unclassified) console.log(`  ? "${u.tag}" — ${u.source}`);
  }
  if (skippedEmpty > 0) console.log(`\nSkipped ${skippedEmpty} row(s) with an empty English column.`);
  console.log('\nDone.');
}

// Only run as a CLI (the test suite imports the pure functions above).
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err: unknown) => {
    console.error(`\n❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
