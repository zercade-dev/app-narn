import { create } from 'zustand';
import { LogEntryPools, type LogPoolDropCounts } from '@zercade-dev/narn-shared';
import { useRunStore, type RunProgressEvent } from './run-store.js';
import { useVaultStore } from './vault-store.js';
import { apiRequest, apiDownload, ApiError } from '../hooks/use-api.js';

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'notification';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

/** Server-side console log capture status, mirroring the server's `CaptureStatus`. */
export interface CaptureStatus {
  active: boolean;
  startedAt: number | null;
  entryCount: number;
  droppedCount: number;
  bytes: number;
}

/**
 * Severity-partitioned ring buffer (see `@zercade-dev/narn-shared`'s
 * `entry-pools.ts`) so a flood of routine `info` activity during a large run
 * can't evict the `warn`/`error` entries a user actually needs to see. Module
 * scoped rather than store state: it holds mutable ring buffers, not
 * something Zustand should track or serialise — the store mirrors its
 * contents into `entries`/`droppedCounts` on every flush instead.
 *
 * Also the mechanism behind the SSE reconnect-replay dedupe: `push()` ignores
 * an entry whose id is already held, which matters because the server's
 * connect replay sends the whole priority pool on every
 * reconnect, and reconnects have been observed at 670+/hour in practice (see
 * `BASE_RETRY_DELAY_MS` below) — without dedupe, every one of those
 * reconnects would re-insert every priority entry it had already delivered.
 */
const pools = new LogEntryPools<LogEntry>({
  infoCapacity: 500,
  // Must be at least the server's priority capacity — 1000 local, 250 per
  // tenant in cloud — so a maximal connect replay is absorbed without evicting
  // entries that were never actually lost (which would inflate droppedCounts
  // with false positives). Equality is not required, only this floor.
  priorityCapacity: 1000,
  priorityHeadCapacity: 50,
});

/**
 * Base delay before manually reopening a closed stream. The browser only
 * auto-reconnects after network drops; an HTTP error response (e.g. the 423
 * served while the vault is locked) closes the EventSource for good, so we
 * must reconnect manually. Each consecutive failure doubles the delay (see
 * `_retryDelayMs`), up to `MAX_RETRY_DELAY_MS`; a successful open resets it
 * back to this base. Without backoff a persistently-evicted vault session
 * reconnected every few seconds forever (observed 670+/hour in practice).
 */
const BASE_RETRY_DELAY_MS = 3000;

/** Cap on the exponential reconnect backoff. */
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Consecutive closed-stream failures before proactively re-checking the vault
 * status. A 423 from an evicted vault session gives the client no signal
 * beyond "the connection died and keeps dying" — after this many failures in
 * a row we ask `vault-store` to confirm whether the session is actually
 * locked and, if so, surface the unlock prompt instead of looping silently.
 */
const EVICTION_CHECK_FAILURE_THRESHOLD = 3;

/**
 * SSE entries are buffered and flushed into the store at most once per this
 * interval. A large translation run emits thousands of per-job log events;
 * one store update per event re-renders every `entries` subscriber (string
 * table, batch panel, comparison tab, console) per log line and freezes the
 * UI.
 */
const FLUSH_INTERVAL_MS = 200;

/**
 * `JSON.parse` accepts plenty of things that are not drop counts — `null` and
 * `{}` most obviously. Applying one would consume the one-shot gate on
 * `setServerDroppedCounts` and make the real frame behind it unreachable for the
 * rest of the page session, so a frame that fails this check is dropped
 * entirely: silently, like the sibling listeners, and without spending the gate.
 */
function isDropCounts(value: unknown): value is LogPoolDropCounts {
  if (typeof value !== 'object' || value === null) return false;
  const { info, priority } = value as Record<string, unknown>;
  return (
    typeof info === 'number' &&
    Number.isFinite(info) &&
    typeof priority === 'number' &&
    Number.isFinite(priority)
  );
}

interface LoggerStoreState {
  entries: LogEntry[];
  /** Counts of entries evicted from each pool since the last `clear()`. */
  droppedCounts: LogPoolDropCounts;
  /**
   * Evictions the SERVER reported for this subscriber, taken from the FIRST
   * connect of this page session only (see `setServerDroppedCounts`). Kept
   * separate from `droppedCounts` (this browser's own pool) so the JSON export
   * can say which side lost entries.
   */
  serverDroppedCounts: LogPoolDropCounts;
  setServerDroppedCounts: (counts: LogPoolDropCounts) => void;
  /**
   * Whether a `log:dropped` frame has already been applied since the last
   * `clear()`. Gates {@link setServerDroppedCounts} to the first connect.
   */
  _serverDropsApplied: boolean;
  connected: boolean;
  _eventSource: EventSource | null;
  _retryTimer: ReturnType<typeof setTimeout> | null;
  /** Delay to use for the NEXT scheduled reconnect (exponential backoff). */
  _retryDelayMs: number;
  /** Consecutive closed-stream failures since the last successful open. */
  _consecutiveFailures: number;
  /** SSE entries awaiting the next batched flush. Mutated in place. */
  _pendingEntries: LogEntry[];
  _flushTimer: ReturnType<typeof setTimeout> | null;

