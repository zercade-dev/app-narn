import { cn } from '@/lib/utils';

/**
 * A language code rendered as the signature mono chip (machine text is
 * monospaced). Shared by the config and review surfaces, which previously each
 * defined an identical local copy.
 */
export function LangCodeChip({
  code,
  className,
}: Readonly<{ code: string; className?: string }>): React.JSX.Element {
  return (
    <span
      className={cn(
        'rounded bg-muted px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide',
        className,
      )}
    >
      {code}
    </span>
  );
}
