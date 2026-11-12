/**
 * Simple/Advanced mode rules for navigation. Simple shows only the four tabs a
 * first translation needs and hides the workspace-wide Global Config and
 * Translation Memory views; Advanced shows everything the caller's access
 * allows. Tab access rules stay in `tab-gating.ts` — this narrows them.
 */
import { availableTabs } from './tab-gating.js';
import { goTo, useModeGate, type NavTarget } from '../stores/mode-gate-store.js';
import { useUiSettings, type UiMode } from '../stores/ui-settings-store.js';
import type { ProjectAccessInfo } from '../stores/project-store.js';
import type { ShellView, Tab } from '../stores/view-store.js';

export type { NavTarget };

export const SIMPLE_TABS: readonly Tab[] = ['config', 'data', 'strings', 'runs'];
export const SIMPLE_HIDDEN_VIEWS: readonly ShellView[] = ['global-config', 'translation-memory'];

export function visibleTabs(
  access: ProjectAccessInfo,
  cloudManaged: boolean,
  mode: UiMode,
): readonly Tab[] {
  const allowed = availableTabs(access, cloudManaged);
  return mode === 'simple' ? allowed.filter((tab) => SIMPLE_TABS.includes(tab)) : allowed;
}

export function firstVisibleTab(
  access: ProjectAccessInfo,
  cloudManaged: boolean,
  mode: UiMode,
): Tab {
  return visibleTabs(access, cloudManaged, mode)[0];
}

export function isViewVisible(view: ShellView, mode: UiMode): boolean {
  return mode !== 'simple' || !SIMPLE_HIDDEN_VIEWS.includes(view);
}

/** The mode in effect now, for code that runs outside React. */
export function currentMode(): UiMode {
  return useUiSettings.getState().uiMode ?? 'advanced';
}

/** True when the target is hidden in the current mode (access rules aside). */
export function isTargetHidden(target: NavTarget, mode: UiMode): boolean {
  if (mode !== 'simple') return false;
  return target.kind === 'tab'
    ? !SIMPLE_TABS.includes(target.tab)
    : !isViewVisible(target.view, mode);
}

/**
 * Navigate, or — when the target is hidden in Simple — ask to switch to Advanced first.
 * `open` replaces the plain navigation (for opens that also set pending state such as a
 * run id); it runs immediately when the target is visible, or after the person accepts.
 */
export function navigateOrOffer(target: NavTarget, open?: () => void): void {
  if (isTargetHidden(target, currentMode())) useModeGate.getState().offer(target, open);
  else if (open) open();
  else goTo(target);
}
