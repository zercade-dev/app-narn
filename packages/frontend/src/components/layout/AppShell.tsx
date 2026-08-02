import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { RestartBanners } from './RestartBanners.js';
import { SlotRibbon } from './SlotRibbon.js';
import { Sidebar } from './Sidebar.js';
import { ConsolePanel } from './ConsolePanel.js';
import { ConfigTab } from '../config/ConfigTab.js';
import { DataTab } from '../config/DataTab.js';
import { StringTable } from '../string-table/StringTable.js';
import { MobileStringList } from '../string-table/MobileStringList.js';
import { GlobalConfigView } from '../global-config/GlobalConfigView.js';
import { TranslationMemoryPanel } from '../tm/TranslationMemoryPanel.js';
import { GuideView } from '../guide/GuideView.js';
import { WelcomeView } from '../welcome/WelcomeView.js';
import { ColorTextView } from '../color-text/ColorTextView.js';
import { AccountView } from '../account/AccountView.js';
import { LegalView } from '../legal/LegalView.js';
import { ChangelogView } from '../page/ChangelogView.js';
import { AboutNarnView } from '../page/AboutNarnView.js';
import { SettingsView } from '../settings/SettingsView.js';
import { JoinProjectView } from '../collab/JoinProjectView.js';
import { VaultUnlockDialog } from '../vault/VaultUnlockDialog.js';
import { VaultEditorDialog } from '../vault/VaultEditorDialog.js';
import { WebSearchDialog } from './WebSearchDialog.js';
import { useSystemStatusStore } from '@/stores/system-status-store.js';
import { useNotificationStore } from '@/stores/notification-store.js';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { availableTabs, firstAvailableTab } from '../../lib/tab-gating.js';
import { useIsMobile } from '../../hooks/use-mobile-viewport.js';
import { isShellViewMobileOk, isTabMobileOk } from '../../lib/mobile-gating.js';
import { DesktopOnlyNotice } from '../common/DesktopOnlyNotice.js';
import { NoProjectEmptyState } from '../common/NoProjectEmptyState.js';
import { useRunStore } from '../../stores/run-store.js';
import { useVaultStatus } from '../../hooks/useVaultStatus.js';
import { apiRequest } from '../../hooks/use-api.js';
import { useModules } from '../../hooks/use-modules.js';
import { VAULT_LOCKED_EVENT, type VaultLockedDetail } from '../../lib/vault-events.js';
import { toast } from '@/lib/toast';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';
import { CopilotModelsProvider } from '../../hooks/use-copilot-models.js';
import type { RoutingRule, RoutingRuleGroup } from '@zercade-dev/narn-shared';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { RoutingRulesConfig, type RoutingBackend } from '../batch/RoutingRulesConfig.js';
import { isModuleActive } from '../batch/ModulesPanel.js';
import { RunsTab } from '../tabs/RunsTab.js';
import { MobileRunsList } from '../tabs/MobileRunsList.js';
import { Card } from '../ui/card.js';
import { Button } from '../ui/button';

const GlossaryTab = lazy(() =>
  import('../glossary/GlossaryTab.js').then((m) => ({ default: m.GlossaryTab })),
);
const CategoryTab = lazy(() =>
  import('../category/CategoryTab.js').then((m) => ({ default: m.CategoryTab })),
);
const ComparisonTab = lazy(() =>
  import('../comparison/ComparisonTab.js').then((m) => ({ default: m.ComparisonTab })),
);
const OrphansTab = lazy(() =>
  import('../orphans/OrphansTab.js').then((m) => ({ default: m.OrphansTab })),
);
const BackupTab = lazy(() =>
  import('../backup/BackupTab.js').then((m) => ({ default: m.BackupTab })),
);
const SourceAiReviewTab = lazy(() =>
  import('../review/SourceAiReviewTab.js').then((m) => ({ default: m.SourceAiReviewTab })),
);
const TranslationAiReviewTab = lazy(() =>
  import('../review/TranslationAiReviewTab.js').then((m) => ({
    default: m.TranslationAiReviewTab,
  })),
);
const ReviewTab = lazy(() =>
  import('../review/ReviewTab.js').then((m) => ({ default: m.ReviewTab })),
);
const QualityTab = lazy(() =>
  import('../quality/QualityTab.js').then((m) => ({ default: m.QualityTab })),
);
const SharingTab = lazy(() =>
  import('../sharing/SharingTab.js').then((m) => ({ default: m.SharingTab })),
);
const StageDetailsTab = lazy(() =>
  import('../stage-details/StageDetailsTab.js').then((m) => ({ default: m.StageDetailsTab })),
);

