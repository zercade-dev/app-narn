/**
 * The "Advanced sections" tour: one explanation step per sidebar section that
 * Advanced adds to Simple, for what the person can open. Its steps come from
 * the same lists the mode gating uses (`SIMPLE_TABS`, `SIMPLE_HIDDEN_VIEWS`),
 * so the tour and the gating cannot drift apart.
 */
import type { ProjectAccessInfo } from '@/stores/project-store';
import { SIMPLE_HIDDEN_VIEWS, SIMPLE_TABS } from '../mode-gating.js';
import { availableTabs } from '../tab-gating.js';
import type { Tour, TourStep } from './types.js';

export const ADVANCED_SECTIONS_TOUR_ID = 'advanced-sections';

function sectionStep(section: string, anchor: string): TourStep {
  return {
    id: section,
    anchor,
    titleKey: `advancedSections.${section}.title`,
    whatKey: `advancedSections.${section}.what`,
    whyKey: `advancedSections.${section}.why`,
    advance: { kind: 'next' },
  };
}

/** One `next` step per tab in availableTabs(access, cloud) \ SIMPLE_TABS (anchor `tab-<id>`) then per SIMPLE_HIDDEN_VIEWS (anchor `sidebar-<view>`). */
export function advancedSectionsTour(access: ProjectAccessInfo, cloudManaged: boolean): Tour {
  const tabs = availableTabs(access, cloudManaged).filter((tab) => !SIMPLE_TABS.includes(tab));
  return {
    id: ADVANCED_SECTIONS_TOUR_ID,
    steps: [
      ...tabs.map((tab) => sectionStep(tab, `tab-${tab}`)),
      ...SIMPLE_HIDDEN_VIEWS.map((view) => sectionStep(view, `sidebar-${view}`)),
    ],
  };
}
