import { create } from 'zustand';
import {
  RunStatus,
  RunStatusCode,
  runTypeLabel,
  type BatchGroupingDimension,
  type JudgeChecks,
  type JudgeVerdictRecord,
  type JudgeLogEntry,
  type RunDetails,
  type SourceReviewFinding,
  type GlossarySuggestion,
  type CategorySuggestion,
} from '@zercade-dev/narn-shared';
import { apiRequest } from '../hooks/use-api.js';
import { RUN_TYPE_KEY, isChatRun, isRunActive } from '../lib/run-kind.js';
import { getErrorMessage } from '../lib/utils.js';
import { mutateThenRefresh, runAction } from './store-helpers.js';
import { toast } from '../lib/toast.js';
import i18n from '../i18n/index.js';

/**
 * One per-entry source-review record. Mirrors the server's `SourceReviewRecord`
 * (M22 run store), which is not exported from `@zercade-dev/narn-shared`; re-declared
 * locally so the frontend never imports server code.
 */
export interface SourceReviewRecord {
  entryId: string;
  /** The source text reviewed, captured at review time. */
  sourceText: string;
  findings: SourceReviewFinding[];
  /**
   * Optional unified corrected source for the whole entry — the exact
   * replacement value only. Absent when the source is clean.
   */
  suggestion?: string;
  /** True once the user approved this entry; persisted server-side. */
  approved?: boolean;
}

/**
 * "Last sorted" meta for the local word-similarity review pre-sort. `computed`
 * is `false` (and the other fields absent) when the project was never pre-sorted.
 */
export interface ReviewOrderMeta {
  computed?: boolean;
  version?: number;
  computedAt?: number;
  count?: number;
}

/**
 * Per-run override for {@link RunStore.judgeRun}: picks the judge module/model
 * and tweaks how findings are produced. An absent field falls back to the
 * project's judge config.
 */
export interface JudgeRunOverride {
  moduleId?: string;
  model?: string;
  reasoningEffort?: string;
  verbose?: boolean;
  /** Language code the AI writes its findings in; absent/'en' = English. */
  responseLanguage?: string;
  /** Per-run related-entry grouping override; absent = project/workspace. */
  batchGrouping?: BatchGroupingDimension;
  ignoreBatchSizeLimit?: boolean;
  /** Opt-in quality checks (typo/grammar/clarity/unsafe on the translated
   * text; terminology is a no-op, kept for parity with source review's
   * checks shape). Absent = every check off. */
  checks?: JudgeChecks;
}

/**
 * Payload of the server-pushed `run-progress` SSE event — broadcast on the
 * same log-stream `EventSource` the console panel already consumes (see
 * `logger-store.ts`), so the runs poll gets near-real-time updates between
 * ticks without a second connection. `status` arrives as a plain string (the
 * wire contract), narrowed to `RunStatus['status']` when merged.
 */
export interface RunProgressEvent {
  runId: string;
  projectId: string;
  status: string;
  completed: number;
  failed: number;
  total: number;
}

interface RunStore {
  runs: RunStatus[];
  loading: boolean;
  error: string | null;
  pollingIntervalId: number | null;
  /** Project id the active polling interval targets, or null when not polling. */
  pollingProjectId: string | null;

