/**
 * Per-run "settled" primitive shared by the background-run engines.
 *
 * `cancel(runId)` only SIGNALS a run to stop (flip status → Cancelled, abort the
 * controller, drop queued tasks); the DETACHED task already in flight still runs
 * its `finally` afterward, which writes to the run store (`emitProgress` /
 * `finalizeTerminal`). During cloud account deletion those late writes are the
 * orphan hazard: a `runs`/`run_sidecars` row committed AFTER `teardownTenant`
 * removes `project_members` becomes RLS-invisible and survives the erase.
 *
 * A `SettledDeferred` lets a caller await a run's REAL settlement — every
 * detached task for that run has finished its `finally` (so no further store
 * write will occur) — not just the cancel signal. Each engine creates one when a
 * run is dispatched and resolves it (idempotently) once the run is terminal AND
 * no detached task is still executing. Resolving never rejects.
 */
export interface SettledDeferred {
  readonly promise: Promise<void>;
  resolve(): void;
  /** Guards double-resolve so the terminal paths can all call `resolve()` safely. */
  done: boolean;
}

/** A fresh, unresolved {@link SettledDeferred}. */
export function createSettledDeferred(): SettledDeferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return {
    promise,
    resolve() {
      if (this.done) return;
      this.done = true;
      resolve();
    },
    done: false,
  };
}

/**
 * Await every promise in `promises`, but never longer than `timeoutMs` (when
 * given). Resolves `true` when the wait timed out (some promise had not settled),
 * `false` when all settled first (or the list was empty). Never throws — a
 * rejecting input is treated as settled. The timer is cleared on the winning
 * path so it leaves no dangling handle.
 */
export async function awaitAllWithTimeout(
  promises: ReadonlyArray<Promise<void>>,
  timeoutMs?: number,
): Promise<boolean> {
  if (promises.length === 0) return false;
  const all = Promise.allSettled(promises).then(() => false as const);
  if (timeoutMs === undefined) return all;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs);
  });
  try {
    return await Promise.race([all, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The settled/drain accounting shared by both background-run engines
 * ({@link ../run-engine.ts BackgroundRunEngine} and
 * {@link ../M9-translation-engine.ts TranslationEngine}). Owns the two per-run
 * maps — the settled deferreds and the in-flight detached-task counts — plus
 * their arm/track/resolve/forget mechanics.
 *
 * What it deliberately does NOT own is the status predicate: the engine decides
 * which of its own statuses count as non-terminal (the base counts
 * Running/Paused; TranslationEngine also counts Queued) and passes that boolean
 * into {@link maybeResolve}. Keeping the predicate in each engine is the one
 * legitimate divergence between them; everything else here is byte-identical, so
 * a behavioral fix to the drain mechanics is applied once, in this class.
 *
 * This duplication had already drifted once (a finalize-guard bug family),
 * which is why it was extracted.
 */
export class SettledTracker {
  private readonly settled = new Map<string, SettledDeferred>();
  private readonly activeTasks = new Map<string, number>();

  /**
   * Idempotently arm a run's settled deferred (create it only if absent). Safe to
   * call from several lifecycle points for the same run (startRun / trackTask /
   * dispatch) — the first call wins and later ones are no-ops.
   */
  arm(runId: string): void {
    if (!this.settled.has(runId)) this.settled.set(runId, createSettledDeferred());
  }

  /** Increment the in-flight detached-task count for a run. */
  taskStarted(runId: string): void {
    this.activeTasks.set(runId, (this.activeTasks.get(runId) ?? 0) + 1);
  }

  /** Decrement the in-flight task count; returns `true` when no tasks remain. */
  taskEnded(runId: string): boolean {
    const next = (this.activeTasks.get(runId) ?? 1) - 1;
    if (next <= 0) {
      this.activeTasks.delete(runId);
      return true;
    }
    this.activeTasks.set(runId, next);
    return false;
  }

  /**
   * Resolve a run's settled deferred once it is TERMINAL (the engine-supplied
   * `nonTerminal` predicate is false) AND no detached task is still executing —
   * the invariant that no further store write will occur for the run. Idempotent
   * (the deferred guards double-resolve); a no-op while the run is non-terminal or
   * a task is in flight. The status predicate stays in the engine (see the class
   * doc); this method owns only the drained-and-terminal mechanics.
   */
  maybeResolve(runId: string, nonTerminal: boolean): void {
    const deferred = this.settled.get(runId);
    if (!deferred || deferred.done) return;
    const active = this.activeTasks.get(runId) ?? 0;
    if (nonTerminal || active > 0) return;
    deferred.resolve();
    this.settled.delete(runId);
  }

  /**
   * Capture the settled promises for `runIds` (only those currently armed). Used
   * by `cancelAllForProject` to snapshot the promises BEFORE cancelling, since a
   * cancel may resolve+drop a deferred synchronously when nothing is in flight.
   */
  capturePromises(runIds: readonly string[]): Promise<void>[] {
    return runIds
      .map((runId) => this.settled.get(runId)?.promise)
      .filter((p): p is Promise<void> => p !== undefined);
  }

  /**
   * Resolve then drop every in-memory trace of a run from both maps. Resolving
   * first means a drain still awaiting this (now-forgotten, terminal) run is never
   * left hanging.
   */
  forget(runId: string): void {
    this.settled.get(runId)?.resolve();
    this.settled.delete(runId);
    this.activeTasks.delete(runId);
  }
}
