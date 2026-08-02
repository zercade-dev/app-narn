import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  termMatchesText,
  type Glossary,
  type GlossarySummary,
  type GlossaryTerm,
  type LQAResult,
  type RunStatus,
  type StringEntry,
} from '@zercade-dev/narn-shared';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '../../hooks/use-api.js';
import { Button } from '../ui/button';
import { diffWords } from '@/lib/word-diff';
import { cn } from '@/lib/utils';

/**
 * Shared building blocks for the three review sub-tabs (manual review, source-AI
 * review, translation-AI judge) and their quality siblings. Everything here is
 * scoped to the review unit on purpose — these are not @zercade-dev/narn-shared
 * exports, just the in-unit consolidation of patterns that were copy-pasted
 * across ReviewTab / SourceAiReviewTab / TranslationAiReviewTab.
 */

/**
 * Monospace block style shared by the source / target / suggestion texts across
 * the source-review and judge detail views (formerly `SOURCE_TEXT_BLOCK` /
 * `JUDGE_TEXT_BLOCK`, byte-identical in both files).
 */
export const REVIEW_TEXT_BLOCK =
  'whitespace-pre-wrap break-words rounded-md border border-border/60 bg-muted/50 px-2 py-1.5 font-mono text-[11px] leading-relaxed';

/** A glossary term that occurs in an entry's source, with its source glossary. */
export interface GlossaryHint {
  glossaryId: string;
  glossaryName: string;
  term: GlossaryTerm;
}

/**
 * Glossary terms whose source wording occurs in `sourceText`, paired with the
 * glossary they came from. When `assignedGlossaryIds` is provided the search is
 * restricted to those glossaries (the manual / judge tabs, which only show terms
 * for the entry's assigned glossaries); when omitted every glossary is searched
 * (the source-AI tab, which has no per-entry assignment to restrict to).
 */
export function glossaryHints(
  sourceText: string,
  glossaries: Glossary[],
  assignedGlossaryIds?: readonly string[],
): GlossaryHint[] {
  const assigned = assignedGlossaryIds ? new Set(assignedGlossaryIds) : null;
  if (assigned && assigned.size === 0) return [];
  const out: GlossaryHint[] = [];
  for (const g of glossaries) {
    if (assigned && !assigned.has(g.id)) continue;
    for (const term of g.terms) {
      if (termMatchesText(term.source, sourceText)) {
        out.push({ glossaryId: g.id, glossaryName: g.name, term });
      }
    }
  }
  return out;
}

// Re-exported from the shared run-predicate module so existing review-tab
// importers keep working while there is a single source of truth.
export { isRunActive, isTranslationRun } from '@/lib/run-kind';

/** The LQA context to surface for an (entry, language): blocking issues plus
 * whether an overflow warning applies (suppressed when the entry opts out). */
export interface LqaState {
  issues: LQAResult['issues'];
  showOverflow: boolean;
  overflowRatio: number | undefined;
}

/**
 * Derive the LQA issues / overflow-warning state for an (entry, language),
 * matching the `lqa?.issues ?? []` + `Boolean(lqa?.overflow && !ignoreOverflow)`
 * logic the review/judge cards repeated inline.
 */
export function deriveLqaState(entry: StringEntry | undefined, language: string): LqaState {
  const lqa = entry?.lqaResults[language];
  return {
    issues: lqa?.issues ?? [],
    showOverflow: Boolean(lqa?.overflow && !entry?.ignoreOverflow),
    overflowRatio: lqa?.overflowRatio,
  };
}

/**
 * Compact run stamp: the short run id (first 8 chars) followed by the
 * locale-formatted start time. Shared base for the source/judge run labels.
 */
export function formatRunStamp(run: RunStatus): string {
  return `${run.runId.slice(0, 8)} · ${new Date(run.startedAt).toLocaleString()}`;
}

/**
 * A primary-action button that swaps its leading icon for a spinner while busy.
 * Consolidates the "icon → Loader2 spinner" pattern repeated across the
 * suggestion-run tabs (category generation, glossary generation, source-AI
 * review start) into one component.
 */
export function SubmitButton({
  loading,
  icon: Icon,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  loading: boolean;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Button {...props}>
      {loading ? (
        <Loader2 className="mr-1 size-4 animate-spin" />
      ) : (
        <Icon className="mr-1 size-4" />
      )}
      {children}
    </Button>
  );
}

