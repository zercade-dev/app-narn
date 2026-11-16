/**
 * The "Advanced routing rules" tour: what the Advanced routing editor offers,
 * for someone who asked to see it (the Routing tour's "Explain Advanced
 * rules", or the Guide's list). Advanced is only how the editor shows the
 * rules (`routingAdvanced`, a display preference): switching to it changes no
 * rule, so the tour switches it for the person.
 */
import { useGuideStore } from '@/stores/guide-store';
import { useUiSettings } from '@/stores/ui-settings-store';
import type { Tour, TourStep } from './types.js';

export const ROUTING_ADVANCED_TOUR_ID = 'routing-advanced';

/** One object, so the overlay does not re-run `navigate` on every build. */
const TO_ROUTING: NonNullable<TourStep['navigate']> = { tab: 'routing' };

export type RoutingEditorTab = 'rules' | 'templates' | 'advanced';

/** Asks the Advanced routing editor to show one of its tabs. */
export const ROUTING_EDITOR_TAB_EVENT = 'tour:routing-editor-tab';

/** The last tab asked for and not yet shown (the editor can mount after the ask). */
let pendingTab: RoutingEditorTab | null = null;

/** The tab this tour asked for, while it runs; taking it clears it. */
export function takeRoutingEditorTab(): RoutingEditorTab | null {
  const tab = pendingTab;
  pendingTab = null;
  return useGuideStore.getState().activeTourId === ROUTING_ADVANCED_TOUR_ID ? tab : null;
}

function showEditorTab(tab: RoutingEditorTab): () => void {
  return () => {
    pendingTab = tab;
    globalThis.dispatchEvent(new CustomEvent(ROUTING_EDITOR_TAB_EVENT));
  };
}
const ON_RULES = showEditorTab('rules');

function step(
  id: string,
  anchor: string,
  advance: TourStep['advance'] = { kind: 'next' },
  opts: Partial<Pick<TourStep, 'onEnter' | 'side' | 'overlap' | 'interactive'>> & {
    copy?: string;
    noWhy?: true;
  } = {},
): TourStep {
  const { copy = id, noWhy, ...rest } = opts;
  return {
    id,
    anchor,
    onEnter: ON_RULES,
    ...rest,
    titleKey: `routingAdvanced.${copy}.title`,
    whatKey: `routingAdvanced.${copy}.what`,
    ...(noWhy ? {} : { whyKey: `routingAdvanced.${copy}.why` }),
    advance,
    navigate: TO_ROUTING,
  };
}

const CLICK: TourStep['advance'] = { kind: 'click' };

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
    step('edit', 'routing-first-edit', CLICK, { noWhy: true }),
    step('filter', 'routing-first-filter', CLICK),
    // Next once a language is ticked (the marker shows then).
    step(
      'langs',
      'routing-first-langs',
      { kind: 'next', needs: 'routing-first-langs-set' },
      {
        side: 'top',
      },
    ),
    step('module', 'routing-first-module', { kind: 'next' }, { side: 'right' }),
    step('done', 'routing-first-done', CLICK, { copy: 'done', noWhy: true }),
    step('add', 'routing-add', CLICK),
    // Next once the new rule has a provider.
    step(
      'newModule',
      'routing-new-module',
      { kind: 'next', needs: 'routing-new-set' },
      {
        side: 'right',
      },
    ),
    step('newDone', 'routing-new-done', CLICK, { copy: 'done', noWhy: true }),
    step('order', 'routing-rules', { kind: 'next' }, { ...LOOK, side: 'bottom', overlap: true }),
    // These two open their tab of the editor, so what they describe is on screen.
    step(
      'templates',
      'routing-templates',
      { kind: 'next' },
      {
        ...LOOK,
        onEnter: showEditorTab('templates'),
        side: 'bottom',
      },
    ),
    step('groups', 'routing-groups', { kind: 'next' }, LOOK),
    step(
      'import',
      'routing-import',
      { kind: 'next' },
      {
        ...LOOK,
        onEnter: showEditorTab('advanced'),
        side: 'bottom',
      },
    ),
    // Back to Simple, from the switch itself (a view preference: rules untouched).
    step('back', 'routing-mode'),
  ],
};

/** The Routing tab shows its Advanced editor (the rules themselves are unchanged). */
export function showAdvancedRouting(): void {
  useUiSettings.getState().setRoutingAdvanced(true);
}

/**
 * From the Routing tour: it ends there (seen to the end), and this tour
 * starts on the Advanced editor.
 */
export function startRoutingAdvancedTour(): void {
  showAdvancedRouting();
  const store = useGuideStore.getState();
  store.completeTour('routing');
  store.startTour(ROUTING_ADVANCED_TOUR_ID);
}
