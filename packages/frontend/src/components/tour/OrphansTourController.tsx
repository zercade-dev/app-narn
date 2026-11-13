import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { apiRequest } from '../../hooks/use-api.js';
import type { CatalogTourContext } from '../../lib/tour/catalog.js';
import {
  loadPracticeState,
  recoverPracticeOrphan,
  simulateOrphan,
  simulationBlocker,
  type SimBlocker,
} from '../../lib/tour/orphan-sim.js';
import {
  ORPHANS_TOUR_ACTION_EVENT,
  ORPHANS_TOUR_ID,
  orphansTour,
  type OrphansTourAction,
} from '../../lib/tour/orphans-tour.js';
import { tourPosition } from '../../lib/tour/position.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { TourOverlay } from './TourOverlay.js';

type Notice = 'alreadyRecovered' | 'alreadyDeleted';
type ErrorKind = 'backup' | 'simulate' | 'recover' | 'load';

interface RunState {
  /** False while the controller checks where a practice orphan left out earlier is. */
  ready: boolean;
  stepId: string;
  simulated: boolean;
  backupId: string | null;
  restoreSpotlit: boolean;
  notice: Notice | null;
  error: ErrorKind | null;
}

const BLOCKER_KEYS: Record<SimBlocker, string> = {
  'no-entries': 'noEntries',
  collaborator: 'collaborator',
  'sourceless-rows': 'sourcelessRows',
  'unsafe-text': 'unsafeText',
  'comma-in-source-label': 'commaInSourceLabel',
};

/** Steps that wait for the practice orphan to be put back. */
const WHILE_OUT = new Set(['practice-row', 'practice-options', 'recover']);

/**
 * Where Back goes from each step. Nothing goes back into or past the
 * simulation: it ran once, and stepping back must never run it again.
 */
function backFrom(stepId: string, simulated: boolean): string | undefined {
  switch (stepId) {
    case 'offer':
      return 'intro';
    case 'backup':
    case 'explain-list':
      return 'offer';
    case 'explain-options':
      return 'explain-list';
    case 'practice-options':
      return 'practice-row';
    case 'recover':
      return 'practice-options';
    case 'done':
      return simulated ? undefined : 'explain-options';
    default:
      return undefined;
  }
}

const BASE: Omit<RunState, 'stepId' | 'ready'> = {
  simulated: false,
  backupId: null,
  restoreSpotlit: false,
  notice: null,
  error: null,
};

/**
 * Where the tour opens. A practice orphan still out is handled first (the
 * entry must come back), whichever step was asked for. Without one, a
 * continued tour reopens at the offer: the steps after it depend on the
 * choice made there.
 */
function initialRun(): RunState {
  const { orphanSim, activeTourStart } = useGuideStore.getState();
  const activeProjectId = useProjectStore.getState().activeProjectId;
  if (orphanSim && orphanSim.projectId !== activeProjectId) {
    // The offer step proposes switching to that project.
    return { ...BASE, ready: true, stepId: 'offer' };
  }
  if (orphanSim) {
    return {
      ...BASE,
      ready: false,
      stepId: 'recover',
      simulated: true,
      backupId: orphanSim.backupId,
    };
  }
  return { ...BASE, ready: true, stepId: activeTourStart >= 1 ? 'offer' : 'intro' };
}

/**
 * Runs the Orphans tour (the catalog's `controller` for it, mounted by
 * `TourHost`): answers its actions, creates and puts back the practice orphan,
 * and resumes one left out by an earlier, abandoned tour.
 */
