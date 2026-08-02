import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';

const CONTEXT_PREVIEW_CHARS = 40;
const CONTEXT_SAVE_DEBOUNCE_MS = 300;

export interface ContextEditorProps {
  entryId: string;
  initialValue: string;
  onSave: (entryId: string, value: string) => Promise<void>;
  /**
   * Prefix for the `data-testid` attributes (`<prefix>-toggle-<id>` and
   * `<prefix>-editor-<id>`). Lets each host tab keep stable, distinct selectors.
   */
  testIdPrefix?: string;
}

/**
 * Inline editor for a StringEntry's translator `context`. Collapsed view shows
 * either `+ Context` (empty) or the first ~40 chars of the existing context
 * with a pencil affordance. Expanded view shows a textarea that saves
 * (debounced 300 ms) on blur or Enter (Shift+Enter inserts a newline
 * instead), and cancels on Escape.
 *
 * Shared by the Comparison and Review tabs; both persist via
 * `updateEntry(projectId, id, { context })`.
 */
export function ContextEditor({
  entryId,
  initialValue,
  onSave,
  testIdPrefix = 'comparison-context',
}: Readonly<ContextEditorProps>) {
  const { t } = useTranslation('strings');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest pending debounced save, captured as a ref so the unmount-only
  // cleanup can FLUSH it without capturing a stale entryId/onSave/value.
  const pendingSaveRef = useRef<(() => void) | null>(null);

  // Re-sync draft during render when the saved value changes (or editing
  // ends) and we aren't editing.
  const [prevDraftSync, setPrevDraftSync] = useState({ initialValue, editing });
  if (prevDraftSync.initialValue !== initialValue || prevDraftSync.editing !== editing) {
    setPrevDraftSync({ initialValue, editing });
    if (!editing) setDraft(initialValue);
  }

  useEffect(() => {
    return () => {
      // A pending debounced save must be FLUSHED on unmount, not dropped: the
      // same click that blurs the textarea can also unmount the row (page/tab/
      // filter change) inside the 300ms window. Read the ref inside cleanup so
      // it fires the LATEST save without the effect depending on onSave/entryId.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        const flush = pendingSaveRef.current;
        pendingSaveRef.current = null;
        flush?.();
      }
    };
  }, []);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [editing]);

  const scheduleSave = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingSaveRef.current = () => {
        void onSave(entryId, value);
      };
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Null the pending ref before firing so a later unmount can't double-fire.
        pendingSaveRef.current = null;
        void onSave(entryId, value);
      }, CONTEXT_SAVE_DEBOUNCE_MS);
    },
    [entryId, onSave],
  );

  const commit = useCallback(
    (value: string) => {
      setEditing(false);
      if (value !== initialValue) scheduleSave(value);
    },
    [initialValue, scheduleSave],
  );

  const cancel = useCallback(() => {
    setDraft(initialValue);
    setEditing(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Escape means discard — drop any pending save so unmount won't flush it.
    pendingSaveRef.current = null;
  }, [initialValue]);

  if (editing) {
    return (
      <textarea
        ref={taRef}
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancel();
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            commit(draft);
          }
        }}
        className="mt-1 w-full resize-y bg-background border border-input rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder={t('compare.contextPlaceholder')}
        data-testid={`${testIdPrefix}-editor-${entryId}`}
        aria-label={t('compare.editContext')}
      />
    );
  }

  const preview = initialValue.trim();
  const truncated =
    preview.length > CONTEXT_PREVIEW_CHARS
      ? `${preview.slice(0, CONTEXT_PREVIEW_CHARS)}…`
      : preview;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors max-w-full"
      data-testid={`${testIdPrefix}-toggle-${entryId}`}
      aria-label={preview ? t('compare.editContext') : t('compare.addContext')}
    >
      {preview ? (
        <>
          <Pencil className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate italic">{truncated}</span>
        </>
      ) : (
        <span>{t('compare.addContext')}</span>
      )}
    </button>
  );
}
