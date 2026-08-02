/**
 * Glossary-to-entry match panel: pick a term (or "all"), filter by
 * assigned/unassigned, and bulk-assign the selected glossary to the matching
 * project strings. Split out of GlossaryTab.tsx as a purely presentational
 * panel — it owns no state; every value and handler is prop-drilled from the
 * parent so the debounced auto-search effect and selection resets keep their
 * original timing.
 */
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GlossaryTerm } from '@zercade-dev/narn-shared';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import type { MatchResult } from './glossary-tab-types.js';

interface GlossaryMatchPanelProps {
  readonly matchResults: MatchResult[] | null;
  readonly matchTermId: string | null;
  readonly matchAssignment: 'with' | 'without';
  readonly visibleTerms: GlossaryTerm[];
  readonly selectedEntryIds: Set<string>;
  readonly assigningBusy: boolean;
  readonly canOpenMatches: boolean;
  readonly onMatchTermIdChange: (v: string | null) => void;
  readonly onMatchAssignmentChange: (v: 'with' | 'without') => void;
  readonly onSetMainOpen: (open: boolean) => void;
  readonly onSetMatchResults: (results: MatchResult[] | null) => void;
  readonly onSearch: () => void;
  readonly onToggleAllEntriesSelected: (checked: boolean) => void;
  readonly onToggleEntrySelected: (id: string, checked: boolean) => void;
  readonly onAssignGlossary: () => void;
  readonly onUnassignGlossary: () => void;
}

export function GlossaryMatchPanel({
  matchResults,
  matchTermId,
  matchAssignment,
  visibleTerms,
  selectedEntryIds,
  assigningBusy,
  canOpenMatches,
  onMatchTermIdChange,
  onMatchAssignmentChange,
  onSetMainOpen,
  onSetMatchResults,
  onSearch,
  onToggleAllEntriesSelected,
  onToggleEntrySelected,
  onAssignGlossary,
  onUnassignGlossary,
}: Readonly<GlossaryMatchPanelProps>) {
  const { t } = useTranslation('glossary');

  return (
    <Collapsible
      open={matchResults !== null}
      onOpenChange={(open) => {
        if (open && !canOpenMatches) return;
        if (!open) onSetMatchResults(null);
        if (open) {
          onSetMainOpen(false);
          onSearch();
        }
      }}
    >
      {/* Criteria row */}
      <div className="flex items-center gap-2 py-1 flex-wrap">
        <CollapsibleTrigger>
          <div className="flex items-center gap-1 cursor-pointer">
            <ChevronRight
              className={cn('size-4 transition-transform', matchResults !== null && 'rotate-90')}
            />
            <span className="font-semibold text-sm">{t('matchesPanel')}</span>
          </div>
        </CollapsibleTrigger>

        <Select value={matchTermId ?? ''} onValueChange={(v) => onMatchTermIdChange(v)}>
          <SelectTrigger size="sm" className="h-7 text-xs w-48">
            <SelectValue placeholder={t('matchTermSelectPlaceholder')} data-content>
              {(v: string | null) => {
                if (!v) return null;
                if (v === '__all__') return t('matchTermAll');
                return visibleTerms.find((term) => term.id === v)?.source ?? v;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" label={t('matchTermAll')} className="text-xs">
              {t('matchTermAll')}
            </SelectItem>
            {visibleTerms.map((term) => (
              <SelectItem
                key={term.id}
                value={term.id}
                label={term.source}
                className="text-xs"
                data-content
              >
                {term.source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div
          className="inline-flex h-7 items-center rounded-md border border-input p-0.5 text-xs"
          role="group"
          aria-label={t('matchAssignmentLabel')}
        >
          <button
            type="button"
            aria-pressed={matchAssignment === 'without'}
            onClick={() => onMatchAssignmentChange('without')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              matchAssignment === 'without'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid="glossary-match-without-btn"
          >
            {t('matchAssignmentWithout')}
          </button>
          <button
            type="button"
            aria-pressed={matchAssignment === 'with'}
            onClick={() => onMatchAssignmentChange('with')}
            className={cn(
              'rounded px-2 py-0.5 transition-colors',
              matchAssignment === 'with'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            data-testid="glossary-match-with-btn"
          >
            {t('matchAssignmentWith')}
          </button>
        </div>
      </div>

      <CollapsibleContent>
        {matchResults !== null && matchResults.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-3">{t('matchNoResults')}</p>
        )}
        {matchResults !== null && matchResults.length > 0 && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground px-2 pb-1">
              <span>{t('matchResultsCount', { count: matchResults.length })}</span>
              <div className="flex gap-2">
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs text-muted-foreground"
                  onClick={() => {
                    const allSelected = matchResults.every((entry) =>
                      selectedEntryIds.has(entry.id),
                    );
                    onToggleAllEntriesSelected(!allSelected);
                  }}
                >
                  {matchResults.every((entry) => selectedEntryIds.has(entry.id))
                    ? t('deselectAll')
                    : t('selectAll')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[10px]"
                  disabled={selectedEntryIds.size === 0 || assigningBusy}
                  onClick={matchAssignment === 'with' ? onUnassignGlossary : onAssignGlossary}
                  data-testid="glossary-match-action-btn"
                >
                  {matchAssignment === 'with' ? t('unassignGlossary') : t('assignGlossary')}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1 px-2">
              {matchResults.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 text-xs border rounded px-2 py-1"
                >
                  <Checkbox
                    checked={selectedEntryIds.has(entry.id)}
                    onCheckedChange={(checked) => onToggleEntrySelected(entry.id, checked === true)}
                    data-testid={`glossary-match-entry-${entry.id}`}
                  />
                  <span>{entry.sourceText}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
