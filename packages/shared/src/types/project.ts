import type { RoutingRule, RoutingRuleGroup } from './routing.js';
import type { ModuleBatchMode } from './module.js';
import type { ModuleInstance } from './module-instances.js';
import type { ProjectLQAConfig } from './lqa.js';
import type { TmMatchPolicy } from './tm.js';
import type { StageDetails } from './stage-details.js';

/**
 * Which signal decides whether two entries are "related" and therefore packed
 * into the same LLM batch across all chunked batch operations (translate, judge,
 * source review). `none` disables grouping (entries pack in input order).
 *  - `category` — group by an entry's exact `categories` set.
 *  - `glossary` — group by an entry's exact `assignedGlossaryIds` set.
 *  - `both`     — group by the exact (categories, glossaries) pair.
 * Grouping uses exact-set matching (not transitive/union-find) to avoid one
 * broad category merging the whole project into a single group.
 */
export const BATCH_GROUPING_DIMENSIONS = ['none', 'category', 'glossary', 'both', 'tone'] as const;

export type BatchGroupingDimension = (typeof BATCH_GROUPING_DIMENSIONS)[number];

export type ModuleConfigValues = Record<string, unknown> & {
  batchMode?: ModuleBatchMode;
};

/**
 * Per-module configuration entry attached to a project. Supports inheriting
 * the workspace-level Global Config by default; an explicit `inheritGlobal:false`
 * means the project's `config` replaces (rather than merges over) global.
 *
 * `active` — whether this module is switched on for this project (default `true` when
 * absent; shadows or supplements the global `active` value depending on `inheritGlobal`).
 */
export interface ProjectModuleConfigEntry {
  active?: boolean;
  /** Defaults to `true` when missing (lazy-migration of legacy project JSON). */
  inheritGlobal: boolean;
  config: ModuleConfigValues;
}

/**
 * Curated icon set selectable as a project icon. The server rejects any
 * value outside this list (arbitrary strings never reach project JSON).
 */
export const PROJECT_ICONS = [
  '🎮',
  '🕹️',
  '🎲',
  '⚔️',
  '🛡️',
  '🏆',
  '🗺️',
  '💎',
  '🔮',
  '🏹',
  '💀',
  '🧙',
  '🐉',
  '🏰',
  '🪄',
  '⚡',
] as const;

export const DEFAULT_PROJECT_ICON = PROJECT_ICONS[0];

/**
 * Remembered module/model selection for an AI run engine (judge or source
 * review). Each field is optional — absent ⇒ the engine auto-selects.
 */
export interface AiRunModuleSelection {
  moduleId?: string;
  model?: string;
  reasoningEffort?: string;
}

export interface Project {
  id: string;
  name: string;
  /** Identifier from the curated PROJECT_ICONS set. Absent = default icon. */
  icon?: string;
  sourceLanguage: string;
  activeLanguages: string[];
  /** Legacy flat routing list retained for compatibility; mirrors the active group's rules. */
  routingRules: RoutingRule[];
  /** Optional grouped routing configuration used by the Batch tab. */
  routingRuleGroups?: RoutingRuleGroup[];
  /** Id of the active routing group. Exactly one group is active at a time. */
  activeRoutingRuleGroupId?: string | null;
  /**
   * Glossary IDs that are always applied during translation regardless of routing rules.
   * When absent or empty, all project glossaries are used (default behaviour).
   */
  forcedGlossaryIds?: string[];
  /**
   * Read path tolerates legacy shapes (`Record<string, unknown>`); M1 normalises
   * each entry on load. New writes always use `ProjectModuleConfigEntry`.
   */
  moduleConfigs: Record<string, ProjectModuleConfigEntry>;
  /**
   * Optional LQA check pipeline configuration (M10). Absent ⇒ default pipeline
   * (legacy built-in checks enabled, advanced checks disabled).
   */
  lqaConfig?: ProjectLQAConfig;
  /**
   * LLM-as-judge settings for AI review runs. Absent ⇒ the judge engine
   * picks the cheapest enabled judge-capable module automatically. Remembers
   * the last-used translation-review selection so it becomes the default.
   */
  judgeConfig?: AiRunModuleSelection;
  /**
   * Last-used source-review selection. Absent ⇒ the source-review engine picks
   * the cheapest enabled review-capable module automatically. Mirrors
   * {@link judgeConfig} but for source ("Source AI review") runs.
   */
  sourceReviewConfig?: AiRunModuleSelection;
  /**
   * Translation-memory match policy for this project. Absent means `disabled`.
   */
  tmPolicy?: TmMatchPolicy;
  /**
   * Per-project override for the batch-grouping dimension. Absent (or explicit
   * `null`) ⇒ inherit the workspace-level {@link WorkspaceSettings.batchGrouping}
   * (which itself defaults to `none`). The Config-tab control writes `null` to
   * clear a previously-set override back to "inherit"; `resolveBatchGrouping`
   * treats `null` and absent identically via `??`.
   */
  batchGrouping?: BatchGroupingDimension | null;
  /**
   * Per-project override: when `true`, a related-entry group is sent as a single
   * batch regardless of the per-process size cap. Absent (or explicit `null`) ⇒
   * inherit the workspace-level {@link WorkspaceSettings.ignoreBatchSizeLimit}
   * (default `false`). See the cost/latency caveat in the settings hint.
   */
  ignoreBatchSizeLimit?: boolean | null;
  /**
   * Optional per-category descriptions, keyed by category name. Categories
   * themselves have no standalone storage (they exist via entry assignment); this
   * side-map carries the human-authored description shown in the Category tab. A
   * description for a category with no remaining entries simply lingers unused.
   */
  categoryDescriptions?: Record<string, string>;
  /**
   * Owner-only toggle (manual-edit-audit feature): when `true`, a manual text
   * edit made through the string write path on a shared project is recorded
   * as a `manual_edits` audit row (see `StringStore.updateEntry`/`bulkUpdate`'s
   * `opts.recordManualEdits`). Absent ⇒ `false` (off by default). Set via
   * `PATCH /api/projects/:id/manual-edit-audit`.
   */
  manualEditAuditEnabled?: boolean;
  /**
   * Stage details — name / Gameplay details / Stage description with
   * per-language translations. Absent until first edited.
   */
  stageDetails?: StageDetails;
  /**
   * Last-used stage-details module/model selection. Absent ⇒ the M31 engine
   * picks the cheapest enabled translate-capable module automatically.
   */
  stageDetailsConfig?: AiRunModuleSelection;
  createdAt: number;
  updatedAt: number;
}

