import { MAJOR_STEP_COUNT, type Tour, type TourStep } from './types.js';

/**
 * Where a step sits in its tour, for the callout's counter and progress bar.
 * `counted`/`total` count every step except variants (`variantOf`); `major`
 * and `sub` are set for a step with a major step ("Step 3 of 5 · 2 of 8").
 */
export interface TourPosition {
  counted: number;
  total: number;
  major?: number;
  majorTotal?: number;
  sub?: number;
  subTotal?: number;
}

const isCounted = (s: TourStep): boolean => s.variantOf === undefined;

/** Counted steps exclude any step with `variantOf`; such a step reports the position of the step it names. 1-based. */
export function tourPosition(tour: Tour, index: number): TourPosition {
  const counted = tour.steps.filter(isCounted);
  let step: TourStep | undefined = tour.steps[index];
  if (step?.variantOf !== undefined) {
    const id = step.variantOf;
    step = counted.find((s) => s.id === id);
  }
  const at = step ? counted.indexOf(step) : -1;
  const position: TourPosition = { counted: Math.max(0, at) + 1, total: counted.length };
  const major = step?.major;
  if (step === undefined || major === undefined) return position;
  const sameMajor = counted.filter((s) => s.major === major);
  return {
    ...position,
    major,
    majorTotal: MAJOR_STEP_COUNT,
    sub: sameMajor.indexOf(step) + 1,
    subTotal: sameMajor.length,
  };
}

/** Index in `tour.steps` of the 0-based counted step `at` (clamped to the tour). */
export function countedStepIndex(tour: Tour, at: number): number {
  const counted = tour.steps.filter(isCounted);
  if (counted.length === 0) return 0;
  const step = counted[Math.max(0, Math.min(counted.length - 1, at))];
  return tour.steps.indexOf(step);
}

/** Index of the next counted step after `index`; `undefined` past the last one. */
export function nextCountedIndex(tour: Tour, index: number): number | undefined {
  for (let i = index + 1; i < tour.steps.length; i++) if (isCounted(tour.steps[i])) return i;
  return undefined;
}

/** Index of the counted step before `index`; `index` itself when there is none. */
export function previousCountedIndex(tour: Tour, index: number): number {
  for (let i = index - 1; i >= 0; i--) if (isCounted(tour.steps[i])) return i;
  return index;
}
