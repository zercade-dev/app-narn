/**
 * The String table's bulk-action bar, shown while any currently-visible row is
 * selected. Consolidates the "Bulk Operation" popover (add/remove category,
 * approve-to-memory, ignore, clear-new-flag), the "AI Generation" popover
 * (glossary/category generation scoped to the selection), the Translate
 * Selected control + live batch progress, and the clear-selection link.
 *
 * Split out of StringTable.tsx as a purely presentational bar — it owns NO
 * state and NO async logic. Every popover flag, every derived count, and every
 * bulk handler (including the fixed bulk-op concurrency/scoping) stays in the
 * parent and is prop-drilled here verbatim, so behavior and timing are
 * unchanged.
 */
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Loader2, Sparkles } from 'lucide-react';
import type { RunStatusCode } from '@zercade-dev/narn-shared';
import { ComboboxInput } from '@/components/ui/combobox-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RunProgressBar } from '@/components/ui/run-progress-bar';

type BulkOpMode = 'menu' | 'add-category' | 'remove-category';

interface StringTableBulkBarProps {
  /**
   * Every action in the "Bulk Operation" popover (approve/ignore/
   * clear-new-flag/category add-remove) patches a non-`translations` field —
   * 'manage'-only server-side (`assertEntryPatchAllowed`) — so the whole
   * popover is hidden outright for collaborators rather than offered only to
   * 403 on submit.
   */
  readonly isCollaborator: boolean;
  readonly visibleSelectedCount: number;
  readonly selectedOffPage: number;
  readonly allPageSelected: boolean;
  readonly allFilteredSelected: boolean;
  readonly entriesLength: number;
  readonly pageEntriesLength: number;
  readonly onSelectAllFiltered: () => void;
  readonly bulkOpOpen: boolean;
  readonly setBulkOpOpen: Dispatch<SetStateAction<boolean>>;
  readonly closeBulkOp: () => void;
  readonly bulkOpMode: BulkOpMode;
  readonly setBulkOpMode: Dispatch<SetStateAction<BulkOpMode>>;
  readonly selectedCategories: string[];
  readonly handleApproveSelected: () => Promise<void>;
  readonly handleBulkIgnore: () => Promise<void>;
  readonly handleClearNewFlags: () => Promise<void>;
  readonly categorySuggestions: string[];
  readonly bulkCategory: string;
  readonly setBulkCategory: (value: string) => void;
  readonly handleBulkCategoryAdd: () => Promise<void>;
  readonly categoriesToRemove: Set<string>;
  readonly setCategoriesToRemove: Dispatch<SetStateAction<Set<string>>>;
  readonly handleBulkCategoryRemove: () => Promise<void>;
  readonly aiGenOpen: boolean;
  readonly setAiGenOpen: Dispatch<SetStateAction<boolean>>;
  readonly setGlossaryGenOpen: Dispatch<SetStateAction<boolean>>;
  readonly handleGenerateCategoriesFromSelection: () => void;
  readonly batchRunId: string | null;
  readonly batchProgress:
    { completed: number; total: number; failed: number; status?: RunStatusCode } | undefined;
  readonly batchTargetLanguagesLength: number;
  readonly translatableCount: number;
  readonly handleBatchCancel: () => Promise<void>;
  readonly openBatchDialog: () => Promise<void>;
  readonly clearSelection: () => void;
}

