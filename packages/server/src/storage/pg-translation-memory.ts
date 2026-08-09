/**
 * PgTranslationMemory — the Postgres adapter for the global (cross-project)
 * translation memory (the former M23 TranslationMemoryStore).
 *
 * TM is GLOBAL by design: one `'local'` tenant, NO `project_id`, so a variant
 * approved in one project can auto-apply in another. Storage is row-per-variant
 * in the `translation_memory` table — a `TmSegment` is the set of rows sharing
 * `(tenant_id, source_hash, target_lang)`, reconstructed on read; the segment
 * vanishes when its last variant row is deleted.
 *
 * The ranking / fingerprint-matching / overflow-downgrade / hint-assembly logic
 * is ported VERBATIM from M23 (its helpers — `rankVariants`, `fingerprintMatches`,
 * `describeFingerprintDiff`, `tmSegmentKey`, `hashMaskedSource` — are reused, not
 * re-derived); only the data source changed (in-memory `TmFile.segments` → PG
 * rows) and the per-segment writes (→ upsert/delete rows). Two documented
 * behavior changes vs the file store: the global `MAX_SEGMENTS=50_000` file-size
 * cap is dropped (a DB does not need it) and there is no in-memory cache (the DB
 * is the source of truth). The per-(source_hash, target_lang) variant cap
 * {@link MAX_VARIANTS_PER_SEGMENT} is kept.
 */
import { randomUUID } from 'node:crypto';
import type { TmFingerprint, TmSegment, TmVariant } from '@zercade-dev/narn-shared';
import {
  MAX_TM_HINTS,
  MAX_VARIANTS_PER_SEGMENT,
  describeFingerprintDiff,
  fingerprintMatches,
  hashMaskedSource,
  rankVariants,
  tmSegmentKey,
  type TmHint,
  type TmLookupQuery,
  type TmLookupResult,
} from '../modules/M23-translation-memory.js';
import type { Queryable } from './pg/pool.js';
import { withTransaction } from './pg/pool.js';
import type { TranslationMemory } from './types.js';

const EMPTY_LOOKUP: TmLookupResult = { autoApply: null, hints: [] };

/** One stored variant row, before reconstruction into a `TmVariant`. */
interface VariantRow {
  id: string;
  translated_text: string;
  source_masked: string;
  module_id: string;
  lqa_passed: boolean;
  ts: number | string;
  fingerprint: TmFingerprint;
}

/**
 * Reconstruct a `TmVariant` from a stored row. `ts` is a Postgres `bigint`,
 * which pg returns as a string and pglite as a number — `Number()` is safe
 * for both and matches the in-memory `timestamp: number` contract.
 */
function rowToVariant(row: VariantRow): TmVariant {
  return {
    id: row.id,
    translatedText: row.translated_text,
    moduleId: row.module_id,
    lqaPassed: row.lqa_passed,
    timestamp: Number(row.ts),
    fingerprint: row.fingerprint,
  };
}

export class PgTranslationMemory implements TranslationMemory {
  private readonly db: Queryable;
  constructor(db: Queryable) {
    this.db = db;
  }

  /** All variant rows for one (source_hash, target language), as TmVariants. */
  private async fetchVariants(
    db: Queryable,
    sourceHash: string,
    targetLang: string,
  ): Promise<TmVariant[]> {
    const { rows } = await db.query<VariantRow>(
      `select id, translated_text, source_masked, module_id, lqa_passed, ts, fingerprint
         from translation_memory
        where source_hash = $1 and target_lang = $2`,
      [sourceHash, targetLang],
    );
    return rows.map(rowToVariant);
  }

