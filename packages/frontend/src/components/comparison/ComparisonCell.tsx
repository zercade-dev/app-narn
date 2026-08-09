import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Pencil, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isBlockingIssue } from '@/lib/lqa';
import {
  VAULT_LOCKED_EVENT,
  VAULT_RETRY_FINISHED_EVENT,
  VAULT_RETRY_STARTED_EVENT,
  type VaultLockedDetail,
  type VaultRetryFinishedDetail,
  type VaultRetryStartedDetail,
} from '@/lib/vault-events';
import type { LQAIssue, StringEntry, TagNode } from '@zercade-dev/narn-shared';
import { RichRenderer } from './RichRenderer.js';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export interface ComparisonCellProps {
  entry: StringEntry;
  language: string;
  mode: 'raw' | 'rich';
  retranslateKey?: string | null;
  /** Returns parsed tag nodes when in rich mode (may be undefined if still fetching). */
  getNodes: (entryId: string, language: string, text: string) => TagNode[] | undefined;
  onSave: (entryId: string, language: string, text: string) => Promise<void> | void;
  /** When true the cell is read-only: no editing affordances are shown. */
  readOnly?: boolean;
  /** Called when the user requests a re-translation of this specific cell. */
  onRetranslate?: () => Promise<void>;
  /** Called when the user marks this translation as reviewed. */
  onMarkReviewed?: () => Promise<void>;
  /** Called when the user clears/deletes the translation content. */
  onClear?: () => Promise<void>;
  /** Opens the previous-versions (undo) picker for this cell. Rendered only
   *  when the record has history. */
  onOpenUndo?: () => void;
}

/**
 * Returns the comparison row `offset` steps away from `currentRow` in document
 * order. Rows are NOT DOM siblings: ComparisonGrid wraps every row in its own
 * ContextMenuTrigger element (a real div even with `display: contents`), so
 * `nextElementSibling`/`previousElementSibling` never reach the adjacent row —
 * enumerate the rows inside the grid body and step by index instead.
 */
function adjacentRow(currentRow: Element, offset: 1 | -1): HTMLElement | null {
  const scope: ParentNode =
    currentRow.closest('[data-testid="comparison-body"]') ?? currentRow.ownerDocument;
  const rows = Array.from(scope.querySelectorAll('[data-testid="comparison-row"]'));
  const index = rows.indexOf(currentRow);
  if (index === -1) return null;
  return (rows[index + offset] as HTMLElement | undefined) ?? null;
}

function issueIcon(issue: LQAIssue): React.JSX.Element | null {
  if (isBlockingIssue(issue)) {
    return <X className="size-4" aria-hidden="true" />;
  }
  return <AlertTriangle className="size-4" aria-hidden="true" />;
}

function issueChipClass(issue: LQAIssue): string {
  if (isBlockingIssue(issue)) {
    return 'bg-status-fail/10 text-status-fail';
  }
  return 'bg-status-warn/10 text-status-warn';
}

function issueLabel(issue: LQAIssue): string {
  if (issue.type === 'placeholder-missing') return `missing ${issue.detail.split(' ')[0]}`;
  if (issue.type === 'tag-mismatch') return 'tag mismatch';
  if (issue.type === 'mask-mismatch') return `mask: ${issue.detail}`;
  if (issue.type === 'overflow') return 'overflow';
  return issue.type;
}

interface CellActionsProps {
  language: string;
  status: string | undefined;
  text: string;
  retranslating: boolean;
  onRetranslate: (() => Promise<void>) | undefined;
  onMarkReviewed: (() => Promise<void>) | undefined;
  onClear: (() => Promise<void>) | undefined;
  onOpenUndo: (() => void) | undefined;
  onEnterEdit: () => void;
}

