import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import {
  useFirstRunActive,
  useFirstRunStall,
  useGuideRelevant,
  useGuideDataReady,
  useGuideFacts,
  type GuideFacts,
} from '../../hooks/use-guide-facts.js';
import { useIsMobile } from '../../hooks/use-mobile-viewport.js';
import { useProviderSetup } from '../../hooks/use-provider-setup.js';
import { useTourAnchor } from '../../hooks/use-tour-anchor.js';
import { useUiMode } from '../../hooks/use-ui-mode.js';
import { goToVaultSetup } from '../../lib/auth-redirect.js';
import { isRunActive, isTranslationRun } from '../../lib/run-kind.js';
import { RunStatusCode, type RunStatus } from '@zercade-dev/narn-shared';
import { statusLineRun } from '../../lib/run-status-line.js';
import { useProjectProvider } from '../../hooks/use-project-provider.js';
import {
  chooseProvider,
  type ProviderChoiceResult,
  type ProviderTarget,
} from '../../lib/provider-choice.js';
import {
  FREE_KEY_PROVIDERS,
  foundOwnProviderKey,
  GOOGLE_KEY_URL,
  providerKeyFor,
  providerName,
} from '../../lib/simple-provider.js';
import {
  FIRST_RUN_ACTION_EVENT,
  FIRST_RUN_FORM_ANCHORS,
  FIRST_RUN_TOUR_ID,
  firstRunShownIndex,
  firstRunStepApplies,
  firstRunStepIndex,
  firstRunTourFor,
  type FirstRunAction,
} from '../../lib/tour/first-run.js';
import { ADVANCED_SECTIONS_TOUR_ID } from '../../lib/tour/advanced-sections.js';
import { tourPosition } from '../../lib/tour/position.js';
import {
  QUICK_TEST_SIZE,
  quickTestEntryIds,
  quickTestFilters,
  quickTestRunId,
  realTargetLanguages,
  requestGuideTranslation,
  untranslatedEntryIds,
} from '../../lib/tour/quick-test.js';
import { getErrorMessage } from '../../lib/utils.js';
import { vaultEditorOpenEvent, vaultLockedEvent } from '../../lib/vault-events.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { accessFor, useProjectStore } from '../../stores/project-store.js';
import { useRunStore } from '../../stores/run-store.js';
import { useSelectionStore } from '../../stores/selection-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { ProviderSheet, TranslatedByLine } from '../config/TranslatedByLine.js';
import { RunProgressCard } from '../runs/RunProgressCard.js';
import { ProviderChoice } from './ProviderChoice.js';
import type { TourText } from './TourCallout.js';
import { TourOverlay } from './TourOverlay.js';

const GOOGLE_KEY = 'GOOGLE_API_KEY';

interface FirstRunTourProps {
  /** Something that comes first is on screen (the first-run theme chooser). */
  suspended: boolean;
}

/**
 * The guided first run, mounted once in the app shell. Shows nothing in
 * Advanced (unless restarted from the Guide), while an area tour runs, once skipped or finished, for a collaborator-only person, while
 * `suspended`, or on phone widths: there the sidebar is an off-canvas drawer
 * and the string list has no bulk controls, so most anchors are unreachable.
 *
 * Provider setup is not part of what is shown: it runs for as long as the mode
 * is Simple (or the guide is running in Advanced), so a key added after "Skip",
 * after finishing, on a phone or by a collaborator is still made usable.
 */
