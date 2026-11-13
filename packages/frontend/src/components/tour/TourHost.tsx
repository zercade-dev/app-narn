import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGuideFacts } from '../../hooks/use-guide-facts.js';
import { AREA_TOURS, isAreaTourId } from '../../lib/tour/area-tours.js';
import { catalogTour, type CatalogTourContext } from '../../lib/tour/catalog.js';
import { FIRST_RUN_TOUR_ID } from '../../lib/tour/first-run.js';
import { endOrphansTour } from '../../lib/tour/end-orphans-tour.js';
import { ORPHANS_TOUR_ID } from '../../lib/tour/orphans-tour.js';
import {
  countedStepIndex,
  nextCountedIndex,
  previousCountedIndex,
  tourPosition,
} from '../../lib/tour/position.js';
import type { Tour } from '../../lib/tour/types.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { accessFor, useProjectStore } from '../../stores/project-store.js';
import { useUiSettings } from '../../stores/ui-settings-store.js';
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
  const ctx = useMemo(() => ({ facts, access, cloudManaged }), [facts, access, cloudManaged]);

  // A tour of what Advanced adds cannot go on in Simple: its tabs and views
  // are gone, and the callouts would describe things no longer on screen. It
  // ends (its place is kept, so the Guide can continue it); it is not a "no
  // thanks", so an area offer may still come back.
  const { t } = useTranslation('guide-tour');
  const simple = useUiSettings((s) => s.uiMode) === 'simple';
  useEffect(() => {
    if (!simple || activeTourId === null || !needsAdvanced(activeTourId)) return;
    // The Orphans tab is gone in Simple: a practice orphan still out goes back now.
    if (activeTourId === ORPHANS_TOUR_ID) endOrphansTour(t, { putBack: true });
    else useGuideStore.getState().endTour(false);
  }, [simple, activeTourId, t]);

  // A catalog tour with its own controller runs it in place of the default runner.
  const Controller = activeTourId === null ? undefined : catalogTour(activeTourId)?.controller;
  const tour = useMemo(
    () => (Controller ? undefined : tourFor(activeTourId, ctx)),
    [Controller, activeTourId, ctx],
  );
  if (Controller) return <Controller key={`${activeTourId}:${startSeq}`} {...ctx} />;
  if (!tour) return null;
  return <RunningTour key={`${tour.id}:${startSeq}`} tour={tour} facts={facts} />;
}

/** Whether tour `id` shows areas only Advanced has (an area tour always does). */
function needsAdvanced(id: string): boolean {
  if (id === FIRST_RUN_TOUR_ID) return false;
  return catalogTour(id)?.needsAdvanced ?? isAreaTourId(id);
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