  connect: () => void;
  disconnect: () => void;
  addEntry: (entry: LogEntry) => void;
  addEntries: (batch: LogEntry[]) => void;
  clear: () => void;

  /** Server-side capture status, `null` until the first fetch. */
  captureStatus: CaptureStatus | null;
  /**
   * Set when the server refused to start a capture because every capture slot
   * is already in use (409 `capture-slots-exhausted`). The panel surfaces this
   * once, then clears it.
   */
  captureError: 'slots-exhausted' | null;
  /** Pulls the current capture status (used for the panel's open-time fetch and its 5s poll). */
  refreshCaptureStatus: () => Promise<void>;
  /** Starts or stops the server-side capture. On a 409 leaves `captureStatus` untouched and sets `captureError`. */
  setCaptureActive: (active: boolean) => Promise<void>;
  /** Downloads the current capture as an NDJSON attachment. */
  downloadCapture: () => Promise<void>;
}

export const useLoggerStore = create<LoggerStoreState>()((set, get) => {
  const flushPending = () => {
    const drained = get()._pendingEntries.splice(0);
    set({ _flushTimer: null });
    if (drained.length > 0) get().addEntries(drained);
  };

  return {
    entries: [],
    droppedCounts: { info: 0, priority: 0 },
    serverDroppedCounts: { info: 0, priority: 0 },
    _serverDropsApplied: false,
    // FIRST CONNECT ONLY — later frames are ignored outright, not replaced.
    //
    // The panel adds this to the client's own `droppedCounts` to report what is
    // missing from the view. Log emission is unconditional, so a continuously
    // connected client already RECEIVED every entry the server later evicted
    // from its own pool: those entries are not missing here, and counting them
    // would over-report badly (a server pool shedding 550 info entries a client
    // saw in full would inflate the marker by 550). The only server-side
    // evictions this client genuinely never saw are the ones that happened
    // BEFORE its stream opened, which is exactly the figure carried by the
    // first frame.
    //
    // On a reconnect the client keeps its own pool, so it has lost nothing new
    // in the gap beyond what its own `droppedCounts` already records — hence
    // ignoring, rather than replacing with, the later cumulative figure. (That
    // also disposes of the old accumulate hazard: reconnects have been observed
    // at 670+/hour.)
    //
    // Honest caveat: even the first frame is cumulative since SERVER process
    // start, not since this client loaded, so it can overstate what this
    // particular client missed. It is an upper bound on the gap, not an exact
    // count — which is the right direction for a "history may be incomplete"
    // marker.
    setServerDroppedCounts: (counts) => {
      if (get()._serverDropsApplied) return;
      set({ serverDroppedCounts: counts, _serverDropsApplied: true });
    },
    connected: false,
    _eventSource: null,
    _retryTimer: null,
    _retryDelayMs: BASE_RETRY_DELAY_MS,
    _consecutiveFailures: 0,
    _pendingEntries: [],
    _flushTimer: null,

    connect: () => {
      const { _eventSource: existing, _retryTimer } = get();
      // Keep a live (connecting/open) stream; replace one the browser gave up on.
      if (existing && existing.readyState !== EventSource.CLOSED) return;
      existing?.close();
      if (_retryTimer !== null) clearTimeout(_retryTimer);

      const es = new EventSource('/api/logs/stream');

      es.addEventListener('log:entry', (event: MessageEvent) => {
        try {
          const entry = JSON.parse(event.data as string) as LogEntry;
          get()._pendingEntries.push(entry);
          if (get()._flushTimer === null) {
            set({ _flushTimer: setTimeout(flushPending, FLUSH_INTERVAL_MS) });
          }
        } catch {
          // ignore malformed SSE data
        }
      });

      es.addEventListener('log:dropped', (event: MessageEvent) => {
        try {
          const parsed: unknown = JSON.parse(event.data as string);
          if (isDropCounts(parsed)) get().setServerDroppedCounts(parsed);
        } catch {
          // ignore malformed SSE data
        }
      });

      // Reuses this same log-stream connection for run progress rather than
      // opening a second EventSource — the run store's poller stays the
      // reconciling source of truth; this just narrows the gap between ticks.
      // Mirrors the `log:entry` handler above: malformed data is swallowed
      // silently (no crash, no console spam), and an unknown runId is a no-op
      // in applyProgressEvent itself (the next poll picks it up).
      es.addEventListener('run-progress', (event: MessageEvent) => {
        try {
          const progress = JSON.parse(event.data as string) as RunProgressEvent;
          useRunStore.getState().applyProgressEvent(progress);
        } catch {
          // ignore malformed SSE data
        }
      });

      es.onopen = () =>
        set({ connected: true, _retryDelayMs: BASE_RETRY_DELAY_MS, _consecutiveFailures: 0 });

      es.onerror = () => {
        set({ connected: false });
        // The browser auto-reconnects on its own only while readyState is
        // CONNECTING; once CLOSED (HTTP error) it never retries, so we must.
        if (es.readyState === EventSource.CLOSED && get()._eventSource === es) {
          const delay = get()._retryDelayMs;
          const failures = get()._consecutiveFailures + 1;
          set({
            _consecutiveFailures: failures,
            _retryDelayMs: Math.min(delay * 2, MAX_RETRY_DELAY_MS),
          });
          if (failures >= EVICTION_CHECK_FAILURE_THRESHOLD) {
            void useVaultStore.getState().checkEviction();
          }
          const timer = setTimeout(() => {
            if (get()._eventSource === es) {
              set({ _retryTimer: null });
              get().connect();
            }
          }, delay);
          set({ _retryTimer: timer });
        }
      };

      set({ _eventSource: es, connected: false, _retryTimer: null });
    },

    disconnect: () => {
      const { _eventSource, _retryTimer, _flushTimer } = get();
      if (_retryTimer !== null) clearTimeout(_retryTimer);
      if (_flushTimer !== null) {
        clearTimeout(_flushTimer);
        flushPending();
      }
      if (_eventSource) {
        _eventSource.close();
      }
      if (_eventSource || _retryTimer !== null) {
        set({ _eventSource: null, connected: false, _retryTimer: null });
      }
    },

    addEntry: (entry) => get().addEntries([entry]),

    addEntries: (batch) => {
      if (batch.length === 0) return;
      // push() is a no-op for an id already held (reconnect-replay dedupe) —
      // its boolean return is discarded, same as the server's ConsoleLogger.
      for (const entry of batch) pools.push(entry);
      // One `set()` for the whole batch, inside the existing 200ms flush this
      // is always called from — a second `set()` here (or moving this work
      // out of the flush) would double the per-batch re-render cost the flush
      // batching exists to avoid.
      set({ entries: pools.merged(), droppedCounts: pools.dropped() });
    },

    clear: () => {
      pools.clear();
      set({
        entries: [],
        droppedCounts: { info: 0, priority: 0 },
        serverDroppedCounts: { info: 0, priority: 0 },
        // Re-arm the first-connect gate: the user asked for a clean slate, so
        // the next connect's figure is allowed to land again.
        _serverDropsApplied: false,
      });
    },

    captureStatus: null,
    captureError: null,

    // Best-effort: this backs an advisory 5s poll (see ConsolePanel), so a
    // transient failure (server restart, vault locked, offline tab) must not
    // throw — there is no error UI for a status poll, and an uncaught
    // rejection here would surface as an unhandled promise rejection on every
    // tick. Leave `captureStatus` exactly as it was; the next successful poll
    // catches the view back up.
    refreshCaptureStatus: async () => {
      try {
        const status = await apiRequest<CaptureStatus>('/logs/capture');
        set({ captureStatus: status });
      } catch {
        // swallow — advisory poll, no error surface
      }
    },

    setCaptureActive: async (active) => {
      try {
        const status = await apiRequest<CaptureStatus>(
          active ? '/logs/capture/start' : '/logs/capture/stop',
          { method: 'POST' },
        );
        set({ captureStatus: status });
      } catch (err) {
        // The server holds a bounded number of capture slots; a 409 means
        // they're all in use. Leave `captureStatus` as-is (the capture this
        // client just tried to start never became active) and surface the
        // condition once via `captureError` for the panel to toast and clear.
        if (err instanceof ApiError && err.status === 409) {
          set({ captureError: 'slots-exhausted' });
          return;
        }
        throw err;
      }
    },

    downloadCapture: async () => {
      const stamp = new Date().getTime();
      await apiDownload('/logs/capture/download', `console-capture-${stamp}.ndjson`);
    },
  };
});
