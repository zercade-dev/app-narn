/**
 * Short tours for the Advanced areas that need an introduction. Each is a few
 * `next` steps saying what the area is for and why to use it. The tour id is
 * the tab id, so the tab that is open picks the tour to offer.
 */
import type { Tab } from '@/stores/view-store';
import type { GuideFacts, Tour, TourStep } from './types.js';

export type AreaTourId = 'routing' | 'glossary' | 'quality' | 'compare' | 'review-translation-ai';

function step(tab: AreaTourId, id: string, anchor: string, first = false): TourStep {
  return {
    id,
    anchor,
    titleKey: `area.${tab}.${id}.title`,
    whatKey: `area.${tab}.${id}.what`,
    whyKey: `area.${tab}.${id}.why`,
    advance: { kind: 'next' },
    // The first step opens the tab, so a tour started from the Guide lands on it.
    ...(first ? { navigate: { tab: tab satisfies Tab } } : {}),
  };
}

export const AREA_TOURS: Record<AreaTourId, Tour> = {
  routing: {
    id: 'routing',
    steps: [
      step('routing', 'config', 'routing-config', true),
      step('routing', 'mode', 'routing-mode'),
    ],
  },
  glossary: {
    id: 'glossary',
    steps: [
      step('glossary', 'list', 'glossary-list', true),
      step('glossary', 'create', 'glossary-create'),
      step('glossary', 'generate', 'glossary-generate'),
    ],
  },
  quality: {
    id: 'quality',
    steps: [
      step('quality', 'title', 'quality-title', true),
      step('quality', 'overview', 'quality-overview'),
      step('quality', 'issues', 'quality-issues'),
    ],
  },
  compare: {
    id: 'compare',
    steps: [
      step('compare', 'target', 'compare-target', true),
      step('compare', 'reference', 'compare-reference'),
      step('compare', 'translate', 'compare-translate'),
    ],
  },
  'review-translation-ai': {
    id: 'review-translation-ai',
    steps: [
      step('review-translation-ai', 'intro', 'ai-review-intro', true),
      step('review-translation-ai', 'start', 'ai-review-start'),
      step('review-translation-ai', 'all', 'ai-review-all'),
    ],
  },
};

/** Built once, so step identity is stable. */
const GLOSSARY_WITHOUT_AI: Tour = {
  id: 'glossary',
  steps: AREA_TOURS.glossary.steps.filter((s) => s.id !== 'generate'),
};

/**
 * The tour to run for `id`. The glossary tour drops its AI generation step
 * when no AI provider key is usable.
 */
export function areaTourFor(id: AreaTourId, f: GuideFacts): Tour {
  return id === 'glossary' && !f.aiKeyUsable ? GLOSSARY_WITHOUT_AI : AREA_TOURS[id];
}

export const AREA_TOUR_IDS = Object.keys(AREA_TOURS) as AreaTourId[];

export function isAreaTourId(id: string | null): id is AreaTourId {
  return id !== null && Object.hasOwn(AREA_TOURS, id);
}
