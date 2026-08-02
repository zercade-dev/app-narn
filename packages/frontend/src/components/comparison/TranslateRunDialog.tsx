/**
 * TranslateRunDialog — per-run options for the Comparison tab's batch
 * translate button: untranslated-only vs re-translate, and whether to attach
 * the selected reference language as LLM prompt context. Rendered as a
 * centered modal (see RunsTab's run-details-dialog for the same large-dialog
 * pattern) rather than a bottom sheet, since the example-entries section can
 * grow tall with many candidates/languages.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LANG_NAMES, type BatchGroupingDimension } from '@zercade-dev/narn-shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDialogSettings } from '../../hooks/use-dialog-settings.js';
import {
  asGroupingChoice,
  BatchGroupingControls,
  type GroupingChoice,
} from '../config/BatchGroupingControls.js';
import { ExampleEntryPicker, type ExampleCandidate } from './ExampleEntryPicker.js';

/** Last-used per-browser values (backlog: settings per modal). reTranslate and
 * exampleIds are deliberately NOT persisted: destructive mode choice / entry-specific. */
const TRANSLATE_RUN_SETTINGS_DEFAULTS = {
  useReference: true,
  disableMemory: false,
  grouping: 'default' as string,
  ignoreLimit: false,
  customBatchSize: 20,
  splitByModel: false,
};

interface TranslateRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of entries the run will cover (selected entries, or all in view). */
  scopeCount: number;
  /** True when the scope is an explicit selection rather than the whole view. */
  scopeIsSelection: boolean;
  /** Reference language selected on the tab; empty string when none. */
  referenceLanguage: string;
  onStart: (opts: {
    reTranslate: boolean;
    useReference: boolean;
    disableMemory: boolean;
    batchGrouping?: BatchGroupingDimension;
    ignoreBatchSizeLimit?: boolean;
    customBatchSize?: number;
    splitByModel?: boolean;
    exampleEntryIds?: string[];
  }) => void;
  /**
   * Whether to show the "use reference language as context" section. The
   * strings tab has no reference language, so it passes `false` and ignores
   * the resulting `useReference` flag. Defaults to `true` (comparison tab).
   */
  showReference?: boolean;
  /**
   * Number of (entry, language) pairs in scope that would auto-apply a stored
   * variant from translation memory instead of being sent to the model. When
   * greater than 0, a warning plus a "disable memory for this run" toggle is
   * shown; the choice is reported via `onStart`'s `disableMemory`.
   */
  memoryCount?: number;
  /**
   * Number of DISTINCT local Ollama models the run would route to. When `>= 2`,
   * a "run one local model at a time" toggle is shown; enabling it reports
   * `splitByModel` via `onStart`, so the run processes each model fully and
   * unloads the previous model before the next swap. Defaults to 0 (hidden).
   */
  localModelCount?: number;
  /**
   * Enables the "example entries" (few-shot style reference) section. Off by
   * default; currently only the Multi-language Text tab passes candidates.
   */
  enableExamples?: boolean;
  /** Pre-filtered candidates (translated entries not in the translate scope). */
  exampleCandidates?: ReadonlyArray<ExampleCandidate>;
}

