import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/lib/toast';
import {
  useFirstRunActive,
  useGuideEntriesReady,
  useGuideFacts,
  type GuideFacts,
} from '../../hooks/use-guide-facts.js';
import { useIsMobile } from '../../hooks/use-mobile-viewport.js';
import { useTourAnchor } from '../../hooks/use-tour-anchor.js';
import { useUiMode } from '../../hooks/use-ui-mode.js';
import { goToVaultSetup } from '../../lib/auth-redirect.js';
import { enableProvider, GOOGLE_KEY_URL } from '../../lib/simple-provider.js';
import {
  FIRST_RUN_ACTION_EVENT,
  FIRST_RUN_FORM_ANCHORS,
  firstRunShownIndex,
  firstRunStepIndex,
  firstRunTourFor,
  type FirstRunAction,
} from '../../lib/tour/first-run.js';
import { getErrorMessage } from '../../lib/utils.js';
import { vaultEditorOpenEvent, vaultLockedEvent } from '../../lib/vault-events.js';
import { useGuideStore } from '../../stores/guide-store.js';
import { useProjectStore } from '../../stores/project-store.js';
import { useUiSettings } from '../../stores/ui-settings-store.js';
import { useVaultStore } from '../../stores/vault-store.js';
import { ProviderChoice } from './ProviderChoice.js';
import { TourOverlay } from './TourOverlay.js';

const GOOGLE_KEY = 'GOOGLE_API_KEY';

interface FirstRunTourProps {
  /** Something that comes first is on screen (the first-run theme chooser). */
  suspended: boolean;
}

/**
 * The guided first run, mounted once in the app shell. Shows nothing in
 * Advanced, once skipped or finished, for a collaborator-only person, while
 * `suspended`, or on phone widths: there the sidebar is an off-canvas drawer
 * and the string list has no bulk controls, so most anchors are unreachable.
 */
export function FirstRunTour({ suspended }: FirstRunTourProps) {
  const active = useFirstRunActive();
  const simple = useUiMode() === 'simple';
  const finished = useGuideStore((s) => s.firstRunFinished);
  const facts = useGuideFacts();
  const isMobile = useIsMobile();
  const projectsLoaded = useProjectStore((s) => s.loaded);
  // Also while skipped, so "Continue setup: step N of 5" counts imported strings.
  const entriesReady = useGuideEntriesReady(simple && !finished && !facts.isCollaboratorOnly);

  // Latched: the vault store's `loading` also covers later actions (unlocking,
  // saving a key), which must not hide the guide again.
  const vaultStatusSettled = useVaultStore((s) => s.statusFetched && !s.loading);
  const [vaultKnown, setVaultKnown] = useState(vaultStatusSettled);
  if (vaultStatusSettled && !vaultKnown) setVaultKnown(true);

  if (!active || suspended || isMobile || !projectsLoaded || !vaultKnown || !entriesReady) {
    return null;
  }
  return <ActiveFirstRunTour facts={facts} />;
}

function ActiveFirstRunTour({ facts }: { facts: GuideFacts }) {
  const tour = firstRunTourFor(facts);
  const resumeAt = firstRunStepIndex(facts);
  const derived = resumeAt === 'done' ? tour.steps.length - 1 : resumeAt;

  // The step follows the facts: whenever they point somewhere else (a key was
  // saved, the vault locked, the project was deleted) the guide goes there.
  // In between, Next / Back / a click on the highlighted control move it.
  const [position, setPosition] = useState({ derived, index: derived });
  if (position.derived !== derived) setPosition({ derived, index: derived });
  const index = position.derived === derived ? position.index : derived;

  // "Open the form" / "use the form" sub-steps follow the form itself.
  const [vaultFormAnchor, keyEditorAnchor] = FIRST_RUN_FORM_ANCHORS;
  const vaultFormOpen = useTourAnchor(vaultFormAnchor) !== null;
  const keyEditorOpen = useTourAnchor(keyEditorAnchor) !== null;
  const shown = useCallback(
    (at: number) =>
      firstRunShownIndex(tour, at, (anchor) =>
        anchor === vaultFormAnchor ? vaultFormOpen : keyEditorOpen,
      ),
    [tour, vaultFormAnchor, vaultFormOpen, keyEditorOpen],
  );
  const shownIndex = shown(index);

  const lastIndex = tour.steps.length - 1;
  const move = useCallback(
    (delta: 1 | -1) => {
      let target = Math.max(0, Math.min(lastIndex, shownIndex + delta));
      // Next from "open the form" with the form closed: the other half of the
      // pair would show this same step again, so go past it.
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

  useEffect(() => {
    const onAction = (e: Event) => {
      switch ((e as CustomEvent<FirstRunAction>).detail) {
        case 'open-vault':
          globalThis.dispatchEvent(vaultLockedEvent({}));
          break;
        case 'cloud-vault':
          goToVaultSetup({ guided: true });
          break;
        case 'get-google-key':
          globalThis.open(GOOGLE_KEY_URL, '_blank', 'noopener,noreferrer');
          break;
        case 'add-google-key':
          globalThis.dispatchEvent(vaultEditorOpenEvent({ focusKey: GOOGLE_KEY }));
          break;
        case 'own-provider':
          setChoiceOpen(true);
          break;
        case 'switch-advanced':
          useUiSettings.getState().setUiMode('advanced');
          useGuideStore.getState().finishFirstRun();
          break;
        case 'finish':
          useGuideStore.getState().finishFirstRun();
          break;
      }
    };
    globalThis.addEventListener(FIRST_RUN_ACTION_EVENT, onAction);
    return () => globalThis.removeEventListener(FIRST_RUN_ACTION_EVENT, onAction);
  }, []);

  // Google path: once a Google key is usable, enable the provider so Freeway
  // can use it. Runs on the transition (the key was just saved or the vault
  // just unlocked), or straight away while there is no project yet (the
  // return from the cloud vault page is a fresh page load, not a transition).
  // Idempotent on the server; at most once per mount here.
  const googleKeyUsable = useVaultStore((s) => s.unlocked && s.keys.includes(GOOGLE_KEY));
  const ownProviderChosen = useGuideStore((s) => s.simpleProvider !== null);
  const projectExists = facts.projectExists;
  const usableAtMount = useRef(googleKeyUsable);
  const googleEnabled = useRef(false);
  useEffect(() => {
    if (!googleKeyUsable) {
      usableAtMount.current = false;
      return;
    }
    if (ownProviderChosen || googleEnabled.current) return;
    if (usableAtMount.current && projectExists) return;
    googleEnabled.current = true;
    void enableProvider('google').catch((err: unknown) => {
      googleEnabled.current = false;
      toast.error(getErrorMessage(err));
    });
  }, [googleKeyUsable, ownProviderChosen, projectExists]);

  const onProviderChosen = useCallback(
    ({ vaultKey }: { vaultKey: string | undefined }) => {
      setChoiceOpen(false);
      const { unlocked, keys } = useVaultStore.getState();
      // Already usable: the facts move the guide on by themselves.
      if (!vaultKey || (unlocked && keys.includes(vaultKey))) return;
      if (cloud) {
        goToVaultSetup({ guided: true });
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
