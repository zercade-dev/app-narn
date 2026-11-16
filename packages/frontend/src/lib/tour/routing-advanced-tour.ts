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
  onEnter: () => void = ON_RULES,
  side?: TourStep['side'],
): TourStep {
  return {
    id,
    anchor,
    onEnter,
    ...(side ? { side, overlap: true as const } : {}),
    titleKey: `routingAdvanced.${id}.title`,
    whatKey: `routingAdvanced.${id}.what`,
    whyKey: `routingAdvanced.${id}.why`,
    advance: { kind: 'next' },
    navigate: TO_ROUTING,
  };
}

export const ROUTING_ADVANCED_TOUR: Tour = {
  id: ROUTING_ADVANCED_TOUR_ID,
  steps: [
    // The rules list (or the line saying there are none yet).
    step('rules', 'routing-rules', ON_RULES, 'bottom'),
    step('add', 'routing-add'),
    // These two open their tab of the editor, so what they describe is on screen.
    step('templates', 'routing-templates', showEditorTab('templates'), 'bottom'),
    step('groups', 'routing-groups'),
    step('import', 'routing-import', showEditorTab('advanced'), 'bottom'),
    // Back to Simple, from the switch itself.
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