function CellActions({
  language,
  status,
  text,
  retranslating,
  onRetranslate,
  onMarkReviewed,
  onClear,
  onOpenUndo,
  onEnterEdit,
}: Readonly<CellActionsProps>): React.JSX.Element {
  // The three action tooltips compose their wording from `shortcuts.*` — the same
  // keys the keyboard-shortcuts panel renders — plus a literal ` · <key>` suffix.
  // Composing rather than storing "Re-translate · T" whole keeps ONE source of
  // wording for both surfaces, which sit one keypress apart and drifted before.
  // The separator and the key glyphs (T, R, Enter, Esc) are never translated.
  const { t } = useTranslation('strings');
  const [markingReviewed, setMarkingReviewed] = useState(false);
  const [reviewFading, setReviewFading] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Fallback: clear reviewFading after the transition duration in case
  // onTransitionEnd doesn't fire (e.g. in headless / reduced-motion environments).
  useEffect(() => {
    if (!reviewFading) return;
    const id = setTimeout(() => setReviewFading(false), 350);
    return () => clearTimeout(id);
  }, [reviewFading]);

  const handleMarkReviewedClick = useCallback(async (markReviewed: () => Promise<void>) => {
    setMarkingReviewed(true);
    setReviewFading(true);
    try {
      await markReviewed();
    } catch {
      setReviewFading(false);
    } finally {
      setMarkingReviewed(false);
    }
  }, []);

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5">
      {onRetranslate && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={retranslating}
                onClick={() => void onRetranslate()}
                className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground/70 hover:text-status-info hover:bg-status-info/10 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={t('compare.cellRetranslateAria', { language })}
                data-testid={`comparison-cell-retranslate-${language}`}
              />
            }
          >
            <span
              className={cn('inline-flex', retranslating && 'animate-spin')}
              data-testid={`comparison-cell-retranslate-icon-${language}`}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">{`${t('shortcuts.retranslate')} · T`}</TooltipContent>
        </Tooltip>
      )}
      {onOpenUndo && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onOpenUndo}
                className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground/70 hover:text-status-warn hover:bg-status-warn/10 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={t('compare.cellUndoAria', { language })}
                data-testid={`comparison-cell-undo-${language}`}
              />
            }
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent side="top">{t('compare.undoTooltip')}</TooltipContent>
        </Tooltip>
      )}
      {onMarkReviewed && text && (status !== 'reviewed' || reviewFading) && (
        <span
          className={cn(
            'inline-flex transition-all duration-300 ease-out',
            reviewFading && 'opacity-0 scale-75',
          )}
          onTransitionEnd={() => setReviewFading(false)}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={markingReviewed}
                  onClick={() => void handleMarkReviewedClick(onMarkReviewed)}
                  className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground/70 hover:text-status-pass hover:bg-status-pass/10 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={t('compare.cellMarkReviewedAria', { language })}
                  data-testid={`comparison-cell-mark-reviewed-${language}`}
                />
              }
            >
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="top">{`${t('shortcuts.markReviewed')} · R`}</TooltipContent>
          </Tooltip>
        </span>
      )}
      {onClear && text && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={clearing}
                onClick={async () => {
                  setClearing(true);
                  try {
                    await onClear();
                  } finally {
                    setClearing(false);
                  }
                }}
                className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground/70 hover:text-status-fail hover:bg-status-fail/10 transition-colors disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:outline-none"
                aria-label={t('compare.cellClearAria', { language })}
                data-testid={`comparison-cell-clear-${language}`}
              />
            }
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent side="top">{`${t('shortcuts.clearTranslation')} · C`}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              disabled={status === 'reviewed'}
              onClick={onEnterEdit}
              className="inline-flex items-center justify-center p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={t('compare.cellEditAria', { language })}
              data-testid={`comparison-cell-edit-${language}`}
            />
          }
        >
          <Pencil className="size-3.5" aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent side="top">
          {status === 'reviewed'
            ? t('compare.cellEditReviewedTooltip')
            : t('compare.cellEditTooltip')}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ComparisonCell({
  entry,
  language,
  mode,
  retranslateKey = null,
  getNodes,
  onSave,
  readOnly = false,
  onRetranslate,
  onMarkReviewed,
  onClear,
  onOpenUndo,
}: Readonly<ComparisonCellProps>): React.JSX.Element {
  const { t } = useTranslation('strings');
  const record = entry.translations[language];
  const text = record?.text ?? '';
  const moduleId = record?.moduleId ?? '';
  const status = record?.status;
  const lqa = entry.lqaResults[language];
  const issues = lqa?.issues ?? [];
  const hasHistory = (record?.previousVersions?.length ?? 0) > 0;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [retranslating, setRetranslating] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const vaultRetryIdRef = useRef<string | null>(null);

  // Auto-size the textarea height to its content whenever the draft or editing
  // state changes.
  useEffect(() => {
    if (editing && taRef.current) {
      const ta = taRef.current;
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [draft, editing]);

  // Focus and select the textarea once when edit mode is entered.
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.select();
    }
  }, [editing]);

  // Re-sync draft during render when external text changes (or editing ends)
  // and we aren't editing.
  const [prevDraftSync, setPrevDraftSync] = useState({ text, editing });
  if (prevDraftSync.text !== text || prevDraftSync.editing !== editing) {
    setPrevDraftSync({ text, editing });
    if (!editing) setDraft(text);
  }

  // Handle vault retry events to manage retranslating state
  useEffect(() => {
    const handleVaultLocked = (event: Event) => {
      const detail = (event as CustomEvent<VaultLockedDetail>).detail;
      const retryId = detail?.retryId ?? null;
      if (!retryId || detail?.vaultRetryKey !== retranslateKey) return;
      vaultRetryIdRef.current = retryId;
      setRetranslating(false);
    };

    const handleRetryStarted = (event: Event) => {
      const detail = (event as CustomEvent<VaultRetryStartedDetail>).detail;
      const retryId = detail?.retryId ?? null;
      if (
        !retryId ||
        detail?.vaultRetryKey !== retranslateKey ||
        vaultRetryIdRef.current !== retryId
      )
        return;
      setRetranslating(true);
    };

    const handleRetryFinished = (event: Event) => {
      const detail = (event as CustomEvent<VaultRetryFinishedDetail>).detail;
      const retryId = detail?.retryId ?? null;
      if (
        !retryId ||
        detail?.vaultRetryKey !== retranslateKey ||
        vaultRetryIdRef.current !== retryId
      )
        return;
      if (detail?.succeeded === true) return;
      vaultRetryIdRef.current = null;
      setRetranslating(false);
    };

    globalThis.addEventListener(VAULT_LOCKED_EVENT, handleVaultLocked);
    globalThis.addEventListener(VAULT_RETRY_STARTED_EVENT, handleRetryStarted);
    globalThis.addEventListener(VAULT_RETRY_FINISHED_EVENT, handleRetryFinished);
    return () => {
      globalThis.removeEventListener(VAULT_LOCKED_EVENT, handleVaultLocked);
      globalThis.removeEventListener(VAULT_RETRY_STARTED_EVENT, handleRetryStarted);
      globalThis.removeEventListener(VAULT_RETRY_FINISHED_EVENT, handleRetryFinished);
    };
  }, [retranslateKey]);

  const enterEdit = (): void => {
    setDraft(text);
    setEditing(true);
  };

  const commit = async (): Promise<void> => {
    setEditing(false);
    if (draft !== text) {
      await onSave(entry.id, language, draft);
    }
  };

  const cancel = (): void => {
    setDraft(text);
    setEditing(false);
  };

  const handleRetranslate = useCallback(async (): Promise<void> => {
    if (!onRetranslate) return;
    setRetranslating(true);
    try {
      await onRetranslate();
    } finally {
      setRetranslating(false);
    }
  }, [onRetranslate]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void commit();
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (editing) return;
    if (e.key.toLowerCase() === 't' && onRetranslate) {
      e.preventDefault();
      void handleRetranslate();
      return;
    }
    if (e.key.toLowerCase() === 'r' && onMarkReviewed && text && status !== 'reviewed') {
      e.preventDefault();
      const currentRow = (e.currentTarget as HTMLElement).closest('[data-testid="comparison-row"]');
      // Capture the adjacent row now, before marking reviewed: approving while a
      // "needs review" filter is active removes this row from the list and
      // unmounts it, so we can't look up "the next row" afterward — we already
      // have a reference to a row that isn't the one being removed.
      const focusTargetRow = currentRow
        ? (adjacentRow(currentRow, 1) ?? adjacentRow(currentRow, -1))
        : null;
      const focusTargetCell = focusTargetRow?.querySelector(
        `[data-testid="comparison-cell-${language}"]`,
      ) as HTMLElement | null;
      void onMarkReviewed().then(() => {
        focusTargetCell?.focus();
      });
      return;
    }
    if (e.key.toLowerCase() === 'c' && onClear && text) {
      e.preventDefault();
      void onClear();
      return;
    }
    if (e.key === 'Enter' && !readOnly) {
      e.preventDefault();
      enterEdit();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const currentRow = (e.currentTarget as HTMLElement).closest('[data-testid="comparison-row"]');
      if (!currentRow) return;
      const targetRow = adjacentRow(currentRow, e.key === 'ArrowDown' ? 1 : -1);
      // At the first/last row of a page there is no adjacent row; we stop
      // rather than focus null. (Page-edge advancing is intentionally not
      // handled.)
      if (!targetRow) return;
      const targetCell = targetRow.querySelector(
        `[data-testid="comparison-cell-${language}"]`,
      ) as HTMLElement | null;
      targetCell?.focus();
    }
  };

  const handleCellClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    // Focus the cell on click, unless clicking on a button or other interactive element
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'TEXTAREA') {
      return;
    }
    (e.currentTarget as HTMLElement).focus();
  };

  const nodes = mode === 'rich' && text ? getNodes(entry.id, language, text) : undefined;

  let displayContent: React.ReactNode;
  if (!text) {
    displayContent = <span className="italic">—</span>;
  } else if (mode === 'rich' && nodes) {
    displayContent = <RichRenderer nodes={nodes} />;
  } else {
    displayContent = text;
  }

  return (
    <div
      className={cn(
        'w-full h-full border-r border-border text-sm flex flex-row',
        !readOnly &&
          'cursor-text focus:outline-2 focus:outline-status-info focus:outline-offset-[-2px]',
        !text && 'bg-muted/40 text-muted-foreground',
      )}
      tabIndex={readOnly ? undefined : 0}
      onDoubleClick={readOnly ? undefined : enterEdit}
      onClick={readOnly ? undefined : handleCellClick}
      onKeyDown={readOnly ? undefined : handleCellKeyDown}
      data-testid={`comparison-cell-${language}`}
      data-entry-id={entry.id}
      data-language={language}
    >
      {/* Left: LQA chips */}
      {issues.length > 0 && (
        <div
          className="flex flex-col gap-0.5 px-1 py-1 shrink-0 border-r border-border/50"
          data-testid={`comparison-cell-lqa-${language}`}
        >
          {issues.map((issue, i) => (
            <Tooltip key={i}>
              <TooltipTrigger
                render={<span />}
                aria-label={issueLabel(issue)}
                className={cn(
                  'inline-flex items-center justify-center rounded p-0.5 cursor-help',
                  issueChipClass(issue),
                )}
              >
                {issueIcon(issue)}
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs text-xs">
                <span className="font-semibold">{issueLabel(issue)}</span>
                {issue.detail && (
                  <span className="ml-1 opacity-80" data-content>
                    {issue.detail}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Right: content + footer */}
      <div className="flex flex-col gap-1 flex-1 min-w-0 px-2 py-1">
        {!readOnly && editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={handleKeyDown}
            className="w-full resize-y bg-background border border-input rounded p-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px]"
            data-content
            data-testid={`comparison-cell-editor-${language}`}
            aria-label={t('compare.cellEditAria', { language })}
          />
        ) : (
          <div className="whitespace-pre-wrap break-words leading-relaxed" data-content>
            {displayContent}
          </div>
        )}

        {/* Footer: module attribution + status */}
        <div className="flex items-center gap-1 shrink-0 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {moduleId && (
              <span
                className="font-mono text-[11px] text-muted-foreground"
                data-testid={`comparison-cell-module-${language}`}
              >
                {moduleId}
              </span>
            )}
            {status === 'translated' && (
              <span
                className="text-[10px] px-1 rounded bg-status-info/15 text-status-info"
                data-testid={`comparison-cell-translated-${language}`}
              >
                translated
              </span>
            )}
            {status === 'reviewed' && (
              <span
                className="text-[10px] px-1 rounded bg-status-pass/15 text-status-pass"
                data-testid={`comparison-cell-reviewed-${language}`}
              >
                reviewed
              </span>
            )}
            {record?.needsReview === true && (
              <span
                className="text-[10px] px-1 rounded bg-status-warn/15 text-status-warn font-medium"
                data-testid={`comparison-cell-needs-review-${language}`}
              >
                needs review
              </span>
            )}
          </div>
          {!readOnly && !editing && (
            <CellActions
              language={language}
              status={status}
              text={text}
              retranslating={retranslating}
              onRetranslate={onRetranslate ? handleRetranslate : undefined}
              onMarkReviewed={onMarkReviewed}
              onClear={onClear}
              onOpenUndo={hasHistory ? onOpenUndo : undefined}
              onEnterEdit={enterEdit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
