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

/**
 * In the sidebar's order, top to bottom: one `next` step per SIMPLE_HIDDEN_VIEWS
 * entry (anchor `sidebar-<view>`, at the top of the sidebar), then per tab in
 * availableTabs(access, cloud) \ SIMPLE_TABS (anchor `tab-<id>`).
 */
export function advancedSectionsTour(access: ProjectAccessInfo, cloudManaged: boolean): Tour {
  const tabs = availableTabs(access, cloudManaged).filter((tab) => !SIMPLE_TABS.includes(tab));
  return {
    id: ADVANCED_SECTIONS_TOUR_ID,
    steps: [
      ...SIMPLE_HIDDEN_VIEWS.map((view) => sectionStep(view, `sidebar-${view}`)),
      ...tabs.map((tab) => sectionStep(tab, `tab-${tab}`)),
    ],
  };
}
