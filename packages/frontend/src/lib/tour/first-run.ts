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
import { QUICK_TEST_SIZE } from './quick-test-size.js';
import type { GuideFacts, Tour, TourStep } from './types.js';

export const FIRST_RUN_TOUR_ID = 'first-run';

export type FirstRunAction =
  | 'open-vault'
  | 'cloud-vault'
  | 'own-provider'
  | 'use-found-key'
  | 'fix-key'
  | 'retry'
  | 'stop-retry'
  | 'translate-quick'
  | 'translate-everything'
  | 'translate-few'
  | 'translate-rest'
  | 'skip-rest'
  | 'retranslate-test'
  | 'restore-test'
  | 'keep-test'
  | 'tour-sections'
  | 'maybe-later'
  | 'open-tours'
  | 'tours-done';

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
/** The translation step's wait is over: something was translated, and no rest run is still going. */
const translationSettled = (f: GuideFacts): boolean => f.translationExists && !f.restRunning;
const projectReady = (f: GuideFacts): boolean =>
  f.projectExists && f.projectHasLanguages && f.projectHasEntries;

/** `firstRun.<group>.title` / `.why`, with the step's own `what`. */
/**
 * `firstRun.<group>.title` and the step's own `what`; `why` only when given:
 * most steps just say where to go, and the explanation sits on the one step
 * where it matters (said once, not on every step of the group).
 */
