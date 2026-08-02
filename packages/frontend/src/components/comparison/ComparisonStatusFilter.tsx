/**
 * Compare tab's combined status-filter dropdown: one trigger + popover
 * replacing the three inline checkboxes formerly in ComparisonToolbar, plus a
 * fourth "empty context" filter. Modeled on StringTableFilters.tsx's status
 * dropdown but kept Compare-local (not a shared component).
 *
 * Uses the shared `Popover` primitive (base-ui, portaled) rather than an
 * absolutely-positioned sibling `<div>`: the Compare grid has its own sticky
 * header/columns at z-30 (see ComparisonGrid.tsx), so a same-stacking-context
 * panel could paint BELOW them regardless of its own z-index. Portaling
 * escapes the toolbar's stacking context entirely.
 */
import { useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ComparisonStatusFilterProps {
  readonly untranslatedOnly: boolean;
  readonly onUntranslatedOnlyChange: (value: boolean) => void;
  readonly lqaFilter: boolean;
  readonly onLqaFilterChange: (value: boolean) => void;
  readonly needsReviewFilter: boolean;
  readonly onNeedsReviewFilterChange: (value: boolean) => void;
  readonly emptyContextOnly: boolean;
  readonly onEmptyContextOnlyChange: (value: boolean) => void;
}

export function ComparisonStatusFilter({
  untranslatedOnly,
  onUntranslatedOnlyChange,
  lqaFilter,
  onLqaFilterChange,
  needsReviewFilter,
  onNeedsReviewFilterChange,
  emptyContextOnly,
  onEmptyContextOnlyChange,
}: Readonly<ComparisonStatusFilterProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  const [open, setOpen] = useState(false);

  const activeCount = [untranslatedOnly, lqaFilter, needsReviewFilter, emptyContextOnly].filter(
    Boolean,
  ).length;

  const clearAll = () => {
    onUntranslatedOnlyChange(false);
    onLqaFilterChange(false);
    onNeedsReviewFilterChange(false);
    onEmptyContextOnlyChange(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={`flex items-center gap-1 text-xs border rounded px-2 h-7 cursor-pointer ${
              activeCount > 0
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-background hover:bg-accent'
            }`}
            data-testid="comparison-status-filter-trigger"
          >
            {t('compare.filtersTrigger')}{' '}
            <span className="text-muted-foreground">
              {activeCount === 0 ? t('compare.allStatuses') : `${activeCount} selected`}
            </span>
            <span className="ml-0.5 text-muted-foreground">▾</span>
          </button>
        }
      />

      <PopoverContent
        align="start"
        className="min-w-[220px] p-2"
        data-testid="comparison-status-filter-panel"
      >
        <label
          htmlFor="comparison-untranslated-toggle"
          className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
        >
          <Checkbox
            id="comparison-untranslated-toggle"
            data-testid="comparison-untranslated-toggle"
            checked={untranslatedOnly}
            onCheckedChange={(v) => onUntranslatedOnlyChange(v === true)}
          />
          {t('compare.untranslatedOnly')}
        </label>

        <label
          htmlFor="comparison-lqa-toggle"
          className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
        >
          <Checkbox
            id="comparison-lqa-toggle"
            data-testid="comparison-lqa-toggle"
            checked={lqaFilter}
            onCheckedChange={(v) => onLqaFilterChange(v === true)}
          />
          {t('compare.lqaFilter')}
        </label>

        <label
          htmlFor="comparison-needs-review-toggle"
          className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
        >
          <Checkbox
            id="comparison-needs-review-toggle"
            data-testid="comparison-needs-review-toggle"
            checked={needsReviewFilter}
            onCheckedChange={(v) => onNeedsReviewFilterChange(v === true)}
          />
          {t('compare.needsReviewFilter')}
        </label>

        <label
          htmlFor="comparison-empty-context-toggle"
          className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
        >
          <Checkbox
            id="comparison-empty-context-toggle"
            data-testid="comparison-empty-context-toggle"
            checked={emptyContextOnly}
            onCheckedChange={(v) => onEmptyContextOnlyChange(v === true)}
          />
          {t('compare.emptyContextFilter')}
        </label>

        {activeCount > 0 && (
          <button
            type="button"
            className="mt-0.5 w-full text-left text-[11px] text-primary hover:underline px-1 cursor-pointer"
            onClick={clearAll}
            data-testid="comparison-status-filter-clear"
          >
            {t('compare.clearFilters')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
