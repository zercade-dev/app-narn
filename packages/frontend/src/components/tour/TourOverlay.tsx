import { Popover } from '@base-ui/react/popover';
import { useEffect, useId, useReducer, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useTourAnchor } from '@/hooks/use-tour-anchor';
import type { GuideFacts, Tour } from '@/lib/tour/types';
import { useViewStore } from '@/stores/view-store';
import { TourCallout } from './TourCallout';

/**
 * Stacking: the dim layer sits at z-40 (above app content, below the z-50
 * dialogs and sheets a step may ask the person to open), the spotlight ring at
 * z-[55] and the callout at z-[60], so both stay visible above such a sheet.
 */
const SPOTLIGHT_PADDING = 8;

interface TourOverlayProps {
  tour: Tour;
  stepIndex: number;
  facts: GuideFacts;
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

/** Re-renders when the window resizes or anything scrolls, so the rect read in render stays current. */
function useLayoutTick(active: boolean): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!active) return;
    window.addEventListener('resize', tick);
    window.addEventListener('scroll', tick, true);
    return () => {
      window.removeEventListener('resize', tick);
      window.removeEventListener('scroll', tick, true);
    };
  }, [active]);
}

export function TourOverlay({
  tour,
  stepIndex,
  facts,
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
  useLayoutTick(anchor !== null);

  // Open the step's tab or view when it becomes current.
  const navigate = step?.navigate;
  useEffect(() => {
    if (!navigate) return;
    const { setView, setActiveTab } = useViewStore.getState();
    if (navigate.view) setView(navigate.view);
    if (navigate.tab) setActiveTab(navigate.tab);
  }, [navigate, stepIndex]);

  // Escape leaves the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onExit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onExit]);

  // A `click` step completes when the anchored control is clicked.
  const advanceKind = step?.advance.kind;
  useEffect(() => {
    if (advanceKind !== 'click' || !anchor) return;
    anchor.addEventListener('click', onAdvance);
    return () => anchor.removeEventListener('click', onAdvance);
  }, [advanceKind, anchor, onAdvance]);

  // A `state` step completes when the app state says so.
  const advance = step?.advance;
  useEffect(() => {
    if (advance?.kind === 'state' && advance.done(facts)) onAdvance();
  }, [advance, facts, onAdvance]);

  // Focus moves to the callout on each step.
  useEffect(() => {
    calloutNode?.focus();
  }, [calloutNode, stepIndex]);

  if (!step) return null;

  const motion = reduced ? '' : 'transition-all duration-200 motion-reduce:transition-none';
  const calloutProps = {
    step,
    titleId,
    showBack: stepIndex > 0,
    showNext: step.advance.kind === 'next',
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
  const dimClass = `pointer-events-auto fixed z-40 bg-background/70 ${motion}`;

  return (
    <div data-testid="tour-overlay">
      <div role="status" aria-live="polite" className="sr-only" data-testid="tour-live-region">
        {title}
      </div>
      {hole ? (
        <>
          {[
            { left: 0, top: 0, width: '100vw', height: hole.top },
            { left: 0, top: hole.top + hole.height, width: '100vw', height: '100vh' },
            { left: 0, top: hole.top, width: hole.left, height: hole.height },
            { left: hole.left + hole.width, top: hole.top, width: '100vw', height: hole.height },
          ].map((box, i) => (
            <div key={i} data-testid="tour-dim" className={dimClass} style={px(box)} />
          ))}
          <div
            data-testid="tour-spotlight"
            className={`pointer-events-none fixed z-[55] rounded-md ring-2 ring-ring ${motion}`}
            style={px(hole)}
          />
        </>
      ) : (
        <div
          data-testid="tour-dim"
          className={`${dimClass} inset-0`}
          style={{ left: 0, top: 0, width: '100vw', height: '100vh' }}
        />
      )}
      {anchor ? (
        <Popover.Root open>
          <Popover.Portal>
            <Popover.Positioner
              anchor={anchor}
              side="bottom"
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
          className="fixed top-1/2 left-1/2 z-[60] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none"
        >
          <TourCallout {...calloutProps} />
        </div>
      )}
    </div>
  );
}

type Box = { left: number; top: number; width: number | string; height: number | string };

function px(b: Box): React.CSSProperties {
  return { left: b.left, top: b.top, width: b.width, height: b.height };
}
