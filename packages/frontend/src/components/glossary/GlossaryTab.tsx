import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  Lock,
  Languages,
  ChevronRight,
  Eye,
  EyeOff,
  Download,
  Upload,
  AlertTriangle,
  BookText,
} from 'lucide-react';
import { cn, errorMessage } from '@/lib/utils';
import { apiRequest, apiDownload, ApiError } from '../../hooks/use-api.js';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import {
  LANG_NAMES,
  termMatchesText,
  isComplete,
  projectTargetLanguages,
} from '@zercade-dev/narn-shared';
import type {
  Glossary,
  GlossarySummary,
  GlossaryTerm,
  StringEntry,
} from '@zercade-dev/narn-shared';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { writableSubset } from '@/lib/collab-locks';
import { useStringStore } from '../../stores/string-store.js';
import { useViewStore } from '../../stores/view-store.js';
import { useGlossaryGenAccept } from '../../hooks/use-glossary-gen-accept.js';
import { countDistinctSourceTexts } from '../../lib/count-distinct-sources.js';
import { GenerateGlossaryDialog } from './GenerateGlossaryDialog.js';
import { GenerateTermTranslationsDialog } from './GenerateTermTranslationsDialog.js';
import {
  emptyDraft,
  type DraftTerm,
  type MatchResult,
  type ImportDryRunResponse,
  type ImportApplyResponse,
} from './glossary-tab-types.js';
import { GlossaryTermRow } from './GlossaryTermRow.js';
import { GlossarySidebar } from './GlossarySidebar.js';
import { GlossaryMatchPanel } from './GlossaryMatchPanel.js';
import { GlossaryImportPreviewSheet } from './GlossaryImportPreviewSheet.js';

// Re-exported here so tests (and any other consumer) can keep importing
// `GlossaryTermRow` from the GlossaryTab module after its extraction.
export { GlossaryTermRow } from './GlossaryTermRow.js';

interface GlossaryTabProps {
  readonly projectId: string;
  readonly activeLanguages: string[];
}

