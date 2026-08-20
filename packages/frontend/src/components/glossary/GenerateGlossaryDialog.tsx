/**
 * AI glossary generation dialog. Lets the user pick a module + model +
 * reasoning effort and optionally exclude already-known (enabled) glossaries,
 * then kicks off a NON-BLOCKING background run (tracked by M22 RunStore, like
 * the judge / source-review runs) that asks an LLM module to suggest glossaries
 * (named groups of recurring custom terms and proper nouns) from the project's
 * source text.
 *
 * While the run is in flight a progress bar is shown, driven by the run-store's
 * 2s polling; the user can close the dialog or navigate away and the run keeps
 * going (it surfaces in the Activity tab). On completion the suggestions are
 * loaded from the run's sidecar and reviewed here; accepting them creates the
 * glossaries and assigns each to the entries whose source matches its terms
 * (handled by the caller via `onAccept`).
 *
 * Only LLM modules can generate glossaries; they are the same set that reports
 * `supportsJudge` (all are produced by the shared AI SDK provider, which
 * implements judge, source-review and glossary-suggestion together).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import {
  RunStatusCode,
  GLOSSARY_SUGGEST_CHUNK_SIZE,
  FREEWAY_MODULE_ID,
  type EntryContextField,
  type GlossarySuggestion,
  type GlossarySummary,
  type JudgeLogEntry,
} from '@zercade-dev/narn-shared';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { apiRequest } from '../../hooks/use-api.js';
import { useVaultRetryAction } from '../../hooks/use-vault-retry-action.js';
import { useModules } from '../../hooks/use-modules.js';
import { useRunStore } from '../../stores/run-store.js';
import {
  isOfferableModule,
  basesWithInstances,
  isEnabledModule,
} from '../../lib/module-options.js';
import { errorMessage } from '../../lib/utils.js';
import { toast } from '../../lib/toast.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { Textarea } from '../ui/textarea';
import { ModuleSelect, type ModuleSelectOption } from '../ui/module-select';
import { AdvancedToggle } from '../common/AdvancedToggle.js';
import { ModuleModelSelector } from '../config/ModuleModelSelector.js';
import { useConfidenceContext } from '../../hooks/use-confidence-context.js';
import { ModuleReasoningEffortSelect } from '../config/ModuleReasoningEffortSelect.js';
import { useProjectStore } from '../../stores/project-store.js';
import {
  GenerationContextControls,
  type GenerationContextValue,
} from '../generation/GenerationContextControls.js';
import { RunLogsPanel } from '../review/RunLogsPanel.js';
import { useDialogSettings } from '../../hooks/use-dialog-settings.js';
import { hasNonDefaultValues } from '../../lib/advanced-modified.js';
import { asGroupingChoice } from '../config/BatchGroupingControls.js';

/** Last-used per-browser values. Focus source-texts input is NOT persisted (entry-specific). */
const GLOSSARY_GEN_SETTINGS_DEFAULTS = {
  advanced: false,
  moduleId: '',
  model: '',
  reasoningEffort: '',
  includeTranslations: false,
  contextFields: [] as string[],
  contextLanguages: [] as string[],
  grouping: 'default' as string,
  ignoreLimit: false,
  customBatchSize: 20,
  skipCategories: [] as string[],
  ignoreGlossaries: [] as string[],
};

export interface GenerateGlossaryDialogProps {
  readonly projectId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Enabled glossaries the user may exclude from suggestion. */
  readonly enabledGlossaries: GlossarySummary[];
  /** Called with the accepted suggestions; the caller creates + assigns them. */
  readonly onAccept: (suggestions: GlossarySuggestion[]) => Promise<void>;
  /**
   * When the dialog is opened to review a specific past run (deep-linked from
   * the Activity tab's "review suggestions" action), the run id to adopt so its
   * suggestions are loaded for review instead of showing the setup form.
   */
  readonly initialRunId?: string;
  /**
   * Distinct, non-empty source strings the run would analyse (the same dedup +
   * cap the server applies). Used to show the expected batch count before
   * starting, so the per-batch progress is understandable.
   */
  readonly sourceEntryCount?: number;
  /**
   * When set, scopes generation to just these entries instead of the whole
   * project (used by the String Table's "Generate Glossary from Selection"
   * bulk action). Threaded straight into the run's request body.
   */
  readonly entryIds?: string[];
}

