/**
 * Per-run AI-generation context controls, shared by the glossary generator
 * dialog and the category generator panel: which entry fields to include,
 * which active languages' finished translations to attach, and the batch
 * grouping / size choice (delegated to the shared BatchGroupingControls).
 */
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { EntryContextField } from '@zercade-dev/narn-shared';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { MultiSelect } from '../ui/multi-select.js';
import { BatchGroupingControls, type GroupingChoice } from '../config/BatchGroupingControls.js';

export interface GenerationContextValue {
  contextFields: EntryContextField[];
  contextLanguages: string[];
  /** Per-run related-entry grouping choice; 'default' = project/workspace. */
  grouping: GroupingChoice;
  /** Shown/used only when `grouping` is a non-default, non-custom dimension. */
  ignoreLimit: boolean;
  /** Entries per batch when `grouping === 'custom'`; 0 = send everything in one request. */
  customBatchSize: number;
  /** Categories whose entries are excluded from the request entirely. */
  skipCategories: string[];
  /**
   * Existing glossaries whose terms are excluded from the request as reference
   * material (e.g. sent as "already known" so the model doesn't re-derive them).
   */
  ignoreGlossaries: string[];
}

/** Minimal shape needed to render a glossary option (a `GlossarySummary` satisfies it). */
export interface GenerationContextGlossaryOption {
  id: string;
  name: string;
}

export interface GenerationContextControlsProps {
  readonly value: GenerationContextValue;
  readonly onChange: (next: GenerationContextValue) => void;
  readonly activeLanguages: readonly string[];
  /** Project's known categories; the "skip categories" section renders only when non-empty. */
  readonly availableCategories?: readonly string[];
  /** Project's glossaries; the "ignore glossaries" section renders only when non-empty. */
  readonly availableGlossaries?: readonly GenerationContextGlossaryOption[];
  /** Rendered inside the "send translations as context" section, below the
   *  language checkboxes (e.g. the glossary dialog's extract-translations
   *  toggle, which only takes effect when a context language is checked). */
  readonly languagesExtra?: ReactNode;
}

const FIELDS: { key: EntryContextField; labelKey: string }[] = [
  { key: 'context', labelKey: 'fieldContext' },
  { key: 'sources', labelKey: 'fieldSources' },
  { key: 'categories', labelKey: 'fieldCategories' },
];

export function GenerationContextControls({
  value,
  onChange,
  activeLanguages,
  availableCategories,
  availableGlossaries,
  languagesExtra,
}: GenerationContextControlsProps): React.JSX.Element {
  const { t } = useTranslation('generation');

  const toggleField = (field: EntryContextField, on: boolean) =>
    onChange({
      ...value,
      contextFields: on
        ? [...value.contextFields, field]
        : value.contextFields.filter((f) => f !== field),
    });

  const toggleLanguage = (lang: string, on: boolean) =>
    onChange({
      ...value,
      contextLanguages: on
        ? [...value.contextLanguages, lang]
        : value.contextLanguages.filter((l) => l !== lang),
    });

  const allLanguagesSelected =
    activeLanguages.length > 0 &&
    activeLanguages.every((lang) => value.contextLanguages.includes(lang));

  const toggleAllLanguages = () =>
    onChange({
      ...value,
      contextLanguages: allLanguagesSelected ? [] : [...activeLanguages],
    });

  return (
    <div className="space-y-3" data-testid="generation-context-controls">
      <div className="space-y-1.5">
        <Label>{t('contextLabel')}</Label>
        <p className="text-xs text-muted-foreground">{t('contextHint')}</p>
        <div className="flex flex-col gap-1.5">
          {FIELDS.map(({ key, labelKey }) => (
            <label
              key={key}
              className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <Checkbox
                checked={value.contextFields.includes(key)}
                onCheckedChange={(checked) => toggleField(key, checked === true)}
                data-testid={`gen-ctx-field-${key}`}
              />
              {t(labelKey)}
            </label>
          ))}
        </div>
      </div>

      {activeLanguages.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>{t('languagesLabel')}</Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={toggleAllLanguages}
              data-testid="gen-ctx-lang-toggle-all"
            >
              {allLanguagesSelected ? t('deselectAllLanguages') : t('selectAllLanguages')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('languagesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {activeLanguages.map((lang) => (
              <label
                key={lang}
                className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
              >
                <Checkbox
                  checked={value.contextLanguages.includes(lang)}
                  onCheckedChange={(checked) => toggleLanguage(lang, checked === true)}
                  data-testid={`gen-ctx-lang-${lang}`}
                />
                {lang}
              </label>
            ))}
          </div>
          {languagesExtra}
        </div>
      )}

      <BatchGroupingControls
        idPrefix="gen-ctx-grouping"
        grouping={value.grouping}
        onGroupingChange={(grouping) => onChange({ ...value, grouping })}
        ignoreLimit={value.ignoreLimit}
        onIgnoreLimitChange={(ignoreLimit) => onChange({ ...value, ignoreLimit })}
        customBatchSize={value.customBatchSize}
        onCustomBatchSizeChange={(customBatchSize) => onChange({ ...value, customBatchSize })}
      />

      {availableCategories && availableCategories.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="gen-ctx-skip-categories">{t('skipCategoriesLabel')}</Label>
          <p className="text-xs text-muted-foreground">{t('skipCategoriesHint')}</p>
          <MultiSelect
            id="gen-ctx-skip-categories"
            triggerTestId="gen-ctx-skip-categories-trigger"
            itemTestId={(cat) => `gen-ctx-skip-category-${cat}`}
            value={value.skipCategories}
            onValueChange={(next) => onChange({ ...value, skipCategories: next })}
            options={availableCategories.map((cat) => ({ value: cat, label: cat }))}
            placeholder={t('skipCategoriesPlaceholder')}
          />
        </div>
      )}

      {availableGlossaries && availableGlossaries.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="gen-ctx-ignore-glossaries">{t('ignoreGlossariesLabel')}</Label>
          <p className="text-xs text-muted-foreground">{t('ignoreGlossariesHint')}</p>
          <MultiSelect
            id="gen-ctx-ignore-glossaries"
            triggerTestId="gen-ctx-ignore-glossaries-trigger"
            itemTestId={(id) => `gen-ctx-ignore-glossary-${id}`}
            value={value.ignoreGlossaries}
            onValueChange={(next) => onChange({ ...value, ignoreGlossaries: next })}
            options={availableGlossaries.map((g) => ({ value: g.id, label: g.name }))}
            placeholder={t('ignoreGlossariesPlaceholder')}
          />
        </div>
      )}
    </div>
  );
}