export function FirstRunTour({ suspended }: FirstRunTourProps) {
  const active = useFirstRunActive();
  const simple = useUiMode() === 'simple';
  useProviderSetup(simple || active);
  const relevant = useGuideRelevant();
  // An area tour is on screen: it comes first, then the guide carries on.
  const areaTourRunning = useGuideStore((s) => s.activeTourId !== null);
  const facts = useGuideFacts();
  const isMobile = useIsMobile();
  const projectsLoaded = useProjectStore((s) => s.loaded);
  // Also while skipped, so "Continue setup: step N of 5" counts what was imported and translated.
  const dataReady = useGuideDataReady(relevant && !facts.isCollaboratorOnly);

  // Latched: the vault store's `loading` also covers later actions (unlocking,
  // saving a key), which must not hide the guide again.
  const vaultStatusSettled = useVaultStore((s) => s.statusFetched && !s.loading);
  const [vaultKnown, setVaultKnown] = useState(vaultStatusSettled);
  if (vaultStatusSettled && !vaultKnown) setVaultKnown(true);

  // The closing step points at the mode switch: flipping it to Advanced there
  // ends the first run and starts the short tour of what Advanced adds. Read
  // from the render, since the closing step unmounts with the switch.
  const closingShown = useGuideStore((s) => s.closingShown);
  const wasSimple = useRef(simple);
  useEffect(() => {
    const flipped = wasSimple.current && !simple;
    wasSimple.current = simple;
    if (!flipped || !closingShown) return;
    const guide = useGuideStore.getState();
    guide.finishFirstRun();
    guide.startTour(ADVANCED_SECTIONS_TOUR_ID);
  }, [simple, closingShown]);

  if (
    !active ||
    areaTourRunning ||
    suspended ||
    isMobile ||
    !projectsLoaded ||
    !vaultKnown ||
    !dataReady
  ) {
    return null;
  }
  return <ActiveFirstRunTour facts={facts} />;
}

/** Steps that say who will translate ("Translated by <provider> · Change"). */
const TRANSLATED_BY_STEPS = new Set([
  'translate-open',
  'translate-quick',
  'translate-start',
  'translate-failed-auth',
  'translate-failed-quota',
  'translate-failed-other',
]);

/** Own-provider wordings of the Freeway sentences, keyed by the Freeway key. */
const OWN_PROVIDER_COPY: Readonly<Record<string, string>> = {
  'firstRun.translate.why': 'firstRun.translate.whyOwn',
  'firstRun.key.why': 'firstRun.key.whyOwn',
  'firstRun.failed.quotaWhat': 'firstRun.failed.quotaWhatOwn',
};
const CUSTOM_ROUTING_COPY: Readonly<Record<string, string>> = {
  'firstRun.translate.why': 'firstRun.translate.whyCustom',
};

/**
 * The provider the guide's copy is about: the active project's (its real
 * routing), else, before there is a project, the person's choice.
 */
function useGuideProvider(projectId: string | null): {
  kind: 'freeway' | 'own' | 'custom';
  moduleId?: string;
} {
  const { provider } = useProjectProvider(projectId);
  const chosen = useGuideStore((s) => s.simpleProvider);
  if (provider) return provider;
  return chosen ? { kind: 'own', moduleId: chosen } : { kind: 'freeway' };
}

/** `{ key }` for the vault page when the person chose their own provider. */
function chosenKey(): { key?: string } {
  const own = useGuideStore.getState().simpleProvider;
  const key = own ? providerKeyFor(own) : undefined;
  return key ? { key } : {};
}

/** The active project's real target languages (no source, no Pseudo-test). */
function activeTargets(): string[] {
  const s = useProjectStore.getState();
  return realTargetLanguages(s.projects.find((p) => p.id === s.activeProjectId));
}

/** Translation runs of `projectId` listed right now. */
function translationRunIdsOf(projectId: string): string[] {
  return useRunStore
    .getState()
    .runs.filter((r) => r.projectId === projectId && isTranslationRun(r))
    .map((r) => r.runId);
}

/** Ended having translated something: the facts then know where the guide goes. */
const translatedSomething = (run: RunStatus | undefined): boolean =>
  run !== undefined &&
  run.completed > 0 &&
  !isRunActive(run) &&
  run.status !== RunStatusCode.Paused;

