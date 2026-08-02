/**
 * Entry packing/grouping helpers for the M9 TranslationEngine dispatcher.
 */
import { batchGroupKey, chunkArray, groupByKey, packGroups } from '@zercade-dev/narn-shared';
import type {
  BatchGroupingDimension,
  ModuleBatchMode,
  RoutingDecision,
} from '@zercade-dev/narn-shared';

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