/**
 * Fetch the project's full glossaries (summaries, then each full glossary in
 * parallel). Best-effort: the reference panels just show nothing when glossaries
 * don't exist yet. Returns the list plus a `loading` flag that flips back to
 * true (during render) whenever the project changes, so callers don't run a
 * synchronous setState inside an effect.
 */
export function useFullGlossaries(projectId: string): {
  glossaries: Glossary[];
  loading: boolean;
} {
  const [glossaries, setGlossaries] = useState<Glossary[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setLoading(true);
  }
  useEffect(() => {
    if (!projectId) return;
    let stale = false;
    void (async () => {
      try {
        const summaries = await apiRequest<GlossarySummary[]>(`/projects/${projectId}/glossaries`);
        const full = await Promise.all(
          summaries.map((s) => apiRequest<Glossary>(`/projects/${projectId}/glossaries/${s.id}`)),
        );
        if (!stale) setGlossaries(full);
      } catch {
        if (!stale) setGlossaries([]);
      } finally {
        if (!stale) setLoading(false);
      }
    })();
    return () => {
      stale = true;
    };
  }, [projectId]);
  return { glossaries, loading };
}

/** A keyboard shortcut callback keyed by `KeyboardEvent.key`. */
export type ShortcutMap = Record<string, () => void>;

/**
 * Global keyboard shortcuts for the review tabs. Ignores modifier combos and
 * keystrokes targeting form fields / contenteditable, then dispatches by
 * `e.key` to the matching callback (preventing default). `enabled` (default
 * true) gates registration so a background view can stand down while a dialog or
 * inline editor is open. The handler is re-registered whenever `keys` changes,
 * so callers should pass a memoized or stably-derived map.
 */
export function useReviewShortcuts(keys: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const action = keys[e.key];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    globalThis.addEventListener('keydown', handler);
    return () => globalThis.removeEventListener('keydown', handler);
  }, [keys, enabled]);
}

/** The arrow keys always rendered as caps, on top of any tab-specific keys. */
const ARROW_KEYS = ['↑', '↓'];

/**
 * Renders a localized keyboard hint, drawing the shortcut keys it is told about
 * (plus the ↑ / ↓ arrows) as `<kbd>` caps. Tokenizing on spaces keeps the
 * visible text identical to the translated string; deriving the cap-set from the
 * caller's `keys` avoids accidentally capping unrelated single-letter words
 * (e.g. an "a"/"à" preposition in a localized string).
 */
