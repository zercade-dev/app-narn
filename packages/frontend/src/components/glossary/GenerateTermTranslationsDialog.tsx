/**
 * Generate-term-translations dialog. Lets the user pick a module + model +
 * reasoning effort, then asks the server to translate THIS glossary's own terms
 * that are missing a translation into the project's active languages.
 *
 * Unlike GenerateGlossaryDialog (a non-blocking background run over the whole
 * project), this is a single SYNCHRONOUS request: glossaries are bounded, so the
 * dialog just shows a spinner while the request is in flight and reports the
 * result via a toast. A locked vault is handled the same way as the rest of the
 * Glossary tab — the shared client fires the unlock dialog and replays the
 * request through `onVaultLockedRetry`.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2 } from 'lucide-react';
import { PSEUDO_MODULE_ID } from '@zercade-dev/narn-shared';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/utils';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { useVaultRetryAction } from '../../hooks/use-vault-retry-action.js';
import { useModules } from '../../hooks/use-modules.js';
import {
  isOfferableModule,
  basesWithInstances,
  isEnabledModule,
} from '../../lib/module-options.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ModuleSelect } from '../ui/module-select';
import { ModuleModelSelector } from '../config/ModuleModelSelector.js';
import { ModuleReasoningEffortSelect } from '../config/ModuleReasoningEffortSelect.js';

export interface GenerateTermTranslationsDialogProps {
  readonly projectId: string;
  readonly glossaryId: string;
  readonly glossaryName: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called after a successful run so the caller can reload the glossary. */
  readonly onDone: () => Promise<void> | void;
}

interface TranslateTermsResult {
  translated: number;
  terms: number;
}

export function GenerateTermTranslationsDialog({
  projectId,
  glossaryId,
  glossaryName,
  open,
  onOpenChange,
  onDone,
}: GenerateTermTranslationsDialogProps): React.JSX.Element {
  const { t } = useTranslation('glossary');

  // Discover the LLM modules each time the dialog opens (lazy fetch).
  const modules = useModules({ enabled: open });
  const [moduleId, setModuleId] = useState('');
  const [model, setModel] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset transient error state during render whenever the dialog opens (the
  // render-time "prev prop" pattern used across this tab).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setError(null);
  }

  // Any translate-capable, real (non-pseudo) module qualifies. Credentials are
  // NOT filtered here: when the vault is locked every module reports
  // `credentialsAvailable: false`, and filtering on it would wrongly show "no
  // modules" instead of letting the user proceed — the locked vault is handled
  // at submit time (423 → unlock dialog → onVaultLockedRetry), like the
  // GenerateGlossaryDialog does.
  const baseInstanceSet = basesWithInstances(modules);
  const translateModules = modules.filter(
    (m) =>
      m.capabilities?.includes('translate') &&
      m.id !== PSEUDO_MODULE_ID &&
      isOfferableModule(m, baseInstanceSet) &&
      isEnabledModule(m),
  );
  const effectiveModuleId = moduleId || translateModules[0]?.id || '';
  const noModules = modules.length > 0 && translateModules.length === 0;

  const handleModuleChange = (next: string) => {
    setModuleId(next);
    setModel('');
    setReasoningEffort('');
  };

  const reportResult = async (result: TranslateTermsResult) => {
    if (result.translated > 0) {
      toast.success(t('toastTermsTranslated', { count: result.translated }));
    } else {
      toast.info(t('toastTermsTranslatedNone'));
    }
    await onDone();
    onOpenChange(false);
  };

  // Translate this glossary's terms. The success side effect (toast + onDone
  // reload + close) goes in the vault hook's `onResult` so it fires exactly once
  // across the awaited + retried (post-unlock) delivery paths; a non-423 failure
  // surfaces inline via `onError`. `useAsyncAction` owns the `running` flag —
  // `invoke()` swallows the 423 and routes other failures to `onError`, so its
  // own error toast never fires (the dialog reports errors inline instead).
  const translateRun = useVaultRetryAction<TranslateTermsResult>(
    ({ onRetry }) =>
      apiRequest<TranslateTermsResult>(
        `/projects/${projectId}/glossaries/${glossaryId}/translate-terms`,
        {
          method: 'POST',
          body: JSON.stringify({
            moduleId: effectiveModuleId,
            ...(model ? { model } : {}),
            ...(reasoningEffort ? { reasoningEffort } : {}),
          }),
          // Locked vault: the request actually completes after the unlock retry,
          // so finish the flow there (the POST below rejects with 423).
          onVaultLockedRetry: onRetry,
        },
      ),
    {
      onResult: (result) => void reportResult(result),
      onError: (err) => setError(errorMessage(err, t('toastTranslateTermsError'))),
    },
  );
  const { run: handleTranslate, busy: running } = useAsyncAction(
    async () => {
      if (!effectiveModuleId) return;
      setError(null);
      await translateRun.invoke();
    },
    { errorFallback: t('toastTranslateTermsError') },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="glossary-translate-terms-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Languages className="size-4" />
            {t('translateTermsTitle')}
          </DialogTitle>
          <DialogDescription>{t('translateTermsDescription')}</DialogDescription>
        </DialogHeader>

        {glossaryName && (
          <p className="text-sm font-medium" data-testid="glossary-translate-terms-name">
            {glossaryName}
          </p>
        )}

        {noModules ? (
          <p
            className="text-sm text-muted-foreground"
            data-testid="glossary-translate-terms-no-modules"
          >
            {t('generateNoModules')}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="glossary-translate-module">{t('generateModule')}</Label>
              <ModuleSelect
                id="glossary-translate-module"
                triggerTestId="glossary-translate-module-trigger"
                value={effectiveModuleId}
                onValueChange={handleModuleChange}
                modules={translateModules}
                placeholder={t('generateModulePlaceholder')}
              />
            </div>

            {effectiveModuleId && (
              <div className="space-y-1.5">
                <Label htmlFor="glossary-translate-model">{t('generateModel')}</Label>
                <ModuleModelSelector
                  key={effectiveModuleId}
                  id="glossary-translate-model"
                  moduleId={effectiveModuleId}
                  value={model}
                  onValueChange={setModel}
                />
                <ModuleReasoningEffortSelect
                  moduleId={effectiveModuleId}
                  model={model}
                  value={reasoningEffort}
                  onChange={setReasoningEffort}
                  label={t('generateReasoningEffort')}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" data-testid="glossary-translate-terms-error">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button
            onClick={handleTranslate}
            disabled={!effectiveModuleId || running || noModules}
            data-testid="glossary-translate-terms-run-btn"
          >
            {running ? (
              <Loader2 className="size-4 mr-1 animate-spin" />
            ) : (
              <Languages className="size-4 mr-1" />
            )}
            {running ? t('translateTermsRunning') : t('translateTerms')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