export function GenerateGlossaryDialog({
  projectId,
  open,
  onOpenChange,
  enabledGlossaries,
  onAccept,
  initialRunId,
  sourceEntryCount,
  entryIds,
}: GenerateGlossaryDialogProps): React.JSX.Element {
  const { t } = useTranslation('glossary');
  // Only for the synthetic Freeway option's label below (`config:routing.freewayLabel`,
  // reused from the routing picker rather than duplicating the string here).
  const { t: tConfig } = useTranslation('config');
  const { read: readSettings, save: saveSettings } = useDialogSettings(
    'glossary-gen',
    GLOSSARY_GEN_SETTINGS_DEFAULTS,
  );
  const runs = useRunStore((s) => s.runs);
  const startGlossaryGen = useRunStore((s) => s.startGlossaryGen);
  const fetchGlossarySuggestions = useRunStore((s) => s.fetchGlossarySuggestions);
  const fetchJudgeLogs = useRunStore((s) => s.fetchJudgeLogs);
  const fetchRuns = useRunStore((s) => s.fetchRuns);
  const cancelRun = useRunStore((s) => s.cancelRun);

  // Discover the LLM modules each time the dialog opens (lazy fetch).
  const modules = useModules({ enabled: open });
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const { data: availableCategories } = useAsyncData<string[]>(
    async (signal) => {
      if (!projectId) return [];
      try {
        return await apiRequest<string[]>(`/projects/${projectId}/categories`, { signal });
      } catch {
        return [];
      }
    },
    [projectId],
    { initial: [] },
  );
  const [moduleId, setModuleId] = useState('');
  const [model, setModel] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState('');
  // Everything below the module/model/effort picker is tuning, not the choice
  // that defines the run — hidden behind this until ticked. Only its own
  // visibility is gated; the values it wraps are never reset by hiding it (see
  // the open-reset block below).
  const [advanced, setAdvanced] = useState(false);
  const confidenceContext = useConfidenceContext('glossary-gen', reasoningEffort);
  const [genContext, setGenContext] = useState<GenerationContextValue>({
    contextFields: [],
    contextLanguages: [],
    grouping: 'default',
    ignoreLimit: project?.ignoreBatchSizeLimit ?? false,
    customBatchSize: 20,
    skipCategories: [],
    ignoreGlossaries: [],
  });
  const [includeTranslations, setIncludeTranslations] = useState(false);
  // Raw textarea value for the "focus on these exact source texts" filter — one
  // string per line, trimmed + de-duped before being sent as `focusSourceTexts`.
  const [focusSourceTextsInput, setFocusSourceTextsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The in-flight (or just-finished) generation run, if any. Tracking the run
  // id lets the dialog observe progress via run-store polling and load the
  // suggestions sidecar on completion — and lets the user reopen the dialog to
  // a run started earlier (the id is the only state the dialog needs to resume).
  const [runId, setRunId] = useState<string | null>(null);
  // null = no result loaded yet; [] = generated but nothing suggested.
  const [suggestions, setSuggestions] = useState<GlossarySuggestion[] | null>(null);
  const [logs, setLogs] = useState<JudgeLogEntry[] | null>(null);
  // Guards the one-time suggestions fetch so the completion effect doesn't
  // re-fire while the request is in flight (a ref, not state, so reading/setting
  // it never triggers a re-render or a set-state-in-effect lint violation).
  const loadedRunIdRef = useRef<string | null>(null);
  // Keyed by index, not `s.name`: two suggestions can share a display name
  // (the LLM isn't guaranteed to propose distinct names), which would collide
  // both as a React list `key` and as an acceptance-toggle key, silently
  // merging two distinct suggestions into one.
  const [acceptedIdx, setAcceptedIdx] = useState<Set<number>>(new Set());

  // When the dialog opens, refresh runs so a generation run started earlier
  // (then the dialog closed) is observed again — fetchRuns auto-starts the 2s
  // polling whenever an active run is present.
  useEffect(() => {
    if (!open) return;
    void fetchRuns(projectId);
  }, [open, projectId, fetchRuns]);

  // Deep-link adoption (render-time "prev value" pattern — the lint-preferred
  // alternative to a state-syncing effect): when opened to review a specific past
  // run, adopt that run id and clear any stale result so the completion effect
  // below loads its suggestions instead of showing the setup form. `adoptedRunId`
  // makes it fire once per distinct deep-link; it is reset on close.
  const [adoptedRunId, setAdoptedRunId] = useState<string | null>(null);
  if (open && initialRunId && initialRunId !== adoptedRunId) {
    setAdoptedRunId(initialRunId);
    setRunId(initialRunId);
    setSuggestions(null);
    setLogs(null);
    setAcceptedIdx(new Set());
  }

  // Stashes a stored module/model/effort triple from the open transition below
  // until `suggestModules` (async, [] on first-ever mount since `useModules` is
  // gated on `open` and its fetch effect only runs after this render commits)
  // has actually loaded — applied once that list is non-empty, right after it's
  // computed further down (mirrors AiReviewDialog.tsx / SourceAiReviewTab.tsx).
  const [pendingStored, setPendingStored] = useState<{
    moduleId: string;
    model: string;
    reasoningEffort: string;
  } | null>(null);

  // Reset transient state during render whenever the dialog transitions to open
  // (the render-time "prev prop" pattern used elsewhere in this tab, which the
  // set-state-in-effect lint rule prefers over a state-resetting effect). The
  // run id and result are NOT reset here so reopening the dialog can resume a
  // run started before the dialog was closed.
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      const stored = readSettings();
      setError(null);
      setAdvanced(stored.advanced);
      setGenContext({
        contextFields: stored.contextFields as EntryContextField[],
        contextLanguages: stored.contextLanguages,
        grouping: asGroupingChoice(stored.grouping),
        ignoreLimit: stored.ignoreLimit || (project?.ignoreBatchSizeLimit ?? false),
        customBatchSize: stored.customBatchSize,
        skipCategories: stored.skipCategories,
        ignoreGlossaries: stored.ignoreGlossaries,
      });
      setIncludeTranslations(stored.includeTranslations);
      setFocusSourceTextsInput('');
      setPendingStored(
        stored.moduleId
          ? {
              moduleId: stored.moduleId,
              model: stored.model,
              reasoningEffort: stored.reasoningEffort,
            }
          : null,
      );
    } else {
      // Closing: forget the adopted deep-link so a later reopen (via the button
      // with no initialRunId, or a fresh deep-link to the same run) starts cleanly.
      setAdoptedRunId(null);
    }
  }

  const trackedRun = runId ? (runs.find((r) => r.runId === runId) ?? null) : null;
  const isRunning =
    trackedRun?.status === RunStatusCode.Running ||
    trackedRun?.status === RunStatusCode.Queued ||
    trackedRun?.status === RunStatusCode.Pending;
  const isTerminalFailure =
    trackedRun?.status === RunStatusCode.Failed || trackedRun?.status === RunStatusCode.Cancelled;

  // Once the tracked run finishes successfully, load its suggestions from the
  // sidecar and switch to the review UI. The ref guard makes the fetch fire
  // exactly once per run id (no synchronous setState in the effect body, which
  // the set-state-in-effect lint rule forbids — the state updates happen in the
  // async callbacks).
  useEffect(() => {
    if (!runId || suggestions !== null || loadedRunIdRef.current === runId) return;
    if (trackedRun?.status !== RunStatusCode.Completed) return;
    loadedRunIdRef.current = runId;
    void fetchJudgeLogs(projectId, runId)
      .then(setLogs)
      .catch(() => setLogs([]));
    fetchGlossarySuggestions(projectId, runId)
      .then((loaded) => {
        setSuggestions(loaded);
        setAcceptedIdx(new Set(loaded.map((_, i) => i)));
      })
      .catch((err: unknown) => {
        // Allow a later retry of the load by clearing the guard.
        loadedRunIdRef.current = null;
        setError(errorMessage(err, t('toastGenerateError')));
      });
  }, [
    runId,
    trackedRun?.status,
    suggestions,
    projectId,
    fetchGlossarySuggestions,
    fetchJudgeLogs,
    t,
  ]);

  // Offer named instances, non-instanceable bases, and instanceable bases that
  // have no instances yet (managed directly) — the same rule the AI-review /
  // source-review pickers use; a base is excluded only once it has instances.
  const realSuggestModules = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules.filter(
      (m) => m.supportsJudge && isOfferableModule(m, withInstances) && isEnabledModule(m),
    );
  }, [modules]);
  // The glossary-suggest picker also offers a synthetic NARN Freeway target
  // (M28 GlossaryGenEngine already accepts moduleId 'freeway', resolving via
  // the free pool at background priority) — appended here at THIS composition
  // site only, mirroring AiReviewDialog's judge-picker pattern, and run
  // through the SAME isOfferableModule/isEnabledModule predicates real
  // modules use (both accept it: `instanceable: false`, `enabled: true`),
  // rather than being force-included. Only added once `realSuggestModules` is
  // non-empty — that both keeps Freeway from ever being the *sole* offered
  // option (the "no modules" empty state below stays exactly as it was: real
  // API modules only) and avoids a mount-time race where the synthetic entry
  // would otherwise appear on the very first render, before the async
  // `/modules` fetch has resolved.
  const suggestModules = useMemo<ModuleSelectOption[]>(() => {
    if (realSuggestModules.length === 0) return realSuggestModules;
    const withInstances = basesWithInstances(modules);
    return [
      ...modules,
      {
        id: FREEWAY_MODULE_ID,
        name: tConfig('routing.freewayLabel'),
        instanceable: false,
        supportsJudge: true,
        enabled: true,
      },
    ].filter((m) => m.supportsJudge && isOfferableModule(m, withInstances) && isEnabledModule(m));
  }, [modules, realSuggestModules, tConfig]);
  // Apply the stashed stored module choice once the async module list has
  // loaded (suggestModules is [] on the mount-time open transition above — the
  // list is fetched lazily on open, so that block always runs before modules
  // arrive on a dialog's first-ever open). Applied at most once per open; an
  // unknown/no-longer-eligible stored module is dropped so the dialog falls
  // back to its own default-module selection.
  if (pendingStored && suggestModules.length > 0) {
    setPendingStored(null);
    if (suggestModules.some((m) => m.id === pendingStored.moduleId)) {
      setModuleId(pendingStored.moduleId);
      setModel(pendingStored.model);
      setReasoningEffort(pendingStored.reasoningEffort);
    }
  }

  const effectiveModuleId = moduleId || suggestModules[0]?.id || '';
  const noModules = modules.length > 0 && suggestModules.length === 0;

  // How many provider calls (batches) this run will make, shown before starting
  // so the per-batch progress is understandable. One progress increment lands per
  // batch of GLOSSARY_SUGGEST_CHUNK_SIZE distinct source strings; "send everything
  // in one request" collapses it to a single batch. Approximate: a module config
  // may lower its own maxBatchSize, but the default cap is the common case.
  const genBatchCount = useMemo(() => {
    const n = sourceEntryCount ?? 0;
    if (n === 0) return 0;
    if (genContext.grouping === 'custom') {
      return genContext.customBatchSize === 0 ? 1 : Math.ceil(n / genContext.customBatchSize);
    }
    return genContext.ignoreLimit && genContext.grouping !== 'default'
      ? 1
      : Math.ceil(n / GLOSSARY_SUGGEST_CHUNK_SIZE);
  }, [sourceEntryCount, genContext.grouping, genContext.ignoreLimit, genContext.customBatchSize]);

  // "Include translations" only extracts from what is sent: it requires at
  // least one context language (whose finished translations go into the
  // prompt). With none checked the toggle is disabled and the flag not sent.
  const canIncludeTranslations = genContext.contextLanguages.length > 0;

  // Parse the "focus source texts" textarea into a trimmed, de-duped,
  // non-empty list — one exact source string per line. Empty when the
  // textarea is blank so it's omitted from the request entirely.
  const focusSourceTexts = useMemo(
    () =>
      Array.from(
        new Set(
          focusSourceTextsInput
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    [focusSourceTextsInput],
  );

  const handleModuleChange = (next: string | null) => {
    setModuleId(next ?? '');
    setModel('');
    setReasoningEffort('');
  };

  // Start the background glossary-gen run. The success side effect (adopting the
  // run id + making it visible before polling catches up) goes in the vault
  // hook's `onResult` so it fires exactly once across the awaited + retried
  // (post-unlock) paths; a non-423 failure surfaces inline via `onError`.
  // `useAsyncAction` owns the `starting` flag and does the pre-call reset before
  // invoking — `invoke()` swallows the 423 and routes other failures to
  // `onError`, so its own error toast never fires (errors are shown inline).
  const generateRun = useVaultRetryAction<{ runId: string; status: string }>(
    ({ onRetry }) =>
      startGlossaryGen(
        projectId,
        {
          moduleId: effectiveModuleId,
          ...(model ? { model } : {}),
          ...(reasoningEffort ? { reasoningEffort } : {}),
          ...(genContext.ignoreGlossaries.length > 0
            ? { excludeGlossaryIds: genContext.ignoreGlossaries }
            : {}),
          ...(entryIds && entryIds.length > 0 ? { entryIds } : {}),
          ...(focusSourceTexts.length > 0 ? { focusSourceTexts } : {}),
          ...(genContext.contextFields.length > 0
            ? { contextFields: genContext.contextFields }
            : {}),
          ...(genContext.contextLanguages.length > 0
            ? { contextLanguages: genContext.contextLanguages }
            : {}),
          ...(includeTranslations && canIncludeTranslations ? { includeTranslations: true } : {}),
          ...(genContext.grouping === 'custom'
            ? { customBatchSize: genContext.customBatchSize }
            : genContext.grouping !== 'default'
              ? { batchGrouping: genContext.grouping, ignoreBatchSizeLimit: genContext.ignoreLimit }
              : {}),
          ...(genContext.skipCategories.length > 0
            ? { skipCategories: genContext.skipCategories }
            : {}),
        },
        // Vault was locked: the run actually starts after the unlock retry, so
        // adopt its id here (the call below rejects with 423 in that case).
        onRetry,
      ),
    {
      onResult: (result) => {
        setRunId(result.runId);
        // Make sure the freshly-created run is visible before polling catches up,
        // so the progress bar renders immediately.
        void fetchRuns(projectId);
      },
      onError: (err) => setError(errorMessage(err, t('toastGenerateError'))),
    },
  );
  const { run: handleGenerate, busy: starting } = useAsyncAction(
    async () => {
      if (!effectiveModuleId) return;
      setError(null);
      setSuggestions(null);
      setLogs(null);
      setAcceptedIdx(new Set());
      loadedRunIdRef.current = null;
      saveSettings({
        // Persist the effective module (falls back to the first offerable
        // module when the user never touched the selector) — not the raw
        // `moduleId` state, which stays '' in that common case and would
        // otherwise make the stored value always falsy and never restored.
        advanced,
        moduleId: effectiveModuleId,
        model,
        reasoningEffort,
        includeTranslations,
        contextFields: genContext.contextFields,
        contextLanguages: genContext.contextLanguages,
        grouping: genContext.grouping,
        ignoreLimit: genContext.ignoreLimit,
        customBatchSize: genContext.customBatchSize,
        skipCategories: genContext.skipCategories,
        ignoreGlossaries: genContext.ignoreGlossaries,
      });
      await generateRun.invoke();
    },
    { errorFallback: t('toastGenerateError') },
  );

  const toggleAccepted = (idx: number, checked: boolean) => {
    setAcceptedIdx((prev) => {
      const next = new Set(prev);
      if (checked) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  // `onAccept` (creates + assigns the chosen glossaries) is a plain promise — no
  // vault-retry — so `useAsyncAction` owns the `accepting` flag directly. A
  // failure surfaces inline via `onError` (which returns `true` to suppress the
  // hook's default error toast, since this dialog reports errors inline).
  const { run: handleAccept, busy: accepting } = useAsyncAction(
    async () => {
      if (!suggestions) return;
      const chosen = suggestions.filter((_, i) => acceptedIdx.has(i));
      if (chosen.length === 0) return;
      await onAccept(chosen);
      // Reset so reopening the dialog starts a fresh generation rather than
      // re-showing accepted suggestions.
      setRunId(null);
      setSuggestions(null);
      setLogs(null);
      loadedRunIdRef.current = null;
      onOpenChange(false);
    },
    {
      errorFallback: t('toastGenerateError'),
      onError: (err) => {
        setError(errorMessage(err, t('toastGenerateError')));
        return true;
      },
    },
  );

  const handleCancelRun = async () => {
    if (!runId) return;
    try {
      await cancelRun(projectId, runId);
    } catch (err) {
      // The progress view doesn't render the inline `error` banner, so a
      // failed cancel must be surfaced via toast or it's silently swallowed.
      toast.error(errorMessage(err, t('toastGenerateError')));
    }
  };

  // Discards the tracked run's local state (result, failure, or logs) so the
  // dialog falls back to the setup form — reachable from BOTH the failure view
  // ("Try again") and the results view ("Discard"), since runId/suggestions are
  // otherwise deliberately preserved across close→reopen.
  const handleDiscard = () => {
    setRunId(null);
    setSuggestions(null);
    setLogs(null);
    setError(null);
    setAcceptedIdx(new Set());
    loadedRunIdRef.current = null;
  };

  // Glossary generation reports per-batch progress: `completed` advances as each
  // internal chunk of the suggest call settles. Render an indeterminate (pulsing)
  // bar until the first chunk lands, then a determinate bar that fills steadily.
  const progressValue = trackedRun && trackedRun.completed > 0 ? trackedRun.completed : undefined;

  // moduleId/model/reasoningEffort are excluded: their controls render
  // unconditionally, outside {advanced && (…)} below.
  // contextLanguages is gated on activeLanguages (GenerationContextControls'
  // language section renders only when non-empty). includeTranslations is
  // gated on canIncludeTranslations (contextLanguages.length > 0), NOT on
  // hasActiveLanguages: the checkbox itself renders
  // `checked={includeTranslations && canIncludeTranslations}` and
  // `disabled={!canIncludeTranslations}`, so with active languages but no
  // context language checked it's on screen greyed out and unchecked — a
  // stale `includeTranslations: true` there must not light the badge. No
  // signal is lost: canIncludeTranslations implies contextLanguages is
  // non-empty, which already lights the badge on its own.
  // skipCategories/ignoreGlossaries are gated on availableCategories/
  // enabledGlossaries being non-empty (that component's own render condition
  // for each section); ignoreLimit/customBatchSize are gated on `grouping`,
  // mirroring the exact condition BatchGroupingControls uses to show/hide each
  // control — a value that hides a control must not make it count toward the
  // badge.
  //
  // `focusSourceTextsInput` (the "focus on these exact source texts" textarea,
  // rendered inside {advanced && (…)} below) is deliberately NOT part of this
  // comparison: it has no key in GLOSSARY_GEN_SETTINGS_DEFAULTS because it is
  // never persisted (entry-specific, see its declaration above) and always
  // resets to '' on open, so there is no "default" for it to differ from — the
  // badge cannot reflect it, by design, not oversight.
  const hasActiveLanguages = (project?.activeLanguages?.length ?? 0) > 0;
  const advancedModified = hasNonDefaultValues(
    {
      contextFields: genContext.contextFields,
      grouping: genContext.grouping,
      ...(hasActiveLanguages ? { contextLanguages: genContext.contextLanguages } : {}),
      ...(canIncludeTranslations ? { includeTranslations } : {}),
      ...(availableCategories.length > 0 ? { skipCategories: genContext.skipCategories } : {}),
      ...(enabledGlossaries.length > 0 ? { ignoreGlossaries: genContext.ignoreGlossaries } : {}),
      ...(genContext.grouping === 'custom' ? { customBatchSize: genContext.customBatchSize } : {}),
      ...(genContext.grouping !== 'default' && genContext.grouping !== 'custom'
        ? { ignoreLimit: genContext.ignoreLimit }
        : {}),
    },
    GLOSSARY_GEN_SETTINGS_DEFAULTS,
  );

  const renderBody = () => {
    if (noModules) {
      return (
        <p className="text-sm text-muted-foreground" data-testid="glossary-generate-no-modules">
          {t('generateNoModules')}
        </p>
      );
    }

    // Running (or loading the just-finished result): show the progress bar.
    // `runId && suggestions === null && !isTerminalFailure` also covers the
    // brief window between the run completing and its suggestions loading.
    if (isRunning || (runId !== null && suggestions === null && !isTerminalFailure)) {
      return (
        <div className="space-y-3" data-testid="glossary-generate-progress">
          <p className="text-sm font-medium">{t('generateRunningTitle')}</p>
          <Progress
            value={progressValue}
            max={trackedRun?.total || 100}
            data-testid="glossary-generate-progress-bar"
          />
          {trackedRun && trackedRun.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('generateProgressLabel', {
                completed: trackedRun.completed,
                total: trackedRun.total,
              })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('generateRunningHint')}</p>
        </div>
      );
    }

    // Terminal failure / cancellation: show a message and let the user retry.
    if (isTerminalFailure && suggestions === null) {
      // Surface the run's recorded error (e.g. "no module available", an LLM
      // error) so the cause is actionable, not just a generic "failed".
      const runError = trackedRun?.errors?.[0]?.message;
      return (
        <div className="space-y-1" data-testid="glossary-generate-failed">
          <p className="text-sm text-destructive">
            {trackedRun?.status === RunStatusCode.Cancelled
              ? t('generateCancelled')
              : t('generateFailed')}
          </p>
          {trackedRun?.status !== RunStatusCode.Cancelled && runError && (
            <p className="text-xs text-muted-foreground">{runError}</p>
          )}
        </div>
      );
    }

    // Results loaded: the review UI (unchanged from the blocking version).
    if (suggestions !== null) {
      return (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="glossary-generate-empty">
              {t('generateNoSuggestions')}
            </p>
          ) : (
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border p-3"
                  data-testid="glossary-suggestion"
                >
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <Checkbox
                      checked={acceptedIdx.has(idx)}
                      onCheckedChange={(checked) => toggleAccepted(idx, checked === true)}
                      data-testid="glossary-suggestion-accept"
                    />
                    <span className="font-medium text-sm">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('generateSuggestionCount', { count: s.sources.length })}
                    </span>
                  </label>
                  {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.sources.map((src) => {
                      const note = s.termNotes?.[src];
                      const translations = s.termTranslations?.[src];
                      return (
                        <span
                          key={src}
                          className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs"
                          title={note}
                        >
                          {src}
                          {note && <span className="ml-1 text-muted-foreground">— {note}</span>}
                          {translations &&
                            Object.entries(translations).map(([lang, text]) => (
                              <span
                                key={lang}
                                className="ml-1 text-muted-foreground"
                                data-testid="glossary-suggestion-translation"
                              >
                                [{lang}: {text}]
                              </span>
                            ))}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive" data-testid="glossary-generate-error">
              {error}
            </p>
          )}
          <RunLogsPanel logs={logs ?? undefined} loading={false} testId="run-glossary-gen-logs" />
        </div>
      );
    }

    // Setup form (initial state).
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="glossary-generate-module">{t('generateModule')}</Label>
          <ModuleSelect
            id="glossary-generate-module"
            triggerTestId="glossary-generate-module-trigger"
            value={effectiveModuleId}
            onValueChange={handleModuleChange}
            modules={suggestModules}
            placeholder={t('generateModulePlaceholder')}
          />
        </div>

        {effectiveModuleId && effectiveModuleId !== FREEWAY_MODULE_ID && (
          <div className="space-y-1.5">
            <Label htmlFor="glossary-generate-model">{t('generateModel')}</Label>
            <ModuleModelSelector
              key={effectiveModuleId}
              id="glossary-generate-model"
              moduleId={effectiveModuleId}
              value={model}
              onValueChange={setModel}
              confidenceContext={confidenceContext}
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

        {/* Freeway picks its own model per batch — no model/effort route
            (`/api/modules/freeway/models`) exists for the suppressed
            selectors to call, so a one-line explanation replaces them. */}
        {effectiveModuleId === FREEWAY_MODULE_ID && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="glossary-generate-freeway-model-hint"
          >
            {t('generateFreewayModelHint')}
          </p>
        )}

        <div className="border-t pt-3">
          <AdvancedToggle
            id="glossary-generate-advanced"
            testId="glossary-generate-advanced"
            checked={advanced}
            modified={advancedModified}
            onCheckedChange={setAdvanced}
            label={t('generateAdvancedOptions')}
          />
        </div>

        {advanced && (
          <>
            <GenerationContextControls
              value={genContext}
              onChange={setGenContext}
              activeLanguages={project?.activeLanguages ?? []}
              availableCategories={availableCategories}
              availableGlossaries={enabledGlossaries}
              languagesExtra={
                <div
                  className="space-y-1.5 ml-4 border-l-2 border-border pl-3"
                  data-testid="glossary-generate-include-translations-group"
                >
                  <label
                    className={`inline-flex items-center gap-2 text-sm select-none ${
                      canIncludeTranslations ? 'cursor-pointer' : 'opacity-50'
                    }`}
                  >
                    <Checkbox
                      checked={includeTranslations && canIncludeTranslations}
                      disabled={!canIncludeTranslations}
                      onCheckedChange={(checked) => setIncludeTranslations(checked === true)}
                      data-testid="glossary-generate-include-translations"
                    />
                    {t('generateIncludeTranslations')}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t('generateIncludeTranslationsHint')}
                  </p>
                </div>
              }
            />

            <div className="space-y-1.5">
              <Label htmlFor="glossary-generate-focus-source-texts">
                {t('generateFocusSourceTextsLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('generateFocusSourceTextsHint')}</p>
              <Textarea
                id="glossary-generate-focus-source-texts"
                data-testid="glossary-generate-focus-source-texts"
                value={focusSourceTextsInput}
                onChange={(e) => setFocusSourceTextsInput(e.target.value)}
                placeholder={t('generateFocusSourceTextsPlaceholder')}
                rows={3}
              />
              {focusSourceTexts.length > 0 && (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="glossary-generate-focus-source-texts-count"
                >
                  {t('generateFocusSourceTextsCount', { count: focusSourceTexts.length })}
                </p>
              )}
            </div>
          </>
        )}

        {/* A consequence preview (what the run will spend), not a tuning
            knob — unconditional even while Advanced is collapsed. */}
        {genBatchCount > 0 && !noModules && (
          <p className="text-xs text-muted-foreground" data-testid="glossary-generate-batch-count">
            {t('generateBatchCount', { count: genBatchCount })}
          </p>
        )}

        {error && (
          <p className="text-sm text-destructive" data-testid="glossary-generate-error">
            {error}
          </p>
        )}
      </div>
    );
  };

  const showProgress = isRunning || (runId !== null && suggestions === null && !isTerminalFailure);
  const showSetupActions = suggestions === null && !showProgress && !isTerminalFailure;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="glossary-generate-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t('generateTitle')}
          </DialogTitle>
          <DialogDescription>{t('generateDescription')}</DialogDescription>
        </DialogHeader>

        {/* Outside renderBody() (and its `noModules` early return) so the
            selection is still visibly acknowledged even when no module is
            configured yet — matching CategoryTab's equivalent scoped hint,
            which is placed the same way for the same reason. */}
        {entryIds && entryIds.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid="glossary-generate-scoped-hint">
            {t('generateScopedHint', { count: entryIds.length })}
          </p>
        )}

        {/* Scroll the body within the capped (max-h-[85vh]) dialog so the footer
            actions stay visible regardless of how tall the setup form grows
            (module/model + exclude-glossaries list + generation-context controls). */}
        <div className="min-h-0 flex-1 overflow-y-auto">{renderBody()}</div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          {showProgress ? (
            <Button
              variant="outline"
              onClick={handleCancelRun}
              disabled={!isRunning}
              data-testid="glossary-generate-cancel-run-btn"
            >
              {t('cancel')}
            </Button>
          ) : isTerminalFailure && suggestions === null ? (
            <Button onClick={handleDiscard} data-testid="glossary-generate-try-again-btn">
              {t('generateTryAgain')}
            </Button>
          ) : showSetupActions ? (
            <Button
              onClick={handleGenerate}
              disabled={!effectiveModuleId || starting || noModules}
              data-testid="glossary-generate-run-btn"
            >
              <Sparkles className="size-4 mr-1" />
              {starting ? t('generateRunning') : t('generate')}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleDiscard}
                disabled={accepting}
                data-testid="glossary-generate-discard-btn"
              >
                {t('generateDiscard')}
              </Button>
              <Button
                onClick={handleAccept}
                disabled={acceptedIdx.size === 0 || accepting}
                data-testid="glossary-generate-accept-btn"
              >
                {accepting
                  ? t('generateAccepting')
                  : t('generateAccept', { count: acceptedIdx.size })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
