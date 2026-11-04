import { useEffect, useState } from 'react';
import { apiRequest } from './use-api.js';

interface FreewayStatusLike {
  buckets?: Array<{ state?: string }>;
}

/**
 * Whether NARN Freeway can serve work for this user right now: at least one
 * free-tier bucket that has a credential and is not disabled (cooling or
 * exhausted buckets still count; they refill). Best-effort: false while the
 * status loads or if it cannot be read, so callers fall back to a real module.
 */
export function useFreewayUsable(options?: { enabled?: boolean }): boolean {
  const enabled = options?.enabled ?? true;
  const [usable, setUsable] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void apiRequest<FreewayStatusLike>('/freeway/status')
      .then((res) => {
        if (cancelled) return;
        const buckets = Array.isArray(res?.buckets) ? res.buckets : [];
        setUsable(buckets.some((b) => b.state !== 'uncredentialed' && b.state !== 'disabled'));
      })
      .catch(() => {
        /* non-critical: stay on the first capable module */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return usable;
}