function copy(
  group: string,
  what: string,
  why?: string,
): Pick<TourStep, 'titleKey' | 'whatKey' | 'whyKey'> {
  return {
    titleKey: `firstRun.${group}.title`,
    whatKey: `firstRun.${group}.${what}`,
    ...(why ? { whyKey: `firstRun.${group}.${why}` } : {}),
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
      ...copy(vaultCopy, 'openWhat', 'why'),
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
      ...copy('key', 'choiceWhat', 'why'),
      advance: { kind: 'state', done: (f) => f.usableKey },
      // One way in: the provider list, free tiers first.
      actions: [{ ...action('own-provider', 'chooseProvider'), primary: true }],
      major: 2,
    },
    {
      id: 'key-paste',
      anchor: 'vault-editor-value',
      ...copy('key', 'pasteWhat'),
      // Above the key row: below it are the password and Save, which a callout
      // beside the field would cover in a narrow window.
      side: 'top',
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
      actions: [action('cloud-vault', wording.label), action('own-provider', 'chooseProvider')],
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
    // Above the console: below it is the window's edge, and a callout over
    // the console would cover its header (opening it) and its progress.
    side: 'top',
    ...text,
    advance: { kind: 'state', done: translationSettled },
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
/** The quick test has been answered: something was translated. Shared, so the step keeps its identity. */
const QUICK_DONE = (f: GuideFacts): boolean => f.translationExists;
/** Shown in place of the quick test when every entry is already translated. */
const NOTHING_STEP = 'translate-nothing';
/**
 * The retranslate test, done by the person: the list shows translated entries
 * (only if "Untranslated only" hides them), they tick 3, press Translate, and
 * start a retranslation in the dialog (FORM_STEPS pairs the last two).
 */
const RETEST_FILTER_STEP = 'retest-filter';
const RETEST_SELECT_STEP = 'retest-select';
const RETEST_TRANSLATE_STEP = 'retest-translate';
const RETEST_START_STEP = 'retest-start';
const RETEST_STEPS: readonly string[] = [
  RETEST_FILTER_STEP,
  RETEST_SELECT_STEP,
  RETEST_TRANSLATE_STEP,
  RETEST_START_STEP,
];
/** After a retranslate test: put the file's translations back, or keep the new ones. */
const RESTORE_STEP = 'translate-restore';
const RESTORE_STEPS: readonly string[] = [RESTORE_STEP, 'restore-pick', 'restore-confirm'];
const CLOSING_STEP = 'closing';
/** After the closing step: points at the Guide, where the other tours are. */
export const MORE_TOURS_STEP = 'more-tours';

/**
 * Shown over the provider list the guide opened ("Choose a provider"), so the
 * guide stays on screen while it is open. Not part of the tour's steps: the
 * list can open from several steps, and the counter keeps the step's place.
 */
export const PROVIDER_LIST_STEP: TourStep = {
  id: 'provider-list',
  anchor: 'provider-choice',
  titleKey: 'firstRun.providerList.title',
  whatKey: 'firstRun.providerList.what',
  whyKey: 'firstRun.providerList.why',
  side: 'left',
  advance: { kind: 'manual' },
};

/** Shown over the provider card opened from "Translated by · Change", likewise. */
export const PROVIDER_CARD_STEP: TourStep = {
  id: 'provider-card',
  anchor: 'provider-sheet',
  titleKey: 'firstRun.providerCard.title',
  whatKey: 'firstRun.providerCard.what',
  whyKey: 'firstRun.providerCard.why',
  side: 'left',
  advance: { kind: 'manual' },
};

/** `data-tour` of the Backups row holding the retranslate test's restore point. */
export const RESTORE_POINT_ANCHOR = 'guide-restore-point';
/** `data-tour` of the confirm button of a restore from that row. */
export const RESTORE_CONFIRM_ANCHOR = 'guide-restore-confirm';

/**
 * The quick test step. With QUICK_TEST_SIZE entries or fewer (`few`) the test
 * would be everything, so it offers just "Translate them".
 */
function quickTestStep(few: boolean): TourStep {
  return {
    id: QUICK_STEP,
    anchor: 'bulk-batch-translate',
    ...copy('translate', few ? 'fewWhat' : 'quickWhat'),
    // Reached via Back once something was translated: Next moves on without a new run.
    advance: { kind: 'manual', nextOnBack: QUICK_DONE },
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
    // Beside the sidebar: the project list opens right below the trigger.
    side: 'right',
    // No click advance: the list opening shows "New project" (the pair in
    // FORM_STEPS), and a click advance on top of it would skip that step.
    advance: { kind: 'manual' },
    major: 3,
  },
  {
    id: 'project-new',
    anchor: 'new-project-button',
    ...copy('project', 'newWhat'),
    side: 'right',
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
    // Next once something is ticked (Save shows then): with nothing ticked it
    // would lead to "save your languages" with nothing to save.
    // Already saved (a Back round-trip), Next needs no change.
    advance: {
      kind: 'next',
      needs: 'save-languages-button',
      unlessDone: (f) => f.projectHasLanguages,
    },
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
    // Paired with its review sheet (see FORM_STEPS), not done on the click:
    // the file picker can be cancelled, and then nothing is there to confirm.
    id: 'import',
    anchor: 'import-csv-button',
    ...copy('project', 'importWhat'),
    advance: { kind: 'state', done: (f) => f.projectHasEntries },
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
  // The quick test: the guide selects three entries that still need
  // translating and asks for them (or for everything) from the callout. Done
  // when the request produced a run (`FirstRunTour` watches for it): one
  // refused before a run exists (no route, a validation error) must not leave
  // "the translation is running" on screen. Its actions depend on how much is
  // left to translate, see `firstRunTourFor`. "Try again" comes back here.
  quickTestStep(false),
  {
    // The quick test's other half: the translation dialog, opened from the
    // highlighted button, is on screen (see FORM_STEPS). Its run is the quick
    // test, done when it is listed like the callout's.
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
    side: 'top',
    titleKey: 'firstRun.translate.title',
    whatKey: 'firstRun.translate.progressWhat',
    whyKey: 'firstRun.translate.progressWhy',
    advance: { kind: 'state', done: translationSettled },
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
    advance: { kind: 'state', done: (f) => !f.quickTestPending },
    // The strings tab, where the request to translate the rest is answered.
    navigate: { view: 'project', tab: 'strings' },
    actions: [action('translate-rest', 'translateRest'), action('skip-rest', 'skipRest')],
    major: 4,
    variantOf: WAITING_STEP,
  },
  {
    // In place of the quick test when the file already has every real
    // translation: nothing to do, and Next moves on to the export.
    id: NOTHING_STEP,
    anchor: null,
    titleKey: 'firstRun.translate.title',
    whatKey: 'firstRun.translate.nothingWhat',
    whyKey: 'firstRun.translate.nothingWhy',
    advance: { kind: 'next' },
    // The entries tab, where the person does the retranslate test.
    navigate: { view: 'project', tab: 'strings' },
    // A test that replaces 3 translations; the restore point the server takes
    // first puts them back (see RESTORE_STEP). The action only starts the
    // walk through it (RETEST_STEPS): the person picks and starts it.
    actions: [{ ...action('retranslate-test', 'retranslateTest'), primary: true }],
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    // Only while "Untranslated only" hides the translated entries.
    id: RETEST_FILTER_STEP,
    anchor: 'status-filter',
    titleKey: 'firstRun.retest.title',
    whatKey: 'firstRun.retest.filterWhat',
    advance: { kind: 'state', done: (f) => !f.untranslatedFilterOn },
    navigate: { view: 'project', tab: 'strings' },
    // Its list opens below the button, outside the spotlight: left usable.
    dim: false,
    side: 'right',
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    id: RETEST_SELECT_STEP,
    anchor: 'string-table-rows',
    titleKey: 'firstRun.retest.title',
    whatKey: 'firstRun.retest.selectWhat',
    advance: { kind: 'state', done: (f) => f.selectedCount >= QUICK_TEST_SIZE },
    navigate: { view: 'project', tab: 'strings' },
    // Above the list: its rows are what the person ticks.
    side: 'top',
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    // Paired with the dialog it opens (see FORM_STEPS); the run it starts is
    // the test (`FirstRunTour` follows it from the run list).
    id: RETEST_TRANSLATE_STEP,
    anchor: 'bulk-batch-translate',
    titleKey: 'firstRun.retest.title',
    whatKey: 'firstRun.retest.translateWhat',
    advance: { kind: 'manual' },
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    id: RETEST_START_STEP,
    anchor: 'translate-dialog',
    titleKey: 'firstRun.retest.title',
    whatKey: 'firstRun.retest.startWhat',
    // Above the dialog: beside it there is little room, and its mode choice
    // and Start are both what the step asks for.
    side: 'top',
    advance: { kind: 'manual' },
    major: 4,
    variantOf: QUICK_STEP,
  },
  {
    // After the retranslate test: its run replaced 3 translations.
    id: RESTORE_STEP,
    anchor: null,
    titleKey: 'firstRun.restore.title',
    whatKey: 'firstRun.restore.what',
    whyKey: 'firstRun.restore.why',
    advance: { kind: 'state', done: (f) => !f.retestPending },
    navigate: { view: 'project', tab: 'strings' },
    actions: [
      { ...action('restore-test', 'restoreTest'), primary: true },
      action('keep-test', 'keepTest'),
    ],
    major: 4,
    variantOf: WAITING_STEP,
  },
  {
    // The restore point taken just before the test, on the Backups page
    // (paired with its confirmation, see FORM_STEPS).
    id: 'restore-pick',
    anchor: RESTORE_POINT_ANCHOR,
    titleKey: 'firstRun.restore.title',
    whatKey: 'firstRun.restore.pickWhat',
    whyKey: 'firstRun.restore.pickWhy',
    advance: { kind: 'state', done: (f) => !f.retestPending },
    navigate: { view: 'project', tab: 'backup' },
    actions: [action('keep-test', 'keepTest')],
    major: 4,
    variantOf: WAITING_STEP,
  },
  {
    id: 'restore-confirm',
    anchor: RESTORE_CONFIRM_ANCHOR,
    titleKey: 'firstRun.restore.title',
    whatKey: 'firstRun.restore.confirmWhat',
    side: 'left',
    advance: { kind: 'state', done: (f) => !f.retestPending },
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
    ...copy('export', 'downloadWhat', 'why'),
    advance: { kind: 'state', done: (f) => f.exported },
    // "Skip, export what I have" lands here straight from the strings tab.
    navigate: { view: 'project', tab: 'data' },
    major: 5,
  },
  closingStep(false),
  {
    // Last: where the other guided tours are. Reached from "Maybe later".
    id: MORE_TOURS_STEP,
    anchor: 'sidebar-guide',
    titleKey: 'firstRun.moreTours.title',
    whatKey: 'firstRun.moreTours.what',
    side: 'right',
    advance: { kind: 'manual' },
    actions: [
      { ...action('open-tours', 'openTours'), primary: true },
      action('tours-done', 'toursDone'),
    ],
    variantOf: CLOSING_STEP,
  },
];

/**
 * The closing callout. Ends through its actions, or in Simple a flip of the
 * switch it points at (`FirstRunTour` watches the mode), so it shows no Next.
 * `advanced`: the first run was restarted in Advanced and stayed there, so
 * there is no switch to flip; it offers the Advanced sections tour instead.
 */
function closingStep(advanced: boolean): TourStep {
  return {
    id: CLOSING_STEP,
    anchor: advanced ? null : 'mode-switch',
    titleKey: 'firstRun.closing.title',
    whatKey: advanced ? 'firstRun.closing.whatAdvanced' : 'firstRun.closing.what',
    whyKey: 'firstRun.closing.why',
    advance: { kind: 'state', done: () => false },
    actions: advanced
      ? [action('tour-sections', 'tourSections'), action('maybe-later', 'maybeLater')]
      : [action('maybe-later', 'maybeLater')],
  };
}

const tourOf = (head: TourStep[]): Tour => ({
  id: FIRST_RUN_TOUR_ID,
  steps: [...head, ...SHARED_STEPS],
});

/**
 * `tour` with step `id` replaced by `make()`, built once per (tour, id) so a
 * tour keeps its identity from one render to the next.
 */
const replacedTours = new Map<string, Map<Tour, Tour>>();
function withStep(
  tour: Tour,
  id: string,
  make: (step: TourStep) => TourStep,
  variant = 'default',
): Tour {
  const cacheKey = `${id}:${variant}`;
  let byTour = replacedTours.get(cacheKey);
  if (!byTour) {
    byTour = new Map();
    replacedTours.set(cacheKey, byTour);
  }
  let replaced = byTour.get(tour);
  if (!replaced) {
    replaced = { ...tour, steps: tour.steps.map((s) => (s.id === id ? make(s) : s)) };
    byTour.set(tour, replaced);
  }
  return replaced;
}

/** The step that asks for a key: `key-choice` locally, the vault hand-off in cloud. */
const KEY_STEPS = ['key-choice', 'cloud-vault'];

/** `step` with "Use <provider> for your translations" first among its actions. */
const withFoundKeyAction = (step: TourStep): TourStep => ({
  ...step,
  actions: [
    { ...action('use-found-key', 'useFoundKey'), primary: true },
    // One primary at a time: the found key's.
    ...(step.actions ?? []).map(({ primary: _primary, ...rest }) => rest),
  ],
});

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
 * test offers no choice. `advanced`: the guide runs in Advanced (restarted
 * there from the Guide), so the closing step is worded for it. `foundKey`:
 * the vault already holds the key of a provider the person could use (and no
 * free key), so the key step offers it in one click.
 */
export function firstRunTourFor(
  f: Pick<GuideFacts, 'cloud' | 'vaultExists'> & Partial<Pick<GuideFacts, 'vaultUnlocked'>>,
  opts: { fewEntries?: boolean; advanced?: boolean; foundKey?: boolean } = {},
): Tour {
  let tour = baseTourFor(f);
  if (opts.advanced) tour = withStep(tour, CLOSING_STEP, () => closingStep(true));
  if (opts.fewEntries) tour = withStep(tour, QUICK_STEP, () => quickTestStep(true));
  if (opts.foundKey) {
    for (const id of KEY_STEPS) tour = withStep(tour, id, withFoundKeyAction, 'found-key');
  }
  return tour;
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
  // "Translate the rest?" after the quick test, and the rest's own run, are
  // still part of step 4.
  // A file that came translated has nothing for step 4 to do.
  const translated = f.translationExists || f.nothingToTranslate;
  if (!translated || restPending(f) || f.restRunning) return 4;
  // The retranslate test, from the moment it is asked for until its
  // translations are kept or put back.
  if (f.retestAsked || f.retestRunning || f.retestPending) return 4;
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
  if (major === 6) return at(CLOSING_STEP);
  if (major === 3) {
    if (!f.projectExists) return at('project-open');
    if (!f.projectHasLanguages) return at('languages-source');
    return at('import');
  }
  // Said once, on the way to the export: the guide's way into step 5.
  if (major === 5 && !f.translationExists && f.nothingToTranslate && !f.retestDone) {
    return at(NOTHING_STEP);
  }
  if (major === 4 && f.retestAsked) return at(retestStepFor(f));
  if (major === 4 && f.retestPending) return at(RESTORE_STEP);
  if (major === 4 && f.retestRunning) return at(WAITING_STEP);
  if (major === 4 && restPending(f)) return at('translate-rest');
  if (major === 4 && f.translationExists && f.restRunning) return at(WAITING_STEP);
  return steps.findIndex((s) => s.major === major);
}

/** Where the retranslate test's set-up stands: the first thing it still needs. */
function retestStepFor(f: GuideFacts): string {
  if (f.untranslatedFilterOn) return RETEST_FILTER_STEP;
  if (f.selectedCount < QUICK_TEST_SIZE) return RETEST_SELECT_STEP;
  return RETEST_TRANSLATE_STEP;
}

/**
 * Whether Next / Back may stop at `step` given the facts: "nothing to
 * translate" only when that is so, and then none of the quick test's steps
 * (there is nothing for them to translate).
 */
export function firstRunStepApplies(step: TourStep | undefined, f: GuideFacts): boolean {
  if (!step) return false;
  if (step.id === NOTHING_STEP) {
    return f.nothingToTranslate && !f.translationExists && !f.retestDone;
  }
  // The retranslate test's own steps, only while it is being set up.
  if (step.id === RETEST_FILTER_STEP) return f.retestAsked && f.untranslatedFilterOn;
  if (RETEST_STEPS.includes(step.id)) return f.retestAsked;
  // The retranslate test's restore steps, only while its choice is open.
  if (RESTORE_STEPS.includes(step.id)) return f.retestPending;
  if (f.nothingToTranslate && !f.translationExists) return step.major !== 4;
  return true;
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
  // The translation dialog, opened from the quick test's highlighted button.
  { closed: QUICK_STEP, open: 'translate-start', anchor: 'comparison-translate-start' },
  // The import review sheet, opened once a file was chosen.
  { closed: 'import', open: 'import-confirm', anchor: 'confirm-import' },
  // The restore confirmation, opened from the restore point's row.
  { closed: 'restore-pick', open: 'restore-confirm', anchor: RESTORE_CONFIRM_ANCHOR },
  // The project list: "New project" is shown only while the list is open, so
  // the step follows the list (it closes on a click outside, or Escape).
  { closed: 'project-open', open: 'project-new', anchor: 'new-project-button' },
  // The same dialog, opened for the retranslate test.
  { closed: RETEST_TRANSLATE_STEP, open: RETEST_START_STEP, anchor: 'comparison-translate-start' },
] as const;

/**
 * Whether Back shows on the step on screen. Not on a step that reports a
 * done deed with nothing before it to redo: the retranslate test's result, or
 * its run while it goes (a stopped run's failure offers Back, see
 * {@link firstRunBack}).
 */
export function firstRunCanGoBack(
  tour: Tour,
  shownIndex: number,
  facts: GuideFacts,
  screen: FirstRunScreen,
): boolean {
  if (shownIndex <= 0) return false;
  const id = tour.steps[shownIndex]?.id;
  if (id === RESTORE_STEP) return false;
  if (isWaitingStep(id) && facts.retestRunning && !screen.runStall) return false;
  return true;
}

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

/**
 * Where Back from the step on screen (`shownIndex`) goes. From inside a form
 * (the open half of a pair) it closes the form (`closeForm`, the anchor of the
 * form to close) and goes to the half that opens it. Otherwise to the nearest
 * earlier counted step that the facts allow and that shows something other
 * than what is on screen: a variant (the dialog's Start, the run-failure
 * wordings, "translate the rest?") is only ever shown in place of its step,
 * never stepped back onto. "Nothing to translate" is the exception: when it
 * applies it stands in for all of step 4.
 */
export function firstRunBack(
  tour: Tour,
  shownIndex: number,
  facts: GuideFacts,
  screen: FirstRunScreen,
): { index: number; closeForm?: string; dropRetest?: boolean } {
  const id = tour.steps[shownIndex]?.id;
  const indexOf = (stepId: string): number => {
    const at = tour.steps.findIndex((s) => s.id === stepId);
    return at >= 0 ? at : shownIndex;
  };
  // The retranslate test runs from "nothing to translate" and comes back
  // there: from its failure, Back sets the failed test aside and offers it
  // again; from the restore point, Back returns to the choice it came from.
  if (isWaitingStep(id) && facts.retestRunning && screen.runStall) {
    return { index: indexOf(NOTHING_STEP), dropRetest: true };
  }
  if (id === 'restore-pick') return { index: indexOf(RESTORE_STEP) };
  if (id === MORE_TOURS_STEP) return { index: indexOf(CLOSING_STEP) };
  const pair = FORM_STEPS.find((p) => p.open === id);
  if (pair) {
    const closed = tour.steps.findIndex((s) => s.id === pair.closed);
    if (closed >= 0) return { index: closed, closeForm: pair.anchor };
  }
  // Back out of setting up the retranslate test: it is set aside, and
  // "nothing to translate" offers it again.
  if (id !== undefined && RETEST_STEPS.includes(id)) {
    return { index: indexOf(NOTHING_STEP), dropRetest: true };
  }
  for (let at = shownIndex - 1; at >= 0; at--) {
    const step = tour.steps[at];
    if (step.variantOf !== undefined && step.id !== NOTHING_STEP) continue;
    if (!firstRunStepApplies(step, facts)) continue;
    if (firstRunShownIndex(tour, at, screen) === shownIndex) continue;
    return { index: at };
  }
  return { index: shownIndex };
}
