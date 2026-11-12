import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/lib/toast';
import { useModules } from '../../hooks/use-modules.js';
import {
  applySimpleRule,
  enableProvider,
  ownProviderChoices,
  providerKeyFor,
} from '../../lib/simple-provider.js';
import { getErrorMessage } from '../../lib/utils.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useProjectStore } from '../../stores/project-store.js';

interface ProviderChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cloud offers key-only providers; GitHub Copilot is local-only. */
  cloud: boolean;
  /**
   * The provider is enabled and remembered. `vaultKey` is the key it reads, so
   * the caller can send the person to the place where it is stored.
   */
  onChosen: (choice: { instanceId: string; vaultKey: string | undefined }) => void;
}

/**
 * "Use my own provider": the one place the guide performs setup for the person.
 * Picking a provider does what the hidden Global Config and Routing tabs would:
 * it enables the provider, remembers it for later projects, and points the
 * current project's routing at it.
 */
export function ProviderChoice({ open, onOpenChange, cloud, onChosen }: ProviderChoiceProps) {
  const { t } = useTranslation('guide-tour');
  const modules = useModules({ enabled: open });
  const [busy, setBusy] = useState<string | null>(null);

  const choose = async (base: string, name: string) => {
    setBusy(base);
    try {
      const instanceId = await enableProvider(base);
      useGuideStore.getState().setSimpleProvider(instanceId);
      // Read after the await: the active project may have changed meanwhile.
      const { projects, activeProjectId } = useProjectStore.getState();
      if (activeProjectId && projects.some((p) => p.id === activeProjectId)) {
        await applySimpleRule(activeProjectId, instanceId);
      }
      const declared = modules.find((m) => m.id === base)?.requiredEnvVars[0];
      onChosen({ instanceId, vaultKey: declared ?? providerKeyFor(base) });
    } catch (err) {
      toast.error(t('providerChoice.failed', { provider: name, message: getErrorMessage(err) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="provider-choice">
        <SheetHeader>
          <SheetTitle>{t('providerChoice.title')}</SheetTitle>
          <SheetDescription>{t('providerChoice.description')}</SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-2 px-4">
          {ownProviderChoices(cloud).map((base) => {
            const name = modules.find((m) => m.id === base)?.name ?? base;
            return (
              <li key={base}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  disabled={busy !== null}
                  data-testid={`provider-choice-${base}`}
                  onClick={() => void choose(base, name)}
                >
                  {name}
                </Button>
              </li>
            );
          })}
        </ul>
        <SheetFooter>
          <Button
            variant="outline"
            data-testid="provider-choice-cancel"
            onClick={() => onOpenChange(false)}
          >
            {t('providerChoice.cancel')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
