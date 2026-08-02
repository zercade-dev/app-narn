/**
 * Shared refresh-models UI used by CopilotModelSelector and ModuleModelSelector:
 * the spinner / refresh button next to the model picker, the loading
 * placeholder shown before the first fetch resolves, and the
 * "Updated Xm ago" / error status footer.
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { relativeTime } from '@/lib/utils';

/** Re-renders the caller every 30 s so "Updated Xm ago" labels stay current. */
export function useRelativeTimeTick(cachedAt: Date | null): void {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    if (!cachedAt) return;
    const timer = setInterval(forceUpdate, 30_000);
    return () => clearInterval(timer);
  }, [cachedAt]);
}

export interface ModelRefreshControlProps {
  loading: boolean;
  /** Whether any models are already shown — switches the loading state to a bare spinner. */
  hasModels: boolean;
  cachedAt: Date | null;
  onRefresh: () => void;
  disabled?: boolean;
}

/** Spinner while a refresh is in flight over existing models; refresh button when idle. */
export function ModelRefreshControl({
  loading,
  hasModels,
  cachedAt,
  onRefresh,
  disabled,
}: Readonly<ModelRefreshControlProps>): React.JSX.Element | null {
  const { t } = useTranslation('config');

  if (loading && hasModels) {
    return (
      <Loader2
        className="h-4 w-4 animate-spin text-muted-foreground"
        aria-label={t('models.loadingAria')}
      />
    );
  }
  if (!loading) {
    const refreshTitle = cachedAt
      ? t('models.refreshUpdated', { time: relativeTime(cachedAt) })
      : t('models.refresh');
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={onRefresh}
        disabled={disabled}
        title={refreshTitle}
        aria-label={refreshTitle}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    );
  }
  return null;
}

/** Placeholder box shown in place of the model picker while the first fetch is in flight. */
export function ModelsLoadingPlaceholder(): React.JSX.Element {
  const { t } = useTranslation('config');
  return (
    <div
      className="flex h-9 w-full items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground"
      aria-label={t('models.loadingAria')}
    >
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      {t('models.loading')}
    </div>
  );
}

export interface ModelsStatusFooterProps {
  loading: boolean;
  cachedAt: Date | null;
  error: string | null;
  errorTestId?: string;
}

/** "Updated Xm ago" line plus the fetch error line, hidden while loading. */
export function ModelsStatusFooter({
  loading,
  cachedAt,
  error,
  errorTestId,
}: Readonly<ModelsStatusFooterProps>): React.JSX.Element | null {
  const { t } = useTranslation('config');
  if (loading) return null;
  return (
    <>
      {cachedAt && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('models.updated', { time: relativeTime(cachedAt) })}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert" data-testid={errorTestId}>
          {error}
        </p>
      )}
    </>
  );
}
