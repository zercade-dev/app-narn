/**
 * The pending "this lives in Advanced mode" offer. `offer()` is called when
 * something tries to reach an area Simple mode hides; `AdvancedOnlyDialog`
 * renders it. `accept()` switches to Advanced and then goes there.
 */
import { create } from 'zustand';
import { useUiSettings } from './ui-settings-store.js';
import { useViewStore, type ShellView, type Tab } from './view-store.js';

export type NavTarget = { kind: 'tab'; tab: Tab } | { kind: 'view'; view: ShellView };

/** Navigates straight to a target, with no mode check. */
export function goTo(target: NavTarget): void {
  const { setActiveTab, setView } = useViewStore.getState();
  if (target.kind === 'tab') setActiveTab(target.tab);
  else setView(target.view);
}

interface ModeGateState {
  pending: NavTarget | null;
  offer: (target: NavTarget) => void;
  accept: () => void;
  dismiss: () => void;
}

export const useModeGate = create<ModeGateState>((set, get) => ({
  pending: null,
  offer: (target) => set({ pending: target }),
  accept: () => {
    const target = get().pending;
    set({ pending: null });
    useUiSettings.getState().setUiMode('advanced');
    if (target) goTo(target);
  },
  dismiss: () => set({ pending: null }),
}));
