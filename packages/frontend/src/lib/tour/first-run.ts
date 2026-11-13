/**
 * The guided first run: five major steps on the real interface (vault, one
 * free key, project + languages + file, translate, export) and a closing
 * callout. Pure data plus the rule that maps what the app knows
 * ({@link GuideFacts}) to the step to show, so the guide resumes in the right
 * place after a reload or on another device.
 *
 * Step actions only announce themselves with a window event; `FirstRunTour`
 * performs them, because they need its state (the current step, the provider
 * dialog).
 */
import type { GuideFacts, Tour, TourStep } from './types.js';

export const FIRST_RUN_TOUR_ID = 'first-run';

export type FirstRunAction =
  | 'open-vault'
  | 'cloud-vault'
  | 'get-google-key'
  | 'add-google-key'
  | 'own-provider'
  | 'fix-key'
  | 'retry'
  | 'stop-retry'
  | 'translate-quick'
  | 'translate-everything'
  | 'translate-few'
  | 'translate-rest'
  | 'skip-rest'
  | 'maybe-later';

/** Window event a callout action dispatches; `detail` is the {@link FirstRunAction}. */
export const FIRST_RUN_ACTION_EVENT = 'guide:first-run-action';

function action(name: FirstRunAction, label: string): NonNullable<TourStep['actions']>[number] {
  return {
    labelKey: `firstRun.actions.${label}`,
    testId: `tour-action-${name}`,
    run: () => {
      globalThis.dispatchEvent(
        new CustomEvent<FirstRunAction>(FIRST_RUN_ACTION_EVENT, { detail: name }),
      );
    },
  };
}

const vaultReady = (f: GuideFacts): boolean => f.vaultExists && f.vaultUnlocked;
const projectReady = (f: GuideFacts): boolean =>
  f.projectExists && f.projectHasLanguages && f.projectHasEntries;

/** `firstRun.<group>.title` / `.why`, with the step's own `what`. */
function copy(group: string, what: string): Pick<TourStep, 'titleKey' | 'whatKey' | 'whyKey'> {
  return {
    titleKey: `firstRun.${group}.title`,
    whatKey: `firstRun.${group}.${what}`,
    whyKey: `firstRun.${group}.why`,
  };
}

/**
 * Local steps 1 and 2 use the in-app forms. Steps anchored inside a sheet
 * complete from app state, never from a callout button: a press on the callout
 * counts as a press outside the sheet and would close it.
 */
function localVaultAndKeySteps(vaultCopy: 'vault' | 'unlock'): TourStep[] {
  return [
    {
      id: 'vault-open',
      anchor: null,
      ...copy(vaultCopy, 'openWhat'),
      advance: { kind: 'state', done: vaultReady },
      actions: [action('open-vault', 'openVault')],
      major: 1,
    },
    {
      id: 'vault-password',
      anchor: 'vault-password-input',
      ...copy(vaultCopy, 'passwordWhat'),
      side: 'right',
      advance: { kind: 'state', done: vaultReady },
      major: 1,
    },
    {
      id: 'key-choice',
      anchor: null,
      ...copy('key', 'choiceWhat'),
      advance: { kind: 'state', done: (f) => f.usableKey },
      actions: [
        action('get-google-key', 'getGoogleKey'),
        action('add-google-key', 'addGoogleKey'),
        action('own-provider', 'ownProvider'),
      ],
      major: 2,
    },
    {
      id: 'key-paste',
      anchor: 'vault-editor-value',
      ...copy('key', 'pasteWhat'),
      side: 'right',
      advance: { kind: 'state', done: (f) => f.usableKey },
      major: 2,
    },
  ];
}

/**
 * Cloud steps 1 and 2 happen on the `/vault` page; the guide resumes at step 3
 * on return. One step, worded for what is still missing there: a vault, an
 * unlock, or a usable key.
 */
