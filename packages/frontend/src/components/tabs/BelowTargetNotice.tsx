import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunStatus } from '@zercade-dev/narn-shared';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '@/lib/toast';

export function BelowTargetNotice({
  run,
  onAccept,
}: Readonly<{
  run: RunStatus;
  onAccept: () => Promise<void>;
}>) {
  const { t } = useTranslation('strings');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const waiting = run.waitingForQuota;
  const target = waiting?.belowTarget;
  if (!waiting || !target) return null;

  const count = target.strings ?? waiting.pairCount ?? waiting.pairs?.length ?? 0;
  const languages = target.languages.join(', ');
  const model = t('runs.belowTargetModel', {
    model: target.bestModelId,
    best: target.bestTier,
    needed: target.neededTier,
  });

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAccept();
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="space-y-2 rounded-md border border-status-warn/30 bg-status-warn/5 p-3 text-sm"
      data-testid="run-pending-feedback"
    >
      <Badge variant="secondary" className="bg-status-warn/10 text-status-warn">
        {t('runs.belowTargetLabel')}
      </Badge>
      <div className="space-y-1 text-muted-foreground">
        <p>{t('runs.belowTargetExplanation')}</p>
        <p>{t('runs.belowTargetAffected', { count, languages })}</p>
        <p>{model}</p>
        <p>
          {target.resumeAt === null
            ? t('runs.belowTargetNoEstimate')
            : t('runs.belowTargetResumeAt', { time: new Date(target.resumeAt).toLocaleString() })}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        data-testid="below-target-continue"
      >
        {t('runs.belowTargetContinue')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="below-target-dialog">
          <DialogHeader>
            <DialogTitle>{t('runs.belowTargetDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('runs.belowTargetDialogBody', { count, languages })}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{model}</p>
          <p className="text-sm text-muted-foreground">{t('runs.belowTargetMarked')}</p>
          <p className="text-sm text-muted-foreground">{t('runs.belowTargetRestOfRun')}</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              data-testid="below-target-keep-waiting"
            >
              {t('runs.belowTargetKeepWaiting')}
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={submitting}
              data-testid="below-target-confirm"
            >
              {t('runs.belowTargetConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
