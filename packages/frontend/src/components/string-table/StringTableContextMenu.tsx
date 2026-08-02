import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Tag, BookOpen, EyeOff, RotateCcw } from 'lucide-react';
import type { GlossarySummary, StringEntry, TranslationRecord } from '@zercade-dev/narn-shared';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { apiRequest } from '../../hooks/use-api.js';
import { useStringStore } from '../../stores/string-store.js';

interface StringTableContextMenuProps {
  entry: StringEntry;
  projectId: string;
  /**
   * Compare-tab only: enables per-language "clear review status" actions for
   * the tab's current target language. Absent (strings table) ⇒ no extra items.
   */
  reviewStatus?: { targetLanguage: string; record: TranslationRecord | undefined };
  children: React.ReactNode;
}

export function initialSelectedGlossaryIds(entry: StringEntry): string[] {
  return entry.assignedGlossaryIds ?? [];
}

export function buildAssignedGlossariesPatch(
  selectedGlossaryIds: string[],
): Pick<StringEntry, 'assignedGlossaryIds'> {
  return { assignedGlossaryIds: selectedGlossaryIds };
}

export function StringTableContextMenu({
  entry,
  projectId,
  reviewStatus,
  children,
}: StringTableContextMenuProps) {
  const { t } = useTranslation('strings');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [glossariesOpen, setGlossariesOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [glossaries, setGlossaries] = useState<GlossarySummary[]>([]);
  const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>([]);
  const [savingGlossaries, setSavingGlossaries] = useState(false);

  const updateEntry = useStringStore((s) => s.updateEntry);
  const setEntries = useStringStore.setState;

  const replaceEntryInStore = (next: StringEntry) => {
    setEntries((s) => ({ entries: s.entries.map((e) => (e.id === next.id ? next : e)) }));
  };

  const handleOpenGlossaries = async () => {
    try {
      const list = await apiRequest<GlossarySummary[]>(`/projects/${projectId}/glossaries`);
      setGlossaries(list);
    } catch {
      setGlossaries([]);
    }
    setSelectedGlossaryIds(initialSelectedGlossaryIds(entry));
    setGlossariesOpen(true);
  };

  const handleAddCategory = async () => {
    const value = newCategory.trim();
    setNewCategory('');
    if (!value) return;
    if ((entry.categories ?? []).includes(value)) return;
    try {
      const updated = await apiRequest<StringEntry>(
        `/projects/${projectId}/strings/${entry.id}/categories`,
        { method: 'POST', body: JSON.stringify({ category: value }) },
      );
      replaceEntryInStore(updated);
    } catch {
      // swallow; UI stays consistent because we never optimistically mutated
    }
  };

  const handleRemoveCategory = async (category: string) => {
    try {
      const updated = await apiRequest<StringEntry>(
        `/projects/${projectId}/strings/${entry.id}/categories/${encodeURIComponent(category)}`,
        { method: 'DELETE' },
      );
      replaceEntryInStore(updated);
    } catch {
      // ignore
    }
  };

  const handleSaveGlossaries = async () => {
    setSavingGlossaries(true);
    try {
      await updateEntry(projectId, entry.id, buildAssignedGlossariesPatch(selectedGlossaryIds));
      setGlossariesOpen(false);
    } catch {
      // ignore
    } finally {
      setSavingGlossaries(false);
    }
  };

  const handleClearNeedsReview = async () => {
    if (!reviewStatus?.record) return;
    try {
      await updateEntry(projectId, entry.id, {
        translations: {
          [reviewStatus.targetLanguage]: { ...reviewStatus.record, needsReview: false },
        },
      });
    } catch {
      // swallow; UI stays consistent because we never optimistically mutated
    }
  };

  const handleClearReviewed = async () => {
    if (!reviewStatus?.record) return;
    try {
      await updateEntry(projectId, entry.id, {
        translations: {
          [reviewStatus.targetLanguage]: { ...reviewStatus.record, status: 'translated' },
        },
      });
    } catch {
      // ignore
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger style={{ display: 'contents' }}>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setCategoriesOpen(true)}>
            <Tag className="mr-2 h-3.5 w-3.5" />
            {t('contextMenu.editCategories')}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => void handleOpenGlossaries()}>
            <BookOpen className="mr-2 h-3.5 w-3.5" />
            {t('contextMenu.enabledGlossaries')}
          </ContextMenuItem>
          {reviewStatus && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={reviewStatus.record?.needsReview !== true}
                onClick={() => void handleClearNeedsReview()}
                data-testid="context-clear-needs-review"
              >
                <EyeOff className="mr-2 h-3.5 w-3.5" />
                {t('contextMenu.clearNeedsReview')}
              </ContextMenuItem>
              <ContextMenuItem
                disabled={reviewStatus.record?.status !== 'reviewed'}
                onClick={() => void handleClearReviewed()}
                data-testid="context-clear-reviewed"
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                {t('contextMenu.clearReviewed')}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Edit Categories Sheet – rendered outside ContextMenu.Root to avoid focus-management conflicts */}
      <Sheet open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t('contextMenu.editCategories')}</SheetTitle>
            <SheetDescription>{t('contextMenu.editCategoriesDescription')}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap gap-1.5">
              {(entry.categories ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('contextMenu.noCategories')}</p>
              ) : (
                (entry.categories ?? []).map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-full bg-accent text-accent-foreground font-medium border border-border"
                    data-testid={`category-chip-edit-${cat}`}
                  >
                    {cat}
                    <button
                      type="button"
                      aria-label={t('contextMenu.removeCategory', { category: cat })}
                      className="ml-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                      onClick={() => void handleRemoveCategory(cat)}
                      data-testid={`category-chip-edit-remove-${cat}`}
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                data-slot="input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddCategory();
                  }
                }}
                placeholder={t('contextMenu.addCategoryPlaceholder')}
                aria-label={t('contextMenu.categoryName')}
                className="flex-1 text-sm h-8 px-2.5 rounded-md bg-background border border-input"
                data-testid="category-add-input"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleAddCategory()}
                data-testid="category-add-btn"
              >
                <Plus className="size-3.5 mr-1" />
                {t('contextMenu.add')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Forced Glossaries Sheet */}
      <Sheet open={glossariesOpen} onOpenChange={setGlossariesOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{t('contextMenu.enabledGlossaries')}</SheetTitle>
            <SheetDescription>{t('contextMenu.enabledGlossariesDescription')}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 p-4">
            {glossaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('contextMenu.noGlossaries')}</p>
            ) : (
              glossaries.map((g) => (
                <label key={g.id} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGlossaryIds.includes(g.id)}
                    onChange={(e) => {
                      setSelectedGlossaryIds((prev) =>
                        e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id),
                      );
                    }}
                    data-testid={`forced-glossary-checkbox-${g.id}`}
                  />
                  <span className="text-sm">{g.name}</span>
                  {g.readOnly && (
                    <span className="text-[10px] text-muted-foreground">
                      {t('contextMenu.readOnly')}
                    </span>
                  )}
                </label>
              ))
            )}
          </div>
          <SheetFooter>
            <Button
              onClick={() => void handleSaveGlossaries()}
              disabled={savingGlossaries}
              data-testid="forced-glossaries-save-btn"
            >
              {savingGlossaries ? t('contextMenu.saving') : t('contextMenu.save')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
