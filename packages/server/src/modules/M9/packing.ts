/**
 * Entry packing/grouping helpers for the M9 TranslationEngine dispatcher.
 */
import { batchGroupKey, chunkArray, groupByKey, packGroups } from '@zercade-dev/narn-shared';
import type {
  BatchGroupingDimension,
  ModuleBatchMode,
  RoutingDecision,
} from '@zercade-dev/narn-shared';
import { difficultyBand } from '../M32/difficulty.js';
import { toFreewayJob, type FreewayResolution } from '../M32/resolve.js';
import { charCappedBatch } from '../M32/scoring.js';
import type { Assignment, BucketView } from '../M32/types.js';

/**
 * Reorders decisions so both members of an achievement pair (entries sharing
 * a non-empty `achievementId`) sit adjacent — 'name' before 'description' —
 * at the pair's first-seen position, so downstream per-entry grouping and
 * greedy packing keep the pair in one dispatch batch and the model translates
 * them together. Entries without achievementId keep their relative order.
 * Returns the input array unchanged (reference-equal) when nothing is tagged.
 *
 * Best-effort only: this reorders the input but doesn't force co-location —
 * a pair can still split across different module/model-override partitions,
 * different grouping-dimension footprints (e.g. per-category batching), or a
 * pack-cap boundary downstream, in which case the two members simply dispatch
 * in separate batches.
 */
export function colocateAchievementPairs(decisions: RoutingDecision[]): RoutingDecision[] {
  const hasPairs = decisions.some((d) => d.entry.achievementId);
  if (!hasPairs) return decisions;
  const byGroup = new Map<string, RoutingDecision[]>();
  const order: Array<RoutingDecision | { group: string }> = [];
  const seenGroups = new Set<string>();
  for (const d of decisions) {
    const gid = d.entry.achievementId;
    if (!gid) {
      order.push(d);
      continue;
    }
    const bucket = byGroup.get(gid) ?? [];
    bucket.push(d);
    byGroup.set(gid, bucket);
    if (!seenGroups.has(gid)) {
      seenGroups.add(gid);
      order.push({ group: gid });
    }
  }
  const typeRank = (d: RoutingDecision): number => (d.entry.achievementType === 'name' ? 0 : 1);
  const out: RoutingDecision[] = [];
  for (const slot of order) {
    if ('group' in slot) {
      const bucket = byGroup.get(slot.group)!;
      // Stable name-first ordering; same-type members keep insertion order.
      out.push(...[...bucket].sort((a, b) => typeRank(a) - typeRank(b)));
    } else {
      out.push(slot);
    }
  }
  return out;
}

/**
 * Packs per-entry decision groups (each element = all decisions for one entry)
 * into merged chunks of up to `cap` SOURCE ENTRIES per chunk — not `cap` jobs.
 * An entry with many target languages still counts as exactly one entry
 * against the cap (matching the "Entries per batch" custom-size setting), so
 * translating a handful of entries to many languages never splits into
 * multiple batches purely because of the language count. Entry atomicity is
 * always preserved: a single entry's decisions are never split across chunks.
 */
export function packEntryGroups(
  entryGroups: RoutingDecision[][],
  cap: number,
): RoutingDecision[][] {
  const packed: RoutingDecision[][] = [];
  let current: RoutingDecision[] = [];
  let currentEntryCount = 0;
  for (const group of entryGroups) {
    if (currentEntryCount >= cap) {
      packed.push(current);
      current = [];
      currentEntryCount = 0;
    }
    current.push(...group);
    currentEntryCount += 1;
  }
  if (current.length) packed.push(current);
  return packed;
}

