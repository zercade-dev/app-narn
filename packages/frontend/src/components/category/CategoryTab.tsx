/**
 * Category tab (content section).
 *
 * Browse view: the project's categories are shown as TABS; selecting one lists
 * the entries that carry it (read-only) and exposes an editable description.
 * Categories have no standalone storage — they exist via entry assignment
 * (mirroring the server's `getCategories`) — so descriptions are kept in a
 * per-project side-map (`Project.categoryDescriptions`).
 *
 * Assignment of a category to an entry is done from the Multi-language text tab
 * (per-entry, via the row context menu); this view deliberately offers no manual
 * "apply to entries" affordance. AI generation is kept: it suggests
 * `{ category, entryIds }` groups and bulk-applies the accepted ones.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Loader2, Save, Sparkles, Tags, Trash2, X } from 'lucide-react';
import {
  RunStatusCode,
  CATEGORY_CHUNK_SIZE,
  type EntryContextField,
  type GlossarySummary,
  type JudgeLogEntry,
  type Project,
  type StringEntry,
} from '@zercade-dev/narn-shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ModuleSelect } from '@/components/ui/module-select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RunProgressCard } from '@/components/common/RunProgressCard';
import { isRunActive } from '@/lib/run-kind';
import { isOfferableModule, basesWithInstances, isEnabledModule } from '@/lib/module-options';
import { cn, errorMessage } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { apiRequest } from '../../hooks/use-api.js';
import { useAsyncAction } from '../../hooks/use-async-action.js';
import { useAsyncData } from '../../hooks/use-async-data.js';
import { useVaultRetryAction } from '../../hooks/use-vault-retry-action.js';
import { useStringStore } from '../../stores/string-store.js';
import { useRunStore } from '../../stores/run-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { useModules } from '../../hooks/use-modules.js';
import { ModuleModelSelector } from '../config/ModuleModelSelector.js';
import { useConfidenceContext } from '../../hooks/use-confidence-context.js';
import { ModuleReasoningEffortSelect } from '../config/ModuleReasoningEffortSelect.js';
import { SubmitButton } from '../review/review-shared.js';
import { RunLogsPanel } from '../review/RunLogsPanel.js';
import {
  GenerationContextControls,
  type GenerationContextValue,
} from '../generation/GenerationContextControls.js';
import { useDialogSettings } from '../../hooks/use-dialog-settings.js';
import { asGroupingChoice } from '../config/BatchGroupingControls.js';

/** Last-used per-browser values. Scoped entry ids are NOT persisted (run-specific). */
const CATEGORY_GEN_SETTINGS_DEFAULTS = {
  moduleId: '',
  model: '',
  reasoningEffort: '',
  includeExisting: true,
  contextFields: [] as string[],
  contextLanguages: [] as string[],
  grouping: 'default' as string,
  ignoreLimit: false,
  customBatchSize: 20,
  skipCategories: [] as string[],
  ignoreGlossaries: [] as string[],
};

/**
 * Module ids the server can run category generation with (mirrors
 * `CATEGORY_CAPABLE_MODULES` in M5). Copilot is excluded — it can judge but the
 * server does not wire it for structured category generation.
 */
const CATEGORY_CAPABLE_MODULE_IDS = new Set([
  'openai',
  'anthropic',
  'google',
  'deepseek',
  'openrouter',
  'generic-ai',
]);

/** Max length of a category description (mirrors the server schema). */
const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Matches an inline markup tag (`<b>`, `</i>`, `<color=#fff>`, `<size=24>`, …) —
 * the subset of M14 TagParser's grammar relevant to a plain-text preview. These
 * entry-preview rows render many rows at once (no per-row async cost is
 * acceptable here, unlike the Comparison tab's rich view which round-trips
 * through the `/parse-tags` endpoint + `RichRenderer` for a handful of visible
 * cells), so tags are stripped to dimmed literals rather than fully parsed into
 * a tree. Never uses `dangerouslySetInnerHTML` — output stays plain React text
 * nodes.
 */
const INLINE_TAG_RE = /<\/?[a-zA-Z][\w-]*(?:=[^<>]*)?>/g;

/** Renders `text` with inline markup tags dimmed instead of shown as raw source. */
function renderTaggedPreview(text: string): React.ReactNode {
  const tags = text.match(INLINE_TAG_RE) ?? [];
  if (tags.length === 0) return text;
  const segments = text.split(INLINE_TAG_RE);
  const nodes: React.ReactNode[] = [];
  segments.forEach((segment, i) => {
    if (segment) nodes.push(<span key={`s${i}`}>{segment}</span>);
    if (tags[i]) {
      nodes.push(
        <span key={`g${i}`} className="text-muted-foreground/60">
          {tags[i]}
        </span>,
      );
    }
  });
  return nodes;
}

interface CategorySuggestionEntry {
  id: string;
  sourceText: string;
}

interface CategorySuggestion {
  category: string;
  entryIds: string[];
  /** Resolved entries (id + source text), for the expandable per-category preview. */
  entries?: CategorySuggestionEntry[];
}

