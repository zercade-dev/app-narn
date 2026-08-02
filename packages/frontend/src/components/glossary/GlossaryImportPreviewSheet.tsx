/**
 * Import dry-run diff confirmation sheet: shows the added/updated/conflict/
 * unchanged counts (and a capped per-section preview) for a pending glossary
 * import, then applies or cancels it. Split out of GlossaryTab.tsx as a purely
 * presentational panel — it owns no state; the pending file, busy flag, and the
 * apply/close handlers are prop-drilled from the parent.
 */
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import { IMPORT_PREVIEW_MAX_ITEMS, type ImportDryRunResponse } from './glossary-tab-types.js';

interface GlossaryImportPreviewSheetProps {
  readonly importPreview: ImportDryRunResponse | null;
  readonly glossaryName: string;
  readonly importBusy: boolean;
  readonly onClose: () => void;
  readonly onApply: () => void;
}

export function GlossaryImportPreviewSheet({
  importPreview,
  glossaryName,
  importBusy,
  onClose,
  onApply,
}: Readonly<GlossaryImportPreviewSheetProps>) {
  const { t } = useTranslation('glossary');

  return (
    <Sheet
      open={importPreview !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="bottom" className="max-w-2xl mx-auto rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{t('importPreviewTitle')}</SheetTitle>
          <SheetDescription>
            {t('importPreviewDescription', { name: glossaryName })}
          </SheetDescription>
        </SheetHeader>
        {importPreview && (
          <div className="px-4 space-y-3 text-sm" data-testid="glossary-import-preview">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-status-pass/15 px-2 py-1 text-status-pass">
                {t('importAdded', { count: importPreview.diff.added.length })}
              </span>
              <span className="rounded-md bg-status-info/15 px-2 py-1 text-status-info">
                {t('importUpdated', { count: importPreview.diff.updated.length })}
              </span>
              <span className="rounded-md bg-status-warn/15 px-2 py-1 text-status-warn">
                {t('importConflicts', { count: importPreview.diff.conflicts.length })}
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                {t('importUnchanged', { count: importPreview.diff.unchanged })}
              </span>
              {importPreview.skippedRows > 0 && (
                <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                  {t('importSkipped', { count: importPreview.skippedRows })}
                </span>
              )}
            </div>
            {importPreview.unrecognizedHeaders.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('importUnrecognizedHeaders', {
                  headers: importPreview.unrecognizedHeaders.join(', '),
                })}
              </p>
            )}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {importPreview.diff.conflicts.slice(0, IMPORT_PREVIEW_MAX_ITEMS).map((c) => (
                <div
                  key={`conflict-${c.termId}`}
                  className="flex items-center gap-2 rounded border border-status-warn/40 px-2 py-1 text-xs"
                >
                  <AlertTriangle className="w-3 h-3 shrink-0 text-status-warn" />
                  <span className="font-medium truncate">{c.source}</span>
                  <span className="text-muted-foreground shrink-0">
                    {c.conflictLanguages.join(', ')}
                  </span>
                </div>
              ))}
              {importPreview.diff.updated.slice(0, IMPORT_PREVIEW_MAX_ITEMS).map((u) => (
                <div
                  key={`update-${u.termId}`}
                  className="rounded border px-2 py-1 text-xs truncate"
                >
                  {u.source}
                </div>
              ))}
              {importPreview.diff.added.slice(0, IMPORT_PREVIEW_MAX_ITEMS).map((a) => (
                <div
                  key={`add-${a.source}`}
                  className="rounded border border-status-pass/40 px-2 py-1 text-xs truncate"
                >
                  {a.source}
                </div>
              ))}
              {(() => {
                const hidden =
                  Math.max(0, importPreview.diff.conflicts.length - IMPORT_PREVIEW_MAX_ITEMS) +
                  Math.max(0, importPreview.diff.updated.length - IMPORT_PREVIEW_MAX_ITEMS) +
                  Math.max(0, importPreview.diff.added.length - IMPORT_PREVIEW_MAX_ITEMS);
                return hidden > 0 ? (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    {t('importMoreItems', { count: hidden })}
                  </p>
                ) : null;
              })()}
            </div>
            {importPreview.diff.conflicts.length > 0 && (
              <p className="text-xs text-status-warn">{t('importConflictHint')}</p>
            )}
            {importPreview.diff.added.length === 0 &&
              importPreview.diff.updated.length === 0 &&
              importPreview.diff.conflicts.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('importNoChanges')}</p>
              )}
            {importPreview.repushRequired && (
              <p className="text-xs text-status-warn">{t('toastRepushRequired')}</p>
            )}
          </div>
        )}
        <SheetFooter className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onClose} data-testid="glossary-import-cancel-btn">
            {t('cancel')}
          </Button>
          <Button
            onClick={onApply}
            disabled={
              importBusy ||
              (importPreview !== null &&
                importPreview.diff.added.length === 0 &&
                importPreview.diff.updated.length === 0 &&
                importPreview.diff.conflicts.length === 0)
            }
            data-testid="glossary-import-apply-btn"
          >
            {t('importApply')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