  fetchRuns: (projectId: string) => Promise<void>;
  cancelRun: (projectId: string, runId: string) => Promise<void>;
  /**
   * Starts a report-only AI review (LLM-as-judge) of a completed translation
   * run. `runId` is optional: when absent, the request targets the
   * project-scoped judge route instead (reviews every currently-translated
   * entry, independent of any run — used by the "Review all translations"
   * action). `override` picks the judge module/model; an absent field falls
   * back to the project's judge config. `onVaultLockedRetry` is invoked with
   * the run result if the request was replayed after a vault unlock (the
   * original call rejects with a 423 in that case), so the caller can react
   * to the run that actually started post-unlock.
   */
  judgeRun: (
    projectId: string,
    runId: string | undefined,
    override?: JudgeRunOverride,
    onVaultLockedRetry?: (result: { runId: string; status: string }) => void,
  ) => Promise<void>;
  /** Re-enqueues only the (entry, language) pairs that failed in the given run. */
  retryRun: (projectId: string, runId: string) => Promise<void>;
  /**
   * Restores the pre-run translation values captured for a completed
   * translation run's affected entries, then marks the run reverted. Throws on
   * failure (already reverted, a newer completed run exists, nothing
   * captured, …) so the caller can surface the server's message.
   */
  revertRun: (projectId: string, runId: string) => Promise<{ reverted: number; total: number }>;
  /** Re-runs the judge on only the (entry, language) pairs that failed in a judge run. */
  retryJudgeRun: (projectId: string, runId: string) => Promise<void>;
  /** Loads the per-(string, language) verdict detail recorded for an AI-review run. */
  fetchVerdicts: (projectId: string, runId: string) => Promise<JudgeVerdictRecord[]>;
  /** Loads the verbose prompt/response log captured for an AI-review run (verbose runs only). */
  fetchJudgeLogs: (projectId: string, runId: string) => Promise<JudgeLogEntry[]>;
  /**
   * Re-runs the judge on a single (entry, targetLanguage) with a forced
   * suggestion, persists it onto the run's stored verdict, and resolves to the
   * updated verdict record. Backs the per-card "Generate suggestion" action;
   * throws on failure (vault locked, no judge module, …) so the caller can
   * surface it.
   */
  suggestVerdict: (
    projectId: string,
    runId: string,
    entryId: string,
    targetLanguage: string,
    instructions?: string,
  ) => Promise<JudgeVerdictRecord>;
  /** Removes the stored suggestion from a run's verdict (persisted discard). */
  discardVerdictSuggestion: (
    projectId: string,
    runId: string,
    entryId: string,
    targetLanguage: string,
  ) => Promise<JudgeVerdictRecord>;
  /**
   * Starts a report-only source-language AI review. Resolves to the new run's
   * id and total; throws on 400 (no check enabled) / 409 (no capable module).
   * Refetches runs and starts polling so the run's progress is observed.
   * `onVaultLockedRetry` is invoked with the run result if the request was
   * replayed after a vault unlock (the original call rejects with a 423 in that
   * case), so the caller can adopt the run that actually started post-unlock.
   */
  startSourceReview: (
    projectId: string,
    body: {
      entryIds?: string[];
      checks: {
        typo?: boolean;
        grammar?: boolean;
        terminology?: boolean;
        clarity?: boolean;
        unsafe?: boolean;
      };
      batchSize?: number;
      moduleId?: string;
      model?: string;
      /** Optional per-run reasoning-effort override; absent = model default. */
      reasoningEffort?: string;
      /** Language code the AI writes its finding detail text in; absent = English. */
      responseLanguage?: string;
      verbose?: boolean;
      /** Per-run related-entry grouping override; absent = project/workspace. */
      batchGrouping?: BatchGroupingDimension;
      ignoreBatchSizeLimit?: boolean;
      customBatchSize?: number;
    },
    onVaultLockedRetry?: (result: { runId: string; status: string }) => void,
  ) => Promise<{ runId: string; total: number; status: string }>;
  /** Loads the per-entry source-review records (source text + typed findings) for a run. */
  fetchSourceReview: (projectId: string, runId: string) => Promise<SourceReviewRecord[]>;
  /** Persists an "approved" disposition for one source-review entry of a run. */
  approveSourceReviewEntry: (projectId: string, runId: string, entryId: string) => Promise<void>;
  /** Removes ("ignores") one source-review entry from a run's stored findings. */
  ignoreSourceReviewEntry: (projectId: string, runId: string, entryId: string) => Promise<void>;
  /**
   * Starts a non-blocking AI glossary-generation run. Resolves to the new run's
   * id and status; throws on 409 (no suggest-capable module). Refetches runs and
   * starts polling so the run's progress is observed in the Activity tab.
   * `onVaultLockedRetry` is invoked with the run result if the request was
   * replayed after a vault unlock (the original call rejects with a 423 in that
   * case), so the caller can adopt the run that actually started post-unlock.
   */
  startGlossaryGen: (
    projectId: string,
    body: {
      moduleId?: string;
      model?: string;
      reasoningEffort?: string;
      excludeGlossaryIds?: string[];
      /** Scope generation to just these entries instead of the whole project. */
      entryIds?: string[];
      /** Exact source-text values to focus generation on (AND'd with entryIds). */
      focusSourceTexts?: string[];
      contextFields?: string[];
      contextLanguages?: string[];
      /** Per-run related-entry grouping override; absent = project/workspace. */
      batchGrouping?: BatchGroupingDimension;
      ignoreBatchSizeLimit?: boolean;
      customBatchSize?: number;
      skipCategories?: string[];
      /** Also extract term translations from the context languages' existing translations. */
      includeTranslations?: boolean;
    },
    onVaultLockedRetry?: (result: { runId: string; status: string }) => void,
  ) => Promise<{ runId: string; status: string }>;
  /** Loads the suggested glossaries recorded for a completed glossary-generation run. */
  fetchGlossarySuggestions: (projectId: string, runId: string) => Promise<GlossarySuggestion[]>;
  /** Loads the category suggestions a completed category-generation run produced. */
  fetchCategorySuggestions: (projectId: string, runId: string) => Promise<CategorySuggestion[]>;
  /** Runs the local word-similarity pre-sort; resolves to the new meta. */
  computeReviewOrder: (projectId: string) => Promise<{ count: number; computedAt: number }>;
  /** Loads the "last sorted" meta, or `{ computed: false }` when never pre-sorted. */
  fetchReviewOrder: (projectId: string) => Promise<ReviewOrderMeta>;
  /** Loads the per-run detail (translated entries, retries, character totals). */
  fetchRunDetails: (projectId: string, runId: string) => Promise<RunDetails | null>;
  pauseRun: (projectId: string, runId: string) => Promise<void>;
  resumeRun: (projectId: string, runId: string) => Promise<void>;
  /**
   * Resumes a run parked on `waitingForQuota` (or any paused run) with an
   * explicitly chosen module instead of waiting on the free pool. Mirrors
   * `pauseRun`/`resumeRun`'s envelope; re-throws so the server's 409/400
   * taxonomy message (not-parked, not-drained, project-busy, unknown-module,
   * module-unavailable, module-not-eligible) surfaces to the caller.
   */
  resumeRunWith: (projectId: string, runId: string, moduleId: string) => Promise<void>;
  reorderQueue: (projectId: string, runIds: string[]) => Promise<void>;
  startPolling: (projectId: string) => void;
  stopPolling: () => void;
  /**
   * Merges a server-pushed `run-progress` SSE event onto the matching run,
   * between poll ticks. Guarded so it can never regress or overwrite with
   * out-of-order data: applied only if `completed + failed` increased or
   * `status` changed since the stored run. An event for a runId not currently
   * in `runs` is dropped — the next poll tick will pick the run up. Polling
   * itself is untouched; it remains the reconciling source of truth.
   */
  applyProgressEvent: (e: RunProgressEvent) => void;
}

