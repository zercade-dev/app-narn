import * as React from 'react';

// Matches Tailwind's default `md` breakpoint (768px): below it the rail is
// hidden and navigation moves into the off-canvas Sheet. Below this
// breakpoint the app also switches to its read-only mobile presentation.
export const MOBILE_BREAKPOINT = 768;

/** True while the viewport is below the `md` breakpoint (max-width: 767px). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT,
  );
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    // Subscribe only — the initial value is read synchronously by the lazy
    // useState initializer above, so no setState in the effect body.
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}
