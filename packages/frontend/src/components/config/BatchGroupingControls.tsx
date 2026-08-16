/**
 * Reusable per-run batch-grouping controls: a dimension select (with a
 * "use workspace setting" default that sends no override) plus either an
 * "ignore batch size limit" checkbox (non-custom dimensions) or a numeric
 * "entries per batch" input (the 'custom' dimension), shown only when an
 * explicit choice is made. Used by the Translate, AI-review (translation +
 * source), and AI-generation (glossary, category) dialogs so a run can
 * override the project/workspace grouping — or set an exact batch size —
 * without changing saved config.
 */
import { useTranslation } from 'react-i18next';
import { BATCH_GROUPING_DIMENSIONS, type BatchGroupingDimension } from '@zercade-dev/narn-shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Sentinel for "inherit the project/workspace batch-grouping setting", plus the numeric-cap escape hatch. */
export type GroupingChoice = BatchGroupingDimension | 'default' | 'custom';

/** All accepted GroupingChoice values, for validating persisted settings. */
const GROUPING_CHOICES: readonly GroupingChoice[] = [
  'default',
  'custom',
  ...BATCH_GROUPING_DIMENSIONS,
];

/** Coerces an untrusted (persisted) value to a GroupingChoice, falling back to 'default'. */
export function asGroupingChoice(value: unknown): GroupingChoice {
  return GROUPING_CHOICES.includes(value as GroupingChoice) ? (value as GroupingChoice) : 'default';
}

interface BatchGroupingControlsProps {
  grouping: GroupingChoice;
  onGroupingChange: (value: GroupingChoice) => void;
  ignoreLimit: boolean;
  onIgnoreLimitChange: (value: boolean) => void;
  /** Entries per provider call when `grouping === 'custom'`; 0 = send everything in one request. */
  customBatchSize: number;
  /** Called with the new value as the user types. */
  onCustomBatchSizeChange: (value: number) => void;
  /** Prefix for element ids / test ids so multiple instances stay unique. */
  idPrefix?: string;
}

export function BatchGroupingControls({
  grouping,
  onGroupingChange,
  ignoreLimit,
  onIgnoreLimitChange,
  customBatchSize,
  onCustomBatchSizeChange,
  idPrefix = 'batch-grouping',
}: Readonly<BatchGroupingControlsProps>) {
  const { t } = useTranslation('config');
  const groupingLabel = (value: GroupingChoice): string => {
    switch (value) {
      case 'none':
        return t('batchGroupingNone');
      case 'category':
        return t('batchGroupingCategory');
      case 'glossary':
        return t('batchGroupingGlossary');
      case 'both':
        return t('batchGroupingBoth');
      case 'tone':
        return t('batchGroupingTone');
      case 'custom':
        return t('batchGroupingCustom');
      default:
        return t('batchGroupingDefaultOption');
    }
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${idPrefix}-trigger`}>{t('batchGroupingLabel')}</Label>
      <Select value={grouping} onValueChange={(v) => onGroupingChange(v as GroupingChoice)}>
        <SelectTrigger
          id={`${idPrefix}-trigger`}
          className="w-full"
          data-testid={`${idPrefix}-select`}
        >
          <SelectValue>{(value) => groupingLabel(value as GroupingChoice)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">{t('batchGroupingDefaultOption')}</SelectItem>
          <SelectItem value="none">{t('batchGroupingNone')}</SelectItem>
          <SelectItem value="category">{t('batchGroupingCategory')}</SelectItem>
          <SelectItem value="glossary">{t('batchGroupingGlossary')}</SelectItem>
          <SelectItem value="both">{t('batchGroupingBoth')}</SelectItem>
          <SelectItem value="tone">{t('batchGroupingTone')}</SelectItem>
          <SelectItem value="custom">{t('batchGroupingCustom')}</SelectItem>
        </SelectContent>
      </Select>
      {grouping === 'custom' ? (
        <div className="space-y-1 pt-0.5">
          <label htmlFor={`${idPrefix}-custom-size`} className="text-sm cursor-pointer select-none">
            {t('batchGroupingCustomSizeLabel')}
          </label>
          <Input
            id={`${idPrefix}-custom-size`}
            type="number"
            min={0}
            step={1}
            value={customBatchSize}
            onChange={(e) => onCustomBatchSizeChange(Number(e.target.value))}
            className="w-24"
            data-testid={`${idPrefix}-custom-size`}
          />
          <p className="text-xs text-muted-foreground">{t('batchGroupingCustomSizeHint')}</p>
        </div>
      ) : (
        grouping !== 'default' && (
          <span className="inline-flex items-center gap-1.5 pt-0.5">
            <Checkbox
              id={`${idPrefix}-ignore`}
              checked={ignoreLimit}
              onCheckedChange={(checked) => onIgnoreLimitChange(checked === true)}
              data-testid={`${idPrefix}-ignore`}
            />
            <label htmlFor={`${idPrefix}-ignore`} className="text-sm cursor-pointer select-none">
              {t('ignoreBatchSizeLimitLabel')}
            </label>
          </span>
        )
      )}
    </div>
  );
}
