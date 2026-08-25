import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RunStatusCode,
  type Glossary,
  type JudgeVerdictRecord,
  type JudgeLogEntry,
  type JudgeIssueType,
  type RunStatus,
  type StringEntry,
  type TranslationRecord,
} from '@zercade-dev/narn-shared';
import {
  ListChecks,
  Loader2,
  Sparkles,
  Check,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RunProgressCard } from '@/components/common/RunProgressCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, errorMessage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { ApiError } from '../../hooks/use-api.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { AiReviewDialog, type AiReviewOverride } from '../tabs/AiReviewDialog.js';
import { scoreTint, TINT_RED } from '../tabs/run-status-ui.js';
import { useRunStore } from '../../stores/run-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useViewStore } from '../../stores/view-store.js';
import {
  DiffLegend,
  DiffText,
  ExpandableText,
  GlossaryHintList,
  LqaIssueList,
  ReviewCardShell,
  ReviewEmptyState,
  RevealList,
  REVIEW_TEXT_BLOCK,
  deriveLqaState,
  glossaryHints as computeGlossaryHints,
  isRunActive,
  isTranslationRun,
  useFullGlossaries,
  useReviewShortcuts,
  type GlossaryHint,
  type ShortcutMap,
} from './review-shared.js';
import { RunLogsPanel } from './RunLogsPanel.js';

/** The string store's `updateEntry` action, threaded into the shared apply path. */
type UpdateEntryFn = (
  projectId: string,
  id: string,
  partial: Partial<StringEntry>,
) => Promise<void>;

/**
 * Adopt a verdict's suggested rewrite as the stored translation — the shared
 * apply path behind the per-verdict "Apply" button and the "Approve all" batch
 * action. When a record exists only its text changes (the review status stays
 * put, mirroring the manual review tab's edit); when none exists (the reviewed
 * translation was since removed, or never stored under this language) a fresh
 * manual record is created. Returns false (and applies nothing) when the verdict
 * carries no suggestion. Throws on the underlying store error so callers can
 * surface it however they like.
 */
async function applyJudgeSuggestion(
  verdict: JudgeVerdictRecord,
  entry: StringEntry | undefined,
  projectId: string,
  updateEntry: UpdateEntryFn,
): Promise<boolean> {
  if (verdict.suggestion === undefined) return false;
  const record = entry?.translations[verdict.targetLanguage];
  const base: TranslationRecord = record ?? {
    text: verdict.suggestion,
    status: 'translated',
    moduleId: 'manual',
    timestamp: Date.now(),
    needsReview: true,
  };
  const patched: TranslationRecord = {
    ...base,
    text: verdict.suggestion,
    moduleId: 'manual',
    timestamp: Date.now(),
  };
  // The judge's suggestion is a fresh manual rewrite of the text — never carry
  // over a Freeway tier (or its bucket key) the OLD text was produced under.
  delete patched.freewayTier;
  delete patched.freewayBucketKey;
  await updateEntry(projectId, verdict.entryId, {
    translations: {
      [verdict.targetLanguage]: patched,
    },
  });
  return true;
}

/**
 * Glossary terms whose source wording occurs in `entry`'s source text, paired
 * with the glossary they came from. Mirrors the manual review tab so the
 * reviewer sees exactly the terms the engine would have applied. Returns [] when
 * the entry has no assignments.
 */
function glossaryHintsFor(entry: StringEntry | undefined, glossaries: Glossary[]): GlossaryHint[] {
  if (!entry) return [];
  return computeGlossaryHints(entry.sourceText, glossaries, entry.assignedGlossaryIds ?? []);
}

const ISSUE_TYPE_KEY: Record<JudgeIssueType, string> = {
  accuracy: 'runs.judgeIssueAccuracy',
  fluency: 'runs.judgeIssueFluency',
  terminology: 'runs.judgeIssueTerminology',
  tone: 'runs.judgeIssueTone',
  mistranslation: 'runs.judgeIssueMistranslation',
  typo: 'runs.judgeIssueTypo',
  grammar: 'runs.judgeIssueGrammar',
  clarity: 'runs.judgeIssueClarity',
  unsafe: 'runs.judgeIssueUnsafe',
};

/**
 * One verdict card: score/verdict badges, source and current translation side
 * by side, the judge's issues, and (when present) the suggested rewrite with a
 * raw/diff toggle and an "apply" action that overwrites the stored translation.
 */
