import type { ShellView, Tab } from '@/stores/view-store';

/** What the app knows about the person's progress; the guide derives it, tours read it. */
export interface GuideFacts {
  cloud: boolean;
  vaultExists: boolean;
  vaultUnlocked: boolean;
  usableKey: boolean;
  /**
   * An AI provider key is in the unlocked vault. Unlike `usableKey` it ignores
   * the Simple provider choice, so Advanced tours can tell whether the AI
   * features (glossary generation) can run.
   */
  aiKeyUsable: boolean;
  projectExists: boolean;
  projectHasLanguages: boolean;
  projectHasEntries: boolean;
  translationExists: boolean;
  exported: boolean;
  /** Entries of the active project are selected in the string list. */
  hasSelection: boolean;
  isCollaboratorOnly: boolean;
  /** A translatable entry of the active project still misses a real target language (Pseudo-test aside). */
  untranslatedRemain: boolean;
  /**
   * The active project's entries are loaded and none misses a real target
   * language, with no translation of it going: the file came translated.
   */
  nothingToTranslate: boolean;
  /**
   * The guide's quick test on the active project translated something, more is
   * left, and the person has not yet chosen between the rest and export.
   */
  quickTestPending: boolean;
  /**
   * The person chose "translate the rest" after the quick test and the run it
   * produced has not settled yet (still pending, queued, running or paused).
   */
  restRunning: boolean;
}

export type TourAdvance =
  /**
   * An explanation step: shows Next. With `needs` (a `data-tour` anchor), only
   * while that control is on screen, or on a step entered via Back: Next would
   * otherwise lead past something not done yet (the languages' Save button
   * shows once one is ticked).
   */
  | {
      kind: 'next';
      needs?: string;
      /** `needs` is waived once this holds: the step's work is already done (saved earlier). */
      unlessDone?: (f: GuideFacts) => boolean;
      /**
       * Advances by itself when this anchor appears while the step is shown
       * (absent, then present). Already present on entry does not count, and
       * Next stays available throughout.
       */
      advanceOnAppear?: string;
    }
  /** Completes when the anchored control is clicked. */
  | { kind: 'click' }
  /** Completes when app state says so. */
  | { kind: 'state'; done: (f: GuideFacts) => boolean }
  /**
   * Completed by whoever runs the tour, when something happens that no fact
   * describes (a new run appearing). The overlay shows no Next and waits.
   */
  | {
      kind: 'manual';
      /**
       * On a step entered via Back: show Next once this holds (what the step
       * asks for already happened), so stepping back never strands the person.
       */
      nextOnBack?: (f: GuideFacts) => boolean;
    };

export interface TourStep {
  id: string;
  /** Value of a `data-tour` attribute; null = a centred callout. */
  anchor: string | null;
  /** Keys in the `guide-tour` namespace. */
  titleKey: string;
  whatKey: string;
  whyKey: string;
  advance: TourAdvance;
  /**
   * Where the callout sits relative to the anchor (default `bottom`; it still
   * flips when there is no room). Set it when the default would cover controls
   * the step asks the person to use, as in a form.
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * `false` leaves the rest of the screen usable (no dimming) while the step
   * is current, for a step that waits on something the person may need to
   * act on elsewhere. Default: dimmed.
   */
  dim?: false;
  /**
   * `false`: the spotlit control is shown, not offered. The hole is covered
   * like the rest of the screen, for a step that points at something the
   * person must leave alone (the practice orphan's Delete).
   */
  interactive?: false;
  /** Opened when the step becomes current. */
  navigate?: { tab?: Tab; view?: ShellView };
  /**
   * Extra callout buttons. `labelKey` is in the `guide-tour` namespace;
   * `primary` marks the recommended choice.
   */
  actions?: Array<{ labelKey: string; run: () => void; testId: string; primary?: true }>;
  /** 1..MAJOR_STEP_COUNT for the first-run tour's "Step N of 5". */
  major?: number;
  /**
   * Id of the step this one stands in for (a variant shown in its place). A
   * variant is not counted: it reports the position of the step it names.
   */
  variantOf?: string;
}

export interface Tour {
  id: string;
  steps: TourStep[];
}

/** Number of major steps in the first-run tour, shown as "Step N of 5". */
export const MAJOR_STEP_COUNT = 5;
