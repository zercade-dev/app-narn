import { useTranslation } from 'react-i18next';
import { Monitor } from 'lucide-react';

/**
 * Rendered on mobile viewports in place of any desktop-only view or tab
 * (lib/mobile-gating.ts). Purely presentational.
 */
export function DesktopOnlyNotice() {
  const { t } = useTranslation('strings');
  return (
    <div
      data-testid="desktop-only-notice"
      className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center"
    >
      <Monitor className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{t('mobile.desktopOnlyTitle')}</p>
      <p className="text-sm text-muted-foreground">{t('mobile.desktopOnlyBody')}</p>
    </div>
  );
}
