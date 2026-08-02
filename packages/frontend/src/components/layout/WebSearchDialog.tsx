/**
 * Global Ctrl+K/Cmd+K web-search command. Mounted once, unconditionally, in
 * the app shell — it owns its own `keydown` listener and dialog state
 * rather than being triggered by a caller, so it works from anywhere in the
 * app regardless of which tab/view is active.
 *
 * Opening re-reads the current selection (via `getActiveSelectionText`) each
 * time, so a stale prefill from a previous open never lingers. Submitting
 * (Enter or the action button) opens a Google search for the query in a new
 * tab and closes the dialog; an empty/whitespace query is a no-op — the
 * dialog stays open so the user can just type instead.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getActiveSelectionText } from '../../lib/selection-text.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function WebSearchDialog(): React.JSX.Element {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Global shortcut: Ctrl+K on Windows/Linux, Cmd+K on macOS. No Alt/Shift —
  // those are reserved for other bindings (e.g. browser/OS combos) and must
  // not accidentally open this dialog.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      setQuery(getActiveSelectionText());
      setOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`,
      '_blank',
      'noopener,noreferrer',
    );
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('webSearch.title')}</DialogTitle>
          <DialogDescription>{t('webSearch.hint')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            data-testid="web-search-input"
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            placeholder={t('webSearch.placeholder') ?? undefined}
          />
          <DialogFooter>
            <Button type="submit" data-testid="web-search-submit">
              {t('webSearch.action')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
