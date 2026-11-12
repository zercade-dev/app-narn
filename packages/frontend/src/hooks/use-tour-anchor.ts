import { useCallback, useSyncExternalStore } from 'react';

function isVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function resolve(id: string | null): Element | null {
  if (!id) return null;
  const el = document.querySelector(`[data-tour="${id.replaceAll('"', '\\"')}"]`);
  return el && isVisible(el) ? el : null;
}

/**
 * The visible element carrying `data-tour="<id>"`, or null when there is none.
 * Re-resolves when the DOM changes (elements added or removed, the attribute
 * set) and on window resize and scroll, so a tour can wait for a control that
 * mounts later.
 */
export function useTourAnchor(id: string | null): Element | null {
  const subscribe = useCallback((onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-tour'],
    });
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => resolve(id),
    () => null,
  );
}