function JudgeVerdictCard({
  verdict: v,
  entry,
  projectId,
  runId,
  onSuggested,
  onApplied,
  variant = 'compact',
}: Readonly<{
  verdict: JudgeVerdictRecord;
  entry: StringEntry | undefined;
  projectId: string;
  /** The judge run this verdict belongs to — needed to generate a suggestion. */
  runId: string;
  /** Called with the updated verdict after a suggestion is generated, so the
   * parent can refresh its verdict cache and re-render the card. */
  onSuggested: (updated: JudgeVerdictRecord) => void;
  /** Called only after a successful apply (not on error or no-op). The detail
   * viewer passes its advance callback so a clicked Apply moves to the next
   * item; the all-findings list omits it, so per-card apply stays put there. */
  onApplied?: () => void;
  /** `detail` adopts the manual review tab's prominent prose card; `compact`
   * (default) keeps the dense muted card used in the all-findings dialog. */
  variant?: 'detail' | 'compact';
}>) {
  const { t } = useTranslation('strings');
  const updateEntry = useStringStore((s) => s.updateEntry);
  const suggestVerdict = useRunStore((s) => s.suggestVerdict);
  const discardVerdictSuggestion = useRunStore((s) => s.discardVerdictSuggestion);
  // Optional reviewer guidance threaded into the next (re-)generate request.
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidance, setGuidance] = useState('');

  // Generate a suggestion on demand for a finding that has issues but no
  // suggestion yet: re-runs the judge (forced-suggestion) on this single pair,
  // persists it server-side, and hands the updated verdict back to the parent.
  // The conditional "no change" notice stays in the body (it is a toast.info,
  // not the flat success toast useAsyncAction shows).
  const { run: generateSuggestion, busy: generating } = useAsyncAction(
    async () => {
      const updated = await suggestVerdict(
        projectId,
        runId,
        v.entryId,
        v.targetLanguage,
        guidance.trim() || undefined,
      );
      onSuggested(updated);
      setGuidance('');
      setGuidanceOpen(false);
      // The server returns a verdict with no suggestion when the model just
      // echoed the current translation (judged it already optimal) — tell the
      // reviewer rather than leaving the unchanged Generate button looking inert.
      if (updated.suggestion === undefined) {
        toast.info(t('runs.judgeGenerateSuggestionNoChange'));
      }
    },
    { errorFallback: t('runs.judgeGenerateSuggestionFailed') },
  );

  const record = entry?.translations[v.targetLanguage];
  const liveText = record?.text;
  // The text this verdict was actually rendered against: the exact reviewed
  // text captured at judge time, falling back to the live translation for
  // verdicts recorded before `judgedText` was persisted.
  const reviewedText = v.judgedText ?? liveText;
  const cardId = `${v.entryId}-${v.targetLanguage}`;

  const [view, setView] = useState<'raw' | 'diff'>('diff');
  // The diff needs a reviewed text to compare against; without one the
  // suggestion can only be shown raw.
  const effectiveView = reviewedText !== undefined ? view : 'raw';
  const showDiff =
    v.suggestion !== undefined && reviewedText !== undefined && effectiveView === 'diff';

  // "Applied" tracks the live stored translation, not the reviewed snapshot:
  // the button is done only once the suggestion is what's actually stored.
  const applied = v.suggestion !== undefined && v.suggestion === liveText;

  const { run: applySuggestion, busy: applying } = useAsyncAction(
    async () => {
      if (v.suggestion === undefined) return;
      const did = await applyJudgeSuggestion(v, entry, projectId, updateEntry);
      // Success only — a thrown store error is caught by useAsyncAction and a
      // no-op apply (did === false) must not advance the detail viewer.
      if (did) onApplied?.();
    },
    {
      errorFallback: t('runs.judgeApplyFailed'),
      successMessage: t('runs.judgeApplySuccess'),
    },
  );

  const { run: discardSuggestion, busy: discarding } = useAsyncAction(
    async () => {
      const updated = await discardVerdictSuggestion(projectId, runId, v.entryId, v.targetLanguage);
      onSuggested(updated);
    },
    {
      errorFallback: t('runs.judgeDiscardFailed'),
      successMessage: t('runs.judgeDiscardSuccess'),
    },
  );

  // Collapsible guidance textarea, shared between the initial "Generate" flow
  // and the "Re-request" flow on an existing suggestion.
  const guidanceBlock = (
    <div className="space-y-1">
      <button
        type="button"
        className="text-[11px] text-primary hover:underline cursor-pointer"
        onClick={() => setGuidanceOpen((o) => !o)}
        data-testid={`judge-guidance-toggle-${cardId}`}
      >
        {t('runs.judgeGuidanceToggle')}
      </button>
      {guidanceOpen && (
        <textarea
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={t('runs.judgeGuidancePlaceholder')}
          aria-label={t('runs.judgeGuidanceToggle')}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          data-testid={`judge-guidance-input-${cardId}`}
        />
      )}
    </div>
  );

  // In `detail` mode the card is the prominent prose card of the manual review
  // tab (readable text, no inner border — the parent supplies the card shell);
  // `compact` keeps the dense monospace card used in the all-findings dialog.
  const detail = variant === 'detail';
  const containerClass = detail
    ? 'space-y-4 text-sm'
    : 'space-y-2 rounded border border-border/60 bg-muted/30 px-2.5 py-2 text-xs';
  const sectionHeaderClass = detail
    ? 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
    : 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground';
  const textBlockClass = detail
    ? 'whitespace-pre-wrap break-words text-sm leading-relaxed'
    : REVIEW_TEXT_BLOCK;
  const gridClass = detail ? 'grid gap-6 md:grid-cols-2' : 'grid gap-3 md:grid-cols-2';
  const issueClass = detail ? 'text-sm text-status-warn' : 'text-[11px] text-status-warn';
  const noTargetClass = detail
    ? 'text-sm italic text-muted-foreground'
    : 'text-[11px] italic text-muted-foreground';

  return (
    <div className={containerClass} data-testid={`judge-verdict-${cardId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={cn('font-mono', scoreTint(v.score))}>
          {v.score}
        </Badge>
        {/* Themed decorative reinforcement — hearts (pixel) / shield
            segments (techno) rendering the SAME real 0-100 score as the Badge
            above, which stays the source of truth. 5 units at 20 points each:
            granularity is coarser than the raw score, so the exact number
            lives in the aria-label, not implied by the unit count. */}
        <span
          data-testid="judge-score-meter"
          data-judge-score={v.score}
          role="img"
          aria-label={t('runs.judgeScoreLabel', { score: v.score })}
          className={cn('inline-flex items-center gap-0.5', scoreTint(v.score))}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} data-filled={v.score >= (i + 1) * 20} className="size-3" />
          ))}
        </span>
        <Badge
          variant={v.verdict === 'pass' ? 'outline' : 'secondary'}
          className={v.verdict === 'fail' ? TINT_RED : undefined}
        >
          {v.verdict === 'pass' ? t('runs.judgeVerdictPass') : t('runs.judgeVerdictFail')}
        </Badge>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          {v.targetLanguage}
        </span>
      </div>

      {/* Source and current translation side by side for comparison */}
      <div className={gridClass}>
        <div className="space-y-1">
          <h4 className={sectionHeaderClass}>{t('runs.judgeSourceLabel')}</h4>
          <p className={textBlockClass} data-testid={`judge-source-${cardId}`}>
            {entry ? (
              entry.sourceText
            ) : (
              <span className="text-muted-foreground">{v.entryId.slice(0, 8)}</span>
            )}
          </p>
        </div>
        <div className="space-y-1">
          <h4 className={sectionHeaderClass}>{t('runs.judgeTargetLabel')}</h4>
          {reviewedText !== undefined ? (
            <p className={textBlockClass} data-testid={`judge-target-${cardId}`}>
              {reviewedText}
            </p>
          ) : (
            <p className={noTargetClass}>{t('runs.judgeNoTarget')}</p>
          )}
        </div>
      </div>

      {v.issues.length > 0 && (
        <div className="flex flex-col gap-1">
          {v.issues.map((issue, i) => (
            <span
              // Issues are positional within a verdict.
              key={`${issue.type}-${i}`}
              className={issueClass}
            >
              <span className="font-medium">{t(ISSUE_TYPE_KEY[issue.type])}:</span>{' '}
              {/* The judge detail is no longer capped server-side; render it in
                  full, collapsing very long explanations behind a show-more
                  toggle rather than letting one dominate the card. */}
              <ExpandableText text={issue.detail} testId={`judge-issue-detail-${cardId}-${i}`} />
            </span>
          ))}
        </div>
      )}

      {/* A finding with issues but no suggestion can have one generated on
          demand — re-runs the judge with the forced-suggestion prompt. */}
      {v.issues.length > 0 && v.suggestion === undefined && (
        <div className="space-y-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={generating}
            onClick={generateSuggestion}
            data-testid={`judge-generate-suggestion-${cardId}`}
          >
            {generating ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3" aria-hidden />
            )}
            {t('runs.judgeGenerateSuggestion')}
          </Button>
          {guidanceBlock}
        </div>
      )}

      {v.suggestion !== undefined && (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className={sectionHeaderClass}>{t('runs.judgeSuggestionLabel')}</h4>
            <div className="flex items-center gap-1">
              <Button
                variant={effectiveView === 'raw' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                aria-pressed={effectiveView === 'raw'}
                onClick={() => setView('raw')}
                data-testid={`judge-view-raw-${cardId}`}
              >
                {t('runs.judgeViewRaw')}
              </Button>
              <Button
                variant={effectiveView === 'diff' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                aria-pressed={effectiveView === 'diff'}
                disabled={reviewedText === undefined}
                onClick={() => setView('diff')}
                data-testid={`judge-view-diff-${cardId}`}
              >
                {t('runs.judgeViewDiff')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={generating}
                onClick={generateSuggestion}
                data-testid={`judge-rerequest-${cardId}`}
              >
                {generating ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3" aria-hidden />
                )}
                {t('runs.judgeReRequest')}
              </Button>
              {!applied && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={discarding}
                  onClick={discardSuggestion}
                  data-testid={`judge-discard-${cardId}`}
                >
                  {discarding ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden />
                  ) : (
                    <X className="size-3" aria-hidden />
                  )}
                  {t('runs.judgeDiscard')}
                </Button>
              )}
              <Button
                variant={v.suggestionDropsFormatting && !applied ? 'destructive' : 'outline'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                disabled={applying || applied}
                onClick={applySuggestion}
                title={
                  v.suggestionDropsFormatting
                    ? t('runs.judgeSuggestionFormattingWarning')
                    : undefined
                }
                data-testid={`judge-apply-${cardId}`}
              >
                {applying ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : v.suggestionDropsFormatting && !applied ? (
                  <AlertTriangle className="size-3" aria-hidden />
                ) : (
                  <Check className="size-3" aria-hidden />
                )}
                {applied
                  ? t('runs.judgeApplied')
                  : v.suggestionDropsFormatting
                    ? t('runs.judgeApplyAnyway')
                    : t('runs.judgeApply')}
              </Button>
            </div>
          </div>
          {guidanceBlock}
          {v.suggestionDropsFormatting && (
            <p
              className="flex items-center gap-1 text-[10px] text-destructive"
              data-testid={`judge-format-warning-${cardId}`}
            >
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              {t('runs.judgeSuggestionFormattingWarning')}
            </p>
          )}
          {showDiff && reviewedText !== undefined ? (
            <>
              <DiffLegend />
              <DiffText
                oldText={reviewedText}
                newText={v.suggestion}
                className={textBlockClass}
                testId={`judge-suggestion-diff-${cardId}`}
              />
            </>
          ) : (
            <p className={textBlockClass} data-testid={`judge-suggestion-raw-${cardId}`}>
              {v.suggestion}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Reviewer-reference context for the focused verdict, mirroring the manual
 * review tab's LQA and glossary panels: the automated LQA issues recorded for
 * this (entry, language) and the glossary terms that occur in the source.
 * Renders nothing when there is no context to show.
 */
function JudgeContextPanel({
  entry,
  targetLanguage,
  glossaryHints,
}: Readonly<{
  entry: StringEntry | undefined;
  targetLanguage: string;
  glossaryHints: GlossaryHint[];
}>) {
  const { t: tr } = useTranslation('review');

  const { issues: lqaIssues, showOverflow, overflowRatio } = deriveLqaState(entry, targetLanguage);

  if (lqaIssues.length === 0 && !showOverflow && glossaryHints.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="judge-context">
      <LqaIssueList
        issues={lqaIssues}
        showOverflow={showOverflow}
        overflowRatio={overflowRatio}
        headingClassName="text-[10px]"
        listClassName="space-y-1 text-[11px]"
        headingTag="h4"
        testId="judge-lqa-issues"
      />

      {glossaryHints.length > 0 && (
        <section data-testid="judge-glossary">
          <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {tr('glossaryTermsTitle')}
          </h4>
          <GlossaryHintList
            hints={glossaryHints}
            targetLanguage={targetLanguage}
            className="space-y-1 text-[11px]"
            itemTestId="judge-glossary-term"
          />
        </section>
      )}
    </div>
  );
}

/**
 * The disaggregated per-(string, language) verdicts behind a review run's
 * average score, shown one at a time with prev/next navigation (worst-scoring
 * first, so the strings that need attention come up first). The active index is
 * owned by the parent so it can reset when the selected run changes; this view
 * only clamps it and drives the buttons. Source and target texts are resolved
 * from the loaded entries; the source falls back to a short entry id when an
 * entry isn't in the store.
 */
function JudgeVerdictDetail({
  sorted,
  entriesById,
  glossaries,
  loading,
  projectId,
  runId,
  onSuggested,
  index,
  onPrev,
  onNext,
  keyboardEnabled,
}: Readonly<{
  /** The focused run's verdicts, already sorted worst-scoring first by the
   * parent (the single sort threaded down to avoid re-sorting per consumer). */
  sorted: JudgeVerdictRecord[];
  entriesById: Map<string, StringEntry>;
  glossaries: Glossary[];
  loading: boolean;
  projectId: string;
  /** The focused judge run — needed to generate a suggestion for a verdict. */
  runId: string;
  /** Propagates a generated suggestion back up so the parent's verdict cache
   * updates and the card re-renders with the new suggestion. */
  onSuggested: (updated: JudgeVerdictRecord) => void;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  /** When false (e.g. the quick-view dialog is open), the global shortcuts are
   * not registered so they don't act on this background detail view. */
  keyboardEnabled: boolean;
}>) {
  const { t } = useTranslation('strings');
  const { t: tr } = useTranslation('review');
  const updateEntry = useStringStore((s) => s.updateEntry);

  // Clamp to the current set: the parent resets the index on run change, but a
  // verdict refetch could still shrink the list out from under a stale index.
  const safeIndex = sorted.length > 0 ? Math.min(Math.max(index, 0), sorted.length - 1) : 0;
  const current = sorted[safeIndex];
  const currentEntry = current ? entriesById.get(current.entryId) : undefined;

  // Apply the focused verdict's suggestion (shared with the per-card button and
  // the 'a' keyboard shortcut). Guarded against already-applied / no-suggestion.
  const liveText = current && currentEntry?.translations[current.targetLanguage]?.text;
  const applied =
    current !== undefined && current.suggestion !== undefined && current.suggestion === liveText;
  const applyCurrent = useCallback(async () => {
    if (!current || current.suggestion === undefined) return;
    try {
      const did = await applyJudgeSuggestion(current, currentEntry, projectId, updateEntry);
      if (did) {
        toast.success(t('runs.judgeApplySuccess'));
        // Applied — move straight to the next item so review keeps flowing
        // (also fires for the 'a' shortcut; goNext clamps at the end).
        onNext();
      }
    } catch (err) {
      toast.error(errorMessage(err, t('runs.judgeApplyFailed')));
    }
  }, [current, currentEntry, projectId, updateEntry, t, onNext]);

  // Keyboard throughput, mirroring the manual review tab: ↑/↓ navigate verdicts,
  // a applies the current suggestion (omitted once applied so it's a no-op).
  // Disabled while the quick-view dialog is open so it doesn't act on this
  // background detail view.
  const shortcuts = useMemo<ShortcutMap>(
    () => ({
      ArrowDown: onNext,
      ArrowUp: onPrev,
      ...(applied ? {} : { a: () => void applyCurrent() }),
    }),
    [onNext, onPrev, applyCurrent, applied],
  );
  useReviewShortcuts(shortcuts, keyboardEnabled);

  // Memoized so the per-term RegExp compilation in glossaryHintsFor doesn't
  // repeat on every render (e.g. each keystroke that re-attaches the keyboard
  // handler, mirroring the source-AI and manual review tabs). Computed before
  // the early returns to keep the hook order stable.
  const glossaryHints = useMemo(
    () => glossaryHintsFor(currentEntry, glossaries),
    [currentEntry, glossaries],
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        {t('runs.judgeDetailLoading')}
      </div>
    );
  }
  if (sorted.length === 0 || !current) {
    return (
      <div className="py-3 text-xs text-muted-foreground" data-testid="run-judge-detail-empty">
        {t('runs.judgeDetailEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="run-judge-detail">
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" data-testid="run-judge-position">
          {tr('translationAi.position', { current: safeIndex + 1, total: sorted.length })}
        </Badge>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={safeIndex === 0}
            data-testid="run-judge-prev"
            aria-label={tr('translationAi.prev')}
          >
            <ChevronUp className="size-4" aria-hidden />
            {tr('translationAi.prev')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={safeIndex >= sorted.length - 1}
            data-testid="run-judge-next"
            aria-label={tr('translationAi.next')}
          >
            <ChevronDown className="size-4" aria-hidden />
            {tr('translationAi.next')}
          </Button>
        </div>
      </div>

      {/* Prominent review card mirroring the manual review tab: the verdict
          (source vs. translation, issues, suggestion) plus the LQA/glossary
          context, with a keyboard-hint footer. */}
      <ReviewCardShell
        hint={tr('translationAi.keyboardHint')}
        hintKeys={['a']}
        hintTestId="judge-keyboard-hint"
      >
        <JudgeVerdictCard
          key={`${current.entryId}:${current.targetLanguage}`}
          verdict={current}
          entry={currentEntry}
          projectId={projectId}
          runId={runId}
          onSuggested={onSuggested}
          onApplied={onNext}
          variant="detail"
        />

        <JudgeContextPanel
          entry={currentEntry}
          targetLanguage={current.targetLanguage}
          glossaryHints={glossaryHints}
        />
      </ReviewCardShell>
    </div>
  );
}

/**
 * Translation AI review (judge) sub-tab.
 *
 * Shows the per-(string, language) verdict detail behind an AI-review run:
 * source vs. translation, pass/fail, score, issues, and an applicable suggested
 * rewrite, plus the verbose prompt/response log when one was captured. The
 * focused run comes from the view store (deep-linked from the Activity tab) or
 * from the in-tab selector across the project's judge runs.
 */
export function TranslationAiReviewTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation('strings');
  const { t: tr } = useTranslation('review');

  const runs = useRunStore((s) => s.runs);
  const fetchRuns = useRunStore((s) => s.fetchRuns);
  const fetchVerdicts = useRunStore((s) => s.fetchVerdicts);
  const fetchJudgeLogs = useRunStore((s) => s.fetchJudgeLogs);
  const judgeRun = useRunStore((s) => s.judgeRun);
  const cancelRun = useRunStore((s) => s.cancelRun);

  const entries = useStringStore((s) => s.entries);
  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const updateEntry = useStringStore((s) => s.updateEntry);

  const reviewRunId = useViewStore((s) => s.reviewRunId);
  const clearReviewRunId = useViewStore((s) => s.clearReviewRunId);

  // Full glossaries (with terms) for this project, so the reviewer sees the
  // glossary terms that apply to the focused verdict's entry — best-effort, the
  // detail still renders without them.
  const { glossaries } = useFullGlossaries(projectId);

  // "View all findings" quick-view dialog: lists every verdict at once and can
  // approve/apply them all in one batch.
  const [allFindingsOpen, setAllFindingsOpen] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  // The run the user explicitly picked in the selector. Null until they pick;
  // a deep-linked run (reviewRunId) takes priority over the default until then.
  const [pickedRunId, setPickedRunId] = useState<string | null>(null);

  // Per-run verdicts and verbose logs, lazily fetched on first focus and cached
  // so reselecting is instant and polling never refetches.
  const [verdictsByRun, setVerdictsByRun] = useState<Record<string, JudgeVerdictRecord[]>>({});
  const [logsByRun, setLogsByRun] = useState<Record<string, JudgeLogEntry[]>>({});
  // Run ids whose detail fetch has been kicked off, so the load effect never
  // refires the same request across re-renders or polling.
  const requestedRef = useRef<Set<string>>(new Set());

  // Judge runs, newest first — the candidates for the selector.
  const judgeRuns = useMemo(
    () => runs.filter((r) => r.kind === 'judge').sort((a, b) => b.startedAt - a.startedAt),
    [runs],
  );

  const entriesById = useMemo(() => {
    const map = new Map<string, StringEntry>();
    for (const e of entries) map.set(e.id, e);
    return map;
  }, [entries]);

  const hasJudgeRun = (runId: string | null) =>
    runId !== null && judgeRuns.some((r) => r.runId === runId);

  // The focused run: a valid deep-link wins until the user picks something, then
  // their pick wins; otherwise default to the most recent judge run. Picking
  // also clears the deep-link (see onValueChange), so there is no flash back to
  // the default and the user is never trapped on the linked run.
  const effectiveRunId = hasJudgeRun(reviewRunId)
    ? reviewRunId
    : hasJudgeRun(pickedRunId)
      ? pickedRunId
      : (judgeRuns[0]?.runId ?? null);

  const selectedRun = judgeRuns.find((r) => r.runId === effectiveRunId);

  // Friendly label for a judge run in the selector — date plus the run's
  // pass/fail summary when it has one. Used both for the dropdown options and
  // for the selected value shown in the (full-width) trigger, so the user reads
  // "when + how it went" instead of an opaque run id.
  const judgeRunLabel = (run: RunStatus): string => {
    const date = new Date(run.startedAt).toLocaleString();
    if (run.judgeSummary && run.judgeSummary.judged > 0) {
      return `${date} · ${t('runs.judgeSummary', {
        flagged: run.judgeSummary.flagged,
        judged: run.judgeSummary.judged,
        score: run.judgeSummary.averageScore ?? '—',
      })}`;
    }
    return date;
  };

  // The completed translation run to review when the user clicks "Run review":
  // the most recent one, mirroring the Activity tab's per-run "AI review" action
  // but without making the user hunt for the run. `undefined` keeps the dialog
  // closed; opening sets it, closing clears it.
  const [reviewTargetRun, setReviewTargetRun] = useState<RunStatus | undefined>(undefined);
  // True while the "Review all translations" action is open/in-flight — this
  // action has no single run to target, unlike reviewTargetRun.
  const [reviewingAll, setReviewingAll] = useState(false);
  const latestTranslationRun = useMemo(
    () =>
      runs
        // Only translation runs are reviewable by the judge; the allowlist
        // excludes every non-translation kind (judge, source-review,
        // glossary-gen, category-gen) so none is ever fed into the judge engine.
        .filter((r) => isTranslationRun(r) && r.status === RunStatusCode.Completed)
        .sort((a, b) => b.startedAt - a.startedAt)[0],
    [runs],
  );

  // A judge run is in flight while any judge run is still pending/queued/running;
  // both "Review last run" and "Re-review" are disabled until it settles.
  const judgeInFlight = useMemo(
    () => runs.some((r) => r.kind === 'judge' && isRunActive(r)),
    [runs],
  );

  // The in-flight judge run itself, for the progress card. `judgeInFlight` is a
  // boolean used to gate the buttons; this is the run object the card renders.
  const activeJudgeRun = useMemo(
    () => runs.find((r) => r.kind === 'judge' && isRunActive(r)),
    [runs],
  );

  // Whether the focused run is itself still active — its verdicts are only
  // complete once it has finished, so a fetch issued mid-run must be re-issued
  // after it settles (see the verdict-load effect's cache key).
  const focusedActive = selectedRun !== undefined && isRunActive(selectedRun);

  // The translation run behind the currently-displayed judge run — the target
  // when re-running the judge on what the user is looking at. Re-using the
  // dialog flow against this run re-seeds module/model from its usage.
  const reviewedSourceRunId = selectedRun?.sourceRunId;
  const reviewedSourceRun = reviewedSourceRunId
    ? runs.find((r) => r.runId === reviewedSourceRunId)
    : undefined;

  // Shared failure handler for both the per-run and "review all" judge starts:
  // 423 (vault locked) is surfaced by the global unlock dialog; the store
  // refetches + polls on the post-unlock replay so the started run shows up
  // (disabling Start). Swallowing it here avoids a misleading "failed" toast.
  const handleJudgeStartError = (err: unknown): void => {
    if (err instanceof ApiError && err.status === 423) return;
    toast.error(errorMessage(err, t('runs.aiReviewStartFailed')));
  };

  // Kick off a judge run: against the chosen translation run, or (when
  // reviewingAll) across every currently-translated entry in the project. The
  // new run shows up in the selector once polling observes it.
  const startReview = (override: AiReviewOverride) => {
    if (reviewingAll) {
      judgeRun(projectId, undefined, override).catch(handleJudgeStartError);
      return;
    }
    if (!reviewTargetRun) return;
    judgeRun(projectId, reviewTargetRun.runId, override).catch(handleJudgeStartError);
  };

  // One-verdict-at-a-time navigation index for the focused run's detail. Reset
  // to the top whenever the focused run changes so a fresh run starts at its
  // worst-scoring verdict rather than a stale position.
  const [verdictIndex, setVerdictIndex] = useState(0);
  const [prevRunId, setPrevRunId] = useState(effectiveRunId);
  if (prevRunId !== effectiveRunId) {
    setPrevRunId(effectiveRunId);
    setVerdictIndex(0);
  }

  // Ensure runs are loaded when opening the tab directly (AppShell polls, but a
  // deep-link may land here before the first fetch resolves).
  useEffect(() => {
    if (projectId) void fetchRuns(projectId);
  }, [projectId, fetchRuns]);

  // Lazily fetch the focused run's verdicts (and verbose log), caching the
  // result. A fetch issued while the run was still active is re-issued once it
  // settles (keyed by the run's active state) so the completed verdicts replace
  // the mid-run snapshot — otherwise a focused-but-still-running run would keep
  // showing the partial verdicts it had at first focus. State is only set from
  // async callbacks, never synchronously here.
  useEffect(() => {
    if (effectiveRunId === null) return;
    const runId = effectiveRunId;
    const cacheKey = `${runId}:${focusedActive ? 'active' : 'done'}`;
    if (requestedRef.current.has(cacheKey)) return;
    requestedRef.current.add(cacheKey);
    // Source text is resolved from the entries store; load it once if this tab
    // was opened directly without the strings view ever populating it.
    if (entries.length === 0) void fetchEntries(projectId);
    fetchVerdicts(projectId, runId)
      .then((verdicts) => setVerdictsByRun((prev) => ({ ...prev, [runId]: verdicts })))
      .catch(() => setVerdictsByRun((prev) => ({ ...prev, [runId]: [] })));
    // Verbose log: fetched in parallel, cached. Absent for non-verbose runs
    // (the panel hides itself when empty).
    fetchJudgeLogs(projectId, runId)
      .then((logs) => setLogsByRun((prev) => ({ ...prev, [runId]: logs })))
      .catch(() => setLogsByRun((prev) => ({ ...prev, [runId]: [] })));
  }, [
    effectiveRunId,
    focusedActive,
    entries.length,
    fetchEntries,
    fetchVerdicts,
    fetchJudgeLogs,
    projectId,
  ]);

  // The focused run is loading until its verdicts land in the cache.
  const detailLoading = effectiveRunId !== null && verdictsByRun[effectiveRunId] === undefined;

  // The focused run's verdicts, worst-scoring first (mirrors the detail nav),
  // and the subset that carries an applicable suggestion.
  const focusedVerdicts = useMemo(() => {
    const list = effectiveRunId !== null ? (verdictsByRun[effectiveRunId] ?? []) : [];
    return [...list].sort((a, b) => a.score - b.score);
  }, [effectiveRunId, verdictsByRun]);
  // The review queue shows only "interesting" verdicts — those with a finding or
  // an applicable suggestion. Clean passes (no issues, no suggestion) are
  // omitted from the detail nav, the counts, and the all-findings list; the
  // worst-score-first order is inherited from `focusedVerdicts`.
  const reviewableVerdicts = useMemo(
    () => focusedVerdicts.filter((v) => v.issues.length > 0 || v.suggestion !== undefined),
    [focusedVerdicts],
  );
  const verdictsWithSuggestions = reviewableVerdicts.filter((v) => v.suggestion !== undefined);

  // Splice a freshly generated suggestion into the cached verdicts so the card
  // re-renders with it (and it then counts as a pending suggestion). Matched by
  // (entryId, targetLanguage); a no-op when the run is no longer focused.
  const applySuggestedToCache = useCallback(
    (updated: JudgeVerdictRecord) => {
      if (effectiveRunId === null) return;
      const runId = effectiveRunId;
      setVerdictsByRun((prev) => {
        const list = prev[runId];
        if (!list) return prev;
        const next = list.map((v) =>
          v.entryId === updated.entryId && v.targetLanguage === updated.targetLanguage
            ? updated
            : v,
        );
        return { ...prev, [runId]: next };
      });
    },
    [effectiveRunId],
  );

  const goPrev = () => setVerdictIndex((i) => Math.max(i - 1, 0));
  // Clamp to the last verdict so the keyboard ArrowDown shortcut (which, unlike
  // the disabled Next button, fires unconditionally) can't overshoot the end and
  // leave the index drifted past the list.
  const goNext = () =>
    setVerdictIndex((i) => Math.min(i + 1, Math.max(reviewableVerdicts.length - 1, 0)));

  // Apply/approve every listed suggestion in one pass. Sequential to keep the
  // per-project write lock contention-free; failures are counted and surfaced
  // rather than aborting the batch. The verdict cache need not be reflected back
  // — the cards re-derive "applied" from the live store. Suggestions already
  // equal to the live translation are skipped, so the count reflects real
  // changes and no redundant writes are issued.
  const approveAll = async () => {
    if (verdictsWithSuggestions.length === 0 || approvingAll) return;
    setApprovingAll(true);
    let applied = 0;
    let failed = 0;
    for (const v of verdictsWithSuggestions) {
      const entry = entriesById.get(v.entryId);
      // Skip suggestions that are already the stored translation.
      if (entry?.translations[v.targetLanguage]?.text === v.suggestion) continue;
      try {
        const did = await applyJudgeSuggestion(v, entry, projectId, updateEntry);
        if (did) applied += 1;
      } catch {
        failed += 1;
      }
    }
    setApprovingAll(false);
    if (failed > 0) {
      toast.warning(t('runs.judgeApproveAllPartial', { applied, failed }));
    } else {
      toast.success(t('runs.judgeApproveAllSuccess', { applied }));
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-4xl space-y-4 xl:max-w-6xl 2xl:max-w-7xl"
      data-testid="translation-ai-review"
    >
      {/* Page header — matches the source-AI sibling so the three review tabs
          share one orientation pattern (icon + title + one-line description). */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4" />
          <h3 className="text-sm font-semibold">{tr('translationAi.title')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{tr('translationAi.description')}</p>
      </div>

      {/* Start-a-review action + (when runs exist) the past-run selector. The
          run selector picks which past judge run to VIEW; "Review last run" opens
          the config popup to START a new one against the latest translation run. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => setReviewTargetRun(latestTranslationRun)}
          disabled={!latestTranslationRun || judgeInFlight}
          title={latestTranslationRun ? undefined : tr('translationAi.runReviewNoRun')}
          data-testid="translation-ai-review-run-review"
        >
          <Sparkles className="size-4" aria-hidden />
          {tr('translationAi.runReview')}
        </Button>
        <Button
          variant="outline"
          onClick={() => setReviewingAll(true)}
          disabled={judgeInFlight}
          data-testid="translation-ai-review-review-all"
        >
          <Sparkles className="size-4" aria-hidden />
          {tr('translationAi.reviewAll')}
        </Button>
        {judgeRuns.length > 0 && (
          <>
            <span className="text-sm font-medium">{tr('translationAi.runLabel')}</span>
            <Select
              value={effectiveRunId ?? undefined}
              onValueChange={(value) => {
                setPickedRunId(value);
                // Picking releases the deep-link so this pick (and future ones)
                // win without the focus snapping back to the linked run.
                if (reviewRunId !== null) clearReviewRunId();
              }}
            >
              <SelectTrigger
                className="w-full sm:w-[340px] sm:max-w-md"
                data-testid="translation-ai-review-run-select"
              >
                {/* Show a human-readable label for the selected run (date +
                    summary) rather than the raw run id base-ui would echo. */}
                <SelectValue>{selectedRun ? judgeRunLabel(selectedRun) : null}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max min-w-(--anchor-width) max-w-(--available-width)">
                {judgeRuns.map((run) => (
                  <SelectItem key={run.runId} value={run.runId}>
                    {judgeRunLabel(run)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Live progress for an active review (full cost/progress lives in Activity). */}
      {activeJudgeRun && (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <RunProgressCard
              run={activeJudgeRun}
              runningLabel={tr('translationAi.progressLabel')}
              hint={tr('translationAi.progressActivityNote')}
              data-testid="translation-ai-progress"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-status-fail hover:text-status-fail hover:bg-status-fail/10"
            onClick={() =>
              cancelRun(projectId, activeJudgeRun.runId).catch((err: unknown) =>
                toast.error((err as Error).message),
              )
            }
            data-testid="translation-ai-cancel-run"
          >
            <XCircle className="size-4" />
            {tr('cancel')}
          </Button>
        </div>
      )}

      {judgeRuns.length === 0 && (
        <ReviewEmptyState
          icon={Sparkles}
          title={tr('translationAi.emptyTitle')}
          hint={
            latestTranslationRun
              ? tr('translationAi.emptyHintRun', {
                  date: new Date(latestTranslationRun.startedAt).toLocaleString(),
                })
              : tr('translationAi.emptyHintNoRun')
          }
          testId="translation-ai-review-empty"
        />
      )}

      {selectedRun && (
        <div data-testid="translation-ai-review-detail">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4" />
            <h3 className="text-sm font-semibold">{t('runs.judgeDetailTitle')}</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal">
              {selectedRun.runId.slice(0, 8)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewTargetRun(reviewedSourceRun)}
                disabled={!reviewedSourceRun || judgeInFlight}
                title={reviewedSourceRun ? undefined : tr('translationAi.reReviewNoRun')}
                data-testid="translation-ai-review-re-review"
              >
                {judgeInFlight ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {tr('translationAi.reReview')}
              </Button>
              {reviewableVerdicts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAllFindingsOpen(true)}
                  data-testid="translation-ai-review-view-all"
                >
                  <ListChecks className="size-4" aria-hidden />
                  {t('runs.judgeViewAll', { count: verdictsWithSuggestions.length })}
                </Button>
              )}
            </div>
          </div>
          {selectedRun.judgeSummary && selectedRun.judgeSummary.judged > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t('runs.judgeSummary', {
                flagged: selectedRun.judgeSummary.flagged,
                judged: selectedRun.judgeSummary.judged,
                score: selectedRun.judgeSummary.averageScore ?? '—',
              })}
            </p>
          )}
          <div className="mt-3">
            <JudgeVerdictDetail
              sorted={reviewableVerdicts}
              entriesById={entriesById}
              glossaries={glossaries}
              loading={detailLoading}
              projectId={projectId}
              runId={selectedRun.runId}
              onSuggested={applySuggestedToCache}
              index={verdictIndex}
              onPrev={goPrev}
              onNext={goNext}
              keyboardEnabled={!allFindingsOpen}
            />
            <RunLogsPanel logs={logsByRun[selectedRun.runId]} loading={detailLoading} />
          </div>
        </div>
      )}

      {/* Quick-view: every verdict at once, with a one-shot "Approve all" that
          applies every listed suggestion. */}
      <Dialog open={allFindingsOpen} onOpenChange={setAllFindingsOpen}>
        <DialogContent className="max-w-3xl" data-testid="translation-ai-review-all-findings">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="size-4" aria-hidden />
              {t('runs.judgeAllFindingsTitle')}
            </DialogTitle>
            <DialogDescription>{t('runs.judgeAllFindingsDescription')}</DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {t('runs.judgeAllFindingsCount', {
                total: reviewableVerdicts.length,
                withSuggestions: verdictsWithSuggestions.length,
              })}
            </span>
            <Button
              size="sm"
              onClick={() => void approveAll()}
              disabled={approvingAll || verdictsWithSuggestions.length === 0}
              data-testid="translation-ai-review-approve-all"
            >
              {approvingAll ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {t('runs.judgeApproveAll')}
            </Button>
          </div>

          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {reviewableVerdicts.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">{t('runs.judgeDetailEmpty')}</p>
            ) : (
              <RevealList
                items={reviewableVerdicts}
                renderItem={(v) => (
                  <JudgeVerdictCard
                    key={`${v.entryId}:${v.targetLanguage}`}
                    verdict={v}
                    entry={entriesById.get(v.entryId)}
                    projectId={projectId}
                    runId={effectiveRunId ?? ''}
                    onSuggested={applySuggestedToCache}
                  />
                )}
                showMoreTestId="translation-ai-review-all-findings-show-more"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Config popup for starting a new review. Keyed on the target run (or
          'all') so the dialog's module/model overrides reset between opens. */}
      <AiReviewDialog
        key={reviewTargetRun?.runId ?? (reviewingAll ? 'all' : 'closed')}
        run={reviewTargetRun}
        open={reviewTargetRun !== undefined || reviewingAll}
        onOpenChange={(open) => {
          if (!open) {
            setReviewTargetRun(undefined);
            setReviewingAll(false);
          }
        }}
        onStart={startReview}
      />
    </div>
  );
}
