import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

interface ProjectScopedFetch<T> {
  /** Latest loaded data (or the initial value before the first load resolves). */
  data: T;
  /** Replace the data directly (for optimistic updates). */
  setData: Dispatch<SetStateAction<T>>;
  /** True until the first (or a project-change) load resolves. */
  loading: boolean;
  /** Raise the loading flag manually (e.g. before an explicit refresh). */
  setLoading: Dispatch<SetStateAction<boolean>>;
  /**
   * Re-run the fetcher. `isStale` lets the mount effect ignore a response that
   * landed after the project changed; explicit callers omit it (never stale).
   */
  reload: (isStale?: () => boolean) => Promise<void>;
}

interface Options<T> {
  /**
   * Side effect run after a successful fetch (the result is already stored in
   * `data`) — e.g. reconciling dependent state such as a selection set.
   */
  onLoad?: (result: T) => void;
  /** Handle a failed fetch (e.g. toast). Defaults to swallowing the error. */
  onError?: (err: unknown) => void;
}

/**
 * The project-scoped reload idiom shared by the Orphans and Backup tabs:
 * a stale-guarded fetcher, a render-phase reset that raises the loading flag
 * when the project changes, and a mount effect with a `stale` cleanup. The
 * fetcher's setState only runs after the awaited request resolves, so it cannot
 * cause the cascading render `react-hooks/set-state-in-effect` guards against —
 * the loading flag is raised in the render phase, not the effect.
 *
 * @param projectId  the active project; a change resets loading and re-fetches
 * @param fetcher    loads the data for `projectId`
 * @param initial    initial data value before the first load
 */
export function useProjectScopedFetch<T>(
  projectId: string,
  fetcher: (projectId: string) => Promise<T>,
  initial: T,
  options: Options<T> = {},
): ProjectScopedFetch<T> {
  const { onLoad, onError } = options;
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(
    async (isStale: () => boolean = () => false) => {
      try {
        const result = await fetcher(projectId);
        if (isStale()) return;
        setData(result);
        onLoad?.(result);
      } catch (err) {
        if (!isStale()) onError?.(err);
      } finally {
        if (!isStale()) setLoading(false);
      }
    },
    [projectId, fetcher, onLoad, onError],
  );

  // Reset the loading flag during render when the project changes; the effect
  // below re-fetches. Keeps the synchronous setState out of the effect.
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setLoading(true);
  }

  useEffect(() => {
    let stale = false;
    // reload() only calls setState after the awaited fetch resolves (never
    // synchronously), so it can't cause the cascading render the rule guards
    // against; the loading flag is raised in the render phase above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(() => stale);
    return () => {
      stale = true;
    };
  }, [reload]);

  return { data, setData, loading, setLoading, reload };
}
