import { toast } from '@/lib/toast';
import { useGuideStore } from '@/stores/guide-store';
import { recoverPracticeOrphan } from './orphan-sim.js';

/**
 * Ends the Orphans tour (not completed), minding a practice orphan still out.
 * `putBack`: the tour ends because the person can no longer reach the Orphans
 * tab (a switch to Simple), so the entry is put back now, or else it would
 * stay missing from the strings, the translations and the exports; the toast
 * says it is back, or, only if that failed, where it still is. Without
 * `putBack` (the person left the tour) it stays out, and the toast says where
 * to put it back; the tour resumes there next time.
 */
export function endOrphansTour(
  t: (key: string) => string,
  { putBack }: { putBack: boolean },
): void {
  const store = useGuideStore.getState();
  const out = store.orphanSim !== null;
  store.endTour(false);
  if (!out) return;
  if (!putBack) {
    toast.info(t('orphansTour.notices.leftOut'));
    return;
  }
  recoverPracticeOrphan().then(
    () => toast.success(t('orphansTour.banner.recovered')),
    () => toast.info(t('orphansTour.notices.leftOut')),
  );
}
