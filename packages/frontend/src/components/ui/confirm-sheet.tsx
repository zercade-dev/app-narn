import type * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * Side-sheet confirmation: a titled body with a cancel button and a primary
 * confirm button. Cancel always routes through `onOpenChange(false)`.
 *
 * Shared by the backup restore/delete flows, the orphan delete flow, and the
 * batch-translate confirmation. Defaults match the most common (backup) usage:
 * a right-side sheet with a `destructive` confirm. The `side` /
 * `contentClassName` / `confirmVariant` knobs reproduce the bottom-sheet and
 * non-destructive variants used elsewhere.
 */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmDisabled = false,
  confirmVariant = 'destructive',
  onConfirm,
  cancelLabel,
  cancelDisabled,
  cancelTestId,
  confirmTestId,
  side = 'right',
  contentClassName,
  children,
}: Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  confirmVariant?: 'destructive' | 'default';
  onConfirm: () => void;
  cancelLabel: string;
  /** When omitted, the cancel button is never disabled. */
  cancelDisabled?: boolean;
  cancelTestId?: string;
  confirmTestId?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  contentClassName?: string;
  children?: React.ReactNode;
}>): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={contentClassName}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
        <SheetFooter className="mt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={cancelDisabled}
            data-testid={cancelTestId}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={confirmDisabled}
            data-testid={confirmTestId}
          >
            {confirmLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
