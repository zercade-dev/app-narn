/**
 * Short tours for the Advanced areas that need an introduction. Each is a few
 * `next` steps saying what the area is for and why to use it. The tour id is
 * the tab id, so the tab that is open picks the tour to offer.
 */
import type { Tab } from '@/stores/view-store';
import { startRoutingAdvancedTour } from './routing-advanced-tour.js';
import type { GuideFacts, Tour, TourStep } from './types.js';

export type AreaTourId = 'routing' | 'glossary' | 'quality' | 'compare' | 'review-translation-ai';

/** One object per tab, so the overlay does not re-run `navigate` on every build. */
const NAVIGATE: Partial<Record<AreaTourId, NonNullable<TourStep['navigate']>>> = {};
function navigateTo(tab: AreaTourId): NonNullable<TourStep['navigate']> {
  return (NAVIGATE[tab] ??= { tab: tab satisfies Tab });
}

function step(tab: AreaTourId, id: string, anchor: string, side?: TourStep['side']): TourStep {
  return {
    id,
    anchor,
    // Beside the anchor when it fits; a tall one (Advanced routing's rules)
    // still keeps the callout, and its Next, inside the window.
    ...(side ? { side, overlap: true as const } : {}),
    titleKey: `area.${tab}.${id}.title`,
    whatKey: `area.${tab}.${id}.what`,
    whyKey: `area.${tab}.${id}.why`,
    advance: { kind: 'next' },
    // Every step opens the tab: a tour started from the Guide lands on it,
    // and one left by keyboard comes back to it.
    navigate: navigateTo(tab),
  };
}

export const AREA_TOURS: Record<AreaTourId, Tour> = {
  routing: {
    id: 'routing',
    steps: [
      step('routing', 'config', 'routing-config', 'bottom'),
      {
        ...step('routing', 'mode', 'routing-mode'),
        // For whoever wants more: the Advanced editor, explained (its own tour).
        actions: [
          {
            labelKey: 'area.routing.mode.advancedAction',
            run: startRoutingAdvancedTour,
            testId: 'tour-action-routing-advanced',
          },
        ],
      },
    ],
  },
  glossary: {
    id: 'glossary',
    steps: [
      step('glossary', 'list', 'glossary-items'),
      step('glossary', 'create', 'glossary-create'),
      step('glossary', 'generate', 'glossary-generate'),
    ],
  },
  quality: {
    id: 'quality',
    steps: [
      step('quality', 'title', 'quality-title'),
      step('quality', 'overview', 'quality-overview'),
      step('quality', 'issues', 'quality-issues'),
    ],
  },
  compare: {
    id: 'compare',
    steps: [
      step('compare', 'target', 'compare-target'),
      step('compare', 'reference', 'compare-reference'),
      step('compare', 'translate', 'compare-translate'),
    ],
  },
  'review-translation-ai': {
    id: 'review-translation-ai',
    steps: [
      step('review-translation-ai', 'intro', 'ai-review-intro'),
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

/** A collaborator has no create or generate buttons: only the list is shown. */
const GLOSSARY_LIST_ONLY: Tour = {
  id: 'glossary',
  steps: AREA_TOURS.glossary.steps.filter((s) => s.id === 'list'),
};

/**
 * The tour to run for `id`. The glossary tour drops its AI generation step
 * when no AI provider key is usable, and keeps only its list for a
 * collaborator.
 */
export function areaTourFor(id: AreaTourId, f: GuideFacts, collaborator = false): Tour {
  if (id !== 'glossary') return AREA_TOURS[id];
  if (collaborator) return GLOSSARY_LIST_ONLY;
  return f.aiKeyUsable ? AREA_TOURS[id] : GLOSSARY_WITHOUT_AI;
}

export const AREA_TOUR_IDS = Object.keys(AREA_TOURS) as AreaTourId[];

export function isAreaTourId(id: string | null): id is AreaTourId {
  return id !== null && Object.hasOwn(AREA_TOURS, id);
}
