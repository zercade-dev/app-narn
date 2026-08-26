/**
 * The "you have no routing rule for this language" dialog, shared by every
 * surface that can start a translation run.
 *
 * The server refuses such a run up front (400 with `code: 'no-route'`) rather
 * than queuing one that could only fail, so the only thing left to do on the
 * client is turn that refusal into something actionable instead of a generic
 * error toast. `handle` is deliberately a predicate: it consumes ONLY the
 * no-route refusal and leaves every other error on its existing toast path.
 */
import { useCallback, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ApiError } from './use-api.js';
import { languageName } from '../lib/log-presentation/registry.js';
import { useViewStore } from '../stores/view-store.js';

/**
 * The language codes carried by a no-route refusal, or null when `err` is
 * anything else. Exported for tests and for callers that want the codes
 * without the dialog.
 */
export function noRouteLanguages(err: unknown): string[] | null {
  if (!(err instanceof ApiError) || err.status !== 400) return null;
  const data = err.data;
  if (typeof data !== 'object' || data === null) return null;
  const { code, unroutableLanguages } = data as {
    code?: unknown;
    unroutableLanguages?: unknown;
  };
  if (code !== 'no-route' || !Array.isArray(unroutableLanguages)) return null;
  const codes = unroutableLanguages.filter((l): l is string => typeof l === 'string');
  return codes.length > 0 ? codes : null;
}

export interface NoRouteDialog {
  /**
   * Returns true when the error was a no-route refusal and the dialog has taken
   * it; the caller should then skip its own error handling.
   */
  handle: (err: unknown) => boolean;
  /** Render once in the calling component's tree. */
  dialog: JSX.Element;
}

export function useNoRouteDialog(): NoRouteDialog {
  const { t } = useTranslation(['errors', 'logs', 'common']);
  const [languages, setLanguages] = useState<string[] | null>(null);
  const setActiveTab = useViewStore((s) => s.setActiveTab);

  const handle = useCallback((err: unknown): boolean => {
    const codes = noRouteLanguages(err);
    if (!codes) return false;
    setLanguages(codes);
    return true;
  }, []);

  const dialog = (
    <ConfirmSheet
      open={languages !== null}
      onOpenChange={(next) => {
        if (!next) setLanguages(null);
      }}
      side="bottom"
      contentClassName="max-w-lg mx-auto rounded-t-xl"
      title={t('errors:noRoute.title')}
      description={t('errors:noRoute.body', {
        languages: (languages ?? []).map(languageName).join(', '),
        count: languages?.length ?? 0,
      })}
      confirmVariant="default"
      confirmLabel={t('logs:action.openRouting')}
      confirmTestId="no-route-open-routing"
      cancelLabel={t('common:cancel')}
      cancelTestId="no-route-cancel"
      onConfirm={() => {
        setLanguages(null);
        setActiveTab('routing');
      }}
    />
  );

  return { handle, dialog };
}
