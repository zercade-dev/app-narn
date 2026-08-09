import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useViewStore } from '../../stores/view-store.js';

/** Guide topic this help affordance links to (see `guides-registry.ts`). */
export const PSEUDO_TEST_GUIDE_SLUG = 'usage-pseudo-test';

/**
 * "What is Pseudo Test?" affordance for the Data tab's target-language list.
 * `pseudo-test` is a synthetic QA language sitting among real ones, and nothing
 * on screen said what it was for (app-narn#54) — hovering explains it, clicking
 * opens the Guide on the Pseudo Test topic.
 *
 * Rendered as a sibling of the row's `<label>`, never inside it: a nested
 * interactive element would be a needless bet on how base-ui's checkbox trigger
 * treats a click that the label would otherwise forward to it.
 */
export function PseudoTestHelp() {
  const { t } = useTranslation('config');
  const openGuide = useViewStore((s) => s.openGuide);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={t('pseudoTestHelpAria')}
            data-testid="pseudo-test-help"
            className="inline-flex shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => openGuide(PSEUDO_TEST_GUIDE_SLUG)}
          />
        }
      >
        <Info className="h-3.5 w-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs flex-col items-start gap-1 text-left">
        <span>{t('pseudoTestHelpBody')}</span>
        <span className="font-medium">{t('pseudoTestHelpLink')}</span>
      </TooltipContent>
    </Tooltip>
  );
}
