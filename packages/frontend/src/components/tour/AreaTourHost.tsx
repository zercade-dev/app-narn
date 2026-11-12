import { useCallback, useState } from 'react';
import { useGuideFacts } from '../../hooks/use-guide-facts.js';
import { AREA_TOURS, isAreaTourId, type AreaTourId } from '../../lib/tour/area-tours.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { AreaTourOffer } from './AreaTourOffer.js';
import { TourOverlay } from './TourOverlay.js';

/**
 * Mounted once in the app shell: the offer for the area that just opened, and
 * the area tour while one runs. The guided first run does not render while an
 * area tour is active (see `FirstRunTour`), so the two never show together.
 */
export function AreaTourHost() {
  const activeTourId = useGuideStore((s) => s.activeTourId);
  return (
    <>
      <AreaTourOffer />
      {isAreaTourId(activeTourId) && <RunningAreaTour key={activeTourId} id={activeTourId} />}
    </>
  );
}

function RunningAreaTour({ id }: { id: AreaTourId }) {
  const tour = AREA_TOURS[id];
  const facts = useGuideFacts();
  const [index, setIndex] = useState(0);
  const last = tour.steps.length - 1;

  const onAdvance = useCallback(() => {
    if (index >= last) {
      useGuideStore.getState().endTour(true);
      return;
    }
    setIndex(index + 1);
  }, [index, last]);
  const onBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  // Leaving a tour is a "no thanks": the offer does not come back.
  const onExit = useCallback(() => {
    const store = useGuideStore.getState();
    store.declineTour(id);
    store.endTour(false);
  }, [id]);

  return (
    <TourOverlay
      tour={tour}
      stepIndex={index}
      facts={facts}
      onAdvance={onAdvance}
      onBack={onBack}
      onExit={onExit}
    />
  );
}
