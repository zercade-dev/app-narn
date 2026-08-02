import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import {
  isOfferableModule,
  basesWithInstances,
  type OfferableModuleShape,
} from '../../lib/module-options.js';

/** Minimal shape needed to render a module option (a `ModuleInfo` satisfies it). */
export interface ModuleSelectOption extends OfferableModuleShape {
  id: string;
  name: string;
}

export interface ModuleSelectProps {
  /** Selected module ID. */
  value: string;
  onValueChange: (id: string) => void;
  modules: readonly ModuleSelectOption[];
  id?: string;
  className?: string;
  /** data-testid applied to the trigger. */
  triggerTestId?: string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Escape hatch to render bare instanceable base modules too. Off by default:
   * a picker chooses a module to RUN an operation with, and an operation should
   * always target a named instance (or a non-instanceable base), never a bare
   * instanceable base — so the offerable filter is applied generically here to
   * prevent the "base module shown in a picker" footgun at every call site.
   */
  allowBaseModules?: boolean;
}

/**
 * A `<Select>` whose value is a module ID but whose trigger shows the module
 * NAME. Supplies the base-ui children render-function so the trigger never falls
 * back to printing the raw id when the popup is closed (the same footgun
 * documented in `ui/language-select.tsx` / `ui/select.tsx`).
 */
export function ModuleSelect({
  value,
  onValueChange,
  modules,
  id,
  className,
  triggerTestId,
  placeholder,
  disabled,
  allowBaseModules = false,
}: Readonly<ModuleSelectProps>) {
  // Generic guard: never offer a bare instanceable base module that already has
  // instances (it's managed through them) unless the caller explicitly opts in.
  // Instanceable bases without instances stay offerable. Applied to both the
  // option list and the trigger label so a stale base id selection falls back to
  // the placeholder rather than showing.
  const withInstances = basesWithInstances(modules);
  const offerable = allowBaseModules
    ? modules
    : modules.filter((m) => isOfferableModule(m, withInstances));
  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next ?? value)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className} data-testid={triggerTestId}>
        <SelectValue placeholder={placeholder}>
          {(selected: string | null) =>
            offerable.find((m) => m.id === selected)?.name ?? placeholder ?? ''
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {offerable.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
