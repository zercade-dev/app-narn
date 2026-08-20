import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert, Check, CircleAlert, EyeOff, Loader2, Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isBlockingIssue } from '@/lib/lqa';
import { PixelIcon } from '@/components/ui/pixel-icon';
import type { LQAIssue, StringEntry, GlossarySummary } from '@zercade-dev/narn-shared';
import {
  TM_MODULE_ID,
  isAchievementSource,
  isAchievementSourceLabel,
  getSourceLabel,
} from '@zercade-dev/narn-shared';
import { Badge } from '@/components/ui/badge';
import { useStringStore } from '../../stores/string-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StringTableContextMenu } from './StringTableContextMenu.js';
import { AchievementLinkDialog } from './AchievementLinkDialog.js';

export type CellSelection =
  | { entryId: string; column: 'source' }
  | { entryId: string; column: 'translation'; language: string };

interface StringTableRowProps {
  entry: StringEntry;
  languages: string[];
  sourceColWidth: number;
  classificationColWidth: number;
  colWidth: number;
  checkboxColWidth: number;
  index: number;
  selection: CellSelection | null;
  onSelect: (selection: CellSelection) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  translatingCells?: ReadonlySet<string>;
  glossarySummaries?: GlossarySummary[];
}

function getCellColorClass(empty: boolean | undefined, isSticky: boolean): string {
  if (empty) return 'bg-muted/50 text-muted-foreground';
  if (isSticky) return 'text-foreground';
  return 'bg-transparent text-foreground';
}

interface CellProps {
  text: string;
  width: number;
  empty?: boolean;
  selected: boolean;
  onSelect: () => void;
  testId?: string;
  sticky?: { left: number; borderRight?: boolean };
  lqaIssues?: LQAIssue[];
  showLqaBadge?: boolean;
  translationStatus?: 'translated' | 'reviewed' | null;
  isTranslating?: boolean;
  /** True when the translation was auto-applied from the translation memory. */
  isTmHit?: boolean;
  /** Quality tier (1-4) of the Freeway model that served this translation; absent for non-Freeway records. */
  freewayTier?: number;
  /**
   * When true, the cell uses `width` as a flex basis/min and grows to claim the
   * spare horizontal space in the row instead of staying pinned to a fixed
   * pixel width. Used for the non-sticky per-language translation columns so a
   * wide viewport puts the extra pixels into the translation text.
   */
  grow?: boolean;
}

/**
 * A single table cell. Memoized because StringTable re-renders every visible
 * row on each selection/filter change; cells whose props are unchanged
 * (StringTableRow keeps `onSelect`, `sticky` and `lqaIssues` referentially
 * stable) can skip re-rendering entirely. Pure function of its props — no
 * closure state.
 */
