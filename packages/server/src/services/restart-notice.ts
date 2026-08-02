/**
 * In-memory announcement that a restart is scheduled, plus the process boot time.
 * Deliberately NOT persisted: the announcement should evaporate when the process
 * restarts (which is exactly when the "recently restarted" banner takes over), and
 * the cloud container root FS is read-only. Set via POST /api/system/restart-notice.
 */
export interface RestartNoticeState {
  restartAt: number | null;
  restartMessage: string | null;
  cancelledAt: number | null;
}

const SERVER_STARTED_AT = Date.now();
let state: RestartNoticeState = { restartAt: null, restartMessage: null, cancelledAt: null };

export function getServerStartedAt(): number {
  return SERVER_STARTED_AT;
}

export function getRestartNotice(): RestartNoticeState {
  return { ...state };
}

export function scheduleRestart(seconds: number, message?: string | null): RestartNoticeState {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  state = {
    restartAt: Date.now() + seconds * 1000,
    restartMessage: trimmed === '' ? null : trimmed,
    cancelledAt: null,
  };
  return getRestartNotice();
}

export function cancelRestart(): RestartNoticeState {
  if (state.restartAt != null) {
    state = { restartAt: null, restartMessage: null, cancelledAt: Date.now() };
  }
  return getRestartNotice();
}

/** Test-only: reset the mutable notice (boot time is a process constant). */
export function __resetForTests(): void {
  state = { restartAt: null, restartMessage: null, cancelledAt: null };
}
