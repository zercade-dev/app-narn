import type { ShellView, Tab } from '@/stores/view-store';

/** What the app knows about the person's progress; the guide derives it, tours read it. */
export interface GuideFacts {
  cloud: boolean;
  vaultExists: boolean;
  vaultUnlocked: boolean;
  usableKey: boolean;
  projectExists: boolean;
  projectHasLanguages: boolean;
  projectHasEntries: boolean;
  translationExists: boolean;
  exported: boolean;
  isCollaboratorOnly: boolean;
}

export type TourAdvance =
  /** An explanation step: shows Next. */
  | { kind: 'next' }
  /** Completes when the anchored control is clicked. */
  | { kind: 'click' }
  /** Completes when app state says so. */
  | { kind: 'state'; done: (f: GuideFacts) => boolean };

export interface TourStep {
  id: string;
  /** Value of a `data-tour` attribute; null = a centred callout. */
  anchor: string | null;
  /** Keys in the `guide-tour` namespace. */
  titleKey: string;
  whatKey: string;
  whyKey: string;
  advance: TourAdvance;
  /**
   * Where the callout sits relative to the anchor (default `bottom`; it still
   * flips when there is no room). Set it when the default would cover controls
   * the step asks the person to use, as in a form.
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Opened when the step becomes current. */
  navigate?: { tab?: Tab; view?: ShellView };
  /** Extra callout buttons. `labelKey` is in the `guide-tour` namespace. */
  actions?: Array<{ labelKey: string; run: () => void; testId: string }>;
  /** 1..MAJOR_STEP_COUNT for the first-run tour's "Step N of 5". */
  major?: number;
}

export interface Tour {
  id: string;
  steps: TourStep[];
}

/** Number of major steps in the first-run tour, shown as "Step N of 5". */
export const MAJOR_STEP_COUNT = 5;
