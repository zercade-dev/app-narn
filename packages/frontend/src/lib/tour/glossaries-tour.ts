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

/**
 * Waits for the control the step is about, which exists only once a glossary is
 * selected. A collaborator has no editing controls, so they are never held.
 */
function needs(anchor: string): TourStep['advance'] {
  return { kind: 'next', needs: anchor, unlessDone: (f) => f.isCollaboratorOnly };
}

/** The AI generation step is shown only when an AI provider key is in the vault. */
export function glossariesTour(f: GuideFacts): Tour {
  return {
    id: GLOSSARIES_TOUR_ID,
    steps: [
      { ...step('purpose', 'glossary-list'), navigate: TO_GLOSSARY },
      // Next waits for a glossary to exist (its enable button shows once one is selected).
      step('create', 'glossary-create', needs('glossary-enabled')),
      step('add-term', 'glossary-add-term', needs('glossary-add-term')),
      // Enabling a glossary is what applies it to this project.
      step('assign', 'glossary-enabled', needs('glossary-enabled')),
      step('effect', null),
      ...(f.aiKeyUsable ? [step('generate', 'glossary-generate')] : []),
    ],
  };
}
