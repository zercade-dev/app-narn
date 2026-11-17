/**
 * Glossary-to-entry match panel (the glossary's Matches tab): pick a term (or
 * "all"), filter by assigned/unassigned, and bulk-assign the selected glossary
 * to the matching project strings. Split out of GlossaryTab.tsx as a purely presentational
 * panel — it owns no state; every value and handler is prop-drilled from the
 * parent, which derives the results from its criteria, glossary and entries.
 */
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { GlossaryTerm } from '@zercade-dev/narn-shared';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { MatchResult } from './glossary-tab-types.js';

interface GlossaryMatchPanelProps {
  readonly matchResults: MatchResult[] | null;
  readonly matchTermId: string | null;
  readonly matchAssignment: 'with' | 'without';
  readonly visibleTerms: GlossaryTerm[];
  readonly selectedEntryIds: Set<string>;
  readonly assigningBusy: boolean;
  /**
   * Whether the viewer may write the assignment. Assigning or unassigning a
   * glossary PATCHes each matched entry's `assignedGlossaryIds`, which
   * `assertEntryPatchAllowed` rejects for collaborators — so the action button
   * is hidden for them while the match list itself stays readable.
   */
  readonly canAssign: boolean;
  readonly onMatchTermIdChange: (v: string | null) => void;
  readonly onMatchAssignmentChange: (v: 'with' | 'without') => void;
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
  canAssign,
  onMatchTermIdChange,
  onMatchAssignmentChange,
  onToggleAllEntriesSelected,
  onToggleEntrySelected,
  onAssignGlossary,
  onUnassignGlossary,
}: Readonly<GlossaryMatchPanelProps>) {
  const { t } = useTranslation('glossary');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="glossary-match-panel">
      {/* Criteria row */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 py-1">
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

      {/* The results scroll in their own box, like the terms. */}
      <div className="min-h-0 flex-1 overflow-auto" data-testid="glossary-match-results">
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
                {canAssign && (
                  <Button
                    size="sm"
                    // Highlighted once there is something to (un)assign.
                    variant={selectedEntryIds.size === 0 || assigningBusy ? 'outline' : 'default'}
                    className="h-6 px-2 text-[10px]"
                    disabled={selectedEntryIds.size === 0 || assigningBusy}
                    onClick={matchAssignment === 'with' ? onUnassignGlossary : onAssignGlossary}
                    data-testid="glossary-match-action-btn"
                  >
                    {matchAssignment === 'with' ? t('unassignGlossary') : t('assignGlossary')}
                  </Button>
                )}
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
      </div>
    </div>
  );
}
