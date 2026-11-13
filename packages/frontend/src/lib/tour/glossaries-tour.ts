/**
 * The Glossaries tour, started only from the Guide: a fuller walk through
 * glossaries than the short area offer (`AREA_TOURS.glossary`), which stays
 * as the offer when the tab opens.
 */
import type { GuideFacts, Tour, TourStep } from './types.js';

export const GLOSSARIES_TOUR_ID = 'glossaries';

function step(
  id: string,
  anchor: string | null,
  advance: TourStep['advance'] = { kind: 'next' },
): TourStep {
  return {
    id,
    anchor,
    titleKey: `glossariesTour.${id}.title`,
    whatKey: `glossariesTour.${id}.what`,
    whyKey: `glossariesTour.${id}.why`,
    advance,
  };
}

/**
 * One object for every build: the overlay re-runs `navigate` when its
 * identity changes, which would pull the person back to the tab.
 */
const TO_GLOSSARY: NonNullable<TourStep['navigate']> = { tab: 'glossary' };

/** The AI generation step is shown only when an AI provider key is in the vault. */
export function glossariesTour(f: GuideFacts): Tour {
  return {
    id: GLOSSARIES_TOUR_ID,
    steps: [
      { ...step('purpose', 'glossary-list'), navigate: TO_GLOSSARY },
      // Next is always there; creating the first glossary selects it, and its
      // enable button appearing moves the tour on.
      step('create', 'glossary-create', { kind: 'next', advanceOnAppear: 'glossary-enabled' }),
      // The anchors below exist only for a selected, editable glossary: without
      // one, the step is a centred callout with Next.
      step('add-term', 'glossary-add-term'),
      // Enabling a glossary is what applies it to this project.
      step('assign', 'glossary-enabled'),
      step('effect', null),
      ...(f.aiKeyUsable ? [step('generate', 'glossary-generate')] : []),
    ],
  };
}
