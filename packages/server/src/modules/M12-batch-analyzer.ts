/**
 * M12 — BatchAnalyzer
 *
 * Estimates the cost of translating a batch of entries to a set of target
 * languages, broken down by source origin label / target language, and ranks
 * the available modules by approximate cost.
 */
import type { CostTier, StringEntry } from '@zercade-dev/narn-shared';
import type { ModuleMetadata } from './M6-module-registry.js';

export interface BatchRecommendation {
  moduleId: string;
  estimatedCharCost: number;
  costTier: CostTier;
  suitedFor: string[];
}

export interface BatchAnalysis {
  totalChars: number;
  breakdownBySource: Record<string, number>;
  breakdownByTargetLanguage: Record<string, number>;
  recommendations: BatchRecommendation[];
}

const COST_WEIGHTS: Record<CostTier, number> = {
  free: 0,
  low: 0.00002,
  medium: 0.0001,
  high: 0.0005,
};

const COST_TIER_ORDER: CostTier[] = ['free', 'low', 'medium', 'high'];

export class BatchAnalyzer {
  analyze(
    entries: StringEntry[],
    targetLanguages: string[],
    availableModules: ModuleMetadata[],
  ): BatchAnalysis {
    const sourceChars = entries.reduce((sum, e) => sum + e.sourceText.length, 0);
    // De-duplicate languages so a repeated language can't inflate totalChars
    // (and every estimatedCharCost) while the breakdown collapses it to a
    // single key — keeping the total and the per-language breakdown consistent.
    const langs = [...new Set(targetLanguages)];
    const totalChars = sourceChars * langs.length;

    // Char totals attributed to each source origin label. An entry with
    // multiple sources contributes its length to each; entries without a
    // source fall under 'unknown'.
    const breakdownBySource: Record<string, number> = {};
    for (const entry of entries) {
      const keys = (entry.sources ?? []).length > 0 ? entry.sources : ['unknown'];
      for (const key of keys) {
        breakdownBySource[key] = (breakdownBySource[key] ?? 0) + entry.sourceText.length;
      }
    }

    const breakdownByTargetLanguage: Record<string, number> = {};
    for (const lang of langs) {
      breakdownByTargetLanguage[lang] = sourceChars;
    }

    const sortedModules = [...availableModules].sort(
      (a, b) => COST_TIER_ORDER.indexOf(a.costTier) - COST_TIER_ORDER.indexOf(b.costTier),
    );

    const recommendations: BatchRecommendation[] = sortedModules.map((m) => ({
      moduleId: m.id,
      estimatedCharCost: COST_WEIGHTS[m.costTier] * totalChars,
      costTier: m.costTier,
      suitedFor: m.capabilities,
    }));

    return {
      totalChars,
      breakdownBySource,
      breakdownByTargetLanguage,
      recommendations,
    };
  }
}

export const batchAnalyzer = new BatchAnalyzer();
