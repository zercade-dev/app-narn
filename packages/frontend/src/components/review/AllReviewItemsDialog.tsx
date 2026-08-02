import { useTranslation } from 'react-i18next';
import { Check, CheckCheck, ListChecks, Loader2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LanguageBadgeLabel } from './LanguageBadgeLabel.js';
import { AllReviewItemRow } from './AllReviewItemRow.js';
import { RevealList } from './review-shared.js';
import { itemKey, type ReviewItem } from './review-tab-types.js';

/**
 * Scrollable overview of every pending item in the language under review —
 * source text beside its current translation — with a single Approve-all action
 * in the footer. A read-only quick view that complements the one-at-a-time card;
 * per-item approve/edit still happen in the main queue.
 */
export function AllReviewItemsDialog({
  open,
  onOpenChange,
  items,
  language,
  approvingAll,
  onApproveAll,
  unchangedPassingCount,
  onApproveUnchangedPassing,
  onOpenDetails,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ReviewItem[];
  language: string | null;
  approvingAll: boolean;
  onApproveAll: () => void;
  /** How many of `items` are unchanged-&-passing (eligible for the stricter approve). */
  unchangedPassingCount: number;
  /** Approve only the unchanged-&-passing subset of `items`. */
  onApproveUnchangedPassing: () => void;
  /** Focus the item at this queue index in the main reviewer (closes the dialog). */
  onOpenDetails: (queueIndex: number) => void;
}>) {
  const { t } = useTranslation('review');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid="review-all-items-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-4" aria-hidden />
            {t('allItemsTitle')}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            {t('allItemsCount', { count: items.length })}
            {language && (
              <Badge variant="secondary">
                <LanguageBadgeLabel code={language} />
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* Approve only the items the run left unchanged and the AI judge passed
              cleanly. Disabled (with a hint) when none qualify so the reviewer
              isn't left guessing why nothing happened. */}
          <Button
            size="sm"
            variant="outline"
            onClick={onApproveUnchangedPassing}
            disabled={approvingAll || unchangedPassingCount === 0}
            title={t('approveUnchangedPassingHint')}
            data-testid="review-approve-unchanged-passing"
          >
            {approvingAll ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckCheck className="size-4" aria-hidden />
            )}
            {t('approveUnchangedPassing')}
            <Badge variant="secondary" data-testid="review-approve-unchanged-passing-count">
              {unchangedPassingCount}
            </Badge>
          </Button>
          <Button
            size="sm"
            onClick={onApproveAll}
            disabled={approvingAll || items.length === 0}
            data-testid="review-approve-all"
          >
            {approvingAll ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            {t('approveAll')}
          </Button>
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
          <RevealList
            items={items}
            renderItem={(item, i) => (
              <AllReviewItemRow
                key={itemKey(item.entry.id, item.language)}
                item={item}
                onOpenDetails={() => onOpenDetails(i)}
              />
            )}
            showMoreTestId="review-all-items-show-more"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
