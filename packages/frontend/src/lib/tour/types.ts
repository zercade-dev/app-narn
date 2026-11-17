import type { ShellView, Tab } from '@/stores/view-store';
import type { TourSignal } from './signal.js';

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
  /** How many entries of the active project are selected. */
  selectedCount: number;
  /** The string list shows only entries still missing a translation ("Untranslated only"). */
  untranslatedFilterOn: boolean;
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
   * The guide's quick test has a run that has not translated anything yet:
   * still going, or ended empty.
   */
  quickTestRunning: boolean;
  /**
   * The person chose "translate the rest" after the quick test and the run it
   * produced has not settled yet (still pending, queued, running or paused).
   */
  restRunning: boolean;
  /**
   * The retranslate test was asked for, and the person is picking its entries
   * and starting it: no run of it is listed yet.
   */
  retestAsked: boolean;
  /**
   * The retranslate test (asked for when the file already had every
   * translation) has a run that has not translated anything yet: still
   * going, or ended empty.
   */
  retestRunning: boolean;
  /**
   * The retranslate test translated something, and the person has not yet
   * chosen between putting the file's translations back and keeping the new ones.
   */
  retestPending: boolean;
  /** The retranslate test was answered: its translations were put back, or kept. */
  retestDone: boolean;
}

export type TourAdvance =
  /**
   * An explanation step: shows Next. With `needs` (a `data-tour` anchor), only
   * while that control is on screen, on a step entered via Back, or once the
   * step's own anchor has been missing a moment (nothing to do it with): Next
   * would otherwise lead past something not done yet (the languages' Save
   * button shows once one is ticked).
   */
  | {
      kind: 'next';
      needs?: string;
      /**
       * Next hides while this control is on screen: a form opened from the
       * step (a name to type and confirm) is finished or cancelled first, so
       * Next never moves on past it half-done.
       */
      blockedBy?: string;
      /** `needs` is waived once this holds: the step's work is already done (saved earlier). */
      unlessDone?: (f: GuideFacts) => boolean;
      /**
       * Advances by itself when the app sends this signal while the step is
       * shown (see `sendTourSignal`): something the step asks for was done,
       * however many were done before. Next stays available throughout.
       */
      advanceOnSignal?: TourSignal;
    }
  /**
   * Completes when the anchored control is clicked. Next shows too on a step
   * entered via Back (the control may already be used) and once the control
   * has been missing for a moment, so the step is never a dead end.
   */
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
  /** Optional: a step that only says where to go needs no explanation. */
  whyKey?: string;
  /**
   * Said instead of `whatKey` while the anchor is not on screen (the step
   * shows centred), when the step's own words would describe a control that
   * is not there.
   */
  absentWhatKey?: string;
  /**
   * Another control the step points at, saying `whatKey`, while its own
   * anchor is not on screen and this one is (rule #1's pencil, in a project
   * with no rule yet: Add rule makes it). A `click` step completes on it too.
   */
  fallback?: { anchor: string; whatKey: string };
  advance: TourAdvance;
  /**
   * Where the callout sits relative to the anchor (default `bottom`; it still
   * flips when there is no room). Set it when the default would cover controls
   * the step asks the person to use, as in a form.
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * The callout keeps `side` and stays inside the window even when that puts
   * it over the anchor, for an anchor too big to sit beside (a whole table):
   * with `side: 'bottom'` it rests at the window's foot, over the anchor's end.
   */
  overlap?: true;
  /**
   * A `data-tour` control between the anchor and the callout that the callout
   * must not cover: it moves out past it, on its `side` (the failure step's
   * callout above the console clears the selection bar's Translate button).
   */
  clearOf?: string;
  /**
   * `false` leaves the rest of the screen usable (no dimming) while the step
   * is current, for a step that waits on something the person may need to
   * act on elsewhere. Default: dimmed.
   */
  dim?: false;
  /**
   * `false`: the spotlit control is shown, not offered. The hole is covered
   * like the rest of the screen, for a step that points at something the
   * person must leave alone (the practice orphan's Delete). On a centred
   * step, the whole page is covered: it waits while the tour changes
   * something (the practice orphan being made).
   */
  interactive?: false;
  /** Opened when the step becomes current. */
  navigate?: { tab?: Tab; view?: ShellView };
  /**
   * Run when the step becomes current, after `navigate`: shows what the step
   * is about inside the page (a tab of the routing editor).
   */
  onEnter?: () => void;
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
