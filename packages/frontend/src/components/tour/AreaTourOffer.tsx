import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useFirstRunActive } from '../../hooks/use-guide-facts.js';
import { useUiMode } from '../../hooks/use-ui-mode.js';
import { isAreaTourId } from '../../lib/tour/area-tours.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useViewStore } from '../../stores/view-store.js';

/**
 * A small, non-modal card offering a short tour of the area that just opened.
 * Only in Advanced, with tour offers on, for a tour that was neither finished
 * nor declined, and never while another tour (or the guided first run) is on
 * screen. Declining is remembered, so the offer never returns on its own.
 */
export function AreaTourOffer() {
  const { t } = useTranslation('guide-tour');
  const advanced = useUiMode() === 'advanced';
  const tourOffers = useUiSettings((s) => s.tourOffers);
  const inProject = useViewStore((s) => s.view === 'project');
  const tab = useViewStore((s) => s.activeTab);
  const hasProject = useProjectStore((s) => s.activeProjectId !== null);
  const firstRunActive = useFirstRunActive();
  const taken = useGuideStore(
    (s) =>
      s.activeTourId !== null || s.completedTours.includes(tab) || s.declinedTours.includes(tab),
  );

  if (!advanced || !tourOffers || !inProject || !hasProject || firstRunActive || taken) return null;
  if (!isAreaTourId(tab)) return null;

  return (
    <section
      aria-labelledby="area-tour-offer-title"
      data-testid="area-tour-offer"
      className="fixed right-4 bottom-4 z-30 w-[min(20rem,calc(100vw-2rem))] space-y-2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md"
    >
      <h2 id="area-tour-offer-title" className="text-sm font-medium">
        {t(`area.${tab}.offer.title`)}
      </h2>
      <p className="text-sm text-muted-foreground">{t(`area.${tab}.offer.body`)}</p>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          data-testid="area-tour-decline"
          onClick={() => useGuideStore.getState().declineTour(tab)}
        >
          {t('offer.decline')}
        </Button>
        <Button
          size="sm"
          data-testid="area-tour-start"
          onClick={() => useGuideStore.getState().startTour(tab)}
        >
          {t('offer.start')}
        </Button>
      </div>
    </section>
  );
}
