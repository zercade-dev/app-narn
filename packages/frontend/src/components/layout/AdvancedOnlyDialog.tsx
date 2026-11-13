import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useModeGate } from '../../stores/mode-gate-store.js';

/** Offers to switch to Advanced when navigation targets an area Simple hides. Mount once. */
export function AdvancedOnlyDialog() {
  const { t } = useTranslation('sidebar');
  const { t: tStrings } = useTranslation('strings');
  const pending = useModeGate((s) => s.pending);
  const accept = useModeGate((s) => s.accept);
  const dismiss = useModeGate((s) => s.dismiss);

  let place = '';
  if (pending?.kind === 'tab') place = tStrings(`tabs.${pending.tab}`);
  else if (pending?.view === 'global-config') place = t('globalConfig');
  else if (pending?.view === 'translation-memory') place = t('translationMemory');

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent data-testid="advanced-only-dialog">
        <DialogHeader>
          <DialogTitle>{t('advancedOnlyTitle')}</DialogTitle>
          <DialogDescription>{t('advancedOnlyBody', { place })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss} data-testid="advanced-only-cancel">
            {t('advancedOnlyCancel')}
          </Button>
          <Button onClick={accept} data-testid="advanced-only-switch">
            {t('advancedOnlySwitch')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
