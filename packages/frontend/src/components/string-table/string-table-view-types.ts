/**
 * Shared types, constants, and pure helpers for the String table view,
 * extracted from StringTable.tsx so the orchestrator component and its
 * presentational sub-components (pagination bar, grid, bulk bar) can share them
 * without duplication. Pure — no React, no state, no side effects (the one
 * function here is a plain async concurrency bound).
 */
import type { CellSelection } from './StringTableRow.js';

export type Selection = CellSelection | null;

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
export const HEADER_HEIGHT = 52;
export const LOADING_SKELETON_ROWS = 6;
// Bound for bulk ops whose per-entry patch genuinely varies (e.g. bulk
// add/remove category, which merges into each entry's own existing category
// list) and so can't be collapsed into one `bulkUpdate` PATCH. Caps in-flight
// PUTs instead of firing an unbounded `Promise.all` over the whole selection.
export const BULK_PER_ENTRY_CONCURRENCY = 8;

/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 * A small, in-file concurrency bound for the per-entry bulk handlers below —
 * not a replacement for `bulkUpdate` (used instead wherever every item shares
 * one identical patch).
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}
