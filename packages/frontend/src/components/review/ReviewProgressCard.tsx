import { useTranslation } from 'react-i18next';
import { LANG_NAMES } from '@zercade-dev/narn-shared';
import { useProjectStore } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LangCodeChip } from '@/components/ui/lang-code-chip';

/**
 * Per-language review progress for the active project: reviewed vs translated
 * counts with a progress bar per active target language.
 */
export function ReviewProgressCard() {
  const { t } = useTranslation('config');
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const entries = useStringStore((s) => s.entries);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Review progress stats per reviewable target language. Computed during
  // render: this card is not a hot path and manual memoization here defeats
  // the React Compiler's own analysis.
  //
  // The language list is the union of activeProject.activeLanguages (always
  // shown, in order) plus any other language that appears in some entry's
  // translations with a counted status ('reviewed' or 'translated') — e.g.
  // the synthetic pseudo-test language, or a language deactivated after
  // accumulating translations. The manual-review queue (ReviewTab) already
  // serves every language with a translation record regardless of active
  // status, so the progress card needs to track the same scope or it visibly
  // fails to move while the queue drains. Non-active extras are appended,
  // sorted, and flagged `active: false` so the row can render an "inactive"
  // hint; sourceLanguage is excluded defensively (translations for it
  // shouldn't exist, but we now derive the list from data).
  //
  // Note: this tracks STATUS progress (reviewed vs. translated), not the review
  // queue's drain. The queue's notion of "needs review" is record.needsReview,
  // which is independent of status — a flagged record (status 'flagged', neither
  // reviewed nor translated) drops out of both this numerator and denominator.
  // The two "progress" notions can therefore legitimately disagree.
  const reviewStats = (() => {
    const sourceLanguage = activeProject?.sourceLanguage;
    const activeLangs = activeProject?.activeLanguages ?? [];
    const activeSet = new Set(activeLangs);
    const extraLangs = new Set<string>();
    for (const e of entries) {
      for (const [lang, record] of Object.entries(e.translations)) {
        if (activeSet.has(lang) || lang === sourceLanguage) continue;
        if (record?.status === 'reviewed' || record?.status === 'translated') {
          extraLangs.add(lang);
        }
      }
    }
    const langs = [
      ...activeLangs.filter((lang) => lang !== sourceLanguage),
      ...[...extraLangs].sort((a, b) => a.localeCompare(b)),
    ];
    return langs.map((lang) => {
      let reviewed = 0;
      let translated = 0;
      for (const e of entries) {
        const status = e.translations[lang]?.status;
        if (status === 'reviewed') reviewed++;
        else if (status === 'translated') translated++;
      }
      const total = reviewed + translated;
      const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
      return { lang, reviewed, total, pct, active: activeSet.has(lang) };
    });
  })();

  if (!activeProject || reviewStats.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('reviewProgress')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reviewStats.map(({ lang, reviewed, total, pct, active }) => {
          const langName = LANG_NAMES[lang] ?? lang;
          const complete = total > 0 && reviewed === total;
          return (
            <div key={lang} className="space-y-1" data-testid={`review-progress-${lang}`}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <LangCodeChip code={activeProject.sourceLanguage} />
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                  <LangCodeChip code={lang} />
                  <span className="font-medium">{langName}</span>
                  {!active && (
                    <span className="text-[11px] text-muted-foreground">
                      {t('reviewProgressInactive')}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {total === 0
                    ? t('reviewProgressNone')
                    : t('reviewProgressCount', { reviewed, total })}
                </span>
              </div>
              <progress
                value={pct}
                max={100}
                className={`h-1.5 w-full rounded-full bg-muted [appearance:none] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:rounded-full ${
                  complete
                    ? '[&::-webkit-progress-value]:bg-status-pass [&::-moz-progress-bar]:bg-status-pass'
                    : '[&::-webkit-progress-value]:bg-status-info [&::-moz-progress-bar]:bg-status-info'
                }`}
                aria-label={`${langName} review progress`}
                data-testid={`review-progress-bar-${lang}`}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
