/**
 * Theme registry — single owner of theme ids, metadata, and lazy asset
 * loading. A theme is a data-theme attribute on <html> plus one CSS file of
 * token overrides and (pixel/techno) fontsource fonts, all dynamically
 * imported so default-theme users download nothing extra. State/persistence
 * lives in ui-settings-store; index.html sets the attribute pre-paint and
 * main.tsx awaits activateTheme() before mounting to avoid FOUC.
 */
export const THEME_IDS = ['default', 'pixel', 'techno', 'minimal'] as const;
export type UiTheme = (typeof THEME_IDS)[number];

export const THEME_STORAGE_KEY = 'translator-ui-theme';

export function isUiTheme(v: unknown): v is UiTheme {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
}

/** Stored theme choice; anything missing/unknown degrades to 'default'. */
export function readStoredTheme(): UiTheme {
  if (globalThis.window === undefined) return 'default';
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return isUiTheme(raw) ? raw : 'default';
}

/** Palette chips for the Settings picker cards: bg, card, primary, accent, fg. */
export const THEMES: ReadonlyArray<{
  id: UiTheme;
  preview: { light: string[]; dark: string[] };
}> = [
  {
    id: 'default',
    preview: {
      light: [
        'oklch(0.97 0.005 265)',
        'oklch(0.99 0.004 265)',
        'oklch(0.55 0.22 270)',
        'oklch(0.93 0.03 270)',
        'oklch(0.15 0.02 265)',
      ],
      dark: [
        'oklch(0.13 0.01 265)',
        'oklch(0.18 0.01 265)',
        'oklch(0.7 0.18 270)',
        'oklch(0.28 0.05 270)',
        'oklch(0.96 0.005 265)',
      ],
    },
  },
  {
    id: 'pixel',
    preview: {
      light: [
        'oklch(0.96 0.02 95)',
        'oklch(0.99 0.01 95)',
        'oklch(0.5 0.19 250)',
        'oklch(0.85 0.14 95)',
        'oklch(0.22 0.03 60)',
      ],
      dark: [
        'oklch(0.17 0.02 280)',
        'oklch(0.22 0.025 280)',
        'oklch(0.75 0.19 145)',
        'oklch(0.32 0.06 320)',
        'oklch(0.95 0.02 95)',
      ],
    },
  },
  {
    id: 'techno',
    preview: {
      light: [
        'oklch(0.955 0.015 210)',
        'oklch(0.99 0.006 210)',
        'oklch(0.45 0.16 215)',
        'oklch(0.89 0.07 330)',
        'oklch(0.18 0.04 260)',
      ],
      dark: [
        'oklch(0.13 0.02 260)',
        'oklch(0.17 0.025 260)',
        'oklch(0.8 0.14 195)',
        'oklch(0.3 0.08 330)',
        'oklch(0.93 0.02 200)',
      ],
    },
  },
  {
    id: 'minimal',
    preview: {
      light: [
        'oklch(0.99 0 0)',
        'oklch(1 0 0)',
        'oklch(0.22 0 0)',
        'oklch(0.94 0 0)',
        'oklch(0.18 0 0)',
      ],
      dark: [
        'oklch(0.14 0 0)',
        'oklch(0.18 0 0)',
        'oklch(0.95 0 0)',
        'oklch(0.27 0 0)',
        'oklch(0.95 0 0)',
      ],
    },
  },
];

const loaders: Record<UiTheme, () => Promise<unknown>> = {
  default: () => Promise.resolve(),
  pixel: () =>
    Promise.all([
      import('./pixel.css'),
      import('@fontsource/silkscreen/400.css'),
      import('@fontsource/silkscreen/700.css'),
      import('@fontsource/press-start-2p/400.css'),
    ]),
  techno: () =>
    Promise.all([
      import('./techno.css'),
      import('@fontsource/chakra-petch/500.css'),
      import('@fontsource/chakra-petch/600.css'),
      import('@fontsource/orbitron/500.css'),
      import('@fontsource/orbitron/700.css'),
    ]),
  minimal: () => import('./minimal.css'),
};

const loaded = new Set<UiTheme>(['default']);

/** Idempotently loads a theme's CSS + fonts. Safe to call repeatedly. */
export async function ensureThemeAssets(theme: UiTheme): Promise<void> {
  if (loaded.has(theme)) return;
  await loaders[theme]();
  loaded.add(theme);
}

/** Sets or clears the data-theme attribute on <html>. */
export function applyThemeAttribute(theme: UiTheme): void {
  if (typeof document === 'undefined') return;
  if (theme === 'default') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

/** Assets first, then attribute — switching never shows an unstyled theme. */
export async function activateTheme(theme: UiTheme): Promise<void> {
  await ensureThemeAssets(theme);
  applyThemeAttribute(theme);
}