/**
 * Monotonic request token for {@link RunStore.fetchRuns}. Captured before the
 * await and re-checked after it resolves (and on the error path): a fetch whose
 * token is no longer the latest is stale — a newer fetch, or a project switch,
 * superseded it — so its result is dropped rather than clobbering the current
 * project's runs or re-targeting the poller. Store-global (single run store).
 */
let runFetchToken = 0;

/** Base poll cadence (ms) — the steady-state interval between run polls. */
const POLL_BASE_MS = 2000;
/** Ceiling for the error backoff so a persistently-failing poll still retries. */
const POLL_MAX_BACKOFF_MS = 30_000;
/** Consecutive failed polls after which the poller gives up (stops itself). */
const POLL_MAX_CONSECUTIVE_ERRORS = 5;

/**
 * True while a poll-driven fetch is in flight, so a scheduled tick that fires
 * before the previous fetch settled skips (reschedules) instead of stacking a
 * second overlapping request. Set only by the self-scheduling poll loop and the
 * immediate fetch it kicks off — direct `fetchRuns` calls from actions or
 * components are unaffected.
 */
let pollInFlight = false;
/** Count of consecutive failed polls, driving the backoff / give-up logic. */
let pollConsecutiveErrors = 0;

/**
 * Runs whose Failed transition has already been toasted in this poll session.
 *
 * There are TWO independent write paths into `runs` — the ~2s poll
 * (`fetchRuns`) and the server-pushed SSE `run-progress` event
 * (`applyProgressEvent`) — and either can be the first to observe a run turn
 * `Failed`. In normal desktop use the SSE path wins: `ConsolePanel` is mounted
 * unconditionally by `AppShell` (its `open` prop only controls visual
 * expansion), so the log stream is always connected, and the server flushes
 * TERMINAL statuses immediately, bypassing its own 150ms coalescing window
 * (`http/run-events.ts`). Notifying from both paths is therefore required for
 * the toast to fire at all; this set is what stops them from BOTH firing for
 * the same run (and stops a later poll tick re-toasting a still-`Failed` run).
 *
 * Cleared by `stopPolling` — which runs when the last active run settles, on a
 * project switch, and when the poller gives up — so the set never grows
 * unbounded over a long session and a fresh poll session starts clean.
 */
