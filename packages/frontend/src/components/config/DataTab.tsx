import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import {
  LANGUAGE_REGISTRY,
  PSEUDO_LANGUAGE_CODE,
  buildKnownHeadersSet,
  parseGameCSV,
  buildCsvColumnMap,
  findRawNewlineLanguages,
  detectCsvCollection,
  csvHasKeyAndSourceColumns,
  entryCollection,
  type CsvCollection,
} from '@zercade-dev/narn-shared';
import { useProjectStore } from '../../stores/project-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { apiRequest, apiDownload } from '../../hooks/use-api.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { PseudoTestHelp } from './PseudoTestHelp.js';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LangCodeChip } from '@/components/ui/lang-code-chip';

interface DiffSummary {
  imported: number;
  diff: { new: number; changed: number; removed: number };
  skippedRows?: number;
  /** Rows dropped because they mis-split on the CSV dialect's quote ambiguity. */
  malformedRows?: number;
  ghostsBlocked?: number;
  glossariesSkipped?: number;
  /** Languages auto-activated because their column carried translations. */
  activatedLanguages?: string[];
  /** Language column headers that appeared more than once and were merged. */
  duplicateLanguageHeaders?: string[];
  /** Languages with a cell containing a raw newline byte instead of the literal \n marker. */
  rawNewlineLanguages?: string[];
  /** Automatic pre-import safety snapshot taken by the server before the import. */
  snapshot?: { filename: string; createdAt: string };
  /** Entries missing from the file (marked orphaned when mode is full-replace). */
  orphans?: number;
  /** Mode the import ran under. */
  mode?: 'add-only' | 'full-replace';
}

type ImportMode = 'add-only' | 'full-replace';

/** A dry run's counts for one import mode, or its in-flight marker. */
type ImportPreview = 'loading' | { orphans: number; changed: number };

/**
 * Data tab — how strings get in and out of the project: source/target
 * language selection, CSV import (with an unknown-headers confirmation gate),
 * and CSV export (including the template download). Everything else that
 * used to live alongside this on the old combined Config tab (rename, TM
 * policy, batch grouping, module settings, LQA checks, danger zone) stayed on
 * `ConfigTab.tsx`.
 */