  /**
   * Looks up the segment for (masked source, target language) and splits the
   * stored variants into one auto-applicable match (or none) plus hint-only
   * variants per the project's match policy. (Ported verbatim from M23.lookup;
   * the only change is the variant fetch — PG rows instead of an in-memory map.)
   */
  async lookup(query: TmLookupQuery): Promise<TmLookupResult> {
    if (query.policy === 'disabled') return EMPTY_LOOKUP;
    const variants = await this.fetchVariants(
      this.db,
      hashMaskedSource(query.maskedSource),
      query.targetLanguage,
    );
    if (variants.length === 0) return EMPTY_LOOKUP;

    // Only the single best-ranked matching variant is eligible for auto-apply;
    // lower-ranked matches are intentionally dropped (not surfaced as hints).
    let autoApply: TmVariant | null = null;
    const hints: TmHint[] = [];
    for (const variant of rankVariants(variants)) {
      // Defensive: no code path writes a variant this branch can drop. `record()`
      // has exactly one caller — `approveTranslations` in M9 — and it stamps
      // `lqaPassed: true` unconditionally, because a human approving the text is
      // the authority regardless of the original automated LQA verdict. So the
      // branch exists for rows this app did not write: hand-seeded or legacy
      // variants that carry `lqaPassed: false`. Never auto-apply or hint those —
      // a known-bad translation in the prompt risks anchoring weaker models on it.
      if (!variant.lqaPassed) continue;
      if (fingerprintMatches(variant.fingerprint, query.fingerprint, query.policy)) {
        // `rankVariants` orders best-first, so the first match is the winner.
        if (!autoApply) autoApply = variant;
      } else {
        hints.push({
          variant,
          reason: describeFingerprintDiff(variant.fingerprint, query.fingerprint),
        });
      }
    }

    if (
      autoApply &&
      query.policy !== 'source-only' &&
      query.overflowLimit !== null &&
      query.maskedSource.length > 0 &&
      // Ratio uses UTF-16 `.length` to match M10's canonical `computeOverflowRatio`,
      // so this gate and the LQA overflow check agree on the same translation.
      autoApply.translatedText.length / query.maskedSource.length > query.overflowLimit
    ) {
      // Stored translation does not fit the new entry's overflow budget:
      // downgrade the hit to a hint rather than auto-applying it.
      hints.unshift({ variant: autoApply, reason: 'exceeds the length budget' });
      autoApply = null;
    }

    return { autoApply, hints: hints.slice(0, MAX_TM_HINTS) };
  }

