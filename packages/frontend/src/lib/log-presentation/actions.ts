import { useViewStore, type Tab } from '../../stores/view-store.js';
import { vaultLockedEvent } from '../vault-events.js';
import type { LogAction } from './types.js';

/**
 * Actions read the store imperatively via `getState()` rather than a hook: the
 * registry is plain data built once at module load, not a React component.
 * `setActiveTab` already switches the shell back to the project view.
 */
export function openTab(tab: Tab, labelKey: string): LogAction {
  return { labelKey, run: () => useViewStore.getState().setActiveTab(tab) };
}

export function openGlobalConfig(labelKey: string): LogAction {
  return { labelKey, run: () => useViewStore.getState().setView('global-config') };
}

export function unlockVault(labelKey: string): LogAction {
  return { labelKey, run: () => globalThis.dispatchEvent(vaultLockedEvent({})) };
}
