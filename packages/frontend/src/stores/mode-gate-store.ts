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
  /** Runs on accept instead of a plain `goTo(pending)` — for opens that also set pending state. */
  onAccept: (() => void) | null;
  offer: (target: NavTarget, onAccept?: () => void) => void;
  accept: () => void;
  dismiss: () => void;
}

export const useModeGate = create<ModeGateState>((set, get) => ({
  pending: null,
  onAccept: null,
  offer: (target, onAccept) => set({ pending: target, onAccept: onAccept ?? null }),
  accept: () => {
    const { pending, onAccept } = get();
    set({ pending: null, onAccept: null });
    useUiSettings.getState().setUiMode('advanced');
    if (onAccept) onAccept();
    else if (pending) goTo(pending);
  },
  dismiss: () => set({ pending: null, onAccept: null }),
}));
