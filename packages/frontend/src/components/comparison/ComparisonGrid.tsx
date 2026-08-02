/**
 * The Comparison tab's scroll grid: the sticky header row plus the paginated
 * body of comparison rows (selection + source + translation + optional
 * reference + context cells).
 *
 * Split out of ComparisonTab.tsx as a purely presentational grid — it owns no
 * state; the parse cache, selection, page data and every save/retranslate
 * handler are prop-drilled from the parent so the rich-mode parse effect and
 * run-tracking keep their original wiring and timing.
 */
import { useTranslation } from 'react-i18next';
import {
  getSourceLabel,
  LANG_NAMES,
  type StringEntry,
  type TagNode,
} from '@zercade-dev/narn-shared';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { ComparisonCell } from './ComparisonCell.js';
import { ContextEditor } from './ContextEditor.js';
import { ToneEditor } from './ToneEditor.js';
import { StringTableContextMenu } from '../string-table/StringTableContextMenu.js';
import { RichRenderer } from './RichRenderer.js';
import { entryNeedsAttention, HEADER_HEIGHT, type ReviewStats } from './comparison-tab-types.js';

interface ComparisonGridProps {
  readonly colTemplate: string;
  readonly gridMinWidth: number;
  readonly sourceLanguage: string;
  readonly targetLang: string;
  readonly referenceLanguage: string;
  readonly reviewStats: ReviewStats;
  readonly mode: 'raw' | 'rich';
  readonly pageEntries: StringEntry[];
  readonly pageIds: string[];
  readonly allPageSelected: boolean;
  readonly somePageSelected: boolean;
  readonly onPageSelectedChange: (ids: string[], checked: boolean) => void;
  readonly effectiveSelection: ReadonlySet<string>;
  readonly onToggleSelected: (id: string) => void;
  readonly getNodes: (entryId: string, language: string, text: string) => TagNode[] | undefined;
  readonly onSaveTranslation: (entryId: string, language: string, text: string) => Promise<void>;
  readonly onRetranslate: (entryId: string, language: string) => Promise<void>;
  readonly onMarkReviewed: (entryId: string, language: string) => Promise<void>;
  readonly onSaveContext: (entryId: string, value: string) => Promise<void>;
  readonly onSaveTone: (entryId: string, value: string) => Promise<void>;
  readonly knownTones: string[];
  readonly onOpenUndo: (entryId: string, language: string) => void;
  readonly projectId: string;
  readonly onToggleIgnored: (entryId: string) => Promise<void>;
}

