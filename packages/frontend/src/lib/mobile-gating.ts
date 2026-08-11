/**
 * Width-based mobile gating for the app shell. Below the mobile breakpoint
 * (hooks/use-mobile-viewport.ts) the app is strictly read-only: only
 * surfaces classified 'mobile' here render; everything else shows
 * <DesktopOnlyNotice>. Pure data + lookups, no React — mirrors
 * lib/tab-gating.ts. The Record types make TypeScript enforce that every new
 * ShellView/Tab union member gets classified here (missing key = build error).
 */
import type { ShellView, Tab } from '../stores/view-store.js';

export type MobileGate = 'mobile' | 'desktop';

/** Prose views reflow cheaply; dense workbench views are desktop-only. */
export const SHELL_VIEW_GATES: Record<ShellView, MobileGate> = {
  project: 'mobile', // TAB_GATES decides per-tab inside the project shell
  welcome: 'mobile',
  guide: 'mobile',
  legal: 'mobile',
  changelog: 'mobile',
  'about-narn': 'mobile',
  // Appearance/language are device-local UI preferences, not data writes —
  // allowed on read-only mobile.
  settings: 'mobile',
  'global-config': 'desktop',
  'translation-memory': 'desktop',
  // Renders on mobile so signing out is reachable from a phone (issue #70).
  // Only the session/identity strip survives: the Security/Data/Notifications
  // tabs are replaced by <DesktopOnlyNotice> inside the view, and the nickname
  // claim form is suppressed, so no write affordance reaches mobile.
  account: 'mobile',
  'join-project': 'desktop',
};

export const TAB_GATES: Record<Tab, MobileGate> = {
  runs: 'mobile',
  strings: 'mobile',
  // Renders on mobile as strictly read-only (source/translation text + copy
  // buttons); every write affordance is gated `!isMobile` inside the tab.
  'stage-details': 'mobile',
  config: 'desktop',
  data: 'desktop',
  compare: 'desktop',
  'review-source-ai': 'desktop',
  'review-translation-ai': 'desktop',
  'review-manual': 'desktop',
  quality: 'desktop',
  glossary: 'desktop',
  category: 'desktop',
  routing: 'desktop',
  orphans: 'desktop',
  backup: 'desktop',
  sharing: 'desktop',
  // Dense editing workbench (contenteditable + palette/toolbar) — desktop-only,
  // like glossary/category/config; the whole tab shows <DesktopOnlyNotice> on
  // mobile, so no per-affordance `!isMobile` gating is needed inside it.
  'color-text': 'desktop',
};

export function isShellViewMobileOk(view: ShellView): boolean {
  return SHELL_VIEW_GATES[view] === 'mobile';
}

export function isTabMobileOk(tab: Tab): boolean {
  return TAB_GATES[tab] === 'mobile';
}