function cloudVaultAndKeySteps(need: 'vault' | 'unlock' | 'key'): TourStep[] {
  const wording = {
    vault: {
      titleKey: 'firstRun.cloudVault.title',
      whatKey: 'firstRun.cloudVault.what',
      whyKey: 'firstRun.cloudVault.why',
      label: 'cloudVault',
    },
    unlock: {
      titleKey: 'firstRun.unlock.title',
      whatKey: 'firstRun.cloudUnlock.what',
      whyKey: 'firstRun.unlock.why',
      label: 'openVaultPage',
    },
    key: {
      titleKey: 'firstRun.key.title',
      whatKey: 'firstRun.cloudKey.what',
      whyKey: 'firstRun.key.why',
      label: 'openVaultPage',
    },
  }[need];
  return [
    {
      id: 'cloud-vault',
      anchor: null,
      titleKey: wording.titleKey,
      whatKey: wording.whatKey,
      whyKey: wording.whyKey,
      advance: { kind: 'state', done: (f) => vaultReady(f) && f.usableKey },
      actions: [action('cloud-vault', wording.label), action('own-provider', 'ownProvider')],
      major: 1,
    },
  ];
}

/**
 * Where a translation run stands when it is not simply working, in the
 * guide's wordings:
 * - `auth` / `quota` / `other`: it ended with nothing translated;
 * - `parked`: the app paused it on provider errors and it holds the queue;
 * - `waiting-quota` / `waiting-model`: it is paused and resumes by itself
 *   (free quota used up, or no free model good enough right now).
 */
export type RunStall = 'auth' | 'quota' | 'other' | 'parked' | 'waiting-quota' | 'waiting-model';

/** The "translation is running" step; the stall steps are shown in its place. */
const WAITING_STEP = 'translate-progress';

const STALL_STEP: Record<RunStall, string> = {
  auth: 'translate-failed-auth',
  quota: 'translate-failed-quota',
  other: 'translate-failed-other',
  parked: 'translate-parked',
  'waiting-quota': 'translate-waiting-quota',
  'waiting-model': 'translate-waiting-model',
};

/** Shown in place of `translate-progress` while the run is not simply working. */
function stallStep(
  stall: RunStall,
  text: Pick<TourStep, 'titleKey' | 'whatKey' | 'whyKey'>,
  actions?: TourStep['actions'],
): TourStep {
  return {
    id: STALL_STEP[stall],
    anchor: 'console-status',
    ...text,
    advance: { kind: 'state', done: (f) => f.translationExists },
    actions,
    // The run's own controls (cancel, Activity, the console) stay usable.
    dim: false,
    major: 4,
    variantOf: WAITING_STEP,
  };
}

/** The run ended with nothing translated: nothing to stop, just try again. */
const endedStep = (cause: 'auth' | 'quota' | 'other'): TourStep =>
  stallStep(
    cause,
    {
      titleKey: 'firstRun.failed.title',
      whatKey: `firstRun.failed.${cause}What`,
      whyKey: 'firstRun.failed.why',
    },
    [action('fix-key', 'fixKey'), action('retry', 'retry')],
  );

/** The run will resume by itself: explain, and offer nothing to press. */
const waitingStep = (stall: 'waiting-quota' | 'waiting-model', what: string): TourStep =>
  stallStep(stall, {
    titleKey: 'firstRun.waiting.title',
    whatKey: `firstRun.waiting.${what}`,
    whyKey: 'firstRun.waiting.why',
  });

const STALL_STEPS: TourStep[] = [
  endedStep('auth'),
  endedStep('quota'),
  endedStep('other'),
  // Trying again here stops the paused run, and the wording says so.
  stallStep(
    'parked',
    {
      titleKey: 'firstRun.parked.title',
      whatKey: 'firstRun.parked.what',
      whyKey: 'firstRun.failed.why',
    },
    [action('fix-key', 'fixKey'), action('stop-retry', 'stopRetry')],
  ),
  waitingStep('waiting-quota', 'quotaWhat'),
  waitingStep('waiting-model', 'modelWhat'),
];

const QUICK_STEP = 'translate-quick';

/**
 * The quick test step. With QUICK_TEST_SIZE entries or fewer (`few`) the test
 * would be everything, so it offers just "Translate them".
 */
