/**
 * Stage details project tab. Renders the three human-authored source fields
 * (name / gameplay details / stage description) and their per-language
 * translations, plus AI-translate controls. `project.stageDetails` (project
 * store) is the single source of truth; the thin `stage-details-store` owns
 * the two mutating actions (`patch`, `startTranslate`) and the UI-only
 * selected-language / chat state.
 *
 * Mobile (<768px) is strictly read-only: every write affordance (source
 * editors, max-length inputs, translation textareas, the Translate button and
 * its popover) is gated behind `!isMobile`; mobile renders read-only text plus
 * copy buttons only.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STAGE_DETAIL_FIELD_IDS,
  RunStatusCode,
  emptyStageDetails,
  type StageDetailFieldId,
} from '@zercade-dev/narn-shared';
import { Languages, MessageSquare, XCircle } from 'lucide-react';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { writableSubset } from '@/lib/collab-locks';
import {
  useStageDetailsStore,
  type StageDetailsPatchBody,
} from '../../stores/stage-details-store.js';
import {
  useStageDetailsDraftStore,
  type StageDetailsDraftConfig,
} from '../../stores/stage-details-draft-store.js';
import { useRunStore } from '../../stores/run-store.js';
import { useIsMobile } from '../../hooks/use-mobile-viewport.js';
import { useModules, useConfiguredModels } from '../../hooks/use-modules.js';
import { basesWithInstances, isEnabledModule, isOfferableModule } from '@/lib/module-options';
import { AiRunOptionsFields } from '../config/AiRunOptionsFields.js';
import { SourceFieldEditor } from './SourceFieldEditor.js';
import { TranslationsPanel } from './TranslationsPanel.js';
import { StageChatPanel } from './StageChatPanel.js';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RunProgressBar } from '@/components/ui/run-progress-bar';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '../../lib/utils.js';

export function StageDetailsTab(): React.JSX.Element | null {
  const { t } = useTranslation('stage-details');
  const isMobile = useIsMobile();
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  // The current viewer's role + writable-language scope for this project
  // (see collab-locks.ts). Owners edit everything; a collaborator's source
  // stays read-only (owner-only server-side) and only their granted
  // languages are editable/translatable. Read before the early return so
  // hook order is stable regardless of project presence.
  const access = useProjectStore((s) => accessFor(s, activeProjectId));
  const isCollaborator = access.role === 'collaborator';

  const selectedLang = useStageDetailsStore((s) => s.selectedLang);
  const setSelectedLang = useStageDetailsStore((s) => s.setSelectedLang);
  const chatOpen = useStageDetailsStore((s) => s.chatOpen);
  const setChatOpen = useStageDetailsStore((s) => s.setChatOpen);
  const patch = useStageDetailsStore((s) => s.patch);
  const startTranslate = useStageDetailsStore((s) => s.startTranslate);

  const runs = useRunStore((s) => s.runs);
  const cancelRun = useRunStore((s) => s.cancelRun);

  const modules = useModules();
  const configuredModels = useConfiguredModels();

  // Translate popover state. moduleId/model/reasoningEffort/currentOnly/
  // staleOnly/checkedFields are a per-project draft persisted in
  // stage-details-draft-store so an in-progress edit survives navigating
  // away and back (see stage-details-draft-store.ts). Until the user
  // touches any field for this project, `project.stageDetailsConfig` (the
  // last SAVED translate run's config) seeds moduleId/model/reasoningEffort
  // — same local-wins-else-server-config precedence use-stage-details-chat.ts
  // uses for its own override.
  const cfg = project?.stageDetailsConfig;
  const draftProjectId = activeProjectId ?? '';
  const draft = useStageDetailsDraftStore((s) => s.drafts[draftProjectId]);
  const setDraftConfig = useStageDetailsDraftStore((s) => s.setDraft);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const moduleId = draft?.moduleId ?? cfg?.moduleId ?? '';
  const model = draft?.model ?? cfg?.model ?? '';
  const reasoningEffort = draft?.reasoningEffort ?? cfg?.reasoningEffort ?? '';
  const currentOnly = draft?.currentOnly ?? false;
  const staleOnly = draft?.staleOnly ?? false;
  const checkedFields = new Set<StageDetailFieldId>(draft?.checkedFields ?? STAGE_DETAIL_FIELD_IDS);
  // Seed used ONLY when this project has no stored draft yet — it materializes
  // the render-time precedence above (draft ?? saved run config ?? default) as
  // a full config. Once a draft exists, every patch merges onto the STORED
  // draft, not onto these closure values, so two updates landing in the same
  // React commit compose instead of the second silently dropping the first's
  // field.
  const draftSeed: StageDetailsDraftConfig = {
    moduleId,
    model,
    reasoningEffort,
    currentOnly,
    staleOnly,
    checkedFields: Array.from(checkedFields),
  };
  const updateDraft = (patch: Partial<StageDetailsDraftConfig>) => {
    setDraftConfig(draftProjectId, (prev) => ({ ...(prev ?? draftSeed), ...patch }));
  };
  const [translating, setTranslating] = useState(false);

  const translateModules = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules.filter(
      (m) =>
        m.capabilities.includes('translate') &&
        isOfferableModule(m, withInstances) &&
        isEnabledModule(m),
    );
  }, [modules]);

  // Refresh-on-run-completion: the M31 engine writes translations server-side,
  // so nothing client-side updates `project.stageDetails` when a run finishes.
  // Watch this project's stage-details runs and, on an observed active→terminal
  // transition, refetch the project once so the new translations appear without
  // a reload (a genuine remote change — the local-merge pattern doesn't
  // apply). Render-time transition capture mirrors ReviewTab's retranslate-run
  // pattern: per-run statuses are snapshotted, and a transition only fires when
  // a run's PREVIOUS status is both known and non-terminal — the
  // `prevStatus !== undefined` lookup is what guards runs first observed
  // already-terminal (mount-time historical runs, runs from before a project
  // switch); the mount-time seeding merely primes that lookup. The transition
  // bumps a tick, and an effect performs the single fetch.
  const [refetchTick, setRefetchTick] = useState(0);
  const sdRuns = runs.filter((r) => r.projectId === activeProjectId && r.kind === 'stage-details');
  const sdRunsSignature = `${activeProjectId ?? ''}|${sdRuns
    .map((r) => `${r.runId}=${r.status}`)
    .join(',')}`;
  const [prevSdRuns, setPrevSdRuns] = useState<{
    signature: string;
    statuses: ReadonlyMap<string, RunStatusCode>;
  }>(() => ({
    signature: sdRunsSignature,
    statuses: new Map(sdRuns.map((r) => [r.runId, r.status])),
  }));
  if (prevSdRuns.signature !== sdRunsSignature) {
    const isTerminal = (s: RunStatusCode) =>
      s === RunStatusCode.Completed || s === RunStatusCode.Failed || s === RunStatusCode.Cancelled;
    const finished = sdRuns.some((r) => {
      const prevStatus = prevSdRuns.statuses.get(r.runId);
      return prevStatus !== undefined && !isTerminal(prevStatus) && isTerminal(r.status);
    });
    setPrevSdRuns({
      signature: sdRunsSignature,
      statuses: new Map(sdRuns.map((r) => [r.runId, r.status])),
    });
    if (finished) setRefetchTick((n) => n + 1);
  }
  // Project-switch staleness: a stage-details run can finish while ANOTHER
  // project is viewed — the transition watcher above only observes the current
  // project's runs (its status map is replaced on switch), and no other client
  // path refetches on return (`activateProject` doesn't). So when the active
  // project changes while this tab is mounted, refetch once (mirroring
  // ReviewTab's fetch-on-projectId discipline). The initial mount is excluded
  // by seeding `prevProjectId` with the mount-time id — `fetchProjects` already
  // ran at app load, so fetching again here would be a double-fetch.
  const [prevProjectId, setPrevProjectId] = useState(activeProjectId);
  if (prevProjectId !== activeProjectId) {
    setPrevProjectId(activeProjectId);
    if (activeProjectId) setRefetchTick((n) => n + 1);
  }
  useEffect(() => {
    if (refetchTick === 0) return;
    void useProjectStore
      .getState()
      .fetchProjects()
      .catch(() => {
        /* best-effort refresh; the run's result is still visible in Activity */
      });
  }, [refetchTick]);

  // Tab re-activation (missed-while-unmounted): AppShell renders this tab
  // CONDITIONALLY, so switching to another tab UNMOUNTS it. A stage-details run
  // that finishes while the user is on a different tab is therefore never seen
  // by the in-tab transition watcher above — on return the tab remounts, seeds
  // `prevSdRuns` with the already-terminal run (no transition fires) and seeds
  // `prevProjectId` with the current id (no switch fires), so `project.stageDetails`
  // stays stale until a full reload. Close that gap with a refetch on mount /
  // project change that runs ONLY when a terminal stage-details run already
  // exists for this project — an ordinary open with nothing finished (the common
  // case) skips the request, so this is not a blanket per-mount fetch and never
  // flashes a spinner (no component renders on the project store's `loading`).
  // Reads the run store imperatively so it stays keyed on the project alone: a
  // mid-mount running→terminal transition is the watcher's job (its dep never
  // changes here), avoiding a double fetch. NB the stage-details engine writes
  // only `project.stageDetails` (M31 → projectStore.updateProject), never the
  // string store, so `fetchProjects` is the complete refresh — there are no
  // string rows to reload.
  useEffect(() => {
    if (!activeProjectId) return;
    const isTerminal = (s: RunStatusCode) =>
      s === RunStatusCode.Completed || s === RunStatusCode.Failed || s === RunStatusCode.Cancelled;
    const hasFinishedStageRun = useRunStore
      .getState()
      .runs.some(
        (r) =>
          r.projectId === activeProjectId && r.kind === 'stage-details' && isTerminal(r.status),
      );
    if (!hasFinishedStageRun) return;
    void useProjectStore
      .getState()
      .fetchProjects()
      .catch(() => {
        /* best-effort refresh; the run's result is still visible in Activity */
      });
  }, [activeProjectId]);

  if (!project || !activeProjectId) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="stage-details-placeholder">
        {t('placeholder')}
      </p>
    );
  }

  const stageDetails = project.stageDetails ?? emptyStageDetails();
  const languages = project.activeLanguages.filter((l) => l !== project.sourceLanguage);
  const effectiveLang =
    selectedLang && languages.includes(selectedLang) ? selectedLang : (languages[0] ?? null);
  // Languages the current viewer may write, and the set they may translate.
  // Owners: every target language. Collaborators: only their granted subset —
  // and the translate request MUST always carry an explicit `languages` list
  // for them (an omitted list requires `manage`, which they lack).
  const writableLanguages = writableSubset(access, languages);
  const translatableLanguages = isCollaborator ? writableLanguages : languages;
  // Hide the Translate affordance entirely for a collaborator with no writable
  // languages (there's nothing they could legally translate).
  const canTranslate = !isCollaborator || translatableLanguages.length > 0;

  // In-progress stage-details run for this project (completed/total progress).
  const activeRun = runs.find(
    (r) =>
      r.projectId === activeProjectId &&
      r.kind === 'stage-details' &&
      r.status === RunStatusCode.Running,
  );

  const saveSource = (
    fieldId: StageDetailFieldId,
    body: { sourceText?: string; maxLength?: number | null },
  ) => {
    const patchBody: StageDetailsPatchBody = { [fieldId]: body };
    void patch(activeProjectId, patchBody).catch((err: unknown) => {
      toast.error(t('saveFailed', { message: getErrorMessage(err) }));
    });
  };

  const saveTranslation = (fieldId: StageDetailFieldId, lang: string, text: string) => {
    const patchBody: StageDetailsPatchBody = {
      [fieldId]: { translations: { [lang]: { text, moduleId: 'manual' } } },
    };
    void patch(activeProjectId, patchBody).catch((err: unknown) => {
      toast.error(t('saveFailed', { message: getErrorMessage(err) }));
    });
  };

  const toggleField = (fieldId: StageDetailFieldId, checked: boolean) => {
    // Derived from the STORED draft (not the render-time `checkedFields`) for
    // the same reason `updateDraft` merges onto `prev`: two toggles in one
    // React commit must both stick.
    setDraftConfig(draftProjectId, (prev) => {
      const base = prev ?? draftSeed;
      const next = new Set(base.checkedFields);
      if (checked) next.add(fieldId);
      else next.delete(fieldId);
      return { ...base, checkedFields: Array.from(next) };
    });
  };

  const handleTranslate = async () => {
    if (checkedFields.size === 0 || translatableLanguages.length === 0) return;
    setTranslating(true);
    try {
      // Always send an explicit `languages` list scoped to what the viewer may
      // write (owners: every target language; collaborators: their granted
      // subset). `currentOnly` narrows to the active language only when it's in
      // that writable set, so a collaborator viewing a read-only language can't
      // scope a translate to it.
      const requestLanguages =
        currentOnly && effectiveLang && translatableLanguages.includes(effectiveLang)
          ? [effectiveLang]
          : translatableLanguages;
      await startTranslate(activeProjectId, {
        languages: requestLanguages,
        fields: STAGE_DETAIL_FIELD_IDS.filter((f) => checkedFields.has(f)),
        staleOnly,
        ...(moduleId ? { moduleId } : {}),
        ...(model ? { model } : {}),
        ...(reasoningEffort ? { reasoningEffort } : {}),
      });
      // Observe the new run's progress in the run store (and Activity tab).
      useRunStore.getState().startPolling(activeProjectId);
      setPopoverOpen(false);
      toast.success(t('translateQueued'));
    } catch (err) {
      toast.error(t('translateFailed', { message: getErrorMessage(err) }));
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div
      className="mx-auto flex w-full max-w-6xl items-start gap-6"
      data-testid="stage-details-tab"
    >
      <div className="w-full min-w-0 flex-1 space-y-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <div className="flex items-center gap-2">
            {activeRun && (
              <>
                <div data-testid="stage-details-run-progress" className="w-32">
                  <RunProgressBar
                    completed={activeRun.completed}
                    failed={activeRun.failed}
                    total={activeRun.total}
                    status={activeRun.status}
                    aria-label={t('runProgress', {
                      completed: activeRun.completed,
                      total: activeRun.total,
                    })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-status-fail hover:text-status-fail hover:bg-status-fail/10"
                  onClick={() =>
                    cancelRun(activeProjectId, activeRun.runId).catch((err: unknown) =>
                      toast.error(getErrorMessage(err)),
                    )
                  }
                  data-testid="stage-details-cancel-run"
                >
                  <XCircle className="size-4" />
                  {t('cancel')}
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label={t('chatToggle')}
              data-testid="stage-details-chat-toggle"
              aria-expanded={chatOpen}
              onClick={() => setChatOpen(!chatOpen)}
            >
              <MessageSquare className="size-4" />
              {t('chat')}
            </Button>
            {!isMobile && canTranslate && (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      data-testid="stage-details-translate-button"
                    />
                  }
                >
                  <Languages className="size-4" />
                  {t('translate')}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 space-y-4 p-3">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">{t('scope')}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={currentOnly}
                        onCheckedChange={(c) => updateDraft({ currentOnly: c === true })}
                        data-testid="stage-details-scope-current"
                      />
                      {t('scopeCurrentOnly', { lang: effectiveLang ?? '' })}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={staleOnly}
                        onCheckedChange={(c) => updateDraft({ staleOnly: c === true })}
                        data-testid="stage-details-scope-stale"
                      />
                      {t('scopeStaleOnly')}
                    </label>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('fieldsHeading')}
                    </span>
                    {STAGE_DETAIL_FIELD_IDS.map((fieldId) => (
                      <label key={fieldId} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checkedFields.has(fieldId)}
                          onCheckedChange={(c) => toggleField(fieldId, c === true)}
                          data-testid={`stage-details-field-${fieldId}`}
                        />
                        {t(`fields.${fieldId}.label`)}
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <AiRunOptionsFields
                      idPrefix="stage-details"
                      modules={translateModules}
                      moduleId={moduleId}
                      model={model}
                      reasoningEffort={reasoningEffort}
                      onModuleChange={(id) =>
                        updateDraft({ moduleId: id, model: '', reasoningEffort: '' })
                      }
                      onModelChange={(m) => updateDraft({ model: m })}
                      onReasoningEffortChange={(effort) => updateDraft({ reasoningEffort: effort })}
                      configuredModels={configuredModels}
                      moduleLabel={t('module')}
                      modelLabel={t('model')}
                      reasoningEffortLabel={t('reasoningEffort')}
                      modulePlaceholder={t('modulePlaceholder')}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={
                      translating || checkedFields.size === 0 || translatableLanguages.length === 0
                    }
                    data-testid="stage-details-translate-confirm"
                    onClick={() => void handleTranslate()}
                  >
                    {t('translateConfirm')}
                  </Button>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {/*
          Source/translation workbench. At ≥lg it is a two-column grid whose two
          columns are row-subgrids over four shared row tracks (header + one per
          field), so each source field sits beside its matching translation.
          Below lg it collapses to the original single stacked column.
        */}
        <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6 lg:space-y-0 lg:grid-rows-[auto_auto_auto_auto]">
          <section className="space-y-4 lg:grid lg:grid-rows-subgrid lg:row-span-4 lg:space-y-0">
            <h3 className="text-sm font-medium text-muted-foreground">{t('sourceHeading')}</h3>
            {STAGE_DETAIL_FIELD_IDS.map((fieldId) => (
              <SourceFieldEditor
                key={fieldId}
                fieldId={fieldId}
                field={stageDetails[fieldId]}
                isMobile={isMobile}
                readOnly={isCollaborator}
                onSave={(body) => saveSource(fieldId, body)}
              />
            ))}
          </section>

          <TranslationsPanel
            languages={languages}
            selectedLang={effectiveLang}
            onSelectLang={setSelectedLang}
            stageDetails={stageDetails}
            isMobile={isMobile}
            isCollaborator={isCollaborator}
            writableLanguages={writableLanguages}
            onSaveTranslation={saveTranslation}
          />
        </div>
      </div>

      {chatOpen && (
        <StageChatPanel
          projectId={activeProjectId}
          languages={languages}
          isMobile={isMobile}
          isCollaborator={isCollaborator}
          writableLanguages={writableLanguages}
        />
      )}
    </div>
  );
}
