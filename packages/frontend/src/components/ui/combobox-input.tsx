/**
 * ComboboxInput — a searchable input backed by a shadcn/Base UI Combobox
 * dropdown. Used for module config fields whose manifest schema declares
 * `suggestions` (for example, the Copilot `model` field).
 *
 * Each suggestion may be a plain string or a `{ label, value }` object.
 * The dropdown shows the human-readable label while selecting fills the
 * input with the value (ID). Free text is fully preserved — any string
 * typed by the user is accepted even if it isn't in the suggestion list.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput as ShadcnComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';

export type ComboboxSuggestion = string | { label: string; value: string };

export interface ComboboxInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'list' | 'value' | 'onChange'
> {
  /** Unique id; used to wire the input to its label via htmlFor. */
  id: string;
  /** Curated suggestion list. The input still accepts arbitrary text. */
  suggestions: ReadonlyArray<ComboboxSuggestion>;
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Human-readable label for the current value. When set, it is shown over
   * the input while the field is not focused (the underlying input keeps the
   * raw value, so forms and tests still read the ID). Focusing the field
   * reveals the raw value for free-text editing.
   */
  displayLabel?: string | null;
  /**
   * Text shown when no suggestion matches the typed input. Callers should pass
   * a translated value (e.g. `t('…')`); the default is a generic English
   * fallback for the rare case it's omitted.
   */
  emptyText?: string;
}

type NormalizedSuggestion = { label: string; value: string };

function normalize(s: ComboboxSuggestion): NormalizedSuggestion {
  return typeof s === 'string' ? { label: s, value: s } : s;
}

export function ComboboxInput({
  id,
  suggestions,
  value,
  onValueChange,
  displayLabel,
  emptyText = 'No results.',
  className,
  ...rest
}: ComboboxInputProps) {
  const items = React.useMemo(() => suggestions.map(normalize), [suggestions]);
  const showLabel = displayLabel != null && displayLabel !== '' && value !== '';
  const labelTransparentClass = showLabel
    ? '[&:not(:focus-within)>input]:text-transparent'
    : undefined;

  // Free-text preservation. Base UI's AriaCombobox syncs the input back to the
  // SELECTED item's label once the popup's exit animation finishes
  // (`handleUnmount`, wired up by `useOpenChangeComplete`). Here selection is
  // single-mode with the input OUTSIDE the popup, so when the user typed a value
  // that matches no suggestion there is no selection and that label is '' —
  // base-ui then emits `onInputValueChange('', { reason: 'input-clear' })` and
  // silently wipes the typed text ~100ms after the popup closes.
  //
  // Dropping `input-clear` is safe in this wrapper because nothing else here
  // produces it: ordinary typing (including deleting back to empty) reports
  // `input-change`, picking an item reports `item-press`/`none`, and the base-ui
  // Clear button — which would report `clear-press`, a different reason anyway —
  // is not rendered (`showClear` defaults to false and this wrapper never sets
  // it). The revert after an actual selection carries reason `none`, so
  // selecting a suggestion still syncs the input normally.
  const handleInputValueChange = React.useCallback(
    (next: string, details: { reason: string }) => {
      if (details.reason === 'input-clear') return;
      onValueChange(next);
    },
    [onValueChange],
  );

  // When the user selects an item from the dropdown, `itemToStringLabel`
  // determines what text goes into the input. We want the ID (value) there,
  // not the human-readable label. The combobox items render their own label
  // text via children, so this only affects the input field.
  const handleItemSelect = React.useCallback(
    (selected: unknown) => {
      if (selected != null && typeof selected === 'object' && 'value' in selected) {
        onValueChange((selected as NormalizedSuggestion).value);
      }
    },
    [onValueChange],
  );

  return (
    <Combobox
      items={items}
      itemToStringLabel={(item) => (item as NormalizedSuggestion).value}
      itemToStringValue={(item) => (item as NormalizedSuggestion).value}
      inputValue={value}
      onInputValueChange={handleInputValueChange}
      onValueChange={handleItemSelect}
    >
      <ShadcnComboboxInput
        id={id}
        showTrigger={items.length > 0}
        placeholder={rest.placeholder ?? undefined}
        disabled={rest.disabled}
        data-testid={rest['data-testid' as keyof typeof rest] as string | undefined}
        className={cn(labelTransparentClass, className)}
      >
        {showLabel && (
          <span
            aria-hidden="true"
            data-testid="combobox-selected-label"
            className="pointer-events-none absolute inset-y-0 left-0 flex max-w-[calc(100%-1.75rem)] items-center px-2.5 text-base group-focus-within/input-group:hidden md:text-sm"
          >
            <span className="truncate">{displayLabel}</span>
          </span>
        )}
      </ShadcnComboboxInput>
      {items.length > 0 && (
        <ComboboxContent>
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          <ComboboxList>
            {items.map((item) => (
              <ComboboxItem key={item.value} value={item}>
                <span>{item.label}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {item.value}
                </span>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      )}
    </Combobox>
  );
}