function TabFallback() {
  const { t } = useTranslation('strings');
  return <div className="p-4 text-muted-foreground text-sm">{t('loading')}</div>;
}

interface RoutingDoc {
  routingRules: RoutingRule[];
  routingRuleGroups?: RoutingRuleGroup[];
  activeRoutingRuleGroupId?: string | null;
}

/**
 * A collaborator's routing rules are a per-user document
 * (`/api/collab-routing`, GET/PUT), NOT the project's own `routingRules` —
 * a collaborator has no access to those at all, and their rules follow them
 * across every project they're shared into. Deliberately plain functions
 * (no store/state) — `RoutingTabContent` owns the loaded doc's lifecycle;
 * this is just where its two network calls live.
 */
const collabRoutingBackend = {
  load: (): Promise<RoutingDoc> => apiRequest<RoutingDoc>('/collab-routing'),
  save: (payload: {
    rules: RoutingRule[];
    groups: RoutingRuleGroup[];
    activeGroupId: string;
  }): Promise<RoutingDoc> =>
    apiRequest<RoutingDoc>('/collab-routing', { method: 'PUT', body: JSON.stringify(payload) }),
};

interface RoutingTabContentProps {
  projectId: string;
  role: 'owner' | 'collaborator';
  activeLanguages: string[];
  routingRules: RoutingRule[];
  routingRuleGroups?: RoutingRuleGroup[];
  activeRoutingRuleGroupId?: string | null;
  onSaved: () => void;
}

/** Stable empty reference so the moduleConfigs store selector never re-renders. */
const EMPTY_MODULE_CONFIGS: Record<string, never> = {};

