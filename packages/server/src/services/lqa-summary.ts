/**
 * LQA summary aggregation (feature: quality dashboard).
 *
 * Walks a project's string entries once and aggregates the per-language LQA
 * results stored on each entry (`entry.lqaResults`) into pass rates and
 * issue-type counts grouped by target language, source origin label, and the
 * module that produced each language's translation (`entry.translations[lang].moduleId`).
 *
 * Issue types are aggregated as opaque string keys — new check ids added to
 * the LQA gate show up automatically without changes here.
 *
 * No new persistence: the summary is a cheap single pass over the project's
 * entries (`computeLqaSummary`), recomputed on each request. (It was formerly
 * cached keyed by the on-disk strings.json mtime; strings now live in Postgres
 * — there is no file to stat — so the cache was removed.)
 */
import type { StringEntry } from '@zercade-dev/narn-shared';
import type { ProjectStore, StringStore } from '../storage/types.js';
import { getProjectStore, getStringStore } from '../storage/registry.js';

export interface LqaGroupSummary {
  /** Number of (entry, language) LQA results in this group. */
  total: number;
  passed: number;
  failed: number;
  /** passed / total, in [0, 1]. 0 when the group is empty. */
  passRate: number;
  /** Issue counts keyed by the opaque `issue.type` string. */
  issues: Record<string, number>;
}

export interface LqaSummary {
  /** Total number of string entries inspected. */
  totalEntries: number;
  /** Total number of (entry, language) LQA results aggregated. */
  totalResults: number;
  overall: LqaGroupSummary;
  byLanguage: Record<string, LqaGroupSummary>;
  bySource: Record<string, LqaGroupSummary>;
  byModule: Record<string, LqaGroupSummary>;
}

/** Module id used when a language has an LQA result but no translation record. */
export const UNKNOWN_MODULE_ID = 'unknown';

function emptyGroup(): LqaGroupSummary {
  return { total: 0, passed: 0, failed: 0, passRate: 0, issues: {} };
}

function group(map: Record<string, LqaGroupSummary>, key: string): LqaGroupSummary {
  map[key] ??= emptyGroup();
  return map[key];
}

function finalize(groupSummary: LqaGroupSummary): void {
  groupSummary.passRate = groupSummary.total > 0 ? groupSummary.passed / groupSummary.total : 0;
}

/**
 * Pure aggregation over a list of string entries. One pass, no I/O.
 */
export function computeLqaSummary(entries: StringEntry[]): LqaSummary {
  const overall = emptyGroup();
  const byLanguage: Record<string, LqaGroupSummary> = {};
  const bySource: Record<string, LqaGroupSummary> = {};
  const byModule: Record<string, LqaGroupSummary> = {};
  let totalResults = 0;

  for (const entry of entries) {
    for (const [lang, result] of Object.entries(entry.lqaResults ?? {})) {
      totalResults++;
      // Same fail rule the string filters use: a result fails when the gate
      // flagged it OR it overflows and the entry doesn't ignore overflow.
      const failed = !result.passed || (!entry.ignoreOverflow && result.overflow);
      const moduleId = entry.translations?.[lang]?.moduleId ?? UNKNOWN_MODULE_ID;
      // A result counts toward every source label the entry carries; entries
      // without a source are grouped under 'unknown'.
      const sourceKeys = (entry.sources ?? []).length > 0 ? entry.sources : ['unknown'];
      const groups = [
        overall,
        group(byLanguage, lang),
        ...sourceKeys.map((source) => group(bySource, source)),
        group(byModule, moduleId),
      ];
      for (const g of groups) {
        g.total++;
        if (failed) g.failed++;
        else g.passed++;
      }
      for (const issue of result.issues ?? []) {
        // Skip overflow issues the user explicitly suppressed for this entry.
        if (entry.ignoreOverflow && issue.type === 'overflow') continue;
        for (const g of groups) {
          g.issues[issue.type] = (g.issues[issue.type] ?? 0) + 1;
        }
      }
    }
  }

  finalize(overall);
  for (const g of Object.values(byLanguage)) finalize(g);
  for (const g of Object.values(bySource)) finalize(g);
  for (const g of Object.values(byModule)) finalize(g);

  return {
    totalEntries: entries.length,
    totalResults,
    overall,
    byLanguage,
    bySource,
    byModule,
  };
}

/**
 * Computes the per-project LQA summary on demand. The aggregation is a cheap
 * single pass over the project's entries, so it is recomputed on each call.
 */
export class LqaSummaryService {
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

  async getSummary(projectId: string): Promise<LqaSummary> {
    await this.ps.loadProject(projectId); // 404 via ProjectNotFoundError when missing
    const entries = await this.ss.load(projectId);
    return computeLqaSummary(entries);
  }
}

export const lqaSummaryService = new LqaSummaryService();