export function TranslateRunDialog({
  open,
  onOpenChange,
  scopeCount,
  scopeIsSelection,
  referenceLanguage,
  onStart,
  showReference = true,
  memoryCount = 0,
  localModelCount = 0,
  enableExamples = false,
  exampleCandidates = [],
}: Readonly<TranslateRunDialogProps>) {
  const { t } = useTranslation('strings');
  const { read: readSettings, save: saveSettings } = useDialogSettings(
    'translate-run',
    TRANSLATE_RUN_SETTINGS_DEFAULTS,
  );
  const [reTranslate, setReTranslate] = useState(false);
  const [useReference, setUseReference] = useState(true);
  const [disableMemory, setDisableMemory] = useState(false);
  const [grouping, setGrouping] = useState<GroupingChoice>('default');
  const [ignoreLimit, setIgnoreLimit] = useState(false);
  const [customBatchSize, setCustomBatchSize] = useState(20);
  const [splitByModel, setSplitByModel] = useState(false);
  const [exampleIds, setExampleIds] = useState<string[]>([]);

  // Reset the per-run options during render whenever the dialog opens.
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      const stored = readSettings();
      setReTranslate(false);
      setUseReference(stored.useReference);
      setDisableMemory(stored.disableMemory);
      setGrouping(asGroupingChoice(stored.grouping));
      setIgnoreLimit(stored.ignoreLimit);
      setCustomBatchSize(stored.customBatchSize);
      setSplitByModel(stored.splitByModel);
      setExampleIds([]);
    }
  }

  const referenceLabel = referenceLanguage
    ? `${LANG_NAMES[referenceLanguage] ?? referenceLanguage} (${referenceLanguage})`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-full max-w-2xl flex-col"
        data-testid="comparison-translate-dialog"
      >
        <DialogHeader>
          <DialogTitle data-testid="comparison-translate-dialog-title">
            {t('compare.translateDialogTitle')}
          </DialogTitle>
          <DialogDescription data-testid="comparison-translate-scope">
            {scopeIsSelection
              ? t('compare.translateScopeSelected', { count: scopeCount })
              : t('compare.translateScopeAll', { count: scopeCount })}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-1">
          <fieldset className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="comparison-translate-mode"
                checked={!reTranslate}
                onChange={() => setReTranslate(false)}
                data-testid="comparison-translate-mode-untranslated"
              />
              {t('compare.translateModeUntranslated')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="radio"
                name="comparison-translate-mode"
                checked={reTranslate}
                onChange={() => setReTranslate(true)}
                data-testid="comparison-translate-mode-retranslate"
              />
              {t('compare.translateModeRetranslate')}
            </label>
          </fieldset>
          {showReference && (
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Checkbox
                  id="comparison-translate-use-reference"
                  checked={Boolean(referenceLanguage) && useReference}
                  disabled={!referenceLanguage}
                  onCheckedChange={(checked) => setUseReference(checked === true)}
                  data-testid="comparison-translate-use-reference"
                />
                <label
                  htmlFor="comparison-translate-use-reference"
                  className="text-sm cursor-pointer select-none"
                >
                  {referenceLanguage
                    ? t('compare.translateUseReference', { language: referenceLabel })
                    : t('compare.translateUseReferenceNone')}
                </label>
              </span>
              {!referenceLanguage && (
                <p className="text-xs text-muted-foreground">
                  {t('compare.translateNoReferenceHint')}
                </p>
              )}
            </div>
          )}
          {memoryCount > 0 && (
            <div
              className="space-y-1.5 rounded-md border border-status-warn/40 bg-status-warn/10 p-2.5"
              data-testid="comparison-translate-memory-warning"
            >
              <p className="text-xs text-status-warn">
                {t('compare.translateMemoryWarning', { count: memoryCount })}
              </p>
              <span className="inline-flex items-center gap-1.5">
                <Checkbox
                  id="comparison-translate-disable-memory"
                  checked={disableMemory}
                  onCheckedChange={(checked) => setDisableMemory(checked === true)}
                  data-testid="comparison-translate-disable-memory"
                />
                <label
                  htmlFor="comparison-translate-disable-memory"
                  className="text-sm cursor-pointer select-none"
                >
                  {t('compare.translateDisableMemory')}
                </label>
              </span>
            </div>
          )}
          <div className="border-t pt-3">
            <BatchGroupingControls
              idPrefix="comparison-translate-grouping"
              grouping={grouping}
              onGroupingChange={setGrouping}
              ignoreLimit={ignoreLimit}
              onIgnoreLimitChange={setIgnoreLimit}
              customBatchSize={customBatchSize}
              onCustomBatchSizeChange={setCustomBatchSize}
            />
            {grouping === 'custom' && (
              <p className="text-xs text-muted-foreground pt-1">
                {t('compare.translateCustomBatchSizeCaveat')}
              </p>
            )}
          </div>
          {enableExamples && (
            <div className="border-t pt-3">
              <ExampleEntryPicker
                candidates={exampleCandidates}
                pickedIds={exampleIds}
                onChange={setExampleIds}
                max={10}
              />
            </div>
          )}
          {localModelCount >= 2 && (
            <div className="space-y-1 border-t pt-3">
              <span className="inline-flex items-center gap-1.5">
                <Checkbox
                  id="comparison-translate-split-by-model"
                  checked={splitByModel}
                  onCheckedChange={(checked) => setSplitByModel(checked === true)}
                  data-testid="comparison-translate-split-by-model"
                />
                <label
                  htmlFor="comparison-translate-split-by-model"
                  className="text-sm cursor-pointer select-none"
                >
                  {t('compare.translateSplitByModel')}
                </label>
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="comparison-translate-cancel"
          >
            {t('compare.translateCancel')}
          </Button>
          <Button
            onClick={() => {
              saveSettings({
                useReference,
                disableMemory,
                grouping,
                ignoreLimit,
                customBatchSize,
                splitByModel,
              });
              onStart({
                reTranslate,
                useReference: showReference && Boolean(referenceLanguage) && useReference,
                disableMemory: memoryCount > 0 && disableMemory,
                // 'default' = inherit project/workspace; omit the per-run override.
                ...(grouping === 'custom'
                  ? { customBatchSize }
                  : grouping !== 'default'
                    ? { batchGrouping: grouping, ignoreBatchSizeLimit: ignoreLimit }
                    : {}),
                ...(localModelCount >= 2 && splitByModel ? { splitByModel: true } : {}),
                ...(enableExamples && exampleIds.length > 0 ? { exampleEntryIds: exampleIds } : {}),
              });
            }}
            disabled={scopeCount === 0}
            data-testid="comparison-translate-start"
          >
            {t('compare.translateStart')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
