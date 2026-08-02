/**
 * Related-entry grouping + batch packing, shared by every chunked LLM batch
 * operation (M9 translate, M25 judge, M26 source review).
 *
 * Replaces the old "word-similarity ordering then fixed-window chunking" with
 * explicit grouping: entries that share a glossary and/or category land in the
 * same batch, so the LLM sees related strings together. The word-similarity sort
 * still exists, but only as a UI display sort — it no longer drives batching.
 *
 * Everything here is pure and deterministic (no time, no I/O, no randomness):
 * group order is first-seen, members keep their input order.
 */
import { chunkArray } from '../chunk.js';
import type { BatchGroupingDimension } from '../types/project.js';

/** Subset of {@link StringEntry} needed to derive a grouping footprint. */
export interface GroupableEntry {
  categories?: readonly string[];
  assignedGlossaryIds?: readonly string[];
  metadata?: { tone?: string };
}

/** Deduped, sorted member list of one axis (stable, order-independent). */
function footprint(values: readonly string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  return [...new Set(values)].sort();
}

/**
 * The exact-set grouping key for an entry under `dim`. Two entries share a batch
 * iff their keys are equal. Exact-set (not union-find) deliberately prevents one
 * broad category from transitively merging the whole project into one group.
 *
 *  - `none`     → `''` for every entry (a single group, i.e. plain chunking).
 *  - `category` → exact `categories` set.
 *  - `glossary` → exact `assignedGlossaryIds` set.
 *  - `both`     → the exact (categories, glossaries) pair.
 *
 * Keys are `JSON.stringify`d arrays, so a member containing a separator-like
 * character (e.g. `categories: ['a,b']`) can never collide with a different set
 * (`['a','b']`). Entries with an empty footprint share the empty-array key, so
 * they collapse into one "miscellaneous" group rather than exploding into
 * singletons.
 */
export function batchGroupKey(e: GroupableEntry, dim: BatchGroupingDimension): string {
  switch (dim) {
    case 'none':
      return '';
    case 'category':
      return JSON.stringify(footprint(e.categories));
    case 'glossary':
      return JSON.stringify(footprint(e.assignedGlossaryIds));
    case 'both':
      return JSON.stringify([footprint(e.categories), footprint(e.assignedGlossaryIds)]);
    case 'tone':
      return e.metadata?.tone ?? '';
  }
}

/**
 * Bucket items by `keyOf`, preserving first-seen order for both buckets and the
 * items within them. Empty buckets never appear.
 */
export function groupByKey<T>(items: readonly T[], keyOf: (item: T) => string): T[][] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return [...buckets.values()];
}

/**
 * Pack already-grouped items into batches.
 *
 * Guarantees (the whole point of grouping):
 *  - A group is NEVER split across batches **unless** it alone exceeds `cap`
 *    (and `ignoreSizeLimit` is off).
 *  - With `ignoreSizeLimit`, every group is emitted as exactly one batch,
 *    regardless of size, and never merged with another group ("complete group
 *    batch").
 *
 * When `ignoreSizeLimit` is off, small groups are merged greedily up to `cap`
 * (related entries within each contributing group stay contiguous and intact),
 * and only an oversized group is split — into cap-sized chunks that contain only
 * that group. This keeps batches full (fewer LLM calls) without ever tearing a
 * group apart.
 *
 * @param cap maximum items per batch; must be >= 1 (ignored when `ignoreSizeLimit`).
 */
export function packGroups<T>(
  groups: readonly T[][],
  cap: number,
  ignoreSizeLimit: boolean,
): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  const flush = (): void => {
    if (current.length) {
      out.push(current);
      current = [];
    }
  };

  for (const group of groups) {
    if (group.length === 0) continue;
    if (ignoreSizeLimit) {
      // Whole group as one batch; never merged with neighbours.
      flush();
      out.push([...group]);
      continue;
    }
    if (group.length >= cap) {
      // Oversized: isolate, then split into cap-sized chunks of this group only.
      flush();
      for (const chunk of chunkArray(group, cap)) out.push(chunk);
      continue;
    }
    if (current.length + group.length > cap) flush();
    current.push(...group);
  }
  flush();
  return out;
}

/**
 * Group `items` by their related-entry footprint and pack the groups into
 * batches. Convenience wrapper over {@link groupByKey} + {@link packGroups}.
 *
 * `keyOf` returns the grouping key for an item — typically
 * `(item) => batchGroupKey(entryOf(item), dimension)`. With `dimension === 'none'`
 * every key is `''`, so this degrades to plain `cap`-sized chunking in input order.
 */
export function groupAndPack<T>(
  items: readonly T[],
  cap: number,
  ignoreSizeLimit: boolean,
  keyOf: (item: T) => string,
): T[][] {
  return packGroups(groupByKey(items, keyOf), cap, ignoreSizeLimit);
}
