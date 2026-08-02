/**
 * Per-language translations view of the Stage details tab. A tab strip
 * selects one target language; the three fields' translations for that
 * language render below, each with an attribution line (`moduleId · date`),
 * a stale badge when the source was edited after the translation was
 * produced (`isStaleTranslation`), and a copy button.
 *
 * Desktop: each translation is an editable textarea committed **on blur** (the
 * same save-on-blur mechanism the source editors use) via `onSaveTranslation`.
 * Mobile (`isMobile`): strictly read-only — translations render as text with a
 * copy button only, no editable inputs.
 *
 * Collaborators (`isCollaborator`) may only edit languages in
 * `writableLanguages` (mirrors the server's per-language write capability on
 * `PATCH .../stage-details`); every other language renders read-only text +
 * copy, exactly like mobile. Owners edit every language. Stale badges and
 * attribution stay visible to everyone (v1.31.1).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STAGE_DETAIL_FIELD_IDS,
  isStaleTranslation,
  type StageDetails,
  type StageDetailFieldId,
} from '@zercade-dev/narn-shared';
import { Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/toast';

export interface TranslationsPanelProps {
  languages: string[];
  selectedLang: string | null;
  onSelectLang: (lang: string) => void;
  stageDetails: StageDetails;
  isMobile: boolean;
  /** True when the current viewer is a language-scoped collaborator (not the owner). */
  isCollaborator: boolean;
  /** Languages this collaborator may write (ignored when not a collaborator). */
  writableLanguages: string[];
  /** Persist one field's translation text for the selected language (save-on-blur). */
  onSaveTranslation: (fieldId: StageDetailFieldId, lang: string, text: string) => void;
}

/** Single field's translation cell for the selected language. */
function TranslationCell({
  fieldId,
  lang,
  stageDetails,
  readOnly,
  onSaveTranslation,
}: Readonly<{
  fieldId: StageDetailFieldId;
  lang: string;
  stageDetails: StageDetails;
  /** Read-only presentation (mobile, or a language this collaborator can't write). */
  readOnly: boolean;
  onSaveTranslation: (fieldId: StageDetailFieldId, lang: string, text: string) => void;
}>): React.JSX.Element {
  const { t } = useTranslation('stage-details');
  const field = stageDetails[fieldId];
  const translation = field.translations[lang];
  const persisted = translation?.text ?? '';
  const [text, setText] = useState(persisted);

  // Re-sync when switching language or after an external write (translate run),
  // using the "adjust state during render" pattern (endorsed over an effect) so
  // the buffer tracks the store without a set-state-in-effect cascade.
  const syncKey = `${lang}\u0000${persisted}`;
  const [prevSyncKey, setPrevSyncKey] = useState(syncKey);
  if (prevSyncKey !== syncKey) {
    setPrevSyncKey(syncKey);
    setText(persisted);
  }

  const stale = isStaleTranslation(field, lang);
  const handleBlur = () => {
    if (text !== (translation?.text ?? '')) onSaveTranslation(fieldId, lang, text);
  };
  const handleCopy = () => {
    void navigator.clipboard
      ?.writeText(translation?.text ?? '')
      .then(() => toast.success(t('copied')))
      .catch(() => toast.error(t('copyFailed')));
  };

  return (
    <div className="space-y-1.5" data-testid={`stage-details-translation-cell-${fieldId}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t(`fields.${fieldId}.label`)}</span>
          {stale && (
            <Badge
              variant="outline"
              className="border-status-warn/40 bg-status-warn/10 text-status-warn"
              data-testid={`stage-details-stale-badge-${fieldId}`}
            >
              {t('stale')}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={t('copyTranslation')}
          data-testid={`stage-details-translation-copy-${fieldId}`}
          onClick={handleCopy}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>

      {readOnly ? (
        <p
          className="whitespace-pre-wrap rounded-lg border border-input bg-input/30 px-2.5 py-2 text-sm text-muted-foreground"
          data-testid={`stage-details-translation-${fieldId}`}
        >
          {translation?.text || t('noTranslation')}
        </p>
      ) : (
        <Textarea
          data-testid={`stage-details-translation-${fieldId}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          placeholder={t('noTranslation')}
        />
      )}

      {translation && (
        <p
          className="text-[11px] text-muted-foreground"
          data-testid={`stage-details-attribution-${fieldId}`}
        >
          {translation.moduleId} · {new Date(translation.timestamp).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export function TranslationsPanel({
  languages,
  selectedLang,
  onSelectLang,
  stageDetails,
  isMobile,
  isCollaborator,
  writableLanguages,
  onSaveTranslation,
}: Readonly<TranslationsPanelProps>): React.JSX.Element {
  const { t } = useTranslation('stage-details');

  // Translation column of the ≥lg two-column workbench: a row-subgrid whose four
  // rows (header + one per field) share the parent grid's row tracks so each
  // field's translation sits beside its source counterpart. Below lg it collapses
  // to the original stacked, bordered panel (the border/padding is dropped at lg
  // so the label baselines line up flush with the un-bordered source column).
  const sectionClass =
    'rounded-lg border border-border p-3 space-y-4 ' +
    'lg:grid lg:grid-rows-subgrid lg:row-span-4 lg:space-y-0 lg:rounded-none lg:border-0 lg:p-0';

  if (languages.length === 0) {
    return (
      <section className={sectionClass} data-testid="stage-details-translations">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{t('translationsHeading')}</h3>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="stage-details-no-languages">
          {t('noLanguages')}
        </p>
      </section>
    );
  }

  const active = selectedLang && languages.includes(selectedLang) ? selectedLang : languages[0];
  // A collaborator may only edit the active language when it's one they can
  // write; owners edit every language. Mobile forces read-only for everyone.
  const cellReadOnly = isMobile || (isCollaborator && !writableLanguages.includes(active));

  return (
    <section className={sectionClass} data-testid="stage-details-translations">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">{t('translationsHeading')}</h3>
        <div
          className="flex flex-wrap gap-1 border-b border-border"
          role="tablist"
          aria-label={t('languagesLabel')}
        >
          {languages.map((lang) => (
            <button
              key={lang}
              type="button"
              role="tab"
              aria-selected={lang === active}
              data-testid={`stage-details-lang-tab-${lang}`}
              onClick={() => onSelectLang(lang)}
              className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
                lang === active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {STAGE_DETAIL_FIELD_IDS.map((fieldId) => (
        <TranslationCell
          key={fieldId}
          fieldId={fieldId}
          lang={active}
          stageDetails={stageDetails}
          readOnly={cellReadOnly}
          onSaveTranslation={onSaveTranslation}
        />
      ))}
    </section>
  );
}
