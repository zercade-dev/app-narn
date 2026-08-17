import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface AdvancedToggleProps {
  /** DOM id shared by the checkbox and its label. */
  id: string;
  checked: boolean;
  /** True when the section holds values that differ from the dialog's defaults. */
  modified: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  testId: string;
}

/**
 * The "Advanced options" checkbox every run dialog shares, plus a badge marking
 * a collapsed section that is not empty. Tuning set while the section was open
 * keeps applying after it is collapsed, so without the badge the only signal
 * that a non-default value is in force is expanding the section again.
 *
 * The badge is a translated word, not a coloured dot: colour alone is not an
 * accessible signal, and visible text is its own accessible name.
 *
 * Owns the checkbox, its label and the badge — nothing else. Two dialogs force
 * the section open when a hidden control is blocking Start, and one of those
 * keeps a remembered user preference across the forced open; that logic stays
 * in the dialogs, because it depends on which of their own controls is
 * blocking.
 */
export function AdvancedToggle({
  id,
  checked,
  modified,
  onCheckedChange,
  label,
  testId,
}: AdvancedToggleProps) {
  const { t } = useTranslation('common');
  return (
    <span className="inline-flex items-center gap-1.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        data-testid={testId}
      />
      <Label htmlFor={id} className="cursor-pointer select-none font-normal">
        {label}
      </Label>
      {modified && (
        <span
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
          data-testid={`${testId}-modified`}
        >
          {t('advancedModified')}
        </span>
      )}
    </span>
  );
}
