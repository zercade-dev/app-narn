import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  ListChecks,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';
import { RunStatusCode, type Glossary, type TranslationRecord } from '@zercade-dev/narn-shared';
import { apiRequest, ApiError } from '../../hooks/use-api.js';
import { useVaultRetryAction } from '../../hooks/use-vault-retry-action.js';
import { useNoRouteDialog } from '../../hooks/use-no-route-dialog.js';
import { useStringStore } from '../../stores/string-store.js';
import { useRunStore } from '../../stores/run-store.js';
import { useProjectStore, accessFor } from '../../stores/project-store.js';
import { writableSubset } from '@/lib/collab-locks';
import { toast } from '@/lib/toast';
import { cn, errorMessage } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContextEditor } from '../comparison/ContextEditor.js';
import { ReviewProgressCard } from './ReviewProgressCard.js';
import {
  DiffLegend,
  DiffText,
  GlossaryHintList,
  LqaIssueList,
  ReviewCardShell,
  deriveLqaState,
  glossaryHints as computeGlossaryHints,
  useFullGlossaries,
  useReviewShortcuts,
  type ShortcutMap,
} from './review-shared.js';
import { LanguageBadgeLabel } from './LanguageBadgeLabel.js';
import { AllReviewItemsDialog } from './AllReviewItemsDialog.js';
import {
  isUnchangedAndPassing,
  itemKey,
  withKeys,
  withoutKeys,
  type ReviewItem,
} from './review-tab-types.js';

interface ReviewTabProps {
  projectId: string;
}

