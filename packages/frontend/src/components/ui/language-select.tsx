import { LANGUAGE_REGISTRY, PSEUDO_LANGUAGE_CODE } from '@zercade-dev/narn-shared';
import type { Language } from '@zercade-dev/narn-shared';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

/** Every user-facing language (the synthetic pseudo-test language excluded). */
export const SUPPORTED_LANGUAGES: readonly Language[] = LANGUAGE_REGISTRY.filter(
  (l) => l.code !== PSEUDO_LANGUAGE_CODE,
);

export interface LanguageSelectProps {
  /** Selected language CODE (e.g. `'en'`). */
  value: string;
  onValueChange: (code: string) => void;
  /** Languages to offer; defaults to every supported language. */
  languages?: readonly Language[];
  id?: string;
  className?: string;
  /** data-testid applied to the trigger. */
  triggerTestId?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A `<Select>` whose value is a language CODE but whose trigger shows the
 * language NAME.
 *
 * base-ui's `<Select.Value>` renders the raw selected value unless it is given a
 * children render-function: the listbox unmounts when the popup is closed, so
 * with no `items` map it cannot resolve a code → label on its own and falls back
 * to printing the code. This wrapper supplies that mapping once, so call sites
 * can't forget it (the recurring "shows `en` instead of English" bug). See
 * `ui/select.tsx`.
 */
export function LanguageSelect({
  value,
  onValueChange,
  languages = SUPPORTED_LANGUAGES,
  id,
  className = 'w-full',
  triggerTestId,
  placeholder,
  disabled,
}: Readonly<LanguageSelectProps>) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next ?? value)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} data-testid={triggerTestId}>
        <SelectValue placeholder={placeholder}>
          {(code: string | null) =>
            languages.find((l) => l.code === code)?.name ?? code ?? placeholder ?? ''
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
