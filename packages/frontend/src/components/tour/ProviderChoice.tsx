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
import {
  chooseProvider,
  effectiveProviderOf,
  routingGroupsOf,
  type ProviderChoiceResult,
  type ProviderTarget,
} from '../../lib/provider-choice.js';
import {
  isFreeKeyProvider,
  ownProviderChoices,
  providerKeyFor,
  providerName,
} from '../../lib/simple-provider.js';
import { getErrorMessage } from '../../lib/utils.js';
import { toast } from '@/lib/toast';
import { accessFor, useProjectStore } from '../../stores/project-store.js';

interface ProviderChoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cloud offers key-only providers; GitHub Copilot is local-only. */
  cloud: boolean;
  /**
   * The choice was written (`chooseProvider`). `vaultKey` is the key the
   * provider reads, so the caller can ask for it when `result` is `needs-key`.
   */
  onChosen: (choice: {
    base: string;
    vaultKey: string | undefined;
    result: ProviderChoiceResult;
  }) => void;
}

/**
 * The guide's "Use my own provider": the providers a key alone is enough for.
 * A thin wrapper over `chooseProvider`, the same write the project's provider
 * card makes, applied to the active project when it is the person's own.
 */
export function ProviderChoice({ open, onOpenChange, cloud, onChosen }: ProviderChoiceProps) {
  const { t } = useTranslation('guide-tour');
  const [busy, setBusy] = useState(false);
  // The active project, when it is the person's own to change.
  const ownedProjectId = useProjectStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    return project && accessFor(s, project.id).role === 'owner' ? project.id : null;
  });
  const target: ProviderTarget | null =
    ownedProjectId === null ? null : { kind: 'project', projectId: ownedProjectId };
  // Routing built in Advanced is never overwritten.
  const routingKept = useProjectStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    if (!project) return false;
    const groups = routingGroupsOf(project.routingRules, project.routingRuleGroups);
    return effectiveProviderOf(groups).kind === 'custom';
  });

  const choose = (base: string) => {
    setBusy(true);
    void chooseProvider(base, target)
      .then((result) => onChosen({ base, vaultKey: providerKeyFor(base), result }))
      .catch((err: unknown) =>
        toast.error(
          t('providerChoice.failed', {
            provider: providerName(base),
            message: getErrorMessage(err),
          }),
        ),
      )
      .finally(() => setBusy(false));
  };

  const choices = ownProviderChoices(cloud);
  const paid = choices.filter((base) => !isFreeKeyProvider(base));
  const free = choices.filter((base) => isFreeKeyProvider(base));
  const button = (base: string) => (
    <li key={base}>
      <Button
        variant="outline"
        className="w-full justify-start"
        data-testid={`provider-choice-${base}`}
        disabled={busy}
        onClick={() => choose(base)}
      >
        {providerName(base)}
      </Button>
    </li>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-testid="provider-choice">
        <SheetHeader>
          <SheetTitle>{t('providerChoice.title')}</SheetTitle>
          <SheetDescription>{t('providerChoice.description')}</SheetDescription>
          {routingKept && (
            <p className="text-sm text-muted-foreground" data-testid="provider-choice-routing-kept">
              {t('providerChoice.existingRouting')}
            </p>
          )}
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4">
          <ul className="flex flex-col gap-2">{paid.map(button)}</ul>
          <div className="flex flex-col gap-2" data-testid="provider-choice-free">
            <p className="text-sm text-muted-foreground">{t('providerChoice.freeHeading')}</p>
            <ul className="flex flex-col gap-2">{free.map(button)}</ul>
          </div>
        </div>
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
