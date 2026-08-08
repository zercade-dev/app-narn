/**
 * ComboboxInput — a searchable input backed by a shadcn/Base UI Combobox
 * dropdown. Used for module config fields whose manifest schema declares
 * `suggestions` (for example, the Copilot `model` field).
 *
 * Each suggestion may be a plain string or a `{ label, value }` object.
 * The dropdown shows the human-readable label while selecting fills the
 * input with the value (ID). Free text is accepted — any string typed by the
 * user is a valid value even if it isn't in the suggestion list — and it
 * survives closing the dropdown as long as no suggestion is currently
 * selected. KNOWN LIMITATION: if a suggestion WAS previously selected and the
 * user then types over it without picking another, base-ui restores the old
 * selection's label when the dropdown closes. That is pre-existing base-ui
 * behaviour and is not handled here (see `handleInputValueChange`).
 */
import * as React from 'react';
import type { ComboboxRootChangeEventDetails } from '@base-ui/react';
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
  // single-mode with the input OUTSIDE the popup, so with NO selection that
  // label is '' — base-ui emits `onInputValueChange('', { reason: 'input-clear' })`
  // and silently wipes the typed text ~100ms after the popup closes. That is
  // the case dropped below, and nothing else in this wrapper produces
  // `input-clear`: ordinary typing (including deleting back to empty) reports
  // `input-change`, picking an item reports `item-press`, and the base-ui Clear
  // button — which reports `clear-press` anyway — is never rendered
  // (`showClear` defaults to false and this wrapper never sets it).
  //
  // NOT fixed here: the sibling revert, where a suggestion IS selected and the
  // user types over it without picking another. base-ui restores the previous
  // selection's label with reason `none`, overwriting the typed text just the
  // same. That is long-standing base-ui behaviour, it is what makes a normal
  // suggestion pick sync the input, and separating the two would need selection
  // state this wrapper doesn't track — so it is left alone.
  //
  // Suppression is an early return rather than `details.cancel()` because the
  // input is fully controlled by the caller's `value`: not calling back leaves
  // the rendered value untouched, which is exactly the wanted outcome.
  const handleInputValueChange = React.useCallback(
    (next: string, details: ComboboxRootChangeEventDetails) => {
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