export function DataTab() {
  const { t } = useTranslation('config');
  const { t: tCommon } = useTranslation('common');
  const { projects, activeProjectId, fetchProjects, updateLanguages } = useProjectStore();
  // Entries the string table already loaded; used to decide whether the
  // project has any live client strings worth offering an export choice for.
  const loadedEntries = useStringStore((s) => s.entries);
  const loadedEntriesProjectId = useStringStore((s) => s.loadedProjectId);
  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Always reflects the current activeProjectId; used to guard async import callbacks.
  const activeProjectIdRef = useRef(activeProjectId);
  // Identity of the file the in-flight orphan preview was fetched for; used to
  // discard a stale resolution when the user swaps files before it resolves.
  const previewFileRef = useRef<File | null>(null);
  useEffect(() => {
    activeProjectIdRef.current = activeProjectId;
    // A project switch invalidates any in-flight preview fetch for the old
    // project — clear the guard so a late resolution is ignored like the
    // explicit-close path (closeImportWarn) does.
    previewFileRef.current = null;
  }, [activeProjectId]);
  const [diffNotice, setDiffNotice] = useState<DiffSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [unknownHeaders, setUnknownHeaders] = useState<string[]>([]);
  const [rawNewlineLanguages, setRawNewlineLanguages] = useState<string[]>([]);
  const [importWarnOpen, setImportWarnOpen] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('full-replace');
  // Dry-run results per mode: the two modes orphan different rows in a client file.
  const [importPreviews, setImportPreviews] = useState<Partial<Record<ImportMode, ImportPreview>>>(
    {},
  );
  const [pendingLanguages, setPendingLanguages] = useState<string[] | null>(null);
  const [includeContext, setIncludeContext] = useState(false);
  const [discardUntranslatable, setDiscardUntranslatable] = useState(false);
  const [exportLanguages, setExportLanguages] = useState<string[] | null>(null);
  const [pseudoAs, setPseudoAs] = useState<string>('none');
  const [pendingCollection, setPendingCollection] = useState<CsvCollection>('main');
  // Null until the user picks one; the default then follows what the project holds.
  const [exportCollection, setExportCollection] = useState<CsvCollection | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // The strings table normally loads entries; the Data tab needs them too to
  // know whether the project has client strings. Skip when already loaded. A
  // failed fetch just leaves the export collection control hidden.
  useEffect(() => {
    if (!activeProjectId) return;
    if (useStringStore.getState().loadedProjectId === activeProjectId) return;
    void Promise.resolve(fetchEntries(activeProjectId)).catch(() => {});
  }, [activeProjectId, fetchEntries]);

  // Reset pending state during render when the active project changes
  const [prevActiveProjectId, setPrevActiveProjectId] = useState(activeProjectId);
  if (prevActiveProjectId !== activeProjectId) {
    setPrevActiveProjectId(activeProjectId);
    setPendingLanguages(null);
    setExportLanguages(null);
    setExportCollection(null);
    setPendingCollection('main');
    setDiffNotice(null);
    setPendingImportFile(null);
    setUnknownHeaders([]);
    setRawNewlineLanguages([]);
    setImportWarnOpen(false);
    setImportMode('full-replace');
    setImportPreviews({});
    setImporting(false);
  }

  const availableTargetLanguages = LANGUAGE_REGISTRY.filter(
    (l) => l.code !== activeProject?.sourceLanguage,
  );
  // Languages offered as directly-selectable export columns. Pseudo is excluded
  // here: it can only be exported by substituting its text into a real language
  // column via the `pseudoAs` control below, never as its own column.
  const exportableLanguages = (activeProject?.activeLanguages ?? []).filter(
    (code) => code !== PSEUDO_LANGUAGE_CODE,
  );
  const liveEntries =
    loadedEntriesProjectId === activeProjectId ? loadedEntries.filter((e) => !e.orphanedAt) : [];
  const hasClientStrings = liveEntries.some((e) => entryCollection(e) === 'client');
  const hasMainStrings = liveEntries.some((e) => entryCollection(e) === 'main');
  // A stale 'client' choice must not outlive the last client string.
  const effectiveExportCollection: CsvCollection = !hasClientStrings
    ? 'main'
    : (exportCollection ?? (hasMainStrings ? 'main' : 'client'));
  const currentLanguages = pendingLanguages ?? activeProject?.activeLanguages ?? [];
  const isDirty = pendingLanguages !== null;
  const allChecked =
    availableTargetLanguages.length > 0 &&
    availableTargetLanguages.every((l) => currentLanguages.includes(l.code));

  const handleLanguageToggle = (code: string, checked: boolean) => {
    const base = pendingLanguages ?? activeProject?.activeLanguages ?? [];
    const updated = checked ? [...base, code] : base.filter((c) => c !== code);
    setPendingLanguages(updated);
  };

  const handleToggleAll = () => {
    if (allChecked) {
      setPendingLanguages([]);
    } else {
      setPendingLanguages(availableTargetLanguages.map((l) => l.code));
    }
  };

  const selectedExportLanguages = exportLanguages ?? exportableLanguages;
  const allExportChecked =
    exportableLanguages.length > 0 &&
    exportableLanguages.every((code) => selectedExportLanguages.includes(code));

  const handleExportToggleAll = () => {
    if (allExportChecked) {
      setExportLanguages([]);
    } else {
      setExportLanguages(exportableLanguages);
    }
  };

  const { run: handleSaveLanguages, busy: savingLanguages } = useAsyncAction(
    async () => {
      if (!activeProject || !pendingLanguages) return;
      await updateLanguages(activeProject.id, pendingLanguages);
      await fetchProjects();
      setPendingLanguages(null);
    },
    {
      errorFallback: '',
      onError: (err) => {
        toast.error(t('languagesUpdateFailed', { message: (err as Error).message }));
        return true;
      },
    },
  );

  const handleSourceLanguageChange = async (code: string) => {
    if (!activeProject) return;
    // A source change also commits any staged target-language edit: a draft left
    // pending would survive into a later Save and write the new source language
    // back into activeLanguages.
    const base = pendingLanguages ?? activeProject.activeLanguages;
    const filteredLanguages = base.filter((l) => l !== code);
    try {
      await updateLanguages(activeProject.id, filteredLanguages, code);
      await fetchProjects();
      setPendingLanguages(null);
    } catch (err) {
      toast.error(t('sourceLanguageUpdateFailed', { message: (err as Error).message }));
    }
  };

  const doImport = async (file: File, mode: ImportMode) => {
    if (!activeProject) return;
    const importProjectId = activeProject.id;
    setImporting(true);
    setDiffNotice(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      const result = await apiRequest<DiffSummary>(`/projects/${importProjectId}/import`, {
        method: 'POST',
        body: formData,
      });
      if (activeProjectIdRef.current === importProjectId) {
        setDiffNotice(result);
        // Imported rows may have added or removed client strings.
        void Promise.resolve(fetchEntries(importProjectId)).catch(() => {});
      }
      // The server may have auto-activated languages found in the file;
      // refresh so the language checkboxes reflect the new active set.
      if (result.activatedLanguages && result.activatedLanguages.length > 0) {
        await fetchProjects();
      }
    } catch (err) {
      if (activeProjectIdRef.current === importProjectId) {
        toast.error(t('importFailed', { message: (err as Error).message }));
      }
    } finally {
      if (activeProjectIdRef.current === importProjectId) {
        setImporting(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetches a dry run so the sheet can say what the import would do in this
  // mode. Takes the file explicitly: on sheet open the state setter hasn't
  // committed yet.
  const fetchImportPreview = async (file: File, mode: ImportMode) => {
    if (!activeProject) return;
    const importProjectId = activeProject.id;
    previewFileRef.current = file;
    setImportPreviews((prev) => ({ ...prev, [mode]: 'loading' }));
    const isCurrent = () =>
      previewFileRef.current === file && activeProjectIdRef.current === importProjectId;
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', 'true');
      formData.append('mode', mode);
      const preview = await apiRequest<DiffSummary>(`/projects/${importProjectId}/import`, {
        method: 'POST',
        body: formData,
      });
      if (isCurrent()) {
        setImportPreviews((prev) => ({
          ...prev,
          [mode]: { orphans: preview.orphans ?? 0, changed: preview.diff?.changed ?? 0 },
        }));
      }
    } catch {
      // preview is best-effort; import still allowed
      if (isCurrent()) {
        setImportPreviews((prev) => {
          const next = { ...prev };
          delete next[mode];
          return next;
        });
      }
    }
  };

  const selectImportMode = (mode: ImportMode) => {
    setImportMode(mode);
    if (!pendingImportFile) return;
    // A main add-only import orphans nothing, so there is nothing to preview.
    if (mode === 'add-only' && pendingCollection === 'main') return;
    if (importPreviews[mode]) return; // already fetched or in flight
    void fetchImportPreview(pendingImportFile, mode);
  };

  // Clears the import-review warning sheet, dropping the pending file. Used by
  // the explicit Cancel button and the overlay/Escape close path so a dismissed
  // sheet never leaves a stale `pendingImportFile` lingering in state.
  const closeImportWarn = () => {
    setImportWarnOpen(false);
    setPendingImportFile(null);
    setUnknownHeaders([]);
    setRawNewlineLanguages([]);
    setPendingCollection('main');
    setImportMode('full-replace');
    setImportPreviews({});
    previewFileRef.current = null;
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;

    try {
      const text = await file.text();
      const parsed = parseGameCSV(text);
      if (csvHasKeyAndSourceColumns(parsed.headers)) {
        toast.error(t('importMixedCollections'));
        return;
      }
      const known = buildKnownHeadersSet();
      const unknown = parsed.headers.filter((h) => !known.has(h.toLowerCase()));
      const { colToCode } = buildCsvColumnMap(parsed.headers);
      const rawNewline = findRawNewlineLanguages(parsed.rows, colToCode);

      // Always review before importing: the sheet carries the add-only vs
      // full-replace choice (default full-replace, every time) plus any warnings.
      setPendingImportFile(file);
      setUnknownHeaders(unknown);
      setRawNewlineLanguages(rawNewline);
      setPendingCollection(detectCsvCollection(parsed.headers));
      setImportMode('full-replace');
      setImportPreviews({});
      setImportWarnOpen(true);
      void fetchImportPreview(file, 'full-replace');
      return;
    } catch (err) {
      // Reading/parsing the file client-side failed (e.g. it became unreadable);
      // surface the failure rather than rejecting the promise unhandled.
      toast.error(t('importFailed', { message: (err as Error).message }));
      return;
    } finally {
      // Always reset so re-selecting the same file fires `onChange` again.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExport = async () => {
    if (!activeProject) return;
    // Pseudo is never a directly-selectable export column (see
    // exportableLanguages); the substitution control drives it via pseudoAs.
    const selectedLangs = exportLanguages ?? exportableLanguages;
    const params = new URLSearchParams();
    if (includeContext) params.set('includeContext', 'true');
    if (discardUntranslatable) params.set('discardUntranslatable', 'true');
    // Only send the languages param when it differs from the full selectable set
    if (
      selectedLangs.length !== exportableLanguages.length ||
      selectedLangs.some((l) => !exportableLanguages.includes(l))
    ) {
      params.set('languages', selectedLangs.join(','));
    }
    if (pseudoAs !== 'none') params.set('pseudoAs', pseudoAs);
    if (effectiveExportCollection === 'client') params.set('collection', 'client');
    const query = params.toString();
    const path = query
      ? `/projects/${activeProject.id}/export?${query}`
      : `/projects/${activeProject.id}/export`;
    try {
      await apiDownload(
        path,
        effectiveExportCollection === 'client'
          ? `client-${activeProject.id}.csv`
          : `${activeProject.id}.csv`,
        {
          onResponse: (response) => {
            // Advisory warning (export still succeeded): some cells contain a
            // quote+comma/newline that mis-splits if this CSV is re-imported.
            const warnCount = Number(response.headers.get('X-Export-Roundtrip-Warnings') ?? '0');
            if (warnCount > 0) {
              const columns = response.headers.get('X-Export-Roundtrip-Columns') ?? '';
              toast.warning(t('exportRoundtripWarning', { count: warnCount, columns }));
            }
          },
        },
      );
    } catch (err) {
      toast.error(t('exportFailed', { message: (err as Error).message }));
    }
  };

  const handleDownloadTemplate = async () => {
    if (!activeProject) return;
    const selectedLangs = exportLanguages ?? exportableLanguages;
    const params = new URLSearchParams({ template: 'true' });
    if (effectiveExportCollection === 'client') params.set('collection', 'client');
    if (
      selectedLangs.length !== exportableLanguages.length ||
      selectedLangs.some((l) => !exportableLanguages.includes(l))
    ) {
      params.set('languages', selectedLangs.join(','));
    }
    try {
      await apiDownload(
        `/projects/${activeProject.id}/export?${params.toString()}`,
        effectiveExportCollection === 'client'
          ? `template-client-${activeProject.id}.csv`
          : `${activeProject.id}-template.csv`,
      );
    } catch (err) {
      toast.error(t('exportFailed', { message: (err as Error).message }));
    }
  };

  const currentPreview = importPreviews[importMode];

  if (!activeProject) {
    return (
      <div className="p-8 text-muted-foreground text-center" data-testid="data-tab">
        <h2 className="mb-2 text-base font-semibold">{t('noProjectTitle')}</h2>
        <p>{t('noProjectBody')}</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="mx-auto w-full max-w-screen-2xl grid grid-cols-1 lg:grid-cols-2 gap-4"
        data-testid="data-tab"
      >
        {/* Left: source + target languages */}
        <div className="space-y-4">
          {/* Source language */}
          <Card>
            <CardHeader>
              <CardTitle>{t('sourceLanguage')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={activeProject.sourceLanguage}
                onValueChange={(v) => {
                  if (v) handleSourceLanguageChange(v);
                }}
              >
                <SelectTrigger className="w-64" data-testid="source-language-select">
                  <SelectValue>
                    {(v: string | null) => {
                      const lang = LANGUAGE_REGISTRY.find((l) => l.code === v);
                      return lang ? `${lang.name} (${lang.code})` : v;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_REGISTRY.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name} ({lang.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Active target languages */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('targetLanguages')}</CardTitle>
                <Button variant="link" size="sm" onClick={handleToggleAll}>
                  {allChecked ? t('deselectAll') : t('selectAll')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-2">
                {availableTargetLanguages.map((lang) => (
                  <div key={lang.code} className="flex items-center gap-2 text-sm">
                    <label
                      className="flex min-w-0 flex-1 items-center gap-2"
                      data-pseudo={lang.code === PSEUDO_LANGUAGE_CODE ? 'true' : undefined}
                    >
                      <Checkbox
                        id={`target-lang-${lang.code}`}
                        data-testid={`target-lang-${lang.code}`}
                        checked={currentLanguages.includes(lang.code)}
                        onCheckedChange={(checked) =>
                          handleLanguageToggle(lang.code, checked === true)
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{lang.name}</span>
                      <LangCodeChip code={lang.code} />
                    </label>
                    {lang.code === PSEUDO_LANGUAGE_CODE && <PseudoTestHelp />}
                  </div>
                ))}
              </div>
              {isDirty && (
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Button
                    size="sm"
                    onClick={handleSaveLanguages}
                    disabled={savingLanguages}
                    data-testid="save-languages-button"
                  >
                    {savingLanguages ? tCommon('saving') : tCommon('save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPendingLanguages(null)}
                    disabled={savingLanguages}
                  >
                    {t('discard')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: CSV import + export */}
        <div className="space-y-4">
          {/* CSV import */}
          <Card>
            <CardHeader>
              <CardTitle>{t('importCsv')}</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                data-testid="csv-file-input"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                data-testid="import-csv-button"
              >
                {importing ? t('importing') : t('chooseCsv')}
              </Button>

              {diffNotice && (
                <div
                  className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/20 text-sm text-foreground"
                  data-testid="import-diff-notice"
                >
                  <div className="mb-2">
                    <strong>{t('importComplete')}</strong> —{' '}
                    {t('rowsProcessed', { count: diffNotice.imported })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{t('new', { count: diffNotice.diff.new })}</Badge>
                    {diffNotice.mode === 'full-replace' && (
                      <Badge variant="destructive">
                        {t('removed', { count: diffNotice.diff.removed })}
                      </Badge>
                    )}
                    {diffNotice.mode === 'full-replace' && (diffNotice.orphans ?? 0) > 0 && (
                      <Badge variant="destructive" data-testid="import-orphaned-badge">
                        {t('orphanedCount', { count: diffNotice.orphans })}
                      </Badge>
                    )}
                    <Badge variant="outline" data-testid="import-changed-badge">
                      {t('changed', { count: diffNotice.diff.changed })}
                    </Badge>
                    {(diffNotice.skippedRows ?? 0) + (diffNotice.ghostsBlocked ?? 0) > 0 && (
                      <Badge variant="outline" className="text-status-warn border-status-warn/40">
                        {t('skipped', {
                          count: (diffNotice.skippedRows ?? 0) + (diffNotice.ghostsBlocked ?? 0),
                        })}
                      </Badge>
                    )}
                    {(diffNotice.glossariesSkipped ?? 0) > 0 && (
                      <Badge variant="outline" className="text-status-warn border-status-warn/40">
                        {t('glossariesSkipped', { count: diffNotice.glossariesSkipped })}
                      </Badge>
                    )}
                    {(diffNotice.malformedRows ?? 0) > 0 && (
                      <Badge variant="destructive" data-testid="import-malformed-rows">
                        {t('malformedRows', { count: diffNotice.malformedRows })}
                      </Badge>
                    )}
                  </div>
                  {(diffNotice.malformedRows ?? 0) > 0 && (
                    <div
                      className="mt-2 text-xs text-status-warn"
                      data-testid="import-malformed-notice"
                    >
                      {t('malformedRowsHelp')}
                    </div>
                  )}
                  {(diffNotice.activatedLanguages?.length ?? 0) > 0 && (
                    <div className="mt-2 text-xs" data-testid="import-activated-languages">
                      {t('activatedLanguages', {
                        languages: (diffNotice.activatedLanguages ?? [])
                          .map(
                            (code) => LANGUAGE_REGISTRY.find((l) => l.code === code)?.name ?? code,
                          )
                          .join(', '),
                      })}
                    </div>
                  )}
                  {(diffNotice.duplicateLanguageHeaders?.length ?? 0) > 0 && (
                    <div
                      className="mt-2 text-xs text-status-warn"
                      data-testid="import-duplicate-language-headers"
                    >
                      {t('duplicateLanguageHeaders', {
                        headers: (diffNotice.duplicateLanguageHeaders ?? []).join(', '),
                      })}
                    </div>
                  )}
                  {(diffNotice.rawNewlineLanguages?.length ?? 0) > 0 && (
                    <div
                      className="mt-2 text-xs text-status-warn"
                      data-testid="import-raw-newline-languages"
                    >
                      {t('rawNewlineLanguagesNotice', {
                        languages: (diffNotice.rawNewlineLanguages ?? [])
                          .map(
                            (code) => LANGUAGE_REGISTRY.find((l) => l.code === code)?.name ?? code,
                          )
                          .join(', '),
                      })}
                    </div>
                  )}
                  {diffNotice.snapshot && (
                    <div
                      className="mt-2 text-xs text-muted-foreground"
                      data-testid="import-snapshot-note"
                    >
                      {t('importSnapshotNote', {
                        date: new Date(diffNotice.snapshot.createdAt).toLocaleString(),
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* CSV export */}
          <Card>
            <CardHeader>
              <CardTitle>{t('exportCsv')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {exportableLanguages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium">{t('exportLanguages')}</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleExportToggleAll}
                      data-testid="export-languages-select-all"
                    >
                      {allExportChecked ? t('deselectAll') : t('selectAll')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1.5">{t('exportLanguagesHint')}</p>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-2">
                    {exportableLanguages.map((code) => {
                      const lang = LANGUAGE_REGISTRY.find((l) => l.code === code);
                      return (
                        <label key={code} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedExportLanguages.includes(code)}
                            onCheckedChange={(checked) => {
                              const base = exportLanguages ?? exportableLanguages;
                              setExportLanguages(
                                checked === true ? [...base, code] : base.filter((c) => c !== code),
                              );
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate">{lang?.name ?? code}</span>
                          <LangCodeChip code={code} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              {hasClientStrings && (
                <div data-testid="export-collection-control">
                  <p className="text-sm font-medium mb-1.5">{t('exportCollection')}</p>
                  <div
                    className="inline-flex rounded-lg border bg-muted p-0.5"
                    role="radiogroup"
                    aria-label={t('exportCollection')}
                  >
                    {(['main', 'client'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={effectiveExportCollection === c}
                        data-testid={`export-collection-${c}`}
                        onClick={() => setExportCollection(c)}
                        className={cn(
                          'cursor-pointer rounded-md px-3 py-1 text-sm transition-colors',
                          effectiveExportCollection === c
                            ? 'bg-background font-medium shadow'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t(c === 'client' ? 'collectionClient' : 'collectionMain')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  data-testid="include-context-checkbox"
                  checked={includeContext}
                  onCheckedChange={(c) => setIncludeContext(c === true)}
                />
                {t('includeContext')}
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  data-testid="discard-untranslatable-checkbox"
                  checked={discardUntranslatable}
                  onCheckedChange={(c) => setDiscardUntranslatable(c === true)}
                />
                {t('discardUntranslatable')}
              </label>
              {activeProject.activeLanguages.includes(PSEUDO_LANGUAGE_CODE) && (
                <div>
                  <p className="text-sm font-medium mb-1.5">{t('pseudoExportAs')}</p>
                  <Select value={pseudoAs} onValueChange={(v) => setPseudoAs(v ?? 'none')}>
                    <SelectTrigger data-testid="pseudo-export-as-select" className="max-w-xs">
                      <SelectValue>
                        {(v: string | null) =>
                          !v || v === 'none'
                            ? t('pseudoExportNone')
                            : (LANGUAGE_REGISTRY.find((l) => l.code === v)?.name ?? v)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('pseudoExportNone')}</SelectItem>
                      {activeProject.activeLanguages
                        .filter(
                          (code) =>
                            code !== activeProject.sourceLanguage && code !== PSEUDO_LANGUAGE_CODE,
                        )
                        .map((code) => {
                          const lang = LANGUAGE_REGISTRY.find((l) => l.code === code);
                          return (
                            <SelectItem key={code} value={code}>
                              {lang?.name ?? code}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">{t('pseudoExportHint')}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleExport} data-testid="export-csv-button">
                  {t('downloadCsv')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  data-testid="download-template-button"
                >
                  {t('downloadTemplate')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={importWarnOpen} onOpenChange={(open) => !open && closeImportWarn()}>
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl px-6 pb-6">
          <SheetHeader className="text-center">
            <SheetTitle>{t('importWarningsTitle')}</SheetTitle>
            <SheetDescription>
              {unknownHeaders.length > 0 || rawNewlineLanguages.length > 0
                ? t('importWarningsDescription')
                : t('importSheetDescription')}
            </SheetDescription>
          </SheetHeader>
          <p className="mt-3 text-center text-sm" data-testid="import-detected-collection">
            {t('detectedCollection', {
              collection: t(pendingCollection === 'client' ? 'collectionClient' : 'collectionMain'),
            })}
          </p>
          <div
            className="mt-3 flex flex-col items-center gap-1.5 text-center"
            data-testid="import-mode-control"
          >
            <p className="text-sm font-medium">{t('importMode')}</p>
            <div
              className="inline-flex rounded-lg border bg-muted p-0.5"
              role="radiogroup"
              aria-label={t('importMode')}
            >
              {(['full-replace', 'add-only'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={importMode === m}
                  data-testid={`import-mode-${m}`}
                  onClick={() => selectImportMode(m)}
                  className={cn(
                    'cursor-pointer rounded-md px-3 py-1 text-sm transition-colors',
                    importMode === m
                      ? 'bg-background font-medium shadow'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m === 'add-only' ? t('importModeAddOnly') : t('importModeFullReplace')}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {importMode === 'add-only'
                ? t('importModeAddOnlyHint')
                : t('importModeFullReplaceHint')}
            </p>
            {pendingCollection === 'main' && importMode === 'full-replace' && (
              <p className="text-xs text-status-warn mt-2" data-testid="full-replace-orphan-notice">
                {currentPreview === 'loading'
                  ? t('fullReplacePreviewLoading')
                  : t('fullReplaceOrphanNotice', { count: currentPreview?.orphans ?? 0 })}
              </p>
            )}
            {pendingCollection === 'client' && (
              <div
                className="text-xs text-status-warn mt-2 space-y-1"
                data-testid="client-import-notice"
              >
                <p>
                  {importMode === 'add-only'
                    ? t('clientImportAddOnlyNotice')
                    : t('clientImportFullReplaceNotice')}
                </p>
                {currentPreview === 'loading' && <p>{t('fullReplacePreviewLoading')}</p>}
                {currentPreview && currentPreview !== 'loading' && (
                  <p data-testid="client-import-preview-counts">
                    {t('clientImportPreviewCounts', {
                      changed: currentPreview.changed,
                      orphans: currentPreview.orphans,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
          {unknownHeaders.length > 0 && (
            <div className="mt-3" data-testid="import-unknown-headers-warning">
              <p className="text-sm font-medium">{t('unknownHeadersTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('unknownHeadersDescription')}</p>
              <ul className="mt-1 mb-1 list-disc pl-5 text-sm space-y-0.5">
                {unknownHeaders.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {rawNewlineLanguages.length > 0 && (
            <div className="mt-3" data-testid="import-raw-newline-warning">
              <p className="text-sm font-medium">{t('rawNewlineLanguagesTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('rawNewlineLanguagesDescription')}</p>
              <ul className="mt-1 mb-1 list-disc pl-5 text-sm space-y-0.5">
                {rawNewlineLanguages.map((code) => (
                  <li key={code}>{LANGUAGE_REGISTRY.find((l) => l.code === code)?.name ?? code}</li>
                ))}
              </ul>
            </div>
          )}
          <SheetFooter className="mt-4 flex gap-2">
            <Button variant="outline" data-testid="cancel-import" onClick={closeImportWarn}>
              {t('cancelImport')}
            </Button>
            <Button
              data-testid="confirm-import"
              onClick={async () => {
                setImportWarnOpen(false);
                const file = pendingImportFile;
                const mode = importMode;
                setPendingImportFile(null);
                setUnknownHeaders([]);
                setRawNewlineLanguages([]);
                setImportPreviews({});
                setImportMode('full-replace');
                if (file) await doImport(file, mode);
              }}
            >
              {t('continueImport')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
