/**
 * The orphans tour's practice orphan: one entry removed from the table by a
 * re-import and put back the same way, so the person sees a real orphan
 * without losing anything.
 *
 * Why a re-import is reversible (a server round-trip test holds the import
 * route to each of these):
 * - A main entry's id hashes its source text, so a file of source texts
 *   rebuilds the same ids.
 * - A full replace marks every main entry missing from the file as orphaned
 *   (`orphanedAt`) and keeps it, translations and all.
 * - Re-importing an orphaned id (either mode) clears `orphanedAt` and keeps its
 *   translations. The file carries no translations, so no other entry's
 *   translations or review state change, and translation memory is not touched.
 *
 * Accepted side effects of the two imports: two automatic pre-import
 * snapshots; `sortIndex` renumbered from row position (rows after the removed
 * one shift by one until the recovery restores them); `assignedGlossaryIds`
 * recomputed as on any import; entries that were already orphans get a fresh
 * `orphanedAt` on the full replace.
 *
 * Every import is checked first with a dry run: when the file would add a
 * new entry or skip a row, the ids did not rebuild and nothing is written.
 */
import {
  buildCsvColumnMap,
  entryCollection,
  isRoundTripUnsafe,
  LANGUAGE_REGISTRY,
  serializeGameCSV,
  type OrphanEntry,
  type Project,
  type StringEntry,
} from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { useGuideStore, type OrphanSim } from '../../stores/guide-store.js';
import { ORPHANS_TOUR_ID } from './orphans-tour.js';
import { useProjectStore, type ProjectAccessInfo } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';

export type SimBlocker =
  'no-entries' | 'collaborator' | 'sourceless-rows' | 'unsafe-text' | 'comma-in-source-label';

/** Fired after the practice orphan was created or put back, so the Orphans tab reloads. */
export const ORPHANS_CHANGED_EVENT = 'guide:orphans-changed';

const SOURCE_HEADER = 'Source';
const NEEDS_TRANSLATION_HEADER = 'Need translation?';

function liveMainEntries(entries: StringEntry[]): StringEntry[] {
  return entries
    .filter((e) => entryCollection(e) === 'main' && e.orphanedAt == null)
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
}

/** Main, non-orphaned entries in sortIndex order; the target is the first with sourceText and needsTranslation !== false. */
export function pickPracticeEntry(
  entries: StringEntry[],
): { entry: StringEntry; position: number } | null {
  const main = liveMainEntries(entries);
  const position = main.findIndex((e) => e.sourceText !== '' && e.needsTranslation !== false);
  return position === -1 ? null : { entry: main[position], position };
}

/**
 * A `sources` label survives the Source column when the importer's split
 * (on commas, trimmed, empties dropped) gives it back unchanged.
 */
function labelRoundTrips(label: string): boolean {
  return (
    label !== '' && !label.includes(',') && label.trim() === label && !isRoundTripUnsafe(label)
  );
}

/**
 * Why the practice orphan cannot be offered, or null when it can. Every main
 * entry must come back with the same id and fields from a file of source
 * texts: a sourceless row's id hashes its whole original row, text with a
 * quote before a delimiter mis-splits, and a label with a comma splits in two.
 */
export function simulationBlocker(
  entries: StringEntry[],
  access: ProjectAccessInfo,
): SimBlocker | null {
  if (access.role === 'collaborator') return 'collaborator';
  if (pickPracticeEntry(entries) === null) return 'no-entries';
  return rowsBlocker(liveMainEntries(entries));
}

/**
 * Why an import file of these rows would not give every one of them back
 * unchanged (id, source text and labels), or null when it would.
 */
function rowsBlocker(
  rows: StringEntry[],
): Exclude<SimBlocker, 'collaborator' | 'no-entries'> | null {
  if (rows.some((e) => e.sourceText === '')) return 'sourceless-rows';
  if (rows.some((e) => isRoundTripUnsafe(e.sourceText))) return 'unsafe-text';
  if (rows.some((e) => (e.sources ?? []).some((label) => !labelRoundTrips(label)))) {
    return 'comma-in-source-label';
  }
  return null;
}

/**
 * The header the importer reads as the project's source language: the
 * registry name, as the export writes it, or else the code.
 */
