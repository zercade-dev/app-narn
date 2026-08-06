/**
 * Shared run-status UI tokens and formatters.
 *
 * The run "Activity" table (RunsTab) and the review sub-tabs render the same
 * status/score/type badges and per-(module, model) usage summaries, so the tint
 * tokens and helpers live here rather than being re-derived per call site.
 */
import {
  runTypeLabel,
  type ChatRunSummary,
  type RunStatus,
  type RunUsageEntry,
} from '@zercade-dev/narn-shared';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { isChatRun } from '@/lib/run-kind';

// Soft status tints: one hue family per meaning, tints over solid fills. Names
// are kept from the original literal-color constants for
// call-site stability; values now reference theme status/type tokens so every
// theme renders its own hues. TINT_FUCHSIA has no dedicated token — chat runs
// are a magenta/pink accent with no status/type equivalent, so it's mapped to
// the closest available family (type-dialogue, the violet/purple token) per
// the tokenize-sweep's hue map.
export const TINT_AMBER = 'bg-status-warn/10 text-status-warn';
export const TINT_SKY = 'bg-status-info/15 text-status-info';
export const TINT_EMERALD = 'bg-status-pass/10 text-status-pass';
export const TINT_RED = 'bg-status-fail/10 text-status-fail';
export const TINT_VIOLET = 'bg-type-dialogue/10 text-type-dialogue';
export const TINT_FUCHSIA = 'bg-type-dialogue/10 text-type-dialogue';

/**
 * The chat-session summary of a `kind: 'chat'` run. Token counts and cost are
 * NOT here — a chat run carries them in the same
 * `usageByModule`/`estimatedCostUsd` fields every other run kind uses.
 */
export function chatRunData(run: RunStatus): ChatRunSummary | undefined {
  return run.chatSummary;
}

/** i18n key for a chat run's Type badge, flavored by its `chatKind`. */
export function chatTypeKey(chatKind: ChatRunSummary['chatKind'] | undefined): string {
  switch (chatKind) {
    case 'stage-details':
      return 'runs.typeChatStageDetails';
    case 'text-styler':
      return 'runs.typeChatTextStyler';
    default:
      return 'runs.typeChatGeneric';
  }
}

/** Run kind → distinct tint so each Type badge reads at a glance. */
export function typeTint(kind: RunStatus['kind']): string {
  if (isChatRun({ kind })) return TINT_FUCHSIA;
  switch (runTypeLabel(kind)) {
    case 'translation-ai-review':
      return TINT_VIOLET;
    case 'source-ai-review':
      return TINT_EMERALD;
    case 'glossary-generation':
    case 'category-generation':
      return TINT_AMBER;
    case 'relink-retranslate':
      return TINT_VIOLET;
    case 'stage-details-translation':
      return TINT_SKY;
    case 'translation':
    default:
      return TINT_SKY;
  }
}

/** Score band → status tint (mirrors the pass/warn/fail hue families). */
export function scoreTint(score: number): string {
  if (score >= 85) return TINT_EMERALD;
  if (score >= 70) return TINT_AMBER;
  return TINT_RED;
}

/**
 * Row accent (a 2px left border) so the run's state reads at a glance from the
 * far left of the table, reinforcing — not replacing — the status pill. The
 * same hue ladder the pills use: sky=running, amber=paused/queued, red=failed,
 * transparent for the settled completed/cancelled rows so they stay quiet.
 */
export function rowAccentClass(status: RunStatusCode): string {
  switch (status) {
    case RunStatusCode.Running:
    case RunStatusCode.Pending:
      return 'border-l-2 border-l-status-info';
    case RunStatusCode.Paused:
    case RunStatusCode.Queued:
      return 'border-l-2 border-l-status-warn';
    case RunStatusCode.Failed:
      return 'border-l-2 border-l-status-fail';
    default:
      return 'border-l-2 border-l-transparent';
  }
}

/**
 * Estimated-cost currency formatter for run usage figures. Shows 2 decimals at
 * or above $0.10 and 4 below so sub-cent costs stay legible. This is the
 * run-cost rounding rule; the model-price formatter in `ModelPicker` is a
 * separate per-million-token figure with its own (always-2-decimal) rule.
 */
export function formatUsd(value: number): string {
  return value >= 0.1 ? value.toFixed(2) : value.toFixed(4);
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

/** Stable React key for a per-(module, model) usage entry. */
export function usageEntryKey(entry: RunUsageEntry): string {
  return `${entry.moduleId}:${entry.model ?? ''}`;
}

/** Human label for a usage entry: `moduleId` plus the model when present. */
export function usageEntryLabel(entry: RunUsageEntry): string {
  return `${entry.moduleId}${entry.model ? ` · ${entry.model}` : ''}`;
}

/** Sum a single numeric usage field across every (module, model) entry of a run. */
export function sumUsage(entries: RunUsageEntry[] | undefined, key: keyof RunUsageEntry): number {
  return (entries ?? []).reduce((n, e) => n + ((e[key] as number | undefined) ?? 0), 0);
}

/**
 * One-line "X in / Y out tokens · incl. Z reasoning · N chars · ≈ $cost" summary
 * for a single (module, model) usage entry. Shared by the Activity-row Cost
 * cell and the run-detail Tokens section so both read identically.
 */
export function usageEntryFigures(entry: RunUsageEntry, t: TFn): string {
  const parts: string[] = [];
  if (entry.inputTokens !== undefined || entry.outputTokens !== undefined) {
    parts.push(
      t('runs.usageTokens', {
        input: (entry.inputTokens ?? 0).toLocaleString(),
        output: (entry.outputTokens ?? 0).toLocaleString(),
      }),
    );
    // Reasoning is a subset of output tokens — surface it so a large output
    // count next to little visible text reads as "thinking", not an error.
    if (entry.reasoningTokens) {
      parts.push(t('runs.usageReasoning', { count: entry.reasoningTokens.toLocaleString() }));
    }
    // Cached/cache-write tokens are subsets of inputTokens (mutually
    // exclusive on any one call) — surfaced so a cheaper/pricier-than-expected
    // cost is explained rather than looking like a pricing error.
    if (entry.cachedInputTokens) {
      parts.push(t('runs.usageCached', { count: entry.cachedInputTokens.toLocaleString() }));
    }
    if (entry.cacheWriteTokens) {
      parts.push(t('runs.usageCacheWrite', { count: entry.cacheWriteTokens.toLocaleString() }));
    }
  }
  if (entry.characters !== undefined) {
    parts.push(t('runs.usageCharacters', { count: entry.characters }));
  }
  if (entry.estimatedCostUsd !== undefined) {
    parts.push(t('runs.estimatedCost', { amount: formatUsd(entry.estimatedCostUsd) }));
  }
  return parts.join(' · ');
}
