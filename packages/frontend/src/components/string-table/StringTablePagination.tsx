/**
 * The String table's pagination + ordering bar: the filtered/total row count
 * with its "Show all" reset, the display-order picker + similarity pre-sort
 * control, the rows-per-page selector, and the first/prev/next/last nav.
 *
 * Split out of StringTable.tsx as a purely presentational bar — it owns no
 * state; page/pageSize/order values and every handler are prop-drilled from the
 * parent so the pagination and pre-sort wiring keep their original behavior.
 */
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownWideNarrow, Loader2 } from 'lucide-react';
import type { ReviewOrderMeta } from '../../stores/run-store.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PAGE_SIZE_OPTIONS } from './string-table-view-types.js';

interface StringTablePaginationProps {
  readonly entriesLength: number;
  readonly totalEntries: number;
  readonly onShowAll: () => void;
  readonly orderMode: 'import' | 'custom' | undefined;
  readonly onOrderModeChange: (v: 'import' | 'custom') => void;
  readonly presorting: boolean;
  readonly activeProjectId: string | null | undefined;
  readonly onPresort: () => void;
  readonly orderMeta: ReviewOrderMeta | null;
  readonly pageSize: number;
  readonly onPageSizeChange: (n: number) => void;
  readonly safePage: number;
  readonly totalPages: number;
  readonly setPage: Dispatch<SetStateAction<number>>;
}

export function StringTablePagination({
  entriesLength,
  totalEntries,
  onShowAll,
  orderMode,
  onOrderModeChange,
  presorting,
  activeProjectId,
  onPresort,
  orderMeta,
  pageSize,
  onPageSizeChange,
  safePage,
  totalPages,
  setPage,
}: Readonly<StringTablePaginationProps>): React.JSX.Element {
  const { t } = useTranslation('strings');

  return (
    <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs text-muted-foreground px-1">
      <span className="flex items-center gap-2">
        {entriesLength < totalEntries ? (
          <>
            <span>
              {t('pagination.rowsFiltered', {
                count: entriesLength,
                formattedCount: entriesLength.toLocaleString(),
                totalCount: totalEntries.toLocaleString(),
              })}
            </span>
            <button
              type="button"
              onClick={onShowAll}
              className="text-primary hover:text-primary/80 underline underline-offset-2 cursor-pointer"
              data-testid="pagination-show-all"
            >
              {t('pagination.showAll')}
            </button>
          </>
        ) : (
          <span>
            {t('pagination.rows', {
              count: entriesLength,
              formattedCount: entriesLength.toLocaleString(),
            })}
          </span>
        )}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span>{t('order.label')}</span>
          <Select
            value={orderMode ?? 'import'}
            onValueChange={(v) => onOrderModeChange(v as 'import' | 'custom')}
          >
            <SelectTrigger size="sm" className="w-44 h-7 text-xs" data-testid="string-order-mode">
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
          {orderMode === 'custom' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={presorting || !activeProjectId}
                onClick={onPresort}
                title={t('order.presortHint')}
                data-testid="string-order-presort"
              >
                {presorting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                )}
                {t('order.presort')}
              </Button>
              <span className="text-muted-foreground" data-testid="string-order-presort-meta">
                {orderMeta && orderMeta.computed !== false && orderMeta.count !== undefined
                  ? t('order.presortLast', { count: orderMeta.count })
                  : t('order.presortNever')}
              </span>
            </>
          )}
        </div>
        {/* testids: enable E2E pagination assertions (page size + nav + status) */}
        <div className="flex items-center gap-1.5">
          <span>{t('pagination.rowsPerPage')}</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger
              size="sm"
              className="w-20 h-7 text-xs"
              data-testid="string-page-size-select"
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
            onClick={() => setPage(1)}
            data-testid="string-pagination-first"
          >
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            data-testid="string-pagination-prev"
          >
            ‹
          </Button>
          <span className="px-2" data-testid="string-pagination-status">
            {safePage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            data-testid="string-pagination-next"
          >
            ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage(totalPages)}
            data-testid="string-pagination-last"
          >
            »
          </Button>
        </div>
      </div>
    </div>
  );
}
