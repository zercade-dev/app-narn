/**
 * Settings workspace view — appearance (theme picker + light/dark) and UI
 * language, relocated from the sidebar footer. Theme choice is device-local
 * (localStorage), like dark mode.
 */
import { useTranslation } from 'react-i18next';
import {
  Moon,
  Sun,
  Pencil,
  Undo2,
  CheckCircle2,
  Trash2,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PixelIcon } from '@/components/ui/pixel-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUiSettings, type UiLanguage } from '../../stores/ui-settings-store.js';
import { UI_LANGS } from '../../lib/url-state.js';
import { THEMES } from '../../themes/theme-registry.js';

/**
 * Each language named in its own language, never translated — a reader looking
 * for their language scans for the word they know, which is the same word in
 * every UI language. The exhaustive `Record` means adding a code to
 * `UiLanguage` fails the build until its label exists.
 */
export const UI_LANGUAGE_LABELS: Record<UiLanguage, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  ja: '日本語',
  ru: 'Русский',
  tr: 'Türkçe',
};

export function SettingsView() {
  const { t } = useTranslation('settings');
  const language = useUiSettings((s) => s.language);
  const setLanguage = useUiSettings((s) => s.setLanguage);
  const darkMode = useUiSettings((s) => s.darkMode);
  const setDarkMode = useUiSettings((s) => s.setDarkMode);
  const theme = useUiSettings((s) => s.theme);
  const setTheme = useUiSettings((s) => s.setTheme);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8" data-testid="settings-view">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('languageTitle')}</CardTitle>
          <CardDescription>{t('languageDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={language}
            onValueChange={(v) => {
              if (v) setLanguage(v as UiLanguage);
            }}
          >
            <SelectTrigger className="w-56" data-testid="ui-language-select">
              <SelectValue>
                {(v: string | null) => (v ? (UI_LANGUAGE_LABELS[v as UiLanguage] ?? v) : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/*
                Rendered from UI_LANGS rather than hand-listed: a hardcoded list
                here is a second source of truth that can silently disagree with
                the union, which is how a shipped locale can exist everywhere
                except the one control that switches to it.
              */}
              {UI_LANGS.map((code) => (
                <SelectItem key={code} value={code}>
                  {UI_LANGUAGE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('appearance')}</CardTitle>
          <CardDescription>{t('appearanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <span className="text-sm font-medium">{t('theme')}</span>
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              role="radiogroup"
              aria-label={t('theme')}
            >
              {THEMES.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === meta.id}
                  data-testid={`theme-option-${meta.id}`}
                  onClick={() => setTheme(meta.id)}
                  className={`flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    theme === meta.id ? 'border-primary ring-2 ring-ring' : ''
                  }`}
                >
                  <span className="flex gap-1">
                    {(darkMode ? meta.preview.dark : meta.preview.light).map((color, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className="size-4 rounded-full border"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="font-medium">{t(`themes.${meta.id}.name`)}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`themes.${meta.id}.description`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t('mode')}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? t('switchToLight') : t('switchToDark')}
              data-testid="dark-mode-toggle"
            >
              {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {darkMode ? t('switchToLight') : t('switchToDark')}
            </Button>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{t('preview')}</span>
            <p className="text-xs text-muted-foreground">{t('previewHint')}</p>
            <div data-testid="theme-preview" className="space-y-4 rounded-lg border p-4">
              <h3 className="text-lg">{t('previewSamples.heading')}</h3>
              <p className="text-sm">
                {t('previewSamples.body')}{' '}
                <span className="text-muted-foreground">{t('previewSamples.muted')}</span>
              </p>

              <div className="flex flex-wrap gap-2">
                <Button size="sm">{t('previewSamples.save')}</Button>
                <Button size="sm" variant="secondary">
                  {t('previewSamples.cancel')}
                </Button>
                <Button size="sm" variant="outline">
                  {t('previewSamples.edit')}
                </Button>
                <Button size="sm" variant="destructive">
                  {t('previewSamples.delete')}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder={t('previewSamples.inputPlaceholder')}
                  className="max-w-56"
                  data-testid="theme-preview-input"
                />
                <Select defaultValue="a">
                  <SelectTrigger className="w-44" data-testid="theme-preview-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">{t('previewSamples.selectOptionA')}</SelectItem>
                    <SelectItem value="b">{t('previewSamples.selectOptionB')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Label className="gap-2">
                  <Checkbox data-testid="theme-preview-checkbox" />
                  {t('previewSamples.checkbox')}
                </Label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge>{t('previewSamples.badgeDefault')}</Badge>
                <Badge variant="secondary">{t('previewSamples.badgeSecondary')}</Badge>
                <Badge variant="outline">{t('previewSamples.badgeOutline')}</Badge>
                <Badge variant="destructive">{t('previewSamples.badgeDestructive')}</Badge>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded bg-status-pass/15 px-1.5 py-0.5 text-xs font-medium text-status-pass">
                  {t('previewSamples.pass')}
                </span>
                <span className="rounded bg-status-warn/15 px-1.5 py-0.5 text-xs font-medium text-status-warn">
                  {t('previewSamples.warn')}
                </span>
                <span className="rounded bg-status-fail/15 px-1.5 py-0.5 text-xs font-medium text-status-fail">
                  {t('previewSamples.fail')}
                </span>
                <span className="rounded bg-status-info/15 px-1.5 py-0.5 text-xs font-medium text-status-info">
                  {t('previewSamples.info')}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t('previewSamples.iconsLabel')}
                </span>
                <div
                  className="flex flex-wrap items-center gap-3"
                  data-testid="theme-preview-icons"
                >
                  <PixelIcon name="pencil" fallback={Pencil} className="size-4" />
                  <PixelIcon name="undo-2" fallback={Undo2} className="size-4" />
                  <PixelIcon name="check-circle-2" fallback={CheckCircle2} className="size-4" />
                  <PixelIcon name="trash-2" fallback={Trash2} className="size-4" />
                  <PixelIcon name="refresh-cw" fallback={RefreshCw} className="size-4" />
                  <PixelIcon name="alert-triangle" fallback={AlertTriangle} className="size-4" />
                  <PixelIcon name="x" fallback={X} className="size-4" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t('previewSamples.scrollHint')}
                </span>
                <div
                  className="h-20 overflow-auto rounded border p-2 text-xs"
                  data-testid="theme-preview-scroll"
                >
                  <div className="h-40 w-[150%]">{t('previewSamples.body')}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
