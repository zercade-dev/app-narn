/**
 * One editable source field of the Stage details tab. Owns a local edit
 * buffer initialised from `field`; commits changed values with
 * **save-on-blur** (the chosen single save mechanism — no per-field Save
 * button) via `onSave`, which the parent wires to the stage-details store's
 * `patch`. A small "unsaved" hint appears while the buffer differs from the
 * persisted value.
 *
 * Desktop: textarea for the source text plus an advisory max-length input.
 * Mobile (`isMobile`): strictly read-only — the write affordances are dropped
 * and the field renders as read-only text with a copy button only.
 *
 * `readOnly` forces the same read-only presentation on desktop, used for
 * collaborators — the server requires the `manage` capability to write
 * `sourceText`/`maxLength`, so a collaborator only ever gets the read-only
 * text + copy view (v1.31.1).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StageDetailField, StageDetailFieldId } from '@zercade-dev/narn-shared';
import { Copy, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

export interface SourceFieldEditorProps {
  fieldId: StageDetailFieldId;
  field: StageDetailField;
  isMobile: boolean;
  /**
   * Force read-only presentation on desktop too (collaborators — source
   * writes are owner-only server-side). Mobile is always read-only regardless.
   */
  readOnly?: boolean;
  /** Persist only the changed sub-fields (save-on-blur). */
  onSave: (patch: { sourceText?: string; maxLength?: number | null }) => void;
}

/** Parse the max-length buffer into a positive integer, or null when cleared. */
function parseMaxLength(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export function SourceFieldEditor({
  fieldId,
  field,
  isMobile,
  readOnly = false,
  onSave,
}: Readonly<SourceFieldEditorProps>): React.JSX.Element {
  // Mobile OR a read-only role (collaborator) both collapse to the same
  // read-only text + copy presentation.
  const showReadonly = isMobile || readOnly;
  const { t } = useTranslation('stage-details');
  const [text, setText] = useState(field.sourceText);
  const [maxLen, setMaxLen] = useState<string>(
    field.maxLength != null ? String(field.maxLength) : '',
  );

  // Re-sync the buffer when the persisted field changes underneath us (e.g.
  // after a translate run or an external edit). Uses React's "adjust state
  // during render from a prior render's value" pattern (endorsed over an
  // effect; see AiReviewDialog's prevRunId) so the buffer never lags the store.
  const persistedMax = field.maxLength ?? null;
  const [prev, setPrev] = useState<{ src: string; max: number | null }>({
    src: field.sourceText,
    max: persistedMax,
  });
  if (prev.src !== field.sourceText || prev.max !== persistedMax) {
    setPrev({ src: field.sourceText, max: persistedMax });
    setText(field.sourceText);
    setMaxLen(persistedMax != null ? String(persistedMax) : '');
  }

  // The max-length editor is deliberately opt-in: char limits are unlimited by
  // default in this app, so a "Max length: None" input on every field is noise.
  // Show the input only when a limit is actually set, or once the author reveals
  // it via the unobtrusive "+ limit" affordance (kept sticky for the session so
  // clearing the value back to none while editing doesn't collapse it mid-edit).
  const [limitRevealed, setLimitRevealed] = useState(field.maxLength != null);
  const showLimitEditor = field.maxLength != null || limitRevealed;

  const limit = parseMaxLength(maxLen);
  const over = limit != null && text.length > limit;
  const dirty = text !== field.sourceText || parseMaxLength(maxLen) !== (field.maxLength ?? null);

  const handleTextBlur = () => {
    if (text !== field.sourceText) onSave({ sourceText: text });
  };
  const handleMaxLenBlur = () => {
    const next = parseMaxLength(maxLen);
    if (next !== (field.maxLength ?? null)) onSave({ maxLength: next });
  };

  const handleCopy = () => {
    void navigator.clipboard
      ?.writeText(field.sourceText)
      .then(() => toast.success(t('copied')))
      .catch(() => toast.error(t('copyFailed')));
  };

  return (
    <div className="space-y-1.5" data-testid={`stage-details-source-editor-${fieldId}`}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`stage-details-source-${fieldId}`}>{t(`fields.${fieldId}.label`)}</Label>
        <div className="flex items-center gap-2">
          {!showReadonly && dirty && (
            <span
              className="text-[11px] text-muted-foreground"
              data-testid={`stage-details-unsaved-${fieldId}`}
            >
              {t('unsaved')}
            </span>
          )}
          {limit != null && (
            <span
              className={`text-[11px] tabular-nums ${over ? 'text-destructive' : 'text-muted-foreground'}`}
              data-testid={`stage-details-counter-${fieldId}`}
            >
              {text.length} / {limit}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={t('copySource')}
            data-testid={`stage-details-source-copy-${fieldId}`}
            onClick={handleCopy}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      </div>

      {showReadonly ? (
        <p
          className="whitespace-pre-wrap rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-muted-foreground"
          data-testid={`stage-details-source-readonly-${fieldId}`}
        >
          {field.sourceText || t('empty')}
        </p>
      ) : (
        <>
          <Textarea
            id={`stage-details-source-${fieldId}`}
            data-testid={`stage-details-source-${fieldId}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleTextBlur}
            placeholder={t(`fields.${fieldId}.placeholder`)}
          />
          {showLimitEditor ? (
            <div className="flex items-center gap-2">
              <Label
                htmlFor={`stage-details-maxlength-${fieldId}`}
                className="text-[11px] font-normal text-muted-foreground"
              >
                {t('maxLengthLabel')}
              </Label>
              <Input
                id={`stage-details-maxlength-${fieldId}`}
                data-testid={`stage-details-maxlength-${fieldId}`}
                type="number"
                min={1}
                inputMode="numeric"
                className="h-7 w-24 text-xs"
                value={maxLen}
                onChange={(e) => setMaxLen(e.target.value)}
                onBlur={handleMaxLenBlur}
                placeholder={t('maxLengthNone')}
                autoFocus={limitRevealed && field.maxLength == null}
              />
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px] font-normal text-muted-foreground"
              data-testid={`stage-details-add-limit-${fieldId}`}
              onClick={() => setLimitRevealed(true)}
            >
              <Plus className="size-3" />
              {t('addLimit')}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