export function StringTableBulkBar({
  isCollaborator,
  visibleSelectedCount,
  selectedOffPage,
  allPageSelected,
  allFilteredSelected,
  entriesLength,
  pageEntriesLength,
  onSelectAllFiltered,
  bulkOpOpen,
  setBulkOpOpen,
  closeBulkOp,
  bulkOpMode,
  setBulkOpMode,
  selectedCategories,
  handleApproveSelected,
  handleBulkIgnore,
  handleClearNewFlags,
  categorySuggestions,
  bulkCategory,
  setBulkCategory,
  handleBulkCategoryAdd,
  categoriesToRemove,
  setCategoriesToRemove,
  handleBulkCategoryRemove,
  aiGenOpen,
  setAiGenOpen,
  setGlossaryGenOpen,
  handleGenerateCategoriesFromSelection,
  batchRunId,
  batchProgress,
  batchTargetLanguagesLength,
  translatableCount,
  handleBatchCancel,
  openBatchDialog,
  clearSelection,
}: Readonly<StringTableBulkBarProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  const { t: tBatch } = useTranslation('batch');

  return (
    <div className="flex flex-col gap-1.5 mt-2 px-3 py-2 bg-primary/8 border border-primary/20 rounded-md text-sm">
      <div className="flex flex-wrap items-center gap-3 gap-y-2">
        <span className="text-primary font-medium text-xs" data-testid="bulk-selection">
          {/* Reflects only actionable (currently-visible-under-filter) rows —
              see visibleSelectedIds above. */}
          {t('bulk.rowsSelected', { count: visibleSelectedCount })}
        </span>
        {selectedOffPage > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('bulk.offPage', { count: selectedOffPage })}
          </span>
        )}
        {allPageSelected && !allFilteredSelected && entriesLength > pageEntriesLength && (
          <button
            type="button"
            className="text-xs text-primary hover:text-primary/80 underline underline-offset-2 cursor-pointer"
            onClick={onSelectAllFiltered}
            data-testid="bulk-select-all-filtered"
          >
            {t('bulk.selectAllFiltered', { count: entriesLength })}
          </button>
        )}
        {allFilteredSelected && entriesLength > pageEntriesLength && (
          <span className="text-xs text-primary">
            {t('bulk.allFilteredSelected', { count: entriesLength })}
          </span>
        )}
        <span className="text-muted-foreground">|</span>

        {/* Bulk Operation: consolidates category-add, category-remove,
            approve-to-memory, and ignore-entry into one popover so the
            toolbar reads as three sibling controls (Bulk Operation | AI
            Generation | Translate Selected) instead of a long button row.
            Every action here patches a non-`translations` field —
            'manage'-only server-side (`assertEntryPatchAllowed`) — so hidden
            outright for collaborators rather than offered only to 403. */}
        {!isCollaborator && (
          <Popover
            open={bulkOpOpen}
            onOpenChange={(open) => {
              if (open) setBulkOpOpen(true);
              else closeBulkOp();
            }}
          >
            <PopoverTrigger
              render={
                <Button size="sm" variant="outline" data-testid="bulk-operation-trigger">
                  {t('bulk.bulkOperation')}
                </Button>
              }
            />
            <PopoverContent className="w-64 p-2" align="start">
              {bulkOpMode === 'menu' && (
                <div className="flex flex-col gap-0.5" data-testid="bulk-operation-menu">
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                    onClick={() => setBulkOpMode('add-category')}
                    data-testid="bulk-op-add-category"
                  >
                    {t('bulk.addCategory')}
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    onClick={() => setBulkOpMode('remove-category')}
                    disabled={selectedCategories.length === 0}
                    data-testid="bulk-op-remove-category"
                  >
                    {t('bulk.removeCategory')}
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                    onClick={() => {
                      closeBulkOp();
                      void handleApproveSelected();
                    }}
                    data-testid="bulk-op-approve"
                  >
                    {t('bulk.approveSelected')}
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                    onClick={() => {
                      closeBulkOp();
                      void handleBulkIgnore();
                    }}
                    data-testid="bulk-op-ignore"
                  >
                    {t('bulk.ignoreEntry')}
                  </button>
                  <button
                    type="button"
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                    onClick={() => {
                      closeBulkOp();
                      void handleClearNewFlags();
                    }}
                    data-testid="bulk-op-clear-new-flag"
                  >
                    {t('bulk.clearNewFlag')}
                  </button>
                </div>
              )}

              {bulkOpMode === 'add-category' && (
                <div
                  className="flex flex-col gap-2"
                  data-testid="bulk-operation-add-category-panel"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setBulkOpMode('menu')}
                    data-testid="bulk-op-back"
                  >
                    <ChevronLeft className="size-3.5" />
                    {t('bulk.back')}
                  </button>
                  <span className="text-xs text-muted-foreground">{t('bulk.setCategory')}</span>
                  <ComboboxInput
                    id="bulk-category"
                    className="h-7 text-xs"
                    suggestions={categorySuggestions}
                    value={bulkCategory}
                    onValueChange={setBulkCategory}
                    placeholder={t('bulk.categoryPlaceholder')}
                    emptyText={t('bulk.categoryEmpty')}
                    data-testid="bulk-category-input"
                  />
                  <Button
                    size="sm"
                    onClick={handleBulkCategoryAdd}
                    disabled={bulkCategory.trim() === ''}
                    data-testid="bulk-category-apply"
                  >
                    {t('bulk.apply')}
                  </Button>
                </div>
              )}

              {bulkOpMode === 'remove-category' && (
                <div
                  className="flex flex-col gap-2"
                  data-testid="bulk-operation-remove-category-panel"
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setBulkOpMode('menu')}
                    data-testid="bulk-op-back"
                  >
                    <ChevronLeft className="size-3.5" />
                    {t('bulk.back')}
                  </button>
                  {selectedCategories.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">
                      {t('bulk.removeCategoryEmpty')}
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                        {selectedCategories.map((cat) => (
                          <Label
                            key={cat}
                            className="flex items-center gap-2 text-xs font-normal cursor-pointer px-1 py-0.5 rounded hover:bg-accent"
                          >
                            <Checkbox
                              checked={categoriesToRemove.has(cat)}
                              onCheckedChange={(checked) =>
                                setCategoriesToRemove((prev) => {
                                  const next = new Set(prev);
                                  if (checked === true) next.add(cat);
                                  else next.delete(cat);
                                  return next;
                                })
                              }
                              data-testid={`bulk-category-remove-option-${cat}`}
                            />
                            <span className="truncate">{cat}</span>
                          </Label>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        onClick={handleBulkCategoryRemove}
                        disabled={categoriesToRemove.size === 0}
                        data-testid="bulk-category-remove-apply"
                      >
                        {t('bulk.removeCategoryApply', { count: categoriesToRemove.size })}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* AI Generation: opens the selection-scoped glossary dialog, or
            hands the selection off to the Category tab. */}
        <Popover open={aiGenOpen} onOpenChange={setAiGenOpen}>
          <PopoverTrigger
            render={
              <Button size="sm" variant="outline" data-testid="bulk-ai-generation-trigger">
                <Sparkles className="size-3.5 mr-1" />
                {t('bulk.aiGeneration')}
              </Button>
            }
          />
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  setAiGenOpen(false);
                  setGlossaryGenOpen(true);
                }}
                data-testid="bulk-ai-generate-glossary"
              >
                {t('bulk.generateGlossaryFromSelection')}
              </button>
              <button
                type="button"
                className="rounded px-2 py-1.5 text-left text-xs hover:bg-accent cursor-pointer"
                onClick={() => {
                  setAiGenOpen(false);
                  handleGenerateCategoriesFromSelection();
                }}
                data-testid="bulk-ai-generate-categories"
              >
                {t('bulk.generateCategoriesFromSelection')}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground">|</span>
        {batchRunId ? (
          <span
            className="inline-flex items-center gap-2 text-xs text-muted-foreground"
            data-testid="bulk-batch-progress"
          >
            <Loader2 className="size-3 animate-spin" />
            {batchProgress ? (
              <RunProgressBar
                completed={batchProgress.completed}
                failed={batchProgress.failed}
                total={batchProgress.total}
                status={batchProgress.status}
                aria-label={tBatch('progressAriaLabel', {
                  completed: batchProgress.completed,
                  total: batchProgress.total,
                })}
                className="w-32"
              />
            ) : (
              tBatch('translateSelected')
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => void handleBatchCancel()}
              data-testid="bulk-batch-cancel"
            >
              {tBatch('cancelRun')}
            </Button>
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openBatchDialog()}
            data-testid="bulk-batch-translate"
            disabled={
              batchRunId !== null || visibleSelectedCount === 0 || batchTargetLanguagesLength === 0
            }
          >
            {tBatch('translateSelected')}
          </Button>
        )}
        <span className="text-xs text-muted-foreground" data-testid="bulk-translatable-count">
          {tBatch('toTranslateCount', { count: translatableCount })}
        </span>
        <Button
          variant="link"
          size="sm"
          className="ml-auto"
          onClick={() => {
            clearSelection();
            // The toolbar (and both popovers) unmount once the selection is
            // empty, but their own state doesn't otherwise reset — without
            // this, reselecting rows later would re-show the Bulk
            // Operation popover already open on a stale sub-panel.
            closeBulkOp();
            setAiGenOpen(false);
          }}
          data-testid="bulk-clear-selection"
        >
          {t('bulk.clearSelection')}
        </Button>
      </div>
    </div>
  );
}
