import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSourceLabel, type GlossarySummary } from '@zercade-dev/narn-shared';
import { toast } from '@/lib/toast';
import { cn, errorMessage } from '@/lib/utils';
import { useStringStore } from '../../stores/string-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { RunFilterSelect } from './RunFilterSelect.js';
import {
  DEFAULT_FILTERS,
  getLangName,
  sortByRegistry,
  useOutsideClick,
} from './string-table-helpers.js';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export function StringTableFilters() {
  const { t, i18n } = useTranslation('strings');
  const lang = i18n.language;
  const filters = useStringStore((s) => s.filters);
  const setFilter = useStringStore((s) => s.setFilter);
  const entries = useStringStore((s) => s.entries);
  const bulkUpdate = useStringStore((s) => s.bulkUpdate);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  // Every entry currently flagged new by the last CSV import, regardless of
  // the active filters — the "Clear new flags" action below dismisses ALL of
  // these (the "or to all currently-flagged entries" scope), not just the
  // ones the current filter happens to be showing.
  const flaggedNewIds = useMemo(
    () => entries.filter((e) => e.flaggedNew === true).map((e) => e.id),
    [entries],
  );

  const handleClearAllNewFlags = async () => {
    if (!activeProjectId || flaggedNewIds.length === 0) return;
    try {
      await bulkUpdate(activeProjectId, flaggedNewIds, { flaggedNew: false });
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.applyFailed')));
    }
  };

  const missingCount = useMemo(() => {
    const langs = filters.activeLanguages;
    if (langs.length === 0) return 0;
    return entries.filter((e) => {
      if (e.needsTranslation === false) return false;
      return langs.some((lang) => {
        const rec = e.translations[lang];
        return !rec || (rec.status !== 'translated' && rec.status !== 'reviewed');
      });
    }).length;
  }, [entries, filters.activeLanguages]);

  const availableSources = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (!entry.needsTranslation) continue;
      for (const src of entry.sources ?? []) set.add(src);
    }
    // Keep raw labels (used for filtering); order by their display form.
    return Array.from(set).sort((a, b) =>
      getSourceLabel(a, lang).localeCompare(getSourceLabel(b, lang)),
    );
  }, [entries, lang]);

  const availableTones = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (!entry.needsTranslation) continue;
      if (entry.metadata?.tone) set.add(entry.metadata.tone);
    }
    return Array.from(set).sort();
  }, [entries]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const colPickerRef = useRef<HTMLDivElement>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const categoryPickerRef = useRef<HTMLDivElement>(null);
  const [glossaryPickerOpen, setGlossaryPickerOpen] = useState(false);
  const glossaryPickerRef = useRef<HTMLDivElement>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const statusPickerRef = useRef<HTMLDivElement>(null);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const sourcePickerRef = useRef<HTMLDivElement>(null);
  const [tonePickerOpen, setTonePickerOpen] = useState(false);
  const tonePickerRef = useRef<HTMLDivElement>(null);

  // Fetch project categories whenever the active project changes. Categories
  // only change on explicit category edits, not on translation/run updates, so
  // this deliberately does not depend on `entries` (which would refire the
  // request on every entry mutation). The fetcher returns [] for no project and
  // resolves [] on failure (matching the prior cancelled-flag effect, which also
  // fell back to [] on error); useAsyncData drops any superseded response.
  const { data: availableCategories } = useAsyncData<string[]>(
    async (signal) => {
      if (!activeProjectId) return [];
      try {
        return await apiRequest<string[]>(`/projects/${activeProjectId}/categories`, { signal });
      } catch {
        return [];
      }
    },
    [activeProjectId],
    { initial: [] },
  );

  // Fetch project glossaries whenever the active project changes. Mirrors the
  // availableCategories fetch above exactly (same activeProjectId-only dep,
  // same swallow-to-[] error handling); useAsyncData drops any superseded
  // response.
  const { data: availableGlossaries } = useAsyncData<GlossarySummary[]>(
    async (signal) => {
      if (!activeProjectId) return [];
      try {
        return await apiRequest<GlossarySummary[]>(`/projects/${activeProjectId}/glossaries`, {
          signal,
        });
      } catch {
        return [];
      }
    },
    [activeProjectId],
    { initial: [] },
  );

  // Global shortcut: / or Ctrl+F focuses the search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const isEditable =
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
      if (isEditable) return;
      const isSlash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey;
      const isCtrlF = (e.ctrlKey || e.metaKey) && e.key === 'f';
      if (isSlash || isCtrlF) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close pickers on outside click.
  const closeColPicker = useCallback(() => setColPickerOpen(false), []);
  const closeCategoryPicker = useCallback(() => setCategoryPickerOpen(false), []);
  const closeGlossaryPicker = useCallback(() => setGlossaryPickerOpen(false), []);
  const closeStatusPicker = useCallback(() => setStatusPickerOpen(false), []);
  const closeSourcePicker = useCallback(() => setSourcePickerOpen(false), []);
  const closeTonePicker = useCallback(() => setTonePickerOpen(false), []);
  useOutsideClick(colPickerRef, colPickerOpen, closeColPicker);
  useOutsideClick(categoryPickerRef, categoryPickerOpen, closeCategoryPicker);
  useOutsideClick(glossaryPickerRef, glossaryPickerOpen, closeGlossaryPicker);
  useOutsideClick(statusPickerRef, statusPickerOpen, closeStatusPicker);
  useOutsideClick(sourcePickerRef, sourcePickerOpen, closeSourcePicker);
  useOutsideClick(tonePickerRef, tonePickerOpen, closeTonePicker);

  const activeLanguages = filters.activeLanguages;
  const sortedActiveLanguages = sortByRegistry(activeLanguages);
  const visibleCount =
    filters.visibleLanguages.length === 0
      ? activeLanguages.length
      : filters.visibleLanguages.length;
  const activeStatusFilterCount = [
    filters.untranslatedOnly,
    filters.lqaFailed,
    filters.overflowOnly,
    filters.tooLong,
    filters.needsReview,
    filters.sameAsSource,
    filters.placeholderMismatch,
    filters.flaggedNewOnly,
  ].filter(Boolean).length;

  // Show reset button when any non-default filter is active
  const hasActiveFilters =
    filters.search !== '' ||
    filters.sources.length > 0 ||
    filters.categories.length > 0 ||
    filters.glossaryIds.length > 0 ||
    filters.tones.length > 0 ||
    filters.visibleLanguages.length > 0 ||
    Boolean(filters.runId) ||
    filters.untranslatedOnly ||
    filters.overflowOnly ||
    filters.tooLong ||
    filters.lqaFailed ||
    filters.needsReview ||
    filters.sameAsSource ||
    filters.placeholderMismatch ||
    filters.flaggedNewOnly ||
    filters.filterMode !== 'AND';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilter({ search: value });
    }, 200);
  };

  const handleClearFilters = () => {
    setFilter(DEFAULT_FILTERS);
    if (searchRef.current) {
      searchRef.current.value = '';
    }
  };

  const handleCategoryToggle = (category: string, checked: boolean) => {
    const next = checked
      ? [...filters.categories, category]
      : filters.categories.filter((c) => c !== category);
    setFilter({ categories: next });
  };

  const handleToneToggle = (tone: string, checked: boolean) => {
    const next = checked ? [...filters.tones, tone] : filters.tones.filter((t) => t !== tone);
    setFilter({ tones: next });
  };

  const handleGlossaryToggle = (glossaryId: string, checked: boolean) => {
    const next = checked
      ? [...filters.glossaryIds, glossaryId]
      : filters.glossaryIds.filter((g) => g !== glossaryId);
    setFilter({ glossaryIds: next });
  };

  const handleColToggle = (lang: string, checked: boolean) => {
    const current =
      filters.visibleLanguages.length === 0 ? [...activeLanguages] : [...filters.visibleLanguages];
    const updated = checked ? [...current, lang] : current.filter((c) => c !== lang);
    setFilter({
      visibleLanguages: updated.length === activeLanguages.length ? [] : updated,
    });
  };

  const handleColToggleAll = (checked: boolean) => {
    setFilter({ visibleLanguages: checked ? [] : activeLanguages.slice(0, 1) });
  };

  return (
    <div
      className="flex flex-wrap gap-x-2 gap-y-2 items-center mb-3 px-3 py-2 bg-muted/50 rounded-md border text-sm"
      data-testid="string-table-filters"
    >
      {/* Find — allowed to shrink (min-w) so the toolbar reclaims horizontal
          space at ≤1440px and the trailing controls don't orphan onto a new row. */}
      <div className="flex items-center gap-1.5 flex-1 min-w-[8rem] max-w-[13rem]">
        <Input
          ref={searchRef}
          type="search"
          placeholder={t('filters.searchPlaceholder')}
          defaultValue={filters.search}
          onChange={handleSearchChange}
          className="h-7 w-full text-xs"
          data-testid="filter-source-text"
        />
      </div>

      {/* Divider: find vs. filter */}
      <div aria-hidden className="self-stretch w-px bg-border/70 mx-0.5" />

      {/* Global AND/OR toggle across all active filter dimensions */}
      <div className="flex items-center gap-1 text-xs" data-testid="filter-mode-toggle">
        <span className="text-muted-foreground">{t('filters.matchMode')}</span>
        <div className="flex border rounded overflow-hidden">
          <button
            type="button"
            className={cn(
              'px-2 h-7 cursor-pointer',
              filters.filterMode === 'AND'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'bg-background hover:bg-accent',
            )}
            aria-pressed={filters.filterMode === 'AND'}
            onClick={() => setFilter({ filterMode: 'AND' })}
            data-testid="filter-mode-and"
          >
            {t('filters.matchAll')}
          </button>
          <button
            type="button"
            className={cn(
              'px-2 h-7 cursor-pointer border-l',
              filters.filterMode === 'OR'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'bg-background hover:bg-accent',
            )}
            aria-pressed={filters.filterMode === 'OR'}
            onClick={() => setFilter({ filterMode: 'OR' })}
            data-testid="filter-mode-or"
          >
            {t('filters.matchAny')}
          </button>
        </div>
      </div>

      {/* Filter-dimension controls, grouped so they wrap together as a coherent
          block at ≤1440px instead of a single control orphaning onto a new row. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 min-w-0">
        {/* Status filter dropdown */}
        <div className="relative" ref={statusPickerRef}>
          <button
            type="button"
            className={`flex items-center gap-1 text-xs border rounded px-2 h-7 cursor-pointer ${
              activeStatusFilterCount > 0
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-background hover:bg-accent'
            }`}
            onClick={() => setStatusPickerOpen((o) => !o)}
            data-testid="status-filter-trigger"
          >
            {t('filters.status')}{' '}
            <span className="text-muted-foreground">
              {activeStatusFilterCount === 0
                ? t('filters.allStatuses')
                : `${activeStatusFilterCount} selected`}
            </span>
            <span className="ml-0.5 text-muted-foreground">▾</span>
          </button>

          {statusPickerOpen && (
            <div
              className="absolute top-full left-0 mt-1 z-20 bg-popover border-border rounded-md shadow-md p-2 min-w-[260px] max-h-64 overflow-y-auto"
              data-testid="status-filter-dropdown"
            >
              <label
                htmlFor="filter-untranslated"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-untranslated"
                  data-testid="filter-untranslated"
                  checked={filters.untranslatedOnly}
                  onCheckedChange={(v) => setFilter({ untranslatedOnly: v === true })}
                />
                <span>{t('filters.untranslatedOnly')}</span>
                {missingCount > 0 && (
                  <span
                    className="ml-auto text-[10px] bg-status-warn/15 text-status-warn px-1.5 py-0.5 rounded-full font-semibold tabular-nums"
                    data-testid="filter-untranslated-count"
                  >
                    {missingCount.toLocaleString()}
                  </span>
                )}
              </label>

              <label
                htmlFor="filter-lqa-failed"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-lqa-failed"
                  data-testid="filter-lqa-failed"
                  checked={filters.lqaFailed}
                  onCheckedChange={(v) => setFilter({ lqaFailed: v === true })}
                />
                {t('filters.lqaFailed')}
              </label>

              <label
                htmlFor="filter-overflow"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-overflow"
                  data-testid="filter-overflow"
                  checked={filters.overflowOnly}
                  onCheckedChange={(v) => setFilter({ overflowOnly: v === true })}
                />
                {t('filters.overflowOnly')}
              </label>

              <label
                htmlFor="filter-too-long"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-too-long"
                  data-testid="filter-too-long"
                  checked={filters.tooLong === true}
                  onCheckedChange={(v) => setFilter({ tooLong: v === true })}
                />
                {t('filters.tooLong')}
              </label>

              <label
                htmlFor="filter-needs-review"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-needs-review"
                  data-testid="filter-needs-review"
                  checked={filters.needsReview}
                  onCheckedChange={(v) => setFilter({ needsReview: v === true })}
                />
                {t('filters.needsReview')}
              </label>

              <label
                htmlFor="filter-same-as-source"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-same-as-source"
                  data-testid="filter-same-as-source"
                  checked={filters.sameAsSource}
                  onCheckedChange={(v) => setFilter({ sameAsSource: v === true })}
                />
                {t('filters.sameAsSource')}
              </label>

              <label
                htmlFor="filter-placeholder-mismatch"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-placeholder-mismatch"
                  data-testid="filter-placeholder-mismatch"
                  checked={filters.placeholderMismatch}
                  onCheckedChange={(v) => setFilter({ placeholderMismatch: v === true })}
                />
                {t('filters.placeholderMismatch')}
              </label>

              <label
                htmlFor="filter-flagged-new"
                className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
              >
                <Checkbox
                  id="filter-flagged-new"
                  data-testid="filter-flagged-new"
                  checked={filters.flaggedNewOnly}
                  onCheckedChange={(v) => setFilter({ flaggedNewOnly: v === true })}
                />
                <span>{t('filters.newOnly')}</span>
                {flaggedNewIds.length > 0 && (
                  <span
                    className="ml-auto text-[10px] bg-status-info/15 text-status-info px-1.5 py-0.5 rounded-full font-semibold tabular-nums"
                    data-testid="filter-flagged-new-count"
                  >
                    {flaggedNewIds.length.toLocaleString()}
                  </span>
                )}
              </label>
              {flaggedNewIds.length > 0 && (
                <button
                  type="button"
                  className="mt-0.5 w-full text-left text-[11px] text-primary hover:underline px-1 cursor-pointer"
                  onClick={() => void handleClearAllNewFlags()}
                  data-testid="clear-all-new-flags"
                >
                  {t('filters.clearNewFlags', { count: flaggedNewIds.length })}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={handleClearFilters}
            data-testid="clear-filters"
          >
            {t('filters.clearFilters')}
          </Button>
        )}

        {/* Category multi-select */}
        {availableCategories.length > 0 && (
          <div className="relative" ref={categoryPickerRef}>
            <button
              type="button"
              className={`flex items-center gap-1 text-xs border rounded px-2 h-7 cursor-pointer ${
                filters.categories.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-background hover:bg-accent'
              }`}
              onClick={() => setCategoryPickerOpen((o) => !o)}
              data-testid="filter-category"
            >
              {t('filters.category')}{' '}
              <span className="text-muted-foreground">
                {filters.categories.length === 0
                  ? t('filters.allCategories')
                  : `${filters.categories.length} selected`}
              </span>
              <span className="ml-0.5 text-muted-foreground">▾</span>
            </button>

            {categoryPickerOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-20 bg-popover border-border rounded-md shadow-md p-2 min-w-[200px] max-h-64 overflow-y-auto"
                data-testid="category-picker-dropdown"
              >
                <label className="flex items-center gap-1.5 text-xs font-semibold pb-1 border-b mb-1 cursor-pointer hover:bg-accent rounded-sm px-1">
                  <Checkbox
                    checked={filters.categories.length === 0}
                    onCheckedChange={(v) => {
                      if (v === true) setFilter({ categories: [] });
                    }}
                  />
                  <span>{t('filters.allCategories')}</span>
                </label>
                {availableCategories.map((cat) => (
                  <label
                    key={cat}
                    className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
                  >
                    <Checkbox
                      checked={filters.categories.includes(cat)}
                      onCheckedChange={(v) => handleCategoryToggle(cat, v === true)}
                    />
                    {cat}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tone multi-select */}
        {availableTones.length > 0 && (
          <div className="relative" ref={tonePickerRef}>
            <button
              type="button"
              className={`flex items-center gap-1 text-xs border rounded px-2 h-7 cursor-pointer ${
                filters.tones.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-background hover:bg-accent'
              }`}
              onClick={() => setTonePickerOpen((o) => !o)}
              data-testid="filter-tone"
            >
              {t('filters.tone')}{' '}
              <span className="text-muted-foreground">
                {filters.tones.length === 0
                  ? t('filters.allTones')
                  : `${filters.tones.length} selected`}
              </span>
              <span className="ml-0.5 text-muted-foreground">▾</span>
            </button>

            {tonePickerOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-20 bg-popover border-border rounded-md shadow-md p-2 min-w-[200px] max-h-64 overflow-y-auto"
                data-testid="tone-picker-dropdown"
              >
                <label className="flex items-center gap-1.5 text-xs font-semibold pb-1 border-b mb-1 cursor-pointer hover:bg-accent rounded-sm px-1">
                  <Checkbox
                    checked={filters.tones.length === 0}
                    onCheckedChange={(v) => {
                      if (v === true) setFilter({ tones: [] });
                    }}
                  />
                  <span>{t('filters.allTones')}</span>
                </label>
                {availableTones.map((tone) => (
                  <label
                    key={tone}
                    className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
                  >
                    <Checkbox
                      checked={filters.tones.includes(tone)}
                      onCheckedChange={(v) => handleToneToggle(tone, v === true)}
                    />
                    {tone}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Glossary multi-select */}
        {availableGlossaries.length > 0 && (
          <div className="relative" ref={glossaryPickerRef}>
            <button
              type="button"
              className={`flex items-center gap-1 text-xs border rounded px-2 h-7 cursor-pointer ${
                filters.glossaryIds.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-background hover:bg-accent'
              }`}
              onClick={() => setGlossaryPickerOpen((o) => !o)}
              data-testid="filter-glossary"
            >
              {t('filters.glossary')}{' '}
              <span className="text-muted-foreground">
                {filters.glossaryIds.length === 0
                  ? t('filters.allGlossaries')
                  : `${filters.glossaryIds.length} selected`}
              </span>
              <span className="ml-0.5 text-muted-foreground">▾</span>
            </button>

            {glossaryPickerOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-20 bg-popover border-border rounded-md shadow-md p-2 min-w-[200px] max-h-64 overflow-y-auto"
                data-testid="glossary-picker-dropdown"
              >
                <label className="flex items-center gap-1.5 text-xs font-semibold pb-1 border-b mb-1 cursor-pointer hover:bg-accent rounded-sm px-1">
                  <Checkbox
                    checked={filters.glossaryIds.length === 0}
                    onCheckedChange={(v) => {
                      if (v === true) setFilter({ glossaryIds: [] });
                    }}
                  />
                  <span>{t('filters.allGlossaries')}</span>
                </label>
                {availableGlossaries.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
                  >
                    <Checkbox
                      checked={filters.glossaryIds.includes(g.id)}
                      onCheckedChange={(v) => handleGlossaryToggle(g.id, v === true)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Run-id filter */}
        <RunFilterSelect
          projectId={activeProjectId}
          value={filters.runId}
          onChange={(runId) => setFilter({ runId })}
          data-testid="filter-run-id-top"
        />

        {/* Source file filter */}
        {availableSources.length > 0 && (
          <div className="relative" ref={sourcePickerRef}>
            <button
              type="button"
              className={cn(
                'text-xs border rounded h-8 px-2.5 cursor-pointer font-normal text-left flex items-center justify-between gap-1',
                filters.sources.length > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'bg-background border-input hover:bg-accent',
              )}
              onClick={() => setSourcePickerOpen((o) => !o)}
              data-testid="filter-source-top"
            >
              <span className="truncate">
                {filters.sources.length === 0
                  ? t('filters.allSources')
                  : `${filters.sources.length} selected`}
              </span>
              <span className="text-muted-foreground shrink-0">▾</span>
            </button>
            {sourcePickerOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded shadow-md p-2 min-w-[180px] max-h-48 overflow-y-auto"
                data-testid="source-picker-dropdown-top"
                role="menu"
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSourcePickerOpen(false);
                }}
              >
                <label
                  role="menuitem"
                  className="flex items-center gap-1.5 text-xs font-semibold pb-1 border-b border-border mb-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.sources.length === 0}
                    onChange={(e) => {
                      if (e.target.checked) setFilter({ sources: [] });
                    }}
                  />{' '}
                  <span>{t('filters.allSources')}</span>
                </label>
                {availableSources.map((src) => (
                  <label
                    key={src}
                    role="menuitem"
                    className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filters.sources.includes(src)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...filters.sources, src]
                          : filters.sources.filter((s) => s !== src);
                        setFilter({ sources: next });
                      }}
                    />
                    {getSourceLabel(src, lang)}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Column visibility picker */}
        {activeLanguages.length > 0 && (
          <div className="relative" ref={colPickerRef}>
            <button
              type="button"
              className="flex items-center gap-1 text-xs border rounded px-2 h-7 bg-background hover:bg-accent cursor-pointer"
              onClick={() => setColPickerOpen((o) => !o)}
              data-testid="column-picker-trigger"
            >
              {t('filters.showColumns')}{' '}
              <span className="text-muted-foreground">
                ({visibleCount}/{activeLanguages.length})
              </span>
              <span className="ml-0.5 text-muted-foreground">▾</span>
            </button>

            {colPickerOpen && (
              <div
                className="absolute top-full left-0 mt-1 z-20 bg-popover border-border rounded-md shadow-md p-2 min-w-[180px] max-h-64 overflow-y-auto"
                data-testid="column-picker-dropdown"
              >
                <label className="flex items-center gap-1.5 text-xs font-semibold pb-1 border-b mb-1 cursor-pointer hover:bg-accent rounded-sm px-1">
                  <Checkbox
                    checked={filters.visibleLanguages.length === 0}
                    onCheckedChange={(v) => handleColToggleAll(v === true)}
                  />
                  <span>{t('filters.allColumns')}</span>
                </label>
                {sortedActiveLanguages.map((lang) => (
                  <label
                    key={lang}
                    className="flex items-center gap-1.5 text-xs py-0.5 cursor-pointer hover:bg-accent rounded-sm px-1"
                  >
                    <Checkbox
                      checked={
                        filters.visibleLanguages.length === 0 ||
                        filters.visibleLanguages.includes(lang)
                      }
                      onCheckedChange={(v) => handleColToggle(lang, v === true)}
                    />
                    {getLangName(lang)}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