export function GlossaryTab({ projectId, activeLanguages }: Readonly<GlossaryTabProps>) {
  const { t } = useTranslation('glossary');
  const isDeepLEnabled = useProjectStore((s) => {
    const proj = s.projects.find((p) => p.id === projectId);
    return (proj?.moduleConfigs['deepl']?.active ?? true) !== false;
  });
  // Source language, needed (alongside `activeLanguages`) to derive the
  // project's configured target languages for the read-only-glossary
  // completeness check below.
  const sourceLanguage = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.sourceLanguage,
  );
  // Which languages the current access (owner/collaborator + writableLanguages)
  // may WRITE — mirrors the Compare/Strings-editor/Review wiring
  // (collab-locks.ts). Glossary MANAGEMENT (add/delete term, delete glossary,
  // AI generation) is owner-only server-side (assertProjectAccess(...,
  // {type:'manage'})), so those affordances are hidden outright for
  // collaborators; term-translation edits stay available, scoped
  // per-language via `assertGlossaryTermEditAllowed` on the server.
  const access = useProjectStore((s) => accessFor(s, projectId));
  const isCollaborator = access.role === 'collaborator';
  const writableLanguages = useMemo(
    () => writableSubset(access, activeLanguages),
    [access, activeLanguages],
  );

  // Glossary list state
  const [glossaries, setGlossaries] = useState<GlossarySummary[]>([]);
  const [selectedGlossaryId, setSelectedGlossaryId] = useState<string | null>(null);
  const [pendingDeleteGlossaryId, setPendingDeleteGlossaryId] = useState<string | null>(null);
  const [pushReplaceConfirmOpen, setPushReplaceConfirmOpen] = useState(false);
  // Set to the glossary id being enabled while we ask the user whether to
  // auto-apply its matches to the project's strings. Disabling never prompts.
  const [pendingEnableGlossaryId, setPendingEnableGlossaryId] = useState<string | null>(null);
  const [mainOpen, setMainOpen] = useState(true);
  const [matchTermId, setMatchTermId] = useState<string | null>('__all__');
  // For the glossary-to-entry search: 'without' shows matching entries that do
  // NOT yet have this glossary assigned (the common "needs assignment" case, so
  // it is the default); 'with' shows the ones already assigned to it.
  const [matchAssignment, setMatchAssignment] = useState<'with' | 'without'>('without');
  const [matchResults, setMatchResults] = useState<MatchResult[] | null>(null);
  const allEntries = useStringStore((s) => s.entries);
  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const loadedProjectId = useStringStore((s) => s.loadedProjectId);

  // Term state
  const [glossary, setGlossary] = useState<Glossary | null>(null);
  const [draft, setDraft] = useState<DraftTerm>(() => emptyDraft(activeLanguages));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftTerm | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedTermIds, setSelectedTermIds] = useState<Set<string>>(() => new Set());
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [assigningBusy, setAssigningBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkAbortRef = useRef<AbortController | null>(null);
  // Tracks the latest `selectedGlossaryId` for `loadGlossary`'s stale-response
  // guard below (a ref rather than a dependency so `loadGlossary`'s identity
  // stays stable). Kept current via the effect right after its declaration.
  const selectedGlossaryIdRef = useRef(selectedGlossaryId);
  useEffect(() => {
    selectedGlossaryIdRef.current = selectedGlossaryId;
  }, [selectedGlossaryId]);

  // Bulk import/export state
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportDryRunResponse | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Shared error-toast tail for the glossary/term mutation handlers: show the
  // thrown error's message, falling back to a localized key for non-Error throws.
  const reportError = useCallback(
    (err: unknown, fallbackKey: string) => toast.error(errorMessage(err, t(fallbackKey))),
    [t],
  );

  const applyGlossaries = useCallback((list: GlossarySummary[]) => {
    setGlossaries(list);
    // Auto-select a glossary that actually has something in it: landing on an
    // empty (often the very first, e.g. "Default") glossary while populated
    // ones exist reads as a bug, so prefer the first ENABLED glossary with
    // terms. Falls back to the prior writable-first heuristic (add-term form
    // visible by default) when nothing qualifies — e.g. every glossary is
    // empty or disabled. Never overrides a selection already made this
    // session (the `prev` check).
    setSelectedGlossaryId((prev) => {
      if (prev && list.some((f) => f.id === prev)) return prev;
      const firstPopulated = list.find((f) => f.enabled !== false && f.termCount > 0);
      if (firstPopulated) return firstPopulated.id;
      const firstWritable = list.find((f) => !f.readOnly);
      return firstWritable?.id ?? list[0]?.id ?? null;
    });
  }, []);

  const loadGlossaries = useCallback(async () => {
    try {
      applyGlossaries(await apiRequest<GlossarySummary[]>(`/projects/${projectId}/glossaries`));
    } catch (err) {
      reportError(err, 'toastLoadError');
    }
  }, [projectId, applyGlossaries, reportError]);

  const loadGlossary = useCallback(
    async (folderId: string) => {
      try {
        const g = await apiRequest<Glossary>(`/projects/${projectId}/glossaries/${folderId}`);
        // Drop a late response for a glossary the user has since switched
        // away from — mirrors the selection-fetch effect's own stale guard
        // below, which this reload-after-mutation path lacked.
        if (folderId !== selectedGlossaryIdRef.current) return;
        setGlossary(g);
      } catch (err) {
        if (folderId !== selectedGlossaryIdRef.current) return;
        reportError(err, 'toastLoadError');
      }
    },
    [projectId, reportError],
  );

  useEffect(() => {
    let stale = false;
    apiRequest<GlossarySummary[]>(`/projects/${projectId}/glossaries`, {
      // On 423 AppShell retries after unlock; apply the late result so the
      // tab fills in without a manual reload.
      onVaultLockedRetry: (list) => {
        if (!stale) applyGlossaries(list);
      },
    })
      .then((list) => {
        if (!stale) applyGlossaries(list);
      })
      .catch((err: unknown) => {
        if (!stale) reportError(err, 'toastLoadError');
      });
    return () => {
      stale = true;
    };
  }, [projectId, applyGlossaries, reportError]);

  // Ensure string entries are available for glossary-to-entry matching
  useEffect(() => {
    if (loadedProjectId !== projectId) void fetchEntries(projectId);
  }, [loadedProjectId, projectId, fetchEntries]);

  // Re-derive the empty draft during render when the language set changes.
  const [prevActiveLanguages, setPrevActiveLanguages] = useState(activeLanguages);
  if (prevActiveLanguages !== activeLanguages) {
    setPrevActiveLanguages(activeLanguages);
    setDraft(emptyDraft(activeLanguages));
  }

  const selectedGlossary = useMemo(
    () => glossaries.find((f) => f.id === selectedGlossaryId) ?? null,
    [glossaries, selectedGlossaryId],
  );
  const isReadOnly = selectedGlossary?.readOnly ?? false;

  // Show enabled glossaries first; `enabled` is optional and undefined means
  // enabled. Stable sort keeps the existing relative order within each group.
  const sortedGlossaries = useMemo(
    () => [...glossaries].sort((a, b) => Number(a.enabled === false) - Number(b.enabled === false)),
    [glossaries],
  );

  // Enable a glossary. `applyMatches` controls whether the server runs the
  // project-wide sync that auto-applies the glossary's matches to existing
  // strings (omitted → server default of running it).
  const enableGlossary = useCallback(
    async (folderId: string, applyMatches?: boolean) => {
      try {
        await apiRequest<Glossary>(`/projects/${projectId}/glossaries/${folderId}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: true, ...(applyMatches === false && { applyMatches }) }),
        });
        await loadGlossaries();
      } catch (err) {
        reportError(err, 'toastUpdateError');
      }
    },
    [projectId, loadGlossaries, reportError],
  );

  // Resolve the auto-apply prompt: close it and enable the pending glossary,
  // applying matches now (confirm) or not (decline).
  const resolveEnablePrompt = useCallback(
    (applyMatches: boolean) => {
      const id = pendingEnableGlossaryId;
      setPendingEnableGlossaryId(null);
      if (id) void enableGlossary(id, applyMatches);
    },
    [pendingEnableGlossaryId, enableGlossary],
  );

  const handleToggleEnabled = useCallback(
    async (folderId: string, currentEnabled: boolean) => {
      // Enabling auto-applies the glossary's matches across the project, so ask
      // first whether to do that now. Disabling has no such side effect and
      // applies immediately.
      if (!currentEnabled) {
        setPendingEnableGlossaryId(folderId);
        return;
      }
      try {
        await apiRequest<Glossary>(`/projects/${projectId}/glossaries/${folderId}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: false }),
        });
        await loadGlossaries();
      } catch (err) {
        reportError(err, 'toastUpdateError');
      }
    },
    [projectId, loadGlossaries, reportError],
  );

  const handleDeleteGlossary = useCallback(async () => {
    if (!pendingDeleteGlossaryId) return;
    const id = pendingDeleteGlossaryId;
    setPendingDeleteGlossaryId(null);
    try {
      await apiRequest<void>(`/projects/${projectId}/glossaries/${id}`, { method: 'DELETE' });
      await loadGlossaries();
      toast.success(t('toastGlossaryDeleted'));
    } catch (err) {
      reportError(err, 'toastGlossaryDeleteError');
    }
  }, [pendingDeleteGlossaryId, projectId, loadGlossaries, reportError, t]);

  const handleAdd = useCallback(async () => {
    if (!draft.source.trim() || !selectedGlossaryId) return;
    try {
      await apiRequest<GlossaryTerm>(
        `/projects/${projectId}/glossaries/${selectedGlossaryId}/terms`,
        {
          method: 'POST',
          body: JSON.stringify({
            source: draft.source.trim(),
            translations: draft.translations,
            notes: draft.notes?.trim() || undefined,
            constant: draft.constant ?? false,
          }),
        },
      );
      setDraft(emptyDraft(activeLanguages));
      await loadGlossary(selectedGlossaryId);
      toast.success(t('toastTermAdded'));
    } catch (err) {
      reportError(err, 'toastAddError');
    }
  }, [draft, projectId, selectedGlossaryId, activeLanguages, loadGlossary, reportError, t]);

  const startEdit = useCallback(
    (term: GlossaryTerm) => {
      setEditingId(term.id);
      setEditDraft({
        source: term.source,
        translations: {
          ...Object.fromEntries(activeLanguages.map((l) => [l, ''])),
          ...term.translations,
        },
        notes: term.notes ?? '',
        constant: term.constant ?? false,
      });
    },
    [activeLanguages],
  );

  // Stable identity (deps: []) so it doesn't defeat GlossaryTermRow's memoization
  // the way a recreated-every-keystroke callback would.
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editDraft || !selectedGlossaryId) return;
    // Collaborators may only patch `translations`, scoped to their writable
    // languages (server: `assertGlossaryTermEditAllowed`) — sending the full
    // draft (source/notes/constant always defined, every activeLanguage's
    // translation) would 403 even on an unchanged field, since the server
    // can't tell "unchanged" from "attempted". Owners keep the full-draft
    // patch unchanged.
    const body = isCollaborator
      ? {
          translations: Object.fromEntries(
            Object.entries(editDraft.translations).filter(([lang]) =>
              writableLanguages.includes(lang),
            ),
          ),
        }
      : {
          source: editDraft.source.trim(),
          translations: editDraft.translations,
          notes: editDraft.notes?.trim() || undefined,
          constant: editDraft.constant ?? false,
        };
    try {
      await apiRequest<GlossaryTerm>(
        `/projects/${projectId}/glossaries/${selectedGlossaryId}/terms/${editingId}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      setEditingId(null);
      setEditDraft(null);
      await loadGlossary(selectedGlossaryId);
      toast.success(t('toastTermUpdated'));
    } catch (err) {
      reportError(err, 'toastUpdateError');
    }
  }, [
    editingId,
    editDraft,
    projectId,
    selectedGlossaryId,
    loadGlossary,
    reportError,
    t,
    isCollaborator,
    writableLanguages,
  ]);

  const confirmDelete = useCallback(async () => {
    if (!pendingDeleteId || !selectedGlossaryId) return;
    const termId = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await apiRequest<void>(
        `/projects/${projectId}/glossaries/${selectedGlossaryId}/terms/${termId}`,
        { method: 'DELETE' },
      );
      await loadGlossary(selectedGlossaryId);
      toast.success(t('toastTermDeleted'));
    } catch (err) {
      reportError(err, 'toastDeleteError');
    }
  }, [pendingDeleteId, projectId, selectedGlossaryId, loadGlossary, reportError, t]);

  const handlePushDeepL = useCallback(
    async (replace: boolean) => {
      if (!selectedGlossaryId) return;
      setPushReplaceConfirmOpen(false);
      try {
        const result = await apiRequest<{ pushed: number }>(
          `/projects/${projectId}/glossaries/${selectedGlossaryId}/push-deepl`,
          {
            method: 'POST',
            body: JSON.stringify(replace ? { replace, confirmReplaceAll: true } : { replace }),
          },
        );
        toast.success(t('toastPushed', { count: result.pushed }));
        // Refresh so the "re-push required" indicator clears.
        await loadGlossary(selectedGlossaryId);
      } catch (err) {
        reportError(err, 'toastPushError');
      }
    },
    [projectId, selectedGlossaryId, loadGlossary, reportError, t],
  );

  // Export returns a binary blob, so it goes through `apiDownload` (not the
  // JSON-only `apiRequest`). `apiDownload` replicates the shared client's 423
  // handling: on a locked vault it dispatches `vault:locked` so AppShell opens
  // the unlock dialog and replays the export after unlock (rejecting the original
  // call with 423, which we swallow here), matching every other call in this tab.
  const handleExport = useCallback(
    async (format: 'csv' | 'tbx') => {
      if (!selectedGlossaryId) return;
      const folderId = selectedGlossaryId;
      try {
        await apiDownload(
          `/projects/${projectId}/glossaries/${folderId}/export?format=${format}`,
          `glossary-${folderId}.${format}`,
        );
      } catch (err) {
        // A 423 means the vault was locked; the unlock dialog is shown and the
        // export replays after unlock, so don't surface it.
        if (err instanceof ApiError && err.status === 423) return;
        reportError(err, 'toastExportError');
      }
    },
    [projectId, selectedGlossaryId, reportError],
  );

  const requestImportPreview = useCallback(
    async (file: File) => {
      if (!selectedGlossaryId) return;
      setImportBusy(true);
      try {
        const formData = new FormData();
        formData.append('dryRun', 'true');
        formData.append('file', file);
        const preview = await apiRequest<ImportDryRunResponse>(
          `/projects/${projectId}/glossaries/${selectedGlossaryId}/import`,
          { method: 'POST', body: formData },
        );
        setImportFile(file);
        setImportPreview(preview);
      } catch (err) {
        reportError(err, 'toastImportError');
      } finally {
        setImportBusy(false);
      }
    },
    [projectId, selectedGlossaryId, reportError],
  );

  const handleImportFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset so picking the same file again re-triggers the change event.
      event.target.value = '';
      if (file) void requestImportPreview(file);
    },
    [requestImportPreview],
  );

  const closeImportPreview = useCallback(() => {
    setImportFile(null);
    setImportPreview(null);
  }, []);

  const handleApplyImport = useCallback(async () => {
    if (!importFile || !selectedGlossaryId) return;
    setImportBusy(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const result = await apiRequest<ImportApplyResponse>(
        `/projects/${projectId}/glossaries/${selectedGlossaryId}/import`,
        { method: 'POST', body: formData },
      );
      closeImportPreview();
      toast.success(
        t('toastImported', {
          added: result.applied.added,
          updated: result.applied.updated,
          conflicts: result.applied.conflicts,
        }),
      );
      if (result.repushRequired) {
        toast.warning(t('toastRepushRequired'));
      }
      await Promise.all([loadGlossaries(), loadGlossary(selectedGlossaryId)]);
    } catch (err) {
      reportError(err, 'toastImportError');
    } finally {
      setImportBusy(false);
    }
  }, [
    importFile,
    projectId,
    selectedGlossaryId,
    closeImportPreview,
    loadGlossaries,
    loadGlossary,
    reportError,
    t,
  ]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [translateTermsOpen, setTranslateTermsOpen] = useState(false);

  // Activity-tab deep-link: a completed glossary-gen run to reopen for review.
  // Consumed directly in the generate-dialog props below (open + initialRunId)
  // and cleared when the dialog closes — no state-syncing effect needed. Only the
  // active tab is mounted, so this is set only for glossary deep-links.
  const suggestionRunId = useViewStore((s) => s.suggestionRunId);
  const clearSuggestionRunId = useViewStore((s) => s.clearSuggestionRunId);

  // Distinct, non-empty source strings a glossary run would analyse — mirrors the
  // server's dedup + MAX_SOURCE_ENTRIES cap so the generate dialog can show the
  // expected batch count. Kept in sync with glossary-generator.ts; shared with
  // the String Table's selection-scoped instance via countDistinctSourceTexts
  // so the cap can't silently drift between the two call sites.
  const genSourceEntryCount = useMemo(() => countDistinctSourceTexts(allEntries), [allEntries]);

  // Create the accepted suggested glossaries and assign each to the entries
  // whose source text matches one of its terms. Shared with the String Table's
  // selection-scoped "Generate Glossary from Selection" dialog instance so the
  // create+assign logic isn't duplicated; `loadGlossaries` refreshes this tab's
  // own glossary list once accepted suggestions land.
  const handleAcceptSuggestions = useGlossaryGenAccept(projectId, loadGlossaries);

  // Clear the entry selection during render when the match query changes.
  const [prevEntrySelKey, setPrevEntrySelKey] = useState({
    matchTermId,
    matchAssignment,
  });
  if (
    prevEntrySelKey.matchTermId !== matchTermId ||
    prevEntrySelKey.matchAssignment !== matchAssignment
  ) {
    setPrevEntrySelKey({ matchTermId, matchAssignment });
    setSelectedEntryIds(new Set());
  }

  const terms = useMemo(() => glossary?.terms ?? [], [glossary]);

  // Read-only glossaries (global reference glossaries, or any project
  // glossary created with `readOnly: true`) auto-ignore NON-CONSTANT terms
  // that are missing a translation for one of the project's configured
  // target languages: they're excluded from the active/usable list — and
  // from matching/assignment below — and instead surfaced in a distinct
  // "flagged" section below so it's clear why they aren't showing up.
  // Constant (do-not-translate) terms are exempt: they routinely carry
  // no/sparse translations by design (mirrors the server-side masking
  // guarantee in M9/M10/M25's glossary lookup). Editable glossaries are
  // unaffected — `visibleTerms` is just `terms` and `flaggedTerms` is always
  // empty for them.
  const targetLanguages = useMemo(
    () => projectTargetLanguages({ activeLanguages, sourceLanguage: sourceLanguage ?? '' }),
    [activeLanguages, sourceLanguage],
  );
  const { visibleTerms, flaggedTerms } = useMemo(() => {
    if (!isReadOnly) return { visibleTerms: terms, flaggedTerms: [] as GlossaryTerm[] };
    const visible: GlossaryTerm[] = [];
    const flagged: GlossaryTerm[] = [];
    for (const term of terms) {
      (term.constant || isComplete(term, targetLanguages) ? visible : flagged).push(term);
    }
    return { visibleTerms: visible, flaggedTerms: flagged };
  }, [terms, isReadOnly, targetLanguages]);

  // Clear the term selection during render when the glossary changes;
  // the effect below aborts any in-flight bulk operation.
  const glossaryId = glossary?.id;
  const [prevTermSelKey, setPrevTermSelKey] = useState({ selectedGlossaryId, glossaryId });
  if (
    prevTermSelKey.selectedGlossaryId !== selectedGlossaryId ||
    prevTermSelKey.glossaryId !== glossaryId
  ) {
    setPrevTermSelKey({ selectedGlossaryId, glossaryId });
    setSelectedTermIds(new Set());
  }

  useEffect(() => {
    bulkAbortRef.current?.abort();
    bulkAbortRef.current = null;
  }, [selectedGlossaryId, glossaryId]);

  useEffect(() => () => bulkAbortRef.current?.abort(), []);

  const toggleTermSelected = useCallback((id: string, checked: boolean) => {
    setSelectedTermIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAllSelected = useCallback(
    (checked: boolean) => {
      setSelectedTermIds(checked ? new Set(terms.map((term) => term.id)) : new Set());
    },
    [terms],
  );

  const toggleEntrySelected = useCallback((id: string, checked: boolean) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAllEntriesSelected = useCallback(
    (checked: boolean) => {
      if (matchResults) {
        setSelectedEntryIds(checked ? new Set(matchResults.map((e) => e.id)) : new Set());
      }
    },
    [matchResults],
  );

  const applyBulkConstant = useCallback(
    async (constant: boolean) => {
      if (!selectedGlossaryId || selectedTermIds.size === 0) return;
      const ids = Array.from(selectedTermIds);
      const folderId = selectedGlossaryId;
      bulkAbortRef.current?.abort();
      const controller = new AbortController();
      bulkAbortRef.current = controller;
      setBulkBusy(true);
      try {
        await Promise.all(
          ids.map((termId) =>
            apiRequest<GlossaryTerm>(
              `/projects/${projectId}/glossaries/${folderId}/terms/${termId}`,
              {
                method: 'PATCH',
                body: JSON.stringify({ constant }),
                signal: controller.signal,
              },
            ),
          ),
        );
        if (controller.signal.aborted) return;
        setSelectedTermIds(new Set());
        await loadGlossary(folderId);
        toast.success(t('toastTermUpdated'));
      } catch (err) {
        if (controller.signal.aborted) return;
        reportError(err, 'toastUpdateError');
      } finally {
        // Always clear the busy flag, even when a glossary switch already
        // nulled the abort-controller ref (which would otherwise fail this
        // check and leave both bulk buttons stuck disabled). Only the ref
        // reset itself is conditional, so a *newer* in-flight op's ref isn't
        // clobbered by this (older, now-irrelevant) op's finally.
        setBulkBusy(false);
        if (bulkAbortRef.current === controller) {
          bulkAbortRef.current = null;
        }
      }
    },
    [selectedGlossaryId, selectedTermIds, projectId, loadGlossary, reportError, t],
  );

  const handleAssignGlossary = useCallback(async () => {
    if (!selectedGlossaryId || selectedEntryIds.size === 0) return;
    setAssigningBusy(true);
    try {
      const ids = Array.from(selectedEntryIds);
      const entryMap = new Map(allEntries.map((e) => [e.id, e]));
      await Promise.all(
        ids.map(async (entryId) => {
          const entry = entryMap.get(entryId);
          if (!entry) return;
          const currentGlossaries = entry.assignedGlossaryIds ?? [];
          if (currentGlossaries.includes(selectedGlossaryId)) return;
          const newGlossaryIds = Array.from(new Set([...currentGlossaries, selectedGlossaryId]));
          await updateEntry(projectId, entryId, { assignedGlossaryIds: newGlossaryIds });
        }),
      );
      setSelectedEntryIds(new Set());
      toast.success(t('toastAssigned'));
    } catch (err) {
      reportError(err, 'toastUpdateError');
    } finally {
      setAssigningBusy(false);
    }
  }, [selectedGlossaryId, selectedEntryIds, allEntries, updateEntry, projectId, reportError, t]);

  const handleUnassignGlossary = useCallback(async () => {
    if (!selectedGlossaryId || selectedEntryIds.size === 0) return;
    setAssigningBusy(true);
    try {
      const ids = Array.from(selectedEntryIds);
      const entryMap = new Map(allEntries.map((e) => [e.id, e]));
      await Promise.all(
        ids.map(async (entryId) => {
          const entry = entryMap.get(entryId);
          if (!entry) return;
          const currentGlossaries = entry.assignedGlossaryIds ?? [];
          if (!currentGlossaries.includes(selectedGlossaryId)) return;
          const newGlossaryIds = currentGlossaries.filter((id) => id !== selectedGlossaryId);
          await updateEntry(projectId, entryId, { assignedGlossaryIds: newGlossaryIds });
        }),
      );
      setSelectedEntryIds(new Set());
      toast.success(t('toastAssigned'));
    } catch (err) {
      reportError(err, 'toastUpdateError');
    } finally {
      setAssigningBusy(false);
    }
  }, [selectedGlossaryId, selectedEntryIds, allEntries, updateEntry, projectId, reportError, t]);

  const canOpenMatches = matchTermId !== null;

  const handleSearch = useCallback(() => {
    if (!canOpenMatches || !glossary) return;
    setMainOpen(false);
    setSelectedEntryIds(new Set());

    // Keep only entries whose assignment to this glossary matches the selected
    // filter (default: entries NOT yet assigned).
    const glossaryId = glossary.id;
    const matchesAssignment = (entry: StringEntry) => {
      const assigned = (entry.assignedGlossaryIds ?? []).includes(glossaryId);
      return matchAssignment === 'with' ? assigned : !assigned;
    };

    // Matching/finding entries uses only `visibleTerms` — a read-only
    // glossary's flagged/incomplete terms are excluded from matching just
    // like they're excluded from the active table and from M20's assignment.
    if (matchTermId === '__all__') {
      const termSources = visibleTerms.map((trm) => trm.source);
      setMatchResults(
        allEntries.filter(
          (entry) =>
            matchesAssignment(entry) &&
            termSources.some((src) => termMatchesText(src, entry.sourceText)),
        ),
      );
      return;
    }

    const selectedTerm = visibleTerms.find((trm) => trm.id === matchTermId);
    if (!selectedTerm) {
      setMatchResults([]);
      return;
    }

    setMatchResults(
      allEntries.filter(
        (entry) =>
          matchesAssignment(entry) && termMatchesText(selectedTerm.source, entry.sourceText),
      ),
    );
  }, [canOpenMatches, glossary, visibleTerms, matchTermId, matchAssignment, allEntries]);

  // Tracks whether matchTermId/matchAssignment last changed via an explicit
  // user pick (the term Select or the with/without toggle below) rather than
  // the '__all__' default or the automatic glossary-switch reset — only a
  // real pick should auto-run the debounced search effect further down (see
  // its comment for why: now that matchTermId always starts non-null,
  // canOpenMatches alone can no longer distinguish "user asked for this" from
  // "just mounted/switched"). State (not a ref) because the reset below needs
  // to clear it during render, alongside its sibling setState calls there.
  const [userPickedMatchCriteria, setUserPickedMatchCriteria] = useState(false);
  const handleMatchTermIdChange = useCallback((v: string | null) => {
    setUserPickedMatchCriteria(true);
    setMatchTermId(v);
  }, []);
  const handleMatchAssignmentChange = useCallback((v: 'with' | 'without') => {
    setUserPickedMatchCriteria(true);
    setMatchAssignment(v);
  }, []);

  // Reset match state during render when the selected glossary changes. Keying
  // on the glossary (not matchTermId) also fixes a bug where picking a specific
  // term was immediately cleared again by this reset.
  const [prevMatchGlossaryId, setPrevMatchGlossaryId] = useState(selectedGlossaryId);
  if (prevMatchGlossaryId !== selectedGlossaryId) {
    setPrevMatchGlossaryId(selectedGlossaryId);
    setMatchResults(null);
    setMatchTermId('__all__');
    setUserPickedMatchCriteria(false);
    if (!selectedGlossaryId) setGlossary(null);
  }

  useEffect(() => {
    if (!selectedGlossaryId) return;
    let stale = false;
    apiRequest<Glossary>(`/projects/${projectId}/glossaries/${selectedGlossaryId}`, {
      onVaultLockedRetry: (g) => {
        if (!stale) setGlossary(g);
      },
    })
      .then((g) => {
        if (!stale) setGlossary(g);
      })
      .catch((err: unknown) => {
        if (!stale) reportError(err, 'toastLoadError');
      });
    return () => {
      stale = true;
    };
  }, [selectedGlossaryId, projectId, reportError]);

  // Auto-run the search (debounced) whenever the criteria feeding it change, so
  // there is no explicit Search button: picking a term or toggling the
  // with/without filter both refresh the results (and, via handleSearch,
  // collapse the main editor to reveal them). Debounced to avoid firing on
  // every keystroke.
  //
  // Gated on `userPickedMatchCriteria` (see its declaration above): now that
  // `matchTermId` defaults to '__all__' (never null), `canOpenMatches` is true
  // from first render, so without this guard every mount/glossary-switch would
  // auto-run a search and collapse the main editor — surprising behavior
  // nobody asked for. Opening the panel explicitly (GlossaryMatchPanel's
  // `onOpenChange`) still calls `onSearch()` directly, so that path is
  // unaffected by this gate.
  useEffect(() => {
    if (!canOpenMatches || !glossary || !userPickedMatchCriteria) return;
    const handle = setTimeout(() => handleSearch(), 275);
    return () => clearTimeout(handle);
  }, [canOpenMatches, glossary, handleSearch, userPickedMatchCriteria]);

  // DeepL copy is stale when the glossary changed (e.g. via import) after the
  // last recorded push.
  const repushNeeded =
    glossary != null &&
    glossary.id === selectedGlossaryId &&
    glossary.pushedToDeepLAt != null &&
    glossary.updatedAt > glossary.pushedToDeepLAt;

  return (
    <div data-testid="glossary-tab" className="flex gap-4">
      {/* Glossary sidebar */}
      <GlossarySidebar
        projectId={projectId}
        sortedGlossaries={sortedGlossaries}
        selectedGlossaryId={selectedGlossaryId}
        onSelectGlossary={setSelectedGlossaryId}
        onRequestDeleteGlossary={setPendingDeleteGlossaryId}
        onGenerate={() => setGenerateOpen(true)}
        loadGlossaries={loadGlossaries}
        reportError={reportError}
        isCollaborator={isCollaborator}
      />

      {/* Main glossary content */}
      <div className="flex-1 min-w-0 space-y-4">
        {isCollaborator && (
          <div className="text-xs text-muted-foreground" data-testid="glossary-collab-hint">
            {t('collab:locks.glossaryEditScoped')}
          </div>
        )}
        <Collapsible
          open={mainOpen}
          onOpenChange={(open) => {
            setMainOpen(open);
            if (open) setMatchResults(null);
          }}
        >
          <CollapsibleTrigger>
            <div className="flex items-center gap-2 cursor-pointer py-1">
              <ChevronRight
                className={cn('size-4 transition-transform', mainOpen && 'rotate-90')}
              />
              <span className="font-semibold text-sm">
                {glossary?.name ?? selectedGlossary?.name ?? ''}
              </span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {selectedGlossary ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="flex items-center gap-2">
                      {selectedGlossary.name}
                      {isReadOnly && (
                        <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                          <Lock className="w-3 h-3" /> {t('readOnly')}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs font-normal"
                        onClick={() =>
                          handleToggleEnabled(selectedGlossary.id, selectedGlossary.enabled ?? true)
                        }
                        data-testid="glossary-toggle-enabled-btn"
                        title={(selectedGlossary.enabled ?? true) ? t('disable') : t('enable')}
                      >
                        {(selectedGlossary.enabled ?? true) ? (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" />
                            {t('disable')}
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            {t('enable')}
                          </>
                        )}
                      </Button>
                    </CardTitle>
                    {isReadOnly && (
                      <p className="text-xs text-muted-foreground">
                        {t('sourceLabel')}{' '}
                        <a
                          href="https://docs.google.com/spreadsheets/d/1-KqhQMcI6wydUwjqYPFsg-rMYYfiOejHgWDWNHQc3zE"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-foreground"
                        >
                          {t('sourceLink')}
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                    {repushNeeded && (
                      <span
                        className="flex items-center gap-1 rounded-md border border-status-warn/40 bg-status-warn/10 px-2 py-1 text-xs text-status-warn"
                        data-testid="glossary-repush-required"
                        title={t('toastRepushRequired')}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {t('repushRequired')}
                      </span>
                    )}

                    {/* Group: export + import. Kept as one non-wrapping unit so the
                        toolbar wraps between groups rather than mid-group. */}
                    <div className="flex flex-nowrap items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleExport('csv')}
                        data-testid="glossary-export-csv-btn"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        {t('exportCsv')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleExport('tbx')}
                        data-testid="glossary-export-tbx-btn"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        {t('exportTbx')}
                      </Button>
                      {!isReadOnly && (
                        <>
                          <input
                            ref={importFileInputRef}
                            type="file"
                            accept=".csv,.tbx,.xml,text/csv,application/xml"
                            className="hidden"
                            data-testid="glossary-import-file-input"
                            onChange={handleImportFileChange}
                          />
                          <Button
                            variant="outline"
                            disabled={importBusy}
                            onClick={() => importFileInputRef.current?.click()}
                            data-testid="glossary-import-btn"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1" />
                            {t('importBtn')}
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Bulk mark/clear-constant PATCHes non-translation fields —
                        'manage'-only server-side (assertGlossaryTermEditAllowed
                        rejects `constant` for collaborators), so hidden for them
                        rather than offered only to fail per-term. Its own group:
                        only present while terms are selected. */}
                    {!isReadOnly && !isCollaborator && selectedTermIds.size > 0 && (
                      <div className="flex flex-nowrap items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => applyBulkConstant(true)}
                          disabled={bulkBusy}
                          data-testid="glossary-bulk-mark-constant-btn"
                        >
                          {t('bulkMarkConstant', { count: selectedTermIds.size })}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => applyBulkConstant(false)}
                          disabled={bulkBusy}
                          data-testid="glossary-bulk-clear-constant-btn"
                        >
                          {t('bulkClearConstant', { count: selectedTermIds.size })}
                        </Button>
                      </div>
                    )}

                    {/* Group: AI generation + DeepL push, in that order. Also kept
                        as one non-wrapping unit (see above). */}
                    <div className="flex flex-nowrap items-center gap-2">
                      {/* Also 'manage'-only server-side (translate-terms route),
                          and its dialog is already hidden outright for
                          collaborators below — so the trigger is hidden too
                          rather than left as a dead click. */}
                      {!isReadOnly && !isCollaborator && (
                        <Button
                          onClick={() => setTranslateTermsOpen(true)}
                          data-testid="glossary-translate-terms-btn"
                        >
                          <Languages className="w-3.5 h-3.5 mr-1" />
                          {t('translateTerms')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => void handlePushDeepL(false)}
                        data-testid="glossary-push-deepl-btn"
                        disabled={!isDeepLEnabled || selectedGlossary?.enabled === false}
                      >
                        {t('pushToDeepL')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setPushReplaceConfirmOpen(true)}
                        data-testid="glossary-push-deepl-replace-btn"
                        disabled={!isDeepLEnabled || selectedGlossary?.enabled === false}
                      >
                        {t('pushToDeepLReplace')}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedGlossary?.enabled === false && (
                    <div
                      className="mb-3 flex items-center gap-2 rounded-md border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn"
                      data-testid="glossary-disabled-banner"
                    >
                      <EyeOff className="w-4 h-4 shrink-0" />
                      {t('disabledBanner')}
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow className="group">
                        {!isReadOnly && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={terms.length > 0 && selectedTermIds.size === terms.length}
                              onCheckedChange={(checked) => toggleAllSelected(checked === true)}
                              data-testid="glossary-select-all"
                              aria-label={t('selectAll')}
                            />
                          </TableHead>
                        )}
                        <TableHead>{t('colSource')}</TableHead>
                        {activeLanguages.map((lang) => (
                          <TableHead key={lang}>{LANG_NAMES[lang] ?? lang}</TableHead>
                        ))}
                        <TableHead className="w-24">{t('colConstant')}</TableHead>
                        {!isReadOnly && <TableHead>{t('colNotes')}</TableHead>}
                        {!isReadOnly && (
                          <TableHead className="sticky right-0 z-10 w-32 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted">
                            {t('colActions')}
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleTerms.map((term) => (
                        <GlossaryTermRow
                          key={term.id}
                          term={term}
                          activeLanguages={activeLanguages}
                          isReadOnly={isReadOnly}
                          isCollaborator={isCollaborator}
                          writableLanguages={writableLanguages}
                          isSelected={selectedTermIds.has(term.id)}
                          editingId={editingId}
                          editDraft={editDraft}
                          onToggleSelected={toggleTermSelected}
                          onStartEdit={startEdit}
                          onCancelEdit={cancelEdit}
                          onSaveEdit={handleSaveEdit}
                          onEditDraftChange={setEditDraft}
                          onRequestDelete={setPendingDeleteId}
                        />
                      ))}

                      {/* New term row (only for editable glossaries, and only
                          for owners — adding a term is a 'manage' capability
                          collaborators never hold server-side). */}
                      {!isReadOnly && !isCollaborator && (
                        <TableRow className="group">
                          <TableCell />
                          <TableCell>
                            <Input
                              placeholder="New source term"
                              value={draft.source}
                              onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                              data-testid="glossary-new-source"
                              data-content
                            />
                          </TableCell>
                          {activeLanguages.map((lang) => (
                            <TableCell key={lang}>
                              <Input
                                placeholder={lang}
                                value={draft.translations[lang] ?? ''}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    translations: { ...draft.translations, [lang]: e.target.value },
                                  })
                                }
                                data-testid={`glossary-new-translation-${lang}`}
                                data-content
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Checkbox
                              checked={draft.constant ?? false}
                              onCheckedChange={(checked) =>
                                setDraft({ ...draft, constant: checked === true })
                              }
                              data-testid="glossary-new-constant"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={t('notesPlaceholder')}
                              value={draft.notes ?? ''}
                              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                              data-testid="glossary-new-notes"
                              data-content
                            />
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 w-32 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted">
                            <Button size="sm" onClick={handleAdd} data-testid="glossary-add-btn">
                              {t('add')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {terms.length === 0 && (
                    <div
                      className="mt-4 flex flex-col items-center gap-1.5 rounded-md border border-dashed border-border/70 px-4 py-6 text-center"
                      data-testid="glossary-empty-terms"
                    >
                      <BookText className="size-5 text-muted-foreground" />
                      <p className="text-sm font-medium">{t('emptyTermsTitle')}</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        {isReadOnly ? t('emptyTermsReadOnly') : t('emptyTermsHint')}
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Label>{t('totalTerms')}</Label>
                    <span>{terms.length}</span>
                  </div>
                  {/* Flagged/incomplete section — only read-only glossaries auto-ignore
                      terms missing a translation for a configured target language.
                      They're excluded from the active table above but listed here so
                      it's clear why a term isn't showing up (and never used for
                      matching, assignment, or translation reference in the meantime). */}
                  {isReadOnly && flaggedTerms.length > 0 && (
                    <div
                      className="mt-4 rounded-md border border-dashed border-status-warn/40 bg-status-warn/10 px-3 py-2"
                      data-testid="glossary-flagged-terms"
                    >
                      <div className="flex items-center gap-2 text-xs font-medium text-status-warn">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {t('flaggedTitle', { count: flaggedTerms.length })}
                      </div>
                      <p className="mt-1 text-[11px] text-status-warn/90">{t('flaggedHint')}</p>
                      <ul className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                        {flaggedTerms.map((term) => {
                          const missing = targetLanguages.filter(
                            (lang) => !term.translations[lang]?.length,
                          );
                          return (
                            <li
                              key={term.id}
                              className="flex items-center justify-between gap-2 text-xs"
                              data-testid={`glossary-flagged-term-${term.id}`}
                            >
                              <span className="truncate font-medium">{term.source}</span>
                              <span className="shrink-0 text-[11px] text-status-warn/80">
                                {t('flaggedMissingLanguages', {
                                  languages: missing.map((l) => LANG_NAMES[l] ?? l).join(', '),
                                })}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-muted-foreground text-sm p-4">{t('noGlossarySelected')}</div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Matches panel — only shown when a glossary is selected */}
        {glossary && (
          <GlossaryMatchPanel
            matchResults={matchResults}
            matchTermId={matchTermId}
            matchAssignment={matchAssignment}
            visibleTerms={visibleTerms}
            selectedEntryIds={selectedEntryIds}
            assigningBusy={assigningBusy}
            canOpenMatches={canOpenMatches}
            onMatchTermIdChange={handleMatchTermIdChange}
            onMatchAssignmentChange={handleMatchAssignmentChange}
            onSetMainOpen={setMainOpen}
            onSetMatchResults={setMatchResults}
            onSearch={handleSearch}
            onToggleAllEntriesSelected={toggleAllEntriesSelected}
            onToggleEntrySelected={toggleEntrySelected}
            onAssignGlossary={handleAssignGlossary}
            onUnassignGlossary={handleUnassignGlossary}
          />
        )}
      </div>

      {/* Confirm delete term */}
      <Sheet
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t('confirmDeleteTitle')}</SheetTitle>
            <SheetDescription>{t('confirmDeleteDescription')}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              {t('cancel')}
            </Button>
            {/* Defense-in-depth alongside GlossaryTermRow's hidden trigger —
                deleting a term is 'manage'-only server-side. */}
            {!isCollaborator && (
              <Button
                variant="destructive"
                data-testid="confirm-delete-term-button"
                onClick={confirmDelete}
              >
                {t('delete')}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Import dry-run diff confirmation */}
      <GlossaryImportPreviewSheet
        importPreview={importPreview}
        glossaryName={selectedGlossary?.name ?? ''}
        importBusy={importBusy}
        onClose={closeImportPreview}
        onApply={handleApplyImport}
      />

      {/* Confirm delete glossary */}
      <Sheet
        open={pendingDeleteGlossaryId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteGlossaryId(null);
        }}
      >
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t('confirmDeleteGlossaryTitle')}</SheetTitle>
            <SheetDescription>{t('confirmDeleteGlossaryDescription')}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setPendingDeleteGlossaryId(null)}>
              {t('cancel')}
            </Button>
            {/* Deleting a glossary is a 'manage' capability — collaborators
                never hold it server-side, so the actual delete action is
                hidden even though the sidebar trigger stays reachable. */}
            {!isCollaborator && (
              <Button
                variant="destructive"
                data-testid="confirm-delete-glossary-button"
                onClick={handleDeleteGlossary}
              >
                {t('delete')}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirm replace-mode DeepL push (erases ALL narn-managed remote glossaries first) */}
      <Sheet
        open={pushReplaceConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setPushReplaceConfirmOpen(false);
        }}
      >
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t('confirmPushReplaceTitle')}</SheetTitle>
            <SheetDescription>{t('confirmPushReplaceDescription')}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setPushReplaceConfirmOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-push-deepl-replace-button"
              onClick={() => void handlePushDeepL(true)}
            >
              {t('confirmPushReplaceConfirm')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirm auto-applying matches when enabling a glossary */}
      <Sheet
        open={pendingEnableGlossaryId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEnableGlossaryId(null);
        }}
      >
        <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{t('confirmEnableApplyTitle')}</SheetTitle>
            <SheetDescription>{t('confirmEnableApplyDescription')}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              data-testid="enable-decline-apply-button"
              onClick={() => resolveEnablePrompt(false)}
            >
              {t('confirmEnableApplyDecline')}
            </Button>
            <Button
              data-testid="enable-confirm-apply-button"
              onClick={() => resolveEnablePrompt(true)}
            >
              {t('confirmEnableApplyConfirm')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* AI glossary generation — 'manage'-only server-side, so hidden outright
          for collaborators rather than opened only to fail on submit. */}
      {!isCollaborator && (
        <GenerateGlossaryDialog
          projectId={projectId}
          open={generateOpen || suggestionRunId !== null}
          onOpenChange={(open) => {
            setGenerateOpen(open);
            // Closing consumes the deep-link so a later reopen via the Generate
            // button starts a fresh generation rather than re-showing the old run.
            if (!open && suggestionRunId !== null) clearSuggestionRunId();
          }}
          enabledGlossaries={glossaries.filter((f) => f.enabled !== false)}
          onAccept={handleAcceptSuggestions}
          sourceEntryCount={genSourceEntryCount}
          {...(suggestionRunId ? { initialRunId: suggestionRunId } : {})}
        />
      )}

      {/* AI glossary-term translation (per selected glossary) — also 'manage'-only. */}
      {!isCollaborator && selectedGlossaryId && (
        <GenerateTermTranslationsDialog
          projectId={projectId}
          glossaryId={selectedGlossaryId}
          glossaryName={selectedGlossary?.name ?? ''}
          open={translateTermsOpen}
          onOpenChange={setTranslateTermsOpen}
          onDone={() => loadGlossary(selectedGlossaryId)}
        />
      )}
    </div>
  );
}
