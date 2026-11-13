import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useGuideFacts } from '../../hooks/use-guide-facts.js';
import { useUiMode } from '../../hooks/use-ui-mode.js';
import { toast } from '../../lib/toast.js';
import { listedTours, type CatalogTour } from '../../lib/tour/catalog.js';
import { FIRST_RUN_TOUR_ID, firstRunMajor } from '../../lib/tour/first-run.js';
import { tourPosition } from '../../lib/tour/position.js';
import { MAJOR_STEP_COUNT } from '../../lib/tour/types.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { accessFor, useProjectStore } from '../../stores/project-store.js';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { useViewStore } from '../../stores/view-store.js';

/** What one row shows: how far the person got, and whether they can pick up there. */
interface RowState {
  current: number;
  total: number;
  completed: boolean;
  /** Counted step index "Continue" opens at; null hides it. */
  continueAt: number | null;
}

/**
 * The tours the person can start on demand (the Guide's left column): one row
 * per catalog tour they can open, with its progress, "Start from the
 * beginning" and, when they stopped part way, "Continue where I left off".
 * A tour of a project area needs an open project; one that runs in Advanced
 * switches there first and says so. Restarting the first run from Advanced
 * asks whether to switch to Simple for it.
 */
export function GuideToursList() {
  const { t } = useTranslation('guide-tour');
  const mode = useUiMode();
  const advanced = mode === 'advanced';
  const facts = useGuideFacts();
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);
  const activeProjectId = useProjectStore((s) =>
    s.projects.some((p) => p.id === s.activeProjectId) ? s.activeProjectId : null,
  );
  const access = useProjectStore((s) => accessFor(s, activeProjectId));
  const tourProgress = useGuideStore((s) => s.tourProgress);
  const firstRunDismissed = useGuideStore((s) => s.firstRunDismissed);
  const firstRunFinished = useGuideStore((s) => s.firstRunFinished);
  const [confirming, setConfirming] = useState(false);

  const tours = useMemo(() => listedTours(access, cloudManaged), [access, cloudManaged]);

  const rowState = (entry: CatalogTour): RowState => {
    if (entry.id === FIRST_RUN_TOUR_ID) {
      return {
        current: firstRunMajor(facts),
        total: MAJOR_STEP_COUNT,
        completed: firstRunFinished,
        // Its own resume: the guide comes back where the app says it is.
        continueAt: firstRunDismissed && !firstRunFinished ? 0 : null,
      };
    }
    const tour = entry.build({ facts, access, cloudManaged });
    const total = tourPosition(tour, 0).total;
    const saved = tourProgress[entry.id];
    const completed = saved?.completed ?? false;
    const last = saved?.last ?? 0;
    return {
      current: saved ? Math.min(saved.furthest + 1, total) : 0,
      total,
      completed,
      continueAt: !completed && last > 0 && last < total - 1 ? last : null,
    };
  };

  const startFirstRun = (switchToSimple: boolean) => {
    setConfirming(false);
    if (switchToSimple) useUiSettings.getState().setUiMode('simple');
    // Staying in Advanced still runs it: the restart is explicit.
    useGuideStore.getState().restartFirstRun(!switchToSimple && advanced);
    useViewStore.getState().setView('project');
  };

  const start = (entry: CatalogTour, at?: number) => {
    if (entry.id === FIRST_RUN_TOUR_ID) {
      if (at !== undefined) {
        useGuideStore.getState().resumeFirstRun();
        useViewStore.getState().setView('project');
      } else if (advanced) setConfirming(true);
      else startFirstRun(false);
      return;
    }
    if (entry.needsAdvanced && !advanced) {
      useUiSettings.getState().setUiMode('advanced');
      toast.info(t('guideTours.switchedToAdvanced'));
    }
    // Land on the tour's tab, so a tour continued part way opens where it applies.
    if (entry.tab) useViewStore.getState().setActiveTab(entry.tab);
    useGuideStore.getState().startTour(entry.id, at === undefined ? undefined : { at });
  };

  return (
    <div data-testid="guide-tours">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('guideTours.title')}
      </p>
      <ul className="space-y-2">
        {tours.map((entry) => {
          const { id } = entry;
          const row = rowState(entry);
          const blocked = entry.needsProject && activeProjectId === null;
          return (
            <li key={id} data-testid={`guide-tour-${id}`} className="rounded-md border p-2">
              <p className="text-sm font-medium">{t(`guideTours.${id}.name`)}</p>
              <p className="text-xs text-muted-foreground">{t(`guideTours.${id}.summary`)}</p>
              <p
                data-testid={`guide-tour-progress-${id}`}
                data-completed={row.completed ? '' : undefined}
                className={
                  row.completed
                    ? 'mt-1 flex items-center gap-1 text-xs font-medium text-status-pass'
                    : 'mt-1 text-xs text-muted-foreground'
                }
              >
                {row.completed ? (
                  <>
                    <Check className="size-3.5 shrink-0" aria-hidden />
                    {t('guideTours.completed')}
                  </>
                ) : (
                  t('guideTours.progress', { current: row.current, total: row.total })
                )}
              </p>
              {blocked && (
                <p className="mt-1 text-xs text-muted-foreground">{t('guideTours.needsProject')}</p>
              )}
              <div className="mt-1.5 flex flex-col gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto min-h-7 w-full justify-start whitespace-normal py-1 text-left text-xs"
                  data-testid={`guide-tour-start-${id}`}
                  disabled={blocked}
                  onClick={() => start(entry)}
                >
                  {t('guideTours.startOver')}
                </Button>
                {row.continueAt !== null && !blocked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-7 w-full justify-start whitespace-normal py-1 text-left text-xs"
                    data-testid={`guide-tour-continue-${id}`}
                    onClick={() => start(entry, row.continueAt ?? 0)}
                  >
                    {t('guideTours.continue')}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Separator className="mt-3" />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent showCloseButton={false} data-testid="guide-first-run-confirm">
          <DialogHeader>
            <DialogTitle>{t('guideTours.confirm.title')}</DialogTitle>
            <DialogDescription>{t('guideTours.confirm.body')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              data-testid="guide-first-run-stay"
              onClick={() => startFirstRun(false)}
            >
              {t('guideTours.confirm.stay')}
            </Button>
            <Button data-testid="guide-first-run-switch" onClick={() => startFirstRun(true)}>
              {t('guideTours.confirm.switch')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
