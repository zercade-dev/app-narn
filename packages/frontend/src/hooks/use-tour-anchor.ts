import { useCallback, useRef, useSyncExternalStore } from 'react';

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
        if (cache.el?.isConnected && isVisible(cache.el)) return;
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
    return () => {
      observer.disconnect();
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
