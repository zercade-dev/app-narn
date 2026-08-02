/**
 * The Comparison tab's top toolbar: search, target/reference language pickers,
 * status filters, run filter, display-mode toggle, bulk actions, selection
 * summary, keyboard-shortcuts help, row count and pagination controls.
 *
 * Split out of ComparisonTab.tsx as a purely presentational bar — it owns no
 * state; every value and handler is prop-drilled from the parent so effects,
 * timing and persisted-state writes stay exactly where they were.
 */
import { useTranslation } from 'react-i18next';
import { Flag, Languages, Loader2, CheckCircle2, X } from 'lucide-react';
import { LANG_NAMES, RunStatusCode } from '@zercade-dev/narn-shared';
import { Input } from '@/components/ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RunProgressBar } from '../ui/run-progress-bar';
import { RunFilterSelect } from '../string-table/RunFilterSelect.js';
import { ComparisonKeyboardShortcuts } from './ComparisonKeyboardShortcuts.js';
import { PAGE_SIZE_OPTIONS, type BulkTranslateProgress } from './comparison-tab-types.js';
import { ComparisonStatusFilter } from './ComparisonStatusFilter.js';

// base-ui Select items can't use an empty string as a value (same constraint
// RunFilterSelect works around with `__all_runs__`), but the reference
// picker's "no reference" choice is `''` in the parent's contract. Represent
// it with this sentinel inside the component and map back to `''` at the
// onValueChange boundary so callers are unaffected.
const NO_REFERENCE = '__no_reference__';

interface ComparisonToolbarProps {
  readonly search: string;
  readonly onSearchChange: (value: string) => void;
  readonly selectedLanguage: string;
  readonly onSelectedLanguageChange: (value: string) => void;
  readonly targetCandidates: string[];
  readonly referenceLanguage: string;
  readonly onReferenceLanguageChange: (value: string) => void;
  readonly referenceCandidates: string[];
  readonly untranslatedOnly: boolean;
  readonly onUntranslatedOnlyChange: (value: boolean) => void;
  readonly lqaFilter: boolean;
  readonly onLqaFilterChange: (value: boolean) => void;
  readonly needsReviewFilter: boolean;
  readonly onNeedsReviewFilterChange: (value: boolean) => void;
  readonly emptyContextOnly: boolean;
  readonly onEmptyContextOnlyChange: (value: boolean) => void;
  readonly projectId: string;
  readonly runIdFilter: string;
  readonly onRunIdFilterChange: (runId: string) => void;
  readonly mode: 'raw' | 'rich';
  readonly onModeChange: (mode: 'raw' | 'rich') => void;
  readonly targetLang: string;
  readonly rowsLength: number;
  readonly onFlagAllNeedsReview: () => void;
  readonly isFlagging: boolean;
  readonly onMarkAllReviewed: () => void;
  readonly isMarkingAllReviewed: boolean;
  readonly bulkTranslateRunId: string | null;
  readonly bulkTranslateProgress: BulkTranslateProgress | null;
  readonly onBulkTranslateCancel: () => void;
  readonly onOpenTranslateDialog: () => void;
  readonly effectiveSelectionSize: number;
  readonly onSelectAllRows: () => void;
  readonly onClearSelection: () => void;
  readonly orderMode: 'import' | 'custom';
  readonly onOrderModeChange: (patch: { orderMode: 'import' | 'custom' }) => void;
  readonly pageSize: number;
  readonly onPageSizeChange: (value: number) => void;
  readonly safePage: number;
  readonly totalPages: number;
  readonly onPrevPage: () => void;
  readonly onNextPage: () => void;
}

