import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRunStore } from '../../stores/run-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { availableTabs, firstAvailableTab } from '../../lib/tab-gating.js';
import { useNicknameLabels } from '../../hooks/use-nickname-labels.js';
import { ManualEditsView } from './ManualEditsView.js';
import {
  RunStatusCode,
  runTypeLabel,
  PSEUDO_MODULE_ID,
  FREEWAY_MODULE_ID,
  type RunStatus,
  type RunUsageEntry,
  type RunDetails,
} from '@zercade-dev/narn-shared';
import {
  typeTint,
  scoreTint,
  rowAccentClass,
  formatUsd,
  usageEntryFigures,
  usageEntryKey,
  usageEntryLabel,
  sumUsage,
  chatRunData,
  chatTypeKey,
} from './run-status-ui.js';
import { RunStatusBadge } from './RunStatusBadge.js';
import { RunProgressBar } from '../ui/run-progress-bar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ModuleSelect } from '../ui/module-select';
import { useModules } from '../../hooks/use-modules.js';
import { isOfferableModule, basesWithInstances, isEnabledModule } from '@/lib/module-options';
import {
  Loader2,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  Pause,
  Play,
  ArrowUp,
  ArrowDown,
  Hourglass,
  Sparkles,
  RotateCcw,
  Info,
  MessageSquare,
} from 'lucide-react';
import { isTranslationRun, hasRunDetails, RUN_TYPE_KEY, isChatRun } from '@/lib/run-kind';
import { cn, relativeTime } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { AiReviewDialog, type AiReviewOverride } from './AiReviewDialog.js';
import { useRelativeTimeTick } from '../config/ModelRefreshControl.js';

interface RunsTabProps {
  projectId: string;
}

function tokenTotal(entries: RunUsageEntry[] | undefined): number {
  return sumUsage(entries, 'inputTokens') + sumUsage(entries, 'outputTokens');
}

function characterTotal(entries: RunUsageEntry[] | undefined): number {
  return sumUsage(entries, 'characters');
}

/**
 * Cumulative estimated cost across a set of runs that have known pricing.
 * Stays `undefined` (no "$0") when none of the runs has a priced usage
 * entry — shared by the overall project total and the per-triggerer
 * "you"/"collaborators" buckets below so the reduce logic isn't duplicated.
 */
function sumEstimatedCost(rs: readonly RunStatus[]): number | undefined {
  return rs.reduce<number | undefined>(
    (sum, r) => (r.estimatedCostUsd !== undefined ? (sum ?? 0) + r.estimatedCostUsd : sum),
    undefined,
  );
}

/** One per-(module, model) usage figures line, shared by the cost cell and details. */
function UsageEntryLine({
  entry,
  className,
}: Readonly<{ entry: RunUsageEntry; className: string }>) {
  const { t } = useTranslation('strings');
  return (
    <div className={className}>
      {usageEntryLabel(entry)}: {usageEntryFigures(entry, t)}
    </div>
  );
}

function RunCostCell({ run }: Readonly<{ run: RunStatus }>) {
  const { t } = useTranslation('strings');
  // Chat runs fold their per-turn tokens/cost into the SAME usageByModule/
  // estimatedCostUsd fields as every other run kind, so the standard cost
  // cell needs no chat-specific branch.
  const usage = run.usageByModule ?? [];
  const estimatedCostUsd = run.estimatedCostUsd;

  const tokens = tokenTotal(usage);
  const characters = characterTotal(usage);

  let summary: React.ReactNode;
  if (estimatedCostUsd !== undefined) {
    summary = (
      <span className="font-medium">
        {t('runs.estimatedCost', { amount: formatUsd(estimatedCostUsd) })}{' '}
        <span className="text-[10px] text-muted-foreground">({t('runs.estimateSuffix')})</span>
      </span>
    );
  } else if (tokens > 0) {
    // Pricing lookup missed: degrade to tokens-only, never display $0.
    summary = (
      <span className="text-muted-foreground">
        {t('runs.tokensOnly', { count: tokens.toLocaleString() })}
      </span>
    );
  } else if (characters > 0) {
    summary = (
      <span className="text-muted-foreground">
        {t('runs.charactersOnly', { count: characters.toLocaleString() })}
      </span>
    );
  } else {
    summary = <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-0.5 text-xs" data-testid={`run-cost-${run.runId}`}>
      <div>{summary}</div>
      {usage.map((entry) => (
        <UsageEntryLine
          key={usageEntryKey(entry)}
          entry={entry}
          className="text-[10px] text-muted-foreground font-mono"
        />
      ))}
    </div>
  );
}

/** A character or token total rendered as a labeled stat card. */
function StatCard({ id, label, value }: Readonly<{ id: string; label: string; value: number }>) {
  return (
    <div
      className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-2"
      data-testid={`run-details-stat-${id}`}
    >
      {/* Static text label (not a form field, so the shared Label primitive's <label>
          semantics don't fit) — data-slot="label" opts it into the same theme-font gate
          [data-slot='label'] already targets. */}
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground" data-slot="label">
        {label}
      </div>
      <div className="font-mono text-sm font-medium">{value.toLocaleString()}</div>
    </div>
  );
}

/**
 * Per-run detail behind the "Show details" affordance: token usage (from the
 * run), the four character totals, the translated entries (source text + target
 * languages), and the per-entry retry counts. The character/entry/retry data
 * comes from the run's detail sidecar; token usage comes from the run itself, so
 * it shows even for older runs recorded before the sidecar existed. Applies to
 * both batch and single runs.
 */
