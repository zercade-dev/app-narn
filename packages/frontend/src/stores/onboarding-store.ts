import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StringEntry } from '@zercade-dev/narn-shared';

/**
 * Onboarding state — deliberately its own store rather than a field on
 * ui-settings-store, for two reasons. It is not a setting the user chooses,
 * and ui-settings-store pulls in `i18n/index.js` (which calls `i18n.init()`
 * at import); string-store writes this latch, and giving string-store a
 * static edge to the whole i18n stack for one boolean would be a poor trade.
 * This module's only dependency is zustand.
 */
interface OnboardingState {
  /**
   * One-way latch: true once this browser has seen a translated string in any
   * project. It drives the Guide button's tint in the sidebar, which stays on
   * until the user has their first translation.
   *
   * A persisted latch rather than a live "does this project have translations?"
   * check because entries are fetched per tab, not globally: the sidebar
   * renders long before any entry list loads, so a live check would show the
   * tint, drop it when a data tab mounted, and bring it back on the next
   * project switch.
   */
  firstTranslationSeen: boolean;
  /** Idempotent — repeat calls neither re-render subscribers nor re-persist. */
  markFirstTranslationSeen: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      firstTranslationSeen: false,
      markFirstTranslationSeen: () =>
        set((s) => (s.firstTranslationSeen ? s : { firstTranslationSeen: true })),
    }),
    { name: 'translator-onboarding' },
  ),
);

/**
 * Flips the latch when `entries` contain any translated text. Called from
 * every string-store path that puts entries into the store, which is where
 * both routes to a translation converge: an engine run (whose results reach
 * the UI through a refetch) and a translation typed by hand.
 *
 * Cheap enough to call on every load — it returns on the already-latched
 * check before scanning, and the scan itself short-circuits on the first hit.
 */
export function noteTranslations(entries: readonly StringEntry[]): void {
  if (useOnboardingStore.getState().firstTranslationSeen) return;
  // `?? {}` because the shape is not guaranteed in practice despite the type:
  // the server's own writer defends the same way (pg-string-store.ts,
  // `entry.translations ?? {}`). Throwing here would reject the whole
  // fetchEntries action and leave the table empty, which is a wildly
  // disproportionate failure for a sidebar tint.
  const translated = entries.some((entry) =>
    Object.values(entry.translations ?? {}).some((record) => Boolean(record?.text)),
  );
  if (translated) useOnboardingStore.getState().markFirstTranslationSeen();
}
