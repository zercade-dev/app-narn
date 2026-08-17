/**
 * AI-review configuration dialog. Opened from the Activity tab's "AI review"
 * action, it lets the user pick which module and model judge a completed
 * translation run, defaulting to the module/model that produced the run's
 * translations. Only judge-capable modules (those whose metadata reports
 * `supportsJudge`) are offered.
 *
 * The selection has no seeding effect: the effective module/model are derived
 * from the run each render, with `user*` state overriding once the user picks.
 * The parent remounts this dialog per run (via `key`) so those overrides reset.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { JudgeChecks, RunStatus, RunUsageEntry } from '@zercade-dev/narn-shared';
import { FREEWAY_MODULE_ID } from '@zercade-dev/narn-shared';
import { Sparkles } from 'lucide-react';
import { useModules, useConfiguredModels } from '../../hooks/use-modules.js';
import { isOfferableModule, basesWithInstances, isEnabledModule } from '@/lib/module-options';
import { hasNonDefaultValues } from '../../lib/advanced-modified.js';
import type { ModuleSelectOption } from '../ui/module-select';
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
import { LanguageSelect } from '../ui/language-select';
import { AdvancedToggle } from '../common/AdvancedToggle.js';
import { AiRunOptionsFields } from '../config/AiRunOptionsFields.js';
import { useConfidenceContext } from '../../hooks/use-confidence-context.js';
import {
  asGroupingChoice,
  BatchGroupingControls,
  type GroupingChoice,
} from '../config/BatchGroupingControls.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useDialogSettings } from '../../hooks/use-dialog-settings.js';
import type { BatchGroupingDimension } from '@zercade-dev/narn-shared';

/** The 5 opt-in check keys, in canonical (checkbox) order. `terminology` is a
 * no-op — judge always checks glossary-term consistency — kept for UI parity
 * with Source AI review's identical checkbox row. */
const CHECK_KEYS: readonly (keyof JudgeChecks)[] = [
  'typo',
  'grammar',
  'terminology',
  'clarity',
  'unsafe',
];

/** i18n key per checkbox label, in the `strings` namespace (this dialog's
 * own translation namespace) — distinct from Source AI review's identical
 * wording, which lives in the `review` namespace instead. */
const CHECK_LABEL_KEY: Record<keyof JudgeChecks, string> = {
  typo: 'runs.aiReviewCheckTypo',
  grammar: 'runs.aiReviewCheckGrammar',
  terminology: 'runs.aiReviewCheckTerminology',
  clarity: 'runs.aiReviewCheckClarity',
  unsafe: 'runs.aiReviewCheckUnsafe',
};

/** Last-used per-browser values. Language checkboxes are NOT persisted (they
 * depend on the run being reviewed). moduleId '' means "never chosen". Every
 * check defaults to OFF — the opposite of Source AI review's all-on default. */
const AI_REVIEW_SETTINGS_DEFAULTS = {
  advanced: false,
  moduleId: '',
  model: '',
  reasoningEffort: '',
  verbose: false,
  responseLanguage: 'en',
  grouping: 'default' as string,
  ignoreLimit: false,
  customBatchSize: 20,
  checks: {
    typo: false,
    grammar: false,
    terminology: false,
    clarity: false,
    unsafe: false,
  } as Record<string, boolean>,
};

/** Per-run AI-review configuration the dialog hands back when a review is started. */
export interface AiReviewOverride {
  moduleId: string;
  model?: string;
  reasoningEffort?: string;
  verbose?: boolean;
  responseLanguage?: string;
  languages?: string[];
  batchGrouping?: BatchGroupingDimension;
  ignoreBatchSizeLimit?: boolean;
  customBatchSize?: number;
  checks?: JudgeChecks;
}

export interface AiReviewDialogProps {
  /**
   * The translation run to review, used to seed default module/model. When
   * absent (the "review all translations" action has no single run to seed
   * from), the existing saved-config / cheapest-judge-capable-module fallback
   * chain takes over unchanged.
   */
  run: RunStatus | undefined;
  /**
   * Explicit open state. Defaults to `run !== undefined` (today's behavior)
   * when omitted — only a caller that can be open with no `run` (i.e. "review
   * all translations") needs to pass this.
   */
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (override: AiReviewOverride) => void;
}

/**
 * The usage entry that contributed the most work to a run — the module that
 * most represents "what this run was translated with", used to seed the
 * review's default module/model.
 */