/** The active project as a place to write a provider choice, when it is the person's own. */
function ownedTarget(): ProviderTarget | null {
  const s = useProjectStore.getState();
  const project = s.projects.find((p) => p.id === s.activeProjectId);
  return project && accessFor(s, project.id).role === 'owner'
    ? { kind: 'project', projectId: project.id }
    : null;
}

function ActiveFirstRunTour({ facts }: { facts: GuideFacts }) {
  const { t: tGuide } = useTranslation('guide-tour');
  // Three entries or fewer still to translate: the quick test would be
  // everything, so no choice.
  const targets = useProjectStore((s) =>
    realTargetLanguages(s.projects.find((p) => p.id === s.activeProjectId)).join('\n'),
  );
  const fewEntries = useStringStore(
    (s) =>
      untranslatedEntryIds(s.entries, targets ? targets.split('\n') : []).length <= QUICK_TEST_SIZE,
  );
  // Running in Advanced (restarted there from the Guide): no switch to flip at the end.
  const advanced = useUiMode() !== 'simple';
  // The vault holds a key the person could use, but no free key and no choice:
  // offer it in one click instead of a step they cannot get past.
  const simpleProvider = useGuideStore((s) => s.simpleProvider);
  const foundBase = useVaultStore((s) =>
    s.unlocked && !facts.usableKey && simpleProvider === null
      ? foundOwnProviderKey(s.keys, facts.cloud)
      : null,
  );
  const tour = firstRunTourFor(facts, { fewEntries, advanced, foundKey: foundBase !== null });
  const resumeAt = firstRunStepIndex(facts);
  const derived = resumeAt === 'done' ? tour.steps.length - 1 : resumeAt;

  // The step follows the facts: whenever they point somewhere else (a key was
  // saved, the vault locked, the project was deleted) the guide goes there.
  // In between, Next / Back / a click on the highlighted control move it.
  const [position, setPosition] = useState({ derived, index: derived });
  if (position.derived !== derived) setPosition({ derived, index: derived });
  const index = position.derived === derived ? position.index : derived;

  // "Open the form" / "use the form" sub-steps follow the form itself, and
  // "the translation is running" follows the run.
  const [vaultFormAnchor, keyEditorAnchor, dialogStartAnchor] = FIRST_RUN_FORM_ANCHORS;
  const vaultFormOpen = useTourAnchor(vaultFormAnchor) !== null;
  const keyEditorOpen = useTourAnchor(keyEditorAnchor) !== null;
  const dialogOpen = useTourAnchor(dialogStartAnchor) !== null;
  const stalled = useFirstRunStall();
  // "Try again" sets the failed run aside, so the guide does not show its
  // failure again while the new run has not been listed yet.
  const [retriedRunId, setRetriedRunId] = useState<string | null>(null);
  const runStall = stalled && stalled.runId !== retriedRunId ? stalled.stall : null;
  const shown = useCallback(
    (at: number) =>
      firstRunShownIndex(tour, at, {
        isOnScreen: (anchor) =>
          anchor === vaultFormAnchor
            ? vaultFormOpen
            : anchor === keyEditorAnchor
              ? keyEditorOpen
              : dialogOpen,
        runStall,
      }),
    [tour, vaultFormAnchor, keyEditorAnchor, vaultFormOpen, keyEditorOpen, dialogOpen, runStall],
  );
  const shownIndex = shown(index);
  const shownStep = tour.steps[shownIndex];
  const stepPosition = tourPosition(tour, shownIndex);

  // Where the person is in the first run, for the tour list.
  const countedIndex = stepPosition.counted - 1;
  useEffect(() => {
    useGuideStore.getState().recordTourStep(FIRST_RUN_TOUR_ID, countedIndex);
  }, [countedIndex]);

  const lastIndex = tour.steps.length - 1;
  const move = useCallback(
    (delta: 1 | -1) => {
      let target = Math.max(0, Math.min(lastIndex, shownIndex + delta));
      // Next from a step whose neighbours are other views of itself (a form
      // pair with the form closed, the run-failure variants): go past them.
      // Either way, past a step the facts rule out ("nothing to translate"
      // when there is, the quick test when there is not).
      const skip = (at: number): boolean =>
        !firstRunStepApplies(tour.steps[at], facts) || (delta > 0 && shown(at) <= shownIndex);
      while (target > 0 && target < lastIndex && skip(target)) target += delta;
      setPosition((p) => ({ ...p, index: target }));
    },
    [lastIndex, shownIndex, shown, tour, facts],
  );
  const onAdvance = useCallback(() => move(1), [move]);
  const onBack = useCallback(() => move(-1), [move]);
  const onExit = useCallback(() => useGuideStore.getState().dismissFirstRun(), []);

  const [choiceOpen, setChoiceOpen] = useState(false);
  // The provider card, opened from "Translated by … · Change".
  const [cardOpen, setCardOpen] = useState(false);
  const cloud = facts.cloud;
  const stalledRunId = stalled?.runId ?? null;
  const runQueuedBehind = stalled?.queuedBehind ?? false;
  const projectId = useProjectStore((state) => state.activeProjectId);

  // What became of a provider choice, said where the person is looking.
  const onProviderChosen = useCallback(
    ({ base, result }: { base: string; result: ProviderChoiceResult }) => {
      setChoiceOpen(false);
      const name = providerName(base);
      switch (result.status) {
        case 'applied':
          // Usable now: the facts move the guide on by themselves.
          return;
        case 'switched-off':
          toast.warning(tGuide('providerChoice.switchedOff', { provider: name }));
          return;
        case 'routing-kept':
          toast.info(tGuide('providerChoice.existingRouting'));
          return;
        case 'needs-key':
          if (!result.vaultKey) return;
          if (cloud) goToVaultSetup({ guided: true, key: result.vaultKey });
          else globalThis.dispatchEvent(vaultEditorOpenEvent({ focusKey: result.vaultKey }));
      }
    },
    [cloud, tGuide],
  );
  const reportChoice = useCallback(
    (base: string, pending: Promise<ProviderChoiceResult>) => {
      void pending
        .then((result) => onProviderChosen({ base, result }))
        .catch((err: unknown) =>
          toast.error(
            tGuide('providerChoice.failed', {
              provider: providerName(base),
              message: getErrorMessage(err),
            }),
          ),
        );
    },
    [onProviderChosen, tGuide],
  );

  // The run the guide asked for (its progress shows in the callout).
  const [guideRunId, setGuideRunId] = useState<string | null>(null);
  // "Translate everything" / "Translate them" was asked for: the run that
  // appears is not a quick test, so none is recorded for it.
  const translatingAll = useRef(false);
  // The facts as last rendered, for an action that must know where they lead.
  const factsRef = useRef(facts);
  useEffect(() => {
    factsRef.current = facts;
  });

  useEffect(() => {
    // The quick test again, with its choices (it re-selects its entries).
    const startAgain = () => {
      const at = tour.steps.findIndex((step) => step.id === 'translate-quick');
      if (at >= 0) setPosition((p) => ({ ...p, index: at }));
    };
    const onAction = (e: Event) => {
      switch ((e as CustomEvent<FirstRunAction>).detail) {
        case 'open-vault':
          globalThis.dispatchEvent(vaultLockedEvent({}));
          break;
        case 'cloud-vault':
          goToVaultSetup({ guided: true, ...chosenKey() });
          break;
        case 'get-google-key':
          globalThis.open(GOOGLE_KEY_URL, '_blank', 'noopener,noreferrer');
          break;
        case 'add-google-key':
          // The free-key path: an earlier "Use my own provider" no longer holds.
          useGuideStore.getState().setSimpleProvider(null);
          globalThis.dispatchEvent(vaultEditorOpenEvent({ focusKey: GOOGLE_KEY }));
          break;
        case 'own-provider':
          setChoiceOpen(true);
          break;
        case 'use-found-key': {
          const { keys } = useVaultStore.getState();
          const base = foundOwnProviderKey(keys, cloud);
          if (base) reportChoice(base, chooseProvider(base, ownedTarget()));
          break;
        }
        case 'fix-key': {
          if (cloud) {
            // Guided: the vault page keeps the step indicator and comes back here.
            goToVaultSetup({ guided: true, ...chosenKey() });
            break;
          }
          // The key translations are actually using: the chosen provider's, else a free one.
          const { keys } = useVaultStore.getState();
          const own = useGuideStore.getState().simpleProvider;
          const focusKey =
            (own ? providerKeyFor(own) : undefined) ??
            FREE_KEY_PROVIDERS.find((p) => keys.includes(p.key))?.key ??
            GOOGLE_KEY;
          globalThis.dispatchEvent(vaultEditorOpenEvent({ focusKey }));
          break;
        }
        case 'retry':
          // The run has ended: nothing to stop.
          setRetriedRunId(stalledRunId);
          startAgain();
          break;
        case 'stop-retry': {
          // The paused run holds the project's queue, so it is stopped first
          // (the callout says so). Only once that worked is it set aside:
          // otherwise the guide would say "running" over a queue that cannot move.
          if (!stalledRunId || !projectId) break;
          void useRunStore
            .getState()
            .cancelRun(projectId, stalledRunId)
            .then(() => {
              setRetriedRunId(stalledRunId);
              // A run already waiting behind it starts now: no new one needed.
              if (!runQueuedBehind) startAgain();
            })
            .catch((err: unknown) => toast.error(getErrorMessage(err)));
          break;
        }
        case 'translate-quick': {
          if (!projectId) break;
          translatingAll.current = false;
          // The run is known as soon as it is listed, finished or not (see
          // `quickTestRunId`); its id is recorded below.
          useGuideStore.getState().setQuickTest({
            projectId,
            runId: null,
            decision: 'pending',
            runsBefore: translationRunIdsOf(projectId),
          });
          requestGuideTranslation(
            quickTestEntryIds(useStringStore.getState().entries, activeTargets()),
          );
          break;
        }
        case 'translate-everything':
        case 'translate-few':
          translatingAll.current = true;
          useGuideStore.getState().setQuickTest(null);
          // What still needs translating: the server skips the rest anyway.
          requestGuideTranslation(
            untranslatedEntryIds(useStringStore.getState().entries, activeTargets()),
          );
          break;
        case 'translate-rest':
          // The decision is recorded with the run it produced (see below): a
          // request refused before a run exists leaves the choice on screen.
          // Untranslated only (the dialog's default), so the three already done are skipped.
          requestGuideTranslation(
            untranslatedEntryIds(useStringStore.getState().entries, activeTargets()),
          );
          break;
        case 'skip-rest': {
          // Decided, whatever was recorded: a quick test the guide never saw
          // (or reached via Back) must not leave this button doing nothing.
          const guide = useGuideStore.getState();
          if (guide.quickTest?.projectId === projectId) guide.decideQuickTest('skip');
          else if (projectId) guide.setQuickTest({ projectId, runId: null, decision: 'skip' });
          // Straight to the download (its step opens the Data tab), keeping
          // the position the facts will point at once the decision is in.
          const next = firstRunStepIndex({ ...factsRef.current, quickTestPending: false });
          const exportAt = tour.steps.findIndex((step) => step.id === 'export');
          if (exportAt >= 0) {
            setPosition({
              derived: next === 'done' ? tour.steps.length - 1 : next,
              index: exportAt,
            });
          }
          toast.success(tGuide('firstRun.rest.skipped'));
          break;
        }
        case 'tour-sections': {
          const guide = useGuideStore.getState();
          guide.finishFirstRun();
          guide.startTour(ADVANCED_SECTIONS_TOUR_ID);
          break;
        }
        case 'maybe-later':
          useGuideStore.getState().finishFirstRun();
          break;
      }
    };
    globalThis.addEventListener(FIRST_RUN_ACTION_EVENT, onAction);
    return () => globalThis.removeEventListener(FIRST_RUN_ACTION_EVENT, onAction);
  }, [cloud, stalledRunId, runQueuedBehind, projectId, tour, reportChoice, tGuide]);

  // The quick test is the position, whichever half shows: the callout's
  // choices, or Start in the dialog opened from the highlighted button (see
  // FORM_STEPS). Back from the progress step lands on that Start too.
  const positionId = tour.steps[index]?.id;
  const atQuick = positionId === 'translate-quick' || positionId === 'translate-start';
  const dialogOverQuick = atQuick && shownStep?.id === 'translate-start';

  // Entering the quick test: the table shows every entry in import order, and
  // the three to try are selected, so the checked rows are the ones on screen.
  useEffect(() => {
    if (!atQuick) return;
    translatingAll.current = false;
    const strings = useStringStore.getState();
    strings.setFilter(quickTestFilters(strings.filters));
    useSelectionStore.getState().selectAll(quickTestEntryIds(strings.entries, activeTargets()));
  }, [atQuick]);

  // The dialog opened over the quick test: the run its Start produces is the
  // quick test, known from the run list as soon as it is listed.
  useEffect(() => {
    if (!dialogOverQuick || !projectId || translatingAll.current) return;
    useGuideStore.getState().setQuickTest({
      projectId,
      runId: null,
      decision: 'pending',
      runsBefore: translationRunIdsOf(projectId),
    });
  }, [dialogOverQuick, projectId]);

  const progressIndex = tour.steps.findIndex((s) => s.id === 'translate-progress');

  // A quick test asked for (callout or dialog) whose run is now listed: record
  // it, whatever is on screen. The facts already count it (`quickTestRunId`),
  // so a run that is finished the first time it is listed goes straight to
  // "translate the rest?"; a run still going, or one that translated nothing,
  // is followed on the progress step.
  const quickTest = useGuideStore((s) => s.quickTest);
  const listedQuickRunId = useRunStore((s) =>
    quickTest?.decision === 'pending' && quickTest.runId === null
      ? quickTestRunId(quickTest, s.runs)
      : null,
  );
  const listedQuickRun = useRunStore((s) =>
    listedQuickRunId === null ? undefined : s.runs.find((r) => r.runId === listedQuickRunId),
  );
  const [followedRunId, setFollowedRunId] = useState<string | null>(null);
  if (listedQuickRunId !== null && followedRunId !== listedQuickRunId) {
    setFollowedRunId(listedQuickRunId);
    if (!translatedSomething(listedQuickRun)) {
      setPosition((p) => ({ ...p, index: progressIndex }));
    }
  }
  useEffect(() => {
    if (listedQuickRunId === null) return;
    const guide = useGuideStore.getState();
    const quick = guide.quickTest;
    if (!quick || quick.runId !== null || quick.decision !== 'pending') return;
    guide.setQuickTest({
      projectId: quick.projectId,
      runId: listedQuickRunId,
      decision: 'pending',
    });
  }, [listedQuickRunId]);
  // The quick test's run, for its progress in the callout.
  const quickRunId =
    quickTest?.decision === 'pending' && quickTest.projectId === projectId
      ? (quickTest.runId ?? listedQuickRunId)
      : null;

  // The other runs the guide asks for ("Translate everything", "Translate the
  // rest", the highlighted button pressed without the callout) are done when
  // the request produced a run: the ids listed when the step came up are the
  // baseline, and any other is new.
  const translationRunIds = useRunStore((s) =>
    s.runs
      .filter((r) => r.projectId === projectId && isTranslationRun(r))
      .map((r) => r.runId)
      .join('\n'),
  );
  const waitingFor = atQuick ? 'quick' : shownStep?.id === 'translate-rest' ? 'rest' : null;
  const runsBefore = useRef<{ for: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (waitingFor === null) {
      runsBefore.current = null;
      return;
    }
    const ids = translationRunIds ? translationRunIds.split('\n') : [];
    if (runsBefore.current?.for !== waitingFor) {
      runsBefore.current = { for: waitingFor, ids: new Set(ids) };
      return;
    }
    const known = runsBefore.current.ids;
    const fresh = ids.find((id) => !known.has(id));
    if (fresh === undefined) return;
    known.add(fresh);
    const guide = useGuideStore.getState();
    const quick = guide.quickTest;
    if (waitingFor === 'rest') {
      setGuideRunId(fresh);
      // The facts then hold the guide on this run's progress until it settles.
      if (quick) guide.setQuickTest({ ...quick, decision: 'rest', restRunId: fresh });
      return;
    }
    // A quick test asked for is recorded above.
    if (quick?.projectId === projectId && quick.decision === 'pending' && quick.runsBefore) return;
    if (quick?.projectId === projectId && quick.runId === fresh) return;
    setGuideRunId(fresh);
    if (projectId && !translatingAll.current) {
      // The highlighted button was used some other way than the dialog the
      // guide follows: the run is the entries selected for the quick test.
      guide.setQuickTest({ projectId, runId: fresh, decision: 'pending' });
    }
    // Past the steps that stand in for this one.
    setPosition((p) => ({ ...p, index: progressIndex }));
  }, [waitingFor, translationRunIds, projectId, progressIndex]);

  // While the run goes, the callout shows its progress: the run the guide
  // started, else the one the console's status line describes.
  const statusRunId = useRunStore((s) => statusLineRun(s.runs, projectId)?.runId ?? null);
  const progressRunId = quickRunId ?? guideRunId ?? statusRunId;
  // The closing step is on screen: a switch to Advanced now starts a tour.
  const atClosing = shownStep?.id === 'closing';
  useEffect(() => {
    useGuideStore.getState().setClosingShown(atClosing);
    return () => useGuideStore.getState().setClosingShown(false);
  }, [atClosing]);

  // Who translates, for the copy and the "Translated by" line.
  const guideProvider = useGuideProvider(projectId);
  const text: TourText = useMemo(() => {
    if (foundBase !== null) return { values: { provider: providerName(foundBase) } };
    if (guideProvider.kind === 'custom') return { keys: CUSTOM_ROUTING_COPY };
    if (guideProvider.kind === 'own' && guideProvider.moduleId) {
      return {
        keys: OWN_PROVIDER_COPY,
        values: { provider: providerName(guideProvider.moduleId) },
      };
    }
    return {};
  }, [foundBase, guideProvider.kind, guideProvider.moduleId]);

  const progressCard =
    shownStep?.id === 'translate-progress' && progressRunId ? (
      <RunProgressCard runId={progressRunId} variant="callout" />
    ) : undefined;
  const extra =
    progressCard ??
    (shownStep && TRANSLATED_BY_STEPS.has(shownStep.id) ? (
      <TranslatedByLine projectId={projectId} onChange={() => setCardOpen(true)} />
    ) : undefined);

  return (
    <>
      {/* The provider list and the provider card replace the callout while open. */}
      {!choiceOpen && !cardOpen && (
        <TourOverlay
          tour={tour}
          stepIndex={shownIndex}
          facts={facts}
          // No counter on a step outside the five (the closing step).
          position={shownStep?.major !== undefined ? stepPosition : undefined}
          extra={extra}
          text={text}
          onAdvance={onAdvance}
          onBack={onBack}
          onExit={onExit}
        />
      )}
      <ProviderChoice
        open={choiceOpen}
        onOpenChange={setChoiceOpen}
        cloud={cloud}
        onChosen={onProviderChosen}
      />
      {projectId && (
        <ProviderSheet projectId={projectId} open={cardOpen} onOpenChange={setCardOpen} />
      )}
    </>
  );
}
