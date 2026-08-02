/**
 * Per-project orphan-id state (in-memory).
 *
 * Orphan IDs are tracked per project. They are populated by the CSV import
 * pipeline (via `setOrphanIds`) and cleared once each orphan is deleted or
 * relinked (via `removeOrphanId`). The orphans route reads them back with
 * `getOrphanIds`.
 *
 * This state lives in a neutral lower-layer module so both the import pipeline
 * (a service) and the orphans route can depend on it downward — neither reaches
 * into the other. The data shape, per-project keying and lifecycle are
 * unchanged from when this state lived on the orphans route module.
 */
const orphanIdsByProject = new Map<string, Set<string>>();

export function setOrphanIds(projectId: string, ids: string[]): void {
  orphanIdsByProject.set(projectId, new Set(ids));
}

export function getOrphanIds(projectId: string): string[] {
  return Array.from(orphanIdsByProject.get(projectId) ?? []);
}

export function removeOrphanId(projectId: string, id: string): void {
  const set = orphanIdsByProject.get(projectId);
  if (set) set.delete(id);
}
