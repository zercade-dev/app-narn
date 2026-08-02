/**
 * Small inline status indicator for auto-saving config panels (see
 * `useAutoSave`). Shared across panels that replaced an explicit Save button
 * with debounced auto-save, so the wording and styling stay consistent.
 */
import { useTranslation } from 'react-i18next';
import type { AutoSaveStatus as AutoSaveStatusValue } from '../../hooks/use-auto-save.js';

export function AutoSaveStatus({
  status,
  error,
}: {
  status: AutoSaveStatusValue;
  error: string | null;
}) {
  const { t } = useTranslation('config');
  if (status === 'idle') return null;
  return (
    <span
      className={`text-xs ${status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}
      data-testid="autosave-status"
    >
      {status === 'saving' && t('autoSaveSaving')}
      {status === 'saved' && t('autoSaveSaved')}
      {status === 'error' && t('autoSaveError', { message: error ?? '' })}
    </span>
  );
}
