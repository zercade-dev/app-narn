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
 * The AI generation step is shown only when an AI provider key is in the
 * vault. A collaborator cannot create, fill, enable or generate glossaries
 * (those controls are hidden for them), so their tour only explains.
 */
export function glossariesTour(f: GuideFacts, collaborator = false): Tour {
  const here = (s: TourStep): TourStep => ({ ...s, navigate: TO_GLOSSARY });
  if (collaborator) {
    return {
      id: GLOSSARIES_TOUR_ID,
      steps: [step('purpose', 'glossary-items'), step('effect', null)].map(here),
    };
  }
  return {
    id: GLOSSARIES_TOUR_ID,
    // Every step opens the tab: the person can wander off on an undimmed step.
    steps: (
      [
        // The glossaries listed, not the buttons above them: creating one is the
        // next step's. With none yet, a centred callout.
        step('purpose', 'glossary-items'),
        // Next is always there; creating a glossary (the first or another one)
        // selects it and moves the tour on.
        {
          ...step('create', 'glossary-create', {
            kind: 'next',
            advanceOnSignal: 'glossary-created',
            // Typing a name: ✓ creates it (or × cancels) before the tour moves on.
            blockedBy: 'glossary-name-form',
          }),
          // The instruction says it all: no explanation line.
          whyKey: undefined,
          // Not dimmed: "New glossary" opens a name field below the button,
          // outside the spotlight, which must stay usable; the callout sits
          // beside the list so it does not cover that field.
          dim: false,
          side: 'right',
        },
        // The anchors below exist only for a selected, editable glossary with
        // its card open: without one, a centred callout saying so.
        {
          ...step('add-term', 'glossary-add-term'),
          absentWhatKey: 'glossariesTour.add-term.absentWhat',
        },
        // Enabling a glossary is what applies it to this project. Shown, not
        // offered: a new glossary is on, and the button would turn it off.
        {
          ...step('assign', 'glossary-enabled'),
          whyKey: undefined,
          interactive: false,
          absentWhatKey: 'glossariesTour.assign.absentWhat',
        },
        step('effect', null),
        // Shown, not offered: its dialog would open under the callout.
        ...(f.aiKeyUsable
          ? [{ ...step('generate', 'glossary-generate'), interactive: false as const }]
          : []),
      ] satisfies TourStep[]
    ).map(here),
  };
}