function predominantUsage(run: RunStatus | undefined): RunUsageEntry | undefined {
  const entries = run?.usageByModule;
  if (!entries || entries.length === 0) return undefined;
  const weight = (e: RunUsageEntry) =>
    (e.inputTokens ?? 0) + (e.outputTokens ?? 0) + (e.characters ?? 0);
  return entries.reduce((best, e) => (weight(e) > weight(best) ? e : best));
}

export function AiReviewDialog({
  run,
  open,
  onOpenChange,
  onStart,
}: Readonly<AiReviewDialogProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  // Only for the synthetic Freeway option's label below (`config:routing.freewayLabel`,
  // reused from the routing picker rather than duplicating the string here).
  const { t: tConfig } = useTranslation('config');
  const { read: readSettings, save: saveSettings } = useDialogSettings(
    'ai-review',
    AI_REVIEW_SETTINGS_DEFAULTS,
  );
  const judgeConfig = useProjectStore((s) => s.getActiveProject()?.judgeConfig);
  const activeProject = useProjectStore((s) => s.getActiveProject());
  // Every active language except the source is a reviewable target language,
  // mirroring the server's own reconstructScope() language derivation.
  const targetLanguages = (activeProject?.activeLanguages ?? []).filter(
    (lang) => lang !== activeProject?.sourceLanguage,
  );
  const modules = useModules();
  // Everything below the module/model/effort picker is tuning, not the choice
  // that defines the run — hidden behind this until ticked. Only its own
  // visibility is gated; the values it wraps are never reset by hiding it (see
  // the run-open reset block below).
  const [advanced, setAdvanced] = useState(false);
  // Mirrors `advanced`, EXCEPT the noLanguagesChecked force-open below never
  // touches it — only the open-transition seed and the user's own checkbox
  // click do. `handleStart` persists THIS, not `advanced`: a transient
  // validation state (Start disabled by an empty language list) forcing the
  // section open must not permanently overwrite the user's remembered
  // Advanced default the next time they Start a review. A ref would be
  // simpler, but react-hooks/refs forbids writing one during render, and the
  // open-transition seed below runs during render (the same "prev prop"
  // pattern `advanced` itself uses) — so this has to be state too.
  const [userAdvanced, setUserAdvanced] = useState(false);
  // `null` means "the user hasn't chosen"; the effective values fall back to the
  // run-derived defaults below. Reset per run via the parent's `key`.
  const [userModuleId, setUserModuleId] = useState<string | null>(null);
  const [userModel, setUserModel] = useState<string | null>(null);
  // Per-run reasoning-effort override. `null` = the user hasn't chosen, so the
  // saved judge config's effort is the default; `''` means "model default" (none
  // sent). Derived (not state-seeded) so the saved effort applies even if the
  // project loads after first render. Reset to `null` on module change and per
  // run via the parent's `key`.
  const [userReasoningEffort, setUserReasoningEffort] = useState<string | null>(null);
  // Debug aid: when on, the judge module logs the full prompt/params and raw
  // response for each batch. Off by default; reset per run via the parent's `key`.
  const [verbose, setVerbose] = useState(false);
  // Language the AI writes its findings/explanations in. Defaults to English;
  // affects only the natural-language output, never the scoring. Reset per run
  // via the parent's `key`.
  const [responseLanguage, setResponseLanguage] = useState('en');
  // Languages unchecked by the user in the language checklist; empty = every
  // language stays checked (today's implicit "review everything" behavior).
  // Reset per run via the parent's `key`.
  const [uncheckedLanguages, setUncheckedLanguages] = useState<Set<string>>(new Set());
  const toggleLanguage = (lang: string, checked: boolean) => {
    setUncheckedLanguages((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(lang);
      else next.add(lang);
      return next;
    });
  };
  // Opt-in quality checks (typo/grammar/terminology[no-op]/clarity/unsafe).
  // All default to false; persisted per-browser like verbose/responseLanguage.
  const [checks, setChecks] = useState<Record<string, boolean>>(AI_REVIEW_SETTINGS_DEFAULTS.checks);
  const anyCheckEnabled = CHECK_KEYS.some((c) => checks[c]);
  // Per-run related-entry grouping override; 'default' = project/workspace.
  const [grouping, setGrouping] = useState<GroupingChoice>('default');
  const [ignoreLimit, setIgnoreLimit] = useState(false);
  const [customBatchSize, setCustomBatchSize] = useState(20);
  // Per-module globally-configured model, used to seed the model field when the
  // user switches modules (falling back to the cheapest when that module has no
  // configured model, or the configured one isn't among the discovered models).
  const configuredModels = useConfiguredModels();

  // Named instances, non-instanceable modules, and instanceable bases without
  // instances are offered — a base is excluded only once it has instances (then
  // it's managed through them), mirroring the global config module list.
  const realJudgeModules = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules.filter(
      (m) => m.supportsJudge && isOfferableModule(m, withInstances) && isEnabledModule(m),
    );
  }, [modules]);
  // The judge picker also offers a synthetic NARN Freeway target (M25
  // JudgeEngine already accepts moduleId 'freeway', resolving via the free pool
  // at background priority) — appended here at THIS composition site only,
  // mirroring AppShell's RoutingTabContent `routingModules` pattern, and run
  // through the SAME isOfferableModule/isEnabledModule predicates real modules
  // use (both accept it: `instanceable: false`, `enabled: true`), rather than
  // being force-included. Only added once `realJudgeModules` is non-empty —
  // that both keeps Freeway from ever being the *sole* offered option (the
  // "no judge modules" empty state below stays exactly as it was: real API
  // modules only) and avoids a mount-time race where the synthetic entry
  // would otherwise appear on the very first render, before the async
  // `/modules` fetch has resolved.
  const judgeModules = useMemo<ModuleSelectOption[]>(() => {
    if (realJudgeModules.length === 0) return realJudgeModules;
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
  }, [modules, realJudgeModules, tConfig]);

  // Apply last-used settings when the dialog opens for a run. Stored module/
  // model/effort are applied only while that module is still an offerable
  // judge module — otherwise the saved-config/run-module default chain below
  // stays in charge. (Render-time "prev prop" pattern, as in TranslateRunDialog.)
  const [prevRunId, setPrevRunId] = useState<string | undefined>(undefined);
  // Stashes a stored module/model/effort triple from the open transition below
  // until `realJudgeModules` (async, [] on mount) has actually loaded — see
  // the adjustment block right after this one.
  const [pendingStored, setPendingStored] = useState<{
    moduleId: string;
    model: string;
    reasoningEffort: string;
  } | null>(null);
  if (run?.runId !== prevRunId) {
    setPrevRunId(run?.runId);
    if (run) {
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
      setAdvanced(stored.advanced);
      setUserAdvanced(stored.advanced);
      setVerbose(stored.verbose);
      setResponseLanguage(stored.responseLanguage || 'en');
      setGrouping(asGroupingChoice(stored.grouping));
      setIgnoreLimit(stored.ignoreLimit);
      setCustomBatchSize(stored.customBatchSize);
      setChecks(stored.checks ?? AI_REVIEW_SETTINGS_DEFAULTS.checks);
    }
  }

  // Apply the stashed stored module choice once the async module list has
  // loaded (realJudgeModules is [] on the mount-time open transition above —
  // the dialog remounts per run, so that block always runs before modules
  // arrive; gated on realJudgeModules rather than judgeModules since the
  // latter always contains at least the synthetic Freeway entry, which would
  // never let this wait for the real fetch). Applied at most once per open; an
  // unknown/no-longer-eligible stored module is dropped so the default chain
  // below stays in charge.
  if (pendingStored && realJudgeModules.length > 0) {
    setPendingStored(null);
    if (judgeModules.some((m) => m.id === pendingStored.moduleId)) {
      setUserModuleId(pendingStored.moduleId);
      setUserModel(pendingStored.model);
      setUserReasoningEffort(pendingStored.reasoningEffort || null);
    }
  }

  // Default chain (most → least preferred): the project's saved judge config
  // (only while its module is still judge-capable), then the run's own module
  // when it can judge, then the first judge-capable module. `user*` overrides
  // win once the user picks.
  const used = predominantUsage(run);
  const usedIsJudgeCapable = used !== undefined && judgeModules.some((m) => m.id === used.moduleId);
  const savedIsJudgeCapable =
    judgeConfig?.moduleId !== undefined && judgeModules.some((m) => m.id === judgeConfig.moduleId);
  const defaultModuleId = savedIsJudgeCapable
    ? judgeConfig.moduleId!
    : usedIsJudgeCapable
      ? used.moduleId
      : (judgeModules[0]?.id ?? '');
  const moduleId = userModuleId ?? defaultModuleId;
  // Seed the model from the saved config (when its module is the default), else
  // from the run's own (judge-capable) module.
  const defaultModel =
    userModuleId === null
      ? savedIsJudgeCapable
        ? (judgeConfig.model ?? '')
        : usedIsJudgeCapable
          ? (used.model ?? '')
          : ''
      : '';
  const model = userModel ?? defaultModel;
  // Seed the effort from the saved config while still on the saved (judge-capable)
  // module; a user pick (including clearing to `''`) always wins.
  const defaultReasoningEffort =
    userModuleId === null && savedIsJudgeCapable ? (judgeConfig.reasoningEffort ?? '') : '';
  const reasoningEffort = userReasoningEffort ?? defaultReasoningEffort;
  const confidenceContext = useConfidenceContext('judge', reasoningEffort);

  const handleModuleChange = (next: string | null) => {
    setUserModuleId(next ?? '');
    // Clear the chosen model so the remounted ModuleModelSelector auto-picks the
    // new module's configured model (or its cheapest when none is configured).
    setUserModel('');
    // The new module's models carry their own efforts; drop any stale override so
    // it falls back to the new module's default.
    setUserReasoningEffort(null);
  };

  const checkedLanguages = targetLanguages.filter((l) => !uncheckedLanguages.has(l));
  // Unchecking every language leaves nothing to review — the server rejects an
  // empty `languages` array, so keep Start disabled instead of sending one.
  const noLanguagesChecked = targetLanguages.length > 0 && checkedLanguages.length === 0;

  // Invariant: Start is never disabled without a visible cause. `noLanguagesChecked`
  // is the only cause that lives behind Advanced (the language checklist and its
  // "Deselect all" button) — if it's blocking Start while Advanced is collapsed,
  // force it back open so the cause is on screen again. Fires at most once per
  // cause: setting `advanced` true makes the `!advanced` guard false on the next
  // render, so it never fights a deliberate collapse the user makes once the
  // checklist is fine again.
  if (!advanced && noLanguagesChecked && moduleId) {
    setAdvanced(true);
  }

  const handleStart = () => {
    if (!moduleId || noLanguagesChecked) return;
    saveSettings({
      advanced: userAdvanced,
      moduleId,
      model,
      reasoningEffort,
      verbose,
      responseLanguage,
      grouping,
      ignoreLimit,
      customBatchSize,
      checks,
    });
    onStart({
      moduleId,
      ...(model ? { model } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(verbose ? { verbose: true } : {}),
      // English is the default; only send a non-default code so back-compat
      // (omitted = English) holds end-to-end.
      ...(responseLanguage && responseLanguage !== 'en' ? { responseLanguage } : {}),
      // Every language still checked ⇒ no restriction, matches today's
      // implicit "review everything" behavior; omit the field entirely.
      ...(uncheckedLanguages.size > 0 ? { languages: checkedLanguages } : {}),
      // 'default' = inherit project/workspace; omit the per-run override.
      ...(grouping === 'custom'
        ? { customBatchSize }
        : grouping !== 'default'
          ? { batchGrouping: grouping, ignoreBatchSizeLimit: ignoreLimit }
          : {}),
      // No box checked (today's default) ⇒ omit entirely, matching every
      // other optional-override field's convention.
      ...(anyCheckEnabled ? { checks } : {}),
    });
    onOpenChange(false);
  };

  // moduleId/model/reasoningEffort are excluded: their controls (AiRunOptionsFields,
  // rendered above) are unconditionally visible, not inside {advanced && (…)} below.
  // ignoreLimit/customBatchSize are gated on `grouping`, mirroring the exact
  // condition BatchGroupingControls uses to show/hide each control — a grouping
  // value that hides one must not make it count toward the badge.
  // `checks` is compared key-by-key rather than via hasNonDefaultValues'
  // JSON.stringify (sensitive to insertion order), since a persisted checks
  // object's key order isn't guaranteed to match CHECK_KEYS'.
  const checksModified = CHECK_KEYS.some(
    (key) => checks[key] !== AI_REVIEW_SETTINGS_DEFAULTS.checks[key],
  );
  const advancedModified =
    checksModified ||
    hasNonDefaultValues(
      {
        verbose,
        responseLanguage,
        grouping,
        ...(grouping === 'custom' ? { customBatchSize } : {}),
        ...(grouping !== 'default' && grouping !== 'custom' ? { ignoreLimit } : {}),
      },
      AI_REVIEW_SETTINGS_DEFAULTS,
    );

  const noJudgeModules = modules.length > 0 && realJudgeModules.length === 0;

  return (
    <Dialog open={open ?? run !== undefined} onOpenChange={onOpenChange}>
      <DialogContent data-testid="ai-review-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {t('runs.aiReviewConfigTitle')}
          </DialogTitle>
          <DialogDescription>{t('runs.aiReviewConfigDescription')}</DialogDescription>
        </DialogHeader>

        {noJudgeModules ? (
          <p className="text-sm text-muted-foreground" data-testid="ai-review-no-modules">
            {t('runs.aiReviewNoModules')}
          </p>
        ) : (
          <div className="space-y-4">
            <AiRunOptionsFields
              idPrefix="ai-review"
              modules={judgeModules}
              moduleId={moduleId}
              model={model}
              reasoningEffort={reasoningEffort}
              onModuleChange={handleModuleChange}
              onModelChange={setUserModel}
              onReasoningEffortChange={setUserReasoningEffort}
              configuredModels={configuredModels}
              moduleLabel={t('runs.aiReviewModule')}
              modelLabel={t('runs.aiReviewModel')}
              reasoningEffortLabel={t('runs.aiReviewReasoningEffort')}
              modulePlaceholder={t('runs.aiReviewModulePlaceholder')}
              confidenceContext={confidenceContext}
              hideModelFields={moduleId === FREEWAY_MODULE_ID}
            />

            {/* Freeway picks its own model per batch — no model/effort route
                (`/api/modules/freeway/models`) exists for the suppressed
                selectors to call, so a one-line explanation replaces them. */}
            {moduleId === FREEWAY_MODULE_ID && (
              <p
                className="text-xs text-muted-foreground"
                data-testid="ai-review-freeway-model-hint"
              >
                {t('runs.aiReviewFreewayModelHint')}
              </p>
            )}

            <div className="border-t pt-3">
              <AdvancedToggle
                id="ai-review-advanced"
                testId="ai-review-advanced"
                checked={advanced}
                modified={advancedModified}
                onCheckedChange={(next) => {
                  setAdvanced(next);
                  setUserAdvanced(next);
                }}
                label={t('runs.aiReviewAdvancedOptions')}
              />
            </div>

            {advanced && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-review-response-language">
                    {t('runs.aiReviewResponseLanguage')}
                  </Label>
                  <LanguageSelect
                    id="ai-review-response-language"
                    triggerTestId="ai-review-response-language-trigger"
                    value={responseLanguage}
                    onValueChange={setResponseLanguage}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{t('runs.aiReviewLanguages')}</Label>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      data-testid="ai-review-languages-toggle-all"
                      onClick={() =>
                        setUncheckedLanguages(
                          uncheckedLanguages.size > 0 ? new Set() : new Set(targetLanguages),
                        )
                      }
                    >
                      {uncheckedLanguages.size > 0
                        ? t('runs.aiReviewLanguagesSelectAll')
                        : t('runs.aiReviewLanguagesDeselectAll')}
                    </Button>
                  </div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-x-3 gap-y-1.5">
                    {targetLanguages.map((lang) => (
                      <span key={lang} className="inline-flex items-center gap-1.5">
                        <Checkbox
                          id={`ai-review-language-${lang}`}
                          checked={!uncheckedLanguages.has(lang)}
                          onCheckedChange={(checked) => toggleLanguage(lang, checked === true)}
                          data-testid={`ai-review-language-${lang}`}
                        />
                        <Label
                          htmlFor={`ai-review-language-${lang}`}
                          className="cursor-pointer select-none font-normal"
                        >
                          {lang}
                        </Label>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('runs.aiReviewChecksLabel')}</Label>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {CHECK_KEYS.map((check) => (
                      <label
                        key={check}
                        className="inline-flex cursor-pointer select-none items-center gap-1.5 text-sm"
                      >
                        <Checkbox
                          checked={checks[check]}
                          onCheckedChange={(checked) =>
                            setChecks((prev) => ({ ...prev, [check]: checked === true }))
                          }
                          data-testid={`ai-review-check-${check}`}
                        />
                        {t(CHECK_LABEL_KEY[check])}
                      </label>
                    ))}
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5">
                  <Checkbox
                    id="ai-review-verbose"
                    checked={verbose}
                    onCheckedChange={(checked) => setVerbose(checked === true)}
                    data-testid="ai-review-verbose"
                  />
                  <Label
                    htmlFor="ai-review-verbose"
                    className="cursor-pointer select-none font-normal"
                  >
                    {t('runs.aiReviewVerbose')}
                  </Label>
                </span>

                <BatchGroupingControls
                  idPrefix="ai-review-grouping"
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
        )}

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('runs.aiReviewCancel')}
          </Button>
          <Button
            onClick={handleStart}
            disabled={!moduleId || noLanguagesChecked}
            data-testid="ai-review-start"
          >
            <Sparkles className="size-4 mr-1" />
            {t('runs.aiReviewStart')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
