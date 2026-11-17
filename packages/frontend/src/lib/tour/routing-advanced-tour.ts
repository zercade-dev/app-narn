/**
 * The "Advanced routing rules" tour: what the Advanced routing editor offers,
 * for someone who asked to see it (the Routing tour's "Explain Advanced
 * rules", or the Guide's list). The tour switches the editor to Advanced for
 * the person; rules Simple set aside come back with it, which is what
 * choosing Advanced does by hand.
 */
import { useGuideStore } from '@/stores/guide-store';
import { useUiSettings } from '@/stores/ui-settings-store';
import type { Tour, TourStep } from './types.js';

export const ROUTING_ADVANCED_TOUR_ID = 'routing-advanced';

/** One object, so the overlay does not re-run `navigate` on every build. */
const TO_ROUTING: NonNullable<TourStep['navigate']> = { tab: 'routing' };

export type RoutingEditorTab = 'rules' | 'templates' | 'advanced';

/**
 * What a step needs the Advanced routing editor to show, so its control is on
 * screen however the step was reached (Next, Back, Continue after a reload,
 * Done pressed early). Omitted parts are left as they are.
 */
export interface RoutingEditorView {
  tab: RoutingEditorTab;
  /** The rule open in its form: none, rule #1, or the last rule (when it is not rule #1). */
  open?: 'none' | 'first' | 'last';
  /** Rule #1's Filtering section, open or closed. */
  filtering?: boolean;
  /**
   * The languages step: its Next waits for a change to rule #1's languages
   * made from now on (a rule can already hold languages).
   */
  markLangs?: true;
}

/** Asks the Advanced routing editor to show a view (`RoutingEditorView`). */
export const ROUTING_EDITOR_TAB_EVENT = 'tour:routing-editor-tab';

/** The last view asked for and not yet shown (the editor can mount after the ask). */
let pendingView: RoutingEditorView | null = null;

/** The view this tour asked for, while it runs; taking it clears it. */
export function takeRoutingEditorView(): RoutingEditorView | null {
  const view = pendingView;
  pendingView = null;
  return useGuideStore.getState().activeTourId === ROUTING_ADVANCED_TOUR_ID ? view : null;
}

function showEditor(view: RoutingEditorView): () => void {
  return () => {
    pendingView = view;
    globalThis.dispatchEvent(new CustomEvent(ROUTING_EDITOR_TAB_EVENT));
  };
}
/** The rules, every one closed: the pencil and Add rule are on screen. */
const RULES_CLOSED = showEditor({ tab: 'rules', open: 'none' });
const FIRST_OPEN = showEditor({ tab: 'rules', open: 'first' });
const LAST_OPEN = showEditor({ tab: 'rules', open: 'last' });

/**
 * Whether Add rule should open the empty rule at the bottom instead of adding
 * another: while this tour runs, so Back or a restart never piles up empty
 * rules (one the tour had the person add, then left).
 */
export function tourReusesEmptyRule(): boolean {
  return useGuideStore.getState().activeTourId === ROUTING_ADVANCED_TOUR_ID;
}

function step(
  id: string,
  anchor: string,
  advance: TourStep['advance'] = { kind: 'next' },
  opts: Partial<
    Pick<TourStep, 'onEnter' | 'side' | 'overlap' | 'interactive' | 'fallback' | 'absentWhatKey'>
  > & {
    copy?: string;
    noWhy?: true;
  } = {},
): TourStep {
  const { copy = id, noWhy, ...rest } = opts;
  return {
    id,
    anchor,
    onEnter: RULES_CLOSED,
    ...rest,
    titleKey: `routingAdvanced.${copy}.title`,
    whatKey: `routingAdvanced.${copy}.what`,
    ...(noWhy ? {} : { whyKey: `routingAdvanced.${copy}.why` }),
    advance,
    navigate: TO_ROUTING,
  };
}

const CLICK: TourStep['advance'] = { kind: 'click' };

/** Said on a hands-on step whose control is not on screen (Next then shows). */
const ABSENT = 'routingAdvanced.absentWhat';

