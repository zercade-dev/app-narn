/**
 * The String table's scroll grid: the sticky header row (select-all checkbox,
 * config column, source-language column, and one header per target language)
 * plus the paginated body of {@link StringTableRow}s (or the empty state).
 *
 * Split out of StringTable.tsx as a purely presentational grid — it owns no
 * state; column geometry, selection, page data, and the per-row callbacks are
 * prop-drilled from the parent. The row callbacks keep the same shape/identity
 * as the original inline map so StringTableRow's memoization is unchanged.
 */
import { useTranslation } from 'react-i18next';
import { LANG_NAMES, type GlossarySummary, type StringEntry } from '@zercade-dev/narn-shared';
import { Checkbox } from '@/components/ui/checkbox';
import { getLangName } from './string-table-helpers.js';
import { StringTableRow, type CellSelection } from './StringTableRow.js';
import { HEADER_HEIGHT, type Selection } from './string-table-view-types.js';

interface StringTableGridProps {
  readonly sourceLanguage: string;
  readonly columns: string[];
  readonly totalWidth: number;
  readonly checkboxColWidth: number;
  readonly classificationColWidth: number;
  readonly sourceColWidth: number;
  readonly colWidth: number;
  readonly allPageSelected: boolean;
  readonly somePageSelected: boolean;
  readonly onSelectAll: (checked: boolean) => void;
  readonly isEmpty: boolean;
  readonly pageEntries: StringEntry[];
  readonly selection: Selection;
  readonly onSelect: (selection: CellSelection) => void;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleRow: (id: string) => void;
  readonly translatingCells: ReadonlySet<string>;
  readonly glossarySummaries: GlossarySummary[];
}

export function StringTableGrid({
  sourceLanguage,
  columns,
  totalWidth,
  checkboxColWidth,
  classificationColWidth,
  sourceColWidth,
  colWidth,
  allPageSelected,
  somePageSelected,
  onSelectAll,
  isEmpty,
  pageEntries,
  selection,
  onSelect,
  selectedIds,
  onToggleRow,
  translatingCells,
  glossarySummaries,
}: Readonly<StringTableGridProps>): React.JSX.Element {
  const { t } = useTranslation('strings');

  return (
    <div className="flex-1 min-h-0 overflow-auto border rounded-md">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 flex bg-muted border-b-2 border-border items-center"
        style={{ minWidth: totalWidth, height: HEADER_HEIGHT }}
      >
        {/* Select-all checkbox */}
        <div
          className="flex items-center justify-center shrink-0 bg-muted"
          style={{ width: checkboxColWidth, position: 'sticky', left: 0, zIndex: 2 }}
        >
          <Checkbox
            checked={allPageSelected}
            indeterminate={somePageSelected && !allPageSelected}
            onCheckedChange={(checked) => onSelectAll(checked === true)}
            aria-label={t('table.selectAllAria')}
            className="cursor-pointer"
            data-testid="string-table-select-all"
          />
        </div>

        {/* CONFIG column header */}
        <div
          className="px-3 flex items-center shrink-0 bg-muted"
          style={{
            width: classificationColWidth,
            position: 'sticky',
            left: checkboxColWidth,
            zIndex: 2,
          }}
        >
          <span className="font-semibold text-xs text-muted-foreground">{t('columns.config')}</span>
        </div>

        <div
          className="px-3 flex items-baseline gap-1.5 shrink-0 bg-muted border-r border-border"
          style={{
            width: sourceColWidth,
            position: 'sticky',
            left: checkboxColWidth + classificationColWidth,
            zIndex: 2,
          }}
        >
          <span className="font-semibold text-xs text-muted-foreground">
            {getLangName(sourceLanguage).toUpperCase()}
          </span>
          {sourceLanguage in LANG_NAMES && (
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground/70">
              {sourceLanguage}
            </span>
          )}
        </div>
        {columns.map((lang) => (
          <div
            key={lang}
            className="px-3 flex items-baseline gap-1.5"
            style={{ flex: `1 1 ${colWidth}px`, minWidth: colWidth }}
          >
            <span className="font-semibold text-xs text-muted-foreground">
              {getLangName(lang).toUpperCase()}
            </span>
            {lang in LANG_NAMES && (
              <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground/70">
                {lang}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Rows */}
      {isEmpty ? (
        // data-testid added for E2E: empty-state shown both for a zero-entry
        // project and when active filters/search match no rows (entries is the
        // filtered set). Display-only, no behavior change.
        <div className="text-muted-foreground p-6" data-testid="string-table-empty">
          {t('empty.noStrings')}
        </div>
      ) : (
        <div style={{ minWidth: totalWidth }}>
          {pageEntries.map((entry, index) => (
            <StringTableRow
              key={entry.id}
              entry={entry}
              languages={columns}
              sourceColWidth={sourceColWidth}
              classificationColWidth={classificationColWidth}
              colWidth={colWidth}
              checkboxColWidth={checkboxColWidth}
              index={index}
              selection={selection}
              onSelect={onSelect}
              isSelected={selectedIds.has(entry.id)}
              onToggleSelect={() => onToggleRow(entry.id)}
              translatingCells={translatingCells}
              glossarySummaries={glossarySummaries}
            />
          ))}
        </div>
      )}
    </div>
  );
}
