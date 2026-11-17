import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n, { loadLocale } from '../i18n/index.js';
import {
  activateTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type UiTheme,
} from '../themes/theme-registry.js';

/**
 * Languages the interface can be switched to. A locale's files can land under
 * `locales/<code>/` well before it appears here — translation ships dark, and
 * adding the code to this union is the switch that makes it selectable. Keep it
 * in lockstep with `UI_LANGS` (lib/url-state.ts) and `UI_LANGUAGE_LABELS`
 * (components/settings/SettingsView.tsx); `satisfies` and the exhaustive
 * `Record` make tsc enforce both.
 */
export type UiLanguage =
  | 'en'
  | 'de'
  | 'es'
  | 'fr'
  | 'id'
  | 'it'
  | 'ja'
  | 'ko'
  | 'pt-br'
  | 'ru'
  | 'th'
  | 'tr'
  | 'vi'
  | 'zh-hans'
  | 'zh-hant';
export type UiMode = 'simple' | 'advanced';
export type ConsoleFilter = 'all' | 'info' | 'warn' | 'error' | 'debug' | 'notifications';

interface UiSettingsState {
  language: UiLanguage;
  setLanguage: (lang: UiLanguage) => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  projectIcons: Record<string, string>;
  setProjectIcon: (id: string, icon: string) => void;
  consoleFilter: ConsoleFilter;
  setConsoleFilter: (filter: ConsoleFilter) => void;
  /** The Friendly console's own tab; Raw keeps `consoleFilter`. Defaults to Info & up. */
  consoleFriendlyFilter: ConsoleFilter;
  setConsoleFriendlyFilter: (filter: ConsoleFilter) => void;
  /**
   * Routing tab mode preference (issue #60). False (the default) shows the
   * single-provider selector; true shows the full rule editor. Persisted per
   * browser so enabling advanced mode is a one-time choice. Only a preference —
   * a project whose rules are not simple renders the full editor regardless
   * (see lib/routing-mode.ts).
   */
  routingAdvanced: boolean;
  setRoutingAdvanced: (advanced: boolean) => void;
  /**
   * Advanced asked for from outside the Routing tab (the Advanced routing
   * tour): the tab brings back rules Simple set aside, then clears it. Not
   * persisted.
   */
  routingAdvancedAsked: boolean;
  askRoutingAdvanced: () => void;
  clearRoutingAdvancedAsked: () => void;
  /**
   * Per routing target (a project id, or `collab`), the group Simple mode set
   * aside, so Advanced brings back that one. Persisted per browser.
   */
  routingSetAside: Record<string, string>;
  setRoutingSetAside: (key: string, groupId: string | null) => void;
  /** Console shows raw log lines instead of the friendly log. Persisted per browser. */
  consoleRawMode: boolean;
  setConsoleRawMode: (raw: boolean) => void;
  /**
   * Simple hides most navigation for newcomers; Advanced is the full app.
   * `null` means "not chosen yet" — `useUiMode()` resolves it once the project
   * list has loaded. Persisted per browser.
   */
  uiMode: UiMode | null;
  setUiMode: (mode: UiMode) => void;
  /** Whether the guided tour may be offered. Persisted per browser. */
  tourOffers: boolean;
  setTourOffers: (on: boolean) => void;
  theme: UiTheme;
  setTheme: (theme: UiTheme) => void;
}

const initialDarkMode =
  globalThis.window !== undefined &&
  (localStorage.getItem('translator-dark-mode') === 'true' ||
    (localStorage.getItem('translator-dark-mode') === null &&
      matchMedia('(prefers-color-scheme: dark)').matches));

export const useUiSettings = create<UiSettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => {
        void (async () => {
          await loadLocale(language);
          await i18n.changeLanguage(language);
        })();
        set({ language });
      },
      darkMode: initialDarkMode,
      setDarkMode: (dark) => {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', dark);
        }
        if (typeof globalThis.window !== 'undefined') {
          localStorage.setItem('translator-dark-mode', String(dark));
        }
        set({ darkMode: dark });
      },
      projectIcons: {},
      setProjectIcon: (id, icon) =>
        set((s) => ({ projectIcons: { ...s.projectIcons, [id]: icon } })),
      consoleFilter: 'all',
      setConsoleFilter: (consoleFilter) => set({ consoleFilter }),
      consoleFriendlyFilter: 'info',
      setConsoleFriendlyFilter: (consoleFriendlyFilter) => set({ consoleFriendlyFilter }),
      routingAdvanced: false,
      setRoutingAdvanced: (routingAdvanced) => set({ routingAdvanced }),
      routingAdvancedAsked: false,
      askRoutingAdvanced: () => set({ routingAdvanced: true, routingAdvancedAsked: true }),
      clearRoutingAdvancedAsked: () => set({ routingAdvancedAsked: false }),
      routingSetAside: {},
      setRoutingSetAside: (key, groupId) =>
        set((s) => {
          const next = { ...s.routingSetAside };
          if (groupId === null) delete next[key];
          else next[key] = groupId;
          return { routingSetAside: next };
        }),
      consoleRawMode: false,
      setConsoleRawMode: (consoleRawMode) => set({ consoleRawMode }),
      uiMode: null,
      setUiMode: (uiMode) => set({ uiMode }),
      tourOffers: true,
      setTourOffers: (tourOffers) => set({ tourOffers }),
      theme: readStoredTheme(),
      setTheme: (theme) => {
        if (globalThis.window !== undefined) {
          localStorage.setItem(THEME_STORAGE_KEY, theme);
        }
        void activateTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'translator-ui-settings',
      partialize: (state) => ({
        language: state.language,
        projectIcons: state.projectIcons,
        consoleFilter: state.consoleFilter,
        consoleFriendlyFilter: state.consoleFriendlyFilter,
        routingAdvanced: state.routingAdvanced,
        routingSetAside: state.routingSetAside,
        consoleRawMode: state.consoleRawMode,
        uiMode: state.uiMode,
        tourOffers: state.tourOffers,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.language && state.language !== 'en') {
          void (async () => {
            await loadLocale(state.language);
            await i18n.changeLanguage(state.language);
          })();
        }
      },
    },
  ),
);