function quickTestStep(few: boolean): TourStep {
  return {
    id: QUICK_STEP,
    anchor: 'bulk-batch-translate',
    ...copy('translate', few ? 'fewWhat' : 'quickWhat'),
    advance: { kind: 'manual' },
    navigate: { view: 'project', tab: 'strings' },
    actions: few
      ? [action('translate-few', 'translateFew')]
      : [
          action('translate-quick', 'translateQuick'),
          // Always one click away: the quick test must never be a detour.
          action('translate-everything', 'translateEverything'),
        ],
    major: 4,
  };
}

const SHARED_STEPS: TourStep[] = [
  {
    id: 'project-open',
    anchor: 'project-selector-trigger',
    ...copy('project', 'openWhat'),
    advance: { kind: 'click' },
    major: 3,
  },
  {
    id: 'project-new',
    anchor: 'new-project-button',
    ...copy('project', 'newWhat'),
    advance: { kind: 'click' },
    major: 3,
  },
  {
    id: 'project-create',
    anchor: 'new-project-input',
    ...copy('project', 'createWhat'),
    side: 'left',
    advance: { kind: 'state', done: (f) => f.projectExists },
    major: 3,
  },
  {
    id: 'languages-source',
    anchor: 'source-language-select',
    ...copy('project', 'sourceWhat'),
    advance: { kind: 'next' },
    navigate: { view: 'project', tab: 'data' },
    major: 3,
  },
  {
    id: 'languages-targets',
    anchor: 'target-languages',
    ...copy('project', 'targetsWhat'),
    // Beside the list: the Save button appears right below it.
    side: 'right',
    advance: { kind: 'next' },
    navigate: { view: 'project', tab: 'data' },
    major: 3,
  },
  {
    id: 'languages-save',
    anchor: 'save-languages-button',
    ...copy('project', 'saveWhat'),
    advance: { kind: 'state', done: (f) => f.projectHasLanguages },
    major: 3,
  },
  {
    id: 'import',
    anchor: 'import-csv-button',
    ...copy('project', 'importWhat'),
    advance: { kind: 'click' },
    navigate: { view: 'project', tab: 'data' },
    major: 3,
  },
  {
    id: 'import-confirm',
    anchor: 'confirm-import',
    ...copy('project', 'confirmWhat'),
    side: 'left',
    advance: { kind: 'state', done: (f) => f.projectHasEntries },
    major: 3,
  },
  {
    id: 'translate-open',
    anchor: 'tab-strings',
    ...copy('translate', 'openWhat'),
    advance: { kind: 'click' },
    navigate: { view: 'project' },
    major: 4,
  },
  // The quick test: the guide selects the first three entries itself and
  // asks for them (or for everything) from the callout. Done when the request
  // produced a run (`FirstRunTour` watches for it): one refused before a run
  // exists (no route, a validation error) must not leave "the translation is
  // running" on screen. Its actions depend on the project's size, see
  // `firstRunTourFor`.
  quickTestStep(false),
  // "Try again" only: the person selects and starts by hand. They stand in for
  // the quick test, so the counter does not move.
  {
    // Done once something is selected, not on the click: on entries that are
    // already selected a click would deselect them all.
    id: 'select-all',
    anchor: 'string-table-select-all',
    ...copy('translate', 'selectWhat'),
    advance: { kind: 'state', done: (f) => f.hasSelection },
    // "Try again" lands here, or on the next step, from anywhere.
    navigate: { view: 'project', tab: 'strings' },
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    id: 'translate-selected',
    anchor: 'bulk-batch-translate',
    ...copy('translate', 'pressWhat'),
    advance: { kind: 'click' },
    navigate: { view: 'project', tab: 'strings' },
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    // Done when the request produced a run, like the quick test.
    id: 'translate-start',
    anchor: 'comparison-translate-start',
    ...copy('translate', 'startWhat'),
    advance: { kind: 'manual' },
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    id: WAITING_STEP,
    anchor: 'console-status',
    titleKey: 'firstRun.translate.title',
    whatKey: 'firstRun.translate.progressWhat',
    whyKey: 'firstRun.translate.progressWhy',
    advance: { kind: 'state', done: (f) => f.translationExists },
    // A run can stall; its controls must stay reachable while the guide waits.
    dim: false,
    major: 4,
  },
  ...STALL_STEPS,
  {
    // After the quick test: it worked, and the rest can go now or later.
    id: 'translate-rest',
    anchor: null,
    titleKey: 'firstRun.rest.title',
    whatKey: 'firstRun.rest.what',
    whyKey: 'firstRun.rest.why',
    advance: { kind: 'state', done: (f) => !f.quickTestPending },
    // The strings tab, where the request to translate the rest is answered.
    navigate: { view: 'project', tab: 'strings' },
    actions: [action('translate-rest', 'translateRest'), action('skip-rest', 'skipRest')],
    major: 4,
    variantOf: WAITING_STEP,
  },
  {
    id: 'export-open',
    anchor: 'tab-data',
    ...copy('export', 'openWhat'),
    advance: { kind: 'click' },
    navigate: { view: 'project' },
    major: 5,
  },
  {
    id: 'export',
    anchor: 'export-csv-button',
    ...copy('export', 'downloadWhat'),
    advance: { kind: 'state', done: (f) => f.exported },
    major: 5,
  },
  {
    // Ends through "Maybe later" or a flip of the switch it points at
    // (`FirstRunTour` watches the mode), so it shows no Next.
    id: 'closing',
    anchor: 'mode-switch',
    titleKey: 'firstRun.closing.title',
    whatKey: 'firstRun.closing.what',
    whyKey: 'firstRun.closing.why',
    advance: { kind: 'state', done: () => false },
    actions: [action('maybe-later', 'maybeLater')],
  },
];

