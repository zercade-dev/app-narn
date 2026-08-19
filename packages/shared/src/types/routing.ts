import type { PromptOptions } from './module.js';
import type { StringEntry } from './string-entry.js';
import type { ReasoningEffort } from './models.js';

export type { ReasoningEffort } from './models.js';

export interface RoutingRule {
  id: string;
  name?: string;
  /**
   * Lower number = higher priority. Rules are evaluated in ascending order;
   * the first matching rule wins.
   */
  priority: number;
  moduleId: string;
  /**
   * Match against `StringEntry.sources` (the CSV "Source" origin labels). The
   * rule matches when the entry carries ANY of these labels. Compared against
   * the exact stored label text. Omitted or empty ⇒ no source constraint
   * (matches every entry on this dimension). Optional.
   */
  sources?: string[];
  /** Match against `StringEntry.categories` (any category in this list). Optional. */
  categories?: string[];
  /** Match against `StringEntry.metadata.tone` (any tone in this list). Optional. */
  tones?: string[];
  /** Match against `StringEntry.achievementType` (any type in this list). Optional. */
  achievementTypes?: Array<'name' | 'description'>;
  /** Multi-language match. Optional, retained for compatibility. */
  targetLanguages?: string[];
  /** Single-language match. Use `'*'` as a wildcard. Optional. */
  targetLanguage?: string;
  /** Maximum source text length (inclusive) for this rule to apply. Optional. */
  maxLength?: number;
  /** Prompt customisation (character, tone, gender, notes) forwarded to the module. */
  promptOptions?: PromptOptions;
  /** When set, overrides the module's configured model for this rule. `undefined` means use project/global default. */
  modelOverride?: string;
  /** When set, overrides the reasoning effort for Copilot-based rules. `undefined` means use project/global default. */
  reasoningEffortOverride?: ReasoningEffort;
}

export interface RoutingRuleGroup {
  id: string;
  name: string;
  rules: RoutingRule[];
}

export interface RoutingDecision {
  entry: StringEntry;
  targetLanguage: string;
  /** Null when no rule matched. Callers must handle this case (treat as failure). */
  moduleId: string | null;
  /** Null when `moduleId` is null or when the matched rule has no id. */
  ruleId: string | null;
  /** Forwarded from the matched rule. */
  promptOptions?: PromptOptions;
  /** Per-rule model override. When set, supersedes the module's configured model. */
  modelOverride?: string;
  /** Per-rule reasoning effort override for Copilot-based modules. */
  reasoningEffortOverride?: ReasoningEffort;
  /**
   * The Freeway serving bucket's quality tier (1-4), threaded through the
   * same channel as `moduleId`/`modelOverride` above: set at plan time and
   * kept in sync on every failover/degrade/escalation re-point, so it always
   * names the bucket that will actually serve (or just served) this decision.
   * Undefined for non-Freeway decisions, and explicitly cleared by any
   * short-circuit persist path (trivial matcher, translation memory) that
   * never reaches a provider.
   */
  freewayTier?: number;
}

/**
 * Controlled, pre-dispatch translation failures: a (entry, targetLanguage) pair
 * that cannot even be sent to a module, decidable from routing rules + module
 * config alone (no provider call). Unlike genuine post-dispatch failures (rate
 * limits, malformed output, network) these are deterministic for the whole run
 * — every entry routing the same way fails identically — so the engine
 * aggregates them in the log (one trace per (targetLanguage, reason)) and
 * attaches a fix hint instead of repeating the same line per entry.
 */
export type ControlledFailureReason =
  'no-route' | 'module-disabled' | 'module-not-found' | 'freeway-no-buckets';

/**
 * Maps a {@link ControlledFailureReason} to a short, user-actionable hint
 * describing how to fix it. Used by the engine's aggregated `translation:failed`
 * trace and surfaced to the frontend run-completion notice. The `{{lang}}`
 * placeholder is interpolated by {@link controlledFailureHint}.
 */
export const CONTROLLED_FAILURE_HINTS: Record<ControlledFailureReason, string> = {
  'no-route': 'No routing rule matches target {{lang}}. Add a rule in Batch → Routing.',
  'module-disabled': 'Enable the module in Global Config.',
  'module-not-found': 'Module is not installed/registered.',
  'freeway-no-buckets':
    'Add a free-plan API key in Freeway settings, or pin a rule to a specific provider.',
};

/**
 * Resolves the fix hint for a controlled failure, interpolating the target
 * language into the `no-route` message. Returns undefined for an unknown reason
 * so callers can treat genuine (post-dispatch) failures as hint-less.
 */
export function controlledFailureHint(reason: string, targetLanguage?: string): string | undefined {
  const template = CONTROLLED_FAILURE_HINTS[reason as ControlledFailureReason];
  if (!template) return undefined;
  return template.replace('{{lang}}', targetLanguage ?? '?');
}
