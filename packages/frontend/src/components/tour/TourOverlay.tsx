import { useOpenForeignDialog, useOpenListPopup } from '../../hooks/use-open-list-popup.js';
import { Popover } from '@base-ui/react/popover';
import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useTourAnchor } from '@/hooks/use-tour-anchor';
import type { TourPosition } from '@/lib/tour/position';
import { TOUR_SIGNAL_EVENT } from '@/lib/tour/signal';
import type { GuideFacts, Tour } from '@/lib/tour/types';
import { useViewStore } from '@/stores/view-store';
import { TourCallout, type TourText } from './TourCallout';

/**
 * Stacking: the dim layer sits at z-40 (above app content, below the z-50
 * dialogs and sheets a step may ask the person to open), the spotlight ring at
 * z-[55] and the callout at z-[60], so both stay visible above such a sheet.
 *
 * Blocking: around a spotlight the dim boxes take clicks, so only the
 * highlighted control can be used. A centred step (no anchor, or one that is
 * not on screen) has nothing to protect: its dim layer is for the eye only and
 * the sidebar, Settings and the mode switch stay usable under it.
 */
const SPOTLIGHT_PADDING = 8;

interface TourOverlayProps {
  tour: Tour;
  stepIndex: number;
  facts: GuideFacts;
  /** The counter and progress bar; none without it. */
  position?: TourPosition;
  /** Content under the callout's why text. */
  extra?: ReactNode;
  /** Copy swaps and placeholder values for the callout. */
  text?: TourText;
  /** Whether Back shows (default: on every step but the first). */
  canGoBack?: boolean;
  onAdvance: () => void;
  onBack: () => void;
  onExit: () => void;
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches;
}

/**
 * Re-renders (at most once per frame) when the window resizes, anything
 * scrolls, a transition or animation ends, the anchor or page body changes
 * size, or elements on the page change, so the rect read in render stays
 * current after layout shifts.
 */
function useLayoutTick(anchor: Element | null): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!anchor) return;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        tick();
      });
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    // An anchor inside a sheet moves with the sheet's entry transition, which
    // fires none of the above: re-read once the transition or animation ends.
    window.addEventListener('transitionend', schedule, true);
    window.addEventListener('animationend', schedule, true);
    const resizeObserver =
      typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(anchor);
    resizeObserver?.observe(document.body);
    // Content that loads above the anchor pushes it down without resizing it
    // or the page (a filter row, a banner): any change to the page's elements
    // is a reason to look again. The overlay's own writes settle in one pass,
    // because an unchanged rect writes nothing.
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden'],
    });
    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('transitionend', schedule, true);
      window.removeEventListener('animationend', schedule, true);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [anchor]);
}

