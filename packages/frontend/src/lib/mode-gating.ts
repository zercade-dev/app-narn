/**
 * Simple/Advanced mode rules for navigation. Simple shows only the tabs a
 * first translation needs (and Backups, to undo a test) and hides the workspace-wide Global Config and
 * Translation Memory views; Advanced shows everything the caller's access
 * allows. Tab access rules stay in `tab-gating.ts` — this narrows them.
 */
import { useMemo } from 'react';
import { availableTabs } from './tab-gating.js';
import { goTo, useModeGate, type NavTarget } from '../stores/mode-gate-store.js';
import { useUiSettings, type UiMode } from '../stores/ui-settings-store.js';
import { DEFAULT_STRING_FILTERS } from '../stores/string-store.js';
import type { EntryFilters } from './filter-entries.js';
import type { ProjectAccessInfo } from '../stores/project-store.js';
import type { ShellView, Tab } from '../stores/view-store.js';

export type { NavTarget };

export const SIMPLE_TABS: readonly Tab[] = ['config', 'data', 'strings', 'runs', 'backup'];
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

/** Controls Simple mode hides. Each is gated where it renders, with `useControlVisible`. */
export type GatedControl =
  | 'bulk-operations'
  | 'bulk-ai-generation'
  | 'retranslate-below-tier'
  | 'filter-match-mode'
  | 'filter-extra-status'
  | 'filter-freeway-tier'
  | 'filter-category'
  | 'filter-tone'
  | 'filter-glossary'
  | 'filter-run'
  | 'filter-source'
  | 'column-picker'
  | 'string-order'
  | 'translate-advanced-options'
  | 'translate-memory-options'
  /** The Config tab's expert settings (memory policy, grouping, template, module settings, checks). */
  | 'project-expert-settings';

export const SIMPLE_HIDDEN_CONTROLS: readonly GatedControl[] = [
  'bulk-operations',
  'bulk-ai-generation',
  'retranslate-below-tier',
  'filter-match-mode',
  'filter-extra-status',
  'filter-freeway-tier',
  'filter-category',
  'filter-tone',
  'filter-glossary',
  'filter-run',
  'filter-source',
  'column-picker',
  'string-order',
  'translate-advanced-options',
  'translate-memory-options',
  'project-expert-settings',
];

export function isControlVisible(control: GatedControl, mode: UiMode): boolean {
  return mode !== 'simple' || !SIMPLE_HIDDEN_CONTROLS.includes(control);
}

/** Reactive form of {@link isControlVisible} for the mode in effect (unset means advanced). */
export function useControlVisible(control: GatedControl): boolean {
  const mode = useUiSettings((s) => s.uiMode) ?? 'advanced';
  return isControlVisible(control, mode);
}

/**
 * View-only filters: in simple, every field behind a hidden control is reset to its default so
 * filters saved in Advanced never silently hide rows the person cannot see a control for. The
 * persisted store is never written. Advanced returns the same object.
 */
export function effectiveFilters(filters: EntryFilters, mode: UiMode): EntryFilters {
  if (mode !== 'simple') return filters;
  return {
    ...DEFAULT_STRING_FILTERS,
    search: filters.search,
    untranslatedOnly: filters.untranslatedOnly,
    needsReview: filters.needsReview,
    lqaFailed: filters.lqaFailed,
    activeLanguages: filters.activeLanguages,
  };
}

/** {@link effectiveFilters} for the mode in effect, stable while neither input changes. */
export function useEffectiveFilters(filters: EntryFilters): EntryFilters {
  const mode = useUiSettings((s) => s.uiMode) ?? 'advanced';
  return useMemo(() => effectiveFilters(filters, mode), [filters, mode]);
}
