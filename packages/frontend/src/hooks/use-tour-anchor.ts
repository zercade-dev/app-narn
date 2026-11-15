import { useCallback, useRef, useSyncExternalStore } from 'react';

/** How often a missing anchor is looked for again (see `subscribe`). */
const ANCHOR_POLL_MS = 250;

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function resolve(id: string | null): Element | null {
  if (!id) return null;
  const el = document.querySelector(`[data-tour="${id.replaceAll('"', '\\"')}"]`);
  return el && isVisible(el) ? el : null;
}

interface AnchorCache {
  id: string | null;
  el: Element | null;
  /** Set by a frame-coalesced change; the next snapshot re-queries. */
  dirty: boolean;
}

/**
 * The visible element carrying `data-tour="<id>"`, or null when there is none.
 * Re-resolves (at most once per animation frame) when the DOM changes or the
 * window resizes or scrolls, so a tour can wait for a control that mounts
 * later. While the current anchor is still connected and visible, nothing is re-queried.
 */
export function useTourAnchor(id: string | null): Element | null {
  const cacheRef = useRef<AnchorCache>({ id: null, el: null, dirty: true });

  const subscribe = useCallback((onChange: () => void) => {
    const cache = cacheRef.current;
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        // A connected, still-visible anchor stays and nothing is queried; one
        // that is missing, detached or hidden (display:none, inactive panel)
        // is dropped and looked up again.
        // It must also still carry the anchor's name: the attribute can move
        // to another element (the console's progress when it opens).
        if (
          cache.el?.isConnected &&
          isVisible(cache.el) &&
          cache.el.getAttribute('data-tour') === cache.id
        ) {
          return;
        }
        cache.dirty = true;
        onChange();
      });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour'],
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    // An anchor can be revealed or hidden without a mutation the observer
    // sees (a class or style change): look again on a slow tick. A held,
    // still-visible anchor makes this a no-op (see `schedule`).
    const poll = setInterval(schedule, ANCHOR_POLL_MS);
    return () => {
      observer.disconnect();
      clearInterval(poll);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const getSnapshot = () => {
    const cache = cacheRef.current;
    if (cache.dirty || cache.id !== id) {
      cache.id = id;
      cache.el = resolve(id);
      cache.dirty = false;
    }
    return cache.el;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
