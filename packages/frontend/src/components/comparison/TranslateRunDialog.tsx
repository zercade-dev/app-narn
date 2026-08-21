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
import { AdvancedToggle } from '../common/AdvancedToggle.js';
import { useDialogSettings } from '../../hooks/use-dialog-settings.js';
import { hasNonDefaultValues } from '../../lib/advanced-modified.js';
import {
  asGroupingChoice,
  BatchGroupingControls,
  type GroupingChoice,
} from '../config/BatchGroupingControls.js';
import { ExampleEntryPicker, type ExampleCandidate } from './ExampleEntryPicker.js';

/** Last-used per-browser values (backlog: settings per modal). reTranslate and
 * exampleIds are deliberately NOT persisted: destructive mode choice / entry-specific. */
const TRANSLATE_RUN_SETTINGS_DEFAULTS = {
  advanced: false,
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
   * greater than 0, a warning is always shown (a consequence disclosure) ALONGSIDE
   * the "disable memory for this run" toggle — unlike the rest of this dialog's
   * tuning, that toggle is never gated behind Advanced, because it is the one
   * control that can make the warning's own claim false. Hiding it there while
   * a persisted `disableMemory: true` still applied would tell the user N
   * entries will reuse memory when every one of them is actually about to be
   * re-sent to the model. The toggle's choice is reported via `onStart`'s
   * `disableMemory`.
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
  // Everything below the mode radio is tuning, not the choice that defines the
  // run — hidden behind this until ticked. Only its own visibility is gated;
  // the values it wraps are never reset by hiding it (see the open-reset block).
  const [advanced, setAdvanced] = useState(false);
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
      setAdvanced(stored.advanced);
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

  // disableMemory is excluded: it renders under the memory-warning block
  // ({memoryCount > 0 && (…)} — never gated on `advanced`), not inside
  // {advanced && (…)}.
  // useReference/splitByModel/exampleIds are further gated on the same props
  // that gate their own controls (showReference, localModelCount >= 2,
  // enableExamples): useDialogSettings('translate-run', …) shares ONE
  // storage key across every mount of this dialog (e.g. the Strings tab
  // mounts with showReference={false}), so a value persisted by a mount
  // where the control WAS visible must not count toward the badge on a
  // mount where it isn't — that control's state can't be "modified" here
  // if the user could never have touched it from this screen.
  // ignoreLimit/customBatchSize are gated on `grouping`, mirroring the
  // condition BatchGroupingControls itself uses to show/hide each one.
  // exampleIds isn't in TRANSLATE_RUN_SETTINGS_DEFAULTS (deliberately not
  // persisted — see the comment above that constant), so it's compared
  // against a literal empty-array default here instead.
  const advancedDefaults = { ...TRANSLATE_RUN_SETTINGS_DEFAULTS, exampleIds: [] as string[] };
  const advancedModified = hasNonDefaultValues(
    {
      ...(showReference ? { useReference } : {}),
      grouping,
      ...(grouping === 'custom' ? { customBatchSize } : {}),
      ...(grouping !== 'default' && grouping !== 'custom' ? { ignoreLimit } : {}),
      ...(localModelCount >= 2 ? { splitByModel } : {}),
      ...(enableExamples ? { exampleIds } : {}),
    },
    advancedDefaults,
  );

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
          <div className="border-t pt-3">
            <AdvancedToggle
              id="comparison-translate-advanced"
              testId="comparison-translate-advanced"
              checked={advanced}
              modified={advancedModified}
              onCheckedChange={setAdvanced}
              label={t('compare.translateAdvancedOptions')}
            />
          </div>
          {advanced && (
            <>
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
            </>
          )}
          {/* A consequence disclosure (what this run will actually do — reuse
              stored translations instead of calling the model), unconditional
              even while Advanced is collapsed. The "disable memory for this
              run" toggle beside it stays UNGATED too, deliberately breaking
              the "tuning hides behind Advanced" pattern the rest of this
              dialog follows: it is the one control whose hidden state could
              make the warning's own claim false (a persisted disableMemory:true
              would otherwise tell the user N entries reuse memory while every
              one is actually re-sent to the model — real spend on a BYOK
              product). Always showing it keeps the claim and the control that
              governs it in the same place, so they can't drift apart again. */}
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
                advanced,
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
