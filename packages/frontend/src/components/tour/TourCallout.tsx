import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { MAJOR_STEP_COUNT, type TourStep } from '@/lib/tour/types';

interface TourCalloutProps {
  step: TourStep;
  titleId: string;
  showBack: boolean;
  showNext: boolean;
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
}

/** The callout's content: what to do, why, and the buttons. The wrapper supplies the dialog role. */
export function TourCallout({
  step,
  titleId,
  showBack,
  showNext,
  onNext,
  onBack,
  onExit,
}: TourCalloutProps) {
  const { t } = useTranslation('guide-tour');
  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {step.major !== undefined && (
            <span data-testid="tour-step-of" className="text-xs text-muted-foreground">
              {t('stepOf', { current: step.major, total: MAJOR_STEP_COUNT })}
            </span>
          )}
          <h2 id={titleId} className="text-sm font-semibold">
            {t(step.titleKey)}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('close')}
          data-testid="tour-close"
          onClick={onExit}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <p className="text-sm">{t(step.whatKey)}</p>
      <p className="text-sm text-muted-foreground">{t(step.whyKey)}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" data-testid="tour-skip" onClick={onExit}>
          {t('skip')}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {step.actions?.map((a) => (
            <Button
              key={a.testId}
              variant="outline"
              size="sm"
              data-testid={a.testId}
              onClick={a.run}
            >
              {t(a.labelKey)}
            </Button>
          ))}
          {showBack && (
            <Button variant="outline" size="sm" data-testid="tour-back" onClick={onBack}>
              {t('back')}
            </Button>
          )}
          {showNext && (
            <Button size="sm" data-testid="tour-next" onClick={onNext}>
              {t('next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
