/**
 * Achievement pairing: which entries may be linked to a given achievement
 * entry, in what order, and which PATCHes a link produces.
 *
 * Split out of the string-table row so the rules are unit-testable without
 * rendering, and so the row's Link button doesn't have to subscribe to the
 * whole entry list just to decide what to show (only the open dialog does).
 *
 * Both `null` and `undefined` mean "not tagged" for `achievementType` /
 * `achievementId` — every check here is falsy-based on purpose.
 */
import { isAchievementSource, type StringEntry } from '@zercade-dev/narn-shared';

export type AchievementType = 'name' | 'description';

export interface AchievementLinkPatch {
  entryId: string;
  patch: Partial<StringEntry>;
}

export function oppositeType(type: AchievementType): AchievementType {
  return type === 'name' ? 'description' : 'name';
}

/** |candidate.sortIndex - from|, or Infinity when either side has no index. */
function distance(candidate: StringEntry, from: number | undefined): number {
  if (from === undefined || candidate.sortIndex === undefined) return Number.POSITIVE_INFINITY;
  return Math.abs(candidate.sortIndex - from);
}

/**
 * Nearest-first by sortIndex distance, then by sortIndex, then by id.
 * Compared with `<`/`>` rather than subtraction: two index-less entries both
 * score Infinity, and `Infinity - Infinity` is NaN, which would corrupt the
 * sort.
 */
function compareCandidates(a: StringEntry, b: StringEntry, from: number | undefined): number {
  const da = distance(a, from);
  const db = distance(b, from);
  if (da !== db) return da < db ? -1 : 1;
  const sa = a.sortIndex ?? Number.POSITIVE_INFINITY;
  const sb = b.sortIndex ?? Number.POSITIVE_INFINITY;
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Entries that may be linked to `entry`: achievement-source, not itself, and
 * either the opposite type or not typed at all. Same-typed entries are never
 * offered. Already-linked entries ARE offered (the dialog renders them muted)
 * so a user can join an existing group.
 */
export function linkCandidates(entry: StringEntry, all: readonly StringEntry[]): StringEntry[] {
  const type = entry.achievementType;
  if (!type) return [];
  const opposite = oppositeType(type);
  return all
    .filter(
      (candidate) =>
        candidate.id !== entry.id &&
        isAchievementSource(candidate.sources) &&
        (!candidate.achievementType || candidate.achievementType === opposite),
    )
    .sort((a, b) => compareCandidates(a, b, entry.sortIndex));
}

function defaultMintKey(): string {
  return `ach-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * The PATCHes that link `entry` to `candidate`:
 *
 * - candidate already keyed  -> `entry` joins that group; candidate keeps its key
 * - candidate unkeyed, entry keyed -> candidate adopts the entry's key
 * - neither keyed            -> mint one key, write it to both
 *
 * Independently: an untyped candidate is also tagged with the opposite type.
 */
export function resolveLink(
  entry: StringEntry,
  candidate: StringEntry,
  mintKey: () => string = defaultMintKey,
): AchievementLinkPatch[] {
  const type = entry.achievementType;
  if (!type) return [];

  const typePatch: Partial<StringEntry> = candidate.achievementType
    ? {}
    : { achievementType: oppositeType(type) };

  if (candidate.achievementId) {
    const patches: AchievementLinkPatch[] = [
      { entryId: entry.id, patch: { achievementId: candidate.achievementId } },
    ];
    if (!candidate.achievementType) patches.push({ entryId: candidate.id, patch: typePatch });
    return patches;
  }

  const key = entry.achievementId ?? mintKey();
  const patches: AchievementLinkPatch[] = [];
  if (!entry.achievementId) patches.push({ entryId: entry.id, patch: { achievementId: key } });
  patches.push({ entryId: candidate.id, patch: { achievementId: key, ...typePatch } });
  return patches;
}
