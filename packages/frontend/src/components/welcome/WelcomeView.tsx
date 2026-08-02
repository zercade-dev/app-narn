/**
 * WelcomeView — landing screen shown once per app load when the current
 * device's credential vault isn't set up yet (cloud mode's `setupRequired`).
 * Replaces the old auto-redirect straight to /vault so the user can read the
 * guides first and choose when to go set up the vault (see AppShell.tsx).
 */
import { useTranslation } from 'react-i18next';
import { GUIDE_GROUPS } from '../guide/guides-registry.js';
import { goToVaultSetup } from '../../lib/auth-redirect.js';
import { useViewStore } from '../../stores/view-store.js';
import { useIsMobile } from '../../hooks/use-mobile-viewport.js';
import { Button } from '@/components/ui/button';

export function WelcomeView() {
  const { t } = useTranslation('welcome');
  const { t: tStrings } = useTranslation('strings');
  const setView = useViewStore((s) => s.setView);
  const isMobile = useIsMobile();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6" data-testid="welcome-view">
      <div>
        <h1 className="mb-1 text-lg font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('intro')}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">{t('guidesHeading')}</h2>
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {GUIDE_GROUPS.map((group) => (
            <li key={group.titleKey}>{tStrings(group.titleKey)}</li>
          ))}
        </ul>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="welcome-browse-guides"
          onClick={() => setView('guide')}
        >
          {t('browseGuides')}
        </Button>
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-medium">{t('setupVaultHeading')}</h2>
        <p className="text-sm text-muted-foreground">{t('setupVaultBody')}</p>
        {!isMobile && (
          <Button
            type="button"
            size="sm"
            data-testid="welcome-setup-vault"
            onClick={goToVaultSetup}
          >
            {t('setupVaultButton')}
          </Button>
        )}
      </div>
    </div>
  );
}
