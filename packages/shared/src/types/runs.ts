import type { JudgeVerdict } from './judge.js';
import type { ProviderUsageBilling } from './module.js';
import type { BatchGroupingDimension } from './project.js';
import type { TranslationRecord } from './string-entry.js';

/**
 * Status codes for a translation run.
 */
export enum RunStatusCode {
  Pending = 'pending',
  /** Created while another run for the project was in progress; waiting its turn. */
  Queued = 'queued',
  Running = 'running',
  /** Dequeuing of new jobs is suspended; in-flight jobs finish normally. */
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/**
 * The original translate request of a run. Stored on queued runs so routing
 * can be (re-)computed at dequeue time — module configs and routing rules may
 * have changed between enqueue and start — and so a pending queue survives a
 * server restart.
 */
export interface RunRequest {
  entryIds: string[];
  targetLanguages: string[];
  reTranslate: boolean;
  /**
   * Language whose existing translations are attached to each job as LLM
   * prompt context ("reference translation"). Optional; LLM modules only.
   */
  referenceLanguage?: string;
  /**
   * When present, restricts the run to exactly these (entryId, targetLanguage)
   * pairs instead of the full `entryIds × targetLanguages` cross-product. Used
   * by "retry failed" to re-attempt only the pairs that errored in a prior run.
   */
  pairs?: RunEntryLanguagePair[];
  /**
   * Entry ids whose existing translations ride along as few-shot style
   * examples ("translate these the way I translated those"). Resolved once at
   * run start into per-target-language source → translation pairs and attached
   * to each job as `TranslationJob.examples`. Ids that are unknown, have no
   * usable translation, or overlap `entryIds` are dropped (logged, not an
   * error). Max 10 (enforced at the route and again at resolution).
   */
  exampleEntryIds?: string[];
  /**
   * When true, the translation-memory auto-apply path is skipped for this run:
   * every entry is sent to the model regardless of any stored TM variant. The
   * project's match policy is otherwise unchanged. Absent/false = default
   * behaviour (consult the memory).
   */
  disableMemory?: boolean;
  /**
   * Per-run override for the related-entry batch-grouping dimension. Absent ⇒
   * inherit the project/workspace setting (resolved at run start). Lets the
   * Translate dialog pick grouping for one run without changing the saved config.
   */
  batchGrouping?: BatchGroupingDimension;
  /**
   * Per-run override for the ignore-batch-size-limit toggle. Absent ⇒ inherit
   * the project/workspace setting.
   */
  ignoreBatchSizeLimit?: boolean;
  /**
   * Per-run override of how many entries each provider call holds — the
   * Translate dialog's "Custom" batch-grouping choice. `0` means unlimited:
   * each (module, target language[, model override]) partition is sent as one
   * request. Mutually exclusive with `batchGrouping`/`ignoreBatchSizeLimit` on
   * the wire (the dialog sends one or the other, never both); when present it
   * forces related-entry footprint grouping off for this run regardless of
   * the project/workspace setting.
   */
  customBatchSize?: number;
  /**
   * When true, and the run is routed to two or more distinct local Ollama
   * models, the run processes one model's jobs fully before the next and
   * unloads the previous model from VRAM between phases (only one model
   * resident at a time). No effect when fewer than two distinct local Ollama
   * models are affected. Absent/false = all jobs dispatched together, as usual.
   */
  splitByModel?: boolean;
}

/** A single (entry, target language) job target within a {@link RunRequest}. */
export interface RunEntryLanguagePair {
  entryId: string;
  targetLanguage: string;
}

/**
 * Error details for a single item within a translation run.
 */
export interface RunErrorEntry {
  stringId?: string;
  sourceText?: string;
  targetLang?: string;
  message: string;
  timestamp: number;
}

/**
 * Aggregated usage for one (moduleId, model) pair within a run.
 *
 * All figures are module-reported estimates; `estimatedCostUsd` is present
 * only when a pricing lookup succeeded for `model` — it is NEVER zero-filled
 * for unknown pricing.
 */
export interface RunUsageEntry extends ProviderUsageBilling {
  moduleId: string;
  /** Estimated cost in USD, when per-token pricing is known for `model`. */
  estimatedCostUsd?: number;
}

/** Aggregated verdicts of a judge (AI review) run. */
export interface JudgeRunSummary {
  judged: number;
  flagged: number;
  /** Mean of per-item scores (0–100); absent until at least one verdict. */
  averageScore?: number;
}

/** Aggregated findings of a source-language AI review run. */
export interface SourceReviewRunSummary {
  /** Number of source entries reviewed. */
  reviewed: number;
  /** Number of reviewed entries with at least one finding. */
  flagged: number;
  /** Total findings across all reviewed entries. */
  findings: number;
}

/** Aggregated result of an AI glossary-generation run. */
export interface GlossaryGenRunSummary {
  /** Number of distinct source entries analysed. */
  analyzed: number;
  /** Number of glossaries suggested. */
  suggested: number;
}

/**
 * Aggregated result of a Relink-tab AI retranslate run: one job per target
 * language that already had a translation on the relinked-onto entry.
 */
export interface RelinkRetranslateRunSummary {
  /** Number of target-language translations successfully updated. */
  updated: number;
  /** Number of target-language translations that failed to update. */
  failed: number;
}

/**
 * The assistant surface a `chat`-kind run aggregates usage for.
 */
export type ChatKindLabel = 'text-styler' | 'stage-details';

/**
 * Aggregated usage for an AI-assistant chat SESSION (run kind `'chat'`): one
 * run per session, accumulating across turns. Unlike a translation run a chat
 * run is never queued or cancellable — it is upserted as `completed` after each
 * turn finishes streaming, with the turn's tokens folded into `usageByModule`.
 */
export interface ChatRunSummary {
  /** Which assistant produced the session's turns. */
  chatKind: ChatKindLabel;
  /** Module/instance id the turns were sent to (e.g. `anthropic:default`). */
  instanceId: string;
  /** Model id the turns were run against. */
  model: string;
  /** Number of completed chat turns folded into this run so far. */
  turns: number;
}

/**
 * Discriminator for a run's kind. Absent (legacy) means a translation run.
 * `judge` reviews existing translations; `source-review` reviews source text;
 * `glossary-gen` suggests glossaries from the source text; `chat` aggregates
 * an AI-assistant chat session's per-turn token usage (never queued/cancellable).
 */
export type RunKind =
  | 'translate'
  | 'judge'
  | 'source-review'
  | 'glossary-gen'
  | 'category-gen'
  | 'relink-retranslate'
  | 'stage-details'
  | 'chat';

/**
 * User-facing run "type" surfaced in the Activity tab, derived from {@link RunKind}.
 */
export type RunType =
  | 'translation'
  | 'translation-ai-review'
  | 'source-ai-review'
  | 'glossary-generation'
  | 'category-generation'
  | 'relink-retranslate'
  | 'stage-details-translation';

/**
 * Whether a run kind produced translations. Allowlist by design: a run is a
 * translation run only when `kind` is `'translate'` (or absent, for legacy
 * runs persisted before `kind` existed). Every other kind (judge,
 * source-review, glossary-gen, category-gen) is excluded — a blacklist would
 * silently leak any future kind. Shared by the frontend's `isTranslationRun`
 * (`packages/frontend/src/lib/run-kind.ts`) and the server's revert route
 * guard so the two never drift.
 */
export function isTranslationRunKind(kind: RunKind | undefined): boolean {
  return kind === undefined || kind === 'translate';
}

/**
 * Whether a run of this kind persists a `details-<runId>.json` sidecar
 * (entries / chars / previousValues) and therefore supports the Activity
 * tab's "Show details" and "Revert" affordances. Allowlist by design, like
 * {@link isTranslationRunKind}: translation runs (M9) and relink-retranslate
 * runs (M30) capture details; every other kind does not.
 */
export function hasRunDetailsKind(kind: RunKind | undefined): boolean {
  return isTranslationRunKind(kind) || kind === 'relink-retranslate';
}

/** Maps a run's {@link RunKind} to its user-facing {@link RunType}. */
export function runTypeLabel(kind: RunKind | undefined): RunType {
  switch (kind) {
    case 'judge':
      return 'translation-ai-review';
    case 'source-review':
      return 'source-ai-review';
    case 'glossary-gen':
      return 'glossary-generation';
    case 'category-gen':
      return 'category-generation';
    case 'relink-retranslate':
      return 'relink-retranslate';
    case 'stage-details':
      return 'stage-details-translation';
    default:
      return 'translation';
  }
}

/**
 * One persisted per-(entry, language) verdict from an AI review run. The full
 * list is stored in a `verdicts-<runId>.json` sidecar — kept out of `runs.json`
 * so the hot-path run-progress writes stay small — and surfaced as the
 * disaggregated detail behind the run's average score.
 */
export interface JudgeVerdictRecord extends Omit<JudgeVerdict, 'error' | 'usage'> {
  /**
   * The restored translation text that was actually reviewed, captured at judge
   * time. Lets the AI-review detail render and diff the verdict without
   * re-resolving the live translation — which may have since been edited,
   * re-translated, or removed. Absent on verdicts recorded before this field
   * existed; readers fall back to the live translation then.
   */
  judgedText?: string;
}

/**
 * One captured verbose log line from an AI-review run's judge module — the full
 * prompt/params it sent and the raw model response. Recorded only when the run
 * was started with `verbose` on, stored in a `judge-logs-<runId>.json` sidecar
 * (kept out of `runs.json`), and surfaced behind the AI-review detail dialog so
 * glossary/context issues can be debugged without server console access.
 */
export interface JudgeLogEntry {
  /** Epoch ms when the line was emitted. */
  at: number;
  level: 'info' | 'warn' | 'error';
  /** The log message, e.g. "[anthropic] judge:request" / "judge:response". */
  message: string;
  /**
   * Structured payload behind the message — model/params plus the `system` and
   * `user` prompt on a request, or the raw `text`/usage/finishReason on a
   * response. Credential-redacted before persistence.
   */
  meta?: Record<string, unknown>;
}

/** One translated (entry, target language) within a run's detail sidecar. */
export interface RunDetailEntry {
  entryId: string;
  /** Source-language text of the entry (no category/context). */
  sourceText: string;
  targetLanguage: string;
}

/**
 * A (entry, target language) that was retried within a run, with the number of
 * retry attempts made (429 backoff retries + the LQA `retryWithFeedback` pass).
 */
export interface RunDetailRetry {
  entryId: string;
  sourceText: string;
  targetLanguage: string;
  count: number;
}

/**
 * Character accounting for a run, accumulated across all attempts (retries
 * included). All figures are summed from module-reported {@link import('./module.js').TranslationUsage}.
 */
export interface RunCharTotals {
  /** Input chars including everything — prompt, context, format. */
  inputTotal: number;
  /** Input chars of source text only. */
  inputSource: number;
  /** Output chars including everything — full raw responses. */
  outputTotal: number;
  /** Output chars of the translations actually used (OK results). */
  outputUsed: number;
}

/**
 * The translation record an (entry, target language) held immediately before a
 * translation run overwrote it — captured once per pair, the first time the run
 * persists a result for it (a later LQA-retry re-persist for the same pair does
 * NOT re-capture, so the value is always "before this run touched it at all").
 * `previousValue` is `null` when the pair had no translation before the run
 * (revert then clears the language rather than restoring a record).
 */
export interface RunDetailPreviousValue {
  entryId: string;
  targetLanguage: string;
  previousValue: TranslationRecord | null;
}

/**
 * Per-run detail recorded for a translation run. Stored in a
 * `details-<runId>.json` sidecar — kept out of `runs.json` so the hot-path
 * run-progress writes stay small — and surfaced behind the Activity tab's
 * "Show details" affordance. Applies to both batch and single runs.
 */
export interface RunDetails {
  runId: string;
  entries: RunDetailEntry[];
  retries: RunDetailRetry[];
  chars: RunCharTotals;
  /**
   * Snapshot of each affected (entry, target language)'s translation just
   * before this run overwrote it. Absent on runs persisted before revert
   * shipped. Backs the Activity tab's "Revert" action.
   */
  previousValues?: RunDetailPreviousValue[];
}

/**
 * Core data structure for tracking the progress and history of translation runs.
 */
export interface RunStatus {
  runId: string;
  projectId: string;
  /**
   * User id of the tenant whose request created the run (collab attribution).
   * Absent on runs persisted before migration 0024 — treat as owner-created.
   */
  createdBy?: string;
  status: RunStatusCode;
  total: number;
  completed: number;
  failed: number;
  startedAt: number;
  finishedAt?: number;
  errors: RunErrorEntry[];
  /** Per-(module, model) usage aggregation. Additive; absent on legacy runs. */
  usageByModule?: RunUsageEntry[];
  /**
   * Total estimated cost in USD across `usageByModule` entries with known
   * pricing. Absent (not 0) when no entry has a successful pricing lookup.
   */
  estimatedCostUsd?: number;
  /** Original request; present on queued runs (routing re-runs at dequeue). */
  request?: RunRequest;
  /** Discriminates AI-review (judge) and source-review runs from translation runs. Absent = translate. */
  kind?: RunKind;
  /** For judge runs: the translation run being reviewed. */
  sourceRunId?: string;
  /** For judge runs: aggregated verdict summary. */
  judgeSummary?: JudgeRunSummary;
  /** For source-review runs: aggregated findings summary. */
  sourceReviewSummary?: SourceReviewRunSummary;
  /** For glossary-generation runs: aggregated suggestion summary. */
  glossaryGenSummary?: GlossaryGenRunSummary;
  /** For relink-retranslate runs: aggregated per-language update summary. */
  relinkRetranslateSummary?: RelinkRetranslateRunSummary;
  /** For chat-session runs (kind `'chat'`): per-session turn/usage aggregation. */
  chatSummary?: ChatRunSummary;
  /**
   * For translation runs: average score (0–100) of the most recent completed
   * AI review of this run. Presence means the run was already reviewed.
   */
  aiScore?: number;
  /** Position within the project's pending queue; lower starts first. */
  queuePosition?: number;
  /**
   * For translation runs: true once this run's affected entries have been
   * reverted to their pre-run values. Reverting is one-shot — the Activity
   * tab disables further reverts on a run once this is set.
   */
  reverted?: boolean;
  /** Epoch ms when the run was reverted. Absent unless `reverted` is true. */
  revertedAt?: number;
}