export function ComparisonToolbar({
  search,
  onSearchChange,
  selectedLanguage,
  onSelectedLanguageChange,
  targetCandidates,
  referenceLanguage,
  onReferenceLanguageChange,
  referenceCandidates,
  untranslatedOnly,
  onUntranslatedOnlyChange,
  lqaFilter,
  onLqaFilterChange,
  needsReviewFilter,
  onNeedsReviewFilterChange,
  emptyContextOnly,
  onEmptyContextOnlyChange,
  projectId,
  runIdFilter,
  onRunIdFilterChange,
  mode,
  onModeChange,
  targetLang,
  rowsLength,
  onFlagAllNeedsReview,
  isFlagging,
  onMarkAllReviewed,
  isMarkingAllReviewed,
  bulkTranslateRunId,
  bulkTranslateProgress,
  onBulkTranslateCancel,
  onOpenTranslateDialog,
  effectiveSelectionSize,
  onSelectAllRows,
  onClearSelection,
  orderMode,
  onOrderModeChange,
  pageSize,
  onPageSizeChange,
  safePage,
  totalPages,
  onPrevPage,
  onNextPage,
}: Readonly<ComparisonToolbarProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  const { t: tBatch } = useTranslation('batch');

  return (
    <div className="flex items-center gap-3 p-2 border-b border-border shrink-0 flex-wrap">
      <Input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('compare.searchPlaceholder')}
        aria-label={t('compare.searchPlaceholder')}
        data-testid="comparison-search"
        className="w-52 shrink-0 text-xs"
      />
      <label className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">{t('compare.target')}</span>
        <Select
          value={selectedLanguage}
          onValueChange={(value) => onSelectedLanguageChange(value ?? '')}
          disabled={targetCandidates.length === 0}
          // Base UI's SelectValue only renders a selected item's label via its
          // built-in `resolveSelectedLabel` fallback when the Root is given an
          // `items` map — without it, the fallback stringifies the raw value
          // (see @base-ui/react/select/root/SelectRoot.d.ts: "When specified,
          // <Select.Value> renders the label of the selected item instead of
          // the raw value"). A SelectValue children render function would work
          // too, but it takes unconditional precedence over `placeholder`
          // (see SelectValue.js), which is why this isn't used here.
          items={Object.fromEntries(
            targetCandidates.map((lang) => [lang, `${LANG_NAMES[lang] ?? lang} (${lang})`]),
          )}
        >
          <SelectTrigger
            size="sm"
            className="w-40 text-xs"
            data-testid="comparison-language-picker"
          >
            <SelectValue placeholder={t('compare.noTargetLanguages')} />
          </SelectTrigger>
          <SelectContent>
            {targetCandidates.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANG_NAMES[lang] ?? lang} ({lang})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">{t('compare.reference')}</span>
        <Select
          value={referenceLanguage === '' ? NO_REFERENCE : referenceLanguage}
          onValueChange={(v) => onReferenceLanguageChange(v === NO_REFERENCE ? '' : (v ?? ''))}
          // See the target picker above for why `items` (not a SelectValue
          // children function) is required for the closed trigger to show
          // the selected item's real label instead of the raw value/sentinel.
          items={{
            [NO_REFERENCE]: t('compare.noReference'),
            ...Object.fromEntries(
              referenceCandidates.map((lang) => [lang, `${LANG_NAMES[lang] ?? lang} (${lang})`]),
            ),
          }}
        >
          <SelectTrigger
            size="sm"
            className="w-40 text-xs"
            data-testid="comparison-reference-picker"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_REFERENCE}>{t('compare.noReference')}</SelectItem>
            {referenceCandidates.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANG_NAMES[lang] ?? lang} ({lang})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {/* Divider: view config vs. filters */}
      <div aria-hidden className="self-stretch w-px bg-border/70 mx-0.5" />

      <ComparisonStatusFilter
        untranslatedOnly={untranslatedOnly}
        onUntranslatedOnlyChange={onUntranslatedOnlyChange}
        lqaFilter={lqaFilter}
        onLqaFilterChange={onLqaFilterChange}
        needsReviewFilter={needsReviewFilter}
        onNeedsReviewFilterChange={onNeedsReviewFilterChange}
        emptyContextOnly={emptyContextOnly}
        onEmptyContextOnlyChange={onEmptyContextOnlyChange}
      />

      <label className="flex items-center gap-1 text-sm">
        <span className="text-muted-foreground">{t('compare.run')}</span>
        <RunFilterSelect
          projectId={projectId}
          value={runIdFilter}
          onChange={onRunIdFilterChange}
          data-testid="comparison-run-filter"
        />
      </label>

      <div
        className="flex items-center gap-1 ml-2"
        aria-label="Display mode"
        data-testid="comparison-mode-group"
      >
        <Button
          size="sm"
          variant={mode === 'raw' ? 'default' : 'outline'}
          onClick={() => onModeChange('raw')}
          data-testid="comparison-mode-raw"
          aria-pressed={mode === 'raw'}
        >
          Raw
        </Button>
        <Button
          size="sm"
          variant={mode === 'rich' ? 'default' : 'outline'}
          onClick={() => onModeChange('rich')}
          data-testid="comparison-mode-rich"
          aria-pressed={mode === 'rich'}
        >
          Rich
        </Button>
      </div>

      {/* Divider: filters vs. bulk actions */}
      <div aria-hidden className="self-stretch w-px bg-border/70 mx-0.5" />

      <Button
        size="sm"
        variant="outline"
        onClick={() => void onFlagAllNeedsReview()}
        disabled={!targetLang || isFlagging}
        data-testid="comparison-flag-all-needs-review"
        aria-label={t('compare.flagAllNeedsReview')}
      >
        <Flag className="w-3.5 h-3.5 mr-1" />
        {t('compare.flagAllNeedsReview')}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => void onMarkAllReviewed()}
        disabled={!targetLang || isMarkingAllReviewed}
        data-testid="comparison-mark-all-reviewed"
        aria-label={t('compare.markAllReviewed')}
      >
        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
        {t('compare.markAllReviewed')}
      </Button>

      {bulkTranslateRunId ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" data-testid="comparison-bulk-progress" />
          {bulkTranslateProgress && (
            // `bulkTranslateRunId` is only set while this run is in flight, so
            // the status is hardcoded Running (neither the SSE-derived nor the
            // run-store-fallback progress in ComparisonTab carries a status).
            <RunProgressBar
              completed={bulkTranslateProgress.completed}
              failed={bulkTranslateProgress.failed}
              total={bulkTranslateProgress.total}
              status={RunStatusCode.Running}
              aria-label={tBatch('progressAriaLabel', {
                completed: bulkTranslateProgress.completed,
                total: bulkTranslateProgress.total,
              })}
              className="w-32"
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void onBulkTranslateCancel()}
            data-testid="comparison-bulk-cancel"
          >
            {tBatch('cancelRun')}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void onOpenTranslateDialog()}
          disabled={!targetLang || rowsLength === 0}
          data-testid="comparison-bulk-translate"
          aria-label={t('compare.translate')}
        >
          <Languages className="w-3.5 h-3.5 mr-1" />
          {t('compare.translate')}
        </Button>
      )}

      {rowsLength > 0 && effectiveSelectionSize < rowsLength && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onSelectAllRows}
          data-testid="comparison-select-all-rows"
        >
          {t('compare.selectAll', { count: rowsLength })}
        </Button>
      )}

      {effectiveSelectionSize > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span data-testid="comparison-selection-count">
            {t('compare.selectedCount', { count: effectiveSelectionSize })}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="px-1.5 h-6"
            onClick={onClearSelection}
            data-testid="comparison-selection-clear"
            aria-label={t('compare.clearSelection')}
          >
            <X className="w-3 h-3" />
          </Button>
        </span>
      )}

      <ComparisonKeyboardShortcuts />

      <span className="text-xs text-muted-foreground ml-auto" data-testid="comparison-row-count">
        {t('pagination.rows', { formattedCount: rowsLength.toLocaleString() })}
      </span>

      {/* Pagination controls (mirrors string-table style) */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('order.label')}</span>
          <Select
            value={orderMode ?? 'import'}
            onValueChange={(v) => onOrderModeChange({ orderMode: v as 'import' | 'custom' })}
          >
            <SelectTrigger size="sm" className="w-56 h-7 text-xs" data-testid="comparison-order">
              {/* base-ui shows the raw value without a render-function. */}
              <SelectValue>
                {(value: string | null) =>
                  value === 'custom' ? t('order.custom') : t('order.import')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="import" className="text-xs">
                {t('order.import')}
              </SelectItem>
              <SelectItem value="custom" className="text-xs">
                {t('order.custom')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{t('pagination.rowsPerPage')}</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger
              size="sm"
              className="w-20 h-7 text-xs"
              data-testid="comparison-page-size"
            >
              {/* base-ui shows the raw value without a render-function. */}
              <SelectValue>{(value: string | null) => value ?? String(pageSize)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={onPrevPage}
            data-testid="comparison-prev-page"
          >
            {t('pagination.prev')}
          </Button>
          <span className="px-2" data-testid="comparison-page-indicator">
            {t('pagination.pageOfTotal', { page: safePage, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={onNextPage}
            data-testid="comparison-next-page"
          >
            {t('pagination.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
