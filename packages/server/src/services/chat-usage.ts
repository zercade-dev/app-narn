/**
 * Chat-session usage capture.
 *
 * Each AI-assistant chat session (the Text Styler and the stage-details
 * assistant) is recorded as a single `chat`-kind run whose id is derived from
 * the session id, so the Activity tab can surface the tokens/cost a chat
 * conversation spent — the same per-(module, model) accounting translation runs
 * use, just accumulated across the session's turns instead of a run's jobs.
 *
 * A turn is a TWO-PHASE lifecycle so the run is visible while it is in flight
 * rather than appearing only once the reply has finished:
 *
 *  - {@link startChatTurn} runs at dispatch. It increments `turns` and writes
 *    the run as `Running` with `completed` trailing by one, so Activity renders
 *    the turn as in progress.
 *  - {@link finishChatTurn} runs when the turn settles — completed, failed or
 *    cancelled. It folds this turn's usage in via M9's shared `accumulateUsage`,
 *    re-prices the aggregate via `finalizeUsageCosts`, and writes the terminal
 *    status. It does NOT increment `turns` again; start already counted it.
 *
 * Both are read-modify-write upserts through `RunStore.updateRun`, and both are
 * invoked fire-and-forget by the chat routes, so neither may sit on the
 * response's critical path — callers `.catch()` any rejection.
 *
 * Race note: `updateRun` holds the store's per-project write lock only for the
 * upsert itself, NOT across the preceding `getRun`, so two turns of the SAME
 * session racing would lose one turn's tokens (last write wins). In practice a
 * session's turns are strictly sequential (the user awaits each streamed reply
 * before sending the next), and this is best-effort usage telemetry, so the
 * unlocked read-modify-write window is acceptable. Different sessions write
 * different run rows and never contend.
 */
import { RunStatusCode, type ChatKindLabel, type RunStatus } from '@zercade-dev/narn-shared';
import { getRunStore } from '../storage/registry.js';
import type { RunStore } from '../storage/types.js';
import {
  accumulateUsage,
  finalizeUsageCosts,
  defaultPricingProvider,
  type PricingProvider,
} from '../modules/M9/usage-pricing.js';
import { sweepOrphanedRuns, PROCESS_START_MS } from '../modules/M9/run-capacity.js';
import { logger } from '../modules/M15-console-logger.js';

/** The stable run id a chat session maps to (one run per session). */
export function chatRunId(chatSessionId: string): string {
  return `chat:${chatSessionId}`;
}

/** Identity of the turn — everything both phases need to address the run row. */
export interface ChatTurnIdentity {
  /** The frontend-generated session id; the run id is `chat:${chatSessionId}`. */
  chatSessionId: string;
  /** Project the session belongs to (RLS/tenancy scope of the run row). */
  projectId: string;
  /** Which assistant produced the turn. */
  kindLabel: ChatKindLabel;
  /** Module/instance id the turn was sent to (e.g. `anthropic:default`). */
  instanceId: string;
  /** Model id the turn ran against. */
  model: string;
}

export type StartChatTurnOpts = ChatTurnIdentity;

/** How a turn ended. `cancelled` is a client disconnect mid-stream. */
export type ChatTurnOutcome = 'completed' | 'failed' | 'cancelled';

export interface FinishChatTurnOpts extends ChatTurnIdentity {
  /** The turn's final token usage, as surfaced by the streaming helper. */
  usage: { inputTokens: number; outputTokens: number };
  outcome: ChatTurnOutcome;
  /** Appended to the run's `errors` when the turn failed. */
  errorMessage?: string;
}

/**
 * Injectable seams so tests avoid the real Postgres store + pricing feed.
 * `listRuns` is required because {@link startChatTurn} also drives the
 * once-per-process orphan sweep.
 */
export interface RecordChatTurnDeps {
  runStore?: Pick<RunStore, 'getRun' | 'updateRun' | 'listRuns'>;
  pricing?: PricingProvider;
}

const OUTCOME_STATUS: Record<ChatTurnOutcome, RunStatusCode> = {
  completed: RunStatusCode.Completed,
  failed: RunStatusCode.Failed,
  cancelled: RunStatusCode.Cancelled,
};

/**
 * Projects whose orphan sweep has already run this process. Mirrors M9's
 * `sweptProjects` set: a chat turn is not the only sweep trigger, and doing it
 * once per project is enough to reconcile a prior process generation.
 */
const sweptChatProjects = new Set<string>();

/** Test seam: forget which projects have been swept this process. */
export function __resetChatSweepForTests(): void {
  sweptChatProjects.clear();
}

/**
 * Reconcile `projectId`'s crash/redeploy-orphaned runs the first time a chat
 * turn touches it this process, reusing M9's `sweepOrphanedRuns`.
 *
 * Without this, a chat run left `Running` by a restart is only settled if the
 * project later enqueues a TRANSLATION (M9's `enqueue` is the sole other sweep
 * trigger) — so a chat-only project could show a permanently running turn.
 *
 * Marked before awaiting so two parallel first-turns don't both sweep, and
 * best-effort: a store hiccup must never block the turn.
 */
