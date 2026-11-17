/**
 * The Glossaries tour, started only from the Guide: a fuller walk through
 * glossaries than the short area offer (`AREA_TOURS.glossary`), which stays
 * as the offer when the tab opens. The owner's tour enables a glossary that
 * comes with NARN, picked for matching the project's entries
 * (`pickTourGlossary`), and shows the matches it found. It runs under
 * `GlossariesTourController`, which picks the glossary and moves the enable
 * step on.
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

export interface GlossariesTourOptions {
  /** The picked glossary is on already: the enable step only says so. */
  pickEnabled?: boolean;
}

/**
 * A collaborator cannot enable glossaries (that control is hidden for them),
 * so their tour only explains.
 */
export function glossariesTour(
  _f: GuideFacts,
  collaborator = false,
  { pickEnabled = false }: GlossariesTourOptions = {},
): Tour {
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
        step('purpose', 'glossary-items'),
        // The picked glossary in the list, selected by the tour. Shown, not
        // offered: picking another would leave the tour's choice.
        { ...step('picked', 'glossary-selected'), whyKey: undefined, interactive: false },
        // Its terms' Constant column, in the card the tour opened.
        {
          ...step('constant', 'glossary-col-constant'),
          absentWhatKey: 'glossariesTour.constant.absentWhat',
        },
        pickEnabled
          ? {
              ...step('enable', 'glossary-enabled'),
              whatKey: 'glossariesTour.enable.onWhat',
              // Shown, not offered: the button would turn it off.
              interactive: false as const,
            }
          : {
              // The controller moves on once the glossary is enabled, matches
              // applied or not; the prompt that asks opens beside the callout.
              ...step('enable', 'glossary-enabled', { kind: 'manual' }),
              absentWhatKey: 'glossariesTour.enable.absentWhat',
            },
        // Shown in place of "enable" while its prompt is open: what each answer does.
        {
          ...step('choice', 'glossary-enable-prompt', { kind: 'manual' }),
          whyKey: undefined,
          side: 'top' as const,
          variantOf: 'enable',
        },
        // The match panel, listing what enabling it found. It opens at the top
        // (the card above it folds away), so the callout sits below it.
        step('matches', 'glossary-matches'),
        step('effect', null),
      ] satisfies TourStep[]
    ).map(here),
  };
}
