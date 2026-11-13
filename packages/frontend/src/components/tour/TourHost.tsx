import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGuideFacts } from '../../hooks/use-guide-facts.js';
import { AREA_TOURS, isAreaTourId } from '../../lib/tour/area-tours.js';
import { catalogTour, type CatalogTourContext } from '../../lib/tour/catalog.js';
import { FIRST_RUN_TOUR_ID } from '../../lib/tour/first-run.js';
import {
  countedStepIndex,
  nextCountedIndex,
  previousCountedIndex,
  tourPosition,
} from '../../lib/tour/position.js';
import type { Tour } from '../../lib/tour/types.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { accessFor, useProjectStore } from '../../stores/project-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { TourOverlay } from './TourOverlay.js';

/**
 * The tour to run for `id`: a catalog tour, or the glossary area tour (offered
 * when its tab opens, but not in the catalog). The first run has its own host
 * (`FirstRunTour`).
 */
function tourFor(id: string | null, ctx: CatalogTourContext): Tour | undefined {
  if (id === null || id === FIRST_RUN_TOUR_ID) return undefined;
  const entry = catalogTour(id);
  if (entry) return entry.build(ctx);
  return isAreaTourId(id) ? AREA_TOURS[id] : undefined;
}

/**
 * Mounted once in the app shell: the tour that runs, whichever it is, other
 * than the guided first run. (The offer for the area that just opened,
 * `AreaTourOffer`, is mounted separately, in the content column.) The guided
 * first run does not render while another tour is active (see
 * `FirstRunTour`), so the two never show together.
 */
export function TourHost() {
  const activeTourId = useGuideStore((s) => s.activeTourId);
  // Every start request remounts the tour, so it reopens at the step asked for
  // even when that tour is already running.
  const startSeq = useGuideStore((s) => s.activeTourSeq);
  const facts = useGuideFacts();
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);
  const access = useProjectStore((s) => accessFor(s, s.activeProjectId));
  const tour = useMemo(
    () => tourFor(activeTourId, { facts, access, cloudManaged }),
    [activeTourId, facts, access, cloudManaged],
  );
  if (!tour) return null;
  return <RunningTour key={`${tour.id}:${startSeq}`} tour={tour} facts={facts} />;
}

function RunningTour({ tour, facts }: { tour: Tour; facts: CatalogTourContext['facts'] }) {
  const id = tour.id;
  const [shown, setIndex] = useState(() =>
    countedStepIndex(tour, useGuideStore.getState().activeTourStart),
  );
  // A tour built from facts can lose a step while it runs (the Glossaries
  // tour's AI step, when the key stops being usable).
  const index = Math.min(shown, tour.steps.length - 1);
  const position = tourPosition(tour, index);

  // Where the person is, so the tour can reopen there.
  const counted = position.counted - 1;
  useEffect(() => {
    useGuideStore.getState().recordTourStep(id, counted);
  }, [id, counted]);

  // Next and Back move between counted steps: a variant (`variantOf`) is only
  // ever shown in place of the step it names, never stepped onto.
  const onAdvance = useCallback(() => {
    const next = nextCountedIndex(tour, index);
    if (next === undefined) {
      const store = useGuideStore.getState();
      store.completeTour(id);
      store.endTour(true);
      return;
    }
    setIndex(next);
  }, [tour, id, index]);
  const onBack = useCallback(() => setIndex(previousCountedIndex(tour, index)), [tour, index]);
  const onExit = useCallback(() => {
    const store = useGuideStore.getState();
    // Leaving an area tour (one the app offers by itself) is a "no thanks":
    // the offer does not come back.
    if (isAreaTourId(id)) store.declineTour(id);
    store.endTour(false);
  }, [id]);

  return (
    <TourOverlay
      tour={tour}
      stepIndex={index}
      facts={facts}
      position={position}
      onAdvance={onAdvance}
      onBack={onBack}
      onExit={onExit}
    />
  );
}
