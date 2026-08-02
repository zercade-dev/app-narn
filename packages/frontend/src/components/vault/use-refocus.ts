import { useEffect, useRef, type RefObject } from 'react';

/**
 * Re-focus an input ref once a loading cycle completes while the dialog is open.
 *
 * While `loading` is true the input is disabled, which removes browser focus;
 * re-acquiring focus when `loading` transitions true → false (e.g. after a
 * refresh or a failed save/unlock) restores the expected UX so the user can
 * immediately retry without re-clicking the field.
 *
 * Shared by the vault unlock and editor dialogs, which carried identical effects.
 */
export function useRefocusOnLoadingDone(
  ref: RefObject<HTMLInputElement | null>,
  loading: boolean,
  open: boolean,
): void {
  const prevLoadingRef = useRef(false);
  useEffect(() => {
    if (prevLoadingRef.current && !loading && open) {
      ref.current?.focus();
    }
    prevLoadingRef.current = loading;
  }, [ref, loading, open]);
}
