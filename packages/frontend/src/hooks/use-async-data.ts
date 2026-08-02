/**
 * `useAsyncData` — the dependency-scoped, stale-guarded mount fetch shared by the
 * app's "load data for the current X, re-load when X changes" views. Generalizes
 * `components/orphans/use-project-scoped-fetch.ts` from a single `projectId` to an
 * arbitrary dependency list and hands the fetcher an `AbortSignal` so an in-flight
 * request is cancelled when the deps change or the component unmounts.
 *
 * On mount and on every `deps` change the effect raises `loading` and re-fetches.
 * The reset is a plain `setLoading(true)` at the top of the effect (not a
 * render-phase compare-and-setState): it is independent of the fetch result, so it
 * cannot cause the cascading render `react-hooks/set-state-in-effect` guards
 * against (only the fetcher's `setData`/`setLoading(false)` run after the awaited
 * request, never synchronously). Keeping it in the effect — rather than comparing
 * deps in render — also means a caller passing an unstable, fresh-every-render dep
 * degrades to extra fetches (the normal `useEffect` failure mode) instead of a
 * "Too many re-renders" crash.
 *
 * A response is applied only when it is the latest in-flight request (a per-run
 * stale guard) and its `AbortSignal` is not aborted, so a slow fetch from a prior
 * dep-set can never clobber newer data. `reload()` re-runs the fetcher for the
 * current deps, abandoning any earlier in-flight request.
 *
 * @param fetcher loads the data; receives an `AbortSignal` aborted on dep change/unmount
 * @param deps    re-runs the fetcher (and resets `loading`) when these change
 * @param opts    `initial` data + optional `onError` (defaults to swallowing)
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface UseAsyncDataOptions<T> {
  /** Data value before the first load resolves (and the value kept on error). */
  initial: T;
  /** Handle a failed fetch (e.g. toast). Defaults to swallowing the error. */
  onError?: (error: unknown) => void;
}

export interface UseAsyncData<T> {
  /** Latest loaded data, or `initial` before the first/failed load resolves. */
  data: T;
  /** True until the current (or a deps-change) load resolves. */
  loading: boolean;
  /** Re-run the fetcher for the current deps, abandoning any in-flight request. */
  reload: () => void;
}

export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList,
  opts: UseAsyncDataOptions<T>,
): UseAsyncData<T> {
  const [data, setData] = useState<T>(opts.initial);
  const [loading, setLoading] = useState(true);

  // Keep the latest fetcher/onError off the effect deps so only `deps` (and an
  // explicit reload) drive a re-fetch — matching the call sites where the fetcher
  // is an inline closure recreated every render. Synced in a layout effect: not
  // during render (react-hooks/refs forbids that), but synchronously after commit
  // and before the fetch effect below re-runs / `reload` can be invoked, so both
  // see the latest fetcher/onError. Client-only SPA, so no SSR layout-effect concern.
  const fetcherRef = useRef(fetcher);
  const onErrorRef = useRef(opts.onError);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
    onErrorRef.current = opts.onError;
  });

  // Monotonic token identifying the most recent load. A response is applied only
  // when its token still matches — guards against an out-of-order resolve from a
  // superseded request (deps changed, or reload() fired) clobbering newer data.
  const runIdRef = useRef(0);
  // The in-flight request's controller, aborted when a new load supersedes it.
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const runId = ++runIdRef.current;
    void (async () => {
      try {
        const result = await fetcherRef.current(controller.signal);
        if (runId !== runIdRef.current) return; // superseded
        setData(result);
      } catch (err) {
        if (runId !== runIdRef.current || controller.signal.aborted) return;
        onErrorRef.current?.(err);
      } finally {
        if (runId === runIdRef.current) setLoading(false);
      }
    })();
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    // Raise loading and (re-)fetch on mount and whenever `deps` change. Unlike a
    // render-phase reset, an unconditional `setLoading(true)` here can never
    // self-trigger a re-render loop on unstable deps (it doesn't change the dep
    // array), so a caller passing a fresh-every-render dep gets extra fetches —
    // the standard useEffect failure mode — not a "Too many re-renders" crash.
    // This plain reset is independent of the fetch result, so it can't cause the
    // cascading render `react-hooks/set-state-in-effect` guards against; load()
    // only calls setData/setLoading(false) after the awaited fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load();
    return () => {
      // Abandon and cancel the in-flight request on unmount / before a re-run.
      // Reading the LIVE refs here is intentional: we want to bump whatever token
      // is current and abort whatever controller is in flight at cleanup time, not
      // a value captured when the effect ran (the lint hint assumes a DOM-node ref).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      runIdRef.current++;
      controllerRef.current?.abort();
    };
    // `deps` is the intended trigger; `load` is stable. The exhaustive-deps rule
    // can't see through the spread, so it is listed explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { data, loading, reload };
}
