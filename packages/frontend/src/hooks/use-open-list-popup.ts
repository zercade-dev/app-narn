import { useCallback, useSyncExternalStore } from 'react';

/** How often an open list is checked for again (it can open without a DOM mutation). */
const POLL_MS = 250;

/** A dropdown list or menu that is open and visible: a select's options, a menu. */
function listPopupOpen(): boolean {
  for (const el of document.querySelectorAll('[role="listbox"], [role="menu"]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
}

/**
 * Whether a dropdown list or menu is open anywhere on the page. The guide's
 * callout steps aside while one is, so it never covers the options the
 * person is choosing from (a select opened inside a spotlit card).
 */
export function useOpenListPopup(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = setInterval(onChange, POLL_MS);
    return () => {
      observer.disconnect();
      clearInterval(poll);
    };
  }, []);
  return useSyncExternalStore(subscribe, listPopupOpen, () => false);
}

/**
 * Whether a dialog other than the guide's callout is open and does not hold
 * the step's control: one the person opened from the step (the batch
 * translate dialog, glossary generation). The callout steps aside for it, as
 * for a list. A dialog holding the step's control (the key editor, the
 * translation dialog's Start) is what the callout points into: it stays.
 */
export function useOpenForeignDialog(callout: Element | null, anchor: Element | null): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.body, { childList: true, subtree: true });
    const poll = setInterval(onChange, POLL_MS);
    return () => {
      observer.disconnect();
      clearInterval(poll);
    };
  }, []);
  const snapshot = () => {
    for (const el of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
      if (callout !== null && (el === callout || callout.contains(el) || el.contains(callout))) {
        continue;
      }
      if (anchor !== null && el.contains(anchor)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return true;
    }
    return false;
  };
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
