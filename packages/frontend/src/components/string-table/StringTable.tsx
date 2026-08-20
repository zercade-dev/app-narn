import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/utils';
import { RunStatusCode } from '@zercade-dev/narn-shared';
import { isRunActive } from '@/lib/run-kind';
import { apiRequest, ApiError } from '../../hooks/use-api.js';
import { usePersistentState } from '../../hooks/use-persistent-state.js';
import { useVaultRetryAction } from '../../hooks/use-vault-retry-action.js';
import { useGlossaryGenAccept } from '../../hooks/use-glossary-gen-accept.js';
import { accessFor, useProjectStore } from '../../stores/project-store.js';
import { NoProjectEmptyState } from '../common/NoProjectEmptyState.js';
import { writableSubset } from '@/lib/collab-locks';
import { useStringStore } from '../../stores/string-store.js';
import { useSelectionStore } from '../../stores/selection-store.js';
import { useLoggerStore } from '../../stores/logger-store.js';
import { useRunStore, type ReviewOrderMeta } from '../../stores/run-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { filterEntries, orderByReviewSort } from '../../lib/filter-entries.js';
import { countDistinctSourceTexts } from '../../lib/count-distinct-sources.js';
import { StringTableFilters } from './StringTableFilters.js';
import {
  collectFreewayRetranslatePairs,
  DEFAULT_FILTERS,
  sortByRegistry,
} from './string-table-helpers.js';
import { StringTableEditor } from './StringTableEditor.js';
import { StringTablePagination } from './StringTablePagination.js';
import { StringTableGrid } from './StringTableGrid.js';
import { StringTableBulkBar } from './StringTableBulkBar.js';
import {
  BULK_PER_ENTRY_CONCURRENCY,
  LOADING_SKELETON_ROWS,
  mapWithConcurrency,
  type Selection,
} from './string-table-view-types.js';
import { TranslateRunDialog } from '../comparison/TranslateRunDialog.js';
import type { ExampleCandidate } from '../comparison/ExampleEntryPicker.js';
import { GenerateGlossaryDialog } from '../glossary/GenerateGlossaryDialog.js';
import {
  useRunCompletionNotice,
  type RunCompletion,
} from '../comparison/use-run-completion-notice.js';
import {
  type BatchGroupingDimension,
  type GlossarySuggestion,
  type GlossarySummary,
} from '@zercade-dev/narn-shared';
import { Skeleton } from '@/components/ui/skeleton';

