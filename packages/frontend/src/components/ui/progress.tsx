import { cn } from '@/lib/utils';

export interface ProgressProps extends Omit<React.ComponentProps<'div'>, 'role'> {
  /** Current value (0..max). Omit / undefined for an indeterminate bar. */
  value?: number;
  /** Maximum value; defaults to 100. */
  max?: number;
}

/**
 * Minimal determinate/indeterminate progress bar. A track with a filled inner
 * bar; when `value` is undefined it renders an indeterminate pulse so a run
 * with unknown progress still reads as "working".
 */
function Progress({ value, max = 100, className, ...props }: ProgressProps) {
  const indeterminate = value === undefined;
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      {...(indeterminate ? {} : { 'aria-valuenow': value })}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-300 ease-out',
          indeterminate && 'w-1/3 animate-pulse',
        )}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

export { Progress };
