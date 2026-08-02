import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunStatus } from '@zercade-dev/narn-shared';
import { useRunStore } from '../../stores/run-store.js';
import { isTranslationRun } from '@/lib/run-kind';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL_RUNS = '__all_runs__';

/** Short, friendly label for a run: local timestamp plus a 6-char id suffix. */
function formatRunLabel(run: RunStatus): string {
  const when = new Date(run.startedAt).toLocaleString();
  const shortId = run.runId.slice(0, 6);
  return `${when} · ${shortId}`;
}

/**
 * Most recent runs, newest first, capped to `limit`. The run list is fetched
 * in full (no server-side pagination) — this keeps the dropdown from growing
 * unbounded on long-lived projects with hundreds of historical runs.
 */
export function selectRecentRuns(runs: RunStatus[], limit = 20): RunStatus[] {
  return [...runs].sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
}

interface RunFilterSelectProps {
  projectId: string | null | undefined;
  /** Selected run id, or '' for "all runs". */
  value: string;
  onChange: (runId: string) => void;
  'data-testid'?: string;
}

/**
 * Run-id filter selector shared by the strings and compare tabs. Populates its
 * options from the project's translation runs (newest first), and offers an
 * "all runs" option that clears the filter. Translate runs only — judge runs do
 * not produce translations to filter by.
 */
export function RunFilterSelect({
  projectId,
  value,
  onChange,
  'data-testid': dataTestId,
}: Readonly<RunFilterSelectProps>) {
  const { t } = useTranslation('strings');
  const runs = useRunStore((s) => s.runs);
  const fetchRuns = useRunStore((s) => s.fetchRuns);

  // Load the run list when the project changes so the selector is populated
  // even on a fresh tab open (the run store may not have been hydrated yet).
  useEffect(() => {
    if (projectId) void fetchRuns(projectId);
  }, [projectId, fetchRuns]);

  const translateRuns = useMemo(
    // Only translation runs filter the string table; the allowlist excludes
    // every non-translation kind (judge, source-review, glossary-gen,
    // category-gen) — they translated nothing. Capped to the most recent 20
    // so the dropdown stays usable on long-lived projects.
    () => selectRecentRuns(runs.filter(isTranslationRun)),
    [runs],
  );

  if (translateRuns.length === 0) return null;

  const selectedRun = value ? translateRuns.find((r) => r.runId === value) : undefined;
  const triggerLabel = value
    ? selectedRun
      ? formatRunLabel(selectedRun)
      : value.slice(0, 6)
    : t('filters.allRuns');

  return (
    <Select
      value={value === '' ? ALL_RUNS : value}
      onValueChange={(v) => onChange(v === ALL_RUNS ? '' : (v ?? ''))}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          'h-8 text-xs max-w-[320px]',
          value && 'border-primary bg-primary/10 text-primary',
        )}
        title={triggerLabel}
        data-testid={dataTestId ?? 'filter-run-id'}
      >
        <SelectValue>{triggerLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-max min-w-(--anchor-width) max-w-(--available-width)">
        <SelectItem value={ALL_RUNS} className="text-xs">
          {t('filters.allRuns')}
        </SelectItem>
        {translateRuns.map((run) => (
          <SelectItem key={run.runId} value={run.runId} className="text-xs">
            {formatRunLabel(run)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