function sourceLanguageHeader(project: Project): string {
  const name = LANGUAGE_REGISTRY.find((l) => l.code === project.sourceLanguage)?.name;
  for (const header of [name, project.sourceLanguage]) {
    if (header === undefined || header === SOURCE_HEADER) continue;
    if (buildCsvColumnMap([header]).colToCode.get(header) === project.sourceLanguage) return header;
  }
  throw new Error(`No CSV column for source language ${project.sourceLanguage}`);
}

/** Game-dialect CSV, headers ['Source','Need translation?', <registry name of project.sourceLanguage>], formulaGuard 'reimport-safe'. */
export function buildImportCsv(project: Project, rows: StringEntry[]): string {
  const sourceHeader = sourceLanguageHeader(project);
  return serializeGameCSV(
    [SOURCE_HEADER, NEEDS_TRANSLATION_HEADER, sourceHeader],
    rows.map((e) => ({
      [SOURCE_HEADER]: (e.sources ?? []).join(', '),
      [NEEDS_TRANSLATION_HEADER]: e.needsTranslation === false ? 'FALSE' : 'TRUE',
      [sourceHeader]: e.sourceText,
    })),
    { formulaGuard: 'reimport-safe' },
  );
}

export interface ImportResultSummary {
  imported: number;
  diff: { new: number; changed: number; removed: number };
  orphans: number;
  skippedRows?: number;
  malformedRows?: number;
  mode?: 'add-only' | 'full-replace';
}

/** `POST /projects/:id/import`, multipart, exactly as the Data tab sends it. */
export async function postImport(
  projectId: string,
  csv: string,
  mode: 'add-only' | 'full-replace',
  opts: { dryRun?: boolean } = {},
): Promise<ImportResultSummary> {
  const form = new FormData();
  form.append('file', new File([csv], 'orphans-tour-practice.csv', { type: 'text/csv' }));
  form.append('mode', mode);
  if (opts.dryRun) form.append('dryRun', 'true');
  return apiRequest<ImportResultSummary>(`/projects/${projectId}/import`, {
    method: 'POST',
    body: form,
  });
}

/** A dry run found that the file would not rebuild the entries; nothing was written. */
export class PracticeImportCheckError extends Error {
  constructor() {
    super('The practice import would not rebuild the entries; nothing was changed.');
    this.name = 'PracticeImportCheckError';
  }
}

/**
 * The automatic put-back was refused, with nothing changed: the entries changed
 * since the practice orphan was created so that a re-import would alter one
 * (a label with a comma, say), or the dry run did not map every row. Trying
 * again keeps failing; the person relinks the orphan or restores the backup.
 */
export class PracticeRecoverRefusedError extends Error {
  constructor() {
    super('The practice orphan cannot be put back automatically; nothing was changed.');
    this.name = 'PracticeRecoverRefusedError';
  }
}

/** Imports `rows` in `mode` after a dry run confirms every row maps onto an existing entry. */
async function checkedImport(
  projectId: string,
  csv: string,
  rowCount: number,
  mode: 'add-only' | 'full-replace',
): Promise<void> {
  const dry = await postImport(projectId, csv, mode, { dryRun: true });
  if (dry.diff.new !== 0 || dry.imported !== rowCount) throw new PracticeImportCheckError();
  await postImport(projectId, csv, mode);
}

function projectFor(projectId: string): Project {
  const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
  if (!project) throw new Error(`Unknown project ${projectId}`);
  return project;
}

function afterChange(projectId: string): void {
  globalThis.dispatchEvent(new CustomEvent(ORPHANS_CHANGED_EVENT, { detail: projectId }));
  if (useProjectStore.getState().activeProjectId === projectId) {
    void Promise.resolve(useStringStore.getState().fetchEntries(projectId)).catch(() => {});
  }
}

/** Where the practice entry is now. */
export type PracticeState = 'orphaned' | 'live' | 'absent';

