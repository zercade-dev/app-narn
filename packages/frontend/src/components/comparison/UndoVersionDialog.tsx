import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationRecord, TranslationVersion } from '@zercade-dev/narn-shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DiffText } from '@/components/review/review-shared.js';

/** Most recent previous versions shown in the picker (history holds up to 5). */
const MAX_UNDO_VERSIONS = 4;

export interface UndoVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Target language whose history is being browsed (display only). */
  language: string;
  /** The live record; `previousVersions` feeds the picker, `text` the diffs. */
  record: TranslationRecord | undefined;
  /** Restore the picked version; the dialog closes on resolve. */
  onRestore: (version: TranslationVersion) => Promise<void>;
}

/**
 * Version picker behind the compare tab's per-cell undo affordance: the most
 * recent {@link MAX_UNDO_VERSIONS} entries of the record's bounded
 * `previousVersions` history, newest first, each diffed against the CURRENT
 * text. Restoring goes through the tab's standard manual-edit save path, so
 * the replaced current text is itself folded into history (undo is undoable).
 */
export function UndoVersionDialog({
  open,
  onOpenChange,
  language,
  record,
  onRestore,
}: Readonly<UndoVersionDialogProps>): React.JSX.Element {
  const { t, i18n } = useTranslation('strings');
  const [restoringIndex, setRestoringIndex] = useState<number | null>(null);

  const versions = [...(record?.previousVersions ?? [])].slice(-MAX_UNDO_VERSIONS).reverse();
  const currentText = record?.text ?? '';

  const handleRestore = async (version: TranslationVersion, index: number): Promise<void> => {
    setRestoringIndex(index);
    try {
      await onRestore(version);
      onOpenChange(false);
    } finally {
      setRestoringIndex(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('compare.undoVersionsTitle', { language })}</DialogTitle>
          <DialogDescription>{t('compare.undoVersionsHint')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {versions.map((version, i) => (
            <div
              key={`${version.timestamp}-${i}`}
              className="rounded border border-border p-2 space-y-1.5"
              data-testid={`undo-version-row-${i}`}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{version.moduleId}</span>
                <span>{new Date(version.timestamp).toLocaleString(i18n.language)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={restoringIndex !== null}
                  // A rejected onRestore is expected (the caller toasts and
                  // rethrows so the dialog knows to stay open); swallow it
                  // here so it doesn't surface as an unhandled rejection —
                  // `handleRestore`'s finally block already resets local state.
                  onClick={() => void handleRestore(version, i).catch(() => {})}
                  data-testid={`undo-version-restore-${i}`}
                >
                  {t('compare.undoRestore')}
                </Button>
              </div>
              <DiffText
                oldText={currentText}
                newText={version.text}
                testId={`undo-version-diff-${i}`}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
