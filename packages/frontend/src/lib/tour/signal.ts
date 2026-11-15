/**
 * Things the app reports to a running tour that no fact or anchor shows: a
 * glossary was just created, say. A step listening for one (`advanceOnSignal`)
 * moves on when it is sent while the step is on screen; one sent before the
 * step came up is not seen.
 */
export const TOUR_SIGNAL_EVENT = 'tour:signal';

export type TourSignal = 'glossary-created';

export function sendTourSignal(signal: TourSignal): void {
  globalThis.dispatchEvent(new CustomEvent<TourSignal>(TOUR_SIGNAL_EVENT, { detail: signal }));
}