/** Options controlling related-entry grouping in {@link groupDecisions}. */
export interface GroupDecisionsOptions {
  /** Grouping dimension; `'none'` (default) keeps the legacy non-grouped packing. */
  dimension?: BatchGroupingDimension;
  /** Send each related-entry group as one batch regardless of `resolveCap`. */
  ignoreSizeLimit?: boolean;
  /**
   * Per-module batch-size cap used by the grouping path (typically the
   * provider's `maxBatchSize`). Required when `dimension !== 'none'`; falls back
   * to `entryPackCap` if omitted.
   */
  resolveCap?: (moduleId: string) => number;
  /** Entry-mode pack cap (source entries, not (entry, language) pairs) for the legacy (`dimension='none'`) path. */
  entryPackCap?: number;
  /**
   * Per-run custom batch-size override (entries per batch) for the LEGACY
   * (`dimension==='none'`) packing path only — the Translate dialog's "Custom"
   * choice. `0` means unlimited: each (module, language[, override]) partition
   * (or entry-mode override bucket) is sent as exactly one batch. A positive
   * value caps both the language-mode buckets (chunked post-hoc — the legacy
   * path otherwise leaves them uncapped for the provider to chunk) and the
   * entry-mode `packEntryGroups` cap (replacing the default 25). Entry
   * atomicity is preserved either way because `packEntryGroups` never splits a
   * single entry's bundle. Ignored when `dimension !== 'none'`.
   */
  customBatchSize?: number;
}

/**
 * Groups an array of routing decisions into dispatch units.
 *
 * When `dimension === 'none'` (the default) this preserves the original
 * behaviour:
 *  - non-batch modules → one single-element group per decision;
 *  - language-mode batch modules → one (uncapped) group per
 *    (moduleId, targetLanguage, override) — the provider chunks it;
 *  - entry-mode batch modules → per-entry groups packed greedily to
 *    `entryPackCap` SOURCE ENTRIES (an entry's language count doesn't count
 *    against the cap), preserving entry atomicity.
 *
 * When `dimension !== 'none'`, batch-mode decisions are partitioned by
 * (moduleId, override[, targetLanguage]) and then sub-grouped by the entry's
 * related-entry footprint ({@link batchGroupKey}); each footprint stays together
 * in a batch (split only when it alone exceeds the cap) and small footprints are
 * packed greedily up to `resolveCap(moduleId)`. With `ignoreSizeLimit`, each
 * footprint is one batch regardless of size. The dispatcher passes
 * `{ ignoreSizeLimit: true }` to the provider for these batches so the provider
 * does not re-chunk them and tear a footprint apart.
 */
