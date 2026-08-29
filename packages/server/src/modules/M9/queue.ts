import type { GovernorKey, RateGovernor } from './rate-governor.js';

/** What a rate-governed task needs before it may take a slot. */
export interface Admission {
  key: GovernorKey;
  projectedTokens: number;
  /**
   * Set (by the dispatch pipeline, not the queue) once this admission's one
   * originally-admitted provider call has been made. Every subsequent real
   * call on this admission — a same-bucket retry, a reroute, a split half —
   * must force-acquire against the governor instead of assuming the queue's
   * `tryAcquire` covers it too. The queue itself never reads or sets this.
   */
  spent?: boolean;
}

interface Entry {
  runId: string;
  task: () => Promise<void>;
  admission?: Admission;
}

/**
 * Bounded-concurrency job queue used by the M9 TranslationEngine.
 *
 * Supports per-run pausing: paused runs keep their pending tasks in the
 * queue but `pump()` skips over them, so in-flight tasks finish while no new
 * tasks for the run start. `resumeRun` lifts the mark and re-pumps.
 *
 * Per-run fairness (multi-tenant): the queue is shared across runs of
 * different tenants, so a single run with many queued tasks must not occupy
 * every slot while another tenant's run waits. Each run is bounded to a
 * per-run in-flight cap; `pump()` prefers a waiting run that is still under its
 * cap, and only falls back to an at-cap run when NO under-cap run has work (so
 * a lone run is never throttled and no slot idles needlessly). For ungoverned
 * tasks this cap is the static `perRunCap`; for governed tasks it is a dynamic
 * share of `governedConcurrency` (see `governedRunCap()`), since the governed
 * ceiling can be far larger than `concurrency` and a static fraction of the
 * latter would not bound a run's share of the former.
 *
 * Rate-governed admission (Freeway): a task may optionally carry an
 * `Admission` — a governor key plus its projected token cost. Such a task is
 * gated by a `RateGovernor` *before* it may take a slot: when its bucket has
 * no permit the task is skipped (left in the queue), never dequeued, so a
 * scarce bucket can never hold slots that another bucket's work needs.
 * Governed and ungoverned tasks are tracked and capped separately —
 * `governed`/`ungoverned` — since they draw from different ceilings
 * (`governedConcurrency` vs `concurrency`). A task without an `Admission`
 * takes the legacy, ungoverned path unchanged.
 */
export class JobQueue {
  private readonly tasks: Array<Entry> = [];
  /** In-flight task count per runId (entries are deleted when they reach 0). */
  private readonly inFlightByRun = new Map<string, number>();
  /** In-flight GOVERNED task count per runId (entries are deleted when they reach 0). */
  private readonly governedInFlightByRun = new Map<string, number>();
  private readonly pausedRuns = new Set<string>();
  /**
   * Max slots one run may hold while another run is waiting. Derived from
   * `concurrency`: `concurrency - 1` keeps at least one slot reclaimable by a
   * competing run, with a floor of 1 so a single-slot queue (or a lone run)
   * still makes progress.
   */
  private readonly perRunCap: number;