  /**
   * Records a translation variant for the segment. Dedupes on identical
   * (translatedText, fingerprint); enforces the per-segment variant cap by
   * evicting LQA-failed variants first, then the oldest. (Ported verbatim from
   * M23.record; the in-memory read-modify-write becomes a transactional
   * select → upsert → cap-enforcement over rows.)
   */
  async record(input: {
    maskedSource: string;
    targetLanguage: string;
    translatedText: string;
    moduleId: string;
    lqaPassed: boolean;
    fingerprint: TmFingerprint;
  }): Promise<void> {
    const sourceHash = hashMaskedSource(input.maskedSource);
    await withTransaction(this.db, async (tx) => {
      // Serialize concurrent record() calls per (tenant, segment) AT THE DB
      // LEVEL: the dedupe below is select-then-insert, and under READ
      // COMMITTED two concurrent transactions can both miss the duplicate and
      // both insert a duplicate variant (self-limiting via the variant cap,
      // but still noise). An in-process lock would not survive >1 server
      // replica; the advisory lock is transaction-scoped (released at
      // commit/rollback) and keyed on the segment, so unrelated segments stay
      // fully concurrent.
      await tx.query(
        `select pg_advisory_xact_lock(
           hashtextextended(current_setting('app.user_id') || ':' || $1, 0)
         )`,
        [`${sourceHash}:${input.targetLanguage}`],
      );
      const variants = await this.fetchVariants(tx, sourceHash, input.targetLanguage);

      const existing = variants.find(
        (v) =>
          v.translatedText === input.translatedText &&
          fingerprintMatches(v.fingerprint, input.fingerprint, 'strict'),
      );
      if (existing) {
        await tx.query(
          'update translation_memory set module_id = $1, lqa_passed = $2, ts = $3 where id = $4',
          [input.moduleId, input.lqaPassed, Date.now(), existing.id],
        );
      } else {
        await tx.query(
          `insert into translation_memory
             (id, tenant_id, source_hash, source_masked, target_lang,
              translated_text, module_id, lqa_passed, ts, fingerprint)
           values ($1, current_setting('app.user_id'), $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            randomUUID(),
            sourceHash,
            input.maskedSource,
            input.targetLanguage,
            input.translatedText,
            input.moduleId,
            input.lqaPassed,
            Date.now(),
            JSON.stringify(input.fingerprint),
          ],
        );
      }

      // Enforce the per-(source_hash, target_lang) variant cap: re-read, rank
      // best-first, and delete everything past the cap (LQA-failed first, then
      // oldest — `rankVariants` orders so the survivors are the top N).
      const after = await this.fetchVariants(tx, sourceHash, input.targetLanguage);
      const overflow = rankVariants(after).slice(MAX_VARIANTS_PER_SEGMENT);
      if (overflow.length > 0) {
        await tx.query('delete from translation_memory where id = any($1)', [
          overflow.map((v) => v.id),
        ]);
      }
    });
  }

  /** All segments, sorted by masked source text then target language. */
  async list(): Promise<TmSegment[]> {
    const { rows } = await this.db.query<VariantRow & { source_hash: string; target_lang: string }>(
      `select id, source_hash, source_masked, target_lang, translated_text,
              module_id, lqa_passed, ts, fingerprint
         from translation_memory`,
    );
    const segments = new Map<string, TmSegment>();
    for (const row of rows) {
      const key = tmSegmentKey(row.source_masked, row.target_lang);
      let segment = segments.get(key);
      if (!segment) {
        segment = {
          key,
          sourceHash: row.source_hash,
          targetLanguage: row.target_lang,
          sourceMasked: row.source_masked,
          variants: [],
        };
        segments.set(key, segment);
      }
      segment.variants.push(rowToVariant(row));
    }
    return Array.from(segments.values()).sort(
      (a, b) =>
        a.sourceMasked.localeCompare(b.sourceMasked) ||
        a.targetLanguage.localeCompare(b.targetLanguage),
    );
  }

  /**
   * Deletes one variant. Returns false when the variant does not exist IN the
   * segment named by `key` — matching M23, which looked the segment up by key
   * first and returned false on a key/variant mismatch (the route always passes
   * the owning segment's key). `key` is `${source_hash}:${target_lang}`; the
   * source hash is a 64-char sha256 hex with no colon, so the first colon splits
   * it from the (possibly hyphenated) language code. Affected-row detection is a
   * `select 1` existence pre-check, never a driver `rowCount` (pglite does not
   * report one reliably). Row-per-variant means no segment row to clean up — the
   * segment vanishes once its last variant is gone.
   */
  async deleteVariant(key: string, variantId: string): Promise<boolean> {
    const colon = key.indexOf(':');
    if (colon === -1) return false;
    const sourceHash = key.slice(0, colon);
    const targetLang = key.slice(colon + 1);
    return withTransaction(this.db, async (tx) => {
      const { rows } = await tx.query<{ one: number }>(
        `select 1 as one from translation_memory
          where id = $1 and source_hash = $2 and target_lang = $3`,
        [variantId, sourceHash, targetLang],
      );
      if (rows.length === 0) return false;
      await tx.query(
        `delete from translation_memory
          where id = $1 and source_hash = $2 and target_lang = $3`,
        [variantId, sourceHash, targetLang],
      );
      return true;
    });
  }

  /**
   * Removes every variant from the (global) translation memory. Returns the
   * number of variant rows cleared — which is exactly the "memory entries"
   * count the Memory tab toasts on a Clear-all (its label reads "Cleared N
   * memory entries"). Row-per-variant: M23 counted segments because it stored
   * one segment object per key; here each variant is a row, so `count(*)` is
   * the natural — and UI-consistent — entry count. Irreversible.
   */
  async clearAll(): Promise<number> {
    return withTransaction(this.db, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        'select count(*)::int as n from translation_memory',
      );
      const count = rows[0]?.n ?? 0;
      if (count === 0) return 0;
      await tx.query('delete from translation_memory');
      return count;
    });
  }
}