export function ReviewTab({ projectId }: Readonly<ReviewTabProps>) {
  const { t } = useTranslation('review');
  const { t: tBatch } = useTranslation('batch');
  const entries = useStringStore((s) => s.entries);
  const fetchEntries = useStringStore((s) => s.fetchEntries);
  const updateEntry = useStringStore((s) => s.updateEntry);
  const fetchEntry = useStringStore((s) => s.fetchEntry);
  const bulkUpdate = useStringStore((s) => s.bulkUpdate);
  const fetchRuns = useRunStore((s) => s.fetchRuns);
  const sourceLanguage = useProjectStore(
    (s) => s.projects.find((p) => p.id === projectId)?.sourceLanguage,
  );
  // Which languages the current access (owner/collaborator + writableLanguages)
  // may WRITE — mirrors the Compare/Strings-editor wiring (collab-locks.ts).
  // Manual review only ever touches the record it's reviewing (approve/edit/
  // retranslate all write), so the per-language queue selector itself is
  // scoped rather than any one action.
  const access = useProjectStore((s) => accessFor(s, projectId));

  const [retranslateRun, setRetranslateRun] = useState<{
    runId: string;
    entryId: string;
    language: string;
  } | null>(null);
  const latestRun = useRunStore((s) => s.runs?.find((r) => r.runId === retranslateRun?.runId));
  const notifiedRetranslateRunId = useRef<string | null>(null);

  // Capture re-translation run completion during render (transition-based).
  // Clearing retranslateRun detaches `latestRun`, so the notification effect
  // below reads the captured notice instead of the store.
  const retranslateRunStatus = latestRun?.status;
  const [prevRetranslateStatus, setPrevRetranslateStatus] =
    useState<typeof retranslateRunStatus>(undefined);
  const [retranslateNotice, setRetranslateNotice] = useState<{
    runId: string;
    entryId: string;
    language: string;
    status: RunStatusCode;
    completed: number;
    failed: number;
    total: number;
  } | null>(null);

  // Reset all retranslate tracking state when the project changes — otherwise
  // a stale `retranslateRun` from the previous project can never resolve (its
  // run id doesn't exist in the new project's run store), leaving the
  // Retranslate button stuck disabled. Guard the completion-capture block
  // below with `projectChanged` too, so the same render pass that resets the
  // state doesn't immediately repopulate it from the pre-reset (stale
  // project's) `retranslateRun`/`prevRetranslateStatus` values — those local
  // bindings don't reflect the resets above until the next render.
  const [prevProjectIdForRetranslate, setPrevProjectIdForRetranslate] = useState(projectId);
  const projectChanged = prevProjectIdForRetranslate !== projectId;
  if (projectChanged) {
    setPrevProjectIdForRetranslate(projectId);
    setRetranslateRun(null);
    setPrevRetranslateStatus(undefined);
    setRetranslateNotice(null);
    // Must clear synchronously in this render so the immediate re-render (from
    // the setState calls above) sees a cleared id in its `!projectChanged`
    // capture block below; a post-commit effect would run too late.
    // eslint-disable-next-line react-hooks/refs
    notifiedRetranslateRunId.current = null;
  }

  if (!projectChanged && prevRetranslateStatus !== retranslateRunStatus) {
    setPrevRetranslateStatus(retranslateRunStatus);

    const isFinished =
      retranslateRunStatus === RunStatusCode.Completed ||
      retranslateRunStatus === RunStatusCode.Failed ||
      retranslateRunStatus === RunStatusCode.Cancelled;

    if (latestRun && retranslateRun && isFinished) {
      setRetranslateNotice({
        runId: retranslateRun.runId,
        entryId: retranslateRun.entryId,
        language: retranslateRun.language,
        status: retranslateRunStatus,
        completed: latestRun.completed,
        failed: latestRun.failed,
        total: latestRun.total,
      });
      setRetranslateRun(null);
    }
  }

  // Once per finished run: refresh the entry so the queue shows the new text,
  // re-flag it for review (the engine clears needsReview on overwrite), and
  // notify the user. The re-flag is retried once on a transient failure (a
  // flaky refetch/update must not silently drop the entry unreviewed out of
  // the queue), and any remaining failure is caught and toasted rather than
  // left as an unhandled promise rejection.
  useEffect(() => {
    if (!retranslateNotice || notifiedRetranslateRunId.current === retranslateNotice.runId) return;
    notifiedRetranslateRunId.current = retranslateNotice.runId;

    const { entryId, language, status, completed, failed, total } = retranslateNotice;
    const reflagForReview = async (): Promise<void> => {
      await fetchEntry(projectId, entryId);
      await bulkUpdate(projectId, [entryId], {
        translations: { [language]: { needsReview: true } },
      });
    };
    void reflagForReview()
      .catch(() => reflagForReview())
      .catch((err) => {
        toast.error(errorMessage(err, t('actionFailed')));
      });

    if (failed > 0) {
      toast.warning(tBatch('runCompletedWithErrors', { completed, failed }));
    } else if (status === RunStatusCode.Completed) {
      toast.success(tBatch('runCompleted', { completed, total }));
    }
  }, [retranslateNotice, projectId, fetchEntry, bulkUpdate, t, tBatch]);

  // Ensure entries are loaded when this tab is opened directly.
  useEffect(() => {
    if (projectId) void fetchEntries(projectId);
  }, [projectId, fetchEntries]);

  // Full glossaries (with terms) for this project, so the reviewer can see the
  // glossary terms that apply to the current entry and their target wording.
  const { glossaries, loading: glossariesLoading } = useFullGlossaries(projectId);

  // Which slice of the queue to show: translations still awaiting review
  // (needsReview === true), or ones the reviewer set aside via Flag
  // (status === 'flagged', needsReview cleared).
  const [filter, setFilter] = useState<'needsReview' | 'flagged'>('needsReview');

  // (entry, language) keys approved this session but not yet confirmed by the
  // store refresh. Approving drops the card optimistically (smoother review);
  // a failed request removes the key again so the card reappears.
  const [optimisticApproved, setOptimisticApproved] = useState<Set<string>>(new Set());

  // "View all" overview dialog + its in-flight Approve-all state. The overview
  // lists every pending item in the language currently under review; Approve all
  // sends them to the TM in one request (scoped to that language only).
  const [allItemsOpen, setAllItemsOpen] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  // Per-language review queues for the active filter, built in one pass: each
  // language maps to its ordered list of (entry, record) items awaiting review.
  // Reviewing happens one language at a time, so the queue is sliced by the
  // selected language rather than flattening every language together.
  const queuesByLanguage = useMemo(() => {
    const map = new Map<string, ReviewItem[]>();
    for (const entry of entries) {
      if (entry.needsTranslation === false) continue;
      for (const [language, record] of Object.entries(entry.translations)) {
        if (!record) continue;
        // Hide cards approved optimistically until the store catches up.
        if (optimisticApproved.has(itemKey(entry.id, language))) continue;
        const match =
          filter === 'needsReview' ? record.needsReview === true : record.status === 'flagged';
        if (!match) continue;
        let queue = map.get(language);
        if (!queue) {
          queue = [];
          map.set(language, queue);
        }
        queue.push({ entry, language, record });
      }
    }
    return map;
  }, [entries, filter, optimisticApproved]);

  // Languages that have at least one pending item under the active filter,
  // sorted by code, further scoped to the languages this access may WRITE —
  // a no-op filter for owners (writableSubset always allows owners), so this
  // is byte-identical to the prior unfiltered list for them. These
  // populate the language selector; the effectiveLanguage fallback below
  // already handles the queue shrinking out from under a stale selection.
  const availableLanguages = useMemo(
    () =>
      writableSubset(
        access,
        [...queuesByLanguage.keys()].sort((a, b) => a.localeCompare(b)),
      ),
    [queuesByLanguage, access],
  );

  // The language being reviewed. When the stored choice is no longer pending
  // (filter switch, or its queue drained to zero), fall back to the first
  // available language so the reviewer rolls onto the next language to clear.
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const effectiveLanguage =
    selectedLanguage && queuesByLanguage.has(selectedLanguage)
      ? selectedLanguage
      : (availableLanguages[0] ?? null);

  // Queue for the language under review (already filtered by the active filter).
  // Memoized so its identity is stable across renders — handleApproveAll closes
  // over the whole array, not just its length.
  const items = useMemo(
    () => (effectiveLanguage ? (queuesByLanguage.get(effectiveLanguage) ?? []) : []),
    [effectiveLanguage, queuesByLanguage],
  );

  const [index, setIndex] = useState(0);
  // Restart the queue at the top whenever the language under review changes
  // (user pick, filter switch, or auto-advance after draining a language).
  const [prevLanguage, setPrevLanguage] = useState(effectiveLanguage);
  if (prevLanguage !== effectiveLanguage) {
    setPrevLanguage(effectiveLanguage);
    setIndex(0);
  }
  const safeIndex = Math.min(index, Math.max(0, items.length - 1));
  const current: ReviewItem | undefined = items[safeIndex];

  // Glossaries assigned to the current entry (the whole glossary applies because
  // at least one of its terms occurs in the source). Names resolved from the
  // loaded full glossaries; stale/disabled assignments not in the set are dropped.
  const assignedGlossaries = useMemo(() => {
    if (!current) return [];
    const assigned = current.entry.assignedGlossaryIds ?? [];
    return assigned
      .map((id) => glossaries.find((g) => g.id === id))
      .filter((g): g is Glossary => Boolean(g))
      .map((g) => ({ id: g.id, name: g.name }));
  }, [current, glossaries]);

  // Glossary terms that actually occur in the current entry's source text,
  // paired with their wording for the current target language. Mirrors the
  // server's word-boundary matching (M20 GlossaryAssigner) so the reviewer
  // sees exactly the terms the engine would have applied.
  const glossaryHints = useMemo(
    () =>
      current
        ? computeGlossaryHints(
            current.entry.sourceText,
            glossaries,
            current.entry.assignedGlossaryIds ?? [],
          )
        : [],
    [current, glossaries],
  );

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Display-only back-translation of the current target text into the source
  // language. Never persisted — shown purely as a reviewer reference.
  const [backTranslating, setBackTranslating] = useState(false);
  const [backTranslation, setBackTranslation] = useState<string | null>(null);

  // Reset editing + back-translation state during render whenever the current
  // item changes (a reference from the previous entry must not leak across).
  const currentKey = current ? `${current.entry.id}::${current.language}` : '';
  const [prevKey, setPrevKey] = useState(currentKey);
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setEditing(false);
    setBackTranslation(null);
    setBackTranslating(false);
  }

  // Tracks the latest `currentKey` for `handleBackTranslate`'s stale-response
  // guard below (mirrors GlossaryTab's `selectedGlossaryIdRef` pattern) — synced
  // in an effect (not during render) so an async callback can tell whether the
  // card it was fired for is still the one displayed.
  const currentKeyRef = useRef(currentKey);
  useEffect(() => {
    currentKeyRef.current = currentKey;
  }, [currentKey]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, Math.max(0, items.length - 1)));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Switching the filter restarts the queue from the top of the new slice.
  const selectFilter = useCallback((next: 'needsReview' | 'flagged') => {
    setFilter(next);
    setIndex(0);
  }, []);

  // Switching the language under review (the index reset is handled by the
  // language-change effect during render).
  const selectLanguage = useCallback((next: string) => {
    setSelectedLanguage(next);
  }, []);

  const patchRecord = useCallback(
    async (item: ReviewItem, patch: Partial<TranslationRecord>): Promise<boolean> => {
      try {
        const merged: TranslationRecord = { ...item.record, ...patch };
        // A patch that replaces the text (a manual edit or its undo) leaves the
        // old record's Freeway tier (and its bucket key) attributed to text
        // that tier never produced — clear both, never carry them onto
        // human-written text.
        if (patch.text !== undefined) {
          delete merged.freewayTier;
          delete merged.freewayBucketKey;
        }
        await updateEntry(projectId, item.entry.id, {
          translations: { [item.language]: merged },
        });
        return true;
      } catch (err) {
        toast.error(errorMessage(err, t('actionFailed')));
        return false;
      }
    },
    [projectId, updateEntry, t],
  );

  // Approving records the translation into the (global) translation memory and
  // marks it reviewed — the memory holds only human-approved variants, so this
  // is the manual gate that lets a translation enter the TM.
  const handleApprove = useCallback(async () => {
    if (!current) return;
    const { entry, language } = current;
    const key = itemKey(entry.id, language);
    // Drop the card immediately so the next item slides in without waiting on
    // the round-trip. The marker is cleared either way once we know the result.
    setOptimisticApproved((s) => withKeys(s, [key]));
    try {
      await apiRequest(`/projects/${projectId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          pairs: [{ entryId: entry.id, targetLanguage: language }],
        }),
      });
      // The refreshed entry no longer needs review, so it leaves the queue on
      // its own — drop the optimistic marker now that the store agrees.
      await fetchEntry(projectId, entry.id);
      setOptimisticApproved((s) => withoutKeys(s, [key]));
    } catch (err) {
      // Restore the card: clearing the marker brings it back into the queue.
      setOptimisticApproved((s) => withoutKeys(s, [key]));
      toast.error(errorMessage(err, t('actionFailed')));
    }
  }, [current, projectId, fetchEntry, t]);

  // Approve a batch of review items through the shared /approve flow: cards drop
  // optimistically (like single approve), the affected entries refetch so their
  // 'reviewed' status reaches the store (queue + progress card re-derive from
  // it), the dialog closes, and a success toast reports the server's count. A
  // failure restores the whole batch. `successToast` lets each caller phrase its
  // own message from the count. Shared by both Approve-all buttons.
  const approveItems = useCallback(
    async (approveList: ReviewItem[], successToast: (count: number) => string): Promise<void> => {
      const keys = approveList.map((it) => itemKey(it.entry.id, it.language));
      const pairs = approveList.map((it) => ({
        entryId: it.entry.id,
        targetLanguage: it.language,
      }));
      // Unique affected entries — refreshed individually below (the queue is
      // scoped to one language, so each entry appears at most once).
      const entryIds = [...new Set(approveList.map((it) => it.entry.id))];
      const dropKeys = () => setOptimisticApproved((s) => withoutKeys(s, keys));
      setOptimisticApproved((s) => withKeys(s, keys));
      try {
        const result = await apiRequest<{ approved: number }>(`/projects/${projectId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ pairs }),
        });
        // Surgical fetches avoid re-applying the list filters that a full refetch
        // would, which can drop entries from the progress totals.
        await Promise.all(entryIds.map((id) => fetchEntry(projectId, id)));
        dropKeys();
        setAllItemsOpen(false);
        toast.success(successToast(result.approved));
      } catch (err) {
        // Restore every card: clearing the markers brings them back into the queue.
        dropKeys();
        toast.error(errorMessage(err, t('actionFailed')));
      }
    },
    [projectId, fetchEntry, t],
  );

  // Approve every pending item in the language under review in a single request.
  // Scope is deliberately the current language's queue only — the tab reviews
  // one language at a time, so this never silently approves a language the
  // reviewer hasn't looked at.
  const handleApproveAll = useCallback(async () => {
    if (items.length === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      await approveItems(items, (count) => t('approveAllSuccess', { count }));
    } finally {
      setApprovingAll(false);
    }
  }, [items, approvingAll, approveItems, t]);

  // Subset of the current language's queue eligible for one-click approval: the
  // run left the text unchanged AND the AI judge passed it cleanly (no differing
  // suggestion). Memoized so the count and the handler share one identity.
  const unchangedPassingItems = useMemo(() => items.filter(isUnchangedAndPassing), [items]);

  // Approve only the unchanged-&-passing subset. The button is disabled when the
  // subset is empty (the count badge shows 0), so the empty guard here is just
  // defensive — it prevents an empty /approve request if the handler is ever
  // invoked while nothing qualifies.
  const handleApproveUnchangedPassing = useCallback(async () => {
    if (approvingAll || unchangedPassingItems.length === 0) return;
    setApprovingAll(true);
    try {
      await approveItems(unchangedPassingItems, (count) =>
        t('approveUnchangedPassingSuccess', { count }),
      );
    } finally {
      setApprovingAll(false);
    }
  }, [unchangedPassingItems, approvingAll, approveItems, t]);

  // Jump the queue to a specific item (picked from the View-all overview) and
  // close the dialog. The overview lists exactly the current language's queue in
  // order, so its row index maps straight onto the queue index.
  const handleOpenDetails = useCallback((queueIndex: number) => {
    setIndex(queueIndex);
    setAllItemsOpen(false);
  }, []);

  const handleFlag = useCallback(async () => {
    if (!current) return;
    const ok = await patchRecord(current, { status: 'flagged', needsReview: false });
    if (ok) toast.info(t('flaggedToast'));
  }, [current, patchRecord, t]);

  const startEdit = useCallback(() => {
    if (!current) return;
    setDraft(current.record.text);
    setEditing(true);
  }, [current]);

  // Restores a record's text to the value it held before an edit, going through
  // the same patchRecord path as the save. Used by the Undo toast action.
  const handleUndoEdit = useCallback(
    async (item: ReviewItem, previousText: string) => {
      const ok = await patchRecord(item, {
        text: previousText,
        moduleId: 'manual',
        timestamp: Date.now(),
      });
      if (ok) toast.success(t('undoneToast'));
    },
    [patchRecord, t],
  );

  // Saving an edit persists only the new text — it does NOT approve the entry.
  // The translation stays in the review queue (status/needsReview unchanged) so
  // the reviewer can keep editing and approve explicitly via the Approve button.
  const handleSaveEdit = useCallback(async () => {
    if (!current) return;
    // Capture the pre-edit text and item up front so Undo can restore exactly
    // this value even after the queue has advanced to another card.
    const previousText = current.record.text;
    const editedItem = current;
    const changed = draft !== previousText;
    const ok = await patchRecord(current, {
      text: draft,
      moduleId: 'manual',
      timestamp: Date.now(),
    });
    if (ok) {
      setEditing(false);
      // Offer a one-click undo only when the edit actually changed the text.
      if (changed) {
        toast.success(t('savedToast'), {
          action: {
            label: t('undo'),
            onClick: () => void handleUndoEdit(editedItem, previousText),
          },
        });
      }
    }
  }, [current, draft, patchRecord, handleUndoEdit, t]);

  // Queue a re-translation for the current item through the vault-retry flow.
  // The (entry, language) target is captured at click time and carried on the
  // delivered RESULT itself (not a shared mutable ref) — each `run()`
  // invocation closes over its own `entry`/`language` and stamps them onto
  // both delivery paths (the awaited promise and the vault-replay callback),
  // so two retranslates in flight can never cross-attribute a run to the
  // wrong entry. The queued-run side effect (set the run, kick polling, toast)
  // runs exactly once via `onResult` whether the request resolved directly or
  // replayed after a vault unlock; a 423 is swallowed by the hook (the global
  // unlock dialog already shows). Other failures surface a toast via `onError`.
  const { handle: handleNoRoute, dialog: noRouteDialog } = useNoRouteDialog();

  const { invoke: invokeRetranslate } = useVaultRetryAction<{
    runId: string;
    total: number;
    entryId: string;
    language: string;
  }>(
    ({ onRetry }) => {
      const { entry, language } = current!;
      return apiRequest<{ runId: string; total: number }>(`/projects/${projectId}/translate`, {
        method: 'POST',
        body: JSON.stringify({
          entryIds: [entry.id],
          targetLanguages: [language],
          reTranslate: true,
        }),
        vaultRetryKey: `${entry.id}:${language}`,
        onVaultLockedRetry: (result) => onRetry({ ...result, entryId: entry.id, language }),
      }).then((result) => ({ ...result, entryId: entry.id, language }));
    },
    {
      onResult: (result) => {
        setRetranslateRun({
          runId: result.runId,
          entryId: result.entryId,
          language: result.language,
        });
        // The fetch sees the active run and auto-starts run polling, which
        // drives the completion effect above.
        void fetchRuns(projectId);
        toast.info(t('retranslateQueued'));
      },
      onError: (err) => {
        // A refused run (no routing rule for this language) gets the actionable
        // dialog instead of a toast; every other failure is unchanged.
        if (handleNoRoute(err)) return;
        toast.error(errorMessage(err, t('actionFailed')));
      },
    },
  );

  const handleRetranslate = useCallback(() => {
    if (!current) return;
    void invokeRetranslate();
  }, [current, invokeRetranslate]);

  // Translate the current target text back into the source language and show it
  // inline as a reference. The preview endpoint never persists, so this cannot
  // overwrite any stored translation.
  const handleBackTranslate = useCallback(async () => {
    if (!current || !sourceLanguage) return;
    const text = current.record.text;
    if (!text) return;
    // Capture the card this request was fired for so a resolve after the
    // reviewer has switched cards (the render-reset above already cleared
    // `backTranslation` for the new card) can't repopulate it under the wrong
    // one — see the guard just before `setBackTranslation` below.
    const key = currentKey;
    setBackTranslating(true);
    setBackTranslation(null);
    try {
      const result = await apiRequest<{ text: string; moduleId: string }>(
        `/projects/${projectId}/translate/preview`,
        {
          method: 'POST',
          body: JSON.stringify({
            entryId: current.entry.id,
            text,
            sourceLanguage: current.language,
            targetLanguage: sourceLanguage,
          }),
          // Drives the vault-unlock dialog on a 423; no onVaultLockedRetry, so the
          // request throws instead of hanging — the reviewer re-clicks once unlocked.
          vaultRetryKey: `back:${current.entry.id}:${current.language}`,
        },
      );
      if (key !== currentKeyRef.current) return;
      setBackTranslation(result.text);
    } catch (err) {
      // A 423 just opened the unlock dialog; stay silent (no error toast).
      if (!(err instanceof ApiError && err.status === 423)) {
        toast.error(errorMessage(err, t('actionFailed')));
      }
    } finally {
      setBackTranslating(false);
    }
  }, [current, currentKey, projectId, sourceLanguage, t]);

  const handleSaveContext = useCallback(
    async (entryId: string, value: string): Promise<void> => {
      try {
        await updateEntry(projectId, entryId, { context: value });
      } catch (err) {
        toast.error(errorMessage(err, t('actionFailed')));
      }
    },
    [projectId, updateEntry, t],
  );

  // Keyboard shortcuts for review throughput: ↑/↓ navigate, a approve, e edit.
  // Disabled while the inline editor is open (so typing doesn't trigger them)
  // OR while the "View all" dialog is open — otherwise a keystroke like `a`
  // would silently act on the hidden card behind the dialog.
  const shortcuts = useMemo<ShortcutMap>(
    () => ({
      ArrowDown: goNext,
      ArrowUp: goPrev,
      a: () => void handleApprove(),
      e: startEdit,
    }),
    [goNext, goPrev, handleApprove, startEdit],
  );
  useReviewShortcuts(shortcuts, !editing && !allItemsOpen);

  const {
    issues: lqaIssues,
    showOverflow,
    overflowRatio,
  } = deriveLqaState(current?.entry, current?.language ?? '');
  const previousVersion = current?.record.previousVersions?.at(-1);

  return (
    <div
      className="mx-auto flex w-full max-w-4xl xl:max-w-6xl 2xl:max-w-7xl flex-col gap-4"
      data-testid="review-tab"
    >
      {noRouteDialog}
      {access.role === 'collaborator' && (
        <div className="text-xs text-muted-foreground" data-testid="review-collab-hint">
          {t('collab:locks.reviewLanguagesScoped')}
        </div>
      )}
      {/* Header: title + filter, queue position + navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{t('title')}</h2>
          {items.length > 0 && (
            <Badge variant="secondary" data-testid="review-position">
              {t('position', { current: safeIndex + 1, total: items.length })}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Language under review — only languages with pending items appear,
              each annotated with how many remain in the active filter. */}
          {availableLanguages.length > 0 && effectiveLanguage && (
            <Select
              value={effectiveLanguage}
              onValueChange={(v) => selectLanguage(v ?? effectiveLanguage)}
            >
              <SelectTrigger
                size="sm"
                className="h-8 max-w-[16rem] text-xs"
                aria-label={t('languageLabel')}
                data-testid="review-language-select"
              >
                <SelectValue>
                  <span className="truncate">
                    <LanguageBadgeLabel code={effectiveLanguage} />
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    · {queuesByLanguage.get(effectiveLanguage)?.length ?? 0}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-56">
                {availableLanguages.map((code) => (
                  <SelectItem key={code} value={code} className="text-xs">
                    <LanguageBadgeLabel code={code} />
                    <span className="shrink-0 text-muted-foreground">
                      · {queuesByLanguage.get(code)?.length ?? 0}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Filter: needs-review queue vs flagged-aside translations. Styled as
              a segmented toggle (a bordered track with one raised, highlighted
              segment) so it reads as a single two-state switch rather than two
              independent action buttons. */}
          <div
            className="inline-flex items-center gap-0.5 rounded-md border border-input bg-muted/50 p-0.5"
            role="group"
            aria-label={t('filterLabel')}
            data-testid="review-filter"
          >
            <button
              type="button"
              onClick={() => selectFilter('needsReview')}
              aria-pressed={filter === 'needsReview'}
              data-testid="review-filter-needs-review"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === 'needsReview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Check className="size-4" aria-hidden />
              {t('filterNeedsReview')}
            </button>
            <button
              type="button"
              onClick={() => selectFilter('flagged')}
              aria-pressed={filter === 'flagged'}
              data-testid="review-filter-flagged"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === 'flagged'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Flag className="size-4" aria-hidden />
              {t('filterFlagged')}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrev}
              disabled={safeIndex === 0}
              data-testid="review-prev"
              aria-label={t('prev')}
            >
              <ChevronUp className="size-4" aria-hidden />
              {t('prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={safeIndex >= items.length - 1}
              data-testid="review-next"
              aria-label={t('next')}
            >
              <ChevronDown className="size-4" aria-hidden />
              {t('next')}
            </Button>
          </div>
          {/* Overview of every pending item in the language under review, with a
              one-shot Approve all. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAllItemsOpen(true)}
            disabled={items.length === 0}
            data-testid="review-view-all"
          >
            <ListChecks className="size-4" aria-hidden />
            {t('viewAll')}
          </Button>
        </div>
      </div>

      <AllReviewItemsDialog
        open={allItemsOpen}
        onOpenChange={setAllItemsOpen}
        items={items}
        language={effectiveLanguage}
        approvingAll={approvingAll}
        onApproveAll={() => void handleApproveAll()}
        unchangedPassingCount={unchangedPassingItems.length}
        onApproveUnchangedPassing={() => void handleApproveUnchangedPassing()}
        onOpenDetails={handleOpenDetails}
      />

      {items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center gap-2 py-16 text-center"
          data-testid="review-empty"
        >
          {filter === 'flagged' ? (
            <Flag className="size-8 text-muted-foreground" aria-hidden />
          ) : (
            <Check className="size-8 text-status-pass" aria-hidden />
          )}
          <p className="text-sm font-medium">
            {filter === 'flagged' ? t('emptyFlaggedTitle') : t('emptyTitle')}
          </p>
          <p className="text-xs text-muted-foreground">
            {filter === 'flagged' ? t('emptyFlaggedHint') : t('emptyHint')}
          </p>
        </div>
      )}

      {current && (
        <ReviewCardShell
          hint={t('keyboardHint')}
          hintKeys={['a', 'e']}
          hintTestId="review-keyboard-hint"
        >
          {/* Language + provenance */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge data-testid="review-language">
              <LanguageBadgeLabel code={current.language} />
            </Badge>
            <span className="font-mono text-[11px] text-muted-foreground">
              {t('provenance', {
                module: current.record.moduleId,
                date: new Date(current.record.timestamp).toLocaleString(),
              })}
            </span>
          </div>

          {/* Source text and current translation side by side for comparison */}
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('sourceText')}
              </h3>
              <p
                className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                data-testid="review-source-text"
              >
                {current.entry.sourceText}
              </p>
              {/* Editable translator context for this entry (persisted). */}
              <ContextEditor
                entryId={current.entry.id}
                initialValue={current.entry.context ?? ''}
                onSave={handleSaveContext}
                testIdPrefix="review-context"
              />
            </section>

            {/* Current translation (or inline editor) */}
            <section>
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('currentTranslation')}
              </h3>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    ref={textareaRef}
                    rows={4}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditing(false);
                      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void handleSaveEdit();
                      }
                    }}
                    className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
                    data-testid="review-edit-textarea"
                    aria-label={t('editAria')}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleSaveEdit()}
                      data-testid="review-edit-save"
                    >
                      {t('save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(false)}
                      data-testid="review-edit-cancel"
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p
                  className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                  data-testid="review-current-text"
                >
                  {current.record.text}
                </p>
              )}
            </section>
          </div>

          {/* Diff vs the most recent previous version. The labeled section and
                its colored diff treatment only earn their space when there is an
                actual prior version to compare against; otherwise this collapses
                to a single quiet line so fresh translations stay compact. */}
          {previousVersion ? (
            <section>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('diffTitle')}
                </h3>
                <DiffLegend />
              </div>
              <div className="space-y-1">
                <DiffText
                  oldText={previousVersion.text}
                  newText={current.record.text}
                  testId="review-diff"
                />
                <p className="font-mono text-[11px] text-muted-foreground">
                  {t('previousVersionMeta', {
                    module: previousVersion.moduleId,
                    date: new Date(previousVersion.timestamp).toLocaleString(),
                  })}
                </p>
              </div>
            </section>
          ) : (
            <p className="text-xs text-muted-foreground" data-testid="review-no-previous">
              {t('noPreviousVersion')}
            </p>
          )}

          {/* Back-translation reference (display only, never persisted) */}
          {(backTranslating || backTranslation !== null) && (
            <section data-testid="review-back-translation">
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('backTranslationTitle')}
              </h3>
              {backTranslating ? (
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="review-back-translation-loading"
                >
                  {t('backTranslationLoading')}
                </p>
              ) : (
                <p
                  className="whitespace-pre-wrap break-words rounded border border-dashed border-border bg-muted/40 px-2 py-1.5 text-sm leading-relaxed"
                  data-testid="review-back-translation-text"
                >
                  {backTranslation}
                </p>
              )}
            </section>
          )}

          {/* LQA issues for this language */}
          <LqaIssueList
            issues={lqaIssues}
            showOverflow={showOverflow}
            overflowRatio={overflowRatio}
            headingClassName="text-xs"
            testId="review-lqa-issues"
          />

          {/* Glossaries for this entry: the assigned glossaries (whole-glossary
                pills) and, separately, the individual terms that match the source.
                While the full glossaries load, show a spinner if the entry has any
                assignments to resolve. */}
          {(() => {
            const hasAssigned = (current.entry.assignedGlossaryIds?.length ?? 0) > 0;
            const showLoading =
              glossariesLoading &&
              hasAssigned &&
              assignedGlossaries.length === 0 &&
              glossaryHints.length === 0;
            if (!showLoading && assignedGlossaries.length === 0 && glossaryHints.length === 0) {
              return null;
            }
            return (
              <section data-testid="review-glossary" className="space-y-3">
                {showLoading && (
                  <div
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                    data-testid="review-glossary-loading"
                  >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t('glossaryLoading')}
                  </div>
                )}
                {/* Active glossaries assigned to the entry — violet pills */}
                {assignedGlossaries.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('glossaryActiveTitle')}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {assignedGlossaries.map((g) => (
                        <span
                          key={g.id}
                          className="rounded-full bg-type-dialogue/15 px-2 py-0.5 text-[11px] font-medium text-type-dialogue"
                          data-testid="review-glossary-active"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Matching terms — plain "source → target" rows, not pills */}
                {glossaryHints.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('glossaryTermsTitle')}
                    </h3>
                    <GlossaryHintList
                      hints={glossaryHints}
                      targetLanguage={current.language}
                      itemTestId="review-glossary-term"
                    />
                  </div>
                )}
              </section>
            );
          })()}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={() => void handleApprove()} data-testid="review-approve">
              <Check className="size-4" aria-hidden />
              {t('approve')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={startEdit}
              disabled={editing}
              data-testid="review-edit"
            >
              <Pencil className="size-4" aria-hidden />
              {t('edit')}
            </Button>
            {filter !== 'flagged' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleFlag()}
                data-testid="review-flag"
              >
                <Flag className="size-4" aria-hidden />
                {t('flag')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRetranslate()}
              disabled={retranslateRun !== null}
              data-testid="review-retranslate"
            >
              <RefreshCw className={cn('size-4', retranslateRun && 'animate-spin')} aria-hidden />
              {t('retranslate')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleBackTranslate()}
              disabled={backTranslating || !sourceLanguage || !current.record.text}
              data-testid="review-back-translate"
            >
              <ArrowLeftRight
                className={cn('size-4', backTranslating && 'animate-pulse')}
                aria-hidden
              />
              {t('backTranslate')}
            </Button>
          </div>
        </ReviewCardShell>
      )}

      <ReviewProgressCard />
    </div>
  );
}