export function groupDecisions(
  decisions: RoutingDecision[],
  isBatch: (moduleId: string | null) => boolean,
  resolveBatchMode: (moduleId: string) => ModuleBatchMode,
  options: GroupDecisionsOptions = {},
): RoutingDecision[][] {
  // Co-locate achievement name/description pairs BEFORE any partitioning so both
  // members land in the same dispatch batch (see colocateAchievementPairs).
  decisions = colocateAchievementPairs(decisions);
  const dimension = options.dimension ?? 'none';
  const ignoreSizeLimit = options.ignoreSizeLimit ?? false;
  // Infinity = "no cap" (customBatchSize 0); a positive value chunks the legacy
  // buckets below. undefined (the common case) leaves the legacy path exactly
  // as before — uncapped language-mode groups, entry mode capped at 25 entries
  // (not 25 (entry, language) pairs).
  const customCap =
    options.customBatchSize === undefined
      ? undefined
      : options.customBatchSize === 0
        ? Number.POSITIVE_INFINITY
        : options.customBatchSize;
  const entryPackCap = options.entryPackCap ?? 25;
  const grouping = dimension !== 'none';

  const singles: RoutingDecision[] = [];
  // Legacy (dimension==='none') structures.
  const groups = new Map<string, RoutingDecision[]>();
  const entryModeBuckets = new Map<string, Map<string, RoutingDecision[]>>();
  // Grouping (dimension!=='none') structures: partition key -> decisions in input order.
  const partitions = new Map<string, RoutingDecision[]>();
  const partitionModule = new Map<string, string>();

  for (const decision of decisions) {
    if (decision.moduleId !== null && isBatch(decision.moduleId)) {
      const mode = resolveBatchMode(decision.moduleId);
      if (grouping) {
        // Entry mode merges all target languages into one partition (mixed-target
        // batch); language mode keys by target language so each call is single-language.
        const langPart = mode === 'language' ? `::${decision.targetLanguage}` : '';
        const key = `${decision.moduleId}${langPart}::${decision.modelOverride ?? ''}::${decision.reasoningEffortOverride ?? ''}`;
        const existing = partitions.get(key);
        if (existing) {
          existing.push(decision);
        } else {
          partitions.set(key, [decision]);
          partitionModule.set(key, decision.moduleId);
        }
      } else if (mode === 'entry') {
        const overrideKey = `${decision.moduleId}::${decision.modelOverride ?? ''}::${decision.reasoningEffortOverride ?? ''}`;
        let entryMap = entryModeBuckets.get(overrideKey);
        if (!entryMap) {
          entryMap = new Map();
          entryModeBuckets.set(overrideKey, entryMap);
        }
        const existing = entryMap.get(decision.entry.id);
        if (existing) {
          existing.push(decision);
        } else {
          entryMap.set(decision.entry.id, [decision]);
        }
      } else {
        const key = `${decision.moduleId}::${decision.targetLanguage}::${decision.modelOverride ?? ''}::${decision.reasoningEffortOverride ?? ''}`;
        const existing = groups.get(key);
        if (existing) {
          existing.push(decision);
        } else {
          groups.set(key, [decision]);
        }
      }
    } else {
      singles.push(decision);
    }
  }

  const result: RoutingDecision[][] = [...singles.map((d) => [d])];

  if (grouping) {
    const resolveCap = options.resolveCap ?? (() => entryPackCap);
    for (const [key, partition] of partitions) {
      const moduleId = partitionModule.get(key) as string;
      const cap = resolveCap(moduleId);
      // Sub-group by footprint (entry order is preserved, so an entry's
      // multi-language decisions stay contiguous), then pack greedily to cap.
      const footprintGroups = groupByKey(partition, (d) => batchGroupKey(d.entry, dimension));
      for (const batch of packGroups(footprintGroups, cap, ignoreSizeLimit)) {
        result.push(batch);
      }
    }
    return result;
  }

  for (const group of groups.values()) {
    if (customCap !== undefined && Number.isFinite(customCap)) {
      for (const chunk of chunkArray(group, customCap)) result.push(chunk);
    } else {
      result.push(group);
    }
  }
  // Pack entry-mode groups: merge entries greedily up to entryPackCap (the
  // custom cap when set, else the default 25).
  for (const entryMap of entryModeBuckets.values()) {
    const packed = packEntryGroups([...entryMap.values()], customCap ?? entryPackCap);
    for (const group of packed) {
      result.push(group);
    }
  }
  return result;
}

/**
 * One Freeway dispatch group after mixed-target packing: either a single
 * assignment passed through untouched, or several same-(bucket, band)
 * assignments merged into one mixed-target group.
 */
export interface PackedGroup {
  decisions: RoutingDecision[];
  bucketKey: string;
  batchSize: number;
  degraded?: Assignment['degraded'];
  /** Distinct target languages, in first-appearance order — set ONLY on a merged (>=2 assignment) group. */
  packedLanguages?: string[];
}

/** Distinct target languages of `decisions`, in first-appearance order. */
function distinctLanguages(decisions: readonly RoutingDecision[]): string[] {
  const languages: string[] = [];
  for (const decision of decisions) {
    if (!languages.includes(decision.targetLanguage)) languages.push(decision.targetLanguage);
  }
  return languages;
}

/**
 * The per-batch dispatch overrides M9 applies from a group's FIRST decision
 * (model + reasoning effort), as a partition key. `groupDecisions` splits on
 * these; the packed path bypasses it, so a group that is not uniform in them
 * must never be merged into one call — the first decision's values would
 * silently govern the rest.
 */
function overrideKey(decisions: readonly RoutingDecision[]): string | undefined {
  const first = decisions[0];
  if (!first) return undefined;
  const key = `${first.modelOverride ?? ''} ${first.reasoningEffortOverride ?? ''}`;
  for (const decision of decisions) {
    if (`${decision.modelOverride ?? ''} ${decision.reasoningEffortOverride ?? ''}` !== key) {
      return undefined;
    }
  }
  return key;
}