export async function loadPracticeState(sim: OrphanSim): Promise<{
  state: PracticeState;
  live: StringEntry[];
  orphan: OrphanEntry | undefined;
}> {
  const [live, orphans] = await Promise.all([
    apiRequest<StringEntry[]>(`/projects/${sim.projectId}/strings`),
    apiRequest<OrphanEntry[]>(`/projects/${sim.projectId}/orphans`),
  ]);
  const orphan = orphans.find((o) => o.id === sim.entryId);
  const state: PracticeState = orphan
    ? 'orphaned'
    : live.some((e) => e.id === sim.entryId)
      ? 'live'
      : 'absent';
  return { state, live, orphan };
}

/** The Orphans tour ended while the practice was being prepared; nothing was changed. */
export class PracticeTourEndedError extends Error {
  constructor() {
    super('The Orphans tour ended before the practice entry was removed; nothing was changed.');
    this.name = 'PracticeTourEndedError';
  }
}

/**
 * Removes the practice entry with a full-replace import of every other live
 * main entry. `orphanSim` is saved before the import, so the entry can be put
 * back even if the page closes mid-way. Throws (with nothing changed) when the
 * project cannot round-trip, or when the Orphans tour is no longer the active
 * tour by the time the import would start.
 */
export async function simulateOrphan(
  projectId: string,
  access: ProjectAccessInfo,
  backupId: string | null,
): Promise<OrphanSim> {
  const project = projectFor(projectId);
  const live = await apiRequest<StringEntry[]>(`/projects/${projectId}/strings`);
  const blocker = simulationBlocker(live, access);
  const pick = pickPracticeEntry(live);
  if (blocker !== null || pick === null) throw new PracticeImportCheckError();
  const rows = liveMainEntries(live).filter((e) => e.id !== pick.entry.id);
  const csv = buildImportCsv(project, rows);
  const dry = await postImport(projectId, csv, 'full-replace', { dryRun: true });
  if (dry.diff.new !== 0 || dry.imported !== rows.length) throw new PracticeImportCheckError();

  const sim: OrphanSim = { projectId, entryId: pick.entry.id, position: pick.position, backupId };
  const guide = useGuideStore.getState();
  // The checks above take a few requests: a tour closed (or replaced) in the
  // meantime must not leave an entry removed with nothing to put it back.
  if (guide.activeTourId !== ORPHANS_TOUR_ID) throw new PracticeTourEndedError();
  guide.setOrphanSim(sim);
  try {
    await postImport(projectId, csv, 'full-replace');
  } catch (err) {
    // The request may have failed after the server wrote: drop the handle
    // only when the entry is known not to be an orphan. When even that check
    // fails, it may be one, so the handle stays and it can still be put back.
    const now = await loadPracticeState(sim).catch(() => null);
    if (now?.state !== 'orphaned') {
      if (now !== null) useGuideStore.getState().clearOrphanSim();
      throw err;
    }
  }
  afterChange(projectId);
  return sim;
}

export type RecoverOutcome = 'recovered' | 'already-live' | 'absent';

/**
 * Puts the practice entry back where it was with an add-only import of the
 * live main entries plus the practice entry at its old position. Its
 * translations come back with it. Shared by the tour and the Orphans tab's
 * practice banner.
 */
export async function recoverPracticeOrphan(): Promise<RecoverOutcome> {
  const sim = useGuideStore.getState().orphanSim;
  if (!sim) return 'already-live';
  const { state, live, orphan } = await loadPracticeState(sim);
  if (state !== 'orphaned' || !orphan) {
    useGuideStore.getState().clearOrphanSim();
    return state === 'live' ? 'already-live' : 'absent';
  }
  const rows = liveMainEntries(live);
  rows.splice(Math.min(sim.position, rows.length), 0, orphan);
  // The entries may have changed since the simulation checked them: the same
  // checks again, so the put-back never rewrites another entry's labels.
  if (rowsBlocker(rows) !== null) throw new PracticeRecoverRefusedError();
  try {
    await checkedImport(
      sim.projectId,
      buildImportCsv(projectFor(sim.projectId), rows),
      rows.length,
      'add-only',
    );
  } catch (err) {
    throw err instanceof PracticeImportCheckError ? new PracticeRecoverRefusedError() : err;
  }
  useGuideStore.getState().clearOrphanSim();
  afterChange(sim.projectId);
  return 'recovered';
}
