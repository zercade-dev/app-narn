/**
 * First-run full-page theme chooser. Shown by AppShell when
 * no theme choice is stored (cloud AND local; new and existing users). Techno
 * is pre-selected and live-previewed; Confirm persists the selection, any
 * dismissal (Esc / backdrop / "keep" link) persists techno. Either path writes
 * THEME_STORAGE_KEY, which is the never-show-again signal — no extra flag.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  THEMES,
  THEME_IDS,
  THEME_STORAGE_KEY,
  activateTheme,
  type UiTheme,
} from '../../themes/theme-registry.js';
import { useUiSettings } from '../../stores/ui-settings-store.js';

export function shouldShowThemeChooser(): boolean {
  return globalThis.window !== undefined && localStorage.getItem(THEME_STORAGE_KEY) === null;
}

export function ThemeChooserOverlay({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('welcome');
  const setTheme = useUiSettings((s) => s.setTheme);
  const darkMode = useUiSettings((s) => s.darkMode);
  const [selected, setSelected] = useState<UiTheme>('techno');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<UiTheme, HTMLButtonElement | null>>>({});

  // Radiogroup arrow-key contract: arrows move the selection (wrapping in
  // THEME_IDS order) and focus follows, live-previewing via the selection
  // effect. Roving tabindex below keeps exactly one card in the tab order.
  const moveSelection = (delta: number) => {
    const idx = THEME_IDS.indexOf(selected);
    const next = THEME_IDS[(idx + delta + THEME_IDS.length) % THEME_IDS.length]!;
    setSelected(next);
    cardRefs.current[next]?.focus();
  };

  const onRadiogroupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
    }
  };

  // aria-modal promises a focus trap: Tab/Shift+Tab cycle inside the dialog
  // instead of walking into the AppShell behind it.
  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button:not([tabindex="-1"])'),
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Live-preview the pre-selected default immediately, and each selection after.
  useEffect(() => {
    void activateTheme(selected);
  }, [selected]);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const commit = (theme: UiTheme) => {
    setTheme(theme); // persists THEME_STORAGE_KEY via the store
    onDone();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') commit('techno');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // commit is stable enough for this listener's purpose (always dismisses to 'techno').
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('themeChooser.title')}
      data-testid="theme-chooser-overlay"
      ref={dialogRef}
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6"
      onClick={() => commit('techno')}
      onKeyDown={onDialogKeyDown}
    >
      <div className="w-full max-w-3xl space-y-6" onClick={(e) => e.stopPropagation()}>
        <div>
          <h1 className="text-xl font-semibold">{t('themeChooser.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('themeChooser.intro')}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={t('themeChooser.title')}
          className="grid gap-3 sm:grid-cols-2"
          onKeyDown={onRadiogroupKeyDown}
        >
          {THEMES.map(({ id, preview }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected === id}
              tabIndex={selected === id ? 0 : -1}
              ref={(el) => {
                cardRefs.current[id] = el;
              }}
              data-theme-id={id}
              data-testid={`theme-card-${id}`}
              onClick={() => setSelected(id)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground',
                selected === id ? 'border-primary ring-2 ring-ring' : '',
              )}
            >
              <span className="mb-2 flex gap-1">
                {(darkMode ? preview.dark : preview.light).map((c, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="size-4 rounded-full border"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="block font-medium">{t(`themeChooser.names.${id}`)}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`themeChooser.taglines.${id}`)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            ref={confirmRef}
            type="button"
            data-testid="theme-chooser-confirm"
            className={cn(buttonVariants({ size: 'sm' }))}
            onClick={() => commit(selected)}
          >
            {t('themeChooser.confirm')}
          </button>
          <Button
            type="button"
            variant="link"
            size="sm"
            data-testid="theme-chooser-keep-default"
            onClick={() => commit('techno')}
          >
            {t('themeChooser.keepDefault')}
          </Button>
        </div>
      </div>
    </div>
  );
}
