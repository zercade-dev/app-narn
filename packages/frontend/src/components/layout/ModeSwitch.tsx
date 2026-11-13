import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useUiMode } from '../../hooks/use-ui-mode.js';

/** Segmented Simple / Advanced switch. Shared by the app header and Settings. */
export function ModeSwitch({ testId = 'mode-switch' }: { testId?: string }) {
  const { t } = useTranslation('settings');
  const mode = useUiMode();
  const setUiMode = useUiSettings((s) => s.setUiMode);
  return (
    <div
      className="ml-auto flex items-center gap-1"
      role="group"
      aria-label={t('uiModeLabel')}
      data-testid={testId}
    >
      <Button
        size="sm"
        variant={mode === 'simple' ? 'default' : 'outline'}
        aria-pressed={mode === 'simple'}
        onClick={() => setUiMode('simple')}
        data-testid={`${testId}-simple`}
      >
        {t('uiModeSimple')}
      </Button>
      <Button
        size="sm"
        variant={mode === 'advanced' ? 'default' : 'outline'}
        aria-pressed={mode === 'advanced'}
        onClick={() => setUiMode('advanced')}
        data-testid={`${testId}-advanced`}
      >
        {t('uiModeAdvanced')}
      </Button>
    </div>
  );
}
