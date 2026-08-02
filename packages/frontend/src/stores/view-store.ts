/**
 * View store — single navigation owner for the app shell. `view` tracks
 * which top-level view is shown in the main area: `project` shows the
 * per-project section panels (default), `global-config` shows the
 * workspace-wide Global Config view, `translation-memory` shows the global
 * TM browser, `guide` shows the user guide, `account` (cloud only) holds
 * data export + account deletion, `legal` lists the public policy pages,
 * `changelog` shows recent release notes, `about-narn` shows the About Narn
 * page (these three live in the sidebar's "Page" group), `settings` shows
 * the Settings view (appearance/UI-language preferences, relocated from the
 * old sidebar footer), `join-project` (cloud only) shows the "Join a
 * project" invite-code redemption view — this is no longer in the sidebar's
 * "Page" group (joining now happens from a tab in the New Project sheet, see
 * `Sidebar.tsx`'s `JoinProjectForm` usage) and is reachable only via the
 * `/join` deep link (`lib/url-state.ts`), `welcome` is a one-time-per-load
 * landing screen shown by AppShell instead of the app's default view when
 * the vault store reports `setupRequired` (cloud mode, device not yet
 * enrolled) — not reachable from the sidebar. `activeTab` tracks which
 * project section is shown and survives switching to the workspace-level
 * views and back.
 */
import { create } from 'zustand';

export type ShellView =
  | 'project'
  | 'global-config'
  | 'translation-memory'
  | 'guide'
  | 'account'
  | 'legal'
  | 'changelog'
  | 'about-narn'
  | 'settings'
  | 'join-project'
  | 'welcome';

export type Tab =
  | 'config'
  | 'data'
  | 'strings'
  | 'compare'
  | 'review-source-ai'
  | 'review-translation-ai'
  | 'review-manual'
  | 'quality'
  | 'glossary'
  | 'category'
  | 'routing'
  | 'runs'
  | 'stage-details'
  | 'orphans'
  | 'backup'
  /** Per-project Text Styler (game-markup color/format editor); a project tab
   * (was a workspace view). Renders `ColorTextView`. */
  | 'color-text'
  /** Owner-only, cloud-managed-only; gated by `lib/tab-gating.ts`, not by
   * this type. Renders `SharingTab`. */
  | 'sharing';

/** The three Review tabs, addressed by a short alias from deep-links. */
export type ReviewSubTab = 'source-ai' | 'translation-ai' | 'manual';

/** Maps a deep-link alias to its top-level Review tab id. */
const REVIEW_TAB: Record<ReviewSubTab, Tab> = {
  'source-ai': 'review-source-ai',
  'translation-ai': 'review-translation-ai',
  manual: 'review-manual',
};

interface ViewStore {
  view: ShellView;
  activeTab: Tab;
  /**
   * Run id to focus inside a Review AI tab (deep-linked from the Activity
   * tab's "details" action). Cleared by the tab once consumed.
   */
  reviewRunId: string | null;
  /**
   * Run id whose AI-generated suggestions should be reopened for review,
   * deep-linked from the Activity tab's "review suggestions" action on a
   * completed category-gen / glossary-gen run. Consumed (and cleared) by the
   * owning Category / Glossary tab, which is selected via `activeTab` by
   * `openSuggestions`.
   */
  suggestionRunId: string | null;
  /**
   * Pending entry-id scope for a category-generation run requested from
   * elsewhere (the String Table's "Generate Categories from Selection" bulk
   * action). Set together with a navigation to the Category tab by
   * `openCategoryGenScope`; CategoryTab reads it on mount to pre-fill
   * `entryIds` on its next suggestion run and auto-open the AI panel, then
   * clears it once consumed.
   */
  pendingCategoryGenScope: { entryIds: string[] } | null;
  setView: (v: ShellView) => void;
  /** Selects a project section and switches the shell back to the project view. */
  setActiveTab: (tab: Tab) => void;
  /**
   * Opens the matching Review tab, optionally focusing a run's details. Used by
   * the Activity tab to deep-link into an AI-review run.
   */
  openReview: (sub: ReviewSubTab, runId?: string) => void;
  /** Clears the focused review run id (call after consuming it). */
  clearReviewRunId: () => void;
  /**
   * Opens the Category or Glossary tab and asks it to reopen `runId`'s
   * suggestions for review. Used by the Activity tab so a generation run can be
   * reviewed after the dialog/panel that started it is gone.
   */
  openSuggestions: (tab: 'category' | 'glossary', runId: string) => void;
  /** Clears the focused suggestion run id (call after consuming it). */
  clearSuggestionRunId: () => void;
  /**
   * Opens the Category tab pre-scoped to generate categories for just these
   * entries. Used by the String Table's "Generate Categories from Selection"
   * bulk action (a cross-tab handoff — CategoryTab's AI panel is not a
   * portable dialog, so the scope travels via the store instead).
   */
  openCategoryGenScope: (entryIds: string[]) => void;
  /** Clears the pending category-gen scope (call after consuming it). */
  clearPendingCategoryGenScope: () => void;
}

export const useViewStore = create<ViewStore>()((set) => ({
  view: 'project',
  activeTab: 'config',
  reviewRunId: null,
  suggestionRunId: null,
  pendingCategoryGenScope: null,
  setView: (view) => set({ view }),
  setActiveTab: (activeTab) => set({ activeTab, view: 'project' }),
  openReview: (sub, runId) =>
    set({ activeTab: REVIEW_TAB[sub], view: 'project', reviewRunId: runId ?? null }),
  clearReviewRunId: () => set({ reviewRunId: null }),
  openSuggestions: (tab, runId) => set({ activeTab: tab, view: 'project', suggestionRunId: runId }),
  clearSuggestionRunId: () => set({ suggestionRunId: null }),
  openCategoryGenScope: (entryIds) =>
    set({ activeTab: 'category', view: 'project', pendingCategoryGenScope: { entryIds } }),
  clearPendingCategoryGenScope: () => set({ pendingCategoryGenScope: null }),
}));