export function RoutingTabContent({
  projectId,
  role,
  activeLanguages,
  routingRules,
  routingRuleGroups,
  activeRoutingRuleGroupId,
  onSaved,
}: Readonly<RoutingTabContentProps>) {
  const { t } = useTranslation('strings');
  const availableModules = useModules();
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const runs = useRunStore((s) => s.runs);
  const startPolling = useRunStore((s) => s.startPolling);
  const stopPolling = useRunStore((s) => s.stopPolling);
  const isCollaborator = role === 'collaborator';

  const translationsInProgress = runs.some(
    (r) => r.status === RunStatusCode.Pending || r.status === RunStatusCode.Running,
  );

  useEffect(() => {
    void apiRequest<string[]>(`/projects/${projectId}/categories`)
      .then((cats) => setAvailableCategories(cats))
      .catch(() => {
        /* non-critical */
      });
  }, [projectId]);

  // Collaborators: load the per-user routing doc once on mount (independent
  // of the project — see collabRoutingBackend above). Owners keep using the
  // `routingRules`/`routingRuleGroups`/`activeRoutingRuleGroupId` props as-is
  // (sourced from `activeProject`, unchanged by this effect) — their path is
  // byte-identical to before per-user routing existed.
  //
  // `collabLoadState` gates the editor itself: a failed GET must NOT fall
  // through to an empty-but-editable document, because the next Save would
  // PUT that empty document and clobber whatever the collaborator had saved
  // before (data loss). Until a load has *succeeded*, the Save-capable
  // editor is not rendered at all — only a retry card is.
  const [collabDoc, setCollabDoc] = useState<RoutingDoc | null>(null);
  const [collabLoadState, setCollabLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [collabLoadAttempt, setCollabLoadAttempt] = useState(0);
  useEffect(() => {
    if (!isCollaborator) return;
    let cancelled = false;
    void collabRoutingBackend
      .load()
      .then((doc) => {
        if (cancelled) return;
        setCollabDoc(doc);
        setCollabLoadState('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setCollabLoadState('error');
        toast.error(t('collab:routing.loadFailed'));
      });
    return () => {
      cancelled = true;
    };
    // `collabLoadAttempt` is bumped (and `collabLoadState` reset to
    // 'loading') by `retryCollabLoad` below, in the Retry button's click
    // handler — not here — so this effect never calls setState synchronously
    // on entry, only from the async load's resolution.
  }, [isCollaborator, collabLoadAttempt, t]);
  const retryCollabLoad = (): void => {
    setCollabLoadState('loading');
    setCollabLoadAttempt((n) => n + 1);
  };

  const routingBackend: RoutingBackend | undefined = isCollaborator
    ? {
        save: async (payload) => {
          const saved = await collabRoutingBackend.save(payload);
          // Echo the just-saved doc back into local state so the editor's
          // dirty-tracking (which re-derives "saved" state from these props)
          // sees the same value it just wrote, without a network round trip.
          setCollabDoc(saved);
          return saved;
        },
      }
    : undefined;

  const effectiveRules = isCollaborator ? (collabDoc?.routingRules ?? []) : routingRules;
  const effectiveGroups = isCollaborator ? collabDoc?.routingRuleGroups : routingRuleGroups;
  const effectiveActiveGroupId = isCollaborator
    ? collabDoc?.activeRoutingRuleGroupId
    : activeRoutingRuleGroupId;

  useEffect(() => {
    if (projectId) {
      startPolling(projectId);
    }
    return () => stopPolling();
  }, [projectId, startPolling, stopPolling]);

  // The routing module selector sorts active-in-project modules first and mutes
  // the inactive ones, so it needs the project's real per-module `active` flags.
  // The store's project list carries full moduleConfigs (listProjects returns
  // whole rows), so read them from there — no extra fetch. A module with no
  // entry defaults to active (isModuleActive: absent ⇒ active), so brand-new
  // instances sort first.
  const projectModuleConfigs = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.moduleConfigs ?? EMPTY_MODULE_CONFIGS,
  );
  const disabledModuleIds = new Set(
    availableModules.filter((m) => !isModuleActive(m.id, projectModuleConfigs)).map((m) => m.id),
  );
  // Collaborators only ever see the Save-capable editor once their per-user
  // doc has actually loaded — see the collabLoadState effect above for why
  // (a failed/never-run GET must never render an editor whose Save would PUT
  // an empty document over the collaborator's saved rules). Owners are
  // unaffected: `isCollaborator` is false for them, so this always evaluates
  // true regardless of collabLoadState's (unused) default.
  const showRoutingEditor = !isCollaborator || collabLoadState === 'loaded';
  return (
    <div className="space-y-6">
      {isCollaborator && (
        <Card data-testid="collab-routing-scope-note" className="p-4">
          <p className="text-xs text-muted-foreground">{t('collab:routing.scopeNote')}</p>
        </Card>
      )}
      {isCollaborator && collabLoadState === 'loading' && (
        <Card data-testid="collab-routing-loading" className="p-4">
          <p className="text-xs text-muted-foreground">{t('collab:routing.loading')}</p>
        </Card>
      )}
      {isCollaborator && collabLoadState === 'error' && (
        <Card data-testid="collab-routing-load-error" className="p-4 space-y-3">
          <p className="text-sm text-destructive">{t('collab:routing.loadFailed')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="collab-routing-retry"
            onClick={retryCollabLoad}
          >
            {t('collab:routing.retry')}
          </Button>
        </Card>
      )}
      {showRoutingEditor && (
        <RoutingRulesConfig
          projectId={projectId}
          rules={effectiveRules}
          routingRuleGroups={effectiveGroups}
          activeRoutingRuleGroupId={effectiveActiveGroupId}
          modules={availableModules}
          availableLanguages={activeLanguages}
          availableCategories={availableCategories}
          translationsInProgress={translationsInProgress}
          disabledModuleIds={disabledModuleIds}
          routingBackend={routingBackend}
          onSave={onSaved}
        />
      )}
    </div>
  );
}

export function AppShell() {
  const { t } = useTranslation('strings');
  const { t: tv } = useTranslation('vault');
  const [consolePanelOpen, setConsolePanelOpen] = useState(false);
  const [vaultDialogOpen, setVaultDialogOpen] = useState(false);
  const [vaultEditorOpen, setVaultEditorOpen] = useState(false);
  const [vaultFocusKey, setVaultFocusKey] = useState<string | undefined>(undefined);
  const [pendingRetries, setPendingRetries] = useState<
    Array<{ retry: () => Promise<void>; vaultRetryKey: string | null }>
  >([]);
  const isMobile = useIsMobile();
  const view = useViewStore((s) => s.view);
  const activeTab = useViewStore((s) => s.activeTab);
  const setActiveTab = useViewStore((s) => s.setActiveTab);
  const activeProject = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeAccess = useProjectStore((s) => accessFor(s, s.activeProjectId));
  const projectCount = useProjectStore((s) => s.projects.length);
  const loadSharedProjectNicknames = useProjectStore((s) => s.loadSharedProjectNicknames);
  const loadSelfNickname = useProjectStore((s) => s.loadSelfNickname);
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);
  const supportEmail = useSystemStatusStore((s) => s.status?.supportEmail ?? null);

  // Decorate shared rows with their owner's nickname, and load the viewer's
  // own nickname (for the `@me/…` / `@<alias>/…` project display), once
  // projects have loaded, cloud-managed only (local/open-core has no collab
  // surface, and these collab-api calls would just 404). Both are
  // best-effort; CollabApiError is already swallowed in the store, this catch
  // covers network-level rejections.
  useEffect(() => {
    if (!cloudManaged || projectCount === 0) return;
    void loadSharedProjectNicknames().catch(() => {});
    void loadSelfNickname().catch(() => {});
  }, [cloudManaged, projectCount, loadSharedProjectNicknames, loadSelfNickname]);

  // Pre-load vault status on app mount so VaultUnlockDialog shows the correct
  // title ("Unlock vault" vs "Create vault") immediately, without a flicker.
  // `unlocked` is also used to re-check copilot's enabled state on unlock.
  const { unlocked: vaultUnlocked } = useVaultStatus();

  // Gating reset: whenever the active project (or its access role) changes
  // such that the current tab is no longer reachable — e.g. switching from an
  // owned project to one where the caller is a collaborator, or the access
  // map populating after an optimistic project switch — fall back to the
  // first tab that IS available rather than showing a gated/blank panel.
  useEffect(() => {
    const allowed = availableTabs(activeAccess, cloudManaged);
    if (!allowed.includes(activeTab)) {
      setActiveTab(firstAvailableTab(activeAccess, cloudManaged));
    }
  }, [activeProjectId, activeAccess, cloudManaged, activeTab, setActiveTab]);

  // First-login/first-enrollment UX: cloud mode's device-enrollment status
  // (`setupRequired`) used to trigger an immediate hard redirect to /vault
  // before the user ever saw the app shell (see vault-store.ts). Land once on
  // the Welcome view instead, so the user can read the guides before choosing
  // to set up the vault. The ref guards this to at most once per mount, so it
  // never yanks the user back to Welcome after they've navigated away and a
  // later refresh() re-confirms setupRequired. Gated on setupRequired's
  // resolved value, not vault-store's statusFetched — that flag flips true
  // synchronously the instant a status fetch STARTS, before it resolves, so
  // gating on it would race and could miss the real setupRequired value.
  const setupRequired = useVaultStore((s) => s.setupRequired);
  const setView = useViewStore((s) => s.setView);
  const appliedWelcomeViewRef = useRef(false);
  useEffect(() => {
    if (setupRequired && !appliedWelcomeViewRef.current) {
      appliedWelcomeViewRef.current = true;
      setView('welcome');
    }
  }, [setupRequired, setView]);

  // Whether copilot is globally enabled, used to gate the shell-level
  // CopilotModelsProvider's `/models` fetch. Without this gate the provider
  // fires a request on every app load — including the 401/423 the route
  // legitimately returns — even when the user never enabled copilot. The gate is
  // enabled-only (not vault-gated): when copilot IS enabled the fetch is a
  // legitimate attempt, and `useModuleModels` already treats a locked-vault
  // 401/423 as an empty, error-free state. Re-checked whenever the vault unlocks
  // (a fresh unlock may accompany a different config).
  const [copilotGloballyEnabled, setCopilotGloballyEnabled] = useState(false);
  useEffect(() => {
    void apiRequest<{ moduleConfigs?: Record<string, { enabled?: boolean }> }>('/global-config')
      .then((cfg) => setCopilotGloballyEnabled(cfg.moduleConfigs?.copilot?.enabled === true))
      .catch(() => {
        /* non-critical — leaves copilot models ungated-off (no fetch) */
      });
  }, [vaultUnlocked]);

  // Open the vault unlock dialog whenever any API call gets a 423 Locked response.
  // Accumulate all retry functions so every failed call is retried after unlock.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<VaultLockedDetail>).detail;
      const retry = detail?.retry ?? null;
      if (retry) {
        setPendingRetries((prev) => [
          ...prev,
          { retry, vaultRetryKey: detail?.vaultRetryKey ?? null },
        ]);
      }
      setVaultDialogOpen(true);
    };
    globalThis.addEventListener(VAULT_LOCKED_EVENT, handler);
    return () => globalThis.removeEventListener(VAULT_LOCKED_EVENT, handler);
  }, []);

  useEffect(() => {
    const { start, stop } = useSystemStatusStore.getState();
    // Flat, unconditional 5-minute notification poll (see notification-store.ts) —
    // started right alongside the system-status poll, same effect/cleanup pattern,
    // so it runs for the whole app session regardless of which view is active.
    const { start: startNotifications, stop: stopNotifications } = useNotificationStore.getState();
    start();
    startNotifications();
    return () => {
      stop();
      stopNotifications();
    };
  }, []);

  return (
    <TooltipProvider>
      <div className="flex h-svh w-full flex-col">
        <SlotRibbon />
        <SidebarProvider className="min-h-0 flex-1">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content */}
          <SidebarInset className="overflow-hidden h-full min-h-0">
            {/* Restart banners live INSIDE the content column (not full-width above
                the shell) so their text starts to the right of the sidebar and is
                never hidden behind it. */}
            <RestartBanners />
            <header className="flex items-center gap-1 px-2 py-1 border-b border-border">
              <SidebarTrigger data-testid="sidebar-trigger" />
            </header>
            <CopilotModelsProvider enabled={copilotGloballyEnabled}>
              {isMobile &&
              (!isShellViewMobileOk(view) || (view === 'project' && !isTabMobileOk(activeTab))) ? (
                <div className="flex-1 overflow-auto p-4">
                  <DesktopOnlyNotice />
                </div>
              ) : view === 'global-config' ? (
                <div className="flex-1 overflow-auto p-4">
                  <div className="mx-auto w-full max-w-screen-2xl">
                    <GlobalConfigView
                      onUnlockVault={() => setVaultDialogOpen(true)}
                      onManageVault={() => {
                        setVaultFocusKey(undefined);
                        setVaultEditorOpen(true);
                      }}
                      onEditVaultKey={(key) => {
                        setVaultFocusKey(key);
                        setVaultEditorOpen(true);
                      }}
                    />
                  </div>
                </div>
              ) : view === 'translation-memory' ? (
                <div className="flex-1 overflow-auto p-4">
                  <div className="mx-auto w-full max-w-screen-2xl">
                    <TranslationMemoryPanel />
                  </div>
                </div>
              ) : view === 'welcome' ? (
                <div className="flex-1 overflow-auto p-4">
                  <WelcomeView />
                </div>
              ) : view === 'guide' ? (
                <div className="flex-1 overflow-auto p-4">
                  <GuideView />
                </div>
              ) : view === 'account' ? (
                <div className="flex-1 overflow-auto p-4">
                  <AccountView />
                </div>
              ) : view === 'legal' ? (
                <div className="flex-1 overflow-auto p-4">
                  <LegalView />
                </div>
              ) : view === 'changelog' ? (
                <div className="flex-1 overflow-auto p-4">
                  <ChangelogView />
                </div>
              ) : view === 'about-narn' ? (
                <div className="flex-1 overflow-auto p-4">
                  <AboutNarnView />
                </div>
              ) : view === 'settings' ? (
                <div className="flex-1 overflow-auto p-4">
                  <SettingsView />
                </div>
              ) : view === 'join-project' ? (
                <div className="flex-1 overflow-auto p-4">
                  <JoinProjectView />
                </div>
              ) : view === 'project' ? (
                <div className="flex flex-1 flex-col overflow-hidden text-sm">
                  {/* Section panels — which one shows is owned by the sidebar via the view store */}
                  {activeTab === 'config' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeAccess.role === 'collaborator' ? (
                        // Collaborators have no project-level Config tab (routing,
                        // module credentials, etc. stay owner-only); their "config"
                        // slot instead shows the same workspace-wide Global Config
                        // view the sidebar's "Global Config" nav item renders.
                        <div className="mx-auto w-full max-w-screen-2xl">
                          <GlobalConfigView
                            onUnlockVault={() => setVaultDialogOpen(true)}
                            onManageVault={() => {
                              setVaultFocusKey(undefined);
                              setVaultEditorOpen(true);
                            }}
                            onEditVaultKey={(key) => {
                              setVaultFocusKey(key);
                              setVaultEditorOpen(true);
                            }}
                          />
                        </div>
                      ) : (
                        <ConfigTab />
                      )}
                    </div>
                  )}
                  {activeTab === 'data' && (
                    <div className="flex-1 overflow-auto p-4">
                      <DataTab />
                    </div>
                  )}
                  {activeTab === 'strings' &&
                    (isMobile ? (
                      <div className="flex-1 overflow-auto p-4 space-y-4">
                        <MobileStringList />
                      </div>
                    ) : (
                      // Desktop strings workbench: a full-height flex column so the
                      // table grid can flex to fill the viewport (internal scroll),
                      // rather than a scrolling padded box that caps the grid height.
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                        <StringTable />
                      </div>
                    ))}
                  {activeTab === 'compare' && (
                    <div className="flex-1 overflow-hidden p-0">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <ComparisonTab
                            projectId={activeProject.id}
                            sourceLanguage={activeProject.sourceLanguage}
                            activeLanguages={activeProject.activeLanguages}
                          />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.compare')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'review-source-ai' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <SourceAiReviewTab projectId={activeProject.id} />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.review-source-ai')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'review-translation-ai' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <TranslationAiReviewTab projectId={activeProject.id} />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.review-translation-ai')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'review-manual' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <ReviewTab projectId={activeProject.id} />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.review-manual')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'quality' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <QualityTab
                            projectId={activeProject.id}
                            onNavigateToStrings={() => setActiveTab('strings')}
                          />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.quality')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'glossary' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <GlossaryTab
                            projectId={activeProject.id}
                            activeLanguages={activeProject.activeLanguages}
                          />
                        </Suspense>
                      ) : (
                        <div className="text-muted-foreground">{t('tabPlaceholder.glossary')}</div>
                      )}
                    </div>
                  )}
                  {activeTab === 'category' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <CategoryTab projectId={activeProject.id} />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.category')} />
                      )}
                    </div>
                  )}
                  {/* Text Styler: a client-side drafting scratch pad (per-project
                      draft keyed by active project id) — no project data is
                      required, so it renders even without an active project. */}
                  {activeTab === 'color-text' && (
                    <div className="flex-1 overflow-auto p-4">
                      <ColorTextView />
                    </div>
                  )}
                  {activeTab === 'orphans' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <OrphansTab projectId={activeProject.id} />
                        </Suspense>
                      ) : (
                        <div className="text-muted-foreground">{t('tabPlaceholder.orphans')}</div>
                      )}
                    </div>
                  )}
                  {activeTab === 'backup' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <BackupTab projectId={activeProject.id} />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.backup')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'routing' && (
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                      {activeProject ? (
                        <Suspense fallback={<TabFallback />}>
                          <RoutingTabContent
                            projectId={activeProject.id}
                            role={activeAccess.role}
                            activeLanguages={activeProject.activeLanguages}
                            routingRules={activeProject.routingRules ?? []}
                            routingRuleGroups={activeProject.routingRuleGroups}
                            activeRoutingRuleGroupId={activeProject.activeRoutingRuleGroupId}
                            onSaved={() => {
                              void useProjectStore.getState().fetchProjects();
                            }}
                          />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.routing')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'runs' && (
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                      {activeProject ? (
                        isMobile ? (
                          <MobileRunsList projectId={activeProject.id} />
                        ) : (
                          <RunsTab projectId={activeProject.id} />
                        )
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.runs')} />
                      )}
                    </div>
                  )}
                  {activeTab === 'stage-details' && (
                    <div className="flex-1 overflow-auto p-4">
                      <Suspense fallback={<TabFallback />}>
                        <StageDetailsTab />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'sharing' && (
                    <div className="flex-1 overflow-auto p-4">
                      {activeProject && activeAccess.role === 'owner' ? (
                        <Suspense fallback={<TabFallback />}>
                          <SharingTab
                            projectId={activeProject.id}
                            activeLanguages={activeProject.activeLanguages}
                            sourceLanguage={activeProject.sourceLanguage}
                          />
                        </Suspense>
                      ) : (
                        <NoProjectEmptyState message={t('tabPlaceholder.sharing')} />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-4">
                  <div data-testid="view-not-found" className="mx-auto max-w-md p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('viewNotFound')}
                      {supportEmail && (
                        <>
                          {' '}
                          {t('viewNotFoundContact')}{' '}
                          <a className="underline" href={`mailto:${supportEmail}`}>
                            {supportEmail}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </CopilotModelsProvider>

            {/* Console panel footer — desktop-only (mobile is read-only; the log console is an operator surface) */}
            {!isMobile && (
              <ConsolePanel
                open={consolePanelOpen}
                onToggle={() => setConsolePanelOpen((v) => !v)}
              />
            )}
          </SidebarInset>
          <VaultUnlockDialog
            open={vaultDialogOpen}
            onOpenChange={(open) => {
              setVaultDialogOpen(open);
              if (!open) setPendingRetries([]);
            }}
            onUnlocked={async () => {
              const retries = pendingRetries;
              setPendingRetries([]);
              if (retries.length === 0) return;
              const results = await Promise.allSettled(retries.map((item) => item.retry()));
              const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
              const hasTranslationRetry = retries.some((item) => item.vaultRetryKey !== null);
              if (fulfilled === retries.length) {
                // Re-translate retries have dedicated queued/completed toasts in their own flows.
                if (!hasTranslationRetry) {
                  toast.success(tv('retrySuccess', { count: retries.length }));
                }
              } else if (fulfilled === 0) {
                toast.error(tv('retryFailed', { count: retries.length }));
              } else {
                toast.warning(
                  tv('retryPartialFailed', { count: fulfilled, total: retries.length }),
                );
              }
            }}
          />
          <VaultEditorDialog
            open={vaultEditorOpen}
            onOpenChange={setVaultEditorOpen}
            focusKey={vaultFocusKey}
          />
          <WebSearchDialog />
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            visibleToasts={9}
            duration={5000}
          />
        </SidebarProvider>
      </div>
    </TooltipProvider>
  );
}
