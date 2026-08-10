/**
 * The keyboard-shortcuts help popover for the Comparison tab. Takes no props and
 * holds no state — split out of ComparisonTab.tsx's toolbar so the toolbar reads
 * as a list of controls rather than an inline legend.
 *
 * The `<dt>` glyphs (T, R, C, Enter, ↑ / ↓, Esc) are key names, not prose: they
 * stay literal in every locale. Only the `<dd>` descriptions are translated.
 */
import { Keyboard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export function ComparisonKeyboardShortcuts(): React.JSX.Element {
  const { t } = useTranslation('strings');

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="px-2"
            aria-label={t('shortcuts.title')}
            data-testid="comparison-keyboard-shortcuts"
          >
            <Keyboard className="w-3.5 h-3.5" />
          </Button>
        }
      />
      <PopoverContent side="bottom" align="end" className="w-72 p-3">
        <p className="text-xs font-semibold mb-2">{t('shortcuts.title')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="font-mono text-muted-foreground">T</dt>
          <dd>{t('shortcuts.retranslate')}</dd>
          <dt className="font-mono text-muted-foreground">R</dt>
          <dd>{t('shortcuts.markReviewed')}</dd>
          <dt className="font-mono text-muted-foreground">C</dt>
          <dd>{t('shortcuts.clearTranslation')}</dd>
          <dt className="font-mono text-muted-foreground">Enter</dt>
          <dd>{t('shortcuts.enterEditMode')}</dd>
          <dt className="font-mono text-muted-foreground">↑ / ↓</dt>
          <dd>{t('shortcuts.navigateRows')}</dd>
          <dt className="font-mono text-muted-foreground">Esc</dt>
          <dd>{t('shortcuts.cancelEditing')}</dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}
