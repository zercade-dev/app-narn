import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROJECT_ICONS, DEFAULT_PROJECT_ICON, type Project } from '@zercade-dev/narn-shared';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { displayName, rowTintClass } from '../../lib/project-display.js';
import { JoinProjectForm } from '../collab/JoinProjectForm.js';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useViewStore, type Tab } from '../../stores/view-store.js';
import { useTemplateStore } from '../../stores/template-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { useNotificationStore } from '../../stores/notification-store.js';
import { VaultUnlockDialog } from '../vault/VaultUnlockDialog.js';
import { ConfirmSheet } from '../ui/confirm-sheet';
import { apiRequest } from '../../hooks/use-api.js';
import { availableTabs } from '../../lib/tab-gating.js';
import { toast } from '@/lib/toast';
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Activity,
  Archive,
  BookMarked,
  BookOpen,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  Columns2,
  Database,
  FileSearch,
  FileSpreadsheet,
  Gauge,
  Folder,
  Info,
  Map,
  Route,
  LogOut,
  Sparkles,
  Pencil,
  Plus,
  Scale,
  ScrollText,
  Settings,
  Share2,
  SlidersHorizontal,
  Table,
  Tags,
  Type,
  Unlink,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { ShellView } from '../../stores/view-store.js';
import { Skeleton } from '@/components/ui/skeleton';

const ICON_OPTIONS = PROJECT_ICONS;

const DEFAULT_ICON = DEFAULT_PROJECT_ICON;

interface IconPickerProps {
  /** Currently selected emoji icon. */
  value: string;
  onChange: (icon: string) => void;
  /** Accessible group label for the radiogroup. */
  ariaLabel: string;
  className?: string;
  /** When set, each option gets `data-testid="{testIdPrefix}{emoji}"`. */
  testIdPrefix?: string;
  containerTestId?: string;
}