/**
 * Workspace-wide per-module entry; no inheritance flag (it is the source).
 *
 * `enabled` — availability gate: whether the module is available for use in
 * this workspace at all (default `false` when absent — all modules off by default).
 *
 * `active`  — operational toggle: whether the module is currently switched on
 * (default `true` when absent; only relevant when `enabled` is `true`).
 */
export interface GlobalModuleConfigEntry {
  /** Availability gate — default `false`. Must be `true` for the module to appear in project config. */
  enabled?: boolean;
  /** On/off toggle for this module — default `true` when absent. */
  active?: boolean;
  config: ModuleConfigValues;
}

/** Workspace-wide non-module settings. */
export interface WorkspaceSettings {
  maxBackupsPerProject?: number;
  /** Default overflow ratio applied to newly imported entries. Default: 1.75. */
  overflowRatio?: number;
  /**
   * Global client-side rate limit applied to every network-bound translation
   * module (per outbound HTTP request, one limiter per module id).
   * 0 / unset = disabled.
   */
  requestsPerSecond?: number;
  /**
   * Workspace-default batch-grouping dimension applied to every chunked LLM
   * batch operation. Absent ⇒ `none`. Per-project {@link Project.batchGrouping}
   * overrides this.
   */
  batchGrouping?: BatchGroupingDimension;
  /**
   * Workspace default: when `true`, a related-entry group is sent as a single
   * batch regardless of the per-process size cap. Absent ⇒ `false`. Per-project
   * {@link Project.ignoreBatchSizeLimit} overrides this.
   */
  ignoreBatchSizeLimit?: boolean;
  /**
   * Per-request timeout (ms) applied to every LLM provider call (translate,
   * judge, source-review, glossary, category) across both module families.
   * Absent ⇒ {@link DEFAULT_REQUEST_TIMEOUT_MS} (300000 = 5 min). A fired timeout
   * is a transient error, so the review paths retry it at a smaller batch size.
   */
  requestTimeoutMs?: number;
  /**
   * Per-request output-token cap applied to every LLM provider call across both
   * module families. 0 / unset = unlimited (each provider applies its own
   * maximum instead of an artificial ceiling that could truncate a large
   * structured-output response).
   */
  maxOutputTokens?: number;
  /**
   * Per-provider Freeway routing override, keyed by BASE module id -> instance
   * id. Absent or unresolvable ⇒ automatic candidate resolution (see
   * `freewayCandidateIds` in the server's M32 bucket-source). A stale entry —
   * naming an instance that was renamed, deleted, disabled, or lost its
   * credentials — is never honoured; Freeway falls through to the automatic
   * order rather than taking the provider offline.
   */
  freewayInstanceOverrides?: Record<string, string>;
}

/** Workspace-wide module configuration shared by all projects. */
export interface GlobalConfig {
  /**
   * Migration marker. Bumped by one-time data migrations so they run exactly
   * once and are idempotent. Absent ⇒ pre-migration (treated as version 0).
   */
  schemaVersion?: number;
  moduleConfigs: Record<string, GlobalModuleConfigEntry>;
  /**
   * Named instances of base modules (e.g. `generic-ai:my-ollama`). Their
   * configs live in `moduleConfigs` under the instance id like any module.
   */
  moduleInstances?: ModuleInstance[];
  settings?: WorkspaceSettings;
}
