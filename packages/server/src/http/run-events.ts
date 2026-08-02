import { EventEmitter } from 'node:events';
import { RunStatusCode } from '@zercade-dev/narn-shared';

/**
 * A single run-progress notification. `PgRunStore` emits one after every
 * successful persist (`updateRun` / `forceCancel`); the SSE layer relays it to
 * entitled clients as a named `run-progress` event. The scalar fields mirror the
 * `RunStatus` columns the frontend needs to paint a progress bar WITHOUT polling
 * the runs API.
 */
export interface RunProgressEvent {
  runId: string;
  projectId: string;
  status: RunStatusCode;
  completed: number;
  failed: number;
  total: number;
  /**
   * User id of the tenant whose request produced this event, captured from the
   * ambient tenant context at emit time (mirrors `LogEntry.tenantId`). This is a
   * SERVER-SIDE scoping field ONLY: the SSE relay filters on it in cloud mode so
   * a subscriber never sees another tenant's progress, and it is NEVER forwarded
   * to the client (the relay sends only the six contract fields above).
   * Undefined in open-core / outside a tenant context.
   */
  tenantId?: string;
}

/**
 * Trailing-edge coalescing window (ms) applied per `runId` in the SSE relay so a
 * burst of trivial-matcher progress writes collapses to one client frame. Lives
 * with the bus (not the store) so the store stays a dumb, per-persist emitter.
 */
export const RUN_PROGRESS_THROTTLE_MS = 150;

/**
 * Terminal run statuses. A run-progress event in one of these states is flushed
 * to clients immediately (bypassing the coalescing window) so the UI never lags
 * a run's completion behind the trailing-edge timer.
 */
export const TERMINAL_RUN_STATUSES: ReadonlySet<RunStatusCode> = new Set([
  RunStatusCode.Completed,
  RunStatusCode.Failed,
  RunStatusCode.Cancelled,
]);

export function isTerminalRunStatus(status: RunStatusCode): boolean {
  return TERMINAL_RUN_STATUSES.has(status);
}

/**
 * Fire-and-forget run-progress bus. `PgRunStore` emits after each successful
 * persist; the SSE layer relays to entitled clients. A throwing listener must
 * NEVER reject the persistence path, so `emitProgress` wraps `emit` in a
 * try/catch — a broken SSE relay can degrade the live stream, never a run.
 */
class RunEvents extends EventEmitter {
  emitProgress(e: RunProgressEvent): void {
    try {
      this.emit('progress', e);
    } catch {
      /* listeners must never fail a run */
    }
  }
}

export const runEvents = new RunEvents();

// Each open `GET /api/logs/stream` SSE connection adds a `progress` listener
// (removed on request close). Raise the EventEmitter bound above Node's default
// of 10 — matching the console logger — so many concurrent streams don't trip a
// spurious MaxListenersExceededWarning. 64 is an intentional cap, not unbounded
// growth.
runEvents.setMaxListeners(64);
