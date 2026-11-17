/**
 * The guided first run's Back from a step inside a form (the vault sheet, the
 * key editor, the translation dialog, the import review): it asks the form to
 * close, so the guide can show the step that opens it. The form is named by
 * the `data-tour` anchor the guide points at inside it; each form answers for
 * its own anchor, closing as its Cancel would.
 */
import { useEffect, useRef } from 'react';

/** Window event; `detail.anchor` is the `data-tour` anchor inside the form to close. */
export const GUIDE_CLOSE_FORM_EVENT = 'guide:close-form';

export interface GuideCloseFormDetail {
  anchor: string;
}

/** Builds the {@link GUIDE_CLOSE_FORM_EVENT} for the form holding `anchor`. */
export function closeFormEvent(anchor: string): CustomEvent<GuideCloseFormDetail> {
  return new CustomEvent(GUIDE_CLOSE_FORM_EVENT, { detail: { anchor } });
}

/** Calls `close` when the guide asks the form holding `anchor` to close, while `open`. */
export function useCloseOnGuideBack(open: boolean, anchor: string, close: () => void): void {
  const latest = useRef(close);
  useEffect(() => {
    latest.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onClose = (e: Event) => {
      if ((e as CustomEvent<GuideCloseFormDetail | null>).detail?.anchor === anchor) {
        latest.current();
      }
    };
    globalThis.addEventListener(GUIDE_CLOSE_FORM_EVENT, onClose);
    return () => globalThis.removeEventListener(GUIDE_CLOSE_FORM_EVENT, onClose);
  }, [open, anchor]);
}
