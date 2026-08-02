import type { ShellView, Tab } from '../stores/view-store.js';
import type { UiLanguage } from '../stores/ui-settings-store.js';

/** UI locales accepted in `?lang`. `satisfies` keeps this in lockstep with UiLanguage. */
export const UI_LANGS = ['en', 'es', 'fr'] as const satisfies readonly UiLanguage[];

export function isUiLang(value: string | null | undefined): value is UiLanguage {
  return value != null && (UI_LANGS as readonly string[]).includes(value);
}

/** A serializable view of the URL: which screen + which selection. */
export interface UrlState {
  view: ShellView;
  activeTab: Tab;
  /** Only meaningful on the project view; only emitted on project screens. */
  projectId?: string;
  /** UI language; emitted on every screen. */
  lang?: UiLanguage;
}

interface ScreenDef {
  path: string;
  view: ShellView;
  /** Present => the project view showing this tab. */
  tab?: Tab;
}

/** Single source of truth for path <-> screen (mirrors the sidebar NAV_GROUPS). */
const SCREENS: readonly ScreenDef[] = [
  { path: '/g/config', view: 'global-config' },
  { path: '/g/memory', view: 'translation-memory' },
  { path: '/g/guide', view: 'guide' },
  { path: '/account', view: 'account' },
  { path: '/legal', view: 'legal' },
  { path: '/page/changelog', view: 'changelog' },
  { path: '/page/about-narn', view: 'about-narn' },
  { path: '/join', view: 'join-project' },
  { path: '/setup/config', view: 'project', tab: 'config' },
  { path: '/setup/data', view: 'project', tab: 'data' },
  { path: '/setup/sharing', view: 'project', tab: 'sharing' },
  { path: '/translate/strings', view: 'project', tab: 'strings' },
  { path: '/translate/compare', view: 'project', tab: 'compare' },
  { path: '/translate/routing', view: 'project', tab: 'routing' },
  { path: '/translate/runs', view: 'project', tab: 'runs' },
  { path: '/translate/stage-details', view: 'project', tab: 'stage-details' },
  { path: '/translate/quality', view: 'project', tab: 'quality' },
  { path: '/review/source-ai', view: 'project', tab: 'review-source-ai' },
  { path: '/review/translation-ai', view: 'project', tab: 'review-translation-ai' },
  { path: '/review/manual', view: 'project', tab: 'review-manual' },
  { path: '/content/glossary', view: 'project', tab: 'glossary' },
  { path: '/content/category', view: 'project', tab: 'category' },
  { path: '/content/color-text', view: 'project', tab: 'color-text' },
  { path: '/maintenance/orphans', view: 'project', tab: 'orphans' },
  { path: '/maintenance/backup', view: 'project', tab: 'backup' },
];

/** Where `/` and any unknown path resolve to. */
export const DEFAULT_SCREEN: { view: ShellView; activeTab: Tab } = {
  view: 'project',
  activeTab: 'config',
};

function findByPath(pathname: string): ScreenDef | undefined {
  return SCREENS.find((s) => s.path === pathname);
}

function findByScreen(view: ShellView, activeTab: Tab): ScreenDef | undefined {
  return view === 'project'
    ? SCREENS.find((s) => s.view === 'project' && s.tab === activeTab)
    : SCREENS.find((s) => s.view === view);
}

export function parseUrl(pathname: string, search: string): UrlState {
  const params = new URLSearchParams(search);
  const langRaw = params.get('lang');
  const lang = isUiLang(langRaw) ? langRaw : undefined;
  const projectRaw = params.get('project');

  const def = findByPath(pathname);
  const view = def?.view ?? DEFAULT_SCREEN.view;
  const activeTab = def?.tab ?? DEFAULT_SCREEN.activeTab;

  return {
    view,
    activeTab,
    ...(view === 'project' && projectRaw ? { projectId: projectRaw } : {}),
    ...(lang ? { lang } : {}),
  };
}

export function buildUrl(state: UrlState): string {
  const def = findByScreen(state.view, state.activeTab);
  const path = def?.path ?? '/setup/config';
  // The default fallback screen is the project view, so treat an unmatched
  // state as a project screen too.
  const isProjectScreen = def ? def.view === 'project' : true;

  const params = new URLSearchParams();
  if (isProjectScreen && state.projectId) params.set('project', state.projectId);
  if (state.lang) params.set('lang', state.lang);

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
