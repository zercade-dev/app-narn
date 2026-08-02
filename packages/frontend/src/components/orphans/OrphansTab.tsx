import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2Off } from 'lucide-react';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/utils';
import type { OrphanEntry, StringEntry } from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { useModules, useConfiguredModels } from '../../hooks/use-modules.js';
import {
  basesWithInstances,
  isEnabledModule,
  isOfferableModule,
  COST_TIER_ORDER,
} from '../../lib/module-options.js';
import { useProjectScopedFetch } from './use-project-scoped-fetch.js';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { ConfirmSheet } from '../ui/confirm-sheet';
import { AiRunOptionsFields } from '../config/AiRunOptionsFields.js';

interface OrphansTabProps {
  projectId: string;
}

interface RelinkCandidate {
  id: string;
  sourceText: string;
}

function countTranslations(entry: OrphanEntry | StringEntry): number {
  if ('translationCount' in entry && typeof entry.translationCount === 'number') {
    return entry.translationCount;
  }
  const translations =
    entry && typeof entry === 'object' && 'translations' in entry
      ? (entry.translations as Record<string, { text?: string } | null | undefined> | null)
      : null;
  if (!translations || typeof translations !== 'object') {
    return 0;
  }
  return Object.values(translations).filter((r) => r?.text).length;
}

/** Relink override mode — how an orphan's translations fold onto the target (see M11 relinkOrphan). */
type OverrideMode = 'all' | 'empty-only';

