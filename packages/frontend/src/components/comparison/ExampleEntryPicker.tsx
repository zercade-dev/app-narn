/**
 * ExampleEntryPicker — search-and-pick UI for the Translate dialog's
 * "example entries" option (translate-with-examples). The parent owns the
 * picked-id state; this component renders the chips (with per-language
 * coverage badges), a search input, and a top-N result list. Candidates are
 * pre-filtered by the caller to translated, non-selected entries.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface ExampleCandidate {
  id: string;
  sourceText: string;
  /** Subset of the run's target languages this entry can demonstrate. */
  translatedLanguages: string[];
}

/** Max search results rendered at once (candidates can be tens of thousands). */
const MAX_RESULTS = 20;

interface ExampleEntryPickerProps {
  readonly candidates: ReadonlyArray<ExampleCandidate>;
  readonly pickedIds: readonly string[];
  readonly onChange: (ids: string[]) => void;
  readonly max: number;
}

export function ExampleEntryPicker({
  candidates,
  pickedIds,
  onChange,
  max,
}: Readonly<ExampleEntryPickerProps>) {
  const { t } = useTranslation('strings');
  const [search, setSearch] = useState('');

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const picked = pickedIds
    .map((id) => byId.get(id))
    .filter((c): c is ExampleCandidate => Boolean(c));
  const atCap = pickedIds.length >= max;

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const pickedSet = new Set(pickedIds);
    const out: ExampleCandidate[] = [];
    for (const c of candidates) {
      if (pickedSet.has(c.id)) continue;
      if (!c.sourceText.toLowerCase().includes(q)) continue;
      out.push(c);
      if (out.length >= MAX_RESULTS) break;
    }
    return out;
  }, [search, candidates, pickedIds]);

  return (
    <div className="space-y-1.5" data-testid="translate-examples-section">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{t('compare.translateExamplesLabel')}</span>
        <span className="text-xs text-muted-foreground" data-testid="translate-examples-count">
          {t('compare.translateExamplesCount', { count: pickedIds.length, max })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('compare.translateExamplesHint')}</p>
      {picked.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((c) => (
            <span
              key={c.id}
              className="flex max-w-64 flex-col gap-1 rounded-md border bg-muted px-1.5 py-1 text-xs"
              data-testid={`translate-examples-chip-${c.id}`}
            >
              <span className="flex items-start gap-1">
                <span className="min-w-0 flex-1 truncate">{c.sourceText}</span>
                <button
                  type="button"
                  aria-label={t('compare.translateExamplesRemove')}
                  className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  onClick={() => onChange(pickedIds.filter((id) => id !== c.id))}
                  data-testid={`translate-examples-remove-${c.id}`}
                >
                  <X className="size-3" />
                </button>
              </span>
              <span className="flex flex-wrap gap-1">
                {c.translatedLanguages.map((lang) => (
                  <Badge key={lang} variant="secondary" className="px-1 py-0 text-[10px]">
                    {lang}
                  </Badge>
                ))}
              </span>
            </span>
          ))}
        </div>
      )}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('compare.translateExamplesSearchPlaceholder')}
        disabled={atCap}
        data-testid="translate-examples-search"
      />
      {search.trim() !== '' && !atCap && (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {results.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              {t('compare.translateExamplesNoMatches')}
            </p>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full cursor-pointer flex-col gap-1 px-2 py-1.5 text-left text-xs hover:bg-accent"
                onClick={() => {
                  onChange([...pickedIds, c.id]);
                  setSearch('');
                }}
                data-testid={`translate-examples-option-${c.id}`}
              >
                <span className="w-full truncate" data-content>
                  {c.sourceText}
                </span>
                <span className="flex flex-wrap gap-1">
                  {c.translatedLanguages.map((lang) => (
                    <Badge key={lang} variant="secondary" className="px-1 py-0 text-[10px]">
                      {lang}
                    </Badge>
                  ))}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
