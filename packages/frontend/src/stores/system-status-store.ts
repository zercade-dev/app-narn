/**
 * Polls GET /api/system/status to drive the restart banners. The poll is adaptive
 * and request-minimising: a 5-minute idle heartbeat (safe because restarts are
 * announced with >5 min lead), tightening to 30s once a countdown is known and 10s
 * in the final minute + through the restart transition. The per-second countdown
 * display is local (RestartBanners' own 1s ticker), so this network poll only has to
 * notice a cancel or the restart, never animate the clock.
 */
import { create } from 'zustand';
import { apiRequest } from '../hooks/use-api.js';
import { getErrorMessage } from '../lib/utils.js';

export interface SystemStatus {
  serverNow: number;
  serverStartedAt: number;
  restartAt: number | null;
  restartMessage: string | null;
  restartCancelledAt: number | null;
  bannersEnabled: boolean;
  restartedWindowMs: number;
  /** Slot identity (e.g. "BETA"); null when unset. Drives the SlotRibbon. */
  slotLabel: string | null;
  /** Operator contact address; null → the UI hides every contact affordance. */
  supportEmail: string | null;
}

export const IDLE_POLL_MS = 300_000;
export const ACTIVE_POLL_MS = 30_000;
export const NEAR_POLL_MS = 10_000;

/** Chooses the next poll delay from current state (pure; exported for testing). */
export function nextPollDelay(
  status: SystemStatus | null,
  clockOffset: number,
  now: number,
): number {
  if (!status || status.restartAt == null) return IDLE_POLL_MS;
  const remaining = status.restartAt - (now + clockOffset);
  if (remaining > 60_000) return ACTIVE_POLL_MS;
  if (remaining > -status.restartedWindowMs) return NEAR_POLL_MS;
  return IDLE_POLL_MS; // stale past-deadline guard: don't pin fast polling forever
}

interface SystemStatusStore {
  status: SystemStatus | null;
  clockOffset: number;
  error: string | null;
  _timer: ReturnType<typeof setTimeout> | null;
  _running: boolean;
  fetchOnce: () => Promise<void>;
  start: () => void;
  stop: () => void;
}

export const useSystemStatusStore = create<SystemStatusStore>()((set, get) => ({
  status: null,
  clockOffset: 0,
  error: null,
  _timer: null,
  _running: false,

  fetchOnce: async () => {
    try {
      const status = await apiRequest<SystemStatus>('/system/status');
      set({ status, clockOffset: status.serverNow - Date.now(), error: null });
    } catch (err) {
      set({ error: getErrorMessage(err) });
    }
  },

  start: () => {
    if (get()._running) return; // already running — idempotent across the async gap
    set({ _running: true });
    const loop = async () => {
      await get().fetchOnce();
      if (!get()._running) return; // stop() was called during in-flight fetch
      const delay = nextPollDelay(get().status, get().clockOffset, Date.now());
      set({ _timer: setTimeout(() => void loop(), delay) });
    };
    void loop();
  },

  stop: () => {
    const t = get()._timer;
    if (t !== null) clearTimeout(t);
    set({ _timer: null, _running: false });
  },
}));
