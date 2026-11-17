/**
 * What the Glossaries tour asks of the Glossary tab while it runs: show the
 * glossary it picked, then the entries enabling it matched. The tab owns its
 * selection and match panel, so the tour asks rather than reaching in.
 */
export const GLOSSARY_TOUR_COMMAND_EVENT = 'tour:glossary-command';

export type GlossaryTourCommand =
  /** Select this glossary, with its card open and the match panel closed. */
  | { kind: 'select'; id: string }
  /**
   * Select it and list the entries its terms match, under "With this
   * glossary" when its matches were applied, else "Without".
   */
  | { kind: 'show-matches'; id: string; applied: boolean };

/**
 * The last command no Glossary tab has taken yet: the tour can ask before the
 * tab it opens has mounted (resuming from the Guide), and the tab takes it then.
 */
let pending: GlossaryTourCommand | null = null;

/** The command waiting for a tab, if any; taking it clears it. */
export function takeGlossaryTourCommand(): GlossaryTourCommand | null {
  const command = pending;
  pending = null;
  return command;
}

export function sendGlossaryTourCommand(command: GlossaryTourCommand): void {
  pending = command;
  globalThis.dispatchEvent(
    new CustomEvent<GlossaryTourCommand>(GLOSSARY_TOUR_COMMAND_EVENT, { detail: command }),
  );
}
