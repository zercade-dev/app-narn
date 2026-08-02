import { useTranslation } from 'react-i18next';
import { FolderOpen } from 'lucide-react';
import { Card } from '../ui/card.js';
import { Button } from '../ui/button.js';

/**
 * Shared "no project selected" empty state for project-scoped tabs. Replaces
 * the bare top-left placeholder sentences each tab used to render when
 * `activeProject` is null. Centered card idiom (icon + message + CTA).
 *
 * The CTA reuses the sidebar's existing project-selector popover by triggering
 * its trigger button (there is no global store for the popover's open state —
 * it is local to the Sidebar — so a scoped DOM trigger is the reuse path),
 * then focusing it so keyboard users land on the opened control.
 *
 * `message` is the caller-supplied placeholder string (each tab passes its own
 * already-translated per-tab placeholder), so no per-tab copy is lost.
 */
export function NoProjectEmptyState({ message }: Readonly<{ message: string }>) {
  const { t } = useTranslation('strings');
  const openProjectSelector = () => {
    const trigger = document.querySelector<HTMLElement>('[data-testid="project-selector-trigger"]');
    trigger?.click();
    trigger?.focus();
  };
  return (
    <div
      data-testid="no-project-empty-state"
      className="flex h-full min-h-0 flex-1 items-center justify-center p-4"
    >
      <Card className="flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FolderOpen className="size-6" aria-hidden="true" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button
          type="button"
          size="sm"
          onClick={openProjectSelector}
          data-testid="no-project-open-selector"
        >
          {t('selectProjectCta')}
        </Button>
      </Card>
    </div>
  );
}
