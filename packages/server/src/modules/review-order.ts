/**
 * Review-order pre-sort (local word-similarity).
 *
 * Computes a per-entry `reviewSortIndex` from the shared word-similarity
 * algorithm and persists it onto every entry, so that textually-similar source
 * terms tend to land in the same review/translation batch. A small "last
 * sorted" meta (version/computedAt/count) records when the sort last ran (for
 * the "last sorted" display in the UI).
 *
 * The similarity computation itself is pure/deterministic (no time, no I/O);
 * `computedAt` is supplied by the caller (the route handler uses Date.now()).
 *
 * Persistence: the per-entry `reviewSortIndex` persists through
 * StringStore.setReviewSortIndices; the "last sorted" meta persists via
 * ReviewOrderStore in Postgres (was `projects/<id>/review-order.json`).
 */
import { computeSimilarityOrder } from '@zercade-dev/narn-shared';
import type { ProjectStore, ReviewOrderMeta, StringStore } from '../storage/types.js';
import { getProjectStore, getReviewOrderStore, getStringStore } from '../storage/registry.js';
import { logger } from './M15-console-logger.js';

/** Current meta schema version. Bump if the meta shape changes. */
export const REVIEW_ORDER_VERSION = 1;

export class ReviewOrderService {
  // Resolve the project store lazily so a later setProjectStore() (e.g. per-test
  // injection) is honored even by the module-level singleton.
  private readonly _ps?: ProjectStore;
  private get ps(): ProjectStore {
    return this._ps ?? getProjectStore();
  }
  // Resolve the string store lazily so a later setStringStore() (e.g. per-test
  // injection) is honored even by the module-level singleton — a bare
  // `?? getStringStore()` constructor default would capture the store at import
  // time and defeat the test seam.
  private readonly _ss?: StringStore;
  private get ss(): StringStore {
    return this._ss ?? getStringStore();
  }

  constructor(ps?: ProjectStore, ss?: StringStore) {
    this._ps = ps;
    this._ss = ss;
  }

  /**
   * Computes the similarity order over the project's entries, writes a
   * `reviewSortIndex` (0-based, in order) onto each entry, persists the entry
   * list, and saves the "last sorted" meta. Returns the entry count and the
   * `computedAt` timestamp that was recorded.
   *
   * @param projectId target project
   * @param computedAt epoch ms to stamp on the meta (default Date.now()).
   *   Pass an explicit value from the route handler to keep it controllable in
   *   tests; the similarity math never reads the clock.
   */
  async computeAndPersist(
    projectId: string,
    computedAt: number = Date.now(),
  ): Promise<{ count: number; computedAt: number }> {
    // Validates the project exists (throws ProjectNotFoundError otherwise).
    await this.ps.loadProject(projectId);

    const entries = await this.ss.load(projectId);
    const order = computeSimilarityOrder(
      entries.map((e) => ({ id: e.id, sourceText: e.sourceText })),
    );

    // Map id -> 0-based rank in the computed order.
    const rank = new Map<string, number>();
    order.forEach((id, i) => rank.set(id, i));

    // Persist under M3's write lock so a concurrent translation write (e.g.
    // setTranslation during an in-flight run) is never clobbered. The entry set
    // is re-read inside the lock; entries imported between the load above and
    // here simply keep no index until the next compute.
    const count = await this.ss.setReviewSortIndices(projectId, rank);

    const meta: ReviewOrderMeta = {
      version: REVIEW_ORDER_VERSION,
      computedAt,
      count,
    };
    // Resolved at call-time (not captured) so a per-test setReviewOrderStore()
    // injection is honored even by the module-level singleton.
    await getReviewOrderStore().saveMeta(projectId, meta);

    logger.info('review-order computed', { projectId, count });
    return { count, computedAt };
  }

  /** Loads the persisted meta, or null when the project was never pre-sorted. */
  async loadMeta(projectId: string): Promise<ReviewOrderMeta | null> {
    return getReviewOrderStore().getMeta(projectId);
  }
}

export const reviewOrderService = new ReviewOrderService();
