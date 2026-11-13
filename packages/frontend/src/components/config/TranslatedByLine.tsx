import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useProjectProvider } from '../../hooks/use-project-provider.js';
import { isPaidProvider, providerName } from '../../lib/simple-provider.js';
import { TranslationProviderCard } from './TranslationProviderCard.js';

/** The provider card in a side sheet, for "Change" where the Config tab is not on screen. */
export function ProviderSheet({
  projectId,
  open,
  onOpenChange,
}: Readonly<{ projectId: string; open: boolean; onOpenChange: (open: boolean) => void }>) {
  const { t } = useTranslation('config');
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="provider-sheet" className="overflow-y-auto p-4">
        <SheetTitle className="sr-only">{t('providerCard.title')}</SheetTitle>
        <TranslationProviderCard projectId={projectId} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * "Translated by <provider> · Change", with a cost note for a paid provider:
 * says who will translate before anything is sent. `onChange` replaces the
 * built-in sheet, for a caller that must take something off screen first (the
 * guide's callout).
 */
export function TranslatedByLine({
  projectId,
  onChange,
}: Readonly<{ projectId: string | null; onChange?: () => void }>) {
  const { t } = useTranslation('config');
  const { provider } = useProjectProvider(projectId);
  const [open, setOpen] = useState(false);
  if (projectId === null || provider === null) return null;

  const label =
    provider.kind === 'custom'
      ? t('providerCard.translatedByCustom')
      : t('providerCard.translatedBy', {
          provider:
            provider.kind === 'own' ? providerName(provider.moduleId) : t('providerCard.freeway'),
        });
  return (
    <div className="space-y-0.5 text-xs" data-testid="translated-by-line">
      <p className="flex flex-wrap items-center gap-1">
        <span data-testid="translated-by" className="text-muted-foreground">
          {label}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <Button
          variant="link"
          size="xs"
          className="h-auto px-0"
          data-testid="translated-by-change"
          onClick={() => (onChange ? onChange() : setOpen(true))}
        >
          {t('providerCard.change')}
        </Button>
      </p>
      {provider.kind === 'own' && isPaidProvider(provider.moduleId) && (
        <p className="text-status-warn" data-testid="translated-by-cost">
          {t('providerCard.paidNote', { provider: providerName(provider.moduleId) })}
        </p>
      )}
      {!onChange && <ProviderSheet projectId={projectId} open={open} onOpenChange={setOpen} />}
    </div>
  );
}