export function ComparisonGrid({
  colTemplate,
  gridMinWidth,
  sourceLanguage,
  targetLang,
  referenceLanguage,
  reviewStats,
  mode,
  pageEntries,
  pageIds,
  allPageSelected,
  somePageSelected,
  onPageSelectedChange,
  effectiveSelection,
  onToggleSelected,
  getNodes,
  onSaveTranslation,
  onRetranslate,
  onMarkReviewed,
  onSaveContext,
  onSaveTone,
  knownTones,
  onOpenUndo,
  projectId,
  onToggleIgnored,
}: Readonly<ComparisonGridProps>): React.JSX.Element {
  const { t, i18n } = useTranslation('strings');

  return (
    <div
      className="flex-1 min-h-0 overflow-auto relative"
      style={{ scrollbarGutter: 'stable' }}
      data-testid="comparison-scroll"
    >
      {/* Header */}
      <div
        className="sticky top-0 z-20 bg-muted border-b border-border w-full"
        style={{
          height: HEADER_HEIGHT,
          display: 'grid',
          gridTemplateColumns: colTemplate,
          minWidth: gridMinWidth,
        }}
      >
        <div className="sticky left-0 z-30 bg-muted flex items-center justify-center border-r border-border">
          <Checkbox
            checked={allPageSelected}
            indeterminate={somePageSelected && !allPageSelected}
            onCheckedChange={(checked) => onPageSelectedChange(pageIds, checked === true)}
            aria-label={t('compare.selectPage')}
            className="cursor-pointer"
            data-testid="comparison-select-all"
          />
        </div>
        <div
          className="sticky left-9 z-30 bg-muted flex items-center px-3 text-xs font-semibold border-r border-border min-w-0 overflow-hidden"
          data-testid="comparison-header-source"
        >
          Source (<span className="font-mono uppercase tracking-wide">{sourceLanguage || '—'}</span>
          )
        </div>
        {targetLang && (
          <div
            className="flex flex-col justify-center px-3 text-xs font-semibold border-r border-border min-w-0 overflow-hidden h-full gap-0.5"
            data-testid={`comparison-header-${targetLang}`}
          >
            <span>
              {LANG_NAMES[targetLang] ?? targetLang} (
              <span className="font-mono uppercase tracking-wide">{targetLang}</span>)
            </span>
            {(reviewStats.translatedCount > 0 || reviewStats.reviewedCount > 0) && (
              <span className="font-normal text-muted-foreground text-[10px]">
                {reviewStats.translatedCount > 0 && (
                  <span className="text-status-info">{reviewStats.translatedCount} translated</span>
                )}
                {reviewStats.translatedCount > 0 && reviewStats.reviewedCount > 0 && ' · '}
                {reviewStats.reviewedCount > 0 && (
                  <span className="text-status-pass">{reviewStats.reviewedCount} reviewed</span>
                )}
              </span>
            )}
          </div>
        )}
        {referenceLanguage && (
          <div
            className="flex items-center px-3 text-xs font-semibold border-r border-border min-w-0 overflow-hidden h-full"
            data-testid={`comparison-header-ref-${referenceLanguage}`}
          >
            Reference (
            <span className="font-mono uppercase tracking-wide">{referenceLanguage}</span>)
          </div>
        )}
        <div
          className="flex items-center px-3 text-xs font-semibold border-r border-border min-w-0 overflow-hidden"
          data-testid="comparison-header-context"
        >
          Context
        </div>
      </div>

      {/* Body */}
      <div data-testid="comparison-body">
        {pageEntries.map((entry) => {
          const sourceNodes =
            mode === 'rich' && entry.sourceText
              ? getNodes(entry.id, sourceLanguage, entry.sourceText)
              : undefined;
          const needsAttention = targetLang ? entryNeedsAttention(entry, targetLang) : false;
          const isSelected = effectiveSelection.has(entry.id);
          return (
            <StringTableContextMenu
              key={entry.id}
              entry={entry}
              projectId={projectId}
              reviewStatus={{ targetLanguage: targetLang, record: entry.translations[targetLang] }}
            >
              <div
                className={cn(
                  'group border-b border-border',
                  // A ring (not a background fill) so selection stays visible
                  // even on a row that also needsAttention — both would
                  // otherwise fight over the same background-color utility.
                  isSelected && 'ring-1 ring-inset ring-accent',
                  needsAttention && 'border-l-2 border-l-status-warn/70 bg-status-warn/[0.04]',
                )}
                style={{
                  display: 'grid',
                  gridTemplateColumns: colTemplate,
                  minWidth: gridMinWidth,
                }}
                data-testid="comparison-row"
                data-entry-id={entry.id}
                data-selected={isSelected ? 'true' : undefined}
                data-needs-attention={needsAttention ? 'true' : undefined}
              >
                {/* Sticky selection cell */}
                <div className="sticky left-0 z-10 bg-background border-r border-border flex items-start justify-center pt-2.5">
                  <Checkbox
                    checked={effectiveSelection.has(entry.id)}
                    onCheckedChange={() => onToggleSelected(entry.id)}
                    aria-label={t('compare.selectRow')}
                    className="cursor-pointer"
                    data-testid="comparison-row-select"
                  />
                </div>

                {/* Sticky source cell */}
                <div
                  className="sticky left-9 z-10 bg-background border-r border-border px-3 py-2 text-sm min-w-0 flex flex-col gap-1"
                  data-testid="comparison-source-cell"
                >
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {mode === 'rich' && sourceNodes ? (
                      <RichRenderer nodes={sourceNodes} />
                    ) : (
                      entry.sourceText
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap shrink-0">
                    {(entry.sources ?? []).map((src) => (
                      <span
                        key={src}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium whitespace-nowrap"
                      >
                        {getSourceLabel(src, i18n.language)}
                      </span>
                    ))}
                  </div>
                  {entry.ignored ? (
                    <div className="flex items-center gap-1" data-testid="comparison-ignored-badge">
                      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap bg-muted text-muted-foreground ring-1 ring-border">
                        {t('row.ignored')}
                      </span>
                      <button
                        type="button"
                        onClick={() => void onToggleIgnored(entry.id)}
                        aria-label={t('row.unignoreAction')}
                        data-testid="comparison-unignore-action"
                        className="inline-flex items-center justify-center size-4 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent cursor-pointer"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onToggleIgnored(entry.id)}
                      aria-label={t('row.ignoreAction')}
                      data-testid="comparison-ignore-action"
                      className="self-start text-[10px] text-muted-foreground/50 hover:text-muted-foreground underline-offset-2 hover:underline cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {t('row.ignoreAction')}
                    </button>
                  )}
                </div>

                {/* Translation cell */}
                {targetLang && (
                  <div className="min-w-0">
                    <ComparisonCell
                      entry={entry}
                      language={targetLang}
                      mode={mode}
                      getNodes={getNodes}
                      onSave={onSaveTranslation}
                      retranslateKey={`${entry.id}:${targetLang}`}
                      onRetranslate={() => onRetranslate(entry.id, targetLang)}
                      onMarkReviewed={() => onMarkReviewed(entry.id, targetLang)}
                      onClear={() => onSaveTranslation(entry.id, targetLang, '')}
                      onOpenUndo={() => onOpenUndo(entry.id, targetLang)}
                    />
                  </div>
                )}

                {/* Reference cell (read-only) */}
                {referenceLanguage && (
                  <div className="min-w-0">
                    <ComparisonCell
                      entry={entry}
                      language={referenceLanguage}
                      mode={mode}
                      getNodes={getNodes}
                      onSave={onSaveTranslation}
                      retranslateKey={null}
                      readOnly
                    />
                  </div>
                )}

                {/* Context cell */}
                <div
                  className="border-r border-border px-3 py-2 text-sm min-w-0 overflow-hidden flex flex-col"
                  data-testid="comparison-context-cell"
                >
                  <ContextEditor
                    entryId={entry.id}
                    initialValue={entry.context ?? ''}
                    onSave={onSaveContext}
                  />
                  <ToneEditor
                    entryId={entry.id}
                    initialValue={entry.metadata?.tone ?? ''}
                    knownTones={knownTones}
                    onSave={onSaveTone}
                  />
                </div>
              </div>
            </StringTableContextMenu>
          );
        })}
      </div>
    </div>
  );
}
