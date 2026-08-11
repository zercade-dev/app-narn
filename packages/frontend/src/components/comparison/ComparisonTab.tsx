import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { RunStatusCode, type BatchGroupingDimension, type TagNode } from '@zercade-dev/narn-shared';
import { apiRequest, ApiError } from '../../hooks/use-api.js';
import { usePersistentState } from '../../hooks/use-persistent-state.js';
import {
  entryMatchesRun,
  entryMatchesSearch,
  orderByReviewSort,
} from '../../lib/filter-entries.js';
import { writableSubset } from '@/lib/collab-locks';
import { useLoggerStore } from '../../stores/logger-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useRunStore } from '../../stores/run-store.js';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { TranslateRunDialog } from './TranslateRunDialog.js';
import { UndoVersionDialog } from './UndoVersionDialog.js';
import { ComparisonToolbar } from './ComparisonToolbar.js';
import { ComparisonGrid } from './ComparisonGrid.js';
import { sortByRegistry } from '../string-table/string-table-helpers.js';
import {
  useRunCompletionNotice,
  collectRunFailureReasons,
  type RunCompletion,
} from './use-run-completion-notice.js';
import {
  COMPARE_LANG_KEY,
  COMPARE_PAGE_SIZE_KEY,
  COMPARE_REF_LANG_KEY,
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  entryHasEmptyContext,
  entryHasLqaIssue,
  entryNeedsAttention,
  entryNeedsReview,
  withParsed,
} from './comparison-tab-types.js';
import { errorMessage } from '@/lib/utils';

interface ComparisonTabProps {
  projectId: string;
  sourceLanguage: string;
  activeLanguages: string[];
}

