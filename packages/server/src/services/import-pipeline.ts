import { csvImporter, type ImportDiff } from '../modules/M2-csv-importer.js';
import { getGlobalConfigStore, getProjectStore, getStringStore } from '../storage/registry.js';
import { languageConfig } from '../modules/M4-language-config.js';
import { orphanManager } from '../modules/M11-orphan-manager.js';
import { assignGlossaryIds } from '../modules/M20-glossary-assigner.js';
import { setOrphanIds } from '../modules/orphan-id-store.js';
import { logger } from '../modules/M15-console-logger.js';
import { createSnapshot } from '../modules/auto-snapshot.js';
import { DEFAULT_OVERFLOW_RATIO } from '@zercade-dev/narn-shared';

/** Compact, JSON-friendly counts derived from an {@link ImportDiff}. */
export interface ImportDiffSummary {
  new: number;
  changed: number;
  removed: number;
}

/** How a CSV import treats entries missing from the file. */
export type ImportMode = 'add-only' | 'full-replace';

export interface ImportPipelineResult {
  imported: number;
  diff: ImportDiffSummary;
  orphans: number;
  unrecognizedHeaders: string[];
  duplicateLanguageHeaders: string[];
  skippedRows: number;
  /** Rows dropped for mis-splitting on the CSV dialect's quote ambiguity. */
  malformedRows: number;
  ghostsBlocked: number;
  glossariesSkipped: number;
  /**
   * Languages auto-activated because their CSV column carried translations but
   * they were not yet active on the project. On dry runs this reports what
   * WOULD be activated (nothing is written).
   */
  activatedLanguages: string[];
  /**
   * Language codes (LANGUAGE_REGISTRY order) with at least one cell
   * containing a raw newline byte in a language-mapped column. Advisory only
   * — present on both dry-run and real-run results.
   */
  rawNewlineLanguages: string[];
  /** Pre-import safety snapshot; absent on dry runs (nothing is written). */
  snapshot?: { id: string; createdAt: string };
  /** Mode this pipeline ran (or, on dry runs, would run) under. */
  mode: ImportMode;
}

function summarizeDiff(diff: ImportDiff): ImportDiffSummary {
  return {
    new: diff.newEntries.length,
    changed: diff.changed.length,
    removed: diff.removed.length,
  };
}

/**
 * Single code path for the CSV import pipeline, used by the manual upload
 * route (`POST /:id/import`):
 *
 * importCSV → assignGlossaryIds → bulkUpsert → orphan detection.
 *
 * With `dryRun: true` nothing is written: the CSV is parsed and diffed against
 * the current store, orphans are counted, and the result is returned for
 * preview.
 */
export async function runImportPipeline(
  projectId: string,
  csvContent: string,
  opts?: { dryRun?: boolean; mode?: ImportMode },
): Promise<ImportPipelineResult> {
  const dryRun = opts?.dryRun === true;
  const mode: ImportMode = opts?.mode ?? 'add-only';

  const previousEntries = await getStringStore().load(projectId);
  const globalSettings = await getGlobalConfigStore()
    .getSettings()
    .catch(() => ({}));
  const defaultOverflowRatio =
    (globalSettings as { overflowRatio?: number }).overflowRatio ?? DEFAULT_OVERFLOW_RATIO;

  const {
    entries,
    diff,
    unrecognizedHeaders,
    duplicateLanguageHeaders,
    skippedRows,
    malformedRows,
    languagesWithData,
    rawNewlineLanguages,
  } = await csvImporter.importCSV(csvContent, projectId, { defaultOverflowRatio });

  const orphans = orphanManager.detectOrphans(diff, previousEntries);

  // Languages whose column carries translations but are not active yet —
  // activated on apply so the imported data is immediately visible.
  const project = await getProjectStore().loadProject(projectId);
  const activeSet = new Set(project.activeLanguages);
  const activatedLanguages = languagesWithData.filter(
    (code) => !activeSet.has(code) && code !== project.sourceLanguage,
  );

  if (dryRun) {
    return {
      imported: entries.length,
      diff: summarizeDiff(diff),
      orphans: mode === 'full-replace' ? orphans.length : 0,
      unrecognizedHeaders,
      duplicateLanguageHeaders,
      skippedRows,
      malformedRows,
      ghostsBlocked: 0,
      glossariesSkipped: 0,
      activatedLanguages,
      rawNewlineLanguages,
      mode,
    };
  }

  // Automatic safety snapshot (pre-import): taken BEFORE any store write so a
  // bad CSV can be rolled back from the Backup tab. Awaited deliberately — the
  // snapshot must be fully persisted (the PG backup row) before the first write;
  // never race them.
  const snapshot = await createSnapshot(projectId, 'pre-import');

  // Auto-assign applicable glossaries to each entry based on source text matching
  const { glossariesSkipped } = await assignGlossaryIds(projectId, entries);
  const { ghostsBlocked } = await getStringStore().bulkUpsert(projectId, entries);

  // Full replace: soft-delete entries missing from the file by stamping
  // orphanedAt, and surface them in the Relink tab via the in-memory list.
  // Add-only never orphans: entries missing from the file stay fully live
  // and visible; clear any stale in-memory list instead.
  if (mode === 'full-replace') {
    if (diff.removed.length > 0) {
      await getStringStore().markOrphaned(projectId, diff.removed, Date.now());
    }
    setOrphanIds(
      projectId,
      orphans.map((o) => o.id),
    );
  } else {
    setOrphanIds(projectId, []);
  }

  if (activatedLanguages.length > 0) {
    await languageConfig.setActiveLanguages(projectId, [
      ...project.activeLanguages,
      ...activatedLanguages,
    ]);
  }

  logger.info('CSV imported', {
    projectId,
    total: entries.length,
    newCount: diff.newEntries.length,
    removed: diff.removed.length,
    orphans: orphans.length,
    skippedRows,
    malformedRows,
    ghostsBlocked,
    glossariesSkipped,
    activatedLanguages,
    mode,
  });

  return {
    imported: entries.length,
    diff: summarizeDiff(diff),
    orphans: mode === 'full-replace' ? orphans.length : 0,
    unrecognizedHeaders,
    duplicateLanguageHeaders,
    skippedRows,
    malformedRows,
    ghostsBlocked,
    glossariesSkipped,
    activatedLanguages,
    rawNewlineLanguages,
    snapshot: { id: snapshot.id, createdAt: snapshot.createdAt },
    mode,
  };
}