export const Cell = memo(function Cell({
  text,
  width,
  empty,
  selected,
  onSelect,
  testId,
  sticky,
  lqaIssues,
  showLqaBadge,
  translationStatus,
  isTranslating,
  isTmHit,
  freewayTier,
  grow,
}: CellProps) {
  const { t } = useTranslation('strings');
  const issues = lqaIssues ?? [];
  const hasBlocking = issues.some(isBlockingIssue);
  // Warning-only results (overflow, forbidden terms, …) share the
  // amber badge; legacy data only ever reaches this branch via overflow.
  const hasWarningOnly = !hasBlocking && issues.length > 0;
  const badgeVariant: 'check' | 'error' | 'overflow' | null = showLqaBadge
    ? hasBlocking
      ? 'error'
      : hasWarningOnly
        ? 'overflow'
        : 'check'
    : null;
  return (
    <button
      type="button"
      title={empty ? undefined : text}
      className={cn(
        'relative py-1 px-3 text-sm leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap shrink-0 select-none text-left',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        getCellColorClass(empty, !!sticky),
        selected && 'ring-1 ring-ring ring-inset',
        translationStatus === 'reviewed' && !empty && 'border-l-2 border-status-pass/60',
      )}
      style={{
        ...(grow ? { flex: `1 1 ${width}px`, minWidth: width } : { width }),
        ...(sticky && {
          position: 'sticky',
          left: sticky.left,
          zIndex: 1,
          background: 'var(--row-bg)',
          ...(sticky.borderRight && {
            boxShadow: '4px 0 6px -2px oklch(0 0 0 / 0.1)',
          }),
        }),
      }}
      onClick={onSelect}
      data-testid={testId}
      data-selected={selected ? 'true' : undefined}
    >
      {empty ? '—' : <span data-content>{text}</span>}
      {typeof freewayTier === 'number' && !empty && (
        <Tooltip>
          <TooltipTrigger
            render={<span />}
            // Solid bg-background base so the badge stays legible when long
            // cell text runs underneath it, same as the LQA badge below.
            className="absolute top-0.5 left-0.5 cursor-help bg-background rounded-sm"
            data-testid="freeway-tier-badge"
          >
            <Badge
              variant="secondary"
              className="h-3.5 px-1 text-[9px] font-bold pointer-events-none"
              aria-label={t('row.freewayTier', { tier: freewayTier })}
            >
              {freewayTier}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t('row.freewayTier', { tier: freewayTier })}
          </TooltipContent>
        </Tooltip>
      )}
      {isTmHit && !empty && (
        <Tooltip>
          <TooltipTrigger
            render={<span />}
            className="absolute bottom-0.5 right-0.5 cursor-help"
            data-testid="tm-hit-badge"
          >
            <Badge
              variant="secondary"
              className="h-3.5 px-1 text-[9px] font-bold pointer-events-none"
              aria-label={t('row.tmHit')}
            >
              TM
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {t('row.tmHit')}
          </TooltipContent>
        </Tooltip>
      )}
      {isTranslating && (
        <span className="absolute inset-0 flex items-center justify-center bg-background/50">
          <PixelIcon
            name="loader-2"
            fallback={Loader2}
            className="w-3 h-3 animate-spin text-muted-foreground"
            aria-label={t('row.translating')}
          />
        </span>
      )}
      {badgeVariant && (
        <Tooltip>
          <TooltipTrigger
            render={<span />}
            // Solid bg-background base so the soft tint stays legible when
            // long cell text runs underneath the absolutely-positioned badge.
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full cursor-help bg-background"
            data-testid="lqa-issue-badge"
            data-lqa-variant={badgeVariant}
            aria-label={
              badgeVariant === 'check'
                ? t('row.lqaPassed')
                : t('row.lqaIssues', { count: issues.length })
            }
          >
            <span
              className={cn(
                'flex items-center justify-center w-full h-full rounded-full',
                badgeVariant === 'error' && 'bg-status-fail/10 text-status-fail',
                badgeVariant === 'overflow' && 'bg-status-warn/10 text-status-warn',
                badgeVariant === 'check' && 'bg-status-pass/10 text-status-pass',
              )}
            >
              {badgeVariant === 'error' && (
                <PixelIcon name="circle-alert" fallback={CircleAlert} className="size-4" />
              )}
              {badgeVariant === 'overflow' && (
                <PixelIcon name="triangle-alert" fallback={TriangleAlert} className="size-4" />
              )}
              {badgeVariant === 'check' && (
                <PixelIcon name="check" fallback={Check} className="size-4" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs" data-testid="lqa-issue-popover">
            {issues.length === 0 ? (
              <span>{t('row.lqaPassed')}</span>
            ) : (
              <ul className="space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <span
                      className={cn(
                        'font-semibold shrink-0',
                        issue.type === 'mask-mismatch'
                          ? 'text-status-warn'
                          : isBlockingIssue(issue)
                            ? 'text-status-fail'
                            : 'text-status-warn',
                      )}
                    >
                      {issue.type}:
                    </span>
                    <span data-content data-testid="lqa-issue-detail">
                      {issue.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TooltipContent>
        </Tooltip>
      )}
    </button>
  );
});

// Memoized because StringTable re-renders every visible row on each
// selection/filter change. `languages`/`glossarySummaries`/`onSelect` are kept
// referentially stable by StringTable (memoized), so rows skip re-rendering on
// parent renders that don't touch this row's props.
export const StringTableRow = memo(function StringTableRow({
  entry,
  languages,
  sourceColWidth,
  classificationColWidth,
  colWidth,
  checkboxColWidth,
  index,
  selection,
  onSelect,
  isSelected,
  onToggleSelect,
  translatingCells,
  glossarySummaries = [],
}: StringTableRowProps) {
  const isSourceSelected = selection?.entryId === entry.id && selection.column === 'source';
  const { t, i18n } = useTranslation('strings');
  const updateEntry = useStringStore((s) => s.updateEntry);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const hasMissingTranslation = languages.some((lang) => !entry.translations[lang]?.text);
  const isActiveRow = selection?.entryId === entry.id;

  // Stable references for the memoized Cell component.
  const handleSelectSource = useCallback(
    () => onSelect({ entryId: entry.id, column: 'source' }),
    [onSelect, entry.id],
  );
  const selectTranslationByLang = useMemo(
    () =>
      new Map(
        languages.map((lang) => [
          lang,
          () => onSelect({ entryId: entry.id, column: 'translation', language: lang }),
        ]),
      ),
    [languages, onSelect, entry.id],
  );
  const sourceSticky = useMemo(
    () => ({ left: checkboxColWidth + classificationColWidth, borderRight: true }),
    [checkboxColWidth, classificationColWidth],
  );
  const visibleIssuesByLang = useMemo(() => {
    const result: Record<string, LQAIssue[] | undefined> = {};
    for (const lang of languages) {
      const issues = entry.lqaResults[lang]?.issues;
      result[lang] = entry.ignoreOverflow
        ? (issues ?? []).filter((i) => i.type !== 'overflow')
        : issues;
    }
    return result;
  }, [entry, languages]);

  // True when this entry originates from an "Achievement" source (in any of the
  // reference languages) — drives both the highlighted source chip and the
  // name/description type toggle below.
  const isAchievement = useMemo(() => isAchievementSource(entry.sources), [entry.sources]);
  const [linkOpen, setLinkOpen] = useState(false);

  const handleAchievementTypeChange = async (opt: 'name' | 'description') => {
    if (!activeProjectId) return;
    // Tri-state toggle: clicking the already-active option clears the tag (null),
    // so a mistag can be undone; otherwise set the chosen type.
    const next = entry.achievementType === opt ? null : opt;
    await updateEntry(activeProjectId, entry.id, { achievementType: next });
  };

  const handleToggleIgnored = async () => {
    if (!activeProjectId) return;
    await updateEntry(activeProjectId, entry.id, { ignored: !entry.ignored });
  };

  return (
    <StringTableContextMenu entry={entry} projectId={activeProjectId ?? ''}>
      <div
        className={cn(
          'flex items-center border-b border-border',
          isActiveRow ? 'bg-primary/10' : index % 2 !== 0 ? 'bg-muted/30' : 'bg-transparent',
        )}
        style={
          {
            minHeight: 40,
            '--row-bg': isActiveRow
              ? 'color-mix(in oklch, var(--primary) 10%, var(--background))'
              : index % 2 !== 0
                ? 'color-mix(in oklch, var(--muted) 30%, var(--background))'
                : 'var(--background)',
          } as React.CSSProperties
        }
        data-testid="string-table-row"
      >
        {/* Row selection checkbox */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{
            width: checkboxColWidth,
            position: 'sticky',
            left: 0,
            zIndex: 1,
            background: 'var(--row-bg)',
            boxShadow: hasMissingTranslation ? 'inset 3px 0 0 0 rgb(251 191 36)' : undefined,
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            aria-label={t('table.selectRowAria')}
            className="cursor-pointer"
            data-testid="string-table-row-checkbox"
          />
        </div>

        {/* Combined status/meta cell: visibility + status badges + source/
            category/glossary chips, laid out on a single horizontal line that
            wraps only when the affordances genuinely overflow the column
            (e.g. achievement rows with their inline edit controls). */}
        <div
          className="py-1 px-3 shrink-0 flex flex-row items-center gap-1.5 flex-wrap overflow-hidden"
          style={{
            width: classificationColWidth,
            position: 'sticky',
            left: checkboxColWidth,
            zIndex: 1,
            background: 'var(--row-bg)',
          }}
          data-testid="string-table-classification"
        >
          {/* Ignored badge — this entry is excluded from every AI dispatch
              (translate, judge, source-review, glossary/category generation).
              Shown, never hidden: filter-entries.ts deliberately does not
              exclude ignored entries from the table — a silently vanishing
              row would read as data loss. */}
          {entry.ignored ? (
            <div className="flex items-center gap-1" data-testid="string-table-ignored-badge">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => void handleToggleIgnored()}
                      aria-label={t('row.unignoreAction')}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap cursor-pointer bg-muted text-muted-foreground ring-1 ring-border"
                    />
                  }
                >
                  <EyeOff className="size-2.5" aria-hidden />
                  {t('row.ignored')}
                </TooltipTrigger>
                <TooltipContent>{t('row.ignoredTooltip')}</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      onClick={() => void handleToggleIgnored()}
                      aria-label={t('row.ignoreAction')}
                      data-testid="string-table-ignore-action"
                      className="inline-flex items-center justify-center size-4 rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent cursor-pointer"
                    />
                  }
                >
                  <EyeOff className="size-2.5" aria-hidden />
                </TooltipTrigger>
                <TooltipContent>{t('row.ignoreAction')}</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* New badge — entry was added by the most recent CSV import (not an
              update to an existing entry). Purely informational/filterable
              (see filter-entries.ts's flaggedNewOnly and the "Clear new
              flags" bulk action); dismissed explicitly, never auto-expires. */}
          {entry.flaggedNew && (
            <div className="flex items-center gap-1" data-testid="string-table-new-badge">
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap cursor-default bg-status-info/15 text-status-info ring-1 ring-status-info/40">
                    <PixelIcon name="sparkles" fallback={Sparkles} className="size-2.5" />
                    {t('row.new')}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{t('row.newTooltip')}</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Source chips (read-only). The chip shows the source label in the
              app's UI language (en/es/fr) while the stored value keeps the exact
              imported text. Achievement-origin sources are highlighted (gold +
              trophy) so they stand out from other sources. */}
          {(entry.sources ?? []).length > 0 && (
            <div
              className="flex items-center gap-1 flex-wrap overflow-hidden"
              title={(entry.sources ?? []).map((s) => getSourceLabel(s, i18n.language)).join(', ')}
            >
              {(entry.sources ?? []).map((src) => {
                const achievement = isAchievementSourceLabel(src);
                return (
                  <Tooltip key={src}>
                    <TooltipTrigger>
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap cursor-default',
                          achievement
                            ? 'bg-type-achievement/15 text-type-achievement ring-1 ring-type-achievement/50'
                            : 'bg-status-info/15 text-status-info',
                        )}
                        data-testid={achievement ? 'string-table-achievement-source' : undefined}
                      >
                        {achievement && (
                          <PixelIcon name="trophy" fallback={Trophy} className="size-2.5" />
                        )}
                        {getSourceLabel(src, i18n.language)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {achievement
                        ? t('columns.tooltipAchievementSource')
                        : t('columns.tooltipSource')}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {/* Achievement name/description type — only for achievement-source
              entries. Tags whether this string is the achievement's name or its
              description (reserved for achievement-aware features). */}
          {isAchievement && (
            <div className="flex items-center gap-1" data-testid="achievement-type-toggle">
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                {t('achievement.label')}
              </span>
              {(['name', 'description'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => void handleAchievementTypeChange(opt)}
                  aria-pressed={entry.achievementType === opt}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full border font-medium cursor-pointer transition-colors',
                    entry.achievementType === opt
                      ? 'bg-type-achievement/20 text-type-achievement border-type-achievement/50'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-accent',
                  )}
                  data-testid={`achievement-type-${opt}`}
                >
                  {t(`achievement.${opt}`)}
                </button>
              ))}
            </div>
          )}

          {/* Achievement group link — only once the entry is tagged name/
              description. The group key itself (achievementId) is a purely
              internal field with no visible input; the Link/Linked button
              opens a searchable picker dialog so a user can (re-)link to any
              opposite-typed or untyped achievement entry, or join an existing
              group. The label reflects whether a group key is already set. */}
          {entry.achievementType && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground hover:bg-accent cursor-pointer whitespace-nowrap"
                data-testid="achievement-link-button"
              >
                {entry.achievementId ? t('achievement.linked') : t('achievement.linkButton')}
              </button>
              {linkOpen && (
                <AchievementLinkDialog
                  entry={entry}
                  activeProjectId={activeProjectId}
                  open={linkOpen}
                  onOpenChange={setLinkOpen}
                />
              )}
            </div>
          )}

          {/* Category chips (read-only display — edit via context menu) */}
          {(entry.categories ?? []).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {(entry.categories ?? []).map((cat) => (
                <Tooltip key={cat}>
                  <TooltipTrigger>
                    <span
                      className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-type-achievement/15 text-type-achievement font-medium whitespace-nowrap cursor-default"
                      data-testid={`string-table-category-chip-${cat}`}
                    >
                      {cat}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('columns.tooltipCategory')}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          {/* Glossary chips (read-only) */}
          {(entry.assignedGlossaryIds ?? []).length > 0 &&
            (() => {
              const assigned = glossarySummaries.filter((g) =>
                entry.assignedGlossaryIds?.includes(g.id),
              );
              const MAX_VISIBLE = 2;
              const visible = assigned.slice(0, MAX_VISIBLE);
              const overflow = assigned.length - MAX_VISIBLE;
              return (
                <div className="flex items-center gap-1 flex-wrap">
                  {visible.map((g) => (
                    <Tooltip key={g.id}>
                      <TooltipTrigger>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-type-dialogue/15 text-type-dialogue font-medium whitespace-nowrap cursor-default">
                          {g.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t('columns.tooltipGlossary')}</TooltipContent>
                    </Tooltip>
                  ))}
                  {overflow > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-type-dialogue/15 text-type-dialogue font-medium whitespace-nowrap cursor-default">
                      +{overflow}
                    </span>
                  )}
                </div>
              );
            })()}
        </div>

        {/* Source text */}
        <Cell
          text={entry.sourceText}
          width={sourceColWidth}
          selected={isSourceSelected}
          onSelect={handleSelectSource}
          testId="string-table-cell-source"
          sticky={sourceSticky}
        />

        {/* Full-height sticky column divider */}
        <div
          aria-hidden
          style={{
            position: 'sticky',
            left: checkboxColWidth + classificationColWidth + sourceColWidth,
            width: 0,
            alignSelf: 'stretch',
            flexShrink: 0,
            overflow: 'visible',
            zIndex: 2,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: -1,
              width: 2,
              background: 'oklch(0 0 0 / 0.2)',
            }}
          />
        </div>

        {/* Per-language translation cells */}
        {languages.map((lang) => {
          const rec = entry.translations[lang];
          const lqa = entry.lqaResults[lang];
          const isSelected =
            selection?.entryId === entry.id &&
            selection.column === 'translation' &&
            selection.language === lang;
          return (
            <Cell
              key={lang}
              text={rec?.text ?? ''}
              width={colWidth}
              empty={!rec?.text}
              selected={isSelected}
              onSelect={selectTranslationByLang.get(lang)!}
              testId={`string-table-cell-${lang}`}
              lqaIssues={visibleIssuesByLang[lang]}
              showLqaBadge={!!rec?.text && !!lqa}
              translationStatus={
                rec?.text ? (rec.status === 'reviewed' ? 'reviewed' : 'translated') : null
              }
              isTranslating={translatingCells?.has(`${entry.id}:${lang}`)}
              isTmHit={rec?.moduleId === TM_MODULE_ID}
              freewayTier={rec?.freewayTier}
              grow
            />
          );
        })}
      </div>
    </StringTableContextMenu>
  );
});
