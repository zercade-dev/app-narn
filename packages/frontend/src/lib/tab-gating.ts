/**
 * Pure tab-gating rules for the project shell. Owners see every project tab,
 * plus `'sharing'` when the workspace is cloud-managed (local/open-core mode
 * has no sharing surface at all). Collaborators see a fixed, deliberately
 * small subset — {@link COLLABORATOR_TABS} — regardless of cloud/local mode.
 * No React here: `Sidebar` and `AppShell` both consume this to decide what's
 * rendered/reachable.
 */
import type { Tab } from '../stores/view-store.js';
import type { ProjectAccessInfo } from '../stores/project-store.js';

/**
 * The exact tabs a collaborator may reach, in display order. Includes
 * `'routing'` — per-collaborator routing control (the per-user routing
 * store, backed by `/api/collab-routing`) — right after `'compare'`,
 * matching OWNER_TABS' order, and `'stage-details'` (v1.31.1) right
 * after `'runs'`, mirroring OWNER_TABS' order — collaborators view stage
 * details and may translate/edit their granted languages (source stays
 * owner-only, enforced server-side). Includes `'color-text'` — the Text
 * Styler is a client-side drafting utility (no project write, its own BYOK
 * for the AI assistant), so collaborators get it too, placed last to mirror
 * the Sidebar's `content` group order. Still excludes every
 * owner-only/workspace-admin tab (`data`, `quality`, `category`, `orphans`,
 * `backup`, `review-source-ai`) and `'sharing'` itself.
 */
export const COLLABORATOR_TABS: readonly Tab[] = [
  'config',
  'strings',
  'compare',
  'routing',
  'runs',
  'stage-details',
  'review-translation-ai',
  'review-manual',
  'glossary',
  'color-text',
];

/**
 * Every owner-reachable tab EXCEPT `'sharing'`, in the order the Sidebar's
 * `NAV_GROUPS` renders them (`'sharing'` is spliced in right after `'data'`
 * for cloud-managed owners — see {@link availableTabs} — matching where the
 * Sidebar's `groups.project` group places the Sharing nav item).
 */
const OWNER_TABS: readonly Tab[] = [
  'config',
  'data',
  'strings',
  'compare',
  'routing',
  'runs',
  'stage-details',
  'quality',
  'review-source-ai',
  'review-translation-ai',
  'review-manual',
  'glossary',
  'category',
  'color-text',
  'orphans',
  'backup',
];

/**
 * Owner: every tab (+ `'sharing'` when `cloudManaged`). Collaborator: exactly
 * {@link COLLABORATOR_TABS}, unaffected by `cloudManaged` (a collaborator only
 * exists in cloud mode to begin with, but this stays defensive either way).
 */
export function availableTabs(access: ProjectAccessInfo, cloudManaged: boolean): readonly Tab[] {
  if (access.role === 'collaborator') return COLLABORATOR_TABS;
  if (!cloudManaged) return OWNER_TABS;
  return [OWNER_TABS[0], OWNER_TABS[1], 'sharing', ...OWNER_TABS.slice(2)];
}

/** The first tab in {@link availableTabs} — always `'config'` today, for both roles. */
export function firstAvailableTab(access: ProjectAccessInfo, cloudManaged: boolean): Tab {
  return availableTabs(access, cloudManaged)[0];
}