export function OrphansTourController({ facts, access }: CatalogTourContext) {
  const { t } = useTranslation('guide-tour');
  const projectId = useProjectStore((s) => s.activeProjectId);
  const entries = useStringStore((s) =>
    projectId !== null && s.loadedProjectId === projectId ? s.entries : null,
  );
  const orphanSim = useGuideStore((s) => s.orphanSim);
  const [run, setRun] = useState<RunState>(initialRun);
  const busy = useRef(false);

  // The offer needs the project's entries to know whether the practice orphan can be offered.
  useEffect(() => {
    if (projectId !== null && entries === null) {
      void Promise.resolve(useStringStore.getState().fetchEntries(projectId)).catch(() => {});
    }
  }, [projectId, entries]);

  // Resuming: where is the practice orphan now?
  useEffect(() => {
    if (run.ready) return;
    const sim = useGuideStore.getState().orphanSim;
    let stale = false;
    const opened = { simulated: true, backupId: sim?.backupId ?? null, ready: true };
    // Put back since this was asked for: nothing to resume.
    const where = sim ? loadPracticeState(sim) : Promise.resolve(null);
    where.then(
      (found) => {
        if (stale) return;
        if (found === null) {
          setRun((r) => ({ ...r, ...BASE, ready: true, stepId: 'intro' }));
          return;
        }
        const { state } = found;
        if (state === 'orphaned') {
          setRun((r) => ({ ...r, ...opened, stepId: 'recover' }));
          return;
        }
        useGuideStore.getState().clearOrphanSim();
        setRun((r) => ({
          ...r,
          ...opened,
          stepId: 'done',
          notice: state === 'live' ? 'alreadyRecovered' : 'alreadyDeleted',
        }));
      },
      () => {
        // "Put it back" checks again before it writes anything.
        if (!stale) setRun((r) => ({ ...r, ...opened, stepId: 'recover', error: 'load' }));
      },
    );
    return () => {
      stale = true;
    };
  }, [run.ready]);

  const blocker = entries === null ? null : simulationBlocker(entries, access);
  // A practice orphan is out in another project: that one comes back first.
  const otherProject = orphanSim !== null && orphanSim.projectId !== projectId;
  const offer = otherProject
    ? 'switch-project'
    : entries === null || blocker !== null
      ? 'explain-only'
      : 'simulate';
  const tour = useMemo(
    () =>
      orphansTour({
        simulated: run.simulated,
        backupId: run.backupId,
        offer,
        restoreSpotlit: run.restoreSpotlit,
      }),
    [run.simulated, run.backupId, offer, run.restoreSpotlit],
  );
  const found = tour.steps.findIndex((s) => s.id === run.stepId);
  const index = found === -1 ? 0 : found;
  const stepId = tour.steps[index]?.id;
  const position = tourPosition(tour, index);

  const counted = position.counted - 1;
  useEffect(() => {
    if (run.ready) useGuideStore.getState().recordTourStep(ORPHANS_TOUR_ID, counted);
  }, [run.ready, counted]);

  const go = useCallback((next: string, patch: Partial<RunState> = {}) => {
    setRun((r) => ({ ...r, ...patch, stepId: next }));
  }, []);

  // The simulation runs once, when its step comes up.
  const simulating = useRef(false);
  useEffect(() => {
    if (stepId !== 'simulating' || simulating.current || projectId === null) return;
    simulating.current = true;
    busy.current = true;
    simulateOrphan(projectId, access, run.backupId)
      .then(
        () => go('practice-row'),
        () => go('offer', { simulated: false, error: 'simulate' }),
      )
      .finally(() => {
        simulating.current = false;
        busy.current = false;
      });
  }, [stepId, projectId, access, run.backupId, go]);

  // Put back from the Orphans tab's practice banner while the tour waits for it.
  const afterRecover = run.backupId === null ? 'done' : 'restore';
  useEffect(() => {
    if (orphanSim === null && stepId !== undefined && WHILE_OUT.has(stepId) && !busy.current) {
      go(afterRecover);
    }
  }, [orphanSim, stepId, afterRecover, go]);

  // The latest values for the action listener.
  const latest = useRef({ run, offer, projectId, afterRecover });
  useEffect(() => {
    latest.current = { run, offer, projectId, afterRecover };
  });

  useEffect(() => {
    const onAction = (e: Event) => {
      const name = (e as CustomEvent<OrphansTourAction>).detail;
      const { offer: offered, projectId: pid, afterRecover: next, run: now } = latest.current;
      if (busy.current) return;
      const task = (work: () => Promise<void>) => {
        busy.current = true;
        setRun((r) => ({ ...r, error: null }));
        void work().finally(() => {
          busy.current = false;
        });
      };
      switch (name) {
        case 'simulate':
          // Never offered while something stands in the way.
          if (offered !== 'simulate' || useGuideStore.getState().orphanSim) return;
          go('backup', { simulated: true, error: null, notice: null });
          return;
        case 'explain-only':
          go('explain-list', { simulated: false, error: null, notice: null });
          return;
        case 'skip-backup':
          go('simulating', { backupId: null, error: null });
          return;
        case 'backup-first':
          if (pid === null) return;
          task(async () => {
            try {
              const backup = await apiRequest<{ id: string }>(`/projects/${pid}/backups`, {
                method: 'POST',
              });
              go('simulating', { backupId: backup.id });
            } catch {
              setRun((r) => ({ ...r, error: 'backup' }));
            }
          });
          return;
        case 'recover':
          task(async () => {
            try {
              const outcome = await recoverPracticeOrphan();
              go(next, {
                notice:
                  outcome === 'recovered'
                    ? null
                    : outcome === 'already-live'
                      ? 'alreadyRecovered'
                      : 'alreadyDeleted',
              });
            } catch {
              setRun((r) => ({ ...r, error: 'recover' }));
            }
          });
          return;
        case 'restore-backup':
          if (now.backupId !== null) setRun((r) => ({ ...r, restoreSpotlit: true }));
          return;
        case 'switch-project': {
          const sim = useGuideStore.getState().orphanSim;
          if (!sim) return;
          task(async () => {
            try {
              await useProjectStore.getState().activateProject(sim.projectId);
              const view = useViewStore.getState();
              view.setView('project');
              view.setActiveTab('orphans');
              setRun({ ...BASE, ready: false, stepId: 'recover' });
            } catch {
              setRun((r) => ({ ...r, error: 'load' }));
            }
          });
          return;
        }
      }
    };
    globalThis.addEventListener(ORPHANS_TOUR_ACTION_EVENT, onAction);
    return () => globalThis.removeEventListener(ORPHANS_TOUR_ACTION_EVENT, onAction);
  }, [go]);

  const onAdvance = useCallback(() => {
    for (let i = index + 1; i < tour.steps.length; i++) {
      if (tour.steps[i].variantOf === undefined) {
        go(tour.steps[i].id);
        return;
      }
    }
    const store = useGuideStore.getState();
    store.completeTour(ORPHANS_TOUR_ID);
    store.endTour(true);
  }, [index, tour, go]);

  const back = stepId === undefined ? undefined : backFrom(stepId, run.simulated);
  const onBack = useCallback(() => {
    if (back !== undefined) go(back, { error: null });
  }, [back, go]);

  const onExit = useCallback(() => {
    // Leaving with the practice orphan still out: say where to put it back.
    if (useGuideStore.getState().orphanSim) toast.info(t('orphansTour.notices.leftOut'));
    useGuideStore.getState().endTour(false);
  }, [t]);

  if (!run.ready) return null;

  const lines: Array<{ key: string; testId: string; tone: string }> = [];
  if (stepId === 'offer' && otherProject) {
    lines.push({
      key: 'orphansTour.notices.otherProject',
      testId: 'orphans-tour-notice-otherProject',
      tone: 'text-status-warn',
    });
  } else if (stepId === 'offer' && blocker !== null) {
    lines.push({
      key: `orphansTour.blocked.${BLOCKER_KEYS[blocker]}`,
      testId: 'orphans-tour-blocked',
      tone: 'text-muted-foreground',
    });
  }
  if (run.notice !== null) {
    lines.push({
      key: `orphansTour.notices.${run.notice}`,
      testId: `orphans-tour-notice-${run.notice}`,
      tone: 'text-status-warn',
    });
  }
  if (run.error !== null) {
    lines.push({
      key: `orphansTour.errors.${run.error}`,
      testId: `orphans-tour-error-${run.error}`,
      tone: 'text-status-fail',
    });
  }
  const extra =
    lines.length === 0 ? undefined : (
      <div className="flex flex-col gap-1">
        {lines.map((line) => (
          <p key={line.testId} data-testid={line.testId} className={`text-sm ${line.tone}`}>
            {t(line.key)}
          </p>
        ))}
      </div>
    );

  return (
    <TourOverlay
      tour={tour}
      stepIndex={index}
      facts={facts}
      position={position}
      extra={extra}
      canGoBack={back !== undefined}
      onAdvance={onAdvance}
      onBack={onBack}
      onExit={onExit}
    />
  );
}
