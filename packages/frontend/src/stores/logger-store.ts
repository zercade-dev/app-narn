import { create } from 'zustand';
import { useRunStore, type RunProgressEvent } from './run-store.js';
import { useVaultStore } from './vault-store.js';

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'notification';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const MAX_ENTRIES = 500;

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

interface LoggerStoreState {
  entries: LogEntry[];
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
}

export const useLoggerStore = create<LoggerStoreState>()((set, get) => {
  const flushPending = () => {
    const drained = get()._pendingEntries.splice(0);
    set({ _flushTimer: null });
    if (drained.length > 0) get().addEntries(drained);
  };

  return {
    entries: [],
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
      set((s) => {
        const entries = [...s.entries, ...batch];
        return { entries: entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries };
      });
    },

    clear: () => set({ entries: [] }),
  };
});
