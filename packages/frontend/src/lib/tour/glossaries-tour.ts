/**
 * The Glossaries tour, started only from the Guide: a fuller walk through
 * glossaries than the short area offer (`AREA_TOURS.glossary`), which stays
 * as the offer when the tab opens.
 */
import type { GuideFacts, Tour, TourStep } from './types.js';

export const GLOSSARIES_TOUR_ID = 'glossaries';

function step(id: string, anchor: string | null): TourStep {
  return {
    id,
    anchor,
    titleKey: `glossariesTour.${id}.title`,
    whatKey: `glossariesTour.${id}.what`,
    whyKey: `glossariesTour.${id}.why`,
    advance: { kind: 'next' },
  };
}

/** The AI generation step is shown only when an AI provider key is usable. */
export function glossariesTour(f: GuideFacts): Tour {
  return {
    id: GLOSSARIES_TOUR_ID,
    steps: [
      { ...step('purpose', 'glossary-list'), navigate: { tab: 'glossary' } },
      step('create', 'glossary-create'),
      step('add-term', 'glossary-add-term'),
      // Enabling a glossary is what applies it to this project.
      step('assign', 'glossary-enabled'),
      step('effect', null),
      ...(f.usableKey ? [step('generate', 'glossary-generate')] : []),
    ],
  };
}