export function CategoryTab({ projectId }: { readonly projectId: string }): React.JSX.Element {
  const { t } = useTranslation('category');

  const entries = useStringStore((s) => s.entries);
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);
  const fetchEntries = useStringStore((s) => s.fetchEntries);

  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const fetchProjects = useProjectStore((s) => s.fetchProjects);

  const [categories, setCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  // The category whose entries + description are shown. Kept valid as the list
  // loads/changes (see refreshCategories).
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Description editing — draft synced to the selected category's stored value.
  const [descDraft, setDescDraft] = useState('');
  const [descCat, setDescCat] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // AI generation state.
  const { read: readSettings, save: saveSettings } = useDialogSettings(
    'category-gen',
    CATEGORY_GEN_SETTINGS_DEFAULTS,
  );
  const [aiOpen, setAiOpen] = useState(false);
  const modules = useModules();
  const [userModuleId, setUserModuleId] = useState<string | null>(null);
  const [userModel, setUserModel] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState('');
  const confidenceContext = useConfidenceContext('category-gen', reasoningEffort);
  const [includeExisting, setIncludeExisting] = useState(true);
  const [genContext, setGenContext] = useState<GenerationContextValue>({
    contextFields: [],
    contextLanguages: [],
    grouping: 'default',
    ignoreLimit: project?.ignoreBatchSizeLimit ?? false,
    customBatchSize: 20,
    skipCategories: [],
    ignoreGlossaries: [],
  });
  // The project's glossaries, fetched lazily so the "ignore glossaries" picker
  // can list them by name; mirrors GenerateGlossaryDialog's `availableCategories`
  // fetch. Only enabled glossaries are offerable, matching GlossaryTab's own
  // `enabledGlossaries` filter for the same dialog elsewhere.
  const { data: availableGlossaries } = useAsyncData<GlossarySummary[]>(
    async (signal) => {
      if (!projectId) return [];
      try {
        const list = await apiRequest<GlossarySummary[]>(`/projects/${projectId}/glossaries`, {
          signal,
        });
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    [projectId],
    { initial: [] },
  );

  // Background category-generation run tracking. `startedRunId` is a run the
  // user explicitly kicked off this mount; its progress is read from the shared
  // run store, which polls the server. The user can navigate away and the run
  // keeps going.
  const [startedRunId, setStartedRunId] = useState<string | null>(null);
  // Guards the one-time suggestion load when the observed run completes.
  const loadedRunRef = useRef<string | null>(null);
  // The in-flight run we're observing, remembered so its terminal transition is
  // still handled after it drops out of `activeRun` (see below).
  const observedRunRef = useRef<string | null>(null);

  const runs = useRunStore((s) => s.runs);
  const fetchCategorySuggestions = useRunStore((s) => s.fetchCategorySuggestions);
  const fetchJudgeLogs = useRunStore((s) => s.fetchJudgeLogs);
  const fetchRuns = useRunStore((s) => s.fetchRuns);
  const startPolling = useRunStore((s) => s.startPolling);

  // Deep-link from the Activity tab's "review suggestions" action: a completed
  // category-gen run whose suggestions should be reopened here, even after the
  // mount that started it is gone.
  const suggestionRunId = useViewStore((s) => s.suggestionRunId);
  const clearSuggestionRunId = useViewStore((s) => s.clearSuggestionRunId);

  // Pending cross-tab handoff state; the actual latching happens further down
  // (after `runActive` is computed — the handoff must not force the dialog
  // open while a run is already active, mirroring the manual "Generate with
  // AI" button's own `disabled={running || runActive || ...}` guard).
  const pendingCategoryGenScope = useViewStore((s) => s.pendingCategoryGenScope);
  const clearPendingCategoryGenScope = useViewStore((s) => s.clearPendingCategoryGenScope);
  const [scopedEntryIds, setScopedEntryIds] = useState<string[] | null>(null);
  const [consumedScope, setConsumedScope] = useState<{ entryIds: string[] } | null>(null);

  // Review state.
  const [suggestions, setSuggestions] = useState<CategorySuggestion[] | null>(null);
  const [logs, setLogs] = useState<JudgeLogEntry[] | null>(null);
  const [acceptedIdx, setAcceptedIdx] = useState<Set<number>>(new Set());
  // Which suggested categories are expanded to show their entry preview.
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  // Per-suggestion set of checked entry ids (default: all entries checked). On
  // apply, each accepted suggestion's `entryIds` is narrowed to this subset and
  // a suggestion whose subset is empty is dropped (== a whole-category skip).
  const [selectedEntries, setSelectedEntries] = useState<Map<number, Set<string>>>(new Map());

  // The run we're observing, resolved from the polled run list: the run the user
  // started this mount if it's still present, otherwise the most recent in-flight
  // category-gen run. The fallback is what lets the user leave this tab mid-run
  // and come back to a live progress bar (this component's state is per-mount).
  const activeRun = useMemo(() => {
    if (startedRunId) {
      const started = runs.find((r) => r.runId === startedRunId);
      if (started) return started;
    }
    return runs.find((r) => r.kind === 'category-gen' && isRunActive(r)) ?? null;
  }, [runs, startedRunId]);
  const activeRunId = activeRun?.runId ?? null;
  const runActive = activeRun !== null && isRunActive(activeRun);

  // Cross-tab handoff from the String Table's "Generate Categories from
  // Selection" bulk action: pre-scopes the next suggestion run to the given
  // entries and auto-opens the AI panel — but only when nothing is already
  // running (matching the manual "Generate with AI" button's own
  // `disabled={running || runActive || ...}` guard); a scope that arrives
  // while a run is active is dropped rather than force-opening a setup form
  // whose "Generate" the user couldn't otherwise reach. `consumedScope` starts
  // at a sentinel (null) distinct from any real scope object — NOT
  // initialized from `pendingCategoryGenScope` itself — so a scope that's
  // already set on this component's very first render (the common case:
  // `openCategoryGenScope` sets the scope and switches `activeTab` to
  // 'category' in the same store update, so CategoryTab mounts with the scope
  // already present) is still latched. This mirrors GenerateGlossaryDialog's
  // `adoptedRunId` pattern: local-state latching happens during render (the
  // lint-preferred alternative to a state-syncing effect for LOCAL state);
  // the store's own `clearPendingCategoryGenScope` is an external-system side
  // effect, so it stays in a plain effect below rather than this block.
  if (pendingCategoryGenScope && pendingCategoryGenScope !== consumedScope) {
    setConsumedScope(pendingCategoryGenScope);
    if (!runActive) {
      setScopedEntryIds(pendingCategoryGenScope.entryIds);
      setAiOpen(true);
    }
  }
  useEffect(() => {
    if (pendingCategoryGenScope) clearPendingCategoryGenScope();
  }, [pendingCategoryGenScope, clearPendingCategoryGenScope]);

  // Stashes a stored module/model/effort triple from the open transition below
  // until `aiModules` has actually loaded. `useModules()` fetches once on this
  // tab's mount (not gated on `aiOpen`), so for the manual "Generate with AI"
  // button — clicked long after the tab (and its module fetch) has settled —
  // `aiModules` is already populated when this runs. But the cross-tab handoff
  // above can call `setAiOpen(true)` synchronously on this component's very
  // first render (before the async module fetch resolves), so on that path
  // `aiModules` is still `[]` at this exact transition. Applied once `aiModules`
  // is non-empty, right after it's computed further down (mirrors
  // AiReviewDialog.tsx / SourceAiReviewTab.tsx / GenerateGlossaryDialog.tsx).
  const [pendingStored, setPendingStored] = useState<{
    moduleId: string;
    model: string;
    reasoningEffort: string;
  } | null>(null);

  // Reset the AI-dialog settings during render whenever `aiOpen` transitions to
  // true (the render-time "prev prop" pattern used elsewhere in this tab, which
  // the set-state-in-effect lint rule prefers over a state-resetting effect).
  const [prevAiOpen, setPrevAiOpen] = useState(false);
  if (aiOpen !== prevAiOpen) {
    setPrevAiOpen(aiOpen);
    if (aiOpen) {
      const stored = readSettings();
      setIncludeExisting(stored.includeExisting);
      setGenContext({
        contextFields: stored.contextFields as EntryContextField[],
        contextLanguages: stored.contextLanguages,
        grouping: asGroupingChoice(stored.grouping),
        ignoreLimit: stored.ignoreLimit || (project?.ignoreBatchSizeLimit ?? false),
        customBatchSize: stored.customBatchSize,
        skipCategories: stored.skipCategories,
        ignoreGlossaries: stored.ignoreGlossaries,
      });
      setPendingStored(
        stored.moduleId
          ? {
              moduleId: stored.moduleId,
              model: stored.model,
              reasoningEffort: stored.reasoningEffort,
            }
          : null,
      );
    }
  }

  // Ensure entries are loaded for this project.
  useEffect(() => {
    if (projectId && loadedProjectId !== projectId) void fetchEntries(projectId);
  }, [projectId, loadedProjectId, fetchEntries]);

  // Fetches the project's categories and keeps a valid tab selected. State
  // updates land only in the promise continuation (never synchronously), so this
  // is safe to call from both the load effect and after AI apply.
  const refreshCategories = useCallback(
    () =>
      apiRequest<string[]>(`/projects/${projectId}/categories`)
        .then((list) => {
          setCategories(list);
          setSelectedCategory((cur) => (cur && list.includes(cur) ? cur : (list[0] ?? null)));
        })
        .catch(() => {
          setCategories([]);
          setSelectedCategory(null);
        })
        .finally(() => setLoadingCategories(false)),
    [projectId],
  );

  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  // Refresh the run list when this tab mounts so a category-gen run that was
  // started earlier (and is still in flight) is picked up by `activeRun`'s
  // fallback even after navigating away and back. Polling then keeps it fresh.
  useEffect(() => {
    if (projectId) void fetchRuns(projectId);
  }, [projectId, fetchRuns]);

  // Remember the in-flight run we're observing so its terminal transition is
  // handled even after it leaves `activeRun` (which only tracks runs that are
  // still in flight) — e.g. the user navigated away mid-run, came back, and the
  // run completed while observed via the fallback.
  useEffect(() => {
    if (runActive && activeRunId) observedRunRef.current = activeRunId;
  }, [runActive, activeRunId]);

  // Loads a completed category-gen run's persisted suggestions into the review
  // panel. Shared by the observed-completion effect and the Activity-tab
  // deep-link effect; failures surface a toast.
  const loadRunSuggestions = useCallback(
    (runId: string) => {
      fetchCategorySuggestions(projectId, runId)
        .then((list) => {
          setSuggestions(list);
          setAcceptedIdx(new Set(list.map((_, i) => i)));
          setExpandedIdx(new Set());
          setSelectedEntries(new Map(list.map((s, i) => [i, new Set(s.entryIds)])));
        })
        .catch((err) => {
          toast.error(errorMessage(err, t('runFailed')));
        });
      void fetchJudgeLogs(projectId, runId)
        .then(setLogs)
        .catch(() => setLogs([]));
    },
    [projectId, fetchCategorySuggestions, fetchJudgeLogs, t],
  );

  // When the observed category-gen run finishes, load its persisted suggestions
  // from the sidecar (once) and open the review panel. Failures surface a toast.
  useEffect(() => {
    const observedId = observedRunRef.current;
    if (!observedId || loadedRunRef.current === observedId) return;
    const run = runs.find((r) => r.runId === observedId);
    if (!run) return;
    if (run.status === RunStatusCode.Completed) {
      loadedRunRef.current = observedId;
      loadRunSuggestions(observedId);
    } else if (run.status === RunStatusCode.Failed || run.status === RunStatusCode.Cancelled) {
      loadedRunRef.current = observedId;
      if (run.status === RunStatusCode.Failed) {
        const detail = run.errors[0]?.message;
        toast.error(detail ? `${t('runFailed')} ${detail}` : t('runFailed'));
      }
    }
  }, [runs, loadRunSuggestions, t]);

  // Activity-tab deep-link: reopen a completed category-gen run's suggestions
  // here, even after the mount that started it is gone. Waits for the run list
  // (refreshed on mount above) to include the run, then loads it once and clears
  // the deep-link. Only categories: a glossary deep-link mounts GlossaryTab, not
  // this component.
  useEffect(() => {
    if (!suggestionRunId) return;
    const run = runs.find((r) => r.runId === suggestionRunId);
    if (!run || run.kind !== 'category-gen') return;
    clearSuggestionRunId();
    if (run.status === RunStatusCode.Completed) {
      // Refs (not state) so this doesn't trigger a cascading render; the review
      // panel is driven by `suggestions`, loaded asynchronously below. Both refs
      // mark the run as already-handled so the observed-completion effect above
      // doesn't also load it.
      loadedRunRef.current = suggestionRunId;
      observedRunRef.current = suggestionRunId;
      loadRunSuggestions(suggestionRunId);
    }
  }, [suggestionRunId, runs, clearSuggestionRunId, loadRunSuggestions]);

  // Per-category entry counts, derived from the loaded entries.
  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const c of entry.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  // Entries carrying the selected category (read-only list).
  const categoryEntries = useMemo(
    () => (selectedCategory ? entries.filter((e) => e.categories.includes(selectedCategory)) : []),
    [entries, selectedCategory],
  );

  // Sync the description draft to the selected category's stored value whenever
  // the selection changes (render-time "prev value" pattern — no effect setState).
  const descriptions = project?.categoryDescriptions ?? {};
  if (descCat !== selectedCategory) {
    setDescCat(selectedCategory);
    setDescDraft(selectedCategory ? (descriptions[selectedCategory] ?? '') : '');
  }
  const storedDesc = selectedCategory ? (descriptions[selectedCategory] ?? '') : '';
  const descDirty = descDraft.trim() !== storedDesc;

  const aiModules = useMemo(() => {
    const withInstances = basesWithInstances(modules);
    return modules.filter(
      (m) =>
        CATEGORY_CAPABLE_MODULE_IDS.has(m.baseModuleId ?? m.id) &&
        isOfferableModule(m, withInstances) &&
        isEnabledModule(m),
    );
  }, [modules]);
  const moduleId = userModuleId ?? aiModules[0]?.id ?? '';
  const noAiModules = modules.length > 0 && aiModules.length === 0;

  // Apply the stashed stored module choice once the async module list has
  // loaded. Applied at most once per open; an unknown/no-longer-eligible stored
  // module is dropped so the dialog falls back to its own default-module
  // selection.
  if (pendingStored && aiModules.length > 0) {
    setPendingStored(null);
    if (aiModules.some((m) => m.id === pendingStored.moduleId)) {
      setUserModuleId(pendingStored.moduleId);
      setUserModel(pendingStored.model);
      setReasoningEffort(pendingStored.reasoningEffort);
    }
  }

  // How many provider calls (batches) this run will make, shown before starting
  // so the user knows how many progress steps to expect. One progress step lands
  // per batch; "send everything in one request" collapses it to a single batch.
  // Mirrors the server scoping: entries with non-empty source text, chunked by
  // CATEGORY_CHUNK_SIZE (the same constant the generator uses) — narrowed to
  // `scopedEntryIds` first when the run was scoped via the cross-tab handoff,
  // so the hint reflects the actual (small) run rather than the whole project.
  const genBatchCount = useMemo(() => {
    const scopedSet = scopedEntryIds ? new Set(scopedEntryIds) : null;
    const pool = scopedSet ? entries.filter((e) => scopedSet.has(e.id)) : entries;
    const eligible = pool.filter((e) => e.sourceText.trim().length > 0).length;
    if (eligible === 0) return 0;
    if (genContext.grouping === 'custom') {
      return genContext.customBatchSize === 0
        ? 1
        : Math.ceil(eligible / genContext.customBatchSize);
    }
    return genContext.ignoreLimit && genContext.grouping !== 'default'
      ? 1
      : Math.ceil(eligible / CATEGORY_CHUNK_SIZE);
  }, [
    entries,
    scopedEntryIds,
    genContext.grouping,
    genContext.ignoreLimit,
    genContext.customBatchSize,
  ]);

  // Save the selected category's description. Routed through
  // `useVaultRetryAction` (rather than the project store's plain `updateProject`)
  // so a locked vault's post-unlock replay still lands the store refresh in
  // `onResult` — mirroring `suggestRun`/`applyRun` below. Without this, the
  // global replay re-issues only the raw PUT and the description save is lost
  // from the UI even though it landed server-side.
  const saveDescriptionRun = useVaultRetryAction<Project>(
    ({ onRetry }) => {
      const trimmed = descDraft.trim();
      const next = { ...(project?.categoryDescriptions ?? {}) };
      if (selectedCategory) {
        if (trimmed) next[selectedCategory] = trimmed;
        else delete next[selectedCategory];
      }
      return apiRequest<Project>(`/projects/${projectId}`, {
        method: 'PUT',
        onVaultLockedRetry: onRetry,
        body: JSON.stringify({ categoryDescriptions: next }),
      });
    },
    {
      onResult: () => {
        toast.success(t('descriptionSaved'));
        void fetchProjects();
      },
      onError: (err) => toast.error(errorMessage(err, t('descriptionSaveFailed'))),
    },
  );
  const { run: saveDescription, busy: savingDesc } = useAsyncAction(
    async () => {
      if (!selectedCategory) return;
      await saveDescriptionRun.invoke();
    },
    { errorFallback: t('descriptionSaveFailed') },
  );

  // Carries the entry id + post-removal category list from `removeFromCategory`
  // to `removeFromCategoryRun`'s `run`/`onResult`. Pinned immediately before
  // `invoke()` (mirroring StringTable's `batchRequestRef`) because — unlike
  // `saveDescriptionRun`/`deleteCategoryRun` above, which always act on the
  // single selected category — this request varies per row/click.
  const removeFromCategoryRef = useRef<{ entryId: string; categories: string[] } | null>(null);

  // Remove the selected category from a single entry (browse view). Routed
  // through `useVaultRetryAction` (the string store's plain `updateEntry` has
  // no `onVaultLockedRetry` hook to wire in) so a locked vault's post-unlock
  // replay still lands the entries + category-tabs refresh in `onResult` —
  // mirroring `saveDescriptionRun`/`deleteCategoryRun` above. Without this,
  // the global replay re-issues only the raw PUT and the removal lands
  // server-side while the UI keeps showing the entry under the category (the
  // same class of bug D4b fixed for save/delete).
  const removeFromCategoryRun = useVaultRetryAction<StringEntry>(
    ({ onRetry }) => {
      // `run` is only invoked by `invoke()`, which `removeFromCategory` calls
      // immediately after pinning `removeFromCategoryRef`, so it's always set.
      const req = removeFromCategoryRef.current!;
      return apiRequest<StringEntry>(`/projects/${projectId}/strings/${req.entryId}`, {
        method: 'PUT',
        onVaultLockedRetry: onRetry,
        body: JSON.stringify({ categories: req.categories }),
      });
    },
    {
      onResult: () => {
        void refreshCategories();
        void fetchEntries(projectId);
      },
      onError: (err) => toast.error(errorMessage(err, t('applyFailed'))),
    },
  );
  const removeFromCategory = async (entry: { id: string; categories: string[] }) => {
    if (!selectedCategory) return;
    removeFromCategoryRef.current = {
      entryId: entry.id,
      categories: entry.categories.filter((c) => c !== selectedCategory),
    };
    await removeFromCategoryRun.invoke();
  };

  // Delete an entire category: removes it from every entry and drops its
  // description (server-side, behind a safety snapshot). Routed through
  // `useVaultRetryAction` so the entries/categories refresh also lands after a
  // locked vault's post-unlock replay, not just on the immediate success path.
  // The confirm dialog closes unconditionally (matching the prior behavior of
  // always closing on both success and a swallowed 423).
  const deleteCategoryRun = useVaultRetryAction<{ removed: number }>(
    ({ onRetry }) =>
      apiRequest<{ removed: number }>(
        `/projects/${projectId}/categories/${encodeURIComponent(selectedCategory ?? '')}`,
        { method: 'DELETE', onVaultLockedRetry: onRetry },
      ),
    {
      onResult: ({ removed }) => {
        toast.success(t('deleteSuccess', { count: removed }));
        void refreshCategories();
        void fetchEntries(projectId);
      },
      onError: (err) => toast.error(errorMessage(err, t('deleteFailed'))),
    },
  );
  const deleteWholeCategory = async () => {
    if (!selectedCategory) return;
    setDeleteOpen(false);
    await deleteCategoryRun.invoke();
  };

  const handleModuleChange = (next: string | null) => {
    setUserModuleId(next ?? '');
    setUserModel('');
    setReasoningEffort('');
  };

  // Closes the AI dialog and forgets any pending selection scope, so a later
  // reopen (either the plain button or a fresh cross-tab handoff) starts clean.
  const closeAiDialog = () => {
    setAiOpen(false);
    setScopedEntryIds(null);
  };

  // Registers a freshly-started run so its progress shows here and its
  // suggestions load on completion. Clears any previous review panel.
  const trackRun = useCallback(
    (res: { runId: string; status: string }) => {
      loadedRunRef.current = null;
      observedRunRef.current = res.runId;
      setSuggestions(null);
      setLogs(null);
      setAcceptedIdx(new Set());
      setExpandedIdx(new Set());
      setSelectedEntries(new Map());
      setStartedRunId(res.runId);
      setAiOpen(false);
      // The scope (if any) has now been consumed by the run that just started;
      // forget it so a later manual re-generate isn't silently re-scoped.
      setScopedEntryIds(null);
      // Make sure the shared run store polls so the run's progress is observed.
      startPolling(projectId);
    },
    [projectId, startPolling],
  );

  // Kick off the background category-gen run. The success side effect (tracking
  // the started run so its progress bar + review panel appear) goes in the vault
  // hook's `onResult` so it fires exactly once across the awaited + retried
  // delivery paths — on a locked vault the request also replays via
  // `onVaultLockedRetry` after unlock. `useVaultRetryAction.invoke()` never
  // rejects (a 423 is swallowed; anything else goes to `onError` if provided —
  // an ABSENT `onError` means the failure is silently dropped, not reported
  // via `useAsyncAction`'s own error toast, since nothing ever throws for it to
  // catch), so `onError` here is what actually surfaces a non-423 failure
  // (e.g. a 400/409, more reachable now that a scoped request can fail on a
  // stale/deleted entry id).
  const suggestRun = useVaultRetryAction<{ runId: string; status: string }>(
    ({ onRetry }) =>
      apiRequest<{ runId: string; status: string }>(`/projects/${projectId}/categories/suggest`, {
        method: 'POST',
        // On 423 AppShell retries after unlock; track the late-started run so
        // the progress bar + review panel appear without re-entering the dialog.
        onVaultLockedRetry: onRetry,
        body: JSON.stringify({
          moduleId,
          ...(userModel ? { model: userModel } : {}),
          ...(reasoningEffort ? { reasoningEffort } : {}),
          includeExisting,
          ...(scopedEntryIds && scopedEntryIds.length > 0 ? { entryIds: scopedEntryIds } : {}),
          ...(genContext.contextFields.length > 0
            ? { contextFields: genContext.contextFields }
            : {}),
          ...(genContext.contextLanguages.length > 0
            ? { contextLanguages: genContext.contextLanguages }
            : {}),
          ...(genContext.grouping === 'custom'
            ? { customBatchSize: genContext.customBatchSize }
            : genContext.grouping !== 'default'
              ? { batchGrouping: genContext.grouping, ignoreBatchSizeLimit: genContext.ignoreLimit }
              : {}),
          ...(genContext.skipCategories.length > 0
            ? { skipCategories: genContext.skipCategories }
            : {}),
          ...(genContext.ignoreGlossaries.length > 0
            ? { excludeGlossaryIds: genContext.ignoreGlossaries }
            : {}),
        }),
      }),
    { onResult: trackRun, onError: (err) => toast.error(errorMessage(err, t('runFailed'))) },
  );
  const { run: handleGenerate, busy: running } = useAsyncAction(
    async () => {
      if (!moduleId) return;
      saveSettings({
        // Persist the resolved module (falls back to the first offerable
        // module when the user never touched the selector) — not the raw
        // `userModuleId` state, which stays null in that common case and
        // would otherwise make the stored value always falsy and never
        // restored. Mirrors what the request body above actually sends.
        moduleId,
        model: userModel,
        reasoningEffort,
        includeExisting,
        contextFields: genContext.contextFields,
        contextLanguages: genContext.contextLanguages,
        grouping: genContext.grouping,
        ignoreLimit: genContext.ignoreLimit,
        customBatchSize: genContext.customBatchSize,
        skipCategories: genContext.skipCategories,
        ignoreGlossaries: genContext.ignoreGlossaries,
      });
      await suggestRun.invoke();
    },
    { errorFallback: t('runFailed') },
  );

  const toggleSuggestion = (idx: number) => {
    setAcceptedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleExpand = (idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Keep the per-category checkbox in sync with its entry subset: a category is
  // accepted iff at least one of its entries is checked. Auto-unchecks when the
  // subset empties and re-checks when it gains an entry.
  const syncAccepted = (idx: number, nonEmpty: boolean) => {
    setAcceptedIdx((prev) => {
      if (nonEmpty === prev.has(idx)) return prev;
      const next = new Set(prev);
      if (nonEmpty) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  const toggleEntry = (idx: number, entryId: string) => {
    setSelectedEntries((prev) => {
      const next = new Map(prev);
      const set = new Set(prev.get(idx) ?? []);
      if (set.has(entryId)) set.delete(entryId);
      else set.add(entryId);
      next.set(idx, set);
      syncAccepted(idx, set.size > 0);
      return next;
    });
  };

  const selectAllEntries = (idx: number) => {
    const ids = suggestions?.[idx]?.entryIds ?? [];
    setSelectedEntries((prev) => {
      const next = new Map(prev);
      next.set(idx, new Set(ids));
      return next;
    });
    syncAccepted(idx, ids.length > 0);
  };

  const selectNoneEntries = (idx: number) => {
    setSelectedEntries((prev) => {
      const next = new Map(prev);
      next.set(idx, new Set());
      return next;
    });
    syncAccepted(idx, false);
  };

  const applyAssignResult = async (res: { updated: number }) => {
    if (res.updated > 0) toast.success(t('applySuccess', { count: res.updated }));
    else toast.info(t('applyNone'));
    setSuggestions(null);
    setLogs(null);
    setAcceptedIdx(new Set());
    setSelectedEntries(new Map());
    await fetchEntries(projectId);
    await refreshCategories();
  };

  // The accepted suggestions, narrowed to the per-entry checked subset: each
  // accepted category's `entryIds` (and resolved `entries`) is filtered to the
  // checked ids and a category whose subset is empty is dropped entirely (==
  // whole-category skip). This is what's POSTed to /categories/assign.
  const effectiveAccepted = useMemo<CategorySuggestion[]>(() => {
    return (suggestions ?? [])
      .map((s, i): [number, CategorySuggestion] => [i, s])
      .filter(([i]) => acceptedIdx.has(i))
      .map(([i, s]): CategorySuggestion => {
        const sel = selectedEntries.get(i);
        if (!sel) return s;
        return {
          ...s,
          entryIds: s.entryIds.filter((id) => sel.has(id)),
          ...(s.entries ? { entries: s.entries.filter((e) => sel.has(e.id)) } : {}),
        };
      })
      .filter((s) => s.entryIds.length > 0);
  }, [suggestions, acceptedIdx, selectedEntries]);

  // Apply the accepted suggestions. As with generate, the success side effect
  // (toast + entry/category refresh) goes in the vault hook's `onResult` so it
  // fires exactly once across the awaited + retried (post-unlock) paths;
  // `useAsyncAction` owns the `applying` flag and the error toast.
  const applyRun = useVaultRetryAction<{ updated: number }>(
    ({ onRetry }) => {
      const accepted = effectiveAccepted;
      return apiRequest<{ updated: number }>(`/projects/${projectId}/categories/assign`, {
        method: 'POST',
        // On 423 AppShell retries after unlock; apply the late result so the
        // assignment lands and the UI refreshes without a manual reload.
        onVaultLockedRetry: onRetry,
        body: JSON.stringify({ suggestions: accepted }),
      });
    },
    { onResult: (res) => void applyAssignResult(res) },
  );
  const { run: handleApply, busy: applying } = useAsyncAction(
    async () => {
      // Nothing effective to apply (no accepted category with ≥1 checked entry)
      // means there's nothing to POST. The request closure in `applyRun` does the
      // actual `suggestions → accepted (entry-subset)` filtering.
      if (!suggestions || effectiveAccepted.length === 0) return;
      await applyRun.invoke();
    },
    { errorFallback: t('applyFailed') },
  );

  return (
    <div className="mx-auto w-full max-w-screen-xl space-y-6" data-testid="category-tab">
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Tags className="size-4" />
          <h3 className="text-sm font-semibold">{t('title')}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        <Button
          onClick={() => {
            // Manual open (not the cross-tab handoff): always a whole-project run.
            setScopedEntryIds(null);
            setAiOpen(true);
          }}
          disabled={running || runActive || entries.length === 0}
          data-testid="category-ai-open"
        >
          <Sparkles className="mr-1 size-4" />
          {t('aiButton')}
        </Button>
      </section>

      {/* Background category-generation progress. The run keeps going if the
          user navigates away; on return this card reappears until completion. */}
      {runActive && activeRun && (
        <RunProgressCard
          run={activeRun}
          runningLabel={t('genRunning')}
          startingLabel={t('genStarting')}
          countLabel={(done, total) => t('genProgressCount', { done, total })}
          hint={t('genBackgroundHint')}
          bordered
          data-testid="category-gen-progress"
        />
      )}

      {/* Categories as tabs; selecting one shows its entries + description. */}
      <section className="space-y-3">
        <h4 className="text-sm font-medium">{t('currentTitle')}</h4>
        {loadingCategories ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="category-empty">
            {t('empty')}
          </p>
        ) : (
          <>
            <div
              className="flex flex-wrap gap-1.5 border-b border-border/60 pb-2"
              role="tablist"
              data-testid="category-tabs"
            >
              {categories.map((c) => {
                const active = c === selectedCategory;
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategory(c)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors cursor-pointer',
                      active
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                    data-testid={`category-tab-${c}`}
                  >
                    <span>{c}</span>
                    <span className="text-xs text-muted-foreground">
                      {t('countLabel', { count: countByCategory.get(c) ?? 0 })}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedCategory && (
              <div
                className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0"
                data-testid="category-panel"
              >
                {/* Description editor */}
                <div className="space-y-1.5">
                  <Label htmlFor="category-description">{t('descriptionLabel')}</Label>
                  <Textarea
                    id="category-description"
                    value={descDraft}
                    onChange={(e) => setDescDraft(e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    rows={3}
                    className="max-w-2xl"
                    data-testid="category-description-input"
                  />
                  <div>
                    <SubmitButton
                      loading={savingDesc}
                      icon={Save}
                      onClick={saveDescription}
                      disabled={savingDesc || !descDirty}
                      data-testid="category-description-save"
                    >
                      {t('descriptionSave')}
                    </SubmitButton>
                  </div>
                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteOpen(true)}
                      data-testid="category-delete"
                    >
                      <Trash2 className="mr-1 size-4" />
                      {t('deleteCategory')}
                    </Button>
                  </div>
                </div>

                {/* Entries carrying this category (read-only) */}
                <div className="space-y-1.5">
                  <Label>{t('entriesInCategoryLabel', { count: categoryEntries.length })}</Label>
                  <div
                    className="max-h-72 overflow-auto rounded-md border border-border/60 lg:max-h-[60vh]"
                    data-testid="category-panel-entries"
                  >
                    {categoryEntries.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">
                        {t('noEntriesInCategory')}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {categoryEntries.map((entry) => (
                          <li
                            key={entry.id}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm"
                            title={entry.sourceText}
                            data-testid={`category-panel-entry-${entry.id}`}
                          >
                            {entry.sourceText.trim() ? (
                              <span className="block min-w-0 flex-1 truncate">
                                {renderTaggedPreview(entry.sourceText)}
                              </span>
                            ) : (
                              <span className="block min-w-0 flex-1 truncate italic text-muted-foreground">
                                {t('emptySource')}
                              </span>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => void removeFromCategory(entry)}
                              aria-label={t('removeFromCategory')}
                              data-testid={`category-remove-entry-${entry.id}`}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* AI suggestion review */}
      {suggestions !== null && (
        <section
          className="space-y-3 rounded-lg border border-border/60 p-3"
          data-testid="category-review"
        >
          <div className="space-y-0.5">
            <h4 className="text-sm font-medium">{t('reviewTitle')}</h4>
            <p className="text-xs text-muted-foreground">{t('reviewHint')}</p>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="category-no-suggestions">
              {t('noSuggestions')}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {suggestions.map((s, i) => {
                const open = expandedIdx.has(i);
                const previewEntries = s.entries ?? [];
                const selected = selectedEntries.get(i) ?? new Set<string>();
                const selectedCount = selected.size;
                const partial = selectedCount > 0 && selectedCount < s.entryIds.length;
                return (
                  <li
                    key={`${s.category}-${i}`}
                    className="rounded-md border border-border/60"
                    data-testid={`category-suggestion-${i}`}
                  >
                    <Collapsible open={open} onOpenChange={() => toggleExpand(i)}>
                      <div className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent/50">
                        <Checkbox
                          checked={acceptedIdx.has(i)}
                          indeterminate={partial}
                          onCheckedChange={() => toggleSuggestion(i)}
                          data-testid={`category-suggestion-check-${i}`}
                          aria-label={s.category}
                        />
                        <span className="font-medium">{s.category}</span>
                        <CollapsibleTrigger
                          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          data-testid={`category-suggestion-toggle-${i}`}
                        >
                          <span>{t('suggestionEntries', { count: s.entryIds.length })}</span>
                          <ChevronRight
                            className={cn('size-3.5 transition-transform', open && 'rotate-90')}
                          />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent>
                        <div className="flex items-center gap-3 border-t border-border/60 px-3 py-1 text-xs">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => selectAllEntries(i)}
                            data-testid={`category-suggestion-select-all-${i}`}
                          >
                            {t('selectAllEntries')}
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => selectNoneEntries(i)}
                            data-testid={`category-suggestion-select-none-${i}`}
                          >
                            {t('selectNoneEntries')}
                          </button>
                        </div>
                        <ul
                          className="max-h-48 divide-y divide-border/60 overflow-auto border-t border-border/60"
                          data-testid={`category-suggestion-entries-${i}`}
                        >
                          {previewEntries.length === 0 ? (
                            <li className="px-3 py-1.5 text-xs italic text-muted-foreground">
                              {t('noEntryPreview')}
                            </li>
                          ) : (
                            previewEntries.map((entry) => (
                              <li
                                key={entry.id}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs"
                                title={entry.sourceText}
                              >
                                <Checkbox
                                  checked={selected.has(entry.id)}
                                  onCheckedChange={() => toggleEntry(i, entry.id)}
                                  data-testid={`category-suggestion-entry-check-${i}-${entry.id}`}
                                  aria-label={t('entryCheckboxLabel')}
                                />
                                {entry.sourceText.trim() ? (
                                  <span className="block truncate">
                                    {renderTaggedPreview(entry.sourceText)}
                                  </span>
                                ) : (
                                  <span className="block truncate italic text-muted-foreground">
                                    {t('emptySource')}
                                  </span>
                                )}
                              </li>
                            ))
                          )}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex gap-2">
            <SubmitButton
              loading={applying}
              icon={Sparkles}
              onClick={handleApply}
              disabled={applying || effectiveAccepted.length === 0}
              data-testid="category-apply"
            >
              {t('applySelected')}
            </SubmitButton>
            <Button
              variant="outline"
              onClick={() => {
                setSuggestions(null);
                setLogs(null);
                setAcceptedIdx(new Set());
                setSelectedEntries(new Map());
              }}
            >
              {t('cancel')}
            </Button>
          </div>
          <RunLogsPanel logs={logs ?? undefined} loading={false} testId="run-category-gen-logs" />
        </section>
      )}

      {/* Confirm whole-category deletion */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-testid="category-delete-dialog">
          <DialogHeader>
            <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteConfirmBody', {
                category: selectedCategory ?? '',
                count: categoryEntries.length,
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteWholeCategory()}
              data-testid="category-delete-confirm"
            >
              {t('deleteConfirmButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI generation dialog */}
      <Dialog open={aiOpen} onOpenChange={(open) => (open ? setAiOpen(true) : closeAiDialog())}>
        <DialogContent data-testid="category-ai-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {t('aiTitle')}
            </DialogTitle>
            <DialogDescription>{t('aiHint')}</DialogDescription>
          </DialogHeader>

          {scopedEntryIds && scopedEntryIds.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="category-ai-scoped-hint">
              {t('aiScopedHint', { count: scopedEntryIds.length })}
            </p>
          )}

          {noAiModules ? (
            <p className="text-sm text-muted-foreground" data-testid="category-no-modules">
              {t('noModules')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category-ai-module">{t('module')}</Label>
                <ModuleSelect
                  id="category-ai-module"
                  triggerTestId="category-module-trigger"
                  value={moduleId}
                  onValueChange={handleModuleChange}
                  modules={aiModules}
                  placeholder={t('modulePlaceholder')}
                />
              </div>

              {moduleId && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="category-ai-model">{t('model')}</Label>
                    <ModuleModelSelector
                      key={moduleId}
                      id="category-ai-model"
                      moduleId={moduleId}
                      value={userModel}
                      onValueChange={setUserModel}
                      confidenceContext={confidenceContext}
                    />
                  </div>
                  <ModuleReasoningEffortSelect
                    moduleId={moduleId}
                    model={userModel}
                    value={reasoningEffort}
                    onChange={setReasoningEffort}
                  />
                </>
              )}

              <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                <Checkbox
                  checked={includeExisting}
                  onCheckedChange={(checked) => setIncludeExisting(checked === true)}
                  data-testid="category-include-existing"
                />
                {t('includeExisting')}
              </label>

              <GenerationContextControls
                value={genContext}
                onChange={setGenContext}
                activeLanguages={project?.activeLanguages ?? []}
                availableCategories={categories}
                availableGlossaries={availableGlossaries.filter((g) => g.enabled !== false)}
              />
            </div>
          )}

          {genBatchCount > 0 && !noAiModules && (
            <p className="text-xs text-muted-foreground" data-testid="category-gen-batch-count">
              {t('genBatchCount', { count: genBatchCount })}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeAiDialog}>
              {t('cancel')}
            </Button>
            <SubmitButton
              loading={running}
              icon={Sparkles}
              onClick={handleGenerate}
              disabled={running || !moduleId || noAiModules}
              data-testid="category-generate"
            >
              {t('run')}
            </SubmitButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CategoryTab;