function RunDetailsContent({
  details,
  usage,
  loading,
}: Readonly<{
  details: RunDetails | null | undefined;
  usage: RunUsageEntry[] | undefined;
  loading: boolean;
}>) {
  const { t } = useTranslation('strings');

  // Collapse the flat (entry, language) list into one row per source string
  // with the set of target languages it was translated into.
  const groupedEntries = (() => {
    const map = new Map<string, { sourceText: string; languages: string[] }>();
    for (const e of details?.entries ?? []) {
      const group = map.get(e.entryId);
      if (group) group.languages.push(e.targetLanguage);
      else map.set(e.entryId, { sourceText: e.sourceText, languages: [e.targetLanguage] });
    }
    return [...map.values()];
  })();

  // Distinct target languages across the whole run — surfaced prominently so
  // the run's targets are obvious without scanning the per-entry rows.
  const allTargets = (() => {
    const set = new Set<string>();
    for (const e of details?.entries ?? []) set.add(e.targetLanguage);
    return [...set];
  })();

  // Token/character totals summed across every (module, model) of the run.
  const inTok = sumUsage(usage, 'inputTokens');
  const outTok = sumUsage(usage, 'outputTokens');
  const reasonTok = sumUsage(usage, 'reasoningTokens');
  const cachedTok = sumUsage(usage, 'cachedInputTokens');
  const cacheWriteTok = sumUsage(usage, 'cacheWriteTokens');
  const billedChars = sumUsage(usage, 'characters');
  const tokenStats: Array<{ id: string; label: string; value: number }> = [];
  if (inTok || outTok) {
    tokenStats.push({ id: 'tok-input', label: t('runs.detailsTokInput'), value: inTok });
    tokenStats.push({ id: 'tok-output', label: t('runs.detailsTokOutput'), value: outTok });
  }
  if (reasonTok) {
    tokenStats.push({
      id: 'tok-reasoning',
      label: t('runs.detailsTokReasoning'),
      value: reasonTok,
    });
  }
  if (cachedTok) {
    tokenStats.push({ id: 'tok-cached', label: t('runs.detailsTokCached'), value: cachedTok });
  }
  if (cacheWriteTok) {
    tokenStats.push({
      id: 'tok-cache-write',
      label: t('runs.detailsTokCacheWrite'),
      value: cacheWriteTok,
    });
  }
  if (billedChars) {
    tokenStats.push({ id: 'tok-chars', label: t('runs.detailsTokCharacters'), value: billedChars });
  }

  const hasUsage = (usage?.length ?? 0) > 0 && tokenStats.length > 0;
  const hasSidecar =
    !!details &&
    (groupedEntries.length > 0 ||
      (details.retries?.length ?? 0) > 0 ||
      (details.freeway?.length ?? 0) > 0);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {t('runs.detailsLoading')}
      </div>
    );
  }
  if (!hasSidecar && !hasUsage) {
    return (
      <div className="py-3 text-xs text-muted-foreground" data-testid="run-details-empty">
        {t('runs.detailsEmpty')}
      </div>
    );
  }

  const charStats = details
    ? [
        { key: 'inputTotal', label: t('runs.charInputTotal'), value: details.chars.inputTotal },
        { key: 'inputSource', label: t('runs.charInputSource'), value: details.chars.inputSource },
        { key: 'outputTotal', label: t('runs.charOutputTotal'), value: details.chars.outputTotal },
        { key: 'outputUsed', label: t('runs.charOutputUsed'), value: details.chars.outputUsed },
      ]
    : [];

  return (
    <div className="space-y-4" data-testid="run-details">
      {allTargets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="run-details-targets">
          <span
            className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            data-slot="label"
          >
            {t('runs.detailsLanguagesColumn')}
          </span>
          {allTargets.map((lang) => (
            <Badge key={lang} variant="secondary" className="font-mono text-[10px]">
              {lang}
            </Badge>
          ))}
        </div>
      )}

      {hasUsage && (
        <div className="space-y-1.5" data-testid="run-details-tokens">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('runs.detailsTokensHeading')}
          </h4>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {tokenStats.map((stat) => (
              <StatCard key={stat.id} id={stat.id} label={stat.label} value={stat.value} />
            ))}
          </div>
          {(usage ?? []).map((entry) => (
            <UsageEntryLine
              key={usageEntryKey(entry)}
              entry={entry}
              className="font-mono text-[10px] text-muted-foreground"
            />
          ))}
        </div>
      )}

      {charStats.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {charStats.map((stat) => (
            <StatCard
              key={stat.key}
              id={`char-${stat.key}`}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>
      )}

      {details && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('runs.detailsEntriesHeading', { count: groupedEntries.length })}
          </h4>
          {groupedEntries.length > 0 ? (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('runs.detailsSourceColumn')}</TableHead>
                  <TableHead className="w-[35%]">{t('runs.detailsLanguagesColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedEntries.map((group, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-pre-wrap break-words font-mono text-[11px]">
                      {group.sourceText}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {group.languages.map((lang) => (
                          <Badge key={lang} variant="outline" className="font-mono text-[10px]">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-xs text-muted-foreground">{t('runs.detailsNoEntries')}</p>
          )}
        </div>
      )}

      {details && details.freeway && details.freeway.length > 0 && (
        <div className="space-y-1.5" data-testid="run-details-freeway">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('runs.detailsFreewayHeading')}
          </h4>
          <ul className="space-y-0.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
            {details.freeway.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {details && details.retries && details.retries.length > 0 && (
        <div className="space-y-1.5" data-testid="run-details-retries">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('runs.detailsRetriesHeading', { count: details.retries.length })}
          </h4>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>{t('runs.detailsSourceColumn')}</TableHead>
                <TableHead className="w-[25%]">{t('runs.detailsLanguagesColumn')}</TableHead>
                <TableHead className="w-[15%] text-right">{t('runs.detailsRetryCount')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.retries.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-pre-wrap break-words font-mono text-[11px]">
                    {r.sourceText}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {r.targetLanguage}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p
        className="text-[10px] leading-relaxed text-muted-foreground"
        data-testid="run-details-char-note"
      >
        {t('runs.detailsCharNote')}
      </p>
    </div>
  );
}

export function RunsTab({ projectId }: Readonly<RunsTabProps>) {
  const { t } = useTranslation('strings');
  // Stable sentinel Date for useRelativeTimeTick below — its identity never
  // changes across renders, only whether it's passed (vs. null) does. `useState`
  // (not `useRef`) because reading `.current` during render is disallowed.
  const [tickAnchor] = useState(() => new Date());
  const {
    runs,
    cancelRun,
    judgeRun,
    retryRun,
    retryJudgeRun,
    revertRun,
    fetchRunDetails,
    pauseRun,
    resumeRun,
    resumeRunWith,
    reorderQueue,
    startPolling,
  } = useRunStore();
  const openReview = useViewStore((s) => s.openReview);
  const openSuggestions = useViewStore((s) => s.openSuggestions);
  const setActiveTab = useViewStore((s) => s.setActiveTab);

  // "Triggered by" column: only an owner whose project has ever been shared
  // needs to see who started each run — a collaborator only ever sees their
  // own runs, and an owner who has never shared has nobody else to
  // attribute.
  const access = useProjectStore((s) => accessFor(s, projectId));
  const selfUserId = useProjectStore((s) => s.selfUserId);
  const showTriggeredBy = access.role === 'owner' && access.sharedEver;
  const cloudManaged = useVaultStore((s) => s.cloudManaged ?? false);

  // The Activity tab's "AI engines / Manual" sub-switch. Visible only when the
  // owner has turned auditing on AND the project has ever been shared (an
  // owner who never shared has no manual edits from anyone but themselves to
  // audit) — or the caller IS a collaborator (who always sees their own live
  // edits, regardless of sharedEver, which is an owner-only signal). Defaults
  // to 'engines' so an audit-invisible project (or one that becomes invisible,
  // e.g. a project switch) never gets stuck showing the Manual view.
  const manualEditAuditEnabled = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.manualEditAuditEnabled ?? false,
  );
  const auditVisible =
    manualEditAuditEnabled && (access.sharedEver || access.role === 'collaborator');
  const [activityView, setActivityView] = useState<'engines' | 'manual'>('engines');
  const showManualView = auditVisible && activityView === 'manual';

  // Deep-link tab gating: route the suggestions-reopen click through the
  // same availableTabs rule as URL deep links, so a stale/shared link never
  // lands a collaborator on a tab their access can't reach (e.g. a
  // category-gen run, whose 'category' tab is owner-only) — falls back to
  // firstAvailableTab (a plain tab switch, not a suggestions-reopen — there is
  // no run to show suggestions for on a tab this access can't reach) instead
  // of a gated/blank panel for one frame.
  const openSuggestionsGated = useCallback(
    (tab: 'category' | 'glossary', runId: string) => {
      const allowed = availableTabs(access, cloudManaged);
      if (allowed.includes(tab)) openSuggestions(tab, runId);
      else setActiveTab(firstAvailableTab(access, cloudManaged));
    },
    [access, cloudManaged, openSuggestions, setActiveTab],
  );

  // Display nickname per run.createdBy, extracted into `useNicknameLabels`
  // so `ManualEditsView`'s "Edited by" column can share the same
  // bulk-resolve + backoff + you/—/@nickname/former-member logic.
  const runCreatorIds = runs.map((r) => r.createdBy);
  const { labelFor: nicknameLabelFor } = useNicknameLabels(
    runCreatorIds,
    showTriggeredBy,
    selfUserId,
  );
  const triggeredByLabel = useCallback(
    (run: RunStatus): string => nicknameLabelFor(run.createdBy),
    [nicknameLabelFor],
  );

  // The run whose AI-review (module/model) config dialog is open, if any.
  const [reviewRunId, setReviewRunId] = useState<string | null>(null);

  // The parked run whose "Resume now with…" module-picker dialog is open, if
  // any, plus the module chosen in it. Modules are fetched only while the
  // dialog is open (the `enabled` gate on useModules), like other dialogs in
  // this file. Freeway must never be offered here — it's the thing the user
  // is escaping — and pseudo is never a real translate destination.
  const [resumeWithRunId, setResumeWithRunId] = useState<string | null>(null);
  const [resumeWithModuleId, setResumeWithModuleId] = useState('');
  const resumeWithModules = useModules({ enabled: resumeWithRunId !== null });
  const resumeWithBaseInstances = basesWithInstances(resumeWithModules);
  const resumeWithOptions = resumeWithModules.filter(
    (m) =>
      m.capabilities?.includes('translate') &&
      m.id !== PSEUDO_MODULE_ID &&
      m.id !== FREEWAY_MODULE_ID &&
      isOfferableModule(m, resumeWithBaseInstances) &&
      isEnabledModule(m),
  );

  const closeResumeWithDialog = useCallback(() => {
    setResumeWithRunId(null);
    setResumeWithModuleId('');
  }, []);

  const submitResumeWith = useCallback(() => {
    if (!resumeWithRunId || !resumeWithModuleId) return;
    resumeRunWith(projectId, resumeWithRunId, resumeWithModuleId).then(
      () => {
        toast.success(t('runs.resumeWithStarted'));
        closeResumeWithDialog();
      },
      (err: unknown) => toast.error((err as Error).message),
    );
  }, [closeResumeWithDialog, projectId, resumeRunWith, resumeWithModuleId, resumeWithRunId, t]);

  // Per-run detail (translated entries, retries, character totals): lazily
  // fetched on first open of the run's details dialog, then cached.
  const [detailsRunId, setDetailsRunId] = useState<string | null>(null);
  const [detailsByRun, setDetailsByRun] = useState<Record<string, RunDetails | null>>({});
  const [loadingDetailsRunId, setLoadingDetailsRunId] = useState<string | null>(null);

  const openRunDetails = useCallback(
    (runId: string) => {
      setDetailsRunId(runId);
      if (runId in detailsByRun) return;
      setLoadingDetailsRunId(runId);
      fetchRunDetails(projectId, runId)
        .then((details) => setDetailsByRun((prev) => ({ ...prev, [runId]: details })))
        .catch(() => setDetailsByRun((prev) => ({ ...prev, [runId]: null })))
        .finally(() => setLoadingDetailsRunId((cur) => (cur === runId ? null : cur)));
    },
    [detailsByRun, fetchRunDetails, projectId],
  );

  const detailsRun = detailsRunId !== null ? runs.find((r) => r.runId === detailsRunId) : undefined;

  const reviewRun = reviewRunId !== null ? runs.find((r) => r.runId === reviewRunId) : undefined;

  const startReview = useCallback(
    (override: AiReviewOverride) => {
      if (reviewRunId === null) return;
      judgeRun(projectId, reviewRunId, override).catch((err: unknown) => {
        toast.error((err as Error).message);
      });
    },
    [judgeRun, projectId, reviewRunId],
  );

  useEffect(() => {
    if (projectId) {
      startPolling(projectId);
    }
    // No unmount cleanup here on purpose: a run started from any tab kicks
    // off the store's self-rescheduling poll loop, which is not tied to any
    // component's lifecycle — `fetchRuns` already self-terminates the loop
    // once no run is active (run-store.ts). Calling stopPolling() here would
    // kill that loop out from under a still-running run just because the user
    // glanced at Activity and navigated away, silently defeating both the
    // run-failure toast and Activity's own live status for the rest of that run.
  }, [projectId, startPolling]);

  const activeRuns = runs.filter(
    (r) => r.status === RunStatusCode.Pending || r.status === RunStatusCode.Running,
  );

  const sortedRuns = [...runs].sort((a, b) => b.startedAt - a.startedAt);

  // Keeps the "Started" column's relative-time labels ("5m ago") fresh
  // without re-fetching; ticks only while there's at least one row to
  // relabel. `tickAnchorRef` is a stable non-null sentinel (its identity
  // never changes) so the interval isn't torn down/recreated every render.
  useRelativeTimeTick(sortedRuns.length > 0 ? tickAnchor : null);

  // The newest completed revertible run (translation or relink) — mirrors the
  // server's conservative revert guard (block revert when a newer completed
  // revertible run exists) so the button is disabled instead of erroring.
  const newestCompletedRevertibleRunId = sortedRuns.find(
    (r) => hasRunDetails(r) && r.status === RunStatusCode.Completed,
  )?.runId;

  // Pending queue, in start order (lowest queuePosition first).
  const queuedRuns = runs
    .filter((r) => r.status === RunStatusCode.Queued)
    .sort(
      (a, b) =>
        (a.queuePosition ?? Number.MAX_SAFE_INTEGER) -
          (b.queuePosition ?? Number.MAX_SAFE_INTEGER) || a.startedAt - b.startedAt,
    );
  const queuedIds = queuedRuns.map((r) => r.runId);

  const moveQueued = (runId: string, direction: -1 | 1) => {
    const index = queuedIds.indexOf(runId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= queuedIds.length) return;
    const next = [...queuedIds];
    [next[index], next[target]] = [next[target], next[index]];
    reorderQueue(projectId, next).catch((err: unknown) => toast.error((err as Error).message));
  };

  // Cumulative estimated cost across all runs that have known pricing.
  // Stays undefined (no "$0") when no run has a priced usage entry.
  const projectCostUsd = sumEstimatedCost(runs);

  // Owner of a shared project splits that total into "you" (self-triggered,
  // plus legacy pre-attribution runs which have no createdBy and therefore
  // belong to the owner) vs "collaborators" (everyone else) — computed with
  // the same helper over filtered arrays so the reduce logic isn't
  // duplicated. A collaborator only ever sees their own runs (the fetched
  // `runs` array is already scoped server-side), so their whole visible
  // total is "you". Neither split is needed for an owner of an unshared
  // project (nor local mode, where role is always owner and sharedEver
  // false) — that branch stays the original single figure.
  const ownCostUsd = showTriggeredBy
    ? sumEstimatedCost(runs.filter((r) => r.createdBy === selfUserId || r.createdBy == null))
    : undefined;
  const collaboratorCostUsd = showTriggeredBy
    ? sumEstimatedCost(runs.filter((r) => r.createdBy != null && r.createdBy !== selfUserId))
    : undefined;

  const getStatusIcon = (status: RunStatusCode): React.ReactNode => {
    switch (status) {
      case RunStatusCode.Pending:
        return <Clock className="size-4 text-muted-foreground animate-pulse" />;
      case RunStatusCode.Queued:
        return <Hourglass className="size-4 text-status-warn" />;
      case RunStatusCode.Paused:
        return <Pause className="size-4 text-status-warn" />;
      case RunStatusCode.Running:
        return <Loader2 className="size-4 text-status-info animate-spin" />;
      case RunStatusCode.Completed:
        return <CheckCircle2 className="size-4 text-status-pass" />;
      case RunStatusCode.Failed:
        return <AlertCircle className="size-4 text-status-fail" />;
      case RunStatusCode.Cancelled:
        return <Ban className="size-4 text-muted-foreground" />;
      default: {
        // A new RunStatusCode must add a branch above; this fails the build.
        // At runtime an unrecognised code renders nothing (as before).
        const _exhaustive: never = status;
        void _exhaustive;
        return null;
      }
    }
  };

  const getStatusBadge = (status: RunStatusCode): React.ReactNode => {
    return <RunStatusBadge status={status} />;
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>{t('tabPlaceholder.runs')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('runs.title')}</h2>
        <div className="flex items-center gap-4">
          {auditVisible && (
            <div
              className="flex items-center gap-1"
              aria-label={t('runs.viewSwitchLabel')}
              data-testid="activity-view-switch"
            >
              <Button
                size="sm"
                variant={activityView === 'engines' ? 'default' : 'outline'}
                onClick={() => setActivityView('engines')}
                aria-pressed={activityView === 'engines'}
                data-testid="activity-view-engines-btn"
              >
                {t('runs.viewEngines')}
              </Button>
              <Button
                size="sm"
                variant={activityView === 'manual' ? 'default' : 'outline'}
                onClick={() => setActivityView('manual')}
                aria-pressed={activityView === 'manual'}
                data-testid="activity-view-manual-btn"
              >
                {t('runs.viewManual')}
              </Button>
            </div>
          )}
          {activityView === 'engines' && (
            <>
              {showTriggeredBy && projectCostUsd !== undefined && (
                <>
                  <div
                    className="text-sm text-muted-foreground"
                    data-testid="runs-project-cost-you"
                    title={`${t('runs.estimatesNote')} ${t('runs.perMillionNote')}`}
                  >
                    {t('runs.projectTotalYou', { amount: formatUsd(ownCostUsd ?? 0) })}
                  </div>
                  <div
                    className="text-sm text-muted-foreground"
                    data-testid="runs-project-cost-collaborators"
                    title={`${t('runs.estimatesNote')} ${t('runs.perMillionNote')}`}
                  >
                    {t('runs.projectTotalCollaborators', {
                      amount: formatUsd(collaboratorCostUsd ?? 0),
                    })}
                  </div>
                </>
              )}
              {access.role === 'collaborator' && projectCostUsd !== undefined && (
                <div
                  className="text-sm text-muted-foreground"
                  data-testid="runs-project-cost-you"
                  title={`${t('runs.estimatesNote')} ${t('runs.perMillionNote')}`}
                >
                  {t('runs.projectTotalYou', { amount: formatUsd(projectCostUsd) })}
                </div>
              )}
              {!showTriggeredBy &&
                access.role !== 'collaborator' &&
                projectCostUsd !== undefined && (
                  <div
                    className="text-sm text-muted-foreground"
                    data-testid="runs-project-cost"
                    title={`${t('runs.estimatesNote')} ${t('runs.perMillionNote')}`}
                  >
                    {t('runs.projectTotal', { amount: formatUsd(projectCostUsd) })}
                  </div>
                )}
              {queuedRuns.length > 0 && (
                <div
                  className="flex items-center gap-2 text-sm text-status-warn"
                  data-testid="runs-queued-count"
                >
                  <Hourglass className="size-4" />
                  <span>{t('runs.queuedCount', { count: queuedRuns.length })}</span>
                </div>
              )}
              {activeRuns.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-status-info">
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t('runs.activeRuns', { count: activeRuns.length })}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showManualView ? (
        <ManualEditsView projectId={projectId} />
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">{t('runs.statusColumn')}</TableHead>
                  <TableHead>{t('runs.runIdColumn')}</TableHead>
                  <TableHead>{t('runs.typeColumn')}</TableHead>
                  <TableHead>{t('runs.startedColumn')}</TableHead>
                  {showTriggeredBy && <TableHead>{t('collab:activity.triggeredBy')}</TableHead>}
                  <TableHead>{t('runs.progressColumn')}</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      {t('runs.costColumn')}
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={t('runs.perMillionNote')}
                              data-testid="runs-cost-info"
                            />
                          }
                        >
                          <Info className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>{t('runs.perMillionNote')}</TooltipContent>
                      </Tooltip>
                    </span>
                  </TableHead>
                  <TableHead className="text-right">{t('runs.actionColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRuns.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showTriggeredBy ? 8 : 7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('runs.emptyState')}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRuns.map((run) => {
                    const isRunning =
                      run.status === RunStatusCode.Running || run.status === RunStatusCode.Pending;
                    const isPaused = run.status === RunStatusCode.Paused;
                    // Status is checked FIRST: a Cancelled run with a leftover
                    // waitingForQuota field (set before it was cancelled) must
                    // never render the waiting chip — only a currently-Paused,
                    // still-parked run does.
                    const isWaitingForQuota =
                      isPaused && (run.waitingForQuota?.pairs?.length ?? 0) > 0;
                    const isQueued = run.status === RunStatusCode.Queued;
                    const queueIndex = isQueued ? queuedIds.indexOf(run.runId) : -1;

                    const isJudge = run.kind === 'judge';
                    const isSourceReview = run.kind === 'source-review';
                    // A chat-usage run: one growing entry per assistant chat
                    // session, always 'completed' (no cancellable/running
                    // state, no progress semantics, no run-detail sidecar to
                    // show/retry/revert).
                    const isChat = isChatRun(run);
                    const chatData = isChat ? chatRunData(run) : undefined;

                    // A finished (or cancelled) translation run with recorded
                    // failures can re-run just the pairs that errored.
                    const isTerminal =
                      run.status === RunStatusCode.Completed ||
                      run.status === RunStatusCode.Failed ||
                      run.status === RunStatusCode.Cancelled;
                    // Glossary-generation runs are tracked here too, but they are
                    // neither translation nor review runs — they have no failed
                    // (entry, language) pairs to retry, no run-detail sidecar, and
                    // nothing to AI-review. Classify "translation" by the run's kind
                    // (absent = legacy translate) rather than by exclusion, so a new
                    // non-translation kind never falls through into the translation
                    // affordances (Show details / AI review / Retry failed).
                    const isTranslation = isTranslationRun(run);
                    // Details + revert + AI-review follow the run-details sidecar:
                    // translation AND relink-retranslate runs both persist one and
                    // both record a `request` scope the judge engine can review.
                    // Retry-failed stays translation-only — relink has no
                    // retry-failed route.
                    const canShowDetails = hasRunDetails(run) && isTerminal;
                    const canRetry = isTranslation && isTerminal && run.failed > 0;
                    const canRetryJudge = isJudge && isTerminal && run.failed > 0;
                    const canAiReview =
                      hasRunDetails(run) && run.status === RunStatusCode.Completed;
                    // Revert restores this run's captured pre-run translation
                    // values. Only offered for a completed, not-yet-reverted
                    // revertible run (translation or relink) that is still the
                    // NEWEST completed revertible run for the project (see the
                    // server's conservative multi-run guard above
                    // `newestCompletedRevertibleRunId`).
                    const canRevert =
                      hasRunDetails(run) &&
                      run.status === RunStatusCode.Completed &&
                      !run.reverted &&
                      run.runId === newestCompletedRevertibleRunId;

                    return (
                      <Fragment key={run.runId}>
                        <TableRow>
                          <TableCell className={rowAccentClass(run.status)}>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(run.status)}
                              {getStatusBadge(run.status)}
                              {isWaitingForQuota && (
                                <Badge
                                  variant="secondary"
                                  className="bg-status-warn/10 text-status-warn"
                                  data-testid={`run-waiting-badge-${run.runId}`}
                                >
                                  <Hourglass data-icon="inline-start" className="size-3" />
                                  {t('runs.statusWaitingForQuota')}
                                </Badge>
                              )}
                              {isJudge && (
                                <Badge
                                  variant="outline"
                                  data-testid={`run-judge-badge-${run.runId}`}
                                >
                                  <Sparkles data-icon="inline-start" className="size-3" />
                                  {t('runs.judgeBadge')}
                                </Badge>
                              )}
                              {!isJudge && run.aiScore !== undefined && (
                                <Badge
                                  variant="secondary"
                                  className={cn('font-mono', scoreTint(run.aiScore))}
                                  title={t('runs.aiReviewed', { score: run.aiScore })}
                                  data-testid={`run-ai-score-${run.runId}`}
                                >
                                  <Sparkles data-icon="inline-start" className="size-3" />
                                  {run.aiScore}
                                </Badge>
                              )}
                            </div>
                            {isWaitingForQuota && run.waitingForQuota && (
                              <div
                                className="mt-1 space-y-0.5"
                                data-testid={`run-waiting-detail-${run.runId}`}
                              >
                                <div
                                  className="text-[10px] text-muted-foreground"
                                  title={new Date(run.waitingForQuota.resumeAt).toLocaleString()}
                                  data-testid={`run-waiting-resume-at-${run.runId}`}
                                >
                                  {t('runs.waitingResumesAt', {
                                    time: relativeTime(new Date(run.waitingForQuota.resumeAt)),
                                  })}
                                </div>
                                <div
                                  className="text-[10px] text-muted-foreground"
                                  data-testid={`run-waiting-pairs-${run.runId}`}
                                >
                                  {t('runs.waitingPairsCount', {
                                    count: run.waitingForQuota.pairs.length,
                                  })}
                                </div>
                                {run.waitingForQuota.reason === 'provider-error' && (
                                  <div
                                    className="text-[10px] text-muted-foreground"
                                    data-testid={`run-waiting-provider-reason-${run.runId}`}
                                  >
                                    {t('runs.waitingProviderErrorReason')}
                                  </div>
                                )}
                                {run.waitingForQuota.skipReason && (
                                  <div
                                    className="flex items-center gap-1 text-[10px] text-status-warn"
                                    data-testid={`run-waiting-skip-reason-${run.runId}`}
                                  >
                                    <AlertCircle className="size-3 shrink-0" />
                                    {t('runs.waitingSkipReasonWarning')}
                                  </div>
                                )}
                              </div>
                            )}
                            {isJudge && run.judgeSummary && run.judgeSummary.judged > 0 && (
                              <>
                                <div
                                  className="mt-1 text-[10px] text-muted-foreground"
                                  data-testid={`run-judge-summary-${run.runId}`}
                                >
                                  {t('runs.judgeSummary', {
                                    flagged: run.judgeSummary.flagged,
                                    judged: run.judgeSummary.judged,
                                    score: run.judgeSummary.averageScore ?? '—',
                                  })}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openReview('translation-ai', run.runId)}
                                  className="mt-0.5 flex items-center gap-0.5 text-[10px] text-status-info hover:underline"
                                  data-testid={`run-judge-toggle-${run.runId}`}
                                >
                                  {t('runs.judgeDetailsShow')}
                                </button>
                              </>
                            )}
                            {isSourceReview && (
                              <button
                                type="button"
                                onClick={() => openReview('source-ai', run.runId)}
                                className="mt-1 flex items-center gap-0.5 text-[10px] text-status-info hover:underline"
                                data-testid={`run-source-review-toggle-${run.runId}`}
                              >
                                {t('runs.sourceReviewDetailsShow')}
                              </button>
                            )}
                            {/* A completed glossary/category generation run can have
                            its suggestions reopened for review here, even after
                            the dialog/panel that started it is gone. */}
                            {(run.kind === 'glossary-gen' || run.kind === 'category-gen') &&
                              run.status === RunStatusCode.Completed && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openSuggestionsGated(
                                      run.kind === 'category-gen' ? 'category' : 'glossary',
                                      run.runId,
                                    )
                                  }
                                  className="mt-1 flex items-center gap-0.5 text-[10px] text-status-info hover:underline"
                                  data-testid={`run-review-suggestions-${run.runId}`}
                                >
                                  {t('runs.reviewSuggestions')}
                                </button>
                              )}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors"
                              title={run.runId}
                              aria-label={t('runs.copyRunId', { runId: run.runId })}
                              onClick={() => {
                                navigator.clipboard.writeText(run.runId).then(
                                  () => toast.success(t('runs.runIdCopied')),
                                  () => toast.error(t('runs.runIdCopyFailed')),
                                );
                              }}
                              data-testid={`run-id-${run.runId}`}
                            >
                              {run.runId.slice(0, 8)}
                            </button>
                            {canShowDetails && (
                              <button
                                type="button"
                                onClick={() => openRunDetails(run.runId)}
                                className="mt-1 flex items-center gap-0.5 text-xs font-medium text-status-info hover:underline"
                                data-testid={`run-details-toggle-${run.runId}`}
                              >
                                {t('runs.detailsShow')}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <Badge
                              variant="outline"
                              className={cn('font-normal', typeTint(run.kind))}
                              data-testid={`run-type-${run.runId}`}
                            >
                              {isChat && (
                                <MessageSquare data-icon="inline-start" className="size-3" />
                              )}
                              {isChat
                                ? t(chatTypeKey(chatData?.chatKind))
                                : t(RUN_TYPE_KEY[runTypeLabel(run.kind)])}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="text-sm"
                            title={new Date(run.startedAt).toLocaleString()}
                          >
                            {relativeTime(new Date(run.startedAt))}
                          </TableCell>
                          {showTriggeredBy && (
                            <TableCell
                              className="text-sm"
                              data-testid={`run-triggered-by-${run.runId}`}
                            >
                              {triggeredByLabel(run)}
                            </TableCell>
                          )}
                          <TableCell className="w-[220px]">
                            {isChat ? (
                              // A chat session has no progress semantics (no
                              // total to complete against) — show the turn
                              // count instead of a bar.
                              <div
                                className="text-xs text-muted-foreground"
                                data-testid={`run-chat-turns-${run.runId}`}
                              >
                                {t('runs.chatTurns', {
                                  count: chatData?.turns ?? run.total,
                                })}
                              </div>
                            ) : (
                              <RunProgressBar
                                completed={run.completed}
                                failed={run.failed}
                                total={run.total}
                                status={run.status}
                                aria-label={t('runs.stringsProgress', {
                                  completed: run.completed,
                                  total: run.total,
                                })}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <RunCostCell run={run} />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isQueued && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={queueIndex <= 0}
                                    aria-label={t('runs.moveUp')}
                                    title={t('runs.moveUp')}
                                    onClick={() => moveQueued(run.runId, -1)}
                                    data-testid={`run-queue-up-${run.runId}`}
                                  >
                                    <ArrowUp className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={queueIndex === queuedIds.length - 1}
                                    aria-label={t('runs.moveDown')}
                                    title={t('runs.moveDown')}
                                    onClick={() => moveQueued(run.runId, 1)}
                                    data-testid={`run-queue-down-${run.runId}`}
                                  >
                                    <ArrowDown className="size-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      resumeRun(projectId, run.runId).catch((err: unknown) =>
                                        toast.error((err as Error).message),
                                      )
                                    }
                                    data-testid={`run-start-now-${run.runId}`}
                                  >
                                    <Play className="size-4 mr-1" />
                                    {t('runs.startNow')}
                                  </Button>
                                </>
                              )}
                              {run.status === RunStatusCode.Running && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    pauseRun(projectId, run.runId).catch((err: unknown) =>
                                      toast.error((err as Error).message),
                                    )
                                  }
                                  data-testid={`run-pause-${run.runId}`}
                                >
                                  <Pause className="size-4 mr-1" />
                                  {t('runs.pause')}
                                </Button>
                              )}
                              {isPaused && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    resumeRun(projectId, run.runId).catch((err: unknown) =>
                                      toast.error((err as Error).message),
                                    )
                                  }
                                  data-testid={`run-resume-${run.runId}`}
                                >
                                  <Play className="size-4 mr-1" />
                                  {/* A parked run's plain Resume re-plans against the free
                                  pool again, so it's labeled distinctly from a normal
                                  paused run's Resume — "Resume now with…" below is the
                                  escape hatch to a different module. */}
                                  {isWaitingForQuota
                                    ? t('runs.resumeRetryFreePool')
                                    : t('runs.resume')}
                                </Button>
                              )}
                              {isWaitingForQuota && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setResumeWithRunId(run.runId)}
                                  data-testid={`run-resume-with-${run.runId}`}
                                >
                                  <Play className="size-4 mr-1" />
                                  {t('runs.resumeWithButton')}
                                </Button>
                              )}
                              {canRetry && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    retryRun(projectId, run.runId).then(
                                      () => toast.success(t('runs.retryStarted')),
                                      (err: unknown) => toast.error((err as Error).message),
                                    )
                                  }
                                  data-testid={`run-retry-${run.runId}`}
                                >
                                  <RotateCcw className="size-4 mr-1" />
                                  {t('runs.retryFailed', { count: run.failed })}
                                </Button>
                              )}
                              {canRetryJudge && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    retryJudgeRun(projectId, run.runId).then(
                                      () => toast.success(t('runs.retryStarted')),
                                      (err: unknown) => toast.error((err as Error).message),
                                    )
                                  }
                                  data-testid={`run-judge-retry-${run.runId}`}
                                >
                                  <RotateCcw className="size-4 mr-1" />
                                  {t('runs.retryFailed', { count: run.failed })}
                                </Button>
                              )}
                              {canAiReview && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReviewRunId(run.runId)}
                                  data-testid={`run-judge-${run.runId}`}
                                >
                                  <Sparkles className="size-4 mr-1" />
                                  {t('runs.aiReview')}
                                </Button>
                              )}
                              {canRevert && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    revertRun(projectId, run.runId).then(
                                      ({ reverted }) =>
                                        toast.success(t('runs.revertSuccess', { count: reverted })),
                                      (err: unknown) => toast.error((err as Error).message),
                                    )
                                  }
                                  data-testid={`run-revert-${run.runId}`}
                                >
                                  <RotateCcw className="size-4 mr-1" />
                                  {t('runs.revert')}
                                </Button>
                              )}
                              {run.reverted && (
                                <Badge
                                  variant="secondary"
                                  data-testid={`run-reverted-badge-${run.runId}`}
                                >
                                  {t('runs.revertedBadge')}
                                </Badge>
                              )}
                              {/* Chat runs are always 'completed' — isRunning/
                              isPaused/isQueued are already all false for them,
                              but !isChat makes that guarantee explicit: a chat
                              session is never cancellable. */}
                              {!isChat && (isRunning || isPaused || isQueued) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-status-fail hover:text-status-fail hover:bg-status-fail/10"
                                  onClick={() =>
                                    cancelRun(projectId, run.runId).catch((err: unknown) =>
                                      toast.error((err as Error).message),
                                    )
                                  }
                                  data-testid={`run-cancel-${run.runId}`}
                                >
                                  <XCircle className="size-4 mr-1" />
                                  {t('runs.cancel')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>

          <Dialog
            open={detailsRun !== undefined}
            onOpenChange={(open) => !open && setDetailsRunId(null)}
          >
            <DialogContent className="max-w-4xl" data-testid="run-details-dialog">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {t('runs.detailsTitle')}
                  {detailsRun && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal">
                      {detailsRun.runId.slice(0, 8)}
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription>{t('runs.detailsDescription')}</DialogDescription>
              </DialogHeader>
              <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
                {detailsRun && (
                  <RunDetailsContent
                    details={detailsByRun[detailsRun.runId]}
                    usage={detailsRun.usageByModule}
                    loading={loadingDetailsRunId === detailsRun.runId}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>

          <AiReviewDialog
            key={reviewRunId ?? 'closed'}
            run={reviewRun}
            onOpenChange={(open) => !open && setReviewRunId(null)}
            onStart={startReview}
          />

          <Dialog
            open={resumeWithRunId !== null}
            onOpenChange={(open) => !open && closeResumeWithDialog()}
          >
            <DialogContent data-testid="run-resume-with-dialog">
              <DialogHeader>
                <DialogTitle>{t('runs.resumeWithTitle')}</DialogTitle>
                <DialogDescription>{t('runs.resumeWithDescription')}</DialogDescription>
              </DialogHeader>
              {resumeWithOptions.length > 0 ? (
                <ModuleSelect
                  value={resumeWithModuleId}
                  onValueChange={setResumeWithModuleId}
                  modules={resumeWithOptions}
                  placeholder={t('runs.resumeWithModulePlaceholder')}
                  triggerTestId="run-resume-with-module-select"
                />
              ) : (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="run-resume-with-no-modules"
                >
                  {t('runs.resumeWithNoModules')}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeResumeWithDialog}>
                  {t('runs.resumeWithCancel')}
                </Button>
                <Button
                  disabled={!resumeWithModuleId}
                  onClick={submitResumeWith}
                  data-testid="run-resume-with-confirm"
                >
                  {t('runs.resumeWithConfirm')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