  private readonly governor?: RateGovernor;
  private readonly governedConcurrency: number;
  private governed = 0;
  private ungoverned = 0;
  private refillTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly concurrency: number,
    opts?: { governor?: RateGovernor; governedConcurrency?: number },
  ) {
    this.perRunCap = Math.max(1, concurrency - 1);
    this.governor = opts?.governor;
    this.governedConcurrency = opts?.governedConcurrency ?? concurrency;
  }

  add(runId: string, task: () => Promise<void>, admission?: Admission): void {
    this.tasks.push({ runId, task, admission });
    this.pump();
  }

  cancelRun(runId: string): void {
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      if (this.tasks[i].runId === runId) {
        this.tasks.splice(i, 1);
      }
    }
    this.pausedRuns.delete(runId);
    // Removing a paused run's tasks may unblock capacity for other runs.
    this.pump();
  }

  /** Stop dequeuing tasks for `runId`; tasks already in flight finish normally. */
  pauseRun(runId: string): void {
    this.pausedRuns.add(runId);
  }

  /** Resume dequeuing tasks for a previously paused `runId`. */
  resumeRun(runId: string): void {
    this.pausedRuns.delete(runId);
    this.pump();
  }

  /**
   * Distinct runs with governed work queued or in flight. The governed per-run
   * cap is a share of the governed ceiling rather than the static
   * `concurrency - 1`: at a ceiling of 32 that constant would leave one run
   * holding 31 slots, which is not a fairness bound at all.
   */
  private governedRunCount(): number {
    const runs = new Set<string>();
    for (const entry of this.tasks) {
      if (entry.admission !== undefined && !this.pausedRuns.has(entry.runId)) runs.add(entry.runId);
    }
    for (const runId of this.governedInFlightByRun.keys()) runs.add(runId);
    return Math.max(1, runs.size);
  }

  private governedRunCap(): number {
    return Math.max(1, Math.floor(this.governedConcurrency / this.governedRunCount()));
  }

  /**
   * Whether `entry`'s run may take another slot: not paused and under its
   * per-run cap. Ungoverned tasks keep the static `perRunCap`; governed tasks
   * use the dynamic share of the governed ceiling — `governedCap` is computed
   * ONCE per `pump()` call (see there) rather than recomputed per candidate,
   * since neither `this.tasks` nor `governedInFlightByRun` changes between
   * candidates within one `pump()` invocation's dequeue loop.
   */
  private isEligible(entry: Entry, governedCap: number): boolean {
    if (this.pausedRuns.has(entry.runId)) return false;
    if (entry.admission === undefined) {
      return (this.inFlightByRun.get(entry.runId) ?? 0) < this.perRunCap;
    }
    return (this.governedInFlightByRun.get(entry.runId) ?? 0) < governedCap;
  }

  /**
   * A task may start when its run is eligible AND — for a rate-governed task —
   * its bucket has a permit. The governor check is deliberately last: it TAKES
   * the permit, so it must not run for a candidate that fairness would reject
   * anyway.
   */
  private canStart(entry: Entry, now: number): boolean {
    if (entry.admission === undefined) return this.ungoverned < this.concurrency;
    if (this.governed >= this.governedConcurrency) return false;
    if (this.governor === undefined) return true;
    return this.governor.tryAcquire(entry.admission.key, entry.admission.projectedTokens, now);
  }

  /**
   * Pick the next runnable task index, honoring fairness:
   *  1. the first task whose run is eligible (not paused, under its per-run cap), else
   *  2. the first task whose run is merely not paused (fallback so a lone or
   *     fully-saturated-but-uncontended run still drains and no slot idles).
   * Each clause is further filtered by `canStart`, so a rate-governed task
   * that has no permit right now is skipped rather than dequeued.
   * Returns -1 when every waiting task belongs to a paused run, or every
   * otherwise-eligible task is refused by the governor.
   */
  private nextIndex(now: number, governedCap: number): number {
    const eligible = this.tasks.findIndex(
      (entry) => this.isEligible(entry, governedCap) && this.canStart(entry, now),
    );
    if (eligible !== -1) return eligible;
    return this.tasks.findIndex(
      (entry) => !this.pausedRuns.has(entry.runId) && this.canStart(entry, now),
    );
  }

  private pump(): void {
    const now = Date.now();
    // Computed ONCE per pump() call, not per candidate `nextIndex` examines:
    // `governedRunCap()` iterates every queued task, so recomputing it inside
    // `nextIndex`'s `findIndex` predicate made one `pump()` call O(N^3) in the
    // queue depth. Neither `this.tasks` nor `governedInFlightByRun` changes
    // mid-loop in a way that moves this value — a dequeue in one iteration
    // either leaves its run's membership in the union unchanged (it moves
    // from the `tasks` side to the `governedInFlightByRun` side) or has no
    // governed admission at all, so the cap computed here stays correct for
    // every iteration of the loop below, identical to recomputing it fresh
    // each time.
    const governedCap = this.governedRunCap();
    for (;;) {
      const index = this.nextIndex(now, governedCap);
      if (index === -1) break;
      const [entry] = this.tasks.splice(index, 1);
      if (entry.admission === undefined) {
        this.ungoverned++;
      } else {
        this.governed++;
        this.governedInFlightByRun.set(
          entry.runId,
          (this.governedInFlightByRun.get(entry.runId) ?? 0) + 1,
        );
      }
      this.inFlightByRun.set(entry.runId, (this.inFlightByRun.get(entry.runId) ?? 0) + 1);
      // `entry.task()` is caller-supplied and may throw SYNCHRONOUSLY rather
      // than returning a rejected promise — a bug in the task, not a runtime
      // rejection. Uncaught, that would escape this loop entirely, stranding
      // this slot's counters (and the governor permit already taken by
      // `canStart` above) and skipping `armRefillTimer()` below, so the queue
      // can wedge rather than merely miscount one task. Converting it to a
      // rejection here routes it through the same `.catch()`/`.finally()`
      // teardown as an async failure.
      let taskResult: Promise<void>;
      try {
        taskResult = entry.task();
      } catch (err) {
        taskResult = Promise.reject(err);
      }
      taskResult
        .catch(() => {
          /* swallow — task already records its own failure */
        })
        .finally(() => {
          if (entry.admission === undefined) {
            this.ungoverned--;
          } else {
            this.governed--;
            const remainingGoverned = (this.governedInFlightByRun.get(entry.runId) ?? 1) - 1;
            if (remainingGoverned <= 0) this.governedInFlightByRun.delete(entry.runId);
            else this.governedInFlightByRun.set(entry.runId, remainingGoverned);
          }
          const remaining = (this.inFlightByRun.get(entry.runId) ?? 1) - 1;
          if (remaining <= 0) this.inFlightByRun.delete(entry.runId);
          else this.inFlightByRun.set(entry.runId, remaining);
          this.pump();
        });
    }
    this.armRefillTimer();
  }

  /**
   * When every waiting task is governed and refused, nothing will call pump()
   * again on its own — no task is in flight to fire a `.finally()`. One timer
   * at the soonest window rollover is what restarts the queue.
   */
  private armRefillTimer(): void {
    if (this.refillTimer !== undefined) {
      clearTimeout(this.refillTimer);
      this.refillTimer = undefined;
    }
    const waiting = this.tasks.some(
      (t) => t.admission !== undefined && !this.pausedRuns.has(t.runId),
    );
    if (!waiting || this.governor === undefined) return;
    const at = this.governor.nextRefillAt(Date.now());
    if (at === undefined) return;
    this.refillTimer = setTimeout(
      () => {
        this.refillTimer = undefined;
        this.pump();
      },
      Math.max(50, at - Date.now()),
    );
    this.refillTimer.unref?.();
  }
}
