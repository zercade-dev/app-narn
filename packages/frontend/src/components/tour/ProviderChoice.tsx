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
import { useModules } from '../../hooks/use-modules.js';
import { ownProviderChoices, providerKeyFor } from '../../lib/simple-provider.js';
import { useProjectStore } from '../../stores/project-store.js';

interface ProviderChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cloud offers key-only providers; GitHub Copilot is local-only. */
  cloud: boolean;
  /** `vaultKey` is the key the provider reads, so the caller can ask for it. */
  onChosen: (choice: { base: string; vaultKey: string | undefined }) => void;
}

/**
 * "Use my own provider": the list of providers a key alone is enough for. It
 * only reports the choice; the guide remembers it and, once the provider's key
 * is in an unlocked vault, enables the provider and points the project at it.
 */
export function ProviderChoice({ open, onOpenChange, cloud, onChosen }: ProviderChoiceProps) {
  const { t } = useTranslation('guide-tour');
  const modules = useModules({ enabled: open });
  // The guide only writes routing for a project that has none.
  const projectHasRouting = useProjectStore(
    (s) => (s.projects.find((p) => p.id === s.activeProjectId)?.routingRules?.length ?? 0) > 0,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="provider-choice">
        <SheetHeader>
          <SheetTitle>{t('providerChoice.title')}</SheetTitle>
          <SheetDescription>{t('providerChoice.description')}</SheetDescription>
          {projectHasRouting && (
            <p className="text-sm text-muted-foreground" data-testid="provider-choice-routing-kept">
              {t('providerChoice.existingRouting')}
            </p>
          )}
        </SheetHeader>
        <ul className="flex flex-col gap-2 px-4">
          {ownProviderChoices(cloud).map((base) => {
            const module = modules.find((m) => m.id === base);
            return (
              <li key={base}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  data-testid={`provider-choice-${base}`}
                  onClick={() =>
                    onChosen({
                      base,
                      vaultKey: module?.requiredEnvVars[0] ?? providerKeyFor(base),
                    })
                  }
                >
                  {module?.name ?? base}
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
