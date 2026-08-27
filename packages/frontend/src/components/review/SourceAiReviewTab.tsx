import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type Glossary,
  type SourceReviewFindingType,
  type StringEntry,
  FREEWAY_MODULE_ID,
} from '@zercade-dev/narn-shared';
import {
  Loader2,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Check,
  EyeOff,
  ListChecks,
  Copy,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { LanguageSelect } from '@/components/ui/language-select';
import { ModuleSelect, type ModuleSelectOption } from '@/components/ui/module-select';
import { AdvancedToggle } from '@/components/common/AdvancedToggle';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { hasNonDefaultValues } from '@/lib/advanced-modified';
import { isOfferableModule, basesWithInstances, isEnabledModule } from '@/lib/module-options';
import { ApiError } from '../../hooks/use-api.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { RunProgressCard } from '@/components/common/RunProgressCard';
import { useModules, useConfiguredModels } from '../../hooks/use-modules.js';
import { ModuleModelSelector } from '../config/ModuleModelSelector.js';
import { useConfidenceContext } from '../../hooks/use-confidence-context.js';
import { ModuleReasoningEffortSelect } from '../config/ModuleReasoningEffortSelect.js';
import {
  asGroupingChoice,
  BatchGroupingControls,
  type GroupingChoice,
} from '../config/BatchGroupingControls.js';
import { useRunStore, type SourceReviewRecord } from '../../stores/run-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useDialogSettings } from '../../hooks/use-dialog-settings.js';
import {
  REVIEW_TEXT_BLOCK,
  ReviewCardShell,
  ReviewEmptyState,
  RevealList,
  DiffText,
  DiffLegend,
  ExpandableText,
  SubmitButton,
  formatRunStamp,
  glossaryHints as computeGlossaryHints,
  isRunActive,
  useFullGlossaries,
  useReviewShortcuts,
  type GlossaryHint,
  type ShortcutMap,
} from './review-shared.js';

/**
 * Status tint per finding type. One distinct hue family per category so they
 * read apart at a glance, ordered loosely by severity: a neutral slate for the
 * cosmetic "typo", warmer amber/violet/sky for grammar/terminology/clarity, and
 * a deliberately heavier destructive treatment (filled + ring, not a faint
 * wash) for "unsafe" so the one category a reviewer must not miss carries the
 * most visual weight.
 */
const FINDING_TINT: Record<SourceReviewFindingType, string> = {
  typo: 'bg-muted text-muted-foreground',
  grammar: 'bg-status-warn/10 text-status-warn',
  terminology: 'bg-type-dialogue/10 text-type-dialogue',
  clarity: 'bg-status-info/10 text-status-info',
  unsafe: 'bg-status-fail/15 text-status-fail ring-1 ring-inset ring-status-fail/30',
};

const FINDING_TYPE_KEY: Record<SourceReviewFindingType, string> = {
  typo: 'sourceAi.findingTypo',
  grammar: 'sourceAi.findingGrammar',
  terminology: 'sourceAi.findingTerminology',
  clarity: 'sourceAi.findingClarity',
  unsafe: 'sourceAi.findingUnsafe',
};

const CHECKS: readonly SourceReviewFindingType[] = [
  'typo',
  'grammar',
  'terminology',
  'clarity',
  'unsafe',
];

/** Canonical reading order of findings within an entry. */
const FINDING_ORDER: Record<SourceReviewFindingType, number> = {
  typo: 0,
  grammar: 1,
  terminology: 2,
  clarity: 3,
  unsafe: 4,
};

const DEFAULT_BATCH_SIZE = 12;

/** Default reply language for the AI's finding text (English). */
const DEFAULT_REPLY_LANGUAGE = 'en';

/** Last-used per-browser values for the source-review config dialog. */
const SOURCE_REVIEW_SETTINGS_DEFAULTS = {
  advanced: false,
  enabled: {
    typo: true,
    grammar: true,
    terminology: true,
    clarity: true,
    unsafe: true,
  } as Record<string, boolean>,
  batchSizeText: String(DEFAULT_BATCH_SIZE),
  replyLanguage: DEFAULT_REPLY_LANGUAGE,
  scope: 'never-reviewed',
  grouping: 'default' as string,
  ignoreLimit: false,
  customBatchSize: 20,
  moduleId: '',
  model: '',
  reasoningEffort: '',
};

/**
 * Source-language AI review sub-tab. A single "Run review" button opens a dialog
 * holding the check toggles, batch size, the module/model selector, and the
 * per-run reasoning-effort override; the actual Start lives in that dialog. The
 * tab shows compact live progress for an active run, and — for a
 * selected/deep-linked run picked via a popover run selector — renders flagged
 * entries one at a time with persisted approve / ignore / prev-next
 * affordances plus a "View all findings" dialog.
 *
 * Full cost/progress lives in the Activity tab; this tab does not rebuild it.
 */
export function SourceAiReviewTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation('review');
  // Only for the synthetic Freeway option's label below (`config:routing.freewayLabel`,
  // reused from the routing picker rather than duplicating the string here).
  const { t: tConfig } = useTranslation('config');

  const runs = useRunStore((s) => s.runs);
  const fetchRuns = useRunStore((s) => s.fetchRuns);
  const startSourceReview = useRunStore((s) => s.startSourceReview);
  const fetchSourceReview = useRunStore((s) => s.fetchSourceReview);
  const approveEntry = useRunStore((s) => s.approveSourceReviewEntry);
  const ignoreEntry = useRunStore((s) => s.ignoreSourceReviewEntry);
  const cancelRun = useRunStore((s) => s.cancelRun);

  const entries = useStringStore((s) => s.entries);
  const fetchEntries = useStringStore((s) => s.fetchEntries);

  const reviewRunId = useViewStore((s) => s.reviewRunId);
  const clearReviewRunId = useViewStore((s) => s.clearReviewRunId);

  // The project's remembered source-review selection, used as the default.
  const sourceReviewConfig = useProjectStore((s) => s.getActiveProject()?.sourceReviewConfig);

  // Last-used per-browser config-dialog values (module key: 'source-review').
  const { read: readSettings, save: saveSettings } = useDialogSettings(
    'source-review',
    SOURCE_REVIEW_SETTINGS_DEFAULTS,
  );
  // Snapshot taken once at mount to lazily seed the plain tab-level states
  // below; `read()` itself re-reads storage on every dialog open (see the
  // config-dialog-open block further down).
  const [settingsAtMount] = useState(() => readSettings());

  // Everything below the scope choice is tuning, not the choice that defines
  // the run — hidden behind this until ticked. Only its own visibility is
  // gated; the values it wraps are never reset by hiding it. Seeded once at
  // mount, like the other plain settings below (see `settingsAtMount`).
  const [advanced, setAdvanced] = useState(settingsAtMount.advanced);
  // Mirrors `advanced`, EXCEPT the force-open effect below never touches it —
  // only the mount seed and the user's own checkbox click do. `handleStart`
  // persists THIS, not `advanced`: a transient validation state (an unchecked
  // checks row, or a broken batch size) forcing the section open must not
  // permanently overwrite the user's remembered Advanced default the next
  // time they start a source review.
  const userAdvancedRef = useRef(settingsAtMount.advanced);
  // Check toggles; all on by default so a single click starts a useful review.
  const [enabled, setEnabled] = useState<Record<SourceReviewFindingType, boolean>>(
    () => ({ ...settingsAtMount.enabled }) as Record<SourceReviewFindingType, boolean>,
  );
  const [batchSizeText, setBatchSizeText] = useState(settingsAtMount.batchSizeText);
  // Language the AI writes its finding text in; English by default.
  const [replyLanguage, setReplyLanguage] = useState(settingsAtMount.replyLanguage);
  // Per-run related-entry grouping override; 'default' = project/workspace.
  const [grouping, setGrouping] = useState<GroupingChoice>(
    asGroupingChoice(settingsAtMount.grouping),
  );
  const [ignoreLimit, setIgnoreLimit] = useState(settingsAtMount.ignoreLimit);
  const [customBatchSize, setCustomBatchSize] = useState(settingsAtMount.customBatchSize);
  const [configOpen, setConfigOpen] = useState(false);
  // Run scope: skip entries that already carry a persisted sourceReview stamp
  // (the default — cheap re-runs), or review everything.
  const [scope, setScope] = useState<'never-reviewed' | 'all'>(
    settingsAtMount.scope === 'all' ? 'all' : 'never-reviewed',
  );

  // Module/model selection for the review run. `null` means "not chosen yet".
  const modules = useModules();
  const [userModuleId, setUserModuleId] = useState<string | null>(null);
  const [userModel, setUserModel] = useState<string>('');
  // Per-run reasoning-effort override. `null` = the user hasn't chosen, so the
  // saved config's effort is the default; `''` means "model default" (none
  // sent). Derived rather than seeded into state so it stays correct when the
  // project (and its saved config) loads asynchronously or the user switches
  // projects without the tab remounting.
  const [userReasoningEffort, setUserReasoningEffort] = useState<string | null>(null);
  // Per-module globally-configured model, used to seed the model field.
  const configuredModels = useConfiguredModels();

  // Per-run findings, lazily fetched once and cached.
  const [recordsByRun, setRecordsByRun] = useState<Record<string, SourceReviewRecord[]>>({});
  const requestedRef = useRef<Set<string>>(new Set());
  // The run the user explicitly picked; a deep-linked run wins until then.
  const [pickedRunId, setPickedRunId] = useState<string | null>(null);
  const [runPickerOpen, setRunPickerOpen] = useState(false);
  const [allFindingsOpen, setAllFindingsOpen] = useState(false);

  // Source-review runs, newest first — the candidates for the selector.
  const sourceRuns = useMemo(
    () => runs.filter((r) => r.kind === 'source-review').sort((a, b) => b.startedAt - a.startedAt),
    [runs],
  );

  const activeRun = useMemo(() => sourceRuns.find((r) => isRunActive(r)), [sourceRuns]);

  const hasSourceRun = (runId: string | null) =>
    runId !== null && sourceRuns.some((r) => r.runId === runId);

  // The focused run: a valid deep-link wins until the user picks, then their
  // pick wins; otherwise the most recent source-review run.
  const effectiveRunId = hasSourceRun(reviewRunId)
    ? reviewRunId
    : hasSourceRun(pickedRunId)
      ? pickedRunId
      : (sourceRuns[0]?.runId ?? null);

  const selectedRun = sourceRuns.find((r) => r.runId === effectiveRunId);

  const anyCheck = CHECKS.some((c) => enabled[c]);
  const batchSize = Number.parseInt(batchSizeText, 10);
  const batchSizeValid = Number.isInteger(batchSize) && batchSize > 0;

  // Review-capable modules (those that can run an AI review — the same LLM
  // modules that implement the judge). Only named instances (and any
  // non-instanceable module) are offered; bare instanceable base modules are
  // managed through their instances, mirroring the global config module list.
  const realReviewModules = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules.filter(
      (m) => m.supportsJudge && isOfferableModule(m, withInstances) && isEnabledModule(m),
    );
  }, [modules]);
  // The review picker also offers a synthetic NARN Freeway target (M26
  // SourceReviewEngine already accepts moduleId 'freeway', resolving via the
  // free pool at background priority) — appended here at THIS composition
  // site only, mirroring AppShell's RoutingTabContent `routingModules`
  // pattern, and run through the SAME isOfferableModule/isEnabledModule
  // predicates real modules use (both accept it: `instanceable: false`,
  // `enabled: true`), rather than being force-included. Only added once
  // `realReviewModules` is non-empty — that both keeps Freeway from ever
  // being the *sole* offered option (the "no review modules" empty state
  // below stays exactly as it was: real API modules only) and avoids a
  // mount-time race where the synthetic entry would otherwise appear on the
  // very first render, before the async `/modules` fetch has resolved.
  const reviewModules = useMemo<ModuleSelectOption[]>(() => {
    if (realReviewModules.length === 0) return realReviewModules;
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
  }, [modules, realReviewModules, tConfig]);

  // Apply last-used module/model/effort when the config dialog opens. Stored
  // values are applied only while that module is still review-capable —
  // otherwise the saved-config/first-review-capable-module default chain
  // below stays in charge. (Render-time "prev prop" pattern, as in
  // AiReviewDialog.)
  const [prevConfigOpen, setPrevConfigOpen] = useState(false);
  // Stashes a stored module/model/effort triple from the open transition below
  // until `realReviewModules` (async, [] on mount) has actually loaded — see
  // the adjustment block right after this one.
  const [pendingStored, setPendingStored] = useState<{
    moduleId: string;
    model: string;
    reasoningEffort: string;
  } | null>(null);
  if (configOpen !== prevConfigOpen) {
    setPrevConfigOpen(configOpen);
    if (configOpen) {
      const stored = readSettings();
      setPendingStored(
        stored.moduleId
          ? {
              moduleId: stored.moduleId,
              model: stored.model,
              reasoningEffort: stored.reasoningEffort,
            }
          : null,
      );
    }
  }

  // Apply the stashed stored module choice once the async module list has
  // loaded (realReviewModules is [] on the mount-time-adjacent open
  // transition above if it fires before /modules resolves; gated on
  // realReviewModules rather than reviewModules since the latter always
  // contains at least the synthetic Freeway entry, which would never let this
  // wait for the real fetch). Applied at most once per open; an
  // unknown/no-longer-eligible stored module is dropped so the default chain
  // below stays in charge.
  if (pendingStored && realReviewModules.length > 0) {
    setPendingStored(null);
    if (reviewModules.some((m) => m.id === pendingStored.moduleId)) {
      setUserModuleId(pendingStored.moduleId);
      setUserModel(pendingStored.model);
      setUserReasoningEffort(pendingStored.reasoningEffort || null);
    }
  }

  // Default chain: the project's saved selection (while its module is still
  // review-capable), else the first review-capable module. `user*` overrides win.
  const savedIsReviewCapable =
    sourceReviewConfig?.moduleId !== undefined &&
    reviewModules.some((m) => m.id === sourceReviewConfig.moduleId);
  const defaultModuleId = savedIsReviewCapable
    ? sourceReviewConfig.moduleId!
    : (reviewModules[0]?.id ?? '');
  const moduleId = userModuleId ?? defaultModuleId;
  // Seed the model: a chosen model wins; otherwise the saved model while still on
  // the saved module (so the remembered model becomes the preferred default).
  const preferredModel =
    userModuleId === null && savedIsReviewCapable && moduleId === sourceReviewConfig.moduleId
      ? (sourceReviewConfig.model ?? configuredModels[moduleId])
      : configuredModels[moduleId];
  // Seed the effort from the saved config while still on the saved module; a
  // user pick (including clearing to `''`) always wins.
  const defaultReasoningEffort =
    savedIsReviewCapable && moduleId === sourceReviewConfig.moduleId
      ? (sourceReviewConfig.reasoningEffort ?? '')
      : '';
  const reasoningEffort = userReasoningEffort ?? defaultReasoningEffort;
  const confidenceContext = useConfidenceContext('source-review', reasoningEffort);
  const noReviewModules = modules.length > 0 && realReviewModules.length === 0;

  // Ensure runs and entries load when opening the tab directly.
  useEffect(() => {
    if (!projectId) return;
    void fetchRuns(projectId);
    void fetchEntries(projectId);
  }, [projectId, fetchRuns, fetchEntries]);

  // Full glossaries (with terms) for this project, so the reviewer can see the
  // glossary terms that apply to the current entry's source text. Best-effort —
  // the panel just shows nothing if glossaries don't exist yet.
  const { glossaries } = useFullGlossaries(projectId);

  // Whether the focused run is still active — findings are only complete once it
  // has finished, so an active run is fetched again after it settles.
  const focusedActive = effectiveRunId !== null && activeRun?.runId === effectiveRunId;

  // Lazily fetch the focused run's findings, caching the result. A fetch issued
  // while the run was still active is re-issued once it settles (keyed by the
  // run's active state) so completed findings replace the mid-run snapshot.
  useEffect(() => {
    if (effectiveRunId === null) return;
    const runId = effectiveRunId;
    const cacheKey = `${runId}:${focusedActive ? 'active' : 'done'}`;
    if (requestedRef.current.has(cacheKey)) return;
    requestedRef.current.add(cacheKey);
    fetchSourceReview(projectId, runId)
      .then((records) => setRecordsByRun((prev) => ({ ...prev, [runId]: records })))
      .catch(() => setRecordsByRun((prev) => ({ ...prev, [runId]: [] })));
  }, [effectiveRunId, focusedActive, fetchSourceReview, projectId]);

  const detailLoading = effectiveRunId !== null && recordsByRun[effectiveRunId] === undefined;

  const handleModuleChange = (next: string | null) => {
    setUserModuleId(next ?? '');
    // Clear the chosen model so the remounted ModuleModelSelector auto-picks the
    // new module's configured model (or its cheapest when none is configured).
    setUserModel('');
    // A new module advertises different reasoning efforts; drop any override so
    // it falls back to the new module's default (no saved effort applies once the
    // user has switched off the saved module).
    setUserReasoningEffort(null);
  };

  // The default engine scope is "needs translation, not ignored"; mirror it
  // here so the option counts match what a run would actually cover.
  const reviewableEntries = useMemo(
    () => (entries ?? []).filter((e) => e.needsTranslation && !e.ignored),
    [entries],
  );
  const neverReviewedEntries = useMemo(
    () => reviewableEntries.filter((e) => e.sourceReview === undefined),
    [reviewableEntries],
  );
  const scopeEmpty = scope === 'never-reviewed' && neverReviewedEntries.length === 0;

  const { run: handleStart, busy: starting } = useAsyncAction(
    async () => {
      if (!anyCheck || !batchSizeValid || activeRun || !moduleId || scopeEmpty) return;
      saveSettings({
        advanced: userAdvancedRef.current,
        enabled: { ...enabled },
        batchSizeText,
        replyLanguage,
        scope,
        grouping,
        ignoreLimit,
        customBatchSize,
        moduleId,
        model: userModel,
        reasoningEffort,
      });
      await startSourceReview(projectId, {
        ...(scope === 'never-reviewed' ? { entryIds: neverReviewedEntries.map((e) => e.id) } : {}),
        checks: {
          typo: enabled.typo,
          grammar: enabled.grammar,
          terminology: enabled.terminology,
          clarity: enabled.clarity,
          unsafe: enabled.unsafe,
        },
        // Omitted at the default: the server's own flat constant is the same
        // 12, so this is behaviour-neutral for a non-Freeway run, and it lets
        // a Freeway-routed run size to its bucket instead of being pinned to
        // this field's default value on every single start.
        ...(batchSize !== DEFAULT_BATCH_SIZE ? { batchSize } : {}),
        moduleId,
        ...(userModel ? { model: userModel } : {}),
        ...(reasoningEffort ? { reasoningEffort } : {}),
        // English is the model default; only send a non-default language.
        ...(replyLanguage && replyLanguage !== DEFAULT_REPLY_LANGUAGE
          ? { responseLanguage: replyLanguage }
          : {}),
        // 'default' = inherit project/workspace; omit the per-run override.
        ...(grouping === 'custom'
          ? { customBatchSize }
          : grouping !== 'default'
            ? { batchGrouping: grouping, ignoreBatchSizeLimit: ignoreLimit }
            : {}),
      });
      setConfigOpen(false);
    },
    {
      errorFallback: t('sourceAi.startFailed'),
      successMessage: t('sourceAi.startSuccess'),
      // 423 (vault locked) is surfaced by the global vault dialog — stay quiet.
      onError: (err) => err instanceof ApiError && err.status === 423,
    },
  );

  const startDisabled =
    !anyCheck || !batchSizeValid || starting || activeRun !== undefined || !moduleId || scopeEmpty;

  // Invariant: Start is never disabled without a visible cause. `!anyCheck`
  // and `!batchSizeValid` are the only two causes that live behind Advanced
  // (an unchecked checks row, or a batch size the user broke before
  // collapsing) — if either is blocking Start while Advanced is collapsed,
  // force it back open so the cause is on screen again. Self-maintaining if a
  // third hidden cause is ever added, unlike a hand-picked list of
  // unconditional warnings. Fires at most once per cause: setting `advanced`
  // true makes the `!advanced` guard false on the next render, so it never
  // fights a deliberate collapse the user makes while these are already fine.
  if (!advanced && (!anyCheck || !batchSizeValid) && moduleId && !scopeEmpty) {
    setAdvanced(true);
  }

  // scope/moduleId/model/reasoningEffort are excluded: their controls render
  // unconditionally, outside {advanced && (…)} below (`scope`'s fieldset above
  // the Advanced toggle; the module/model/effort pickers below it, but still
  // outside the gated block). ignoreLimit/customBatchSize are gated on
  // `grouping`, mirroring the exact condition BatchGroupingControls uses to
  // show/hide each control — a grouping value that hides one must not make it
  // count toward the badge. `enabled` (the checks map) is compared key-by-key
  // rather than via hasNonDefaultValues' JSON.stringify (sensitive to
  // insertion order), since a persisted `enabled` object's key order isn't
  // guaranteed to match CHECKS'.
  const enabledModified = CHECKS.some(
    (key) => enabled[key] !== SOURCE_REVIEW_SETTINGS_DEFAULTS.enabled[key],
  );
  const advancedModified =
    enabledModified ||
    hasNonDefaultValues(
      {
        batchSizeText,
        replyLanguage,
        grouping,
        ...(grouping === 'custom' ? { customBatchSize } : {}),
        ...(grouping !== 'default' && grouping !== 'custom' ? { ignoreLimit } : {}),
      },
      SOURCE_REVIEW_SETTINGS_DEFAULTS,
    );

  const records = effectiveRunId !== null ? recordsByRun[effectiveRunId] : undefined;
  const flaggedRecords = useMemo(
    () => (records ?? []).filter((r) => r.findings.length > 0),
    [records],
  );
  const lqaByEntry = useMemo(() => lqaCountByEntry(entries), [entries]);

  const pickRun = (runId: string) => {
    setPickedRunId(runId);
    if (reviewRunId !== null) clearReviewRunId();
    setRunPickerOpen(false);
  };

  // Persist a disposition, then update the cached run records so the navigator
  // (and a later reload) reflect the stored state.
  const handleApproveEntry = async (entryId: string) => {
    if (effectiveRunId === null) return;
    const runId = effectiveRunId;
    await approveEntry(projectId, runId, entryId);
    setRecordsByRun((prev) => ({
      ...prev,
      [runId]: (prev[runId] ?? []).map((r) =>
        r.entryId === entryId ? { ...r, approved: true } : r,
      ),
    }));
  };

  const handleIgnoreEntry = async (entryId: string) => {
    if (effectiveRunId === null) return;
    const runId = effectiveRunId;
    await ignoreEntry(projectId, runId, entryId);
    setRecordsByRun((prev) => ({
      ...prev,
      [runId]: (prev[runId] ?? []).filter((r) => r.entryId !== entryId),
    }));
  };

  return (
    <div
      className="mx-auto w-full max-w-4xl space-y-6 xl:max-w-6xl 2xl:max-w-7xl"
      data-testid="source-ai-review"
    >
      {/* Configuration + trigger */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <h3 className="text-sm font-semibold">{t('sourceAi.configTitle')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('sourceAi.configHint')}</p>

        <Button
          onClick={() => setConfigOpen(true)}
          disabled={activeRun !== undefined}
          data-testid="source-ai-open-config"
        >
          <Sparkles className="mr-1 size-4" />
          {t('sourceAi.runReview')}
        </Button>
      </section>

      {/* Run-review configuration dialog */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent data-testid="source-ai-config-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {t('sourceAi.configTitle')}
            </DialogTitle>
            <DialogDescription>{t('sourceAi.configHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('sourceAi.scopeLabel')}</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="source-ai-scope"
                  value="never-reviewed"
                  checked={scope === 'never-reviewed'}
                  onChange={() => setScope('never-reviewed')}
                  data-testid="source-ai-scope-never"
                />
                {t('sourceAi.scopeNeverReviewed', { count: neverReviewedEntries.length })}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="source-ai-scope"
                  value="all"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  data-testid="source-ai-scope-all"
                />
                {t('sourceAi.scopeAll', { count: reviewableEntries.length })}
              </label>
              {scopeEmpty && (
                <p className="text-xs text-status-warn" data-testid="source-ai-scope-none-hint">
                  {t('sourceAi.scopeNoneHint')}
                </p>
              )}
            </fieldset>

            <div className="border-t pt-3">
              <AdvancedToggle
                id="source-ai-advanced"
                testId="source-ai-advanced"
                checked={advanced}
                modified={advancedModified}
                onCheckedChange={(next) => {
                  setAdvanced(next);
                  userAdvancedRef.current = next;
                }}
                label={t('sourceAi.advancedOptions')}
              />
            </div>

            {/* Which AI reviews the run is a defining choice, not tuning — same
                cost/credentials profile as AiReviewDialog's judge picker, which
                is never gated either. Unconditional (not just when Advanced is
                open) so it also explains why Start stays disabled when no
                review-capable module exists. */}
            {noReviewModules ? (
              <p className="text-sm text-muted-foreground" data-testid="source-ai-no-modules">
                {t('sourceAi.noModules')}
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="source-ai-module">{t('sourceAi.module')}</Label>
                  <ModuleSelect
                    id="source-ai-module"
                    className="w-full"
                    triggerTestId="source-ai-module-trigger"
                    value={moduleId}
                    onValueChange={handleModuleChange}
                    modules={reviewModules}
                    placeholder={t('sourceAi.modulePlaceholder')}
                  />
                </div>

                {moduleId && moduleId !== FREEWAY_MODULE_ID && (
                  <div className="space-y-1.5">
                    <Label htmlFor="source-ai-model">{t('sourceAi.model')}</Label>
                    <ModuleModelSelector
                      key={moduleId}
                      id="source-ai-model"
                      moduleId={moduleId}
                      value={userModel}
                      onValueChange={setUserModel}
                      preferredModel={preferredModel}
                      triggerClassName="min-w-0 flex-1 shrink"
                      confidenceContext={confidenceContext}
                    />
                  </div>
                )}

                {moduleId && moduleId !== FREEWAY_MODULE_ID && (
                  <ModuleReasoningEffortSelect
                    moduleId={moduleId}
                    model={userModel || undefined}
                    value={reasoningEffort}
                    onChange={setUserReasoningEffort}
                    id="source-ai-reasoning-effort"
                    label={t('sourceAi.reasoningEffort')}
                  />
                )}

                {/* Freeway picks its own model per batch — no model/effort
                    route (`/api/modules/freeway/models`) exists for the
                    selectors above to call, so they're replaced with a
                    one-line explanation. */}
                {moduleId === FREEWAY_MODULE_ID && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="source-ai-freeway-model-hint"
                  >
                    {t('sourceAi.freewayModelHint')}
                  </p>
                )}
              </>
            )}

            {advanced && (
              <>
                <div className="space-y-1.5">
                  <Label>{t('sourceAi.checksLabel')}</Label>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {CHECKS.map((check) => (
                      <label
                        key={check}
                        className="inline-flex cursor-pointer select-none items-center gap-1.5 text-sm"
                      >
                        <Checkbox
                          checked={enabled[check]}
                          onCheckedChange={(checked) =>
                            setEnabled((prev) => ({ ...prev, [check]: checked === true }))
                          }
                          data-testid={`source-ai-check-${check}`}
                        />
                        {t(FINDING_TYPE_KEY[check])}
                      </label>
                    ))}
                  </div>
                  {!anyCheck && (
                    <p className="text-xs text-status-warn" data-testid="source-ai-no-check">
                      {t('sourceAi.noCheckHint')}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label htmlFor="source-ai-batch-size" className="text-xs font-medium">
                    {t('sourceAi.batchSize')}
                  </label>
                  <Input
                    id="source-ai-batch-size"
                    type="number"
                    min={1}
                    value={batchSizeText}
                    onChange={(e) => setBatchSizeText(e.target.value)}
                    className="w-24"
                    aria-invalid={!batchSizeValid}
                    data-testid="source-ai-batch-size"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="source-ai-reply-language">{t('sourceAi.replyLanguage')}</Label>
                  <LanguageSelect
                    id="source-ai-reply-language"
                    triggerTestId="source-ai-reply-language-trigger"
                    value={replyLanguage}
                    onValueChange={setReplyLanguage}
                  />
                  <p className="text-xs text-muted-foreground">{t('sourceAi.replyLanguageHint')}</p>
                </div>

                <BatchGroupingControls
                  idPrefix="source-ai-grouping"
                  grouping={grouping}
                  onGroupingChange={setGrouping}
                  ignoreLimit={ignoreLimit}
                  onIgnoreLimitChange={setIgnoreLimit}
                  customBatchSize={customBatchSize}
                  onCustomBatchSizeChange={setCustomBatchSize}
                />
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              {t('sourceAi.cancel')}
            </Button>
            <SubmitButton
              loading={starting}
              icon={Sparkles}
              onClick={handleStart}
              disabled={startDisabled}
              data-testid="source-ai-start"
            >
              {t('sourceAi.start')}
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live progress for an active run (full cost/progress lives in Activity). */}
      {activeRun && (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <RunProgressCard
              run={activeRun}
              runningLabel={t('sourceAi.progressLabel')}
              hint={t('sourceAi.progressActivityNote')}
              data-testid="source-ai-progress"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-status-fail hover:text-status-fail hover:bg-status-fail/10"
            onClick={() =>
              cancelRun(projectId, activeRun.runId).catch((err: unknown) =>
                toast.error((err as Error).message),
              )
            }
            data-testid="source-ai-cancel-run"
          >
            <XCircle className="size-4" />
            {t('cancel')}
          </Button>
        </div>
      )}

      {/* Findings detail */}
      {sourceRuns.length === 0 ? (
        <ReviewEmptyState
          icon={Sparkles}
          title={t('sourceAi.emptyTitle')}
          hint={t('sourceAi.emptyHint')}
          testId="source-ai-empty"
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{t('sourceAi.runLabel')}</span>
            {/* Run selector — a button opening a popover list of runs. */}
            <Popover open={runPickerOpen} onOpenChange={setRunPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="w-[340px] justify-between font-normal"
                    data-testid="source-ai-run-select"
                  >
                    <span className="truncate">
                      {selectedRun
                        ? formatRunStamp(selectedRun)
                        : t('sourceAi.runPickerPlaceholder')}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
                  </Button>
                }
              />
              <PopoverContent
                className="max-h-[60vh] w-[340px] overflow-auto p-1"
                data-testid="source-ai-run-list"
              >
                {sourceRuns.map((run) => (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => pickRun(run.runId)}
                    className={cn(
                      'flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                      run.runId === effectiveRunId && 'bg-accent/60',
                    )}
                    data-testid={`source-ai-run-option-${run.runId}`}
                  >
                    <span>
                      <span className="font-mono">{run.runId.slice(0, 8)}</span>
                      {' · '}
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                    {run.sourceReviewSummary && (
                      <span className="text-xs text-muted-foreground">
                        {t('sourceAi.runSummary', {
                          flagged: run.sourceReviewSummary.flagged,
                          reviewed: run.sourceReviewSummary.reviewed,
                          findings: run.sourceReviewSummary.findings,
                        })}
                      </span>
                    )}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            {/* Quick "view all findings" overview across every reviewed entry. */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAllFindingsOpen(true)}
              disabled={flaggedRecords.length === 0}
              data-testid="source-ai-view-all"
            >
              <ListChecks className="mr-1 size-4" aria-hidden />
              {t('sourceAi.viewAll')}
            </Button>
          </div>

          {selectedRun && (
            <div data-testid="source-ai-detail">
              {selectedRun.sourceReviewSummary && (
                <p className="text-xs text-muted-foreground">
                  {t('sourceAi.runSummary', {
                    flagged: selectedRun.sourceReviewSummary.flagged,
                    reviewed: selectedRun.sourceReviewSummary.reviewed,
                    findings: selectedRun.sourceReviewSummary.findings,
                  })}
                </p>
              )}
              {/* Keyed on the run so switching runs remounts the navigator and
                  re-derives its position from that run's persisted records. */}
              <FindingsNavigator
                key={selectedRun.runId}
                flagged={flaggedRecords}
                loading={detailLoading}
                glossaries={glossaries}
                lqaByEntry={lqaByEntry}
                dialogOpen={allFindingsOpen}
                onApprove={handleApproveEntry}
                onIgnore={handleIgnoreEntry}
              />
            </div>
          )}

          {/* All-findings overview dialog */}
          <AllFindingsDialog
            open={allFindingsOpen}
            onOpenChange={setAllFindingsOpen}
            records={flaggedRecords}
          />
        </section>
      )}
    </div>
  );
}

/** Map of entryId → count of LQA issues across all target languages. */
function lqaCountByEntry(entries: StringEntry[] | undefined): Record<string, number> {
  const map: Record<string, number> = {};
  for (const entry of entries ?? []) {
    let count = 0;
    for (const result of Object.values(entry.lqaResults ?? {})) {
      count += result?.issues?.length ?? 0;
    }
    if (count > 0) map[entry.id] = count;
  }
  return map;
}

/**
 * Flagged-entry navigator. Only entries that actually have findings are shown
 * (the reviewed-but-clean ones carry no detail), one at a time with prev/next
 * navigation and an "X of N" counter. Each entry renders its findings, any
 * matching glossary terms + an LQA-issue hint, the single unified
 * corrected-source suggestion (with a copy button), and persisted Approve /
 * Ignore actions: approve marks the stored record (and survives reloads),
 * ignore removes it from the run. Approving or ignoring never edits the source
 * text itself. Keyboard: ↑/↓ navigate, a approve, i ignore.
 */
function FindingsNavigator({
  flagged,
  loading,
  glossaries,
  lqaByEntry,
  dialogOpen,
  onApprove,
  onIgnore,
}: Readonly<{
  /** Already filtered to records with findings (derived once in the parent). */
  flagged: SourceReviewRecord[];
  loading: boolean;
  glossaries: Glossary[];
  lqaByEntry: Record<string, number>;
  /** True while the "View all findings" dialog is open — gates the shortcuts
   * below so a keystroke like `a` can't act on the hidden card behind it. */
  dialogOpen: boolean;
  /** Persists an approve for the entry; rejects on failure (caller toasts). */
  onApprove: (entryId: string) => Promise<void>;
  /** Persists an ignore (removes the record); rejects on failure. */
  onIgnore: (entryId: string) => Promise<void>;
}>) {
  const { t } = useTranslation('review');

  const [index, setIndex] = useState(() => firstUnapprovedIndex(flagged));
  // Guards against a second approve/ignore firing (rapid keypresses or a
  // click plus a keystroke) while the persist for the first is still in flight.
  const [acting, setActing] = useState(false);
  // Jump to the first non-approved entry whenever the flagged set GROWS — the
  // initial async load and an active run's snapshot being replaced by the full
  // list both land here, so a reload resumes at the first entry still needing
  // review. A shrink (an ignore) keeps the position: the next entry slides
  // into the current index.
  const [prevCount, setPrevCount] = useState(flagged.length);
  if (prevCount !== flagged.length) {
    const grew = flagged.length > prevCount;
    setPrevCount(flagged.length);
    if (grew) setIndex(firstUnapprovedIndex(flagged));
  }
  const safeIndex = Math.min(index, Math.max(0, flagged.length - 1));
  const current = flagged[safeIndex];

  // Glossary terms matching the current entry's source, memoized so the
  // per-term RegExp compilation doesn't repeat on every render (e.g. each
  // keystroke that re-attaches the keyboard handler).
  const glossaryTerms = useMemo<GlossaryHint[]>(
    () => (current ? computeGlossaryHints(current.sourceText, glossaries) : []),
    [current, glossaries],
  );

  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));
  const goNext = () => setIndex((i) => Math.min(i + 1, Math.max(0, flagged.length - 1)));

  const currentId = current?.entryId;
  const isApproved = current?.approved === true;

  const handleApprove = async () => {
    if (currentId === undefined || isApproved || acting) return;
    setActing(true);
    try {
      await onApprove(currentId);
      toast.success(t('sourceAi.approvedToast'));
      // Advance to the next entry still needing review, if any remains.
      const next = flagged.findIndex((r, i) => i > safeIndex && r.approved !== true);
      if (next !== -1) setIndex(next);
    } catch {
      toast.error(t('sourceAi.approveFailed'));
    } finally {
      setActing(false);
    }
  };

  const handleIgnore = async () => {
    if (currentId === undefined || acting) return;
    setActing(true);
    try {
      await onIgnore(currentId);
      toast.info(t('sourceAi.ignoredToast'));
    } catch {
      toast.error(t('sourceAi.ignoreFailed'));
    } finally {
      setActing(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('sourceAi.copied'));
    } catch {
      toast.error(t('sourceAi.copyFailed'));
    }
  };

  // Keyboard shortcuts for review throughput: ↑/↓ navigate, a approve, i ignore.
  // The handlers close over the current entry (via safeIndex/flagged) so the
  // map is rebuilt only when one of those changes.
  const shortcuts = useMemo<ShortcutMap>(
    () => ({
      ArrowDown: goNext,
      ArrowUp: goPrev,
      a: () => void handleApprove(),
      i: () => void handleIgnore(),
    }),
    // goNext/goPrev/handleApprove/handleIgnore derive solely from these deps
    // plus `acting`, included so the re-entry guard isn't a stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safeIndex, flagged, acting],
  );
  // Disabled while the "View all findings" dialog is open — parity with
  // ReviewTab's shortcut gating (see review/ReviewTab.tsx).
  useReviewShortcuts(shortcuts, !dialogOpen);

  if (loading) {
    return (
      <div
        className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"
        data-testid="source-ai-detail-loading"
      >
        <Loader2 className="size-4 animate-spin" />
        {t('sourceAi.loadingFindings')}
      </div>
    );
  }

  if (flagged.length === 0 || !current) {
    return (
      <p className="mt-3 text-sm text-muted-foreground" data-testid="source-ai-no-findings">
        {t('sourceAi.noFindings')}
      </p>
    );
  }

  const sorted = [...current.findings].sort(
    (a, b) => FINDING_ORDER[a.type] - FINDING_ORDER[b.type],
  );
  const lqaCount = lqaByEntry[current.entryId] ?? 0;

  return (
    <div className="mt-3 space-y-3" data-testid="source-ai-findings">
      {/* Position + navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="source-ai-finding-position">
            {t('sourceAi.findingPosition', { current: safeIndex + 1, total: flagged.length })}
          </Badge>
          {isApproved && (
            <Badge
              className="bg-status-pass/10 text-status-pass"
              data-testid="source-ai-finding-approved"
            >
              <Check className="mr-1 size-3" aria-hidden />
              {t('sourceAi.approvedBadge')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={safeIndex === 0}
            data-testid="source-ai-finding-prev"
            aria-label={t('sourceAi.findingPrev')}
          >
            <ChevronUp className="size-4" aria-hidden />
            {t('sourceAi.findingPrev')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={safeIndex >= flagged.length - 1}
            data-testid="source-ai-finding-next"
            aria-label={t('sourceAi.findingNext')}
          >
            <ChevronDown className="size-4" aria-hidden />
            {t('sourceAi.findingNext')}
          </Button>
        </div>
      </div>

      {/* Prominent review card mirroring the manual review tab: source text and
          the unified corrected-source suggestion side by side, then the findings,
          context, and the persisted approve/ignore actions, with a keyboard-hint
          footer. */}
      <ReviewCardShell
        hint={t('sourceAi.keyboardHint')}
        hintKeys={['a', 'i']}
        hintTestId="source-ai-keyboard-hint"
        testId={`source-ai-finding-${current.entryId}`}
      >
        {/* Source text, paired with the suggested correction when the run
              produced one (otherwise the source spans the full width). */}
        <div className={`grid gap-6${current.suggestion !== undefined ? ' md:grid-cols-2' : ''}`}>
          <section>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('sourceText')}
            </h3>
            <p
              className="whitespace-pre-wrap break-words text-sm leading-relaxed"
              data-testid="source-ai-source-text"
            >
              {current.sourceText}
            </p>
          </section>

          {current.suggestion !== undefined && (
            <section data-testid="source-ai-suggestion">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('sourceAi.suggestion')}
                  </h3>
                  <DiffLegend />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => void handleCopy(current.suggestion!)}
                  data-testid="source-ai-copy-suggestion"
                  aria-label={t('sourceAi.copySuggestion')}
                >
                  <Copy className="mr-1 size-3.5" aria-hidden />
                  {t('sourceAi.copySuggestion')}
                </Button>
              </div>
              {/* Render the correction as a word-level diff from the source so the
                  reviewer sees exactly what changed; copy still yields the clean
                  suggestion text. */}
              <DiffText
                oldText={current.sourceText}
                newText={current.suggestion}
                testId="source-ai-suggestion-diff"
              />
            </section>
          )}
        </div>

        {/* Findings flagged for this entry. */}
        <section>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('sourceAi.findingsTitle')}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {sorted.map((finding, i) => (
              // Key on the entry id (not just the position) so advancing to the
              // next flagged entry remounts each ExpandableText and resets its
              // per-finding expanded state — without it the positional key reuses
              // the instance and leaks one entry's "expanded" onto the next.
              <li
                key={`${current.entryId}-${finding.type}-${i}`}
                className="flex items-start gap-2"
              >
                <Badge variant="outline" className={FINDING_TINT[finding.type]}>
                  {t(FINDING_TYPE_KEY[finding.type])}
                </Badge>
                {/* Finding detail is no longer capped server-side; render it in
                    full, collapsing a very long explanation behind a show-more
                    toggle. */}
                <ExpandableText
                  text={finding.detail}
                  className="text-muted-foreground"
                  testId={`source-ai-finding-detail-${current.entryId}-${i}`}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* LQA-issue hint for this entry (across all target languages). */}
        {lqaCount > 0 && (
          <p className="text-xs text-status-warn" data-testid="source-ai-lqa-hint">
            {t('sourceAi.lqaHint', { count: lqaCount })}
          </p>
        )}

        {/* Glossary terms occurring in this entry's source text. */}
        {glossaryTerms.length > 0 && (
          <section data-testid="source-ai-glossary">
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('sourceAi.glossaryTitle')}
            </h3>
            <ul className="space-y-1 text-xs">
              {glossaryTerms.map(({ glossaryId, glossaryName, term }) => (
                <li
                  key={`${glossaryId}-${term.id}`}
                  className="flex flex-wrap items-baseline gap-1.5"
                  data-testid="source-ai-glossary-term"
                >
                  <span className="font-medium">{term.source}</span>
                  {term.constant && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      {t('sourceAi.glossaryConstant')}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">· {glossaryName}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Persisted actions: approve (survives reload) / ignore (removes the
            record). Neither edits the source text itself — the reminder below
            keeps that visible. */}
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => void handleApprove()}
              disabled={isApproved || acting}
              data-testid="source-ai-approve"
            >
              <Check className="mr-1 size-4" aria-hidden />
              {t('sourceAi.approve')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleIgnore()}
              disabled={acting}
              data-testid="source-ai-ignore"
            >
              <EyeOff className="mr-1 size-4" aria-hidden />
              {t('sourceAi.ignore')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="source-ai-apply-reminder">
            {t('sourceAi.applyReminder')}
          </p>
        </div>
      </ReviewCardShell>
    </div>
  );
}

/** Index of the first record not yet approved (0 when all are approved/empty). */
function firstUnapprovedIndex(records: SourceReviewRecord[]): number {
  const i = records.findIndex((r) => r.approved !== true);
  return i === -1 ? 0 : i;
}

/**
 * Scrollable dialog listing every finding across all reviewed entries at once —
 * a quick overview alternative to the one-at-a-time navigator.
 */
function AllFindingsDialog({
  open,
  onOpenChange,
  records,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: SourceReviewRecord[];
}>) {
  const { t } = useTranslation('review');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" data-testid="source-ai-all-findings-dialog">
        <DialogHeader>
          <DialogTitle>{t('sourceAi.allFindingsTitle')}</DialogTitle>
          <DialogDescription>
            {t('sourceAi.allFindingsCount', { count: records.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-auto pr-1">
          <RevealList
            items={records}
            renderItem={(record) => {
              const sorted = [...record.findings].sort(
                (a, b) => FINDING_ORDER[a.type] - FINDING_ORDER[b.type],
              );
              return (
                <div
                  key={record.entryId}
                  className="space-y-2 rounded-lg border border-border/60 p-3"
                  data-testid={`source-ai-all-finding-${record.entryId}`}
                >
                  <div className={REVIEW_TEXT_BLOCK}>{record.sourceText}</div>
                  <ul className="space-y-1.5">
                    {sorted.map((finding, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Badge variant="outline" className={FINDING_TINT[finding.type]}>
                          {t(FINDING_TYPE_KEY[finding.type])}
                        </Badge>
                        {/* Full (now-uncapped) finding detail, collapsible when long. */}
                        <ExpandableText
                          text={finding.detail}
                          className="text-muted-foreground"
                          testId={`source-ai-all-finding-detail-${record.entryId}-${i}`}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }}
            showMoreTestId="source-ai-all-findings-show-more"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('sourceAi.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