/** Emoji grid for choosing a project icon, with radiogroup/radio semantics. */
const IconPicker = ({
  value,
  onChange,
  ariaLabel,
  className,
  testIdPrefix,
  containerTestId,
  ref,
}: IconPickerProps & { ref?: React.Ref<HTMLDivElement> }) => (
  <div
    ref={ref}
    className={`grid grid-cols-8 gap-0.5 ${className ?? ''}`}
    role="radiogroup"
    aria-label={ariaLabel}
    data-testid={containerTestId}
  >
    {ICON_OPTIONS.map((emoji) => (
      <button
        key={emoji}
        type="button"
        role="radio"
        aria-checked={emoji === value}
        data-testid={testIdPrefix ? `${testIdPrefix}${emoji}` : undefined}
        className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors hover:bg-accent ${
          emoji === value ? 'bg-accent ring-1 ring-ring' : ''
        }`}
        onClick={() => onChange(emoji)}
      >
        {emoji}
      </button>
    ))}
  </div>
);

/** Project section navigation, grouped for the sidebar. Labels live in the
 * `sidebar` namespace (`groups.*`); per-tab labels reuse `strings:tabs.*`. */
const NAV_GROUPS: ReadonlyArray<{
  labelKey: string;
  tabs: ReadonlyArray<{ id: Tab; icon: LucideIcon }>;
}> = [
  {
    labelKey: 'groups.project',
    tabs: [
      { id: 'config', icon: SlidersHorizontal },
      { id: 'data', icon: FileSpreadsheet },
      { id: 'sharing', icon: Share2 },
    ],
  },
  {
    labelKey: 'groups.translate',
    tabs: [
      { id: 'strings', icon: Table },
      { id: 'compare', icon: Columns2 },
      { id: 'routing', icon: Route },
      { id: 'runs', icon: Activity },
      { id: 'stage-details', icon: Map },
    ],
  },
  {
    labelKey: 'groups.review',
    tabs: [
      { id: 'review-source-ai', icon: FileSearch },
      { id: 'review-translation-ai', icon: Sparkles },
      { id: 'review-manual', icon: ClipboardCheck },
      { id: 'quality', icon: Gauge },
    ],
  },
  {
    labelKey: 'groups.content',
    tabs: [
      { id: 'glossary', icon: BookMarked },
      { id: 'category', icon: Tags },
      { id: 'color-text', icon: Type },
    ],
  },
  {
    labelKey: 'groups.maintenance',
    tabs: [
      { id: 'orphans', icon: Unlink },
      { id: 'backup', icon: Archive },
    ],
  },
];

/** Workspace-level "Page" group: static content pages, navigated via `view`
 * (not `activeTab`). Labels live directly in the `sidebar` namespace. `legal`
 * is cloud-only (links out to hosted policy pages) — the others are always
 * shown. (Joining a project used to have its own cloud-only row here; it's
 * now a "Join" tab in the New Project sheet below.) */
const PAGE_ITEMS: ReadonlyArray<{
  id: ShellView;
  icon: LucideIcon;
  labelKey: string;
  cloudOnly?: boolean;
}> = [
  { id: 'settings', icon: Settings, labelKey: 'settings' },
  { id: 'changelog', icon: ScrollText, labelKey: 'changelog' },
  { id: 'legal', icon: Scale, labelKey: 'legal', cloudOnly: true },
  { id: 'about-narn', icon: Info, labelKey: 'aboutNarn' },
];

export function Sidebar() {
  const { t } = useTranslation('sidebar');
  const { t: tStrings } = useTranslation('strings');
  const {
    projects,
    activeProjectId,
    loading,
    fetchProjects,
    activateProject,
    createProject,
    updateProject,
    access,
    ownerNicknames,
    selfUserId,
    selfNickname,
    setActiveProjectId,
  } = useProjectStore();
  const projectIcons = useUiSettings((s) => s.projectIcons);
  const setProjectIcon = useUiSettings((s) => s.setProjectIcon);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // Which tab of the New Project sheet is active — "Create new" | "Join".
  // Only rendered/relevant in cloud mode; local mode always shows the
  // create form with no tabs.
  const [createTab, setCreateTab] = useState<'create' | 'join'>('create');
  const [vaultPromptOpen, setVaultPromptOpen] = useState(false);
  const vaultUnlocked = useVaultStore((s) => s.unlocked);
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);
  const unreadNotificationCount = useNotificationStore((s) => s.unreadCount);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<string>(DEFAULT_ICON);
  const { templates, fetchTemplates, applyTemplate } = useTemplateStore();
  const [newTemplateId, setNewTemplateId] = useState('');
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Shared-project "leave" flow: confirm, DELETE the self membership, refetch.
  const [leaveTarget, setLeaveTarget] = useState<Project | null>(null);
  const [leaving, setLeaving] = useState(false);
  const { state, isMobile, setOpenMobile } = useSidebar();
  // On phones the sidebar lives in an off-canvas drawer; close it after a
  // navigation so the chosen view is visible immediately.
  const closeMobileNav = () => {
    if (isMobile) setOpenMobile(false);
  };
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const activeTab = useViewStore((s) => s.activeTab);
  const setActiveTab = useViewStore((s) => s.setActiveTab);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (createOpen) void fetchTemplates();
  }, [createOpen, fetchTemplates]);

  // Close transient popovers during render when the sidebar collapses.
  const [prevSidebarState, setPrevSidebarState] = useState(state);
  if (prevSidebarState !== state) {
    setPrevSidebarState(state);
    if (state === 'collapsed') {
      setPickerOpenFor(null);
      setSelectorOpen(false);
      setCreateOpen(false);
      setCreateTab('create');
      setNewTemplateId('');
    }
  }

  useEffect(() => {
    if (!pickerOpenFor) return;
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpenFor(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [pickerOpenFor]);

  const handleSelectorOpenChange = (open: boolean) => {
    setSelectorOpen(open);
    if (!open) {
      setPickerOpenFor(null);
      setSearch('');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    let created: Project | undefined;
    try {
      if (newTemplateId) {
        const { project, warnings } = await applyTemplate(newTemplateId, newName.trim());
        created = project;
        for (const warning of warnings) {
          toast.warning(
            warning.code === 'unknown-module'
              ? t('templateWarningUnknownModule', { id: warning.subject })
              : t('templateWarningUnknownGlossary', { id: warning.subject }),
          );
        }
      } else {
        created = await createProject(newName.trim(), 'en', [], newIcon);
      }
    } catch (err) {
      toast.error(t('createFailed', { message: (err as Error).message }));
      return;
    }
    setNewName('');
    setNewIcon(DEFAULT_ICON);
    setNewTemplateId('');
    setCreateOpen(false);
    await fetchProjects();
    if (created) {
      setView('project');
      try {
        await activateProject(created.id);
      } catch (err) {
        toast.error(t('activateFailed', { message: (err as Error).message }));
      }
    }
  };

  // The "New project" button gates on the vault: creating a project hits a
  // vault-guarded write (423 when locked), so when the vault is locked we prompt
  // to create/unlock it FIRST — before the create form (and its Save button) ever
  // open. After a successful unlock we proceed straight into the form.
  const handleNewProjectClick = () => {
    handleSelectorOpenChange(false);
    if (!vaultUnlocked) {
      setVaultPromptOpen(true);
      return;
    }
    setCreateOpen(true);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeIcon = activeProject
    ? (activeProject.icon ?? projectIcons[activeProject.id] ?? DEFAULT_ICON)
    : null;
  // Trigger display: the same @alias/name rule as the switcher list rows,
  // so the alias doesn't disappear once a project is open (closing the
  // "after select" gap).
  const activeRole = accessFor({ access }, activeProjectId).role;
  const activeDisplayName = activeProject
    ? displayName({
        name: activeProject.name,
        role: activeRole,
        ownerNickname: ownerNicknames[activeProject.id] ?? null,
        selfNickname,
        cloudManaged,
      })
    : null;
  const query = search.trim().toLowerCase();
  const filteredProjects = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query))
    : projects;
  // Own vs shared split only applies in cloud mode — local/open-core has no
  // collaboration surface, so `access` is always empty and every project is
  // "own" there anyway; gating on `cloudManaged` explicitly keeps the popover
  // free of section labels/leave affordances in local mode.
  const ownProjects = cloudManaged
    ? filteredProjects.filter((p) => accessFor({ access }, p.id).role !== 'collaborator')
    : filteredProjects;
  const sharedProjects = cloudManaged
    ? filteredProjects.filter((p) => accessFor({ access }, p.id).role === 'collaborator')
    : [];
  const allowedTabs = availableTabs(accessFor({ access }, activeProjectId), cloudManaged);

  const handleConfirmLeave = async () => {
    const target = leaveTarget;
    if (!target || !selfUserId) {
      if (target && !selfUserId) {
        toast.error(t('collab:leaveFailed'));
      }
      setLeaveTarget(null);
      return;
    }
    setLeaving(true);
    try {
      await apiRequest(`/projects/${target.id}/members/${selfUserId}`, { method: 'DELETE' });
      await fetchProjects();
      if (activeProjectId === target.id) {
        const remaining = useProjectStore.getState().projects;
        const remainingAccess = useProjectStore.getState().access;
        const nextOwn = remaining.find(
          (p) => accessFor({ access: remainingAccess }, p.id).role !== 'collaborator',
        );
        if (nextOwn) {
          setView('project');
          try {
            await activateProject(nextOwn.id);
          } catch (err) {
            toast.error(t('activateFailed', { message: (err as Error).message }));
          }
        } else {
          setActiveProjectId(null);
        }
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLeaving(false);
      setLeaveTarget(null);
    }
  };

  /**
   * One project row in the switcher popover. Own rows keep the existing
   * activate + change-icon affordances; shared (collaborator) rows swap the
   * name for `@nick/name` and the change-icon button for a "leave" button —
   * a collaborator doesn't own the icon, and leaving is the only per-row
   * action they have here.
   */
  const renderProjectRow = (project: Project, shared: boolean) => {
    const icon = project.icon ?? projectIcons[project.id] ?? DEFAULT_ICON;
    const isPickerOpen = pickerOpenFor === project.id;
    const role = shared ? 'collaborator' : 'owner';
    const label = displayName({
      name: project.name,
      role,
      ownerNickname: ownerNicknames[project.id] ?? null,
      selfNickname,
      cloudManaged,
    });
    return (
      <li
        key={project.id}
        className="group/project-row relative"
        data-testid={`project-item-${project.id}`}
      >
        <button
          type="button"
          data-testid={`activate-project-${project.id}`}
          onClick={() => {
            setView('project');
            activateProject(project.id).catch((err: unknown) => {
              toast.error(t('activateFailed', { message: (err as Error).message }));
            });
            handleSelectorOpenChange(false);
            closeMobileNav();
          }}
          className={
            cloudManaged
              ? `flex w-full items-center gap-2 rounded-md p-2 pr-8 text-left text-sm transition-colors ${rowTintClass(
                  role,
                )} ${project.id === activeProjectId ? 'font-medium' : ''}`
              : `flex w-full items-center gap-2 rounded-md p-2 pr-8 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                  project.id === activeProjectId ? 'bg-accent/50 font-medium' : ''
                }`
          }
        >
          <span className="flex size-4 shrink-0 items-center justify-center text-sm leading-none">
            {icon}
          </span>
          <span className="flex-1 truncate" data-testid={`project-item-chip-${project.id}`}>
            {label}
          </span>
          {project.id === activeProjectId && (
            <Check className="size-4 shrink-0 text-primary" aria-hidden />
          )}
        </button>
        {shared ? (
          !isMobile && (
            <button
              type="button"
              aria-label={t('collab:leaveProject')}
              data-testid={`leave-project-${project.id}`}
              onClick={() => setLeaveTarget(project)}
              className="absolute top-1/2 right-1 flex aspect-square w-5 -translate-y-1/2 items-center justify-center rounded-md p-0 opacity-0 text-muted-foreground transition-opacity group-focus-within/project-row:opacity-100 group-hover/project-row:opacity-100 hover:bg-accent hover:text-destructive"
            >
              <LogOut className="size-3" />
            </button>
          )
        ) : (
          <>
            {!isMobile && (
              <button
                type="button"
                aria-label={t('changeProjectIcon')}
                aria-expanded={isPickerOpen}
                onClick={() => setPickerOpenFor(isPickerOpen ? null : project.id)}
                className="absolute top-1/2 right-1 flex aspect-square w-5 -translate-y-1/2 items-center justify-center rounded-md p-0 opacity-0 transition-opacity group-focus-within/project-row:opacity-100 group-hover/project-row:opacity-100 aria-expanded:opacity-100 hover:bg-accent"
              >
                <Pencil className="size-3" />
              </button>
            )}
            {!isMobile && isPickerOpen && (
              <div className="px-2 pb-1">
                <IconPicker
                  ref={pickerRef}
                  value={icon}
                  ariaLabel={t('changeProjectIcon')}
                  className="rounded-md border bg-popover p-1.5 shadow-sm"
                  onChange={(emoji) => {
                    setProjectIcon(project.id, emoji);
                    void updateProject(project.id, { icon: emoji }).catch((err: unknown) => {
                      toast.error((err as Error).message);
                    });
                    setPickerOpenFor(null);
                  }}
                />
              </div>
            )}
          </>
        )}
      </li>
    );
  };

  // The "Create new" tab content of the New Project sheet — today's create
  // form, unchanged. Extracted to a variable so it can be rendered plainly
  // in local mode (no tabs) or inside a `TabsContent` in cloud mode (see the
  // Sheet below), without duplicating the JSX.
  const createProjectForm = (
    <>
      <div className="flex flex-col gap-3 px-4">
        <Input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder={t('projectNamePlaceholder')}
          data-testid="new-project-input"
        />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t('projectIconLabel')}</span>
          <IconPicker
            value={newIcon}
            onChange={setNewIcon}
            ariaLabel={t('projectIconLabel')}
            className="rounded-md border p-1.5"
            containerTestId="new-project-icon-picker"
            testIdPrefix="new-project-icon-"
          />
        </div>
        {templates.length > 0 && (
          <Select
            value={newTemplateId || 'none'}
            onValueChange={(v) => setNewTemplateId(v && v !== 'none' ? v : '')}
          >
            <SelectTrigger size="sm" className="w-full" data-testid="new-project-template-select">
              <SelectValue placeholder={t('templateNone')}>
                {(v: string | null) =>
                  !v || v === 'none'
                    ? t('templateNone')
                    : (templates.find((tpl) => tpl.id === v)?.name ?? v)
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('templateNone')}</SelectItem>
              {templates.map((template) => (
                <SelectItem
                  key={template.id}
                  value={template.id}
                  data-testid={`new-project-template-${template.id}`}
                >
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <SheetFooter>
        <Button
          onClick={handleCreate}
          disabled={!newName.trim()}
          data-testid="create-project-button"
        >
          {t('create')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setCreateOpen(false);
            setNewTemplateId('');
          }}
        >
          {t('cancel')}
        </Button>
      </SheetFooter>
    </>
  );

  return (
    <UISidebar
      collapsible="icon"
      data-testid="sidebar"
      className="border-r border-sidebar-border bg-sidebar"
    >
      <SidebarHeader>
        <Popover open={selectorOpen} onOpenChange={handleSelectorOpenChange}>
          <PopoverTrigger
            data-testid="project-selector-trigger"
            aria-label={activeProject?.name ?? t('selectProject')}
            title={activeProject?.name ?? t('selectProject')}
            className={`flex h-8 w-full items-center gap-2 overflow-hidden rounded-md border border-sidebar-border p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,padding] focus-visible:ring-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:p-2 ${
              activeProject && cloudManaged
                ? rowTintClass(activeRole)
                : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
          >
            <span className="flex size-4 shrink-0 items-center justify-center text-sm leading-none">
              {activeIcon ?? <Folder className="size-4 text-muted-foreground" />}
            </span>
            {state !== 'collapsed' && (
              <>
                <span className="flex-1 truncate" data-testid="project-selector-trigger-chip">
                  {activeDisplayName ?? t('selectProject')}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </>
            )}
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-64 p-0"
            data-testid="project-selector-popup"
          >
            <div className="border-b border-border p-1.5">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchProjects')}
                className="h-7 text-xs"
                data-testid="project-selector-search"
              />
            </div>
            <ul
              className="max-h-64 overflow-y-auto p-1"
              aria-label={t('projects')}
              data-testid="project-selector-list"
            >
              {loading && projects.length === 0 && (
                <>
                  {[0, 1, 2].map((i) => (
                    <li key={`skeleton-${i}`} className="p-1">
                      <Skeleton className="h-7 w-full rounded-md" />
                    </li>
                  ))}
                </>
              )}

              {!loading && projects.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted-foreground">{t('noProjects')}</li>
              )}

              {projects.length > 0 && filteredProjects.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted-foreground">{t('noMatches')}</li>
              )}

              {cloudManaged ? (
                <>
                  {ownProjects.length > 0 && (
                    <>
                      <li
                        className="px-2 pt-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground"
                        data-testid="project-selector-own-label"
                      >
                        {t('collab:yourProjects')}
                      </li>
                      {ownProjects.map((project) => renderProjectRow(project, false))}
                    </>
                  )}
                  {sharedProjects.length > 0 && (
                    <>
                      <li
                        className="px-2 pt-1.5 pb-0.5 text-[11px] font-medium text-muted-foreground"
                        data-testid="project-selector-shared-label"
                      >
                        {t('collab:sharedWithYou')}
                      </li>
                      {sharedProjects.map((project) => renderProjectRow(project, true))}
                    </>
                  )}
                </>
              ) : (
                filteredProjects.map((project) => renderProjectRow(project, false))
              )}
            </ul>
            {!isMobile && (
              <div className="border-t border-border p-1">
                <button
                  type="button"
                  data-testid="new-project-button"
                  onClick={handleNewProjectClick}
                  className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="truncate">{t('newProject')}</span>
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </SidebarHeader>
      <SidebarContent role="navigation" aria-label={t('navLabel')}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-testid="sidebar-global-config"
                  isActive={view === 'global-config'}
                  onClick={() => {
                    setView('global-config');
                    closeMobileNav();
                  }}
                  tooltip={t('globalConfig')}
                >
                  <Settings className="size-4 shrink-0" />
                  <span className="truncate">{t('globalConfig')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-testid="sidebar-translation-memory"
                  isActive={view === 'translation-memory'}
                  onClick={() => {
                    setView('translation-memory');
                    closeMobileNav();
                  }}
                  tooltip={t('translationMemory')}
                >
                  <Database className="size-4 shrink-0" />
                  <span className="truncate">{t('translationMemory')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  data-testid="sidebar-guide"
                  isActive={view === 'guide'}
                  onClick={() => {
                    setView('guide');
                    closeMobileNav();
                  }}
                  tooltip={t('guide')}
                >
                  <BookOpen className="size-4 shrink-0" />
                  <span className="truncate">{t('guide')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {cloudManaged && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    data-testid="sidebar-account"
                    isActive={view === 'account'}
                    onClick={() => {
                      setView('account');
                      closeMobileNav();
                    }}
                    tooltip={t('account')}
                  >
                    <UserCog className="size-4 shrink-0" />
                    <span className="truncate">{t('account')}</span>
                  </SidebarMenuButton>
                  {unreadNotificationCount > 0 && (
                    <SidebarMenuBadge data-testid="sidebar-account-unread-badge">
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {NAV_GROUPS.map((group) => {
          const visibleTabs = group.tabs.filter(({ id }) => allowedTabs.includes(id));
          if (visibleTabs.length === 0) return null;
          return (
            <SidebarGroup key={group.labelKey}>
              <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleTabs.map(({ id, icon: Icon }) => (
                    <SidebarMenuItem key={id}>
                      <SidebarMenuButton
                        data-testid={`tab-trigger-${id}`}
                        isActive={view === 'project' && activeTab === id}
                        onClick={() => {
                          setActiveTab(id);
                          closeMobileNav();
                        }}
                        tooltip={tStrings(`tabs.${id}`)}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="truncate">{tStrings(`tabs.${id}`)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
        <SidebarGroup>
          <SidebarGroupLabel>{t('groups.page')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PAGE_ITEMS.filter((item) => !item.cloudOnly || cloudManaged).map(
                ({ id, icon: Icon, labelKey }) => (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      data-testid={`sidebar-${id}`}
                      isActive={view === id}
                      onClick={() => {
                        setView(id);
                        closeMobileNav();
                      }}
                      tooltip={t(labelKey)}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{t(labelKey)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateTab('create');
        }}
      >
        <SheetContent side="right" className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>{t('createProjectTitle')}</SheetTitle>
          </SheetHeader>
          {cloudManaged ? (
            <Tabs
              value={createTab}
              onValueChange={(v) => {
                if (v) setCreateTab(v as 'create' | 'join');
              }}
            >
              <TabsList className="mx-4">
                <TabsTrigger value="create" data-testid="new-project-tab-create">
                  {t('createTab')}
                </TabsTrigger>
                <TabsTrigger value="join" data-testid="new-project-tab-join">
                  {t('joinProject')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="create">{createProjectForm}</TabsContent>
              <TabsContent value="join">
                <div className="px-4">
                  <JoinProjectForm onJoined={() => setCreateOpen(false)} />
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            createProjectForm
          )}
        </SheetContent>
      </Sheet>
      <VaultUnlockDialog
        open={vaultPromptOpen}
        onOpenChange={setVaultPromptOpen}
        onUnlocked={() => {
          setVaultPromptOpen(false);
          setCreateOpen(true);
        }}
      />
      <ConfirmSheet
        open={leaveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveTarget(null);
        }}
        title={t('collab:leaveConfirmTitle')}
        description={t('collab:leaveConfirmBody', { name: leaveTarget?.name ?? '' })}
        confirmLabel={t('collab:leaveConfirm')}
        confirmDisabled={leaving}
        cancelDisabled={leaving}
        onConfirm={() => void handleConfirmLeave()}
        cancelLabel={t('cancel')}
        cancelTestId="leave-project-cancel"
        confirmTestId="leave-project-confirm"
      />
    </UISidebar>
  );
}