const tourOf = (head: TourStep[]): Tour => ({
  id: FIRST_RUN_TOUR_ID,
  steps: [...head, ...SHARED_STEPS],
});

/** The same tour for a project of QUICK_TEST_SIZE entries or fewer: no choice to make. */
const fewEntriesTours = new Map<Tour, Tour>();
function withFewEntries(tour: Tour): Tour {
  let few = fewEntriesTours.get(tour);
  if (!few) {
    few = {
      ...tour,
      steps: tour.steps.map((s) => (s.id === QUICK_STEP ? quickTestStep(true) : s)),
    };
    fewEntriesTours.set(tour, few);
  }
  return few;
}

/** The local first-run tour (a new vault). */
export const FIRST_RUN_TOUR: Tour = tourOf(localVaultAndKeySteps('vault'));
/** Same steps, worded for a vault that already exists and only needs unlocking. */
const FIRST_RUN_TOUR_UNLOCK: Tour = tourOf(localVaultAndKeySteps('unlock'));
/** The cloud first-run tour: steps 1 and 2 are one hand-off to the vault page. */
export const FIRST_RUN_TOUR_CLOUD: Tour = tourOf(cloudVaultAndKeySteps('vault'));
const FIRST_RUN_TOUR_CLOUD_UNLOCK: Tour = tourOf(cloudVaultAndKeySteps('unlock'));
const FIRST_RUN_TOUR_CLOUD_KEY: Tour = tourOf(cloudVaultAndKeySteps('key'));

/**
 * The tour for this person. Every variant shares one tour id, and the variants
 * of one mode share step ids and order, so switching between them (a vault
 * that now exists, or is now unlocked) never moves the person. `fewEntries`:
 * the project has QUICK_TEST_SIZE translatable entries or fewer, so the quick
 * test offers no choice.
 */
export function firstRunTourFor(
  f: Pick<GuideFacts, 'cloud' | 'vaultExists'> & Partial<Pick<GuideFacts, 'vaultUnlocked'>>,
  opts: { fewEntries?: boolean } = {},
): Tour {
  const tour = baseTourFor(f);
  return opts.fewEntries ? withFewEntries(tour) : tour;
}

function baseTourFor(
  f: Pick<GuideFacts, 'cloud' | 'vaultExists'> & Partial<Pick<GuideFacts, 'vaultUnlocked'>>,
): Tour {
  if (!f.cloud) return f.vaultExists ? FIRST_RUN_TOUR_UNLOCK : FIRST_RUN_TOUR;
  if (!f.vaultExists) return FIRST_RUN_TOUR_CLOUD;
  return f.vaultUnlocked ? FIRST_RUN_TOUR_CLOUD_KEY : FIRST_RUN_TOUR_CLOUD_UNLOCK;
}

