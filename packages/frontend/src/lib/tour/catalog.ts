/**
 * Every tour the Guide lists, in display order, and how to build each one for
 * the person. `TourHost` runs these (all but the first run, which has its own
 * host). The glossary area tour is not listed: the Glossaries tour replaces it
 * here, and it stays as the offer when the Glossary tab opens.
 */
import type { ProjectAccessInfo } from '@/stores/project-store';
import type { Tab } from '@/stores/view-store';
import { visibleTabs } from '../mode-gating.js';
import { ADVANCED_SECTIONS_TOUR_ID, advancedSectionsTour } from './advanced-sections.js';
import { AREA_TOURS, type AreaTourId } from './area-tours.js';
import { FIRST_RUN_TOUR_ID, firstRunTourFor } from './first-run.js';
import { GLOSSARIES_TOUR_ID, glossariesTour } from './glossaries-tour.js';
import type { GuideFacts, Tour } from './types.js';

export interface CatalogTourContext {
  facts: GuideFacts;
  access: ProjectAccessInfo;
  cloudManaged: boolean;
}

export interface CatalogTour {
  id: string;
  needsProject: boolean;
  /** Starting it in Simple switches to Advanced and says so (`guideTours.switchedToAdvanced`). */
  needsAdvanced: boolean;
  /** Listed only when `visibleTabs(access, cloud, 'advanced')` includes it. */
  tab?: Tab;
  build(ctx: CatalogTourContext): Tour;
}

function areaTour(id: Exclude<AreaTourId, 'glossary'>): CatalogTour {
  return { id, needsProject: true, needsAdvanced: true, tab: id, build: () => AREA_TOURS[id] };
}

export const TOUR_CATALOG: readonly CatalogTour[] = [
  {
    id: FIRST_RUN_TOUR_ID,
    needsProject: false,
    needsAdvanced: false,
    build: ({ facts }) => firstRunTourFor(facts),
  },
  {
    id: ADVANCED_SECTIONS_TOUR_ID,
    needsProject: true,
    needsAdvanced: true,
    build: ({ access, cloudManaged }) => advancedSectionsTour(access, cloudManaged),
  },
  {
    id: GLOSSARIES_TOUR_ID,
    needsProject: true,
    needsAdvanced: true,
    tab: 'glossary',
    build: ({ facts }) => glossariesTour(facts),
  },
  areaTour('routing'),
  areaTour('quality'),
  areaTour('compare'),
  areaTour('review-translation-ai'),
];

export function catalogTour(id: string): CatalogTour | undefined {
  return TOUR_CATALOG.find((tour) => tour.id === id);
}

/** The tours to list for this access: a tab tour only when the tab exists for them in Advanced. */
export function listedTours(
  access: ProjectAccessInfo,
  cloudManaged: boolean,
): readonly CatalogTour[] {
  const tabs = visibleTabs(access, cloudManaged, 'advanced');
  return TOUR_CATALOG.filter((tour) => tour.tab === undefined || tabs.includes(tour.tab));
}
