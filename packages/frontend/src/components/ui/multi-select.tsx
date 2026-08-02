import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  /** Selected option values. */
  value: readonly string[];
  onValueChange: (next: string[]) => void;
  options: readonly MultiSelectOption[];
  id?: string;
  className?: string;
  /** data-testid applied to the trigger. */
  triggerTestId?: string;
  /** data-testid applied to each option, given its value. */
  itemTestId?: (value: string) => string;
  /** Shown when nothing is selected. */
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A `<Select multiple>` whose trigger shows the comma-joined LABELS of every
 * selected value (falling back to `placeholder` when nothing is selected),
 * built on the shared base-ui `Select` wrapper (`ui/select.tsx`) — which
 * already supports `multiple` natively (array value, toggle-on-click, popup
 * stays open) — rather than a bespoke checkbox-list. Shared by the "skip
 * categories" and "ignore glossaries" pickers in `GenerationContextControls`,
 * and reusable anywhere else a project-scoped multi-pick dropdown is needed.
 */
export function MultiSelect({
  value,
  onValueChange,
  options,
  id,
  className = 'w-full',
  triggerTestId,
  itemTestId,
  placeholder,
  disabled,
}: Readonly<MultiSelectProps>) {
  const selected = new Set(value);
  return (
    <Select
      multiple
      value={[...value]}
      onValueChange={(next) => onValueChange(next ?? [])}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} data-testid={triggerTestId}>
        <SelectValue placeholder={placeholder}>
          {(selectedValues: string[] | null) => {
            const chosen = selectedValues ?? [];
            if (chosen.length === 0) return placeholder ?? '';
            return options
              .filter((o) => selected.has(o.value) && chosen.includes(o.value))
              .map((o) => o.label)
              .join(', ');
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} data-testid={itemTestId?.(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