export function StringTable() {
  const { t } = useTranslation('strings');
  const { t: tBatch } = useTranslation('batch');
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  // The bulk bar's "Bulk Operation" menu (approve/ignore/clear-new-flag/
  // category add-remove) patches non-translation fields, which is
  // 'manage'-only server-side (`assertEntryPatchAllowed`) — hidden outright
  // for collaborators, mirroring the Glossary tab's management-affordance
  // gating. "Translate Selected" stays available but its target languages are
  // scoped to what this access may WRITE (writableSubset is a no-op filter for
  // owners, so this is byte-identical to prior behavior for them).
  const access = useProjectStore((s) => accessFor(s, activeProjectId));
  const isCollaborator = access.role === 'collaborator';

  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const allEntries = useStringStore((s) => s.entries);
  const filters = useStringStore((s) => s.filters);
  const setFilter = useStringStore((s) => s.setFilter);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const bulkUpdate = useStringStore((s) => s.bulkUpdate);
  const loading = useStringStore((s) => s.loading);
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);
  const fetchError = useStringStore((s) => s.error);
  const visibleLanguages = filters.visibleLanguages;
  const logEntries = useLoggerStore((s) => s.entries);

  // Derive the set of cells currently being translated from log events.
  const translatingCells = useMemo(() => {
    const inProgress = new Set<string>();
    for (const e of logEntries) {
      if (e.message === 'translation:start') {
        const key = `${String(e.metadata?.entryId)}:${String(e.metadata?.targetLanguage)}`;
        inProgress.add(key);
      } else if (e.message === 'translation:done' || e.message === 'translation:failed') {
        const key = `${String(e.metadata?.entryId)}:${String(e.metadata?.targetLanguage)}`;
        inProgress.delete(key);
      }
    }
    return inProgress;
  }, [logEntries]);

  const [page, setPage] = useState(1);
  // Persisted as a JSON number (matching the prior `String(pageSize)` writes,
  // which round-trip through JSON unchanged); the validate guards a malformed
  // entry to the default instead of yielding a NaN page size.
  const [pageSize, setPageSize] = usePersistentState<number>('translator-page-size', 50, {
    validate: (v): v is number => typeof v === 'number' && Number.isFinite(v),
  });
  const [selection, setSelection] = useState<Selection>(null);
  // "Show all" clears the search filter in the store, but StringTableFilters'
  // search box is an UNCONTROLLED input (`defaultValue`, synced to the store
  // only via its own debounced onChange) — clearing the store alone leaves the
  // box showing the old search text (visual desync). Bumping this key (see
  // `handleShowAll` below) forces a remount of StringTableFilters so the input
  // re-mounts with the now-cleared `defaultValue`, without reaching into that
  // component's own internal ref.
  const [filtersResetKey, setFiltersResetKey] = useState(0);
  const selectedIds = useSelectionStore((s) => s.selectedIds);
  const toggleSelected = useSelectionStore((s) => s.toggle);
  const setPageSelected = useSelectionStore((s) => s.setPage);
  const selectAllFiltered = useSelectionStore((s) => s.selectAll);
  const clearSelection = useSelectionStore((s) => s.clear);
  const [bulkCategory, setBulkCategory] = useState('');
  // Consolidated "Bulk Operation" popover: `bulkOpOpen` is the popover's own
  // open state, `bulkOpMode` picks which panel it shows (a small in-popover
  // nav rather than three separate triggers).
  const [bulkOpOpen, setBulkOpOpen] = useState(false);
  const [bulkOpMode, setBulkOpMode] = useState<'menu' | 'add-category' | 'remove-category'>('menu');
  const [categoriesToRemove, setCategoriesToRemove] = useState<Set<string>>(() => new Set());
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [glossarySummaries, setGlossarySummaries] = useState<GlossarySummary[]>([]);
  // "AI Generation" popover (glossary/category generation scoped to selection).
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [glossaryGenOpen, setGlossaryGenOpen] = useState(false);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);
  // Pairs in the selection that would auto-apply from translation memory;
  // fetched via the dry-run preview endpoint when the batch dialog opens.
  const [batchMemoryCount, setBatchMemoryCount] = useState(0);
  // Distinct local Ollama models the run would route to; fetched via the
  // dry-run preview endpoint when the dialog opens. ≥2 enables the
  // "run one local model at a time" toggle.
  const [batchLocalModelCount, setBatchLocalModelCount] = useState(0);
  const [batchRunId, setBatchRunId] = useState<string | null>(null);
  // Carries the resolved project id + JSON request body from `handleBatchTranslate`
  // (where the project id is guaranteed non-null) to the vault-retry hook's `run`
  // / `onResult`; pinned immediately before `invoke` so the post-unlock retry and
  // the result handler use the same project the request was issued for.
  const batchRequestRef = useRef<{ projectId: string; body: string } | null>(null);
  const latestRun = useRunStore((s) => s.runs?.find((r) => r.runId === batchRunId));
  const batchProgress = latestRun;
  const fetchRuns = useRunStore((s) => s.fetchRuns);

  // The vault-retry hook owns the "deliver the run id exactly once across the
  // awaited result AND the post-unlock retry, swallow the 423" boilerplate. The
  // per-call request (project id + JSON body) is pinned by `handleBatchTranslate`
  // immediately before `invoke`; `run`/`onResult` read it back so the hook's
  // stable closure can re-issue it on retry and report against the same project.
  // `apiRequest` captures the URL, so the run is always created under the pinned
  // project even on a post-unlock retry; `onResult`'s `fetchRuns` reads the ref
  // (the project at trigger time, matching the old closure-captured value). The
  // single-user model rules out overlapping batches, and a stale immediate fetch
  // would self-correct on the next poll anyway.
  const batchTranslate = useVaultRetryAction<{ runId: string; total: number }>(
    // `run` is only invoked by `invoke()`, which `handleBatchTranslate` calls
    // immediately after pinning `batchRequestRef`, so it is always set here.
    ({ onRetry }) => {
      const req = batchRequestRef.current!;
      return apiRequest<{ runId: string; total: number }>(`/projects/${req.projectId}/translate`, {
        method: 'POST',
        body: req.body,
        onVaultLockedRetry: onRetry,
      });
    },
    {
      onResult: (result) => {
        setBatchRunId(result.runId);
        const projectId = batchRequestRef.current?.projectId;
        if (projectId) void fetchRuns(projectId); // immediate fetch; polling starts via effect
      },
      onError: (err) => toast.error(errorMessage(err, t('bulk.startFailed'))),
    },
  );

  const startPolling = useRunStore((s) => s.startPolling);
  const stopPolling = useRunStore((s) => s.stopPolling);
  // Similarity pre-sort (computes reviewSortIndex). Lives here because the sort
  // feature's scope is the multi-language text + comparison tabs.
  const computeReviewOrder = useRunStore((s) => s.computeReviewOrder);
  const fetchReviewOrder = useRunStore((s) => s.fetchReviewOrder);
  const [presorting, setPresorting] = useState(false);
  const [orderMeta, setOrderMeta] = useState<ReviewOrderMeta | null>(null);
  const [reTranslate, setReTranslate] = useState(
    () => localStorage.getItem('translator-bulk-re-translate') === 'true',
  );
  // "Retranslate below tier N" bulk action's own threshold select — independent
  // of the "Served below tier N" filter's store state (a different control with
  // a different purpose: this one scopes a WRITE, the filter scopes a VIEW).
  // `null` = off, mirroring the filter's idiom.
  const [retranslateBelowTier, setRetranslateBelowTier] = useState<number | null>(null);

  // Load the "last sorted" meta when the active project changes.
  useEffect(() => {
    if (!activeProjectId) return;
    fetchReviewOrder(activeProjectId)
      .then(setOrderMeta)
      .catch(() => setOrderMeta(null));
  }, [activeProjectId, fetchReviewOrder]);

  const handlePresort = async () => {
    if (presorting || !activeProjectId) return;
    setPresorting(true);
    try {
      const result = await computeReviewOrder(activeProjectId);
      setOrderMeta({ computed: true, count: result.count, computedAt: result.computedAt });
      // Refresh entries so the new reviewSortIndex re-orders the view immediately.
      await fetchEntries(activeProjectId);
      toast.success(t('order.presortSuccess', { count: result.count }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) return;
      toast.error(errorMessage(err, t('order.presortFailed')));
    } finally {
      setPresorting(false);
    }
  };

  // Persist re-translate preference
  useEffect(() => {
    localStorage.setItem('translator-bulk-re-translate', String(reTranslate));
  }, [reTranslate]);

  const entries = useMemo(() => {
    const filtered = filterEntries(allEntries, filters);
    // Display-only re-order: 'custom' applies the Source-review pre-sort
    // (reviewSortIndex); 'import' keeps the natural import order.
    return filters.orderMode === 'custom' ? orderByReviewSort(filtered) : filtered;
  }, [allEntries, filters]);
  // Single id→entry index reused by the memos and bulk handlers below so the
  // O(n) map isn't rebuilt at each of those sites on every render/invocation.
  const entriesById = useMemo(
    () => new Map(allEntries.map((entry) => [entry.id, entry])),
    [allEntries],
  );
  // Ids of the currently-visible (filtered) rows.
  const visibleIds = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  // Selection restricted to the current filtered view: a row hidden by the
  // active filter (e.g. selected before a filter was applied, or selected on
  // another page's prior filter) must be neither counted in the bulk bar nor
  // mutated by a bulk action. Every bulk-scope computation and handler below
  // reads `visibleSelectedIds` instead of the raw store selection, mirroring
  // ComparisonTab's `effectiveSelection`.
  const visibleSelectedIds = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds;
    const next = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selectedIds, visibleIds]);
  const totalEntries = useMemo(
    () => allEntries.filter((e) => e.needsTranslation !== false).length,
    [allEntries],
  );
  const batchTargetLanguages = useMemo(
    () =>
      writableSubset(
        access,
        (activeProject?.activeLanguages ?? []).filter(
          (lang) => lang !== activeProject?.sourceLanguage,
        ),
      ),
    [activeProject?.activeLanguages, activeProject?.sourceLanguage, access],
  );
  // The exact (entryId, targetLanguage) pairs the "Retranslate below tier N"
  // bulk action would target: every writable-language translation in the
  // (visible) selection served by Freeway below the chosen threshold. `null`
  // threshold (off) yields no pairs — the action stays disabled.
  const retranslateBelowTierPairs = useMemo(
    () =>
      retranslateBelowTier === null
        ? []
        : collectFreewayRetranslatePairs(
            visibleSelectedIds,
            entriesById,
            batchTargetLanguages,
            retranslateBelowTier,
          ),
    [visibleSelectedIds, entriesById, batchTargetLanguages, retranslateBelowTier],
  );
  // Candidates for the Translate dialog's example picker: entries translated
  // in at least one of the run's target languages, excluding the entries being
  // translated (an entry must not anchor itself).
  const exampleCandidates = useMemo<ExampleCandidate[]>(() => {
    if (batchTargetLanguages.length === 0) return [];
    const out: ExampleCandidate[] = [];
    for (const entry of allEntries) {
      if (visibleSelectedIds.has(entry.id)) continue;
      const translatedLanguages = batchTargetLanguages.filter((lang) =>
        entry.translations[lang]?.text?.trim(),
      );
      if (translatedLanguages.length === 0) continue;
      out.push({ id: entry.id, sourceText: entry.sourceText, translatedLanguages });
    }
    return out;
  }, [allEntries, visibleSelectedIds, batchTargetLanguages]);
  const translatableCount = useMemo(() => {
    if (visibleSelectedIds.size === 0 || batchTargetLanguages.length === 0) return 0;
    const selectedSet = visibleSelectedIds;
    let count = 0;
    for (const id of selectedSet) {
      const entry = entriesById.get(id);
      // A selected id no longer present in the current entry set (deleted, or
      // dropped by an import/restore elsewhere) is never translatable — the
      // selection-pruning effect below removes it from the store shortly, but
      // this is the same-render guard against ever counting/sending it.
      if (!entry) continue;
      for (const lang of batchTargetLanguages) {
        if (reTranslate || !entry.translations[lang]?.text) count += 1;
      }
    }
    return count;
  }, [visibleSelectedIds, batchTargetLanguages, entriesById, reTranslate]);
  // Distinct categories used by ANY currently-selected (and visible) entry —
  // the candidate set for the bulk "remove categories" action. Memoized so it
  // isn't rebuilt on every unrelated render.
  const selectedCategories = useMemo(() => {
    if (visibleSelectedIds.size === 0) return [] as string[];
    const used = new Set<string>();
    for (const id of visibleSelectedIds) {
      for (const cat of entriesById.get(id)?.categories ?? []) used.add(cat);
    }
    return Array.from(used).sort((a, b) => a.localeCompare(b));
  }, [visibleSelectedIds, entriesById]);
  // Distinct, non-empty source strings among the current (visible) selection —
  // shown by the selection-scoped glossary-generate dialog as its expected
  // batch count.
  const selectionSourceEntryCount = useMemo(() => {
    const selectedEntries: { sourceText: string }[] = [];
    for (const id of visibleSelectedIds) {
      const entry = entriesById.get(id);
      if (entry) selectedEntries.push(entry);
    }
    return countDistinctSourceTexts(selectedEntries);
  }, [visibleSelectedIds, entriesById]);
  // Stable identities for the props threaded into the selection-scoped
  // GenerateGlossaryDialog instance below, so it doesn't see a fresh array/
  // filter result (and any future effect keyed off them doesn't re-fire) on
  // every unrelated re-render of this table.
  const selectionEntryIds = useMemo(() => Array.from(visibleSelectedIds), [visibleSelectedIds]);
  const enabledGlossarySummaries = useMemo(
    () => glossarySummaries.filter((g) => g.enabled !== false),
    [glossarySummaries],
  );

  const activeLanguages = activeProject?.activeLanguages;
  const srcLang = activeProject?.sourceLanguage ?? '';
  // Memoized so language-cell callbacks in StringTableRow keep a stable
  // identity, which lets the memoized Cell component skip re-renders.
  const columns = useMemo(() => {
    const rawColumns = visibleLanguages.length > 0 ? visibleLanguages : (activeLanguages ?? []);
    return sortByRegistry(rawColumns.filter((c) => c !== srcLang));
  }, [visibleLanguages, activeLanguages, srcLang]);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageEntries = entries.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageIds = pageEntries.map((e) => e.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));
  const allFilteredSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  // "On other pages" counts only *visible* (filter-passing) selected rows that
  // aren't on the current page — a selected row hidden entirely by the active
  // filter is excluded from this count (and from every bulk action's scope
  // below), not mislabeled as being on some other page.
  const selectedOffPage = visibleSelectedIds.size - selectedOnPage;

  useEffect(() => {
    if (activeProjectId) {
      fetchEntries(activeProjectId);
    }
  }, [activeProjectId, fetchEntries]);

  // Clear glossary summaries during render when the project is deselected.
  const [prevGlossaryProjectId, setPrevGlossaryProjectId] = useState(activeProjectId);
  if (prevGlossaryProjectId !== activeProjectId) {
    setPrevGlossaryProjectId(activeProjectId);
    if (!activeProjectId) setGlossarySummaries([]);
  }

  // Shared by the mount effect below and by the AI-generation glossary accept
  // flow (which creates glossaries and needs the row-badge summaries to reflect
  // them promptly rather than waiting for the next project switch).
  const refreshGlossarySummaries = useCallback(() => {
    if (!activeProjectId) return undefined;
    return apiRequest<GlossarySummary[]>(`/projects/${activeProjectId}/glossaries`)
      .then(setGlossarySummaries)
      .catch(() => setGlossarySummaries([]));
  }, [activeProjectId]);

  useEffect(() => {
    void refreshGlossarySummaries();
  }, [refreshGlossarySummaries]);

  // "AI Generation" → "Generate Glossary from Selection": shares the same
  // create+assign-from-suggestions flow as the whole-project dialog on the
  // Glossary tab (see useGlossaryGenAccept), refreshing this table's own
  // glossary-badge summaries afterward instead of that tab's browse list.
  const handleAcceptGlossarySuggestions = useGlossaryGenAccept(
    activeProjectId ?? '',
    refreshGlossarySummaries,
  );
  // Unlike GlossaryTab's whole-project instance, this one is scoped to a
  // selection — so, unlike that instance, clear it on a successful accept
  // (matching every other bulk action in this toolbar: add/remove category,
  // approve, ignore all call `clearSelection()` on success). This wrapper is
  // deliberately NOT inside `useGlossaryGenAccept` itself, since that hook is
  // shared with GlossaryTab's whole-project dialog, where clearing the
  // (unrelated) row selection on accept would be a surprising side effect.
  const acceptGlossarySuggestionsFromSelection = useCallback(
    async (suggestions: GlossarySuggestion[]) => {
      await handleAcceptGlossarySuggestions(suggestions);
      clearSelection();
    },
    [handleAcceptGlossarySuggestions, clearSelection],
  );
  // "AI Generation" → "Generate Categories from Selection": a cross-tab
  // handoff (CategoryTab's AI panel isn't a portable dialog) — see view-store.
  const openCategoryGenScope = useViewStore((s) => s.openCategoryGenScope);

  // Category suggestions for the bulk "change category" combobox.
  useEffect(() => {
    if (!activeProjectId) return;
    apiRequest<string[]>(`/projects/${activeProjectId}/categories`)
      .then(setCategorySuggestions)
      .catch(() => setCategorySuggestions([]));
  }, [activeProjectId]);

  // Sync active languages into the filter so untranslated check knows which languages to check
  const activeLanguagesStr = activeProject?.activeLanguages?.join(',') ?? '';
  useEffect(() => {
    if (activeProject) {
      setFilter({ activeLanguages: activeProject.activeLanguages });
    }
  }, [activeProject, activeLanguagesStr, setFilter]);

  // Run ids are project-scoped, so clear the run filter whenever the active
  // project changes — otherwise a stale run id from the previous project hides
  // every entry in the new one.
  useEffect(() => {
    setFilter({ runId: '' });
  }, [activeProjectId, setFilter]);

  // Clear the (module-level, project-agnostic) selection during render when the
  // active project changes. The selection store is shared with the Batch tab, so
  // stale ids from a previous project would otherwise inflate translatableCount
  // and be sent to the server by the bulk actions below.
  const [prevSelectionProjectId, setPrevSelectionProjectId] = useState(activeProjectId);
  if (prevSelectionProjectId !== activeProjectId) {
    setPrevSelectionProjectId(activeProjectId);
    clearSelection();
  }

  // Prune ids from the (shared) selection store that no longer exist in the
  // current entry set — e.g. an entry deleted elsewhere, or dropped by an
  // import/restore — so a stale id is never counted by `translatableCount` or
  // sent to the server by a bulk action (mirrors the render-time "prev value"
  // sync pattern used by the project-change reset above).
  const [prevEntriesById, setPrevEntriesById] = useState(entriesById);
  if (prevEntriesById !== entriesById) {
    setPrevEntriesById(entriesById);
    const staleIds = Array.from(selectedIds).filter((id) => !entriesById.has(id));
    if (staleIds.length > 0) setPageSelected(staleIds, false);
  }

  // Reset to page 1 during render when filters or page size change
  const [prevPageReset, setPrevPageReset] = useState({ entriesLength: entries.length, pageSize });
  if (prevPageReset.entriesLength !== entries.length || prevPageReset.pageSize !== pageSize) {
    setPrevPageReset({ entriesLength: entries.length, pageSize });
    setPage(1);
  }

  // Start/stop polling while a batch run is in-flight. The shared poller is a
  // SINGLE global interval (see run-store.ts), so an unconditional `stopPolling()`
  // here would freeze another engine's live run observation (e.g. a category-gen
  // or glossary-gen run started from a different tab) if it's still in flight
  // when this batch's tracking effect tears down. This is a minimal, local
  // guard — not a true ref-count on the store itself (that would need a
  // run-store change, out of scope here) — that checks the run list for any
  // OTHER still-active run before stopping, so this cleanup only stops the
  // poller when nothing else needs it.
  useEffect(() => {
    if (!batchRunId || !activeProjectId) return;
    startPolling(activeProjectId);
    return () => {
      const stillNeeded = useRunStore
        .getState()
        .runs.some((r) => r.runId !== batchRunId && isRunActive(r));
      if (!stillNeeded) stopPolling();
    };
  }, [batchRunId, activeProjectId, startPolling, stopPolling]);

  // Capture batch run completion during render and notify once. Clearing
  // batchRunId detaches `latestRun`, so the hook's captured snapshot is what
  // onComplete reads.
  const onBatchComplete = (c: RunCompletion) => {
    setBatchRunId(null);
    if (activeProjectId) void fetchEntries(activeProjectId);
    if (c.failed > 0) {
      toast.warning(tBatch('runCompletedWithErrors', { completed: c.completed, failed: c.failed }));
    } else if (c.status === RunStatusCode.Completed) {
      toast.success(tBatch('runCompleted', { completed: c.completed, total: c.total }));
    }
  };
  useRunCompletionNotice(batchRunId, latestRun ?? null, onBatchComplete);

  if (!activeProject) {
    return <NoProjectEmptyState message={t('empty.noProject')} />;
  }

  // Show a placeholder until this project's entries have arrived. This covers
  // both the in-flight fetch (`loading`) and the first paint before the fetch
  // effect has even fired (`loadedProjectId` still pointing elsewhere), which
  // previously flashed the "no strings" empty state. A failed fetch falls
  // through so the user is not stuck on a skeleton.
  if (!fetchError && (loading || loadedProjectId !== activeProjectId)) {
    return (
      <div
        className="flex flex-col gap-3 p-8"
        role="status"
        aria-busy="true"
        aria-label={t('empty.loading')}
        data-testid="string-table-loading"
      >
        <p className="text-muted-foreground text-sm">{t('empty.loading')}</p>
        {Array.from({ length: LOADING_SKELETON_ROWS }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  const handleSelectAll = (checked: boolean) => {
    setPageSelected(pageIds, checked);
  };

  const handleToggleRow = (id: string) => {
    toggleSelected(id);
  };

  // Closes the "Bulk Operation" popover and resets ALL of its sub-panel state,
  // not just `bulkOpOpen`/`bulkOpMode` — critically including
  // `categoriesToRemove`. Every place the popover conceptually closes (the
  // Popover's own onOpenChange, a successful add/remove/approve/ignore action)
  // must route through this ONE function: closing via a menu-row's direct
  // `setBulkOpOpen(false)` without also clearing `categoriesToRemove` would let
  // a category checked in one session's remove-category sub-panel silently
  // stay checked (though invisible, since the popover is closed) into a LATER
  // session — a later "Remove category" on a different selection could then
  // delete a category the user never actually checked this time.
  const closeBulkOp = () => {
    setBulkOpOpen(false);
    setBulkOpMode('menu');
    setCategoriesToRemove(new Set());
  };

  const handleBulkCategoryAdd = async () => {
    const category = bulkCategory.trim();
    if (!activeProjectId || visibleSelectedIds.size === 0 || category === '') return;
    try {
      // Categories vary per entry, so add the category to each entry's
      // existing set individually (the bulk endpoint applies one shared patch)
      // — bounded concurrency rather than one unbounded Promise.all.
      await mapWithConcurrency(Array.from(visibleSelectedIds), BULK_PER_ENTRY_CONCURRENCY, (id) => {
        const existing = entriesById.get(id)?.categories ?? [];
        if (existing.includes(category)) return Promise.resolve();
        return updateEntry(activeProjectId, id, { categories: [...existing, category] });
      });
      if (!categorySuggestions.includes(category)) {
        setCategorySuggestions((prev) => [...prev, category].sort((a, b) => a.localeCompare(b)));
      }
      setBulkCategory('');
      clearSelection();
      // Consolidated into the "Bulk Operation" popover: return to the menu so a
      // reopen doesn't land back on the just-applied sub-panel.
      closeBulkOp();
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.applyFailed')));
    }
  };

  const handleBulkCategoryRemove = async () => {
    if (!activeProjectId || visibleSelectedIds.size === 0 || categoriesToRemove.size === 0) return;
    try {
      // Categories vary per entry, so remove from each entry's own set
      // individually via the per-entry update path — bounded concurrency
      // rather than one unbounded Promise.all.
      await mapWithConcurrency(Array.from(visibleSelectedIds), BULK_PER_ENTRY_CONCURRENCY, (id) => {
        const existing = entriesById.get(id)?.categories ?? [];
        const filtered = existing.filter((c) => !categoriesToRemove.has(c));
        if (filtered.length === existing.length) return Promise.resolve();
        return updateEntry(activeProjectId, id, { categories: filtered });
      });
      closeBulkOp();
      clearSelection();
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.applyFailed')));
    }
  };

  // New bulk action: marks every selected entry `ignored`, excluding it from
  // all future AI dispatch (translate/judge/source-review/glossary-gen/
  // category-gen) without hiding it from the table (see StringTableRow's badge
  // and filter-entries.ts, which deliberately does not filter on this flag).
  const handleBulkIgnore = async () => {
    if (!activeProjectId || visibleSelectedIds.size === 0) return;
    try {
      // Every selected entry gets the identical patch, so this routes through
      // the chunked bulkUpdate (one PATCH per BULK_UPDATE_CHUNK_SIZE ids)
      // instead of firing N unbounded parallel PUTs.
      await bulkUpdate(activeProjectId, Array.from(visibleSelectedIds), { ignored: true });
      clearSelection();
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.applyFailed')));
    }
  };

  // Dismisses the "flagged new" review flag on every selected entry (the
  // selection-scoped half of the "Clear new flags" action — see
  // StringTableFilters.tsx's "clear ALL flagged" counterpart, which ignores
  // selection entirely). A single bulk PATCH rather than N PUTs.
  const handleClearNewFlags = async () => {
    if (!activeProjectId || visibleSelectedIds.size === 0) return;
    try {
      await bulkUpdate(activeProjectId, Array.from(visibleSelectedIds), { flaggedNew: false });
      clearSelection();
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.applyFailed')));
    }
  };

  // "AI Generation" → "Generate Categories from Selection": hands the current
  // selection off to the Category tab (see view-store's pendingCategoryGenScope)
  // and navigates there; CategoryTab picks it up on mount.
  const handleGenerateCategoriesFromSelection = () => {
    if (visibleSelectedIds.size === 0) return;
    openCategoryGenScope(Array.from(visibleSelectedIds));
  };

  const handleSelectAllFiltered = () => {
    selectAllFiltered(entries.map((e) => e.id));
  };

  // Approve every existing translation (across active target languages) for the
  // selected entries into the translation memory. Approval is the only path
  // that writes to the (global) TM — runs no longer auto-record.
  const handleApproveSelected = async () => {
    if (!activeProjectId || visibleSelectedIds.size === 0) return;
    const pairs: { entryId: string; targetLanguage: string }[] = [];
    for (const id of visibleSelectedIds) {
      const entry = entriesById.get(id);
      if (!entry) continue;
      for (const lang of batchTargetLanguages) {
        if (entry.translations[lang]?.text) pairs.push({ entryId: id, targetLanguage: lang });
      }
    }
    if (pairs.length === 0) {
      toast.info(t('bulk.approveNone'));
      return;
    }
    try {
      const { approved } = await apiRequest<{ approved: number }>(
        `/projects/${activeProjectId}/approve`,
        { method: 'POST', body: JSON.stringify({ pairs }) },
      );
      toast.success(t('bulk.approveSuccess', { count: approved }));
      await fetchEntries(activeProjectId);
      clearSelection();
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.approveFailed')));
    }
  };

  const openBatchDialog = async () => {
    setBatchMemoryCount(0);
    setBatchLocalModelCount(0);
    setConfirmBatchOpen(true);
    if (!activeProjectId || visibleSelectedIds.size === 0 || batchTargetLanguages.length === 0)
      return;
    try {
      const { memoryCount } = await apiRequest<{ memoryCount: number; total: number }>(
        `/projects/${activeProjectId}/translate/memory-preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            entryIds: Array.from(visibleSelectedIds),
            targetLanguages: batchTargetLanguages,
          }),
        },
      );
      setBatchMemoryCount(memoryCount);
    } catch {
      // Preview is advisory; a failed lookup just hides the warning.
    }
    // Mirror the default "untranslated only" run scope: an entry already
    // translated in every target language is skipped by the run, so excluding
    // it keeps the local-model toggle from appearing for a no-op split (the
    // ComparisonTab preview filters to its untranslated ids the same way).
    const previewIds = Array.from(visibleSelectedIds).filter((id) => {
      const entry = entriesById.get(id);
      return entry ? batchTargetLanguages.some((lang) => !entry.translations[lang]?.text) : true;
    });
    if (previewIds.length > 0) {
      try {
        const { models } = await apiRequest<{ models: Array<{ model: string }> }>(
          `/projects/${activeProjectId}/translate/local-model-preview`,
          {
            method: 'POST',
            body: JSON.stringify({
              entryIds: previewIds,
              targetLanguages: batchTargetLanguages,
            }),
          },
        );
        setBatchLocalModelCount(models.length);
      } catch {
        // Preview is advisory; a failed lookup leaves the toggle hidden.
      }
    }
  };

  const handleBatchTranslate = async (
    runReTranslate: boolean,
    runDisableMemory: boolean,
    grouping?: {
      batchGrouping?: BatchGroupingDimension;
      ignoreBatchSizeLimit?: boolean;
      customBatchSize?: number;
    },
    runSplitByModel?: boolean,
    exampleEntryIds?: string[],
  ) => {
    if (!activeProjectId || visibleSelectedIds.size === 0 || batchTargetLanguages.length === 0)
      return;
    setConfirmBatchOpen(false);
    batchRequestRef.current = {
      projectId: activeProjectId,
      body: JSON.stringify({
        entryIds: Array.from(visibleSelectedIds),
        targetLanguages: batchTargetLanguages,
        reTranslate: runReTranslate,
        ...(runDisableMemory ? { disableMemory: true } : {}),
        ...(grouping?.batchGrouping !== undefined
          ? {
              batchGrouping: grouping.batchGrouping,
              ignoreBatchSizeLimit: grouping.ignoreBatchSizeLimit ?? false,
            }
          : {}),
        ...(grouping?.customBatchSize !== undefined
          ? { customBatchSize: grouping.customBatchSize }
          : {}),
        ...(runSplitByModel ? { splitByModel: true } : {}),
        ...(exampleEntryIds?.length ? { exampleEntryIds } : {}),
      }),
    };
    await batchTranslate.invoke();
  };

  const handleBatchCancel = async () => {
    if (!activeProjectId || !batchRunId) return;
    try {
      await useRunStore.getState().cancelRun(activeProjectId, batchRunId);
      setBatchRunId(null);
    } catch (err) {
      toast.error(errorMessage(err, t('bulk.cancelFailed')));
    }
  };

  // Sibling of handleBatchTranslate, scoped to exactly the selection's weak
  // Freeway pairs at the chosen threshold rather than the full entryIds ×
  // targetLanguages product — the enqueue API's exact-pair intersection
  // restricts the run to those exact pairs so a good translation in another
  // language of the same entry is never overwritten, and `freewayMinTier`
  // floors the retry at a stronger tier. Fires directly (no confirm dialog):
  // the threshold select + disabled state already gate the scope, mirroring
  // the other one-click bulk actions (ignore, clear-new-flag). Reuses the
  // same vault-retry + run-tracking plumbing as "Translate Selected"
  // (batchRequestRef/batchTranslate) — the single-user model rules out two
  // batches running at once anyway (the bulk bar's Retranslate button and
  // Translate Selected are both disabled while `batchRunId` is set).
  const handleRetranslateBelowTier = async () => {
    if (!activeProjectId || retranslateBelowTier === null || retranslateBelowTierPairs.length === 0)
      return;
    const pairs = retranslateBelowTierPairs;
    const entryIds = Array.from(new Set(pairs.map((p) => p.entryId)));
    const targetLanguages = Array.from(new Set(pairs.map((p) => p.targetLanguage)));
    batchRequestRef.current = {
      projectId: activeProjectId,
      body: JSON.stringify({
        reTranslate: true,
        freewayMinTier: retranslateBelowTier,
        pairs,
        entryIds,
        targetLanguages,
      }),
    };
    await batchTranslate.invoke();
  };

  const colWidth = 220;
  const sourceColWidth = 280;
  const typeColWidth = 110;
  const sourcesColWidth = 180;
  const checkboxColWidth = 40;
  const classificationColWidth = typeColWidth + sourcesColWidth;
  const totalWidth =
    checkboxColWidth + classificationColWidth + sourceColWidth + columns.length * colWidth;

  const handleShowAll = () => {
    setFilter(DEFAULT_FILTERS);
    setFiltersResetKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="string-table">
      <StringTableFilters key={filtersResetKey} />

      {/* Top: pagination + click-to-edit detail panel */}
      <div className="flex flex-col gap-2 mb-2">
        <StringTablePagination
          entriesLength={entries.length}
          totalEntries={totalEntries}
          onShowAll={handleShowAll}
          orderMode={filters.orderMode}
          onOrderModeChange={(v) => setFilter({ orderMode: v })}
          presorting={presorting}
          activeProjectId={activeProjectId}
          onPresort={handlePresort}
          orderMeta={orderMeta}
          pageSize={pageSize}
          onPageSizeChange={(n) => setPageSize(n)}
          safePage={safePage}
          totalPages={totalPages}
          setPage={setPage}
        />
        <StringTableEditor selection={selection} onClear={() => setSelection(null)} />
      </div>

      <StringTableGrid
        sourceLanguage={activeProject.sourceLanguage}
        columns={columns}
        totalWidth={totalWidth}
        checkboxColWidth={checkboxColWidth}
        classificationColWidth={classificationColWidth}
        sourceColWidth={sourceColWidth}
        colWidth={colWidth}
        allPageSelected={allPageSelected}
        somePageSelected={somePageSelected}
        onSelectAll={handleSelectAll}
        isEmpty={entries.length === 0}
        pageEntries={pageEntries}
        selection={selection}
        onSelect={setSelection}
        selectedIds={selectedIds}
        onToggleRow={handleToggleRow}
        translatingCells={translatingCells}
        glossarySummaries={glossarySummaries}
      />

      {/* Bulk action bar */}
      {visibleSelectedIds.size > 0 && (
        <StringTableBulkBar
          isCollaborator={isCollaborator}
          visibleSelectedCount={visibleSelectedIds.size}
          selectedOffPage={selectedOffPage}
          allPageSelected={allPageSelected}
          allFilteredSelected={allFilteredSelected}
          entriesLength={entries.length}
          pageEntriesLength={pageEntries.length}
          onSelectAllFiltered={handleSelectAllFiltered}
          bulkOpOpen={bulkOpOpen}
          setBulkOpOpen={setBulkOpOpen}
          closeBulkOp={closeBulkOp}
          bulkOpMode={bulkOpMode}
          setBulkOpMode={setBulkOpMode}
          selectedCategories={selectedCategories}
          handleApproveSelected={handleApproveSelected}
          handleBulkIgnore={handleBulkIgnore}
          handleClearNewFlags={handleClearNewFlags}
          categorySuggestions={categorySuggestions}
          bulkCategory={bulkCategory}
          setBulkCategory={setBulkCategory}
          handleBulkCategoryAdd={handleBulkCategoryAdd}
          categoriesToRemove={categoriesToRemove}
          setCategoriesToRemove={setCategoriesToRemove}
          handleBulkCategoryRemove={handleBulkCategoryRemove}
          aiGenOpen={aiGenOpen}
          setAiGenOpen={setAiGenOpen}
          setGlossaryGenOpen={setGlossaryGenOpen}
          handleGenerateCategoriesFromSelection={handleGenerateCategoriesFromSelection}
          batchRunId={batchRunId}
          batchProgress={batchProgress}
          batchTargetLanguagesLength={batchTargetLanguages.length}
          translatableCount={translatableCount}
          handleBatchCancel={handleBatchCancel}
          openBatchDialog={openBatchDialog}
          retranslateBelowTier={retranslateBelowTier}
          setRetranslateBelowTier={setRetranslateBelowTier}
          retranslateBelowTierPairCount={retranslateBelowTierPairs.length}
          onRetranslateBelowTier={() => void handleRetranslateBelowTier()}
          clearSelection={clearSelection}
        />
      )}

      <TranslateRunDialog
        open={confirmBatchOpen}
        onOpenChange={setConfirmBatchOpen}
        scopeCount={visibleSelectedIds.size}
        scopeIsSelection
        referenceLanguage=""
        showReference={false}
        memoryCount={batchMemoryCount}
        localModelCount={batchLocalModelCount}
        enableExamples
        exampleCandidates={exampleCandidates}
        onStart={(opts) => {
          setReTranslate(opts.reTranslate);
          void handleBatchTranslate(
            opts.reTranslate,
            opts.disableMemory,
            {
              batchGrouping: opts.batchGrouping,
              ignoreBatchSizeLimit: opts.ignoreBatchSizeLimit,
              customBatchSize: opts.customBatchSize,
            },
            opts.splitByModel,
            opts.exampleEntryIds,
          );
        }}
      />

      {/* AI Generation → "Generate Glossary from Selection": a second,
          selection-scoped GenerateGlossaryDialog instance alongside the
          whole-project one on the Glossary tab. */}
      <GenerateGlossaryDialog
        projectId={activeProjectId ?? ''}
        open={glossaryGenOpen}
        onOpenChange={setGlossaryGenOpen}
        enabledGlossaries={enabledGlossarySummaries}
        onAccept={acceptGlossarySuggestionsFromSelection}
        entryIds={selectionEntryIds}
        sourceEntryCount={selectionSourceEntryCount}
      />
    </div>
  );
}
