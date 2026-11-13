import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { RunStatusCode, type RunStatus } from '@zercade-dev/narn-shared';
import { useRunStore } from './run-store.js';
import { isChatRun } from '../lib/run-kind.js';
import { estimateEta, type Eta, type ProgressSample } from '../lib/run-progress/eta.js';

const MAX_SAMPLES = 120;
/** How long a finished run's card stays up before it disappears. */
export const RUN_CARD_LINGER_MS = 5000;

interface RunProgressState {
  samples: Record<string, ProgressSample[]>;
  /** Last smoothed ETA (seconds) shown per run; the next estimate smooths against it. */
  eta: Record<string, number>;
  setEta: (runId: string, seconds: number | undefined) => void;
}

export const useRunProgressStore = create<RunProgressState>((set) => ({
  samples: {},
  eta: {},
  setEta: (runId, seconds) =>
    set((s) => {
      const eta = { ...s.eta };
      if (seconds === undefined) delete eta[runId];
      else eta[runId] = seconds;
      return { eta };
    }),
}));

function settled(run: RunStatus): number {
  return run.completed + run.failed;
}

/** A run that is not progressing by design: parked on quota, paused or not yet started. */
export function isRunWaiting(run: RunStatus): boolean {
  return (
    !!run.waitingForQuota ||
    run.status === RunStatusCode.Paused ||
    run.status === RunStatusCode.Pending
  );
}

function syncFromRuns(runs: RunStatus[]): void {
  const { samples, eta } = useRunProgressStore.getState();
  const ids = new Set(runs.map((r) => r.runId));
  let nextSamples = samples;
  let nextEta = eta;
  const now = Date.now();

  for (const run of runs) {
    if (run.status !== RunStatusCode.Running) continue;
    const done = settled(run);
    const list = nextSamples[run.runId] ?? [];
    const last = list[list.length - 1];
    if (last && last.done >= done) continue;
    if (nextSamples === samples) nextSamples = { ...samples };
    nextSamples[run.runId] = [...list, { at: now, done }].slice(-MAX_SAMPLES);
  }
  for (const id of Object.keys(nextSamples)) {
    if (ids.has(id)) continue;
    if (nextSamples === samples) nextSamples = { ...samples };
    delete nextSamples[id];
  }
  for (const id of Object.keys(nextEta)) {
    if (ids.has(id)) continue;
    if (nextEta === eta) nextEta = { ...eta };
    delete nextEta[id];
  }
  if (nextSamples !== samples || nextEta !== eta) {
    useRunProgressStore.setState({ samples: nextSamples, eta: nextEta });
  }
}

let lastRuns: RunStatus[] | undefined;
useRunStore.subscribe((state) => {
  if (state.runs === lastRuns) return;
  lastRuns = state.runs;
  syncFromRuns(state.runs);
});

/**
 * Per-run cache so every card showing one run computes the ETA once a second
 * and shows the same value (smoothing is applied once per tick, not per card).
 */
const etaCache = new Map<string, { at: number; waiting: boolean; value: Eta }>();

function etaFor(run: RunStatus, now: number): Eta {
  const hit = etaCache.get(run.runId);
  const waiting = isRunWaiting(run);
  if (hit && hit.waiting === waiting && Math.abs(now - hit.at) < 900) return hit.value;
  const { samples, eta, setEta } = useRunProgressStore.getState();
  const value = estimateEta({
    samples: samples[run.runId] ?? [],
    total: run.total,
    startedAt: run.startedAt,
    now,
    waiting,
    previous: eta[run.runId],
  });
  setEta(run.runId, value.kind === 'eta' ? value.seconds : undefined);
  etaCache.set(run.runId, { at: now, waiting, value });
  return value;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface RunProgress {
  run: RunStatus;
  done: number;
  elapsedMs: number;
  eta: Eta;
  /** The clock the values were computed at (for the card's linger check). */
  now: number;
}

/** Live progress of one run, re-evaluated on a 1 s clock. */
export function useRunProgress(runId: string): RunProgress | null {
  const run = useRunStore((s) => s.runs.find((r) => r.runId === runId));
  const now = useNow(1000);
  if (!run) return null;
  const ended = run.finishedAt !== undefined;
  return {
    run,
    done: settled(run),
    elapsedMs: Math.max(0, (run.finishedAt ?? now) - run.startedAt),
    eta: ended ? { kind: 'estimating' } : etaFor(run, now),
    now,
  };
}

const ACTIVE = new Set([RunStatusCode.Running, RunStatusCode.Pending, RunStatusCode.Paused]);

/** Run ids to show a progress card for: in flight, or ended less than 5 s ago. */
export function useActiveRunCards(projectId: string | null): string[] {
  const runs = useRunStore((s) => s.runs);
  const now = useNow(1000);
  const [stable, setStable] = useState<string[]>([]);
  const ids =
    projectId === null
      ? []
      : runs
          .filter((r) => {
            if (r.projectId !== projectId || isChatRun(r)) return false;
            if (ACTIVE.has(r.status)) return true;
            return r.finishedAt !== undefined && now - r.finishedAt < RUN_CARD_LINGER_MS;
          })
          .map((r) => r.runId);
  if (ids.length === stable.length && ids.every((id, i) => id === stable[i])) return stable;
  setStable(ids);
  return ids;
}