function KeyboardHint({
  text,
  keys = [],
  className,
  testId,
}: Readonly<{ text: string; keys?: readonly string[]; className?: string; testId?: string }>) {
  const caps = new Set([...keys, ...ARROW_KEYS]);
  const tokens = text.split(' ');
  return (
    <p
      className={cn('text-center text-[11px] text-muted-foreground', className)}
      data-testid={testId}
    >
      {tokens.map((token, i) => (
        // Tokens are positional within a fixed translated string.
        <span key={`${token}-${i}`}>
          {caps.has(token) ? (
            <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">
              {token}
            </kbd>
          ) : (
            token
          )}
          {i < tokens.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

/**
 * The side-by-side review-card shell shared by all three tabs: a bordered card
 * with the content body and a quiet keyboard-hint footer. Callers supply the
 * body (typically a `grid gap-6 md:grid-cols-2` of source vs. target plus any
 * extra sections) and the footer hint text.
 */
export function ReviewCardShell({
  children,
  hint,
  hintKeys,
  hintClassName,
  hintTestId,
  testId,
}: Readonly<{
  children: ReactNode;
  hint: string;
  hintKeys?: readonly string[];
  hintClassName?: string;
  hintTestId?: string;
  testId?: string;
}>) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm" data-testid={testId}>
      <div className="space-y-4 p-4">{children}</div>
      {/* Quiet footer: keyboard shortcuts as key caps. */}
      <div className="border-t border-border px-4 py-2.5">
        <KeyboardHint text={hint} keys={hintKeys} className={hintClassName} testId={hintTestId} />
      </div>
    </div>
  );
}

/**
 * Compact "added / removed" key for the word-diff colors, so the green/red
 * segments are self-explanatory the first time a reviewer sees them. Uses the
 * same tint recipe as the diff itself.
 */
export function DiffLegend() {
  const { t } = useTranslation('review');
  return (
    <span
      className="flex items-center gap-2 text-[11px] text-muted-foreground"
      data-testid="review-diff-legend"
    >
      <span className="flex items-center gap-1">
        <span className="rounded-sm bg-status-pass/15 px-1 text-status-pass">
          {t('diffLegendAdded')}
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span className="rounded-sm bg-status-fail/15 px-1 text-status-fail line-through">
          {t('diffLegendRemoved')}
        </span>
      </span>
    </span>
  );
}

/**
 * The LQA-issue `<section>` shared by the manual review card, its View-all row,
 * and the judge context panel: a heading over a `<ul>` of blocking issues plus
 * an optional amber overflow-warning line. Renders nothing when there is no
 * issue and no overflow warning to show. The heading element/size and the list
 * text size vary per call site, so they are props; the `<li>` markup is fixed.
 */
export function LqaIssueList({
  issues,
  showOverflow,
  overflowRatio,
  headingClassName,
  listClassName = 'space-y-1 text-xs',
  headingTag: HeadingTag = 'h3',
  testId,
}: Readonly<{
  issues: LQAResult['issues'];
  showOverflow: boolean;
  overflowRatio: number | undefined;
  /** Size token appended to the shared heading classes (e.g. `text-xs`). */
  headingClassName: string;
  /** Defaults to the manual review card's `space-y-1 text-xs`. */
  listClassName?: string;
  headingTag?: 'h3' | 'h4';
  testId: string;
}>) {
  const { t } = useTranslation('review');
  if (issues.length === 0 && !showOverflow) return null;
  return (
    <section data-testid={testId}>
      <HeadingTag
        className={cn(
          'mb-1 font-medium uppercase tracking-wide text-muted-foreground',
          headingClassName,
        )}
      >
        {t('lqaTitle')}
      </HeadingTag>
      <ul className={listClassName}>
        {issues.map((issue) => (
          <li key={`${issue.type}-${issue.detail}`} className="text-status-fail">
            <span className="font-medium">{issue.type}</span> — {issue.detail}
          </li>
        ))}
        {showOverflow && (
          <li className="text-status-warn">
            {t('overflowIssue', { ratio: overflowRatio?.toFixed(2) })}
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * The glossary-term `<ul>` shared by the manual review card and the judge
 * context panel (and a source-only variant for the source-AI tab): each term's
 * source wording, an optional `→ target` for the given language, a "constant"
 * chip, and the glossary name. When `targetLanguage` is omitted the rows render
 * source-only (no arrow / target), as the source-AI tab shows them.
 */
export function GlossaryHintList({
  hints,
  targetLanguage,
  className = 'space-y-1 text-xs',
  itemTestId,
}: Readonly<{
  hints: GlossaryHint[];
  targetLanguage?: string;
  className?: string;
  itemTestId?: string;
}>) {
  const { t } = useTranslation('review');
  return (
    <ul className={className}>
      {hints.map(({ glossaryId, glossaryName, term }) => {
        const target = targetLanguage !== undefined ? term.translations[targetLanguage] : undefined;
        return (
          <li
            key={`${glossaryId}-${term.id}`}
            className="flex flex-wrap items-baseline gap-1.5"
            data-testid={itemTestId}
          >
            <span className="font-medium">{term.source}</span>
            {targetLanguage !== undefined && (
              <>
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
                {target ? (
                  <span>{target}</span>
                ) : (
                  <span className="italic text-muted-foreground">{t('glossaryNoTarget')}</span>
                )}
              </>
            )}
            {term.constant && (
              <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                {t('glossaryConstant')}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">· {glossaryName}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The centered dashed-border empty state shared by the AI-review tabs: an icon
 * over a bold title and a muted hint. Only the icon, copy, and test id differ
 * per tab.
 */
export function ReviewEmptyState({
  icon: Icon,
  title,
  hint,
  testId,
}: Readonly<{
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  hint: ReactNode;
  testId: string;
}>) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 py-12 text-center"
      data-testid={testId}
    >
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Character count past which an AI explanation (judge issue detail, source-review
 * finding detail) is offered with a "show more" toggle. Below it the text is
 * short enough to always render in full; the server no longer truncates it, so a
 * long explanation that would otherwise dominate the card stays collapsed until
 * the reviewer expands it. The text is never hidden — collapsed is a line-clamp,
 * not a cut.
 */
export const AI_DETAIL_EXPAND_THRESHOLD = 280;

/**
 * Renders a possibly-long AI explanation: in full when short, and behind a
 * "Show more"/"Show less" toggle (a line-clamp, never a truncation) when it runs
 * past {@link AI_DETAIL_EXPAND_THRESHOLD}. Shared by the judge issue detail and
 * the source-review finding detail so both honor the now-uncapped server text
 * without a wall of prose. `className` styles the text element; the toggle sits
 * just below it. Whitespace is preserved (`whitespace-pre-wrap break-words`).
 */
export function ExpandableText({
  text,
  className,
  clampLines = 4,
  testId,
}: Readonly<{
  text: string;
  className?: string;
  /** Lines shown while collapsed (Tailwind line-clamp-{n}). */
  clampLines?: 3 | 4 | 5 | 6;
  testId?: string;
}>) {
  const { t } = useTranslation('review');
  const [expanded, setExpanded] = useState(false);
  const expandable = text.length > AI_DETAIL_EXPAND_THRESHOLD;
  // Map the few supported clamp depths to literal class names so Tailwind's
  // content scan keeps them (a `line-clamp-${n}` template would be purged).
  const clampClass =
    clampLines === 3
      ? 'line-clamp-3'
      : clampLines === 5
        ? 'line-clamp-5'
        : clampLines === 6
          ? 'line-clamp-6'
          : 'line-clamp-4';
  return (
    <span data-testid={testId}>
      <span
        className={cn(
          'whitespace-pre-wrap break-words',
          expandable && !expanded && clampClass,
          className,
        )}
        data-testid={testId ? `${testId}-text` : undefined}
      >
        {text}
      </span>
      {expandable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-1 inline font-medium text-primary underline-offset-2 hover:underline"
          aria-expanded={expanded}
          data-testid={testId ? `${testId}-toggle` : undefined}
        >
          {expanded ? t('aiDetailExpandLess') : t('aiDetailExpandMore')}
        </button>
      )}
    </span>
  );
}

/**
 * Rows revealed per page in the review "view all / all findings" dialogs. The
 * first page renders on open; each "Show more" click reveals another page. This
 * bounds the up-front work (notably the per-row word-diffs the rows compute) so
 * opening the dialog on a large project stays responsive instead of computing
 * every row at once.
 */
export const REVIEW_REVEAL_PAGE_SIZE = 25;

/**
 * Renders a list one page at a time behind a "Show more" button, so the
 * dialogs' expensive per-row work (word-diffs, LQA derivations) only runs for
 * the rows actually shown. All rows remain reachable — "Show more" reveals the
 * next {@link REVIEW_REVEAL_PAGE_SIZE}; no data is dropped. `renderItem` must
 * return a keyed element. The visible-count state resets whenever the component
 * remounts, which the dialogs get for free (their content unmounts on close),
 * so each fresh open starts bounded again.
 */
export function RevealList<T>({
  items,
  renderItem,
  pageSize = REVIEW_REVEAL_PAGE_SIZE,
  showMoreTestId = 'review-reveal-show-more',
}: Readonly<{
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  pageSize?: number;
  showMoreTestId?: string;
}>) {
  const { t } = useTranslation('review');
  const [visibleCount, setVisibleCount] = useState(pageSize);
  // Slicing from 0 keeps each item's absolute index (callers key off it).
  const visible = visibleCount >= items.length ? items : items.slice(0, visibleCount);
  const remaining = items.length - visible.length;
  return (
    <>
      {visible.map((item, i) => renderItem(item, i))}
      {remaining > 0 && (
        <div className="flex justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + pageSize)}
            data-testid={showMoreTestId}
          >
            {t('revealShowMore', { count: remaining })}
          </Button>
        </div>
      )}
    </>
  );
}

/** Inline word-level diff between the previous version and the current text. */
export function DiffText({
  oldText,
  newText,
  className,
  testId,
}: Readonly<{ oldText: string; newText: string; className?: string; testId?: string }>) {
  const segments = useMemo(() => diffWords(oldText, newText), [oldText, newText]);
  return (
    <p
      className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed', className)}
      data-testid={testId}
    >
      {segments.map((seg, i) => (
        <span
          // Segments are positional and fully re-derived whenever either text changes.
          key={`${seg.type}-${i}`}
          className={cn(
            seg.type === 'added' && 'bg-status-pass/10 text-status-pass rounded-sm px-0.5',
            seg.type === 'removed' &&
              'bg-status-fail/10 text-status-fail line-through rounded-sm px-0.5',
          )}
        >
          {seg.text}
        </span>
      ))}
    </p>
  );
}
