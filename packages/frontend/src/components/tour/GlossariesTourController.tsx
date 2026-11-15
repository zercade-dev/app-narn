import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  projectTargetLanguages,
  type Glossary,
  type GlossarySummary,
} from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import type { CatalogTourContext } from '../../lib/tour/catalog.js';
import { GLOSSARIES_TOUR_ID, glossariesTour } from '../../lib/tour/glossaries-tour.js';
import { pickTourGlossary, type GlossaryPick } from '../../lib/tour/glossary-pick.js';
import {
  sendGlossaryTourCommand,
  takeGlossaryTourCommand,
} from '../../lib/tour/glossary-tour-command.js';
import {
  countedStepIndex,
  nextCountedIndex,
  previousCountedIndex,
  tourPosition,
} from '../../lib/tour/position.js';
import { onTourSignal } from '../../lib/tour/signal.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { TourOverlay } from './TourOverlay.js';
import type { TourText } from './TourCallout.js';

/** Steps that show the picked glossary's card (its terms, its Enable button). */
const ON_CARD = new Set(['picked', 'constant', 'enable']);

/** The project's glossaries with their terms, or null when they cannot be read. */
async function loadGlossaries(projectId: string): Promise<Glossary[] | null> {
  try {
    const list = await apiRequest<GlossarySummary[]>(`/projects/${projectId}/glossaries`);
    return await Promise.all(
      list.map((g) => apiRequest<Glossary>(`/projects/${projectId}/glossaries/${g.id}`)),
    );
  } catch {
    return null;
  }
}

/**
 * Runs the owner's Glossaries tour (the catalog's `controller` for it):
 * picks the glossary to enable, has the Glossary tab show it and, once it is
 * enabled, the entries it matched. A collaborator's tour only explains, and
 * runs as built.
 */
export function GlossariesTourController({ facts, access }: CatalogTourContext) {
  const collaborator = access.role === 'collaborator';
  const projectId = useProjectStore((s) => s.activeProjectId);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const entries = useStringStore((s) =>
    projectId !== null && s.loadedProjectId === projectId ? s.entries : null,
  );
  // undefined while it is worked out; null when there is no glossary to show.
  const [pick, setPick] = useState<GlossaryPick | null | undefined>(
    collaborator ? null : undefined,
  );
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (projectId !== null && entries === null) {
      // Unreadable entries: no glossary to pick, the tour only explains.
      void Promise.resolve(useStringStore.getState().fetchEntries(projectId)).catch(() =>
        setPick((p) => (p === undefined ? null : p)),
      );
    }
  }, [projectId, entries]);

  // Picked once, when the entries are in: a later change of the list must not
  // swap the glossary under the person.
  const ready = pick !== undefined || projectId === null || entries === null || !project;
  useEffect(() => {
    if (ready || projectId === null || entries === null || !project) return;
    let stale = false;
    void loadGlossaries(projectId).then((glossaries) => {
      if (stale) return;
      const texts = entries.map((e) => e.sourceText);
      const found = glossaries
        ? pickTourGlossary(glossaries, texts, projectTargetLanguages(project))
        : null;
      setPick(found);
      // Already on: its matches were applied when it was enabled.
      if (found?.enabled) setApplied(true);
    });
    return () => {
      stale = true;
    };
  }, [ready, projectId, entries, project]);

  const tour = useMemo(
    () =>
      // Nothing to enable (no glossary could be read): the explanation only.
      glossariesTour(facts, collaborator || pick === null, { pickEnabled: pick?.enabled ?? false }),
    [facts, collaborator, pick],
  );
  const [shown, setIndex] = useState(() =>
    countedStepIndex(tour, useGuideStore.getState().activeTourStart),
  );
  const index = Math.min(shown, tour.steps.length - 1);
  const step = tour.steps[index];
  const position = tourPosition(tour, index);
  const stepId = step?.id ?? '';

  const counted = position.counted - 1;
  useEffect(() => {
    useGuideStore.getState().recordTourStep(GLOSSARIES_TOUR_ID, counted);
  }, [counted]);

  // The tab shows what the step is about.
  const pickId = pick?.id ?? null;
  useEffect(() => {
    if (pickId === null) return;
    if (ON_CARD.has(stepId)) sendGlossaryTourCommand({ kind: 'select', id: pickId });
    if (stepId === 'matches') {
      sendGlossaryTourCommand({ kind: 'show-matches', id: pickId, applied });
    }
  }, [stepId, pickId, applied]);

  // A command no tab took dies with the tour: a later visit to the tab is the person's own.
  useEffect(() => () => void takeGlossaryTourCommand(), []);

  const onAdvance = useCallback(() => {
    const next = nextCountedIndex(tour, index);
    if (next === undefined) {
      const store = useGuideStore.getState();
      store.completeTour(GLOSSARIES_TOUR_ID);
      store.endTour(true);
      return;
    }
    setIndex(next);
  }, [tour, index]);
  const onBack = useCallback(() => setIndex(previousCountedIndex(tour, index)), [tour, index]);
  const onExit = useCallback(() => {
    const store = useGuideStore.getState();
    // Leaving it is a "no thanks" to the Glossary tab's short offer too.
    store.declineTour('glossary');
    store.endTour(false);
  }, []);

  // Enabling it, by either answer to the prompt, moves the enable step on.
  useEffect(() => {
    if (stepId !== 'enable' || pick?.enabled !== false) return;
    return onTourSignal((signal) => {
      setApplied(signal === 'glossary-enabled-applied');
      setPick((p) => (p ? { ...p, enabled: true } : p));
      setIndex((i) => nextCountedIndex(tour, i) ?? i);
    });
  }, [stepId, pick?.enabled, tour]);

  const text = useMemo((): TourText | undefined => {
    if (!pick) return undefined;
    const keys: Record<string, string> = {};
    if (pick.matches === 0) {
      keys['glossariesTour.picked.what'] = 'glossariesTour.picked.noneWhat';
      keys['glossariesTour.matches.what'] = 'glossariesTour.matches.noneWhat';
    } else if (!applied) {
      keys['glossariesTour.matches.what'] = 'glossariesTour.matches.onlyWhat';
    }
    return { keys, values: { name: pick.name, count: String(pick.matches) } };
  }, [pick, applied]);

  // The first step needs no glossary: it shows while one is picked.
  if (!step || (pick === undefined && stepId !== 'purpose')) return null;
  return (
    <TourOverlay
      tour={tour}
      stepIndex={index}
      facts={facts}
      position={position}
      text={text}
      onAdvance={onAdvance}
      onBack={onBack}
      onExit={onExit}
    />
  );
}
