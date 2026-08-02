/**
 * The keyboard-shortcuts help popover for the Comparison tab. Fully static
 * (no props, no state) — split out of ComparisonTab.tsx's toolbar verbatim so
 * the toolbar reads as a list of controls rather than an inline legend.
 */
import { Keyboard } from 'lucide-react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export function ComparisonKeyboardShortcuts(): React.JSX.Element {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            aria-label="Keyboard shortcuts"
            data-testid="comparison-keyboard-shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
        }
      />
      <PopoverContent side="bottom" align="end" className="w-72 p-3">
        <p className="text-xs font-semibold mb-2">Keyboard shortcuts</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="font-mono text-muted-foreground">T</dt>
          <dd>Retranslate</dd>
          <dt className="font-mono text-muted-foreground">R</dt>
          <dd>Mark as reviewed</dd>
          <dt className="font-mono text-muted-foreground">C</dt>
          <dd>Clear translation</dd>
          <dt className="font-mono text-muted-foreground">Enter</dt>
          <dd>Enter edit mode</dd>
          <dt className="font-mono text-muted-foreground">↑ / ↓</dt>
          <dd>Navigate between rows</dd>
          <dt className="font-mono text-muted-foreground">Esc</dt>
          <dd>Cancel editing</dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
