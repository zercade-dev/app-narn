import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/utils';
import { canWriteLanguage } from '@/lib/collab-locks';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export type EditorSelection =
  | { entryId: string; column: 'source' }
  | { entryId: string; column: 'translation'; language: string }
  | null;

export function StringTableEditor({
  selection,
  onClear,
  onReturnFocus,
}: {
  selection: EditorSelection;
  onClear: () => void;
  onReturnFocus?: () => void;
}) {
  const { t } = useTranslation('strings');
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const access = useProjectStore((s) => accessFor(s, activeProjectId));
  const entries = useStringStore((s) => s.entries);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const deleteEntry = useStringStore((s) => s.deleteEntry);
  const entry = selection ? entries.find((e) => e.id === selection.entryId) : undefined;

  const initial =
    selection && entry
      ? selection.column === 'source'
        ? entry.sourceText
        : (entry.translations[selection.language]?.text ?? '')
      : '';
  const [draft, setDraft] = useState(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-derive editor state during render. Two distinct cases must NOT be
  // conflated: (1) the user selected a different cell — always adopt the new
  // cell's text; (2) the store text changed under the same cell (e.g. a
  // background batch-translate refetch) — only adopt it if the draft is still
  // pristine, otherwise the user's in-progress edit would be silently clobbered.
  const [prevSelection, setPrevSelection] = useState(selection);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevSelection !== selection) {
    setPrevSelection(selection);
    setPrevInitial(initial);
    setDraft(initial);
    setConfirmDelete(false);
  } else if (prevInitial !== initial) {
    setPrevInitial(initial);
    // Keep a dirty draft; only live-update a pristine one.
    if (draft === prevInitial) setDraft(initial);
  }

  // No cell selected → render nothing. The old always-on "Select a cell…" hint
  // bar burned a permanent row above the table; the editor panel now only
  // appears (as an actual editor region) once a cell is selected, so the grid
  // reclaims that vertical space.
  if (!selection || !entry || !activeProjectId) {
    return null;
  }
  // Source is always read-only; a translation cell is also locked when the
  // current access (owner/collaborator + writableLanguages) may not write
  // this language (collab-locks.ts — mirrors the server's own `can()`
  // check, so a collaborator never sees a save the server would reject).
  const readOnly =
    selection.column === 'source' ||
    (selection.column === 'translation' && !canWriteLanguage(access, selection.language));
  const isLanguageLocked = readOnly && selection.column === 'translation';
  const canSave = !readOnly && draft !== initial;
  const handleSave = async () => {
    if (!canSave) return;
    const language = selection.language as string;
    const prev = entry.translations[language];
    const priorText = initial; // text shown before this edit
    // Send only the edited language; the server merges per-language and
    // preserves the untouched siblings (avoids replaying history over every
    // language on each save).
    try {
      await updateEntry(activeProjectId, entry.id, {
        translations: {
          [language]: {
            text: draft,
            status: 'translated',
            moduleId: prev?.moduleId ?? 'manual',
            timestamp: Date.now(),
          },
        },
      });
    } catch (err: unknown) {
      // A non-2xx from the store throws; surface it instead of an unhandled
      // rejection, and do not offer to undo a save that never landed.
      toast.error(errorMessage(err, 'Failed to save'));
      return;
    }
    // Offer to undo back to the prior record (only when text actually changed
    // and there was one to restore). Restores the full prior record for this
    // language — status/needsReview included — so undo doesn't silently re-flag
    // a previously reviewed cell or revert unrelated languages.
    if (prev && priorText && priorText !== draft) {
      toast.success(t('editor.saved'), {
        action: {
          label: t('editor.undo'),
          onClick: () => {
            void updateEntry(activeProjectId, entry.id, {
              translations: { [language]: { ...prev, timestamp: Date.now() } },
            }).catch((err: unknown) => {
              toast.error(errorMessage(err, 'Failed to undo'));
            });
          },
        },
      });
    }
  };
  const handleDelete = async () => {
    try {
      await deleteEntry(activeProjectId, entry.id);
    } catch (err: unknown) {
      // Keep the editor open on a failed delete so the UI doesn't go stale.
      toast.error(errorMessage(err, 'Failed to delete'));
      return;
    }
    onClear();
  };
  const handleToggleIgnoreOverflow = async () => {
    try {
      await updateEntry(activeProjectId, entry.id, {
        ignoreOverflow: !entry.ignoreOverflow,
      });
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to update'));
    }
  };

  const hasOverflow = Object.values(entry.lqaResults ?? {}).some((r) => r.overflow);

  return (
    <div
      className="border rounded-md p-3 mt-2 flex flex-col gap-2"
      data-testid="string-table-editor"
    >
      <div className="text-xs text-muted-foreground">
        {isLanguageLocked
          ? t('collab:locks.readOnlyLanguage', { lang: selection.language })
          : readOnly
            ? t('editor.sourceReadOnly')
            : t('editor.translationLabel', { lang: selection.language })}
      </div>
      <textarea
        className="w-full min-h-[5rem] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        value={draft}
        readOnly={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void handleSave();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onReturnFocus?.();
          }
        }}
        data-content
        data-testid="string-table-editor-textarea"
      />
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2 items-center">
          {confirmDelete ? (
            <>
              <span className="text-xs text-destructive">{t('editor.deleteConfirm')}</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                data-testid="string-table-delete-confirm-btn"
                onClick={handleDelete}
              >
                {t('editor.deleteConfirmYes')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-testid="string-table-delete-cancel-btn"
                onClick={() => setConfirmDelete(false)}
              >
                {t('editor.cancel')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              data-testid="string-table-delete-btn"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              {t('editor.delete')}
            </Button>
          )}
          {(hasOverflow || entry.ignoreOverflow) && (
            <Button
              type="button"
              variant={entry.ignoreOverflow ? 'secondary' : 'ghost'}
              size="sm"
              className={entry.ignoreOverflow ? 'text-muted-foreground' : 'text-status-warn'}
              data-testid="string-table-ignore-overflow-btn"
              onClick={handleToggleIgnoreOverflow}
            >
              {entry.ignoreOverflow ? t('editor.overflowIgnored') : t('editor.ignoreOverflow')}
            </Button>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDraft(initial);
              onClear();
            }}
            data-testid="string-table-editor-discard"
          >
            {t('editor.discard')}
          </Button>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              disabled={draft === initial}
              data-testid="string-table-editor-save"
              onClick={handleSave}
            >
              {t('editor.save')}
              <kbd className="ml-1.5 text-[10px] opacity-70">Ctrl+↵</kbd>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
