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
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const [calloutNode, setCalloutNode] = useState<HTMLElement | null>(null);
  useLayoutTick(anchor);

  // Open the step's tab or view when it becomes current.
  const navigate = step?.navigate;
  useEffect(() => {
    if (!navigate) return;
    const { setView, setActiveTab } = useViewStore.getState();
    if (navigate.view) setView(navigate.view);
    if (navigate.tab) setActiveTab(navigate.tab);
  }, [navigate, stepIndex]);

  // The latest callbacks, so effects below don't re-run for a new function identity.
  const onAdvanceRef = useRef(onAdvance);
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onAdvanceRef.current = onAdvance;
    onExitRef.current = onExit;
  });

  // Escape leaves the tour, unless it was meant for something else: another
  // dialog (a sheet the tour asked the person to open), an open select or menu
  // (it closes that), or something that already handled it. Whether a popup
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
          target.getAttribute('aria-expanded') === 'true');
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

  // Focus moves to the callout on each step, or to the field the step asks
  // the person to type in (the vault password, the key, the project name).
  useEffect(() => {
    if (anchor && isTextField(anchor)) anchor.focus();
    else calloutNode?.focus();
  }, [calloutNode, stepIndex, anchor]);

  // A Next that waits for a control (see `TourAdvance`).
  const nextNeeds = step?.advance.kind === 'next' ? (step.advance.needs ?? null) : null;
  const neededControl = useTourAnchor(nextNeeds);
  // A `next` step that moves on when a control appears (see `TourAdvance`).
  const appearAnchor =
    step?.advance.kind === 'next' ? (step.advance.advanceOnAppear ?? null) : null;
  const appeared = useTourAnchor(appearAnchor) !== null;
  const wasAbsent = useRef<string | null>(null);
  const appearStepKey = useRef<string | null>(null);
  useEffect(() => {
    // A new step forgets an absence seen on an earlier visit, so re-entering
    // via Back with the control already there never moves on by itself.
    if (appearStepKey.current !== stepKey) {
      appearStepKey.current = stepKey;
      wasAbsent.current = null;
    }
    if (appearAnchor === null) return;
    if (!appeared) {
      wasAbsent.current = stepKey;
      return;
    }
    if (wasAbsent.current !== stepKey) return;
    wasAbsent.current = null;
    onAdvanceRef.current();
  }, [appeared, appearAnchor, stepKey]);

  if (!step) return null;

  const motion = reduced ? '' : 'transition-all duration-200 motion-reduce:transition-none';
  const calloutProps = {
    step,
    titleId,
    position,
    extra,
    text,
    showBack: canGoBack ?? stepIndex > 0,
    showNext:
      (step.advance.kind === 'next' &&
        (nextNeeds === null ||
          neededControl !== null ||
          enteredViaBack ||
          step.advance.unlessDone?.(facts) === true)) ||
      (step.advance.kind === 'manual' &&
        enteredViaBack &&
        step.advance.nextOnBack?.(facts) === true) ||
      (stateDone && enteredViaBack),
    onNext: onAdvance,
    onBack,
    onExit,
  };
  const title = t(step.titleKey);

  const rect = anchor?.getBoundingClientRect();
  const hole = rect && {
    left: Math.max(0, rect.left - SPOTLIGHT_PADDING),
    top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };
  const dimBase = `fixed z-40 bg-background/70 ${motion}`;

  return (
    <div data-testid="tour-overlay">
      <div role="status" aria-live="polite" className="sr-only" data-testid="tour-live-region">
        {title}
      </div>
      {step.dim === false ? (
        hole && (
          <div
            data-testid="tour-spotlight"
            className={`pointer-events-none fixed z-[55] rounded-md ring-2 ring-ring ${motion}`}
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
              className="pointer-events-auto fixed z-40"
              style={px(hole)}
            />
          )}
          <div
            data-testid="tour-spotlight"
            className={`pointer-events-none fixed z-[55] rounded-md ring-2 ring-ring ${motion}`}
            style={px(hole)}
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          data-testid="tour-dim"
          className={`pointer-events-none ${dimBase} inset-0`}
          style={{ left: 0, top: 0, width: '100vw', height: '100vh' }}
        />
      )}
      {anchor ? (
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Positioner
              anchor={anchor}
              side={step.side ?? 'bottom'}
              align="start"
              sideOffset={SPOTLIGHT_PADDING + 8}
              collisionPadding={12}
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
                className="w-[min(24rem,calc(100vw-2rem))] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
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
          className="fixed top-1/2 left-1/2 z-[60] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
        >
          <TourCallout {...calloutProps} />
        </div>
      )}
    </div>
  );
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