export function TourOverlay({
  tour,
  stepIndex,
  facts,
  position,
  extra,
  text,
  canGoBack,
  onAdvance,
  onBack,
  onExit,
}: TourOverlayProps) {
  const { t } = useTranslation('guide-tour');
  const step = tour.steps[stepIndex];
  const titleId = useId();
  const anchor = useTourAnchor(step?.anchor ?? null);
  const clearOfControl = useTourAnchor(step?.clearOf ?? null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  // A dropdown list or menu is open: the callout steps aside so it never
  // covers the options (it comes back when the list closes).
  const listOpen = useOpenListPopup();
  const [calloutNode, setCalloutNode] = useState<HTMLElement | null>(null);
  // A dialog the person opened from the step, not the one it points into: the
  // callout steps aside for it too.
  const dialogOpen = useOpenForeignDialog(calloutNode, anchor);
  useLayoutTick(anchor);

  // Open the step's tab or view when it becomes current.
  const navigate = step?.navigate;
  // And again if the person leaves it while the step is up (a tab opened with
  // the keyboard, past the dim): the step's words are about that place.
  const shellView = useViewStore((s) => s.view);
  const activeTab = useViewStore((s) => s.activeTab);
  useEffect(() => {
    if (!navigate) return;
    const { setView, setActiveTab } = useViewStore.getState();
    if (navigate.view && navigate.view !== shellView) setView(navigate.view);
    if (navigate.tab && navigate.tab !== activeTab) setActiveTab(navigate.tab);
  }, [navigate, stepIndex, shellView, activeTab]);

  // Whatever else the step shows when it becomes current (an editor's tab).
  const onEnter = step?.onEnter;
  useEffect(() => {
    onEnter?.();
  }, [onEnter, stepIndex]);

  // The latest callbacks, so effects below don't re-run for a new function identity.
  const onAdvanceRef = useRef(onAdvance);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
    onExitRef.current = onExit;
  });

  // Escape leaves the tour, unless it was meant for something else: another
  // dialog (a sheet the tour asked the person to open), an open select or menu
  // (it closes that), a field being typed in (it cancels that: a glossary's
  // new name), or something that already handled it. Whether a popup
  // was open is read on the way down, because by the time the key bubbles up
  // the popup has usually closed itself.
  useEffect(() => {
    let forPopup = false;
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target instanceof Element ? e.target : null;
      forPopup =
        target !== null &&
        (target.closest('[role="listbox"], [role="menu"]') !== null ||
          target.getAttribute('aria-expanded') === 'true' ||
          isTextField(target));
      // Focus in the callout itself (where each step puts it): the popover
      // holding the callout swallows the key before it bubbles, so the tour
      // leaves on the way down.
      if (!forPopup && target !== null && calloutNode?.contains(target)) {
        forPopup = true;
        onExitRef.current();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || forPopup) return;
      const otherDialogOpen = Array.from(document.querySelectorAll('[role="dialog"]')).some(
        (d) => d !== calloutNode,
      );
      if (!otherDialogOpen) onExitRef.current();
    };
    document.addEventListener('keydown', onKeyCapture, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKeyCapture, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [calloutNode]);

  // A `click` step completes when the anchored control is clicked.
  const advanceKind = step?.advance.kind;
  useEffect(() => {
    if (advanceKind !== 'click' || !anchor) return;
    const onClick = () => onAdvanceRef.current();
    anchor.addEventListener('click', onClick);
    return () => anchor.removeEventListener('click', onClick);
  }, [advanceKind, anchor]);

  // Entering a step via Back: remember it, so a `state` step that is already
  // satisfied does not immediately bounce the person forward again.
  const stepKey = `${tour.id}:${stepIndex}`;
  // A click on a look-only step's control (blocked by the guard); cleared per step.
  const [lookOnlyTapped, setLookOnlyTapped] = useState(false);
  const [lookOnlyStep, setLookOnlyStep] = useState(stepKey);
  if (lookOnlyStep !== stepKey) {
    setLookOnlyStep(stepKey);
    setLookOnlyTapped(false);
  }
  // The keyboard reaches the control past the guard: Enter or Space on it is
  // stopped too, with the same note.
  const lookOnly = step?.interactive === false;
  useEffect(() => {
    if (!lookOnly || !anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const target = e.target;
      if (!(target instanceof Node) || !anchor.contains(target)) return;
      e.preventDefault();
      e.stopPropagation();
      setLookOnlyTapped(true);
    };
    globalThis.addEventListener('keydown', onKey, true);
    return () => globalThis.removeEventListener('keydown', onKey, true);
  }, [lookOnly, anchor]);
  const [nav, setNav] = useState({
    key: stepKey,
    index: stepIndex,
    backKey: null as string | null,
  });
  if (nav.key !== stepKey) {
    setNav({ key: stepKey, index: stepIndex, backKey: stepIndex < nav.index ? stepKey : null });
  }
  const enteredViaBack = nav.key === stepKey && nav.backKey === stepKey;

  // A `state` step completes on the rising edge of its condition, once per
  // (tour, step): the guard re-arms whenever the condition goes false. Rule for
  // Back: a `state` step entered via Back with its condition already true does
  // not auto-advance (that would undo Back); it shows Next instead, and a later
  // false -> true edge advances as usual.
  const stateDone = step?.advance.kind === 'state' && step.advance.done(facts);
  const advancedKey = useRef<string | null>(null);
  const seenKey = useRef<string | null>(null);
  useEffect(() => {
    const justEntered = seenKey.current !== stepKey;
    seenKey.current = stepKey;
    if (!stateDone) {
      advancedKey.current = null;
      return;
    }
    if (advancedKey.current === stepKey) return;
    advancedKey.current = stepKey;
    if (justEntered && enteredViaBack) return;
    onAdvanceRef.current();
  }, [stateDone, stepKey, enteredViaBack]);

  // Focus moves to the callout on each step, or to the control itself when it
  // is a field to type in (the vault password, the key, the project name) or
  // sits in a popup or dialog: a popover closes when focus leaves it (the
  // project list), and a modal pulls focus back anyway.
  useEffect(() => {
    if (anchor && isTextField(anchor)) anchor.focus();
    else if (anchor instanceof HTMLElement && isInPopup(anchor, calloutNode)) anchor.focus();
    else calloutNode?.focus();
  }, [calloutNode, stepIndex, anchor]);

  // A control below the fold of a scrolling area is brought into view: the
  // dim covers the page and takes the wheel, so the person could not scroll to it.
  useEffect(() => {
    if (anchor instanceof HTMLElement)
      anchor.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [anchor, stepKey]);

  // A Next that waits for a control (see `TourAdvance`).
  const nextNeeds = step?.advance.kind === 'next' ? (step.advance.needs ?? null) : null;
  const neededControl = useTourAnchor(nextNeeds);
  const nextBlockedBy = step?.advance.kind === 'next' ? (step.advance.blockedBy ?? null) : null;
  const blockingControl = useTourAnchor(nextBlockedBy);
  // A double click on Next is one Next: its second click lands on the next
  // step's Next, which the person never saw, and would skip that step.
  const onNext = (e?: { detail?: number }) => {
    if ((e?.detail ?? 1) > 1) return;
    onAdvance();
  };

  // A `next` step that moves on when the app reports its deed (see `TourAdvance`).
  const awaitedSignal =
    step?.advance.kind === 'next' ? (step.advance.advanceOnSignal ?? null) : null;
  useEffect(() => {
    if (awaitedSignal === null) return;
    const onSignal = (e: Event) => {
      if ((e as CustomEvent<string>).detail === awaitedSignal) onAdvanceRef.current();
    };
    globalThis.addEventListener(TOUR_SIGNAL_EVENT, onSignal);
    return () => globalThis.removeEventListener(TOUR_SIGNAL_EVENT, onSignal);
  }, [awaitedSignal, stepKey]);

  if (!step) return null;

  const motion = reduced ? '' : 'transition-all duration-200 motion-reduce:transition-none';
  const calloutProps = {
    // A step whose words describe its control says something else while that
    // control is not on screen.
    step: anchor === null && step.absentWhatKey ? { ...step, whatKey: step.absentWhatKey } : step,
    titleId,
    position,
    extra: lookOnlyTapped ? (
      <>
        {extra}
        {/* A look-only control was clicked: say why nothing happened. */}
        <p className="text-xs font-medium text-status-warn" data-testid="tour-look-only-note">
          {t('lookOnly')}
        </p>
      </>
    ) : (
      extra
    ),
    text,
    showBack: canGoBack ?? stepIndex > 0,
    showNext:
      (step.advance.kind === 'next' &&
        blockingControl === null &&
        (nextNeeds === null ||
          neededControl !== null ||
          enteredViaBack ||
          step.advance.unlessDone?.(facts) === true)) ||
      (step.advance.kind === 'manual' &&
        enteredViaBack &&
        step.advance.nextOnBack?.(facts) === true) ||
      (stateDone && enteredViaBack),
    onNext,
    onBack,
    onExit,
  };
  const title = t(step.titleKey);

  const rect = anchor?.getBoundingClientRect();
  // Extra distance so the callout lands beyond `clearOf` (on the step's side).
  const clearRect = clearOfControl?.getBoundingClientRect();
  const side = step.side ?? 'bottom';
  const clearOffset =
    !rect || !clearRect
      ? 0
      : Math.max(
          0,
          side === 'top'
            ? rect.top - clearRect.top
            : side === 'bottom'
              ? clearRect.bottom - rect.bottom
              : side === 'left'
                ? rect.left - clearRect.left
                : clearRect.right - rect.right,
        );
  const hole = rect && {
    left: Math.max(0, rect.left - SPOTLIGHT_PADDING),
    top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
  const dimBase = `fixed z-40 bg-background/70 ${motion}`;

  // A list or dialog the person opened from the step is up: the callout and
  // the ring leave it alone until it closes (removed, not faded, so no piece
  // of either lingers over it).
  const steppedAside = listOpen || dialogOpen;

  return (
    <div data-testid="tour-overlay">
      <div role="status" aria-live="polite" className="sr-only" data-testid="tour-live-region">
        {title}
      </div>
      {step.dim === false ? (
        hole && (
          <div
            data-testid="tour-spotlight"
            // Out of the way, with the callout, while a list or dialog opened
            // from the step is up: the ring would cut across its options.
            data-stepped-aside={steppedAside || undefined}
            className={`pointer-events-none fixed z-[55] rounded-md ring-2 ring-ring data-[stepped-aside]:hidden ${motion}`}
            style={px(hole)}
          />
        )
      ) : hole ? (
        <>
          {[
            { left: 0, top: 0, width: '100vw', height: hole.top },
            { left: 0, top: hole.top + hole.height, width: '100vw', height: '100vh' },
            { left: 0, top: hole.top, width: hole.left, height: hole.height },
            { left: hole.left + hole.width, top: hole.top, width: '100vw', height: hole.height },
          ].map((box, i) => (
            <div
              key={i}
              aria-hidden="true"
              data-testid="tour-dim"
              className={`pointer-events-auto ${dimBase}`}
              style={px(box)}
            />
          ))}
          {step.interactive === false && (
            // Look, don't touch: the hole takes clicks like the dim around it.
            // At z-40 it covers in-page anchors only: an anchor inside a z-50
            // sheet or dialog sits above it and stays clickable.
            <div
              aria-hidden="true"
              data-testid="tour-hole-guard"
              // Shown, not offered: the cursor says so, and a click says why.
              className="pointer-events-auto fixed z-40 cursor-not-allowed"
              style={px(hole)}
              onClick={() => setLookOnlyTapped(true)}
            />
          )}
          <div
            data-testid="tour-spotlight"
            // Out of the way, with the callout, while a list or dialog opened
            // from the step is up: the ring would cut across its options.
            data-stepped-aside={steppedAside || undefined}
            className={`pointer-events-none fixed z-[55] rounded-md ring-2 ring-ring data-[stepped-aside]:hidden ${motion}`}
            style={px(hole)}
          />
        </>
      ) : (
        // A centred callout leaves the page usable, except on a look-only
        // step (`interactive: false`): the page waits, as during a change
        // the tour is making.
        <div
          aria-hidden="true"
          data-testid="tour-dim"
          className={`${step.interactive === false ? 'pointer-events-auto' : 'pointer-events-none'} ${dimBase} inset-0`}
          style={{ left: 0, top: 0, width: '100vw', height: '100vh' }}
        />
      )}
      {anchor ? (
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Positioner
              anchor={anchor}
              side={side}
              align="start"
              sideOffset={SPOTLIGHT_PADDING + 8 + clearOffset}
              collisionPadding={12}
              {...(step.overlap
                ? {
                    collisionAvoidance: { side: 'shift', align: 'shift', fallbackAxisSide: 'none' },
                  }
                : {})}
              positionMethod="fixed"
              className="z-[60]"
            >
              <Popover.Popup
                ref={setCalloutNode}
                initialFocus={false}
                tabIndex={-1}
                role="dialog"
                aria-labelledby={titleId}
                data-testid="tour-callout"
                data-step-id={step.id}
                data-stepped-aside={steppedAside || undefined}
                className="w-[min(24rem,calc(100vw-2rem))] data-[stepped-aside]:hidden rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
              >
                <TourCallout {...calloutProps} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <div
          ref={setCalloutNode}
          tabIndex={-1}
          role="dialog"
          aria-labelledby={titleId}
          data-testid="tour-callout"
          data-step-id={step.id}
          data-stepped-aside={steppedAside || undefined}
          className="data-[stepped-aside]:hidden fixed top-1/2 left-1/2 z-[60] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
        >
          <TourCallout {...calloutProps} />
        </div>
      )}
    </div>
  );
}

/** Inside a popup or dialog other than the callout itself. */
function isInPopup(el: Element, callout: Element | null): boolean {
  const popup = el.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-side]');
  return popup !== null && popup !== callout && !popup.contains(callout);
}

/** A control the person types in: focus goes there rather than to the callout. */
function isTextField(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return !el.disabled;
  if (!(el instanceof HTMLInputElement) || el.disabled) return false;
  return ![
    'button',
    'checkbox',
    'radio',
    'submit',
    'reset',
    'file',
    'hidden',
    'image',
    'range',
    'color',
  ].includes(el.type);
}

type Box = { left: number; top: number; width: number | string; height: number | string };

function px(b: Box): React.CSSProperties {
  return { left: b.left, top: b.top, width: b.width, height: b.height };
}