const notifiedFailedRunIds = new Set<string>();

/**
 * Fires the one-per-run `toast.error` for a run observed in
 * `RunStatusCode.Failed`, whichever write path observed it first. Idempotent
 * per runId via {@link notifiedFailedRunIds}.
 *
 * `kind: 'chat'` runs (`chat-usage.ts`'s `startChatTurn`/`finishChatTurn` —
 * verified: a failed chat turn writes `RunStatusCode.Failed` via
 * `OUTCOME_STATUS`) are explicitly excluded via the existing `isChatRun`
 * helper: the chat call sites already toast a chat failure precisely, at the
 * point of failure, with the real error message — this would otherwise
 * ALSO fire a second, generic, mislabeled toast for the same failure
 * (`runTypeLabel`'s switch has no `'chat'` case, so it would read
 * "Translation run failed" regardless of which chat actually failed).
 *
 * `errors` is optional in the caller's view because the SSE payload carries no
 * error list (`RunProgressEvent` is six scalar fields); an absent/empty list
 * just falls back to the bare "{{type}} run failed" label.
 */
function notifyFailedRun(
  run: Pick<RunStatus, 'runId' | 'kind'> & { errors?: RunStatus['errors'] },
): void {
  if (isChatRun(run)) return;
  if (notifiedFailedRunIds.has(run.runId)) return;
  notifiedFailedRunIds.add(run.runId);
  const typeLabel = i18n.t(RUN_TYPE_KEY[runTypeLabel(run.kind)], { ns: 'strings' });
  const base = i18n.t('runs.runFailedToast', { ns: 'strings', type: typeLabel });
  const message = run.errors?.[0]?.message;
  toast.error(message ? `${base}: ${message}` : base);
}

/**
 * Diffs a `fetchRuns` poll snapshot and notifies each run that just
 * transitioned into `RunStatusCode.Failed` — the single choke point every run
 * kind's polling flows through (translate, stage-details, source-review,
 * judge, glossary-gen, category-gen), so this covers all of them without six
 * per-tab toasts.
 *
 * `previousRuns` is `get().runs` captured immediately before the new `set()`
 * call in `fetchRuns` — i.e. the prior fetch's snapshot (or `[]` on the very
 * first fetch of a poll session, since `startPolling` resets `runs` to `[]`
 * before polling a new project). A run absent from `previousRuns` (first
 * observation of that runId) is skipped: there is no previous status to diff
 * against, so a page load that lands on an already-`Failed` run must not
 * toast on that first sighting. A run whose previous status was already
 * `Failed` is also skipped, so re-observing the same failed run on a later
 * poll tick never re-toasts. The actual toast (and its cross-path dedup) is
 * delegated to {@link notifyFailedRun}, which the SSE path also calls.
 */
function notifyFailedRunTransitions(previousRuns: RunStatus[], nextRuns: RunStatus[]): void {
  for (const run of nextRuns) {
    if (run.status !== RunStatusCode.Failed) continue;
    const prev = previousRuns.find((r) => r.runId === run.runId);
    if (!prev || prev.status === RunStatusCode.Failed) continue;
    notifyFailedRun(run);
  }
}

