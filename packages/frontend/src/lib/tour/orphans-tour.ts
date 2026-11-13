/**
 * The Orphans tour, started from the Guide. It can create a practice orphan
 * (`orphan-sim.ts`) so the person sees a real one, then puts it back. The
 * tour is a pure description; `OrphansTourController` runs it and answers its
 * actions (`ORPHANS_TOUR_ACTION_EVENT`).
 */
import type { Tour, TourStep } from './types.js';

export const ORPHANS_TOUR_ID = 'orphans';

/** Dispatched on `globalThis` by the tour's action buttons; `detail` is the action. */
export const ORPHANS_TOUR_ACTION_EVENT = 'guide:orphans-tour-action';

export type OrphansTourAction =
  | 'simulate'
  | 'explain-only'
  | 'backup-first'
  | 'skip-backup'
  | 'recover'
  | 'restore-backup'
  | 'switch-project';

export interface OrphansTourState {
  /** The person chose the practice orphan (otherwise the tour only explains). */
  simulated: boolean;
  /** The backup taken before the practice orphan, if any: adds the restore step. */
  backupId: string | null;
  /**
   * What the offer step proposes: the practice orphan, only the explanation
   * (it cannot be offered here), or switching to the project that still has
   * one. `loading`: not known yet (the entries are loading), so no choice
   * shows rather than a wrong one. Default `simulate`.
   */
  offer?: 'simulate' | 'explain-only' | 'switch-project' | 'loading';
  /** The restore step points at the backup's own Restore button instead of the list. */
  restoreSpotlit?: boolean;
}

const ACTION_LABELS: Record<OrphansTourAction, string> = {
  simulate: 'simulate',
  'explain-only': 'explainOnly',
  'backup-first': 'backupFirst',
  'skip-backup': 'skipBackup',
  recover: 'recover',
  'restore-backup': 'restoreBackup',
  'switch-project': 'switchProject',
};

function action(
  name: OrphansTourAction,
  primary = false,
): NonNullable<TourStep['actions']>[number] {
  return {
    labelKey: `orphansTour.actions.${ACTION_LABELS[name]}`,
    testId: `orphans-tour-${name}`,
    ...(primary ? { primary: true as const } : {}),
    run: () => {
      globalThis.dispatchEvent(
        new CustomEvent<OrphansTourAction>(ORPHANS_TOUR_ACTION_EVENT, { detail: name }),
      );
    },
  };
}

function step(id: string, anchor: string | null, advance: TourStep['advance']): TourStep {
  return {
    id,
    anchor,
    titleKey: `orphansTour.${id}.title`,
    whatKey: `orphansTour.${id}.what`,
    whyKey: `orphansTour.${id}.why`,
    advance,
  };
}

const NEXT = { kind: 'next' } as const;
const MANUAL = { kind: 'manual' } as const;
// Shared objects: the overlay opens a step's tab again when `navigate` changes
// identity, and the tour is rebuilt whenever the controller's state changes.
const TO_ORPHANS: NonNullable<TourStep['navigate']> = { tab: 'orphans' };
const TO_BACKUP: NonNullable<TourStep['navigate']> = { tab: 'backup' };

/** The restore step's anchor once "Restore the backup" was pressed: that backup's Restore button. */
export function backupRestoreAnchor(backupId: string): string {
  return `backup-restore-${backupId}`;
}

export function orphansTour(state: OrphansTourState): Tour {
  const offer = state.offer ?? 'simulate';
  const offerActions =
    offer === 'loading'
      ? []
      : offer === 'simulate'
        ? [action('simulate', true), action('explain-only')]
        : offer === 'switch-project'
          ? [action('switch-project', true), action('explain-only')]
          : [action('explain-only', true)];
  const head: TourStep[] = [
    { ...step('intro', null, NEXT), navigate: TO_ORPHANS },
    { ...step('offer', null, MANUAL), actions: offerActions },
  ];
  const done = step('done', null, NEXT);
  if (!state.simulated) {
    return {
      id: ORPHANS_TOUR_ID,
      steps: [
        ...head,
        { ...step('explain-list', 'orphans-list', NEXT), navigate: TO_ORPHANS },
        step('explain-options', null, NEXT),
        done,
      ],
    };
  }
  const restore: TourStep[] =
    state.backupId === null
      ? []
      : [
          {
            ...step(
              'restore',
              state.restoreSpotlit ? backupRestoreAnchor(state.backupId) : 'backup-list',
              NEXT,
            ),
            navigate: TO_BACKUP,
            // Points at the Restore button; the person decides whether to press it.
            ...(state.restoreSpotlit ? {} : { actions: [action('restore-backup')] }),
          },
        ];
  return {
    id: ORPHANS_TOUR_ID,
    steps: [
      ...head,
      {
        ...step('backup', null, MANUAL),
        actions: [action('backup-first', true), action('skip-backup')],
      },
      step('simulating', null, MANUAL),
      // Shown, not offered: the practice orphan's Relink and Delete are what
      // these steps explain, and the person must leave them alone here.
      {
        ...step('practice-row', 'orphan-practice-row', NEXT),
        navigate: TO_ORPHANS,
        interactive: false,
      },
      { ...step('practice-options', 'orphan-practice-actions', NEXT), interactive: false },
      { ...step('recover', 'orphan-practice-banner', MANUAL), actions: [action('recover', true)] },
      ...restore,
      done,
    ],
  };
}
