import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { DiffLegend, DiffText, LqaIssueList, deriveLqaState } from './review-shared.js';
import type { ReviewItem } from './review-tab-types.js';

/**
 * One row of the View-all overview: source beside the current translation, plus
 * the same previous-version diff and LQA issues the one-at-a-time card shows
 * (each rendered only when present, to keep the dense list readable).
 */
export function AllReviewItemRow({
  item,
  onOpenDetails,
}: Readonly<{ item: ReviewItem; onOpenDetails: () => void }>) {
  const { t } = useTranslation('review');
  const { entry, language, record } = item;
  const previousVersion = record.previousVersions?.at(-1);
  const { issues: lqaIssues, showOverflow, overflowRatio } = deriveLqaState(entry, language);

  return (
    <div
      className="space-y-3 rounded-lg border border-border/60 p-3"
      data-testid={`review-all-item-${entry.id}`}
    >
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenDetails}
          data-testid={`review-all-open-${entry.id}`}
        >
          <Maximize2 className="size-4" aria-hidden />
          {t('openDetails')}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('sourceText')}
          </h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {entry.sourceText}
          </p>
        </div>
        <div>
          <h4 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('currentTranslation')}
          </h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{record.text}</p>
        </div>
      </div>

      {/* Diff vs the most recent previous version (only when one exists). */}
      {previousVersion && (
        <section data-testid={`review-all-diff-${entry.id}`}>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('diffTitle')}
            </h4>
            <DiffLegend />
          </div>
          <div className="space-y-1">
            <DiffText oldText={previousVersion.text} newText={record.text} />
            <p className="font-mono text-[11px] text-muted-foreground">
              {t('previousVersionMeta', {
                module: previousVersion.moduleId,
                date: new Date(previousVersion.timestamp).toLocaleString(),
              })}
            </p>
          </div>
        </section>
      )}

      {/* LQA issues for this language (only when there are any). */}
      <LqaIssueList
        issues={lqaIssues}
        showOverflow={showOverflow}
        overflowRatio={overflowRatio}
        headingClassName="text-[11px]"
        headingTag="h4"
        testId={`review-all-lqa-${entry.id}`}
      />
    </div>
  );
}
