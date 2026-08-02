import { useEffect, useRef } from 'react';
import { useViewStore } from '../stores/view-store.js';
import { accessFor, useProjectStore } from '../stores/project-store.js';
import { useUiSettings } from '../stores/ui-settings-store.js';
import { useVaultStore } from '../stores/vault-store.js';
import { parseUrl, buildUrl, type UrlState } from '../lib/url-state.js';
import { availableTabs, firstAvailableTab } from '../lib/tab-gating.js';
import type { Tab } from '../stores/view-store.js';

function here(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Synchronizes the browser URL with the app's navigation stores in both
 * directions. Mount once, near the app root. The app still renders from the
 * stores; this only mirrors (view, activeTab, activeProjectId, language) <-> URL.
 */
export function useUrlSync(): void {
  // A ?project from the URL still awaiting validation against the loaded list.
  const pendingProjectIdRef = useRef<string | null>(null);
  // True while we apply URL -> stores, so the store -> URL writer ignores the
  // resulting self-inflicted store changes (the diff-guard also covers this).
  const applyingRef = useRef(false);
  // False until the project list first arrives. While false, an activeProjectId
  // change is the store establishing the initial selection from the server/persist
  // (not user navigation) — reflect it with `replace`, since pushing would leave a
  // phantom history entry whose Back press is a silent no-op. Initialized from
  // mount state so a pre-loaded list (persisted or seeded in tests) counts as
  // already-synced.
  const projectSyncedRef = useRef(useProjectStore.getState().projects.length > 0);

  // Current store state as a UrlState. While a project id is pending validation,
  // prefer it so canonicalization doesn't transiently drop it.
  const readState = (): UrlState => {
    const { view, activeTab } = useViewStore.getState();
    const { activeProjectId } = useProjectStore.getState();
    const { language } = useUiSettings.getState();
    const projectId = pendingProjectIdRef.current ?? activeProjectId ?? undefined;
    return { view, activeTab, ...(projectId ? { projectId } : {}), lang: language };
  };

  // A tab from the URL, gated through the SAME availableTabs rule the
  // Sidebar/AppShell use (tab-gating.ts) — a deep link to a tab the caller's
  // current access can't reach (e.g. a collaborator opening a bookmarked
  // `/setup/data` link) lands directly on firstAvailableTab instead of
  // transiently rendering the gated panel for one frame. `projectId` is the
  // link's OWN target project when present (it may not be the active project
  // yet), falling back to whatever's currently active. AppShell's reset
  // effect stays as the backstop for access arriving/changing after mount.
  const gateTab = (tab: Tab, projectId: string | null | undefined): Tab => {
    const projectState = useProjectStore.getState();
    const access = accessFor(projectState, projectId ?? projectState.activeProjectId);
    const cloudManaged = useVaultStore.getState().cloudManaged ?? false;
    const allowed = availableTabs(access, cloudManaged);
    return allowed.includes(tab) ? tab : firstAvailableTab(access, cloudManaged);
  };

  const canonicalize = (): void => {
    const target = buildUrl(readState());
    if (target !== here()) window.history.replaceState(null, '', target);
  };

  // store -> URL. `push` for navigation (screen/project), `replace` for the
  // language preference toggle. Diff-guarded so it never writes a redundant
  // entry (and so URL-driven store changes don't echo back to the URL).
  const writeUrl = (method: 'push' | 'replace'): void => {
    if (applyingRef.current) return;
    const target = buildUrl(readState());
    if (target === here()) return;
    if (method === 'push') window.history.pushState(null, '', target);
    else window.history.replaceState(null, '', target);
  };

  // Validate + apply a pending ?project once the project list is available.
  const reconcileProject = (): boolean => {
    const id = pendingProjectIdRef.current;
    if (id === null) return false;
    const { projects, activeProjectId, loading, setActiveProjectId } = useProjectStore.getState();
    if (loading && projects.length === 0) return false; // list not ready yet
    pendingProjectIdRef.current = null;
    if (projects.some((p) => p.id === id) && id !== activeProjectId) {
      applyingRef.current = true;
      setActiveProjectId(id);
      applyingRef.current = false;
    }
    return true;
  };

  // URL -> stores (mount + back/forward).
  useEffect(() => {
    const apply = (): void => {
      const parsed = parseUrl(window.location.pathname, window.location.search);
      applyingRef.current = true;
      try {
        if (parsed.view === 'project') {
          const tab = gateTab(parsed.activeTab, parsed.projectId);
          useViewStore.getState().setActiveTab(tab);
        } else useViewStore.getState().setView(parsed.view);

        if (parsed.lang && parsed.lang !== useUiSettings.getState().language) {
          useUiSettings.getState().setLanguage(parsed.lang);
        }
        pendingProjectIdRef.current = parsed.view === 'project' ? (parsed.projectId ?? null) : null;
      } finally {
        applyingRef.current = false;
      }
      reconcileProject(); // applies now if the list is already loaded
      canonicalize();
    };

    apply();
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The project list arriving after mount reconciles a still-pending ?project.
  useEffect(() => {
    const unsub = useProjectStore.subscribe(() => {
      if (reconcileProject()) canonicalize();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // store -> URL on user-initiated changes.
  useEffect(() => {
    const unsubs = [
      useViewStore.subscribe((s, prev) => {
        if (s.view !== prev.view || s.activeTab !== prev.activeTab) writeUrl('push');
      }),
      useProjectStore.subscribe((s, prev) => {
        if (s.activeProjectId !== prev.activeProjectId) {
          writeUrl(projectSyncedRef.current ? 'push' : 'replace');
        }
        if (!projectSyncedRef.current && s.projects.length > 0) {
          projectSyncedRef.current = true;
        }
      }),
      useUiSettings.subscribe((s, prev) => {
        if (s.language !== prev.language) writeUrl('replace');
      }),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
