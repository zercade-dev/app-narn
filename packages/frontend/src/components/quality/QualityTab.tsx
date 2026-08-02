import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSourceLabel } from '@zercade-dev/narn-shared';
import { apiRequest } from '../../hooks/use-api.js';
import { DEFAULT_STRING_FILTERS, useStringStore } from '../../stores/string-store.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { cn } from '@/lib/utils';
import {
  formatPercent,
  passRateBarClass,
  passRateTextClass,
  topIssuesWithOther,
} from './charts/chart-utils.js';
import { PassRateDonut } from './charts/PassRateDonut.js';
import { HBarList } from './charts/HBarList.js';
import { IssueHeatmap } from './charts/IssueHeatmap.js';

export interface LqaGroupSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  /** Issue counts keyed by the opaque issue-type id. */
  issues: Record<string, number>;
}

export interface LqaSummary {
  totalEntries: number;
  totalResults: number;
  overall: LqaGroupSummary;
  byLanguage: Record<string, LqaGroupSummary>;
  bySource: Record<string, LqaGroupSummary>;
  byModule: Record<string, LqaGroupSummary>;
}

interface QualityTabProps {
  readonly projectId: string;
  /** Switches the app shell to the strings tab after a drill-down filter is applied. */
  readonly onNavigateToStrings: () => void;
}

/** Sorted union of all issue-type keys across a set of groups. */
function collectIssueTypes(groups: Record<string, LqaGroupSummary>): string[] {
  const types = new Set<string>();
  for (const group of Object.values(groups)) {
    for (const type of Object.keys(group.issues)) types.add(type);
  }
  return [...types].sort((a, b) => a.localeCompare(b));
}

export function QualityTab({ projectId, onNavigateToStrings }: QualityTabProps) {
  const { t, i18n } = useTranslation('quality');
  const setFilter = useStringStore((s) => s.setFilter);
  const [summary, setSummary] = useState<LqaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset fetch state during render when the project changes (the effect
  // below re-fetches); avoids a synchronous setState inside the effect.
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setSummary(null);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let stale = false;
    apiRequest<LqaSummary>(`/projects/${projectId}/lqa-summary`)
      .then((result) => {
        if (!stale) setSummary(result);
      })
      .catch((err: unknown) => {
        if (!stale) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [projectId]);

  const drillDown = (patch: { visibleLanguages?: string[]; sources?: string[] }) => {
    // Full reset: leftover filters (search, status toggles, categories…) must
    // not AND with the drill-down and hide every row. activeLanguages is
    // synced from the project, not a user filter — carry it over.
    const { activeLanguages } = useStringStore.getState().filters;
    setFilter({
      ...DEFAULT_STRING_FILTERS,
      activeLanguages,
      untranslatedOnly: false,
      lqaFailed: true,
      ...patch,
    });
    onNavigateToStrings();
  };

  const checkLabel = (type: string) => t(`checkLabels.${type}`, { defaultValue: type });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('title')}</h2>

      {!loading && !error && summary && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
          data-testid="quality-color-legend"
        >
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-sm', passRateBarClass(1))}
            />
            {t('legend.tierHigh')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-sm', passRateBarClass(0.8))}
            />
            {t('legend.tierMid')}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-sm', passRateBarClass(0))}
            />
            {t('legend.tierLow')}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-status-pass" />
            {t('legend.passed')}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm bg-status-fail" />
            {t('legend.failed')}
          </span>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {!loading && error && (
        <p className="text-sm text-destructive" data-testid="quality-error">
          {t('error', { message: error })}
        </p>
      )}

      {!loading && !error && summary && (
        <>
          <Card>
            <CardContent
              className="flex flex-wrap items-center gap-6 pt-6"
              data-testid="quality-overview"
            >
              <PassRateDonut
                passRate={summary.overall.passRate}
                passed={summary.overall.passed}
                failed={summary.overall.failed}
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('overallStat.passRateLabel')}
                </span>
                <span
                  data-testid="quality-hero-passrate"
                  className={cn(
                    'text-4xl leading-tight font-bold tabular-nums',
                    passRateTextClass(summary.overall.passRate),
                  )}
                >
                  {formatPercent(summary.overall.passRate)}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {t('overallStat.results', { count: summary.totalResults })} ·{' '}
                  {t('overallStat.entries', { count: summary.totalEntries })}
                </span>
              </div>
              {/* Swatches live once, globally, in the color legend under the tab title —
                  these are just the counts as plain text (see quality-color-legend). */}
              <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                <span>{t('overallStat.legendPassed', { count: summary.overall.passed })}</span>
                <span>{t('overallStat.legendFailed', { count: summary.overall.failed })}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('mostCommonIssues.title')}</CardTitle>
              <CardDescription>{t('mostCommonIssues.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const entries = topIssuesWithOther(summary.overall.issues, 8);
                if (entries.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground" data-testid="quality-empty-issues">
                      {t('empty')}
                    </p>
                  );
                }
                const max = entries[0].count;
                return (
                  <HBarList
                    testIdPrefix="quality-issue-freq"
                    valueFormat={(n) => n.toLocaleString()}
                    items={entries.map((entry) => {
                      const label = entry.isOther ? t('other') : checkLabel(entry.key);
                      return {
                        key: entry.key,
                        label,
                        value: entry.count,
                        max,
                        color: 'bg-status-info',
                        hover: `${label}: ${entry.count.toLocaleString()}`,
                      };
                    })}
                  />
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('byLanguage.title')}</CardTitle>
              <CardDescription>{t('byLanguage.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(summary.byLanguage).length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="quality-empty-bylanguage">
                  {t('empty')}
                </p>
              ) : (
                <IssueHeatmap
                  testIdPrefix="quality-lang-cell"
                  groups={summary.byLanguage}
                  issueTypes={collectIssueTypes(summary.byLanguage)}
                  checkLabel={checkLabel}
                  onRowClick={(lang) => drillDown({ visibleLanguages: [lang] })}
                  passRateColumn
                  passRateColumnLabel={t('columns.passRate')}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('bySource.title')}</CardTitle>
              <CardDescription>{t('bySource.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.keys(summary.bySource).length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="quality-empty-bysource">
                  {t('empty')}
                </p>
              ) : (
                <IssueHeatmap
                  testIdPrefix="quality-source-cell"
                  groups={summary.bySource}
                  issueTypes={collectIssueTypes(summary.bySource)}
                  checkLabel={checkLabel}
                  rowLabel={(source) => getSourceLabel(source, i18n.language)}
                  onRowClick={(source) => drillDown({ sources: [source] })}
                  passRateColumn
                  passRateColumnLabel={t('columns.passRate')}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('byModule.title')}</CardTitle>
              <CardDescription>{t('byModule.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* No onRowClick: there is no module filter dimension in the string
                  table to drill into, so a clickable row would be a misleading
                  affordance (same generic lqaFailed filter for every module). */}
              {Object.keys(summary.byModule).length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="quality-empty-bymodule">
                  {t('empty')}
                </p>
              ) : (
                <IssueHeatmap
                  testIdPrefix="quality-module-cell"
                  groups={summary.byModule}
                  issueTypes={collectIssueTypes(summary.byModule)}
                  checkLabel={checkLabel}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