/**
 * Shown, not offered: these controls change the project's real routing (a
 * template adds a rule, a new group becomes the one translations use), and
 * the tour has nothing for them to do.
 */
const LOOK = { interactive: false } as const;

export const ROUTING_ADVANCED_TOUR: Tour = {
  id: ROUTING_ADVANCED_TOUR_ID,
  steps: [
    // The worked example: Asian languages to one provider, the rest to
    // another. Rule #1 gets the language filter; the rule added below it
    // needs none, because the first rule that fits an entry is the one used.
    step('rules', 'routing-rules', { kind: 'next' }, { ...LOOK, side: 'bottom', overlap: true }),
    // With no rule yet there is no pencil: Add rule makes rule #1 (open).
    step('edit', 'routing-first-edit', CLICK, {
      noWhy: true,
      fallback: { anchor: 'routing-first-add', whatKey: 'routingAdvanced.edit.noRulesWhat' },
      absentWhatKey: ABSENT,
    }),
    step('filter', 'routing-first-filter', CLICK, {
      onEnter: showEditor({ tab: 'rules', open: 'first', filtering: false }),
      absentWhatKey: ABSENT,
    }),
    // Next once a language is ticked or unticked here (the marker shows then).
    step(
      'langs',
      'routing-first-langs',
      { kind: 'next', needs: 'routing-first-langs-set' },
      {
        onEnter: showEditor({ tab: 'rules', open: 'first', filtering: true, markLangs: true }),
        side: 'top',
        absentWhatKey: ABSENT,
      },
    ),
    step(
      'module',
      'routing-first-module',
      { kind: 'next' },
      { onEnter: FIRST_OPEN, side: 'right' },
    ),
    step('done', 'routing-first-done', CLICK, {
      onEnter: FIRST_OPEN,
      copy: 'done',
      noWhy: true,
      absentWhatKey: ABSENT,
    }),
    step('add', 'routing-add', CLICK, { absentWhatKey: ABSENT }),
    // Next once the new rule has a provider.
    step(
      'newModule',
      'routing-new-module',
      { kind: 'next', needs: 'routing-new-set' },
      {
        onEnter: LAST_OPEN,
        side: 'right',
        absentWhatKey: ABSENT,
      },
    ),
    step('newDone', 'routing-new-done', CLICK, {
      onEnter: LAST_OPEN,
      copy: 'done',
      noWhy: true,
      absentWhatKey: ABSENT,
    }),
    step('order', 'routing-rules', { kind: 'next' }, { ...LOOK, side: 'bottom', overlap: true }),
    // These two open their tab of the editor, so what they describe is on screen.
    step(
      'templates',
      'routing-templates',
      { kind: 'next' },
      {
        ...LOOK,
        onEnter: showEditor({ tab: 'templates' }),
        side: 'bottom',
      },
    ),
    // The groups sit above the tabs: whichever tab is open stays open.
    step('groups', 'routing-groups', { kind: 'next' }, { ...LOOK, onEnter: undefined }),
    step(
      'import',
      'routing-import',
      { kind: 'next' },
      {
        ...LOOK,
        onEnter: showEditor({ tab: 'advanced' }),
        side: 'bottom',
      },
    ),
    // Back to Simple, from the switch itself (choosing it sets the rules aside).
    step('back', 'routing-mode', { kind: 'next' }, { onEnter: showEditor({ tab: 'rules' }) }),
  ],
};

/** The Routing tab shows its Advanced editor, with any rules Simple set aside back. */
export function showAdvancedRouting(): void {
  useUiSettings.getState().askRoutingAdvanced();
}

/**
 * From the Routing tour: it ends there (seen to the end), and this tour
 * starts on the Advanced editor.
 */
export function startRoutingAdvancedTour(): void {
  showAdvancedRouting();
  const store = useGuideStore.getState();
  store.completeTour('routing');
  // Ended as finished, so the Routing tour counts as seen and its offer stays away.
  store.endTour(true);
  store.startTour(ROUTING_ADVANCED_TOUR_ID);
}