export function OrphansTab({ projectId }: Readonly<OrphansTabProps>) {
  const { t } = useTranslation('orphans');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [relinkOrphan, setRelinkOrphan] = useState<OrphanEntry | null>(null);
  // Two-step relink flow: 'pick' shows the ranked candidate list, 'confirm'
  // shows the override-mode + AI-retranslate confirmation before submitting.
  const [relinkStep, setRelinkStep] = useState<'pick' | 'confirm'>('pick');
  const [pendingDelete, setPendingDelete] = useState<OrphanEntry | null>(null);
  const [candidates, setCandidates] = useState<RelinkCandidate[]>([]);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [pickedCandidateId, setPickedCandidateId] = useState<string | null>(null);
  const [overrideMode, setOverrideMode] = useState<OverrideMode>('empty-only');
  const [retranslateWithAi, setRetranslateWithAi] = useState(false);
  // Per-run AI selection; `null` = not chosen, so the cheapest-first default
  // below applies (mirrors AiReviewDialog's user*-override convention).
  const [userAiModuleId, setUserAiModuleId] = useState<string | null>(null);
  const [userAiModel, setUserAiModel] = useState<string | null>(null);
  const [userAiReasoningEffort, setUserAiReasoningEffort] = useState<string | null>(null);
  // Fetch the module list only once the confirm step (which offers the AI
  // options) is actually reached.
  const modules = useModules({ enabled: relinkOrphan !== null && relinkStep === 'confirm' });
  const configuredModels = useConfiguredModels();
  const aiModules = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules
      .filter(
        (m) => m.supportsAiRetranslate && isOfferableModule(m, withInstances) && isEnabledModule(m),
      )
      .sort((a, b) => COST_TIER_ORDER[a.costTier] - COST_TIER_ORDER[b.costTier]);
  }, [modules]);
  // Cheapest-first default, matching what the server would pick unprompted.
  const aiModuleId = userAiModuleId ?? aiModules[0]?.id ?? '';
  const aiModel = userAiModel ?? '';
  const aiReasoningEffort = userAiReasoningEffort ?? '';
  const noAiModules = modules.length > 0 && aiModules.length === 0;

  const handleAiModuleChange = useCallback((next: string) => {
    setUserAiModuleId(next);
    // Clear the model so the remounted selector auto-picks the new module's
    // configured model; the old module's effort doesn't carry over either.
    setUserAiModel('');
    setUserAiReasoningEffort(null);
  }, []);

  const fetchOrphans = useCallback(
    (id: string) => apiRequest<OrphanEntry[]>(`/projects/${id}/orphans`),
    [],
  );
  // A successful load also prunes the selection to ids that still exist.
  const onLoad = useCallback((list: OrphanEntry[]) => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const o of list) if (prev.has(o.id)) next.add(o.id);
      return next;
    });
  }, []);
  const onError = useCallback(
    (err: unknown) => toast.error(errorMessage(err, t('toast.loadError'))),
    [t],
  );
  const {
    data: orphans,
    setData: setOrphans,
    loading,
    setLoading,
    reload,
  } = useProjectScopedFetch<OrphanEntry[]>(projectId, fetchOrphans, [], { onLoad, onError });

  const handleRefresh = useCallback(() => {
    setLoading(true);
    void reload();
  }, [reload, setLoading]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === orphans.length) return new Set();
      return new Set(orphans.map((o) => o.id));
    });
  }, [orphans]);

  const handleDelete = useCallback(
    async (id: string) => {
      // Optimistic removal
      const prev = orphans;
      setOrphans((list) => list.filter((o) => o.id !== id));
      try {
        await apiRequest<void>(`/projects/${projectId}/orphans/${id}`, { method: 'DELETE' });
        toast.success(t('toast.deleted'));
      } catch (err) {
        setOrphans(prev);
        toast.error(errorMessage(err, t('toast.deleteError')));
      }
    },
    [orphans, projectId, t, setOrphans],
  );

  const confirmDelete = useCallback(async () => {
    const orphan = pendingDelete;
    if (!orphan) return;
    setPendingDelete(null);
    await handleDelete(orphan.id);
  }, [pendingDelete, handleDelete]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const prev = orphans;
    setOrphans((list) => list.filter((o) => !selectedIds.has(o.id)));
    setSelectedIds(new Set());
    try {
      const res = await apiRequest<{ deleted: string[] }>(
        `/projects/${projectId}/orphans/bulk-delete`,
        { method: 'POST', body: JSON.stringify({ ids }) },
      );
      toast.success(t('toast.bulkDeleted', { count: res.deleted.length }));
    } catch (err) {
      setOrphans(prev);
      toast.error(errorMessage(err, t('toast.deleteError')));
    }
  }, [selectedIds, orphans, projectId, t, setOrphans]);

  const openRelink = useCallback(
    async (orphan: OrphanEntry) => {
      setRelinkOrphan(orphan);
      setRelinkStep('pick');
      setCandidateQuery('');
      setPickedCandidateId(null);
      setOverrideMode('empty-only');
      setRetranslateWithAi(false);
      setUserAiModuleId(null);
      setUserAiModel(null);
      setUserAiReasoningEffort(null);
      try {
        // `orphanId` ranks the candidates by pg_trgm similarity of THEIR source
        // text to this orphan's source text (server-side; see the candidates
        // route). The search box below narrows this ranked list further, client-side.
        const list = await apiRequest<RelinkCandidate[]>(
          `/projects/${projectId}/orphans/candidates?orphanId=${encodeURIComponent(orphan.id)}`,
        );
        setCandidates(list);
      } catch (err) {
        toast.error(errorMessage(err, t('toast.candidatesError')));
        setRelinkOrphan(null);
      }
    },
    [projectId, t],
  );

  const closeRelink = useCallback(() => {
    setRelinkOrphan(null);
    setRelinkStep('pick');
    setCandidates([]);
    setCandidateQuery('');
    setPickedCandidateId(null);
    setOverrideMode('empty-only');
    setRetranslateWithAi(false);
    setUserAiModuleId(null);
    setUserAiModel(null);
    setUserAiReasoningEffort(null);
  }, []);

  /** Advances from the candidate picker to the override/AI confirmation step. */
  const confirmCandidate = useCallback(() => {
    if (!pickedCandidateId) return;
    setRelinkStep('confirm');
  }, [pickedCandidateId]);

  const submitRelink = useCallback(async () => {
    if (!relinkOrphan || !pickedCandidateId) return;
    const orphanId = relinkOrphan.id;
    const mode = overrideMode;
    const withAi = retranslateWithAi;
    const aiOptions =
      withAi && aiModuleId
        ? {
            moduleId: aiModuleId,
            ...(aiModel ? { model: aiModel } : {}),
            ...(aiReasoningEffort ? { reasoningEffort: aiReasoningEffort } : {}),
          }
        : {};
    const prev = orphans;
    setOrphans((list) => list.filter((o) => o.id !== orphanId));
    closeRelink();
    try {
      const result = await apiRequest<
        StringEntry & { retranslateRunId?: string; retranslateError?: string }
      >(`/projects/${projectId}/orphans/${orphanId}/relink`, {
        method: 'POST',
        body: JSON.stringify({
          newSourceId: pickedCandidateId,
          overrideMode: mode,
          retranslateWithAi: withAi,
          ...aiOptions,
        }),
      });
      toast.success(t('toast.relinked'));
      if (withAi) {
        if (result.retranslateRunId) {
          toast.success(t('toast.aiRetranslateStarted'));
        } else if (result.retranslateError) {
          toast.warning(t('toast.aiRetranslateUnavailable'));
        }
      }
    } catch (err) {
      setOrphans(prev);
      toast.error(errorMessage(err, t('toast.relinkError')));
    }
  }, [
    relinkOrphan,
    pickedCandidateId,
    overrideMode,
    retranslateWithAi,
    aiModuleId,
    aiModel,
    aiReasoningEffort,
    orphans,
    projectId,
    t,
    closeRelink,
    setOrphans,
  ]);

  const filteredCandidates = useMemo(() => {
    const q = candidateQuery.trim().toLowerCase();
    const all = q ? candidates.filter((c) => c.sourceText.toLowerCase().includes(q)) : candidates;
    return all.slice(0, 50);
  }, [candidates, candidateQuery]);

  const allSelected = orphans.length > 0 && selectedIds.size === orphans.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            {t('actions.refresh')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => void handleBulkDelete()}
            data-testid="orphans-bulk-delete"
          >
            {t('actions.bulkDelete', { count: selectedIds.size })}
          </Button>
        </div>

        {orphans.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Link2Off className="size-5" />
            </div>
            <p className="text-sm font-medium">{t('emptyTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label={t('columns.select')}
                  />
                </TableHead>
                <TableHead>{t('columns.source')}</TableHead>
                <TableHead className="w-32 text-right">{t('columns.translations')}</TableHead>
                <TableHead className="w-48 text-right">{t('columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orphans.map((orphan) => (
                <TableRow key={orphan.id} data-testid={`orphan-row-${orphan.id}`}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(orphan.id)}
                      onCheckedChange={() => toggleId(orphan.id)}
                      aria-label={t('columns.select')}
                    />
                  </TableCell>
                  <TableCell className="w-full max-w-0 whitespace-normal font-mono text-sm">
                    <div className="line-clamp-3 break-words" title={orphan.sourceText}>
                      {orphan.sourceText}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {countTranslations(orphan)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openRelink(orphan)}
                      data-testid={`orphan-relink-${orphan.id}`}
                    >
                      {t('actions.relink')}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setPendingDelete(orphan)}
                      data-testid={`orphan-delete-${orphan.id}`}
                    >
                      {t('actions.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Sheet
        open={relinkOrphan !== null && relinkStep === 'pick'}
        onOpenChange={(open) => !open && closeRelink()}
      >
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{t('relink.title')}</SheetTitle>
            <SheetDescription>{t('relink.description')}</SheetDescription>
          </SheetHeader>
          {relinkOrphan ? (
            <div className="space-y-4 px-4 py-4">
              <div className="rounded border border-border bg-muted/30 p-2 text-sm break-words">
                {relinkOrphan.sourceText}
              </div>
              <Input
                placeholder={t('relink.searchPlaceholder')}
                value={candidateQuery}
                onChange={(e) => setCandidateQuery(e.target.value)}
              />
              <div
                className="max-h-[360px] overflow-auto border border-border rounded divide-y"
                data-testid="orphan-relink-candidates"
              >
                {filteredCandidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`w-full text-left p-2 text-sm break-words hover:bg-muted ${
                      pickedCandidateId === c.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setPickedCandidateId(c.id)}
                  >
                    <span data-content>{c.sourceText}</span>
                  </button>
                ))}
                {filteredCandidates.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground">
                    {t('relink.noCandidates')}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <SheetFooter>
            <Button variant="outline" onClick={closeRelink}>
              {t('actions.cancel')}
            </Button>
            <Button
              onClick={confirmCandidate}
              disabled={!pickedCandidateId}
              data-testid="orphan-relink-continue"
            >
              {t('relink.submit')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmSheet
        open={relinkOrphan !== null && relinkStep === 'confirm'}
        onOpenChange={(open) => {
          if (!open) setRelinkStep('pick');
        }}
        side="bottom"
        contentClassName="max-w-md mx-auto rounded-t-xl"
        title={t('relink.confirmTitle')}
        description={t('relink.confirmDescription')}
        cancelLabel={t('actions.back')}
        confirmLabel={t('relink.confirmSubmit')}
        confirmVariant="default"
        confirmTestId="orphan-relink-confirm"
        onConfirm={() => void submitRelink()}
      >
        <div className="space-y-4 px-4 py-2" data-testid="orphan-relink-options">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('relink.overrideModeLabel')}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="orphan-relink-override-mode"
                value="empty-only"
                checked={overrideMode === 'empty-only'}
                onChange={() => setOverrideMode('empty-only')}
                data-testid="orphan-relink-override-empty-only"
              />
              {t('relink.overrideEmptyOnly')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="orphan-relink-override-mode"
                value="all"
                checked={overrideMode === 'all'}
                onChange={() => setOverrideMode('all')}
                data-testid="orphan-relink-override-all"
              />
              {t('relink.overrideAll')}
            </label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={retranslateWithAi}
              onCheckedChange={(checked) => setRetranslateWithAi(checked === true)}
              // Empty aiModules covers both "list still loading" and "settled
              // with none" — either way the selector below would be empty, so
              // don't offer the checkbox yet. The hint stays keyed on
              // noAiModules so "no AI modules" is only claimed post-fetch.
              disabled={aiModules.length === 0}
              data-testid="orphan-relink-ai-checkbox"
            />
            {t('relink.aiRetranslateLabel')}
          </label>
          <p className="text-xs text-muted-foreground">
            {noAiModules ? t('relink.aiNoModules') : t('relink.aiRetranslateHint')}
          </p>
          {retranslateWithAi && (
            <div className="space-y-4">
              <AiRunOptionsFields
                idPrefix="orphan-relink-ai"
                modules={aiModules}
                moduleId={aiModuleId}
                model={aiModel}
                reasoningEffort={aiReasoningEffort}
                onModuleChange={handleAiModuleChange}
                onModelChange={setUserAiModel}
                onReasoningEffortChange={setUserAiReasoningEffort}
                configuredModels={configuredModels}
                moduleLabel={t('relink.aiModuleLabel')}
                modelLabel={t('relink.aiModelLabel')}
                reasoningEffortLabel={t('relink.aiReasoningEffortLabel')}
                modulePlaceholder={t('relink.aiModulePlaceholder')}
              />
            </div>
          )}
        </div>
      </ConfirmSheet>

      <ConfirmSheet
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        side="bottom"
        contentClassName="max-w-md mx-auto rounded-t-xl"
        title={t('confirmDelete.title')}
        description={t('confirmDelete.body')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.delete')}
        confirmTestId="orphan-delete-confirm"
        onConfirm={() => void confirmDelete()}
      />
    </Card>
  );
}
