import { useCallback, useEffect, useRef, useState } from 'react';
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
import { isTranslationRun } from '../../lib/run-kind.js';
import { statusLineRun } from '../../lib/run-status-line.js';
import {
  FREE_KEY_PROVIDERS,
  GOOGLE_KEY_URL,
  providerInstanceId,
  providerKeyFor,
} from '../../lib/simple-provider.js';
import {
  FIRST_RUN_ACTION_EVENT,
  FIRST_RUN_FORM_ANCHORS,
  FIRST_RUN_TOUR_ID,
  firstRunShownIndex,
  firstRunStepIndex,
  firstRunTourFor,
  type FirstRunAction,
} from '../../lib/tour/first-run.js';
import { ADVANCED_SECTIONS_TOUR_ID } from '../../lib/tour/advanced-sections.js';
import { tourPosition } from '../../lib/tour/position.js';
import {
  isTranslatableEntry,
  QUICK_TEST_SIZE,
  quickTestEntryIds,
  quickTestFilters,
  requestGuideTranslation,
  translatableEntryIds,
  untranslatedEntryIds,
} from '../../lib/tour/quick-test.js';
import { getErrorMessage } from '../../lib/utils.js';
import { vaultEditorOpenEvent, vaultLockedEvent } from '../../lib/vault-events.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useRunStore } from '../../stores/run-store.js';
import { useSelectionStore } from '../../stores/selection-store.js';
import { useStringStore } from '../../stores/string-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { RunProgressCard } from '../runs/RunProgressCard.js';
import { ProviderChoice } from './ProviderChoice.js';
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

/** `{ key }` for the vault page when the person chose their own provider. */
function chosenKey(): { key?: string } {
  const own = useGuideStore.getState().simpleProvider;
  const key = own ? providerKeyFor(own) : undefined;
  return key ? { key } : {};
}

