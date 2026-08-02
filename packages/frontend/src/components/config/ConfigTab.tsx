import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import type { TmMatchPolicy, BatchGroupingDimension } from '@zercade-dev/narn-shared';
import { useProjectStore } from '../../stores/project-store.js';
import { useTemplateStore } from '../../stores/template-store.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { ModuleSettingsPanel } from './ModuleSettingsPanel.js';
import { LqaChecksPanel } from './LqaChecksPanel.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Pencil, X, Check } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

/**
 * Choice for the project/workspace-level (persisted) batch-grouping default.
 * Unlike per-run `GroupingChoice` (`BatchGroupingControls.tsx`), this is never
 * `'custom'` — a custom entries-per-batch cap is a per-run override only and
 * is never saved as the project default.
 */
type ProjectGroupingChoice = BatchGroupingDimension | 'default';

/**
 * Config tab — project identity and translation policy: rename, translation
 * memory reuse policy, the persisted batch-grouping default, module settings,
 * and the LQA check pipeline, plus danger-zone actions (duplicate/delete).
 * Source/target language selection and CSV import/export live on the Data tab
 * (`DataTab.tsx`) — this split keeps "how strings get in and out" separate
 * from "how the project is configured".
 */
export function ConfigTab() {
  const { t } = useTranslation('config');
  const { t: tCommon } = useTranslation('common');
  const {
    projects,
    activeProjectId,
    fetchProjects,
    deleteProject,
    duplicateProject,
    updateProject,
  } = useProjectStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const saveFromProject = useTemplateStore((s) => s.saveFromProject);
  const [templateName, setTemplateName] = useState('');

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Reset pending state during render when the active project changes
  const [prevActiveProjectId, setPrevActiveProjectId] = useState(activeProjectId);
  if (prevActiveProjectId !== activeProjectId) {
    setPrevActiveProjectId(activeProjectId);
    setTemplateName('');
    setEditingName(false);
    setDeleteDialogOpen(false);
  }

  const handleTmPolicyChange = async (policy: TmMatchPolicy) => {
    if (!activeProject || policy === (activeProject.tmPolicy ?? 'disabled')) return;
    try {
      await updateProject(activeProject.id, { tmPolicy: policy });
      await fetchProjects();
    } catch (err) {
      toast.error(t('tm.policyUpdateFailed', { message: (err as Error).message }));
    }
  };

  // The project-level batch-grouping default. Choosing "Use workspace setting"
  // writes `null` to clear the override (and its paired ignore-limit flag) so
  // runs inherit the workspace default; `resolveBatchGrouping` reads null as
  // "inherit". Per-run dialogs can still override this default for one run.
  const handleBatchGroupingChange = async (choice: ProjectGroupingChoice) => {
    if (!activeProject) return;
    try {
      await updateProject(
        activeProject.id,
        choice === 'default'
          ? { batchGrouping: null, ignoreBatchSizeLimit: null }
          : { batchGrouping: choice },
      );
      await fetchProjects();
    } catch (err) {
      toast.error(t('batchGroupingUpdateFailed', { message: (err as Error).message }));
    }
  };

  const handleIgnoreLimitChange = async (ignore: boolean) => {
    if (!activeProject) return;
    try {
      await updateProject(activeProject.id, { ignoreBatchSizeLimit: ignore });
      await fetchProjects();
    } catch (err) {
      toast.error(t('batchGroupingUpdateFailed', { message: (err as Error).message }));
    }
  };

  const { run: saveRename, busy: savingName } = useAsyncAction(
    async () => {
      if (!activeProject || !pendingName.trim()) return;
      await updateProject(activeProject.id, { name: pendingName.trim() });
      await fetchProjects();
      setEditingName(false);
    },
    {
      errorFallback: '',
      onError: (err) => {
        toast.error(t('renameFailed', { message: (err as Error).message }));
        return true;
      },
    },
  );

  const { run: handleSaveTemplate, busy: savingTemplate } = useAsyncAction(
    async () => {
      if (!activeProject) return;
      const name = templateName.trim() || activeProject.name;
      await saveFromProject(activeProject.id, name);
      setTemplateName('');
      toast.success(t('templateSaved', { name }));
    },
    {
      errorFallback: '',
      onError: (err) => {
        toast.error(t('templateSaveFailed', { message: (err as Error).message }));
        return true;
      },
    },
  );

  const { run: handleDuplicate, busy: duplicating } = useAsyncAction(
    async () => {
      if (!activeProject) return;
      await duplicateProject(activeProject.id);
      await fetchProjects();
      toast.success(t('duplicateSuccess', { name: activeProject.name }));
    },
    {
      errorFallback: '',
      onError: (err) => {
        toast.error(t('duplicateFailed', { message: (err as Error).message }));
        return true;
      },
    },
  );

  if (!activeProject) {
    return (
      <div className="p-8 text-muted-foreground text-center">
        <h2 className="mb-2 text-base font-semibold">{t('noProjectTitle')}</h2>
        <p>{t('noProjectBody')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-screen-2xl space-y-4" data-testid="config-tab">
        {/* Project name */}
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={pendingName}
              maxLength={128}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRename();
                } else if (e.key === 'Escape') {
                  setEditingName(false);
                }
              }}
              disabled={savingName}
              className="text-lg font-semibold h-9 max-w-xs"
              data-testid="rename-project-input"
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={saveRename}
              disabled={savingName || !pendingName.trim()}
              data-testid="rename-project-save"
            >
              <Check className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setEditingName(false)}
              disabled={savingName}
              data-testid="rename-project-cancel"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{activeProject.name}</h2>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground"
              onClick={() => {
                setPendingName(activeProject.name);
                setEditingName(true);
              }}
              data-testid="rename-project-button"
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Translation memory policy */}
          <Card>
            <CardHeader>
              <CardTitle>{t('tm.policyTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('tm.policyDescription')}</p>
              <Select
                value={activeProject.tmPolicy ?? 'disabled'}
                onValueChange={(v) => {
                  if (v) handleTmPolicyChange(v as TmMatchPolicy);
                }}
              >
                <SelectTrigger className="w-64" data-testid="tm-policy-select">
                  <SelectValue>
                    {(v: string | null) => {
                      if (v === 'relaxed') return t('tm.policyRelaxed');
                      if (v === 'source-only') return t('tm.policySourceOnly');
                      if (v === 'disabled') return t('tm.policyDisabled');
                      return t('tm.policyStrict');
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strict" data-testid="tm-policy-strict">
                    {t('tm.policyStrict')}
                  </SelectItem>
                  <SelectItem value="relaxed" data-testid="tm-policy-relaxed">
                    {t('tm.policyRelaxed')}
                  </SelectItem>
                  <SelectItem value="source-only" data-testid="tm-policy-source-only">
                    {t('tm.policySourceOnly')}
                  </SelectItem>
                  <SelectItem value="disabled" data-testid="tm-policy-disabled">
                    {t('tm.policyDisabled')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Batch grouping (project default; per-run dialogs can override) */}
          <Card>
            <CardHeader>
              <CardTitle>{t('batchGroupingLabel')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('batchGroupingDescription')}</p>
              <Select
                value={activeProject.batchGrouping ?? 'default'}
                onValueChange={(v) => {
                  if (v) handleBatchGroupingChange(v as ProjectGroupingChoice);
                }}
              >
                <SelectTrigger className="w-64" data-testid="project-batch-grouping-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t('batchGroupingDefaultOption')}</SelectItem>
                  <SelectItem value="none">{t('batchGroupingNone')}</SelectItem>
                  <SelectItem value="category">{t('batchGroupingCategory')}</SelectItem>
                  <SelectItem value="glossary">{t('batchGroupingGlossary')}</SelectItem>
                  <SelectItem value="both">{t('batchGroupingBoth')}</SelectItem>
                  <SelectItem value="tone">{t('batchGroupingTone')}</SelectItem>
                </SelectContent>
              </Select>
              {(activeProject.batchGrouping ?? 'default') !== 'default' && (
                <label className="flex items-center gap-1.5 text-sm pt-0.5">
                  <Checkbox
                    data-testid="project-batch-grouping-ignore"
                    checked={activeProject.ignoreBatchSizeLimit ?? false}
                    onCheckedChange={(checked) => handleIgnoreLimitChange(checked === true)}
                  />
                  {t('ignoreBatchSizeLimitLabel')}
                </label>
              )}
            </CardContent>
          </Card>

          {/* Save as template — at the 2-col breakpoint (md–xl) this would
              otherwise be the odd one out, leaving a dangling empty cell
              next to it; span both columns there instead, then drop back to
              a single column once xl gives us a balanced 3-up row. */}
          <Card className="md:col-span-2 xl:col-span-1">
            <CardHeader>
              <CardTitle>{t('saveAsTemplateTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('saveAsTemplateDescription')}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={templateName}
                  maxLength={128}
                  placeholder={activeProject.name}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="max-w-xs"
                  data-testid="template-name-input"
                />
                <Button
                  onClick={handleSaveTemplate}
                  disabled={savingTemplate}
                  data-testid="save-template-button"
                >
                  {savingTemplate ? tCommon('saving') : t('saveAsTemplate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Module settings — full width, collapsible per module */}
        <ModuleSettingsPanel projectId={activeProject.id} />

        <Separator />

        {/* LQA check pipeline — per-project toggles and options */}
        <LqaChecksPanel project={activeProject} />

        <Separator />

        {/* Danger zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={duplicating}
              data-testid="duplicate-project-button"
              onClick={handleDuplicate}
            >
              {duplicating ? t('duplicating') : t('duplicateProject')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              data-testid="delete-project-button"
            >
              {t('deleteProject')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Sheet open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t('confirmDeleteTitle')}</SheetTitle>
            <SheetDescription>
              {t('confirmDeleteDescription', { name: activeProject?.name })}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-delete-project-button"
              onClick={async () => {
                setDeleteDialogOpen(false);
                await deleteProject(activeProject.id);
                await fetchProjects();
              }}
            >
              {t('delete')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
