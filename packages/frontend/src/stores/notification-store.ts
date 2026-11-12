/**
 * Polls GET /api/notifications on a flat, unconditional 5-minute interval and
 * exposes mark-read/mark-all-read/dismiss actions for the Account →
 * Notifications tab and the sidebar's unread-count badge.
 *
 * The polling shape mirrors system-status-store.ts's start()/stop() exactly
 * (a `_running` guard makes start() idempotent across the async gap; stop()
 * clears the pending timer) — a FLAT poll, unlike run-store.ts's
 * conditional-on-active-run polling. Notifications must be checked regardless
 * of what else is happening in the app, so there is no adaptive delay: every
 * tick waits the same POLL_MS.
 *
 * Built against the open-core /api/notifications HTTP contract (GET
 * /api/notifications, POST /api/notifications/:id/read, POST
 * /api/notifications/read-all, POST /api/notifications/read-informational,
 * DELETE /api/notifications/:id). Run events from the SSE stream nudge a
 * refetch (see `onRunProgress`) so run notifications show up without waiting
 * for the next poll.
 */
import { create, type StoreApi } from 'zustand';
import { apiRequest } from '../hooks/use-api.js';
import type { NotificationRecord, NotificationSeverity } from '@zercade-dev/narn-shared';
import { runAction } from './store-helpers.js';
import type { RunProgressEvent } from './run-store.js';

export type { NotificationRecord, NotificationSeverity };

interface NotificationsListResponse {
  notifications: NotificationRecord[];
  unreadCount: number;
}

/** Flat poll interval — matches system-status-store's IDLE_POLL_MS (5 min). */
export const POLL_MS = 300_000;

/** Wait before refetching after a run event, so the server has written the notification. */
export const RUN_EVENT_REFETCH_MS = 1_000;

/** Run statuses after which the run's notification exists. */
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

/** Runs seen `running` this session, so a start is announced once. */
const seenRunning = new Set<string>();
let runEventTimer: ReturnType<typeof setTimeout> | null = null;

interface NotificationStore {
  notifications: NotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  _timer: ReturnType<typeof setTimeout> | null;
  _running: boolean;
  /**
   * Generation counter, bumped on every `start()`. A boolean `_running` guard
   * alone can't distinguish "my loop is still the active one" from "some loop
   * (possibly a newer one) is running": on a stop→start that lands while a
   * fetch is in flight, the stale loop's post-await check of `_running` sees
   * `true` again (from the new start()) and wrongly keeps scheduling —
   * forking a second, duplicate poll chain (observed under dev StrictMode's
   * double-invoke). Each loop iteration instead captures the generation at
   * start time and bails if the store's current generation has since moved on.
   */
  _gen: number;

  /**
   * `opts.silent` skips the `loading` flag — used by the background poll tick
   * (see `start()`) so a recurring 5-minute refresh never flashes the
   * "Loading…" state over an already-rendered (possibly empty) list. The
   * user-facing mount-time fetch (NotificationsTab) omits `silent` so a
   * genuine first load still shows the loading state.
   */
  fetch: (opts?: { silent?: boolean }) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Marks everything read except notifications about problems. */
  markInformationalRead: () => Promise<void>;
  /**
   * Refetches once, about a second later, when a run starts running for the first
   * time or reaches a terminal status; ordinary progress is ignored. A burst of
   * events shares one refetch.
   */
  onRunProgress: (e: RunProgressEvent) => void;
  dismiss: (id: string) => Promise<void>;
  start: () => void;
  stop: () => void;
}

/**
 * Shared envelope for the three mutations below: reset error, run the
 * mutating request, then re-pull the list so `notifications`/`unreadCount`
 * can never drift from the server. Not `store-helpers.ts`'s
 * `mutateThenRefresh` — that helper is hard-coupled to a `projectId` +
 * `fetchRuns(projectId)`/`startPolling(projectId)` shape run-store.ts needs;
 * this store has neither, so it composes the plain `runAction` envelope
 * around its own parameterless `fetch()` instead.
 */
function mutateThenRefetch(
  set: StoreApi<NotificationStore>['setState'],
  get: () => Pick<NotificationStore, 'fetch'>,
  mutate: () => Promise<unknown>,
): Promise<void | undefined> {
  return runAction(set, async () => {
    await mutate();
    await get().fetch();
  });
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  _timer: null,
  _running: false,
  _gen: 0,

  fetch: async (opts) => {
    await runAction(
      set,
      async () => {
        const res = await apiRequest<NotificationsListResponse>('/notifications');
        set({ notifications: res.notifications, unreadCount: res.unreadCount });
      },
      { loading: !opts?.silent },
    );
  },

  // Mutations follow run-store.ts's mutate-then-refresh convention (e.g.
  // cancelRun/pauseRun/resumeRun) rather than an optimistic local patch: the
  // mutating call runs first, then fetch() re-pulls both `notifications` and
  // the server-computed `unreadCount` so the two can never drift out of sync.
  markRead: (id: string) =>
    mutateThenRefetch(set, get, () => apiRequest(`/notifications/${id}/read`, { method: 'POST' })),

  markAllRead: () =>
    mutateThenRefetch(set, get, () => apiRequest('/notifications/read-all', { method: 'POST' })),

  markInformationalRead: () =>
    mutateThenRefetch(set, get, () =>
      apiRequest('/notifications/read-informational', { method: 'POST' }),
    ),

  onRunProgress: (e) => {
    let relevant = false;
    if (TERMINAL_STATUSES.has(e.status)) {
      seenRunning.delete(e.runId);
      relevant = true;
    } else if (e.status === 'running' && !seenRunning.has(e.runId)) {
      seenRunning.add(e.runId);
      relevant = true;
    }
    if (!relevant || runEventTimer !== null) return;
    runEventTimer = setTimeout(() => {
      runEventTimer = null;
      void get().fetch({ silent: true });
    }, RUN_EVENT_REFETCH_MS);
  },

  dismiss: (id: string) =>
    mutateThenRefetch(set, get, () => apiRequest(`/notifications/${id}`, { method: 'DELETE' })),

  start: () => {
    if (get()._running) return; // already running — idempotent across the async gap
    const gen = get()._gen + 1;
    set({ _running: true, _gen: gen });
    const loop = async () => {
      // Silent: a recurring background tick must never flash "Loading…" over
      // an already-rendered list (see `fetch`'s doc comment above).
      await get().fetch({ silent: true });
      // Bail if this loop's generation is no longer the current one — either
      // stop() was called (no generation bump, but see below) or a
      // stop()-then-start() landed while this fetch was in flight, bumping
      // `_gen` and making this loop stale. Checking the generation (not just
      // `_running`) is what prevents that stale loop from also scheduling a
      // timer, which would fork a second, duplicate poll chain.
      if (get()._gen !== gen || !get()._running) return;
      set({ _timer: setTimeout(() => void loop(), POLL_MS) });
    };
    void loop();
  },

  stop: () => {
    const t = get()._timer;
    if (t !== null) clearTimeout(t);
    // Drop run-event state too, so a pending refetch cannot fire for a signed-out
    // session and a restarted store announces already-seen runs again.
    if (runEventTimer !== null) clearTimeout(runEventTimer);
    runEventTimer = null;
    seenRunning.clear();
    set({ _timer: null, _running: false });
  },
}));