export function ComparisonTab({
  projectId,
  sourceLanguage,
  activeLanguages,
}: Readonly<ComparisonTabProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  const { t: tBatch } = useTranslation('batch');
  const { t: tLogs } = useTranslation('logs');
  // Which languages the current access (owner/collaborator + writableLanguages)
  // may WRITE — mirrors the StringTableEditor/RunsTab wiring in collab-locks.ts.
  // Reference columns stay choosable across every active language (read-any);
  // only the write-target select is scoped.
  const access = useProjectStore((s) => accessFor(s, projectId));
  const entries = useStringStore((s) => s.entries);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const bulkUpdate = useStringStore((s) => s.bulkUpdate);
  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const fetchEntry = useStringStore((s) => s.fetchEntry);
  const loading = useStringStore((s) => s.loading);
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);
  // Shared with the multi-language text tab so the display sort is consistent
  // across both. 'custom' applies the Source-review similarity pre-sort.
  const orderMode = useStringStore((s) => s.filters.orderMode);
  const setFilter = useStringStore((s) => s.setFilter);
  const logEntries = useLoggerStore((s) => s.entries);
  const fetchRuns = useRunStore((s) => s.fetchRuns);
  const allRuns = useRunStore((s) => s.runs);

  // Per-cell in-flight retranslates, keyed by `entryId:language` (matches
  // ComparisonCell's `retranslateKey`). A Map — rather than a single slot —
  // so concurrent retranslates on different cells each resolve against their
  // own run instead of a second cell's start overwriting the first's tracked
  // run and resolver (the first cell would then spin forever and never pick
  // up its result).
  const [retranslateRuns, setRetranslateRuns] = useState<
    ReadonlyMap<string, { runId: string; entryId: string; language: string }>
  >(() => new Map());
  // Resolves `handleRetranslate`'s awaited completion promise for a given
  // cell key once that cell's run reaches a terminal status.
  const retranslateResolversRef = useRef(new Map<string, () => void>());
  // One-shot guard per cell key so a terminal run is only processed once even
  // if this effect re-fires before the Map-removal state update commits.
  const notifiedRetranslateKeysRef = useRef(new Set<string>());

  // Watch the run store (durable — polled, not SSE-only) for each in-flight
  // retranslate's terminal status. Generalizes StringTable/the old single-slot
  // useRunCompletionNotice usage to a Map, since several per-cell retranslates
  // can be in flight at once and React hooks can't be called a variable number
  // of times.
  useEffect(() => {
    if (retranslateRuns.size === 0) return;
    const finishedKeys: string[] = [];
    for (const [key, target] of retranslateRuns) {
      if (notifiedRetranslateKeysRef.current.has(key)) continue;
      const run = allRuns.find((r) => r.runId === target.runId);
      if (
        !run ||
        !(
          run.status === RunStatusCode.Completed ||
          run.status === RunStatusCode.Failed ||
          run.status === RunStatusCode.Cancelled
        )
      ) {
        continue;
      }
      notifiedRetranslateKeysRef.current.add(key);
      finishedKeys.push(key);

      void fetchEntry(projectId, target.entryId).then(() => {
        // Only flag the cell for review when the re-translation actually produced
        // a new value — a cancelled or fully-failed run leaves the translation
        // unchanged and should not mark it as needing review.
        if (run.status === RunStatusCode.Completed && run.failed === 0) {
          void bulkUpdate(projectId, [target.entryId], {
            translations: { [target.language]: { needsReview: true } },
          });
        }
      });

      retranslateResolversRef.current.get(key)?.();
      retranslateResolversRef.current.delete(key);

      if (run.failed > 0) {
        const reasons = collectRunFailureReasons(run.runId, tLogs);
        toast.warning(
          tBatch('runCompletedWithErrors', { completed: run.completed, failed: run.failed }),
          { description: reasons.length > 0 ? reasons.join(' · ') : undefined },
        );
      } else if (run.status === RunStatusCode.Completed) {
        toast.success(tBatch('runCompleted', { completed: run.completed, total: run.total }));
      }
    }
    if (finishedKeys.length > 0) {
      // Conditional, strictly size-decreasing cleanup (only removes just-
      // finished keys); cannot cascade since it never grows the map or re-adds
      // keys — safe despite the set-state-in-effect heuristic.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRetranslateRuns((prev) => {
        const next = new Map(prev);
        for (const key of finishedKeys) next.delete(key);
        return next;
      });
    }
  }, [allRuns, retranslateRuns, projectId, fetchEntry, bulkUpdate, tBatch, tLogs]);

  // Poll while any per-cell retranslate is in flight. Polling itself is
  // self-managed by the run store: `fetchRuns` (called via `applyQueuedRun`
  // below) starts its own reschedule loop whenever it observes an active run
  // and stops itself once nothing is active — see run-store.ts `fetchRuns` /
  // `pollTick`. An explicit start/stop effect here would tie the SHARED
  // global poller's lifetime to just this state slice; under concurrent
  // bulk-translate + per-cell retranslate, whichever operation's effect
  // cleanup ran first would unconditionally `stopPolling()` and tear down the
  // poller the other still-in-flight operation depends on, hanging its
  // spinner/Cancel button forever. Relying on the store's own active-run
  // bookkeeping avoids that shared-teardown hazard entirely.

  // Ensure entries are loaded when this tab is opened directly.
  useEffect(() => {
    if (projectId) void fetchEntries(projectId);
  }, [projectId, fetchEntries]);

  const [search, setSearch] = useState('');
  // The input stays controlled by `search` (so typing feels instant); the row
  // filter reads `deferredSearch` instead, so a fast typist doesn't force a
  // full row recompute on every keystroke — mirrors the 200ms debounce
  // StringTableFilters' search box uses for the same reason.
  const deferredSearch = useDeferredValue(search);
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [lqaFilter, setLqaFilter] = useState(false);
  const [needsReviewFilter, setNeedsReviewFilter] = useState(false);
  const [emptyContextOnly, setEmptyContextOnly] = useState(false);
  // Transient run-id filter ('' = all runs). Not persisted: a run id is
  // project-scoped and ephemeral.
  const [runIdFilter, setRunIdFilter] = useState('');
  // Clear the run filter during render when the project changes — a stale run
  // id from the previous project would otherwise hide every row.
  const [prevRunFilterProjectId, setPrevRunFilterProjectId] = useState(projectId);
  if (prevRunFilterProjectId !== projectId) {
    setPrevRunFilterProjectId(projectId);
    setRunIdFilter('');
  }
  const [mode, setMode] = useState<'raw' | 'rich'>('raw');
  const [isFlagging, setIsFlagging] = useState(false);
  const [isMarkingAllReviewed, setIsMarkingAllReviewed] = useState(false);
  const [bulkTranslateRunId, setBulkTranslateRunId] = useState<string | null>(null);
  const [translateDialogOpen, setTranslateDialogOpen] = useState(false);
  // Pairs in the about-to-run scope that would auto-apply from translation
  // memory; computed via the dry-run preview endpoint when the dialog opens.
  const [translateMemoryCount, setTranslateMemoryCount] = useState(0);
  // Distinct local Ollama models the run would route to; computed via the
  // dry-run preview endpoint when the dialog opens. ≥2 enables the
  // "run one local model at a time" toggle.
  const [translateLocalModelCount, setTranslateLocalModelCount] = useState(0);
  // The (entry, language) whose previous-versions picker is open; null keeps
  // the dialog closed.
  const [undoTarget, setUndoTarget] = useState<{ entryId: string; language: string } | null>(null);

  // Row selection for batch translation. Local to this tab on purpose: the
  // shared selection store drives the String table and the Batch tab's run
  // scope, and reusing it here would bleed selections across tabs.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setPageSelected = useCallback((ids: string[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set<string>()), []);

  // Candidate target languages (non-source, registry-ordered), further
  // scoped to the languages this access may WRITE — a no-op filter for
  // owners (writableSubset/canWriteLanguage always allow owners), so this is
  // byte-identical to the prior unfiltered list for them.
  const targetCandidates = useMemo(
    () =>
      writableSubset(access, sortByRegistry(activeLanguages.filter((l) => l !== sourceLanguage))),
    [activeLanguages, sourceLanguage, access],
  );

  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    const saved = localStorage.getItem(COMPARE_LANG_KEY) ?? '';
    if (saved && targetCandidates.includes(saved)) return saved;
    return targetCandidates[0] ?? '';
  });

  // Reconcile during render when active languages change (the guards make
  // this converge in one re-render).
  if (targetCandidates.length === 0) {
    if (selectedLanguage !== '') setSelectedLanguage('');
  } else if (!targetCandidates.includes(selectedLanguage)) {
    setSelectedLanguage(targetCandidates[0]);
  }

  // Persist the language choice.
  useEffect(() => {
    if (selectedLanguage) localStorage.setItem(COMPARE_LANG_KEY, selectedLanguage);
  }, [selectedLanguage]);

  const targetLang = selectedLanguage;

  // Reference language (read-only comparison column, optional).
  const referenceCandidates = useMemo(
    () =>
      sortByRegistry(activeLanguages.filter((l) => l !== sourceLanguage && l !== selectedLanguage)),
    [activeLanguages, sourceLanguage, selectedLanguage],
  );

  const [referenceLanguage, setReferenceLanguage] = useState<string>(() => {
    const saved = localStorage.getItem(COMPARE_REF_LANG_KEY) ?? '';
    if (
      saved &&
      saved !== sourceLanguage &&
      saved !== selectedLanguage &&
      activeLanguages.includes(saved)
    )
      return saved;
    return '';
  });

  // Drop reference lang (during render) if it becomes the target lang,
  // becomes source lang, or leaves active languages.
  if (
    referenceLanguage &&
    (referenceLanguage === selectedLanguage ||
      referenceLanguage === sourceLanguage ||
      !activeLanguages.includes(referenceLanguage))
  ) {
    setReferenceLanguage('');
  }

  // Persist reference language choice. Only persist a non-empty value (mirroring
  // the target-language effect) so a transient during-render clear — e.g. when
  // the reference collides with a freshly-defaulted target — does not wipe the
  // user's saved choice from storage.
  useEffect(() => {
    if (referenceLanguage) localStorage.setItem(COMPARE_REF_LANG_KEY, referenceLanguage);
  }, [referenceLanguage]);

  const rows = useMemo(() => {
    let base = entries.filter((e) => e.needsTranslation !== false);
    // Free-text search over source + translation text (independent of the
    // status filters and target language). Reads the deferred value, not
    // `search`, so this recompute lags fast typing instead of running per
    // keystroke.
    const needle = deferredSearch.trim().toLowerCase();
    if (needle) {
      base = base.filter((e) => entryMatchesSearch(e, needle));
    }
    // Run-id filter is independent of the target language: an entry matches if
    // any of its translations was produced by the selected run.
    if (runIdFilter) {
      base = base.filter((e) => entryMatchesRun(e, runIdFilter));
    }
    const anyFilterActive = untranslatedOnly || lqaFilter || needsReviewFilter || emptyContextOnly;
    const filtered =
      !anyFilterActive || !targetLang
        ? base
        : base.filter(
            (e) =>
              (untranslatedOnly && entryNeedsAttention(e, targetLang)) ||
              (lqaFilter && entryHasLqaIssue(e, targetLang)) ||
              (needsReviewFilter && entryNeedsReview(e, targetLang)) ||
              (emptyContextOnly && entryHasEmptyContext(e)),
          );
    // Display-only re-order applied last so every downstream memo (visible ids,
    // select-all, pagination) inherits it. 'custom' = Source-review pre-sort.
    return orderMode === 'custom' ? orderByReviewSort(filtered) : filtered;
  }, [
    entries,
    targetLang,
    deferredSearch,
    untranslatedOnly,
    lqaFilter,
    needsReviewFilter,
    emptyContextOnly,
    runIdFilter,
    orderMode,
  ]);

  // Ids of the currently-visible (filtered) rows. Built once per `rows` change
  // and reused for selection intersection and select-all, so a row recompute
  // doesn't re-scan the list multiple times per render.
  const visibleIds = useMemo(() => new Set(rows.map((e) => e.id)), [rows]);

  // Selection restricted to the current filtered view, so entries hidden by
  // filters (or removed) never enter a translation run. The empty-selection
  // short-circuit means a search keystroke with no selection skips the scan.
  const effectiveSelection = useMemo(() => {
    if (selectedIds.size === 0) return selectedIds;
    const next = new Set<string>();
    for (const id of selectedIds) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selectedIds, visibleIds]);

  // Select every entry in the current filtered view (across all pages), not
  // just the visible page that the header checkbox toggles.
  const selectAllRows = useCallback(() => {
    setSelectedIds(new Set(visibleIds));
  }, [visibleIds]);

  // Live "X/Y" progress numbers for the toolbar, sourced from SSE
  // `translation:progress` events. Best-effort/display-only: a dropped final
  // SSE event (e.g. on reconnect) just leaves this stale until the run store
  // catches up — it does NOT gate completion (see below).
  const latestBulkRun = useRunStore((s) => s.runs?.find((r) => r.runId === bulkTranslateRunId));
  const bulkTranslateProgress = useMemo(() => {
    if (!bulkTranslateRunId) return null;
    const events = logEntries.filter(
      (e) => e.message === 'translation:progress' && e.metadata?.runId === bulkTranslateRunId,
    );
    const latest = events.at(-1);
    if (!latest) {
      // Fall back to the run store's own totals (durable — reflects the
      // polled run status even when no SSE progress event has landed yet).
      if (latestBulkRun) {
        return {
          completed: latestBulkRun.completed,
          failed: latestBulkRun.failed,
          total: latestBulkRun.total,
        };
      }
      return null;
    }
    return {
      completed: Number(latest.metadata?.completed ?? 0),
      failed: Number(latest.metadata?.failed ?? 0),
      total: Number(latest.metadata?.total ?? 0),
    };
  }, [logEntries, bulkTranslateRunId, latestBulkRun]);

  // Completion is derived from the run store's polled status — durable,
  // unlike the SSE `translation:progress` stream, which can drop its final
  // event across a reconnect and leave the spinner/Cancel button stuck
  // forever with no refresh. Mirrors StringTable's batch-translate tracking.
  const onBulkTranslateComplete = (c: RunCompletion) => {
    setBulkTranslateRunId(null);
    void fetchEntries(projectId);
    if (c.failed > 0) {
      // Surface why jobs failed (e.g. "module-disabled", "no-route") instead of
      // a bare failure count — otherwise a fully-failed run (e.g. pseudo target
      // with the pseudo module disabled) looks like it failed for no reason.
      const reasons = collectRunFailureReasons(c.runId, tLogs);
      toast.warning(
        tBatch('runCompletedWithErrors', { completed: c.completed, failed: c.failed }),
        {
          description: reasons.length > 0 ? reasons.join(' · ') : undefined,
        },
      );
    } else if (c.status === RunStatusCode.Completed) {
      toast.success(tBatch('runCompleted', { completed: c.completed, total: c.total }));
    }
  };
  useRunCompletionNotice(bulkTranslateRunId, latestBulkRun ?? null, onBulkTranslateComplete);

  // Polling while a bulk-translate run is in-flight is likewise self-managed
  // by the run store (see the comment on the retranslate effect above) — the
  // `fetchRuns` call in `handleBulkTranslate` below is what arms it; no
  // explicit start/stop effect is needed (or safe under concurrency) here.

  // Pagination state. The page size is persisted as a JSON number (matching the
  // prior `String(pageSize)` writes, which round-trip through JSON unchanged);
  // the validate restricts a stored value to the offered options, falling back
  // to the default for anything else — exactly the old readPersistedPageSize.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePersistentState<number>(
    COMPARE_PAGE_SIZE_KEY,
    DEFAULT_PAGE_SIZE,
    { validate: (v): v is number => typeof v === 'number' && PAGE_SIZE_OPTIONS.includes(v) },
  );

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  // Reset to page 1 during render when filters / language / data / page-size change.
  const pageResetKey = {
    rowsLength: rows.length,
    targetLang,
    search,
    untranslatedOnly,
    lqaFilter,
    needsReviewFilter,
    emptyContextOnly,
    runIdFilter,
    pageSize,
  };
  const [prevPageResetKey, setPrevPageResetKey] = useState(pageResetKey);
  if (
    prevPageResetKey.rowsLength !== pageResetKey.rowsLength ||
    prevPageResetKey.targetLang !== pageResetKey.targetLang ||
    prevPageResetKey.search !== pageResetKey.search ||
    prevPageResetKey.untranslatedOnly !== pageResetKey.untranslatedOnly ||
    prevPageResetKey.lqaFilter !== pageResetKey.lqaFilter ||
    prevPageResetKey.needsReviewFilter !== pageResetKey.needsReviewFilter ||
    prevPageResetKey.emptyContextOnly !== pageResetKey.emptyContextOnly ||
    prevPageResetKey.runIdFilter !== pageResetKey.runIdFilter ||
    prevPageResetKey.pageSize !== pageResetKey.pageSize
  ) {
    setPrevPageResetKey(pageResetKey);
    setPage(1);
  }

  const pageEntries = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );

  const knownTones = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.metadata?.tone) set.add(entry.metadata.tone);
    }
    return Array.from(set).sort();
  }, [entries]);

  const pageIds = useMemo(() => pageEntries.map((e) => e.id), [pageEntries]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => effectiveSelection.has(id));
  const somePageSelected = pageIds.some((id) => effectiveSelection.has(id));

  // Status counts for the target language column header.
  const reviewStats = useMemo(() => {
    if (!targetLang) return { translatedCount: 0, reviewedCount: 0 };
    let translatedCount = 0;
    let reviewedCount = 0;
    for (const e of rows) {
      const status = e.translations[targetLang]?.status;
      if (status === 'translated') translatedCount++;
      else if (status === 'reviewed') reviewedCount++;
    }
    return { translatedCount, reviewedCount };
  }, [rows, targetLang]);

  // Tag-parse cache (entryId::language::text). Held in state so renders only
  // read it; the effect below requests parses for whatever the current page
  // shows in rich mode.
  const [parseCache, setParseCache] = useState<ReadonlyMap<string, TagNode[]>>(() => new Map());
  const pendingRef = useRef(new Set<string>());

  // Drop the cache when the project changes so a new project doesn't start with
  // a full, irrelevant cache. (A parse request already in flight for the old
  // project may still insert one stale entry on resolve; keys are
  // entry-id-scoped so it is harmless and FIFO-evicted.) The in-flight set is
  // cleared in an effect because refs must not be written during render.
  const [prevParseCacheProjectId, setPrevParseCacheProjectId] = useState(projectId);
  if (prevParseCacheProjectId !== projectId) {
    setPrevParseCacheProjectId(projectId);
    setParseCache(new Map());
  }
  useEffect(() => {
    pendingRef.current = new Set();
  }, [projectId]);

  const getNodes = useCallback(
    (entryId: string, language: string, text: string): TagNode[] | undefined => {
      if (!text) return undefined;
      return parseCache.get(`${entryId}::${language}::${text}`);
    },
    [parseCache],
  );

  useEffect(() => {
    if (mode !== 'rich') return;
    const wanted: { key: string; text: string }[] = [];
    for (const entry of pageEntries) {
      const cellTexts: [string, string][] = [[sourceLanguage, entry.sourceText]];
      if (targetLang) cellTexts.push([targetLang, entry.translations[targetLang]?.text ?? '']);
      if (referenceLanguage) {
        cellTexts.push([referenceLanguage, entry.translations[referenceLanguage]?.text ?? '']);
      }
      for (const [language, text] of cellTexts) {
        if (text) wanted.push({ key: `${entry.id}::${language}::${text}`, text });
      }
    }
    for (const { key, text } of wanted) {
      if (parseCache.has(key) || pendingRef.current.has(key)) continue;
      pendingRef.current.add(key);
      apiRequest<TagNode[]>(`/projects/${projectId}/parse-tags`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
        .then((nodes) => {
          pendingRef.current.delete(key);
          setParseCache((prev) => withParsed(prev, key, nodes));
        })
        .catch((err: unknown) => {
          pendingRef.current.delete(key);
          setParseCache((prev) => withParsed(prev, key, [{ type: 'text', content: text }]));
          if (err instanceof Error) console.warn('parse-tags failed', err.message);
        });
    }
  }, [mode, pageEntries, sourceLanguage, targetLang, referenceLanguage, parseCache, projectId]);

  const handleSaveTranslation = useCallback(
    async (entryId: string, language: string, text: string): Promise<void> => {
      // The text shown before this edit; restoring it is the Undo action below.
      const prior = entries.find((e) => e.id === entryId)?.translations[language];
      const priorText = prior?.text ?? '';
      try {
        await updateEntry(projectId, entryId, {
          translations: {
            [language]: {
              text,
              status: text ? 'translated' : 'pending',
              moduleId: 'manual',
              timestamp: Date.now(),
              needsReview: Boolean(text),
            },
          },
        });
        // Offer to undo back to the prior record. Only when text actually
        // changed and there was a non-empty prior value to restore. Restores
        // the full prior record (status/needsReview/moduleId) — not just text —
        // so an undo does not silently re-flag a previously reviewed cell.
        if (prior && priorText && priorText !== text) {
          toast.success(t('compare.editSaved'), {
            action: {
              label: t('compare.undo'),
              onClick: () => {
                void updateEntry(projectId, entryId, {
                  translations: { [language]: { ...prior, timestamp: Date.now() } },
                }).catch((err: unknown) => {
                  toast.error(errorMessage(err, 'Failed to undo'));
                });
              },
            },
          });
        }
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to save translation'));
      }
    },
    [projectId, updateEntry, entries, t],
  );

  const handleRestoreVersion = useCallback(
    async (version: { text: string; moduleId: string; timestamp: number }): Promise<void> => {
      if (!undoTarget) return;
      try {
        await updateEntry(projectId, undoTarget.entryId, {
          translations: {
            [undoTarget.language]: {
              text: version.text,
              status: 'translated',
              moduleId: 'manual',
              timestamp: Date.now(),
              needsReview: true,
            },
          },
        });
        toast.success(t('compare.undoRestored'));
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to restore version'));
        throw err;
      }
    },
    [projectId, undoTarget, updateEntry, t],
  );

  const handleRetranslate = useCallback(
    async (entryId: string, language: string): Promise<void> => {
      const key = `${entryId}:${language}`;
      const completionPromise = new Promise<void>((resolve) => {
        retranslateResolversRef.current.set(key, resolve);
      });
      const applyQueuedRun = (result: { runId: string; total: number }) => {
        // A retry of a previously-terminal run at this key would otherwise be
        // skipped as already-notified.
        notifiedRetranslateKeysRef.current.delete(key);
        setRetranslateRuns((prev) => {
          const next = new Map(prev);
          next.set(key, { runId: result.runId, entryId, language });
          return next;
        });
        void fetchRuns(projectId);
        toast.info('Re-translation queued');
      };
      try {
        const result = await apiRequest<{ runId: string; total: number }>(
          `/projects/${projectId}/translate`,
          {
            method: 'POST',
            body: JSON.stringify({
              entryIds: [entryId],
              targetLanguages: [language],
              reTranslate: true,
            }),
            vaultRetryKey: key,
            onVaultLockedRetry: applyQueuedRun,
          },
        );
        applyQueuedRun(result);
        await completionPromise;
      } catch (err) {
        // Resolve the leaked completion promise and clear the stashed resolver
        // before bailing — otherwise the awaited promise stays pending forever
        // and the resolver map is left holding a stale entry for this cell.
        retranslateResolversRef.current.get(key)?.();
        retranslateResolversRef.current.delete(key);
        if (err instanceof ApiError && err.status === 423) return;
        toast.error(errorMessage(err, 'Failed to queue re-translation'));
      }
    },
    [projectId, fetchRuns],
  );

  const handleMarkReviewed = useCallback(
    async (entryId: string, language: string): Promise<void> => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const rec = entry.translations[language];
      if (!rec) return;
      try {
        await updateEntry(projectId, entryId, {
          translations: {
            [language]: {
              ...rec,
              status: 'reviewed',
              needsReview: false,
            },
          },
        });
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to mark as reviewed'));
      }
    },
    [projectId, updateEntry, entries],
  );

  const handleSaveContext = useCallback(
    async (entryId: string, value: string): Promise<void> => {
      try {
        await updateEntry(projectId, entryId, { context: value });
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to save context'));
      }
    },
    [projectId, updateEntry],
  );

  const handleSaveTone = useCallback(
    async (entryId: string, value: string): Promise<void> => {
      const entry = entries.find((e) => e.id === entryId);
      try {
        await updateEntry(projectId, entryId, { metadata: { ...entry?.metadata, tone: value } });
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to save tone'));
      }
    },
    [projectId, updateEntry, entries],
  );

  const handleToggleIgnored = useCallback(
    async (entryId: string): Promise<void> => {
      const entry = entries.find((e) => e.id === entryId);
      try {
        await updateEntry(projectId, entryId, { ignored: !entry?.ignored });
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to update entry'));
      }
    },
    [projectId, updateEntry, entries],
  );

  const handleFlagAllNeedsReview = useCallback(async (): Promise<void> => {
    if (!targetLang) return;
    const ids = rows.filter((e) => e.translations[targetLang]?.text).map((e) => e.id);
    if (ids.length === 0) {
      toast.error(t('compare.flagAllNeedsReviewNone'));
      return;
    }
    setIsFlagging(true);
    try {
      await bulkUpdate(projectId, ids, {
        translations: { [targetLang]: { needsReview: true } },
      });
      toast.success(t('compare.flagAllNeedsReviewDone', { count: ids.length }));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to flag translations'));
    } finally {
      setIsFlagging(false);
    }
  }, [projectId, targetLang, rows, bulkUpdate, t]);

  const handleMarkAllReviewed = useCallback(async (): Promise<void> => {
    if (!targetLang) return;
    const ids = rows
      .filter((e) => e.translations[targetLang]?.status === 'translated')
      .map((e) => e.id);
    if (ids.length === 0) {
      toast.error(t('compare.markAllReviewedNone'));
      return;
    }
    setIsMarkingAllReviewed(true);
    try {
      await bulkUpdate(projectId, ids, {
        translations: { [targetLang]: { status: 'reviewed', needsReview: false } },
      });
      toast.success(t('compare.markAllReviewedDone', { count: ids.length }));
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to mark translations as reviewed'));
    } finally {
      setIsMarkingAllReviewed(false);
    }
  }, [projectId, targetLang, rows, bulkUpdate, t]);

  const openTranslateDialog = useCallback(async (): Promise<void> => {
    if (!targetLang) return;
    setTranslateMemoryCount(0);
    setTranslateLocalModelCount(0);
    setTranslateDialogOpen(true);
    const scope =
      effectiveSelection.size > 0 ? rows.filter((e) => effectiveSelection.has(e.id)) : rows;
    // The dialog defaults to "only fill untranslated entries", so preview the
    // memory count against exactly that scope — counting already-translated
    // entries (which a default run skips) would over-state the warning.
    const ids = scope.filter((e) => !e.translations[targetLang]?.text).map((e) => e.id);
    if (ids.length === 0) return;
    try {
      const { memoryCount } = await apiRequest<{ memoryCount: number; total: number }>(
        `/projects/${projectId}/translate/memory-preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryIds: ids, targetLanguages: [targetLang] }),
        },
      );
      setTranslateMemoryCount(memoryCount);
    } catch {
      // Preview is advisory; a failed lookup just hides the warning.
    }
    try {
      const { models } = await apiRequest<{ models: Array<{ model: string }> }>(
        `/projects/${projectId}/translate/local-model-preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entryIds: ids, targetLanguages: [targetLang] }),
        },
      );
      setTranslateLocalModelCount(models.length);
    } catch {
      // Preview is advisory; a failed lookup leaves the toggle hidden.
    }
  }, [projectId, targetLang, rows, effectiveSelection]);

  const handleBulkTranslate = useCallback(
    async (opts: {
      reTranslate: boolean;
      useReference: boolean;
      disableMemory: boolean;
      batchGrouping?: BatchGroupingDimension;
      ignoreBatchSizeLimit?: boolean;
      customBatchSize?: number;
      splitByModel?: boolean;
    }): Promise<void> => {
      if (!targetLang) return;
      const scope =
        effectiveSelection.size > 0 ? rows.filter((e) => effectiveSelection.has(e.id)) : rows;
      const ids = opts.reTranslate
        ? scope.map((e) => e.id)
        : scope.filter((e) => !e.translations[targetLang]?.text).map((e) => e.id);
      if (ids.length === 0) {
        toast.error(t('compare.translateNothingToDo'));
        return;
      }
      try {
        const result = await apiRequest<{ runId: string; total: number }>(
          `/projects/${projectId}/translate`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entryIds: ids,
              targetLanguages: [targetLang],
              reTranslate: opts.reTranslate,
              ...(opts.useReference && referenceLanguage ? { referenceLanguage } : {}),
              ...(opts.disableMemory ? { disableMemory: true } : {}),
              ...(opts.batchGrouping !== undefined
                ? {
                    batchGrouping: opts.batchGrouping,
                    ignoreBatchSizeLimit: opts.ignoreBatchSizeLimit ?? false,
                  }
                : {}),
              ...(opts.customBatchSize !== undefined
                ? { customBatchSize: opts.customBatchSize }
                : {}),
              ...(opts.splitByModel ? { splitByModel: true } : {}),
            }),
          },
        );
        setBulkTranslateRunId(result.runId);
        // Ensures the run store observes this run (and starts polling it) even
        // before the effect above re-runs, so completion is derived from run
        // status rather than depending solely on the SSE progress stream.
        void fetchRuns(projectId);
        setTranslateDialogOpen(false);
      } catch (err) {
        toast.error(errorMessage(err, 'Failed to start translation'));
      }
    },
    [projectId, targetLang, rows, effectiveSelection, referenceLanguage, t, fetchRuns],
  );

  const handleBulkTranslateCancel = useCallback(async (): Promise<void> => {
    if (!bulkTranslateRunId) return;
    try {
      await apiRequest(`/projects/${projectId}/translate/${bulkTranslateRunId}`, {
        method: 'DELETE',
      });
    } catch {
      // ignore cancel errors
    }
    setBulkTranslateRunId(null);
    toast.info(tBatch('runCancelled').replace(':', '').trim());
  }, [projectId, bulkTranslateRunId, tBatch]);

  const colTemplate = (() => {
    if (!targetLang) return '36px minmax(0, 1fr) minmax(0, 1fr)';
    if (referenceLanguage) {
      return '36px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)';
    }
    return '36px minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)';
  })();

  // Minimum readable width per flexible (non-checkbox) column. With `1fr`
  // columns the grid otherwise squishes to fit any width; pinning a min width
  // makes the matrix scroll horizontally inside its overflow-auto container on
  // narrow/phone viewports instead of collapsing. Header and rows share this so
  // their sticky columns stay aligned while scrolling.
  const MIN_FLEX_COL_PX = 240;
  const flexColCount = 2 + (targetLang ? 1 : 0) + (referenceLanguage ? 1 : 0);
  const gridMinWidth = 36 + flexColCount * MIN_FLEX_COL_PX;

  if (loading || loadedProjectId !== projectId) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
        data-testid="comparison-tab-loading"
      >
        {t('compare.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="comparison-tab">
      {access.role === 'collaborator' && (
        <div
          className="px-3 py-1.5 text-xs text-muted-foreground border-b border-border shrink-0"
          data-testid="comparison-collab-hint"
        >
          {t('collab:locks.compareTargetsScoped')}
        </div>
      )}
      <ComparisonToolbar
        search={search}
        onSearchChange={setSearch}
        selectedLanguage={selectedLanguage}
        onSelectedLanguageChange={setSelectedLanguage}
        targetCandidates={targetCandidates}
        referenceLanguage={referenceLanguage}
        onReferenceLanguageChange={setReferenceLanguage}
        referenceCandidates={referenceCandidates}
        untranslatedOnly={untranslatedOnly}
        onUntranslatedOnlyChange={setUntranslatedOnly}
        lqaFilter={lqaFilter}
        onLqaFilterChange={setLqaFilter}
        needsReviewFilter={needsReviewFilter}
        onNeedsReviewFilterChange={setNeedsReviewFilter}
        emptyContextOnly={emptyContextOnly}
        onEmptyContextOnlyChange={setEmptyContextOnly}
        projectId={projectId}
        runIdFilter={runIdFilter}
        onRunIdFilterChange={setRunIdFilter}
        mode={mode}
        onModeChange={setMode}
        targetLang={targetLang}
        rowsLength={rows.length}
        onFlagAllNeedsReview={handleFlagAllNeedsReview}
        isFlagging={isFlagging}
        onMarkAllReviewed={handleMarkAllReviewed}
        isMarkingAllReviewed={isMarkingAllReviewed}
        bulkTranslateRunId={bulkTranslateRunId}
        bulkTranslateProgress={bulkTranslateProgress}
        onBulkTranslateCancel={handleBulkTranslateCancel}
        onOpenTranslateDialog={openTranslateDialog}
        effectiveSelectionSize={effectiveSelection.size}
        onSelectAllRows={selectAllRows}
        onClearSelection={clearSelection}
        orderMode={orderMode ?? 'import'}
        onOrderModeChange={setFilter}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        safePage={safePage}
        totalPages={totalPages}
        onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
        onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
      />

      <ComparisonGrid
        colTemplate={colTemplate}
        gridMinWidth={gridMinWidth}
        sourceLanguage={sourceLanguage}
        targetLang={targetLang}
        referenceLanguage={referenceLanguage}
        reviewStats={reviewStats}
        mode={mode}
        pageEntries={pageEntries}
        pageIds={pageIds}
        allPageSelected={allPageSelected}
        somePageSelected={somePageSelected}
        onPageSelectedChange={setPageSelected}
        effectiveSelection={effectiveSelection}
        onToggleSelected={toggleSelected}
        getNodes={getNodes}
        onSaveTranslation={handleSaveTranslation}
        onRetranslate={handleRetranslate}
        onMarkReviewed={handleMarkReviewed}
        onSaveContext={handleSaveContext}
        onSaveTone={handleSaveTone}
        knownTones={knownTones}
        onOpenUndo={(entryId, language) => setUndoTarget({ entryId, language })}
        onToggleIgnored={handleToggleIgnored}
        projectId={projectId}
      />

      <TranslateRunDialog
        open={translateDialogOpen}
        onOpenChange={setTranslateDialogOpen}
        scopeCount={effectiveSelection.size > 0 ? effectiveSelection.size : rows.length}
        scopeIsSelection={effectiveSelection.size > 0}
        referenceLanguage={referenceLanguage}
        memoryCount={translateMemoryCount}
        localModelCount={translateLocalModelCount}
        onStart={(opts) => void handleBulkTranslate(opts)}
      />

      <UndoVersionDialog
        open={undoTarget !== null}
        onOpenChange={(open) => {
          if (!open) setUndoTarget(null);
        }}
        language={undoTarget?.language ?? ''}
        record={
          undoTarget
            ? entries.find((e) => e.id === undoTarget.entryId)?.translations[undoTarget.language]
            : undefined
        }
        onRestore={handleRestoreVersion}
      />
    </div>
  );
}