export const useRunStore = create<RunStore>((set, get) => {
  /**
   * Arm the next poll tick `delay` ms out and record it as the live poller.
   * A self-scheduling `setTimeout` chain (not a fixed `setInterval`) so ticks
   * never overlap — the next tick is only armed after the current fetch settles.
   */
  function schedulePoll(projectId: string, delay: number) {
    const timeoutId = globalThis.setTimeout(() => {
      void pollTick(projectId);
    }, delay);
    set({ pollingIntervalId: timeoutId as unknown as number, pollingProjectId: projectId });
  }

  /**
   * One poll tick: refetch runs (skipping if a fetch is already in flight so
   * requests never overlap), then reschedule — backing off on error and giving
   * up after {@link POLL_MAX_CONSECUTIVE_ERRORS} consecutive failures so a
   * completed-run poll that only ever errors can't spin forever. `fetchRuns`
   * stops the poller itself once no run is active, so the terminal case needs no
   * special handling here beyond honoring that stop.
   */
  async function pollTick(projectId: string) {
    // Polling was stopped or re-targeted while this tick was queued — abandon it.
    if (get().pollingProjectId !== projectId) return;
    if (pollInFlight) {
      // A fetch is still running (slow response) — don't overlap; retry next tick.
      schedulePoll(projectId, POLL_BASE_MS);
      return;
    }
    pollInFlight = true;
    await get().fetchRuns(projectId);
    pollInFlight = false;

    // `fetchRuns` may have stopped polling (nothing active anymore) or a switch
    // may have re-targeted it — in either case this tick must not re-arm.
    if (get().pollingProjectId !== projectId) return;

    if (get().error) {
      pollConsecutiveErrors++;
      if (pollConsecutiveErrors >= POLL_MAX_CONSECUTIVE_ERRORS) {
        get().stopPolling();
        return;
      }
      const backoff = Math.min(POLL_BASE_MS * 2 ** pollConsecutiveErrors, POLL_MAX_BACKOFF_MS);
      schedulePoll(projectId, backoff);
    } else {
      pollConsecutiveErrors = 0;
      schedulePoll(projectId, POLL_BASE_MS);
    }
  }

  return {
    runs: [],
    loading: false,
    error: null,
    pollingIntervalId: null,
    pollingProjectId: null,

    fetchRuns: async (projectId: string) => {
      if (!projectId) return;
      // Capture a token before the await; a project switch (or any newer fetch)
      // bumps it, so a late resolve here is recognised as stale and dropped.
      const token = ++runFetchToken;
      try {
        const runs = await apiRequest<RunStatus[]>(`/projects/${projectId}/runs`);
        // Stale response: a newer fetch/switch superseded this one. Dropping it
        // stops a previous project's in-flight poll from clobbering the current
        // project's runs and re-targeting/killing its poller.
        if (token !== runFetchToken) return;
        // Captured BEFORE the set() below overwrites it — this IS the previous
        // fetch's snapshot (or `[]` on the very first fetch of a poll session),
        // exactly what the Failed-transition toast diffs against.
        const previousRuns = get().runs;
        set({ runs, loading: false, error: null });
        notifyFailedRunTransitions(previousRuns, runs);

        // Poll while any run is in pending or running state.
        // Queued runs count as active: they will transition to running without
        // further user input, so polling must continue to observe the switch.
        // Paused runs are excluded — they only change via explicit user actions,
        // which refetch on their own.
        const anyActive = runs.some(isRunActive);
        if (anyActive) {
          // Seeing an active run starts polling so a one-off fetch right after
          // enqueueing keeps observing the run until it finishes; polling stops
          // itself below once nothing is active anymore. Guard on the project too:
          // a live interval targeting a *different* project must be re-targeted at
          // this one (startPolling handles the switch), otherwise it would keep
          // polling the previous project. startPolling is idempotent for the same
          // project.
          if (get().pollingIntervalId === null || get().pollingProjectId !== projectId) {
            get().startPolling(projectId);
          }
        } else if (get().pollingIntervalId) {
          get().stopPolling();
        }
      } catch (err) {
        // A stale error (its fetch was superseded) must not overwrite the current
        // project's error state either — drop it.
        if (token !== runFetchToken) return;
        // Gracefully handle 429 or other errors in polling. A 429 just means the
        // next poll tick will retry; the error surfaces via the store's `error`.
        set({ error: getErrorMessage(err), loading: false });
      }
    },

    cancelRun: async (projectId: string, runId: string) => {
      // Refresh after cancelling, then re-throw so the caller can surface the
      // failure. A swallowed error only lands in `error`, which no component
      // renders — clicking Cancel on a failing request would be a silent no-op.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () => apiRequest(`/projects/${projectId}/runs/${runId}/cancel`, { method: 'POST' }),
        { rethrow: true },
      );
    },

    judgeRun: async (projectId, runId, override, onVaultLockedRetry) => {
      // Poll so the active judge run's progress is observed; re-throw on failure.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () =>
          apiRequest<{ runId: string; status: string }>(
            runId ? `/projects/${projectId}/runs/${runId}/judge` : `/projects/${projectId}/judge`,
            {
              method: 'POST',
              body: JSON.stringify(override ?? {}),
              // If the vault was locked, apiRequest replays the request after unlock
              // and reports the eventual run here (the call above rejects with 423).
              // Without this the started run would never be refetched, leaving Start
              // enabled so the user could fire a second billable judge run.
              onVaultLockedRetry: (retry: { runId: string; status: string }) => {
                void get().fetchRuns(projectId);
                get().startPolling(projectId);
                onVaultLockedRetry?.(retry);
              },
            },
          ),
        { poll: true, rethrow: true },
      );
    },

    retryRun: async (projectId: string, runId: string) => {
      // The retry run is active (or queued) — poll for it; re-throw on failure.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () => apiRequest(`/projects/${projectId}/runs/${runId}/retry`, { method: 'POST' }),
        { poll: true, rethrow: true },
      );
    },

    revertRun: async (projectId: string, runId: string) =>
      // Not a run-state transition (no polling needed) — just refetch so the
      // reverted run's `reverted` flag shows up; re-throw so the caller can
      // surface the server's clear-error-message on a blocked revert.
      (await mutateThenRefresh(
        set,
        get,
        projectId,
        () =>
          apiRequest<{ reverted: number; total: number }>(
            `/projects/${projectId}/runs/${runId}/revert`,
            { method: 'POST' },
          ),
        { rethrow: true },
      ))!,

    retryJudgeRun: async (projectId: string, runId: string) => {
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () => apiRequest(`/projects/${projectId}/runs/${runId}/judge/retry`, { method: 'POST' }),
        { poll: true, rethrow: true },
      );
    },

    fetchVerdicts: async (projectId: string, runId: string) => {
      return apiRequest<JudgeVerdictRecord[]>(`/projects/${projectId}/runs/${runId}/verdicts`);
    },

    fetchJudgeLogs: async (projectId: string, runId: string) => {
      return apiRequest<JudgeLogEntry[]>(`/projects/${projectId}/runs/${runId}/logs`);
    },

    suggestVerdict: async (projectId, runId, entryId, targetLanguage, instructions) => {
      return apiRequest<JudgeVerdictRecord>(
        `/projects/${projectId}/runs/${runId}/verdicts/${entryId}/suggest`,
        {
          method: 'POST',
          body: JSON.stringify({ targetLanguage, ...(instructions ? { instructions } : {}) }),
        },
      );
    },

    discardVerdictSuggestion: async (projectId, runId, entryId, targetLanguage) => {
      return apiRequest<JudgeVerdictRecord>(
        `/projects/${projectId}/runs/${runId}/verdicts/${entryId}/suggestion`,
        { method: 'DELETE', body: JSON.stringify({ targetLanguage }) },
      );
    },

    startSourceReview: async (projectId, body, onVaultLockedRetry) =>
      // The source-review run is active — poll for it; re-throw on failure. With
      // rethrow set, a resolved call always yields the run summary (never undefined).
      (await mutateThenRefresh(
        set,
        get,
        projectId,
        () =>
          apiRequest<{ runId: string; total: number; status: string }>(
            `/projects/${projectId}/source-review`,
            {
              method: 'POST',
              body: JSON.stringify(body),
              // If the vault was locked, apiRequest replays the request after unlock
              // and reports the eventual run here (the call above rejects with 423).
              // Without this the started run would never be refetched, leaving Start
              // enabled so the user could fire a second billable source-review run.
              onVaultLockedRetry: (retry) => {
                void get().fetchRuns(projectId);
                get().startPolling(projectId);
                onVaultLockedRetry?.(retry);
              },
            },
          ),
        { poll: true, rethrow: true },
      ))!,

    fetchSourceReview: async (projectId: string, runId: string) => {
      const res = await apiRequest<{ records: SourceReviewRecord[] }>(
        `/projects/${projectId}/runs/${runId}/source-review`,
      );
      return res.records;
    },

    approveSourceReviewEntry: async (projectId, runId, entryId) => {
      await apiRequest<{ record: SourceReviewRecord }>(
        `/projects/${projectId}/runs/${runId}/source-review/${entryId}`,
        { method: 'PATCH', body: JSON.stringify({ approved: true }) },
      );
    },

    ignoreSourceReviewEntry: async (projectId, runId, entryId) => {
      await apiRequest<{ removed: boolean }>(
        `/projects/${projectId}/runs/${runId}/source-review/${entryId}`,
        { method: 'DELETE' },
      );
    },

    startGlossaryGen: async (projectId, body, onVaultLockedRetry) =>
      // The glossary-gen run is active — poll for it; re-throw on failure. With
      // rethrow set, a resolved call always yields the run summary (never undefined).
      (await mutateThenRefresh(
        set,
        get,
        projectId,
        () =>
          apiRequest<{ runId: string; status: string }>(
            `/projects/${projectId}/glossary/generate`,
            {
              method: 'POST',
              body: JSON.stringify(body),
              // If the vault was locked, apiRequest replays the request after unlock
              // and reports the eventual run here (the call below rejects with 423).
              onVaultLockedRetry: (retry: { runId: string; status: string }) => {
                void get().fetchRuns(projectId);
                get().startPolling(projectId);
                onVaultLockedRetry?.(retry);
              },
            },
          ),
        { poll: true, rethrow: true },
      ))!,

    fetchGlossarySuggestions: async (projectId: string, runId: string) => {
      const res = await apiRequest<{ suggestions: GlossarySuggestion[] }>(
        `/projects/${projectId}/glossary/generate/${runId}`,
      );
      return res.suggestions;
    },

    fetchCategorySuggestions: async (projectId: string, runId: string) => {
      const res = await apiRequest<{ suggestions: CategorySuggestion[] }>(
        `/projects/${projectId}/categories/suggestions/${runId}`,
      );
      return res.suggestions;
    },

    computeReviewOrder: async (projectId: string) =>
      (await runAction<RunStore, { count: number; computedAt: number }>(
        set,
        () =>
          apiRequest<{ count: number; computedAt: number }>(
            `/projects/${projectId}/review-order/compute`,
            { method: 'POST' },
          ),
        { rethrow: true },
      ))!,

    fetchReviewOrder: async (projectId: string) => {
      return apiRequest<ReviewOrderMeta>(`/projects/${projectId}/review-order`);
    },

    fetchRunDetails: async (projectId: string, runId: string) => {
      return apiRequest<RunDetails | null>(`/projects/${projectId}/runs/${runId}/details`);
    },

    pauseRun: async (projectId: string, runId: string) => {
      // Re-throw so a failed pause surfaces to the caller instead of only
      // landing in `error` (which no component renders) — a silent no-op.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () => apiRequest(`/projects/${projectId}/runs/${runId}/pause`, { method: 'POST' }),
        { rethrow: true },
      );
    },

    resumeRun: async (projectId: string, runId: string) => {
      // The run is active again — poll for it; re-throw so a failed resume
      // surfaces to the caller rather than being silently swallowed.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () => apiRequest(`/projects/${projectId}/runs/${runId}/resume`, { method: 'POST' }),
        { poll: true, rethrow: true },
      );
    },

    resumeRunWith: async (projectId: string, runId: string, moduleId: string) => {
      // Same envelope as resumeRun — the run is active again, so poll for
      // it; re-throw so the server's 409/400 message surfaces to the caller.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () =>
          apiRequest(`/projects/${projectId}/runs/${runId}/resume-with`, {
            method: 'POST',
            body: JSON.stringify({ moduleId }),
          }),
        { poll: true, rethrow: true },
      );
    },

    reorderQueue: async (projectId: string, runIds: string[]) => {
      // Re-throw so a failed reorder surfaces to the caller instead of being
      // silently swallowed into `error`.
      await mutateThenRefresh(
        set,
        get,
        projectId,
        () =>
          apiRequest(`/projects/${projectId}/runs/queue/reorder`, {
            method: 'POST',
            body: JSON.stringify({ runIds }),
          }),
        { rethrow: true },
      );
    },

    startPolling: (projectId: string) => {
      // A live interval already targeting this project needs no work: tearing it
      // down and re-arming on every call (several actions call startPolling right
      // after fetchRuns) just churns the timer and fires a redundant fetch.
      if (get().pollingIntervalId !== null && get().pollingProjectId === projectId) {
        return;
      }
      // A different project is being polled — this is a project switch. Stop the
      // old interval, drop the previous project's runs (so the new project never
      // briefly shows stale rows), and bump the fetch token so any in-flight
      // fetch for the old project is recognised as stale and can't re-land.
      if (get().pollingIntervalId !== null) {
        get().stopPolling();
        runFetchToken++;
        set({ runs: [] });
      }

      pollConsecutiveErrors = 0;
      // Initial fetch, tracked as in-flight so the first scheduled tick can't
      // fire a second overlapping request before it settles.
      set({ loading: get().runs.length === 0 });
      pollInFlight = true;
      void get()
        .fetchRuns(projectId)
        .finally(() => {
          pollInFlight = false;
        });

      schedulePoll(projectId, POLL_BASE_MS);
    },

    stopPolling: () => {
      const intervalId = get().pollingIntervalId;
      if (intervalId !== null) {
        globalThis.clearTimeout(intervalId);
      }
      // Reset the loop's private state so a fresh startPolling begins clean even
      // if a tick was mid-flight when polling stopped. The already-toasted set
      // is part of that state: a poll session ends when its runs have settled,
      // so nothing in it can still need dedup, and clearing keeps it from
      // growing for the lifetime of a long-lived tab.
      pollInFlight = false;
      pollConsecutiveErrors = 0;
      notifiedFailedRunIds.clear();
      if (intervalId !== null) {
        set({ pollingIntervalId: null, pollingProjectId: null });
      }
    },

    applyProgressEvent: (e: RunProgressEvent) => {
      const { runs } = get();
      const idx = runs.findIndex((r) => r.runId === e.runId);
      // Unknown run (not yet observed by a poll, or already evicted) — the
      // next poll tick reconciles; nothing to merge onto here.
      if (idx === -1) return;
      const existing = runs[idx];
      const progressIncreased = e.completed + e.failed > existing.completed + existing.failed;
      const statusChanged = e.status !== existing.status;
      // Stale event (a redelivery, or one that raced an already-newer poll
      // result) — ignore rather than clobber the more current stored state.
      if (!progressIncreased && !statusChanged) return;
      const nextRuns = [...runs];
      const merged: RunStatus = {
        ...existing,
        status: e.status as RunStatus['status'],
        completed: e.completed,
        failed: e.failed,
        total: e.total,
      };
      nextRuns[idx] = merged;
      set({ runs: nextRuns });
      // The SSE fast path is usually the FIRST observer of a failure: the
      // server flushes terminal statuses immediately (bypassing its 150ms
      // coalescing window), well before the next ~2s poll tick. Without this
      // the poll-side diff would later see `prev.status === Failed` — written
      // here — and skip it, so the failure toast would never fire in normal
      // desktop use. `notifyFailedRun` dedups per runId, so the poll tick that
      // follows can't double-toast. Gated on a real transition (the stored run
      // was not already Failed) to match the poll path's semantics: a run first
      // observed already-Failed is never toasted.
      if (merged.status === RunStatusCode.Failed && existing.status !== RunStatusCode.Failed) {
        notifyFailedRun(merged);
      }
    },
  };
});