/** The quick test translated something and the person has not chosen what comes next. */
const restPending = (f: GuideFacts): boolean => f.translationExists && f.quickTestPending;

/** 1-5: the first major step that is not complete yet; 6 once all five are. */
function firstIncompleteMajor(f: GuideFacts): number {
  if (!vaultReady(f)) return 1;
  // Cloud's single hand-off step covers the vault and the key.
  if (!f.usableKey) return f.cloud ? 1 : 2;
  if (!projectReady(f)) return 3;
  // "Translate the rest?" after the quick test is still part of step 4.
  if (!f.translationExists || restPending(f)) return 4;
  if (!f.exported) return 5;
  return 6;
}

/** The major step to resume at, for "Continue setup: step N of 5". */
export function firstRunMajor(f: GuideFacts): number {
  return Math.min(firstIncompleteMajor(f), 5);
}

/**
 * Index (in `firstRunTourFor(f)`, whatever its `fewEntries`) of the step to show: the first sub-step of
 * the first major step that is not complete. Within step 3 it resumes at the
 * sub-step the project still needs. `'done'` once the closing callout was
 * acknowledged.
 */
export function firstRunStepIndex(f: GuideFacts, finished = false): number | 'done' {
  if (finished) return 'done';
  const steps = firstRunTourFor(f).steps;
  const at = (id: string): number => steps.findIndex((s) => s.id === id);
  const major = firstIncompleteMajor(f);
  if (major === 6) return at('closing');
  if (major === 3) {
    if (!f.projectExists) return at('project-open');
    if (!f.projectHasLanguages) return at('languages-source');
    return at('import');
  }
  if (major === 4 && restPending(f)) return at('translate-rest');
  return steps.findIndex((s) => s.major === major);
}

/**
 * Sub-step pairs that are two views of one question, "is the form on screen?":
 * `closed` asks the person to open it, `open` points inside it. The form can
 * open or close without the guide (a locked vault opens the unlock form by
 * itself; the person can cancel the key editor), so the pair follows the form
 * rather than the button that was pressed.
 */
const FORM_STEPS = [
  { closed: 'vault-open', open: 'vault-password', anchor: 'vault-password-input' },
  { closed: 'key-choice', open: 'key-paste', anchor: 'vault-editor-value' },
] as const;

/** The `data-tour` anchors whose presence {@link firstRunShownIndex} needs to know. */
export const FIRST_RUN_FORM_ANCHORS = FORM_STEPS.map((p) => p.anchor);

const STALL_STEP_IDS: readonly string[] = Object.values(STALL_STEP);
const isWaitingStep = (id: string | undefined): boolean =>
  id === WAITING_STEP || (id !== undefined && STALL_STEP_IDS.includes(id));

/** What is true on screen right now, beyond the facts. */
export interface FirstRunScreen {
  isOnScreen: (anchor: string) => boolean;
  /** Set while the translation run is not simply working (ended empty, parked, waiting). */
  runStall: RunStall | null;
}

/**
 * The step to put on screen for position `index`: the same step, except that
 * a form pair shows whichever half matches the form's real state, and the
 * "translation is running" step shows the variant for a run that ended empty,
 * is parked, or is waiting.
 */
export function firstRunShownIndex(tour: Tour, index: number, screen: FirstRunScreen): number {
  const id = tour.steps[index]?.id;
  const at = (stepId: string): number => {
    const found = tour.steps.findIndex((s) => s.id === stepId);
    return found >= 0 ? found : index;
  };
  if (isWaitingStep(id)) {
    return at(screen.runStall ? STALL_STEP[screen.runStall] : WAITING_STEP);
  }
  const pair = FORM_STEPS.find((p) => p.closed === id || p.open === id);
  if (!pair) return index;
  return at(screen.isOnScreen(pair.anchor) ? pair.open : pair.closed);
}
