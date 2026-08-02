/**
 * Presentational reasoning-effort dropdown shared by every reasoning-effort
 * picker in the config UI (the standalone `ModuleReasoningEffortSelect`, the
 * config panel's `ModuleReasoningEffortSection`, and the inline copilot block).
 *
 * It is purely controlled: callers pass the list of supported efforts and the
 * current value, and receive the chosen effort back (`''` for the model
 * default). It does not fetch models or hide itself — callers decide when to
 * render it.
 */
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

/** Title-cases an effort id for display (`high` → "High"). */
function effortLabel(effort: string): string {
  return effort.charAt(0).toUpperCase() + effort.slice(1);
}

export interface ReasoningEffortSelectProps {
  /** Efforts the selected model advertises (already filtered/ordered by caller). */
  supported: string[];
  /** Current effort value; `''`/undefined means "model default". */
  value: string | undefined;
  /** Called with the new effort, or `''` when "Default" is chosen. */
  onChange: (value: string) => void;
  /** Id for the trigger (label association). */
  id: string;
  /** Label text (already translated by the caller). */
  label: string;
  /** Trigger width class; defaults to `w-full`. */
  triggerClassName?: string;
  /** data-testid for the trigger element. */
  triggerTestId?: string;
  /**
   * When true, render an explicit "Disabled" item (and drop any `disabled`
   * entry from `supported`) so users can turn reasoning back off after picking
   * an effort. Used by the copilot block.
   */
  includeDisabledItem?: boolean;
  disabled?: boolean;
}

export function ReasoningEffortSelect({
  supported,
  value,
  onChange,
  id,
  label,
  triggerClassName = 'w-full',
  triggerTestId,
  includeDisabledItem,
  disabled,
}: Readonly<ReasoningEffortSelectProps>): React.JSX.Element {
  const { t } = useTranslation('config');
  const efforts = includeDisabledItem
    ? supported.filter((effort) => effort !== 'disabled')
    : supported;

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || '__default__'}
        onValueChange={(v) => {
          if (typeof v === 'string') onChange(v === '__default__' ? '' : v);
        }}
        disabled={disabled}
      >
        <SelectTrigger className={triggerClassName} id={id} data-testid={triggerTestId}>
          {/*
           * WORKAROUND: Base UI @base-ui/react v1.5.0 Select.Value renders an
           * empty string when passed static string children inside a
           * freshly-opened Collapsible.Panel (keepMounted=false). Render the
           * display text directly until the upstream issue is resolved.
           */}
          <span data-slot="select-value" className="flex flex-1 text-left">
            {!value ? t('module.reasoningEffortDefault') : effortLabel(value)}
          </span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">{t('module.reasoningEffortDefault')}</SelectItem>
          {includeDisabledItem && (
            <SelectItem value="disabled">{t('module.reasoningEffortDisabled')}</SelectItem>
          )}
          {efforts.map((effort) => (
            <SelectItem key={effort} value={effort}>
              {effortLabel(effort)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
