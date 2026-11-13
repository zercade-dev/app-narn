import { useUiSettings } from '../../stores/ui-settings-store.js';
import type { Tab } from '../../stores/view-store.js';
import { navigateOrOffer } from '../mode-gating.js';
import { vaultLockedEvent } from '../vault-events.js';
import type { LogAction } from './types.js';

/**
 * Actions read the store imperatively via `getState()` rather than a hook: the
 * registry is plain data built once at module load, not a React component.
 * `setActiveTab` already switches the shell back to the project view.
 */
export function openTab(tab: Tab, labelKey: string): LogAction {
  return { labelKey, run: () => navigateOrOffer({ kind: 'tab', tab }) };
}

export function openGlobalConfig(labelKey: string): LogAction {
  return { labelKey, run: () => navigateOrOffer({ kind: 'view', view: 'global-config' }) };
}

export function unlockVault(labelKey: string): LogAction {
  return { labelKey, run: () => globalThis.dispatchEvent(vaultLockedEvent({})) };
}

/** Reveals the raw log lines, for failures the friendly log can't explain. */
export function switchToRaw(labelKey: string): LogAction {
  return { labelKey, run: () => useUiSettings.getState().setConsoleRawMode(true) };
}