/**
 * Merges the assignments a mixed-batch-capable bucket can serve in ONE request
 * into shared mixed-target groups.
 *
 * Two assignments merge when they share a bucket AND a difficulty band, the
 * bucket's provider declares `supportsMixedBatch`, neither relaxed its band
 * floor (a degrade is that assignment's own accepted compromise — spreading it
 * over another language would hand a second language a tier its own plan never
 * agreed to), and both carry the same per-batch dispatch overrides. Everything
 * else passes through untouched and in its original position; a merged group
 * sits at its first member's position.
 *
 * The merged batch size is the smallest of the members' planned sizes, further
 * capped by what the bucket's char budget can physically take for the merged
 * job set — a size either member alone could afford is not automatically
 * affordable for their union.
 */
export function packAssignedGroups(
  assigned: FreewayResolution['assignedGroups'],
  buckets: BucketView[],
): PackedGroup[] {
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.bucketKey, bucket]));
  /** Output groups, plus the bookkeeping a later member needs to re-size the merge. */
  const slots: Array<{
    packed: PackedGroup;
    /** Smallest planned batch size among the members merged so far. */
    minBatchSize: number;
    languages: string[];
  }> = [];
  /** `<bucketKey> <band> <overrides>` -> index in `slots` of the group it merges into. */
  const mergeSlots = new Map<string, number>();

  for (const group of assigned) {
    const first = group.decisions[0];
    const bucket = bucketByKey.get(group.bucketKey);
    const overrides = overrideKey(group.decisions);
    if (
      first !== undefined &&
      group.degraded === undefined &&
      bucket?.mixedBatch === true &&
      overrides !== undefined
    ) {
      const mergeKey = `${group.bucketKey} ${difficultyBand(toFreewayJob(first))} ${overrides}`;
      const index = mergeSlots.get(mergeKey);
      const slot = index === undefined ? undefined : slots[index];
      if (slot) {
        slot.packed.decisions.push(...group.decisions);
        slot.minBatchSize = Math.min(slot.minBatchSize, group.batchSize);
        for (const language of distinctLanguages(group.decisions)) {
          if (!slot.languages.includes(language)) slot.languages.push(language);
        }
        slot.packed.packedLanguages = slot.languages;
        slot.packed.batchSize = Math.max(
          1,
          Math.min(
            slot.minBatchSize,
            // StringEntry carries `sourceText`, which is all the char cap reads.
            charCappedBatch(
              bucket,
              slot.packed.decisions.map((decision) => decision.entry),
            ),
          ),
        );
        continue;
      }
      mergeSlots.set(mergeKey, slots.length);
    }
    slots.push({
      packed: {
        decisions: [...group.decisions],
        bucketKey: group.bucketKey,
        batchSize: group.batchSize,
        ...(group.degraded ? { degraded: group.degraded } : {}),
      },
      minBatchSize: group.batchSize,
      languages: distinctLanguages(group.decisions),
    });
  }

  return slots.map((slot) => slot.packed);
}

/**
 * Chunks a packed group into dispatch batches of at most `batchSize`
 * decisions, preserving the input order — and with it the language blocks the
 * assignments contributed, which the dispatcher's language-segment splits
 * (unpack-on-deviation, capped re-chunks) rely on.
 *
 * Achievement pairs are co-located WITHIN each language block, never across
 * one: the same entry translated to two target languages carries the same
 * `achievementId`, so co-locating the whole mixed array would pull one
 * language's member into another language's block and shred the contiguity.
 * A pair always shares a target language, so nothing is lost by scoping it.
 *
 * Deliberately NOT `groupDecisions`: its language-mode partitioning would undo
 * the merge this chunking exists to dispatch.
 */
export function chunkPackedDecisions(
  decisions: RoutingDecision[],
  batchSize: number,
): RoutingDecision[][] {
  if (decisions.length === 0) return [];
  const size = Number.isFinite(batchSize) ? Math.max(1, Math.floor(batchSize)) : decisions.length;
  const ordered: RoutingDecision[] = [];
  let start = 0;
  for (let i = 1; i <= decisions.length; i++) {
    if (i === decisions.length || decisions[i].targetLanguage !== decisions[start].targetLanguage) {
      ordered.push(...colocateAchievementPairs(decisions.slice(start, i)));
      start = i;
    }
  }
  return chunkArray(ordered, size);
}