async function sweepChatProjectOnce(
  projectId: string,
  runStore: Pick<RunStore, 'listRuns' | 'updateRun'>,
): Promise<void> {
  if (sweptChatProjects.has(projectId)) return;
  sweptChatProjects.add(projectId);
  try {
    const swept = await sweepOrphanedRuns(runStore, projectId);
    if (swept > 0) logger.warn('chat:orphaned-runs-swept', { projectId, count: swept });
  } catch (err) {
    logger.warn('chat:orphan-sweep-failed', {
      projectId,
      error: err instanceof Error ? err.message : `${err}`,
    });
  }
}

/**
 * Open (or re-open) the session's run for a turn that has just been dispatched,
 * creating it on the first turn. `turns` increments HERE so the in-flight turn
 * is already counted, and `completed` trails it by one so Activity shows the
 * turn as running rather than done.
 *
 * Best-effort: callers invoke it fire-and-forget and `.catch()` any rejection —
 * it must never fail or delay the first streamed byte.
 */
export async function startChatTurn(
  opts: StartChatTurnOpts,
  deps: RecordChatTurnDeps = {},
): Promise<void> {
  const runStore = deps.runStore ?? getRunStore();
  const runId = chatRunId(opts.chatSessionId);
  const now = Date.now();

  // Reconcile this project's crash/redeploy-orphaned runs once per process,
  // BEFORE writing this turn's row — so a chat run stranded `Running` by a
  // restart is settled even when the project never sees a translation (M9's
  // enqueue is the only other sweep trigger).
  await sweepChatProjectOnce(opts.projectId, runStore);

  const existing = await runStore.getRun(opts.projectId, runId);
  const turns = (existing?.chatSummary?.turns ?? 0) + 1;

  const status: RunStatus = {
    runId,
    projectId: opts.projectId,
    status: RunStatusCode.Running,
    total: turns,
    completed: turns - 1,
    failed: 0,
    // Preserve the session's original start time WITHIN a process, but re-stamp
    // it when it predates this process. `sweepOrphanedRuns` classifies a
    // non-terminal run as orphaned purely by `startedAt < PROCESS_START_MS`, so
    // a resumed pre-restart session that kept its old timestamp would be flipped
    // to `Failed` by a concurrent sweep WHILE its turn was still streaming.
    startedAt:
      existing?.startedAt !== undefined && existing.startedAt >= PROCESS_START_MS
        ? existing.startedAt
        : now,
    // Deliberately no `finishedAt`: an in-flight run has not finished, and the
    // Activity tab keys "still running" off its absence.
    errors: existing?.errors ?? [],
    // Carry the accumulated usage/cost forward untouched — this phase adds no
    // tokens, it only flips the row to Running.
    usageByModule: existing?.usageByModule ?? [],
    ...(existing?.estimatedCostUsd !== undefined
      ? { estimatedCostUsd: existing.estimatedCostUsd }
      : {}),
    kind: 'chat',
    chatSummary: {
      chatKind: opts.kindLabel,
      instanceId: opts.instanceId,
      model: opts.model,
      turns,
    },
  };

  await runStore.updateRun(opts.projectId, status);
}

/**
 * Settle the turn opened by {@link startChatTurn}: fold this turn's tokens into
 * the session's aggregate, re-price it, and write the terminal status.
 *
 * Tokens are folded in even for a cancelled turn — the provider call already
 * happened and cost money regardless of whether the client stayed connected,
 * matching the run engines' rule.
 */
export async function finishChatTurn(
  opts: FinishChatTurnOpts,
  deps: RecordChatTurnDeps = {},
): Promise<void> {
  const runStore = deps.runStore ?? getRunStore();
  const pricing = deps.pricing ?? defaultPricingProvider;
  const runId = chatRunId(opts.chatSessionId);
  const now = Date.now();

  const existing = await runStore.getRun(opts.projectId, runId);
  // `turns` was incremented by startChatTurn. Defaulting to 1 (not 0) keeps the
  // count honest if that write failed or never ran — a settled turn is a turn.
  const turns = existing?.chatSummary?.turns ?? 1;
  const errors = [...(existing?.errors ?? [])];
  if (opts.errorMessage) errors.push({ message: opts.errorMessage, timestamp: now });

  const status: RunStatus = {
    runId,
    projectId: opts.projectId,
    status: OUTCOME_STATUS[opts.outcome],
    total: turns,
    completed: opts.outcome === 'completed' ? turns : turns - 1,
    failed: opts.outcome === 'failed' ? 1 : 0,
    startedAt: existing?.startedAt ?? now,
    finishedAt: now,
    errors,
    // Carry the accumulated per-(module, model) usage forward so this turn adds
    // to it rather than replacing it.
    usageByModule: existing?.usageByModule ?? [],
    kind: 'chat',
    chatSummary: {
      chatKind: opts.kindLabel,
      instanceId: opts.instanceId,
      model: opts.model,
      turns,
    },
  };

  // Fold this turn's tokens into usageByModule keyed by (instanceId, model),
  // reusing M9's aggregation so the accounting matches translation runs.
  accumulateUsage(status, opts.instanceId, [
    {
      inputTokens: opts.usage.inputTokens,
      outputTokens: opts.usage.outputTokens,
      model: opts.model,
    },
  ]);
  // Re-price the whole aggregate from the bundled pricing snapshot — idempotent,
  // recomputing estimatedCostUsd from the accumulated totals on every turn.
  await finalizeUsageCosts(status, pricing);

  await runStore.updateRun(opts.projectId, status);
}
