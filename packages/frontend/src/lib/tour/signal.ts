/**
 * Things the app reports to a running tour that no fact or anchor shows: a
 * glossary was just enabled, say. A step listening for one (`advanceOnSignal`)
 * moves on when it is sent while the step is on screen; one sent before the
 * step came up is not seen.
 */
export const TOUR_SIGNAL_EVENT = 'tour:signal';

/**
 * A glossary was enabled, with its matches applied to the project's entries
 * ("Apply matches") or not ("Enable only").
 */
export type TourSignal = 'glossary-enabled-applied' | 'glossary-enabled-only';

export function sendTourSignal(signal: TourSignal): void {
  globalThis.dispatchEvent(new CustomEvent<TourSignal>(TOUR_SIGNAL_EVENT, { detail: signal }));
}

/** Calls `listener` for every signal sent until the returned function is called. */
export function onTourSignal(listener: (signal: TourSignal) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<TourSignal>).detail);
  globalThis.addEventListener(TOUR_SIGNAL_EVENT, handler);
  return () => globalThis.removeEventListener(TOUR_SIGNAL_EVENT, handler);
}
