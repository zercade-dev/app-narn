import { useCallback, useEffect, useState } from 'react';
import { useGuideFacts } from '../../hooks/use-guide-facts.js';
import { AREA_TOURS, isAreaTourId } from '../../lib/tour/area-tours.js';
import { FIRST_RUN_TOUR_ID } from '../../lib/tour/first-run.js';
import { countedStepIndex, tourPosition } from '../../lib/tour/position.js';
import type { Tour } from '../../lib/tour/types.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { TourOverlay } from './TourOverlay.js';

/** The tour to run for `id`; the first run has its own host (`FirstRunTour`). */
function tourFor(id: string | null): Tour | undefined {
  if (id === null || id === FIRST_RUN_TOUR_ID) return undefined;
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
  const tour = tourFor(activeTourId);
  if (!tour) return null;
  return <RunningTour key={tour.id} tour={tour} />;
}

function RunningTour({ tour }: { tour: Tour }) {
  const id = tour.id;
  const facts = useGuideFacts();
  const [index, setIndex] = useState(() =>
    countedStepIndex(tour, useGuideStore.getState().activeTourStart),
  );
  const last = tour.steps.length - 1;
  const position = tourPosition(tour, index);

  // Where the person is, so the tour can reopen there.
  const counted = position.counted - 1;
  useEffect(() => {
    useGuideStore.getState().recordTourStep(id, counted);
  }, [id, counted]);

  const onAdvance = useCallback(() => {
    if (index >= last) {
      const store = useGuideStore.getState();
      store.completeTour(id);
      store.endTour(true);
      return;
    }
    setIndex(index + 1);
  }, [id, index, last]);
  const onBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
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
