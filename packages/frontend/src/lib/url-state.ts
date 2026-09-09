import type { ShellView, Tab } from '../stores/view-store.js';
import type { UiLanguage } from '../stores/ui-settings-store.js';

/**
 * UI locales accepted in `?lang`, and the order the picker renders them in.
 * `satisfies` keeps this in lockstep with UiLanguage.
 *
 * English first because it is the source language and the default; the rest
 * alphabetical by code. A mechanical rule beats taste here — the list grows
 * with every wave, and "where does the new one go" should never be a decision.
 */
export const UI_LANGS = [
  'en',
  'de',
  'es',
  'fr',
  'id',
  'it',
  'ja',
  'ko',
  'pt-br',
  'ru',
  'th',
  'tr',
  'vi',
  'zh-hans',
  'zh-hant',
] as const satisfies readonly UiLanguage[];

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

/** The screen a path addresses: a shell view, plus the tab when it's the project view. */
interface ScreenDef {
  view: ShellView;
  activeTab: Tab;
}

/** Where `/` and any unknown path resolve to. */
export const DEFAULT_SCREEN: ScreenDef = {
  view: 'project',
  activeTab: 'config',
};

/**
 * Path per shell view, or `null` for a view with no URL of its own: `project`
 * is addressed per-tab (TAB_PATHS below), and `welcome` is what AppShell shows
 * in place of the default screen on first load rather than a destination. The
 * Record type makes TypeScript enforce that every new ShellView member is
 * classified here (missing key = build error), like lib/mobile-gating.ts.
 */
const SHELL_VIEW_PATHS: Record<ShellView, string | null> = {
  project: null,
  'global-config': '/g/config',
  'translation-memory': '/g/memory',
  guide: '/g/guide',
  account: '/account',
  legal: '/legal',
  changelog: '/page/changelog',
  'about-narn': '/page/about-narn',
  settings: '/settings',
  'join-project': '/join',
  welcome: null,
};

/** Path per project section (mirrors the sidebar NAV_GROUPS). */
const TAB_PATHS: Record<Tab, string> = {
  config: '/setup/config',
  data: '/setup/data',
  sharing: '/setup/sharing',
  strings: '/translate/strings',
  compare: '/translate/compare',
  routing: '/translate/routing',
  runs: '/translate/runs',
  'stage-details': '/translate/stage-details',
  quality: '/translate/quality',
  'review-source-ai': '/review/source-ai',
  'review-translation-ai': '/review/translation-ai',
  'review-manual': '/review/manual',
  glossary: '/content/glossary',
  category: '/content/category',
  'color-text': '/content/color-text',
  orphans: '/maintenance/orphans',
  backup: '/maintenance/backup',
};

function buildPathIndex(): ReadonlyMap<string, ScreenDef> {
  const index = new Map<string, ScreenDef>();
  for (const [tab, path] of Object.entries(TAB_PATHS) as [Tab, string][]) {
    index.set(path, { view: 'project', activeTab: tab });
  }
  for (const [view, path] of Object.entries(SHELL_VIEW_PATHS) as [ShellView, string | null][]) {
    if (path !== null) index.set(path, { view, activeTab: DEFAULT_SCREEN.activeTab });
  }
  return index;
}

/** Path -> screen, derived from the two tables above (paths are unique across them). */
const PATH_TO_SCREEN = buildPathIndex();

/** The path addressing this screen, or `null` when the view has no URL of its own. */
function pathFor(view: ShellView, activeTab: Tab): string | null {
  return view === 'project' ? TAB_PATHS[activeTab] : SHELL_VIEW_PATHS[view];
}

export function parseUrl(pathname: string, search: string): UrlState {
  const params = new URLSearchParams(search);
  const langRaw = params.get('lang');
  const lang = isUiLang(langRaw) ? langRaw : undefined;
  const projectRaw = params.get('project');

  const { view, activeTab } = PATH_TO_SCREEN.get(pathname) ?? DEFAULT_SCREEN;

  return {
    view,
    activeTab,
    ...(view === 'project' && projectRaw ? { projectId: projectRaw } : {}),
    ...(lang ? { lang } : {}),
  };
}

export function buildUrl(state: UrlState): string {
  const viewPath = pathFor(state.view, state.activeTab);
  // A view with no URL of its own (`welcome`, which AppShell shows in place of
  // the default screen) addresses DEFAULT_SCREEN — a project screen, so
  // `?project` survives the substitution.
  const path = viewPath ?? TAB_PATHS[DEFAULT_SCREEN.activeTab];
  const isProjectScreen = (viewPath === null ? DEFAULT_SCREEN.view : state.view) === 'project';

  const params = new URLSearchParams();
  if (isProjectScreen && state.projectId) params.set('project', state.projectId);
  if (state.lang) params.set('lang', state.lang);

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
