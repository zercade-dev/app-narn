/**
 * Inline editor for a StringEntry's persisted tone (metadata.tone). Mirrors
 * ContextEditor's collapsed-pencil / expanded-textarea / debounced-save /
 * Enter-to-save-Shift+Enter-for-newline / Escape-to-cancel behavior, plus an
 * autocomplete dropdown of tones already used elsewhere in the project.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE_PREVIEW_CHARS = 40;
const TONE_SAVE_DEBOUNCE_MS = 300;

export interface ToneEditorProps {
  entryId: string;
  initialValue: string;
  knownTones: string[];
  onSave: (entryId: string, value: string) => Promise<void>;
}

export function ToneEditor({
  entryId,
  initialValue,
  knownTones,
  onSave,
}: Readonly<ToneEditorProps>) {
  const { t } = useTranslation('strings');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);

  const [prevDraftSync, setPrevDraftSync] = useState({ initialValue, editing });
  if (prevDraftSync.initialValue !== initialValue || prevDraftSync.editing !== editing) {
    setPrevDraftSync({ initialValue, editing });
    if (!editing) setDraft(initialValue);
  }

  useEffect(() => {
    return () => {
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
        pendingSaveRef.current = null;
        void onSave(entryId, value);
      }, TONE_SAVE_DEBOUNCE_MS);
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
    pendingSaveRef.current = null;
  }, [initialValue]);

  const suggestions = useMemo(() => {
    const needle = draft.trim().toLowerCase();
    if (!needle) return [];
    return knownTones.filter(
      (tone) => tone.toLowerCase() !== needle && tone.toLowerCase().startsWith(needle),
    );
  }, [draft, knownTones]);

  if (editing) {
    return (
      <div className="relative">
        <textarea
          ref={taRef}
          rows={2}
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
          placeholder={t('compare.tonePlaceholder')}
          data-testid={`comparison-tone-editor-${entryId}`}
          aria-label={t('compare.editTone')}
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-0.5 z-10 bg-popover border border-border rounded shadow-md max-h-32 overflow-y-auto min-w-[120px]">
            {suggestions.map((tone, index) => (
              <button
                key={tone}
                type="button"
                data-testid={`comparison-tone-suggestion-${index}`}
                className="block w-full text-left px-2 py-1 text-xs hover:bg-accent cursor-pointer"
                // preventDefault on mousedown keeps focus on the textarea so
                // the browser never fires its blur (and thus never commits)
                // before the click below fills in the chosen tone.
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  setDraft(tone);
                }}
              >
                {tone}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const preview = initialValue.trim();
  const truncated =
    preview.length > TONE_PREVIEW_CHARS ? `${preview.slice(0, TONE_PREVIEW_CHARS)}…` : preview;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={cn(
        'mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors max-w-full',
        // The "+ Tone" ghost affordance only reveals on row hover/focus (mirrors
        // the row's other hover-only actions); an already-set tone is real
        // content, not noise, so it stays visible.
        !preview && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
      )}
      data-testid={`comparison-tone-toggle-${entryId}`}
      aria-label={preview ? t('compare.editTone') : t('compare.addTone')}
    >
      {preview ? (
        <>
          <Pencil className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate italic">{truncated}</span>
        </>
      ) : (
        <span>{t('compare.addTone')}</span>
      )}
    </button>
  );
}
