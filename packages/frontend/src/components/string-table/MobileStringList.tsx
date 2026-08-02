import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { filterEntries } from '../../lib/filter-entries.js';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 25;

/**
 * Read-only mobile presentation of the Translations tab: stacked entry cards
 * (id, source text, per-language translations) with search, an
 * untranslated-only toggle and a minimal pager. Shares useStringStore with
 * the desktop StringTable (same filters object, same fetch); deliberately
 * renders NO editing affordances — mobile is read-only by design
 * (lib/mobile-gating.ts).
 *
 * `StringEntry` has no separate human-readable "key" field — StringTableRow
 * uses `entry.id` as the row identifier (selection, data-testid, etc.), but
 * it is never rendered as visible text (it's a 64-char SHA-256 hash).
 */
export function MobileStringList() {
  const { t } = useTranslation('strings');
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.projects.find((p) => p.id === s.activeProjectId));
  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const allEntries = useStringStore((s) => s.entries);
  const filters = useStringStore((s) => s.filters);
  const setFilter = useStringStore((s) => s.setFilter);
  const loading = useStringStore((s) => s.loading);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (activeProjectId) fetchEntries(activeProjectId);
  }, [activeProjectId, fetchEntries]);

  const entries = useMemo(() => filterEntries(allEntries, filters), [allEntries, filters]);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = entries.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const targetLanguages = (activeProject?.activeLanguages ?? []).filter(
    (lang) => lang !== activeProject?.sourceLanguage,
  );

  return (
    <div className="space-y-3" data-testid="mobile-string-list">
      <Input
        value={filters.search}
        placeholder={t('mobile.searchPlaceholder')}
        onChange={(e) => {
          setFilter({ search: e.target.value });
          setPage(1);
        }}
        data-testid="mobile-string-search"
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={filters.untranslatedOnly}
          onChange={(e) => {
            setFilter({ untranslatedOnly: e.target.checked });
            setPage(1);
          }}
          data-testid="mobile-string-untranslated-toggle"
        />
        {t('mobile.untranslatedOnly')}
      </label>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        pageEntries.map((entry) => (
          <Card
            key={entry.id}
            className="space-y-1.5 p-3"
            data-testid={`mobile-string-card-${entry.id}`}
          >
            <p className="text-sm">{entry.sourceText}</p>
            {targetLanguages.map((lang) => {
              const rec = entry.translations[lang];
              return (
                <div key={lang} className="flex gap-2 text-sm">
                  <span className="w-8 shrink-0 text-xs font-medium uppercase text-muted-foreground">
                    {lang}
                  </span>
                  <span className={rec?.text ? '' : 'italic text-muted-foreground'}>
                    {rec?.text || t('mobile.untranslated')}
                  </span>
                </div>
              );
            })}
          </Card>
        ))
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Button
          variant="outline"
          size="sm"
          disabled={safePage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          data-testid="mobile-string-prev"
        >
          ‹
        </Button>
        <span>
          {safePage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          data-testid="mobile-string-next"
        >
          ›
        </Button>
      </div>
    </div>
  );
}
