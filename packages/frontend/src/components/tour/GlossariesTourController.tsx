import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  projectTargetLanguages,
  type Glossary,
  type GlossarySummary,
} from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import type { CatalogTourContext } from '../../lib/tour/catalog.js';
import type { Tour, TourStep } from '../../lib/tour/types.js';
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
import { useTourAnchor } from '../../hooks/use-tour-anchor.js';
import { TourOverlay } from './TourOverlay.js';
import type { TourText } from './TourCallout.js';

/** The prompt Enable opens, asking whether to apply the glossary's matches. */
const ENABLE_PROMPT_ANCHOR = 'glossary-enable-prompt';

/** Steps that show the picked glossary's card (its terms, its Enable button). */
const ON_CARD = new Set(['picked', 'constant', 'enable']);

/**
 * The glossary the person enabled in the tour, per project: a tour resumed
 * past the enable step shows that one again, even after a reload (its
 * progress is kept). Browser storage may be unavailable: then the pick falls
 * back to the glossary on with the most matches.
 */
const enabledKey = (projectId: string) => `narn-glossaries-tour-enabled:${projectId}`;

function rememberEnabled(projectId: string, glossaryId: string): void {
  try {
    localStorage.setItem(enabledKey(projectId), glossaryId);
  } catch {
    // Storage blocked: the resume falls back as above.
  }
}

function rememberedEnabled(projectId: string): string | null {
  try {
    return localStorage.getItem(enabledKey(projectId));
  } catch {
    return null;
  }
}

/**
 * While the glossary is being picked, the first step offers no Next: the
 * steps after it show the picked glossary, and would have nothing to show.
 */
function waitOnFirstStep(tour: Tour): Tour {
  return {
    ...tour,
    steps: tour.steps.map((s): TourStep =>
      s.id === 'purpose' ? { ...s, advance: { kind: 'manual' } } : s,
    ),
  };
}

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
  // Resumed on a step after the enable step ("Continue where I left off"):
  // the glossary to show is one already on, not a fresh one to enable.
  const [resumedPastEnable] = useState(() => {
    const steps = glossariesTour(facts).steps.filter((s) => s.variantOf === undefined);
    const enableAt = steps.findIndex((s) => s.id === 'enable');
    return enableAt >= 0 && useGuideStore.getState().activeTourStart > enableAt;
  });

  useEffect(() => {
    if (projectId === null || entries !== null) return;
    let stale = false;
    // The store records a failed read in `error` rather than rejecting.
    const failed = () => {
      const s = useStringStore.getState();
      return s.loadedProjectId !== projectId && s.error !== null;
    };
    void Promise.resolve(useStringStore.getState().fetchEntries(projectId))
      .catch(() => {})
      .then(() => {
        // Unreadable entries: no glossary to pick, the tour only explains.
        if (!stale && failed()) setPick((p) => (p === undefined ? null : p));
      });
    return () => {
      stale = true;
    };
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
        ? pickTourGlossary(glossaries, texts, projectTargetLanguages(project), {
            resumedPastEnable,
            enabledId: rememberedEnabled(projectId),
          })
        : null;
      setPick(found);
      // Already on: its matches were applied when it was enabled.
      if (found?.enabled) setApplied(true);
    });
    return () => {
      stale = true;
    };
  }, [ready, projectId, entries, project, resumedPastEnable]);

  const tour = useMemo(() => {
    // Nothing to enable (no glossary could be read): the explanation only.
    const built = glossariesTour(facts, collaborator || pick === null, {
      pickEnabled: pick?.enabled ?? false,
    });
    return pick === undefined ? waitOnFirstStep(built) : built;
  }, [facts, collaborator, pick]);
  const [shown, setIndex] = useState(() =>
    countedStepIndex(tour, useGuideStore.getState().activeTourStart),
  );
  const counted = Math.min(shown, tour.steps.length - 1);
  // The enable prompt open: the step about its two answers shows instead.
  const promptOpen = useTourAnchor(ENABLE_PROMPT_ANCHOR) !== null;
  const choiceIndex = tour.steps.findIndex((s) => s.id === 'choice');
  const index =
    tour.steps[counted]?.id === 'enable' && promptOpen && choiceIndex >= 0 ? choiceIndex : counted;
  const step = tour.steps[index];
  const position = tourPosition(tour, index);
  const stepId = step?.id ?? '';

  const reached = position.counted - 1;
  useEffect(() => {
    useGuideStore.getState().recordTourStep(GLOSSARIES_TOUR_ID, reached);
  }, [reached]);

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
    const next = nextCountedIndex(tour, counted);
    if (next === undefined) {
      const store = useGuideStore.getState();
      store.completeTour(GLOSSARIES_TOUR_ID);
      store.endTour(true);
      return;
    }
    setIndex(next);
  }, [tour, counted]);
  const onBack = useCallback(() => setIndex(previousCountedIndex(tour, counted)), [tour, counted]);
  const onExit = useCallback(() => {
    const store = useGuideStore.getState();
    // Leaving it is a "no thanks" to the Glossary tab's short offer too.
    store.declineTour('glossary');
    store.endTour(false);
  }, []);

  // Enabling it, by either answer to the prompt, moves the enable step on.
  useEffect(() => {
    if ((stepId !== 'enable' && stepId !== 'choice') || pick?.enabled !== false) return;
    return onTourSignal((signal) => {
      if (projectId !== null && pickId !== null) rememberEnabled(projectId, pickId);
      setApplied(signal === 'glossary-enabled-applied');
      setPick((p) => (p ? { ...p, enabled: true } : p));
      setIndex((i) => nextCountedIndex(tour, i) ?? i);
    });
  }, [stepId, pick?.enabled, pickId, projectId, tour]);

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
