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
 * a lone run is never throttled and no slot idles needlessly).
 */
export class JobQueue {
  private readonly tasks: Array<{ runId: string; task: () => Promise<void> }> = [];
  private inFlight = 0;
  /** In-flight task count per runId (entries are deleted when they reach 0). */
  private readonly inFlightByRun = new Map<string, number>();
  private readonly pausedRuns = new Set<string>();
  /**
   * Max slots one run may hold while another run is waiting. Derived from
   * `concurrency`: `concurrency - 1` keeps at least one slot reclaimable by a
   * competing run, with a floor of 1 so a single-slot queue (or a lone run)
   * still makes progress.
   */
  private readonly perRunCap: number;

  constructor(private readonly concurrency: number) {
    this.perRunCap = Math.max(1, concurrency - 1);
  }

  add(runId: string, task: () => Promise<void>): void {
    this.tasks.push({ runId, task });
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

  /** Whether `runId` may take another slot: not paused and under its per-run cap. */
  private isEligible(runId: string): boolean {
    return !this.pausedRuns.has(runId) && (this.inFlightByRun.get(runId) ?? 0) < this.perRunCap;
  }

  /**
   * Pick the next runnable task index, honoring fairness:
   *  1. the first task whose run is eligible (not paused, under its per-run cap), else
   *  2. the first task whose run is merely not paused (fallback so a lone or
   *     fully-saturated-but-uncontended run still drains and no slot idles).
   * Returns -1 when every waiting task belongs to a paused run.
   */
  private nextIndex(): number {
    const eligible = this.tasks.findIndex((entry) => this.isEligible(entry.runId));
    if (eligible !== -1) return eligible;
    return this.tasks.findIndex((entry) => !this.pausedRuns.has(entry.runId));
  }

  private pump(): void {
    while (this.inFlight < this.concurrency) {
      const index = this.nextIndex();
      if (index === -1) break;
      const [entry] = this.tasks.splice(index, 1);
      this.inFlight++;
      this.inFlightByRun.set(entry.runId, (this.inFlightByRun.get(entry.runId) ?? 0) + 1);
      entry
        .task()
        .catch(() => {
          /* swallow — task already records its own failure */
        })
        .finally(() => {
          this.inFlight--;
          const remaining = (this.inFlightByRun.get(entry.runId) ?? 1) - 1;
          if (remaining <= 0) this.inFlightByRun.delete(entry.runId);
          else this.inFlightByRun.set(entry.runId, remaining);
          this.pump();
        });
    }
  }
}