function ActiveFirstRunTour({ facts }: { facts: GuideFacts }) {
  // Three entries or fewer: the quick test would be everything, so no choice.
  const fewEntries = useStringStore(
    (s) => s.entries.filter(isTranslatableEntry).length <= QUICK_TEST_SIZE,
  );
  const tour = firstRunTourFor(facts, { fewEntries });
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
  const [vaultFormAnchor, keyEditorAnchor] = FIRST_RUN_FORM_ANCHORS;
  const vaultFormOpen = useTourAnchor(vaultFormAnchor) !== null;
  const keyEditorOpen = useTourAnchor(keyEditorAnchor) !== null;
  const stalled = useFirstRunStall();
  // "Try again" sets the failed run aside, so the guide does not show its
  // failure again while the new run has not been listed yet.
  const [retriedRunId, setRetriedRunId] = useState<string | null>(null);
  const runStall = stalled && stalled.runId !== retriedRunId ? stalled.stall : null;
  const shown = useCallback(
    (at: number) =>
      firstRunShownIndex(tour, at, {
        isOnScreen: (anchor) => (anchor === vaultFormAnchor ? vaultFormOpen : keyEditorOpen),
        runStall,
      }),
    [tour, vaultFormAnchor, vaultFormOpen, keyEditorOpen, runStall],
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
      while (delta > 0 && target < lastIndex && shown(target) <= shownIndex) target += 1;
      setPosition((p) => ({ ...p, index: target }));
    },
    [lastIndex, shownIndex, shown],
  );
  const onAdvance = useCallback(() => move(1), [move]);
  const onBack = useCallback(() => move(-1), [move]);
  const onExit = useCallback(() => useGuideStore.getState().dismissFirstRun(), []);

  const [choiceOpen, setChoiceOpen] = useState(false);
  const cloud = facts.cloud;
  const stalledRunId = stalled?.runId ?? null;
  const runQueuedBehind = stalled?.queuedBehind ?? false;
  const projectId = useProjectStore((state) => state.activeProjectId);

  // The run the guide asked for (its progress shows in the callout).
  const [guideRunId, setGuideRunId] = useState<string | null>(null);

  useEffect(() => {
    const startAgain = () => {
      // Entries from the failed attempt are usually still selected: go straight
      // to the button that needs them, not to a ticked "select all".
      const selected = useSelectionStore.getState().selectedIds.size > 0;
      const target = selected ? 'translate-selected' : 'select-all';
      const at = tour.steps.findIndex((step) => step.id === target);
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
        case 'fix-key': {
          if (cloud) {
            goToVaultSetup();
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
          // The run id is filled in once the run is listed (see below).
          useGuideStore.getState().setQuickTest({ projectId, runId: null, decision: 'pending' });
          requestGuideTranslation(quickTestEntryIds(useStringStore.getState().entries));
          break;
        }
        case 'translate-everything':
        case 'translate-few':
          useGuideStore.getState().setQuickTest(null);
          requestGuideTranslation(translatableEntryIds(useStringStore.getState().entries));
          break;
        case 'translate-rest': {
          useGuideStore.getState().decideQuickTest('rest');
          const project = useProjectStore.getState().projects.find((p) => p.id === projectId);
          const targets = (project?.activeLanguages ?? []).filter(
            (lang) => lang !== project?.sourceLanguage,
          );
          // Untranslated only (the dialog's default), so the three already done are skipped.
          requestGuideTranslation(untranslatedEntryIds(useStringStore.getState().entries, targets));
          break;
        }
        case 'skip-rest':
          useGuideStore.getState().decideQuickTest('skip');
          break;
        case 'maybe-later':
          useGuideStore.getState().finishFirstRun();
          break;
      }
    };
    globalThis.addEventListener(FIRST_RUN_ACTION_EVENT, onAction);
    return () => globalThis.removeEventListener(FIRST_RUN_ACTION_EVENT, onAction);
  }, [cloud, stalledRunId, runQueuedBehind, projectId, tour]);

  // Entering the quick test: the table shows every entry in import order, and
  // the three to try are selected, so the checked rows are the ones on screen.
  const atQuick = shownStep?.id === 'translate-quick';
  useEffect(() => {
    if (!atQuick) return;
    const strings = useStringStore.getState();
    strings.setFilter(quickTestFilters(strings.filters));
    useSelectionStore.getState().selectAll(quickTestEntryIds(strings.entries));
  }, [atQuick]);

  // The quick test and "Start the translation" are done when the request
  // produced a run: the ids listed when the step came up are the baseline,
  // and any other is new.
  const translationRunIds = useRunStore((s) =>
    s.runs
      .filter((r) => r.projectId === projectId && isTranslationRun(r))
      .map((r) => r.runId)
      .join('\n'),
  );
  const waitingFor = atQuick ? 'quick' : shownStep?.id === 'translate-start' ? 'start' : null;
  const runsBefore = useRef<Set<string> | null>(null);
  const progressIndex = tour.steps.findIndex((s) => s.id === 'translate-progress');
  useEffect(() => {
    if (waitingFor === null) {
      runsBefore.current = null;
      return;
    }
    const ids = translationRunIds ? translationRunIds.split('\n') : [];
    if (runsBefore.current === null) {
      runsBefore.current = new Set(ids);
      return;
    }
    const known = runsBefore.current;
    const fresh = ids.find((id) => !known.has(id));
    if (fresh === undefined) return;
    setGuideRunId(fresh);
    if (waitingFor === 'start') {
      onAdvance();
      return;
    }
    const quick = useGuideStore.getState().quickTest;
    if (quick?.projectId === projectId && quick.decision === 'pending' && quick.runId === null) {
      useGuideStore.getState().setQuickTest({ ...quick, runId: fresh });
    }
    // Past the "Try again" steps that stand in for this one.
    setPosition((p) => ({ ...p, index: progressIndex }));
  }, [waitingFor, translationRunIds, onAdvance, projectId, progressIndex]);

  // While the run goes, the callout shows its progress: the run the guide
  // started, else the one the console's status line describes.
  const statusRunId = useRunStore((s) => statusLineRun(s.runs, projectId)?.runId ?? null);
  const progressRunId = guideRunId ?? statusRunId;
  const extra =
    shownStep?.id === 'translate-progress' && progressRunId ? (
      <RunProgressCard runId={progressRunId} variant="callout" />
    ) : undefined;

  // The closing step is on screen: a switch to Advanced now starts a tour.
  const atClosing = shownStep?.id === 'closing';
  useEffect(() => {
    useGuideStore.getState().setClosingShown(atClosing);
    return () => useGuideStore.getState().setClosingShown(false);
  }, [atClosing]);

  const onProviderChosen = useCallback(
    ({ base, vaultKey }: { base: string; vaultKey: string | undefined }) => {
      // Remembered first: in cloud the next thing may be a trip to the vault
      // page, and the provider is enabled when the person comes back.
      useGuideStore.getState().setSimpleProvider(providerInstanceId(base));
      setChoiceOpen(false);
      const { unlocked, keys } = useVaultStore.getState();
      // Already usable: the facts move the guide on by themselves.
      if (!vaultKey || (unlocked && keys.includes(vaultKey))) return;
      if (cloud) {
        goToVaultSetup({ guided: true, key: vaultKey });
        return;
      }
      globalThis.dispatchEvent(vaultEditorOpenEvent({ focusKey: vaultKey }));
    },
    [cloud],
  );

  return (
    <>
      {/* The provider list replaces the callout while it is open. */}
      {!choiceOpen && (
        <TourOverlay
          tour={tour}
          stepIndex={shownIndex}
          facts={facts}
          // No counter on a step outside the five (the closing step).
          position={shownStep?.major !== undefined ? stepPosition : undefined}
          extra={extra}
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
    </>
  );
}
