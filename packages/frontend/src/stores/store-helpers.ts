/**
 * Shared helpers for Zustand store actions.
 *
 * Most async store actions share one envelope: reset `error` (and optionally
 * flip a `loading` flag) before the request, run it, clear `loading` on
 * success, and on failure record `getErrorMessage(err)` into `error` —
 * sometimes re-throwing for the caller, sometimes swallowing. {@link runAction}
 * collapses that boilerplate while preserving each action's exact
 * loading/error/throw behaviour through its options.
 */
import type { StoreApi } from 'zustand';
import { getErrorMessage } from '../lib/utils.js';

/**
 * A Zustand `set` for a store whose state carries an `error: string | null`
 * field (and, for the `loading` option, a `loading: boolean` field). Matches the
 * setter Zustand hands store creators: a partial state patch.
 */
type ErrorSetter<S extends { error: string | null }> = StoreApi<S>['setState'];

/**
 * Casts a state patch to `Partial<S>`. `S` is only constrained to carry `error`,
 * so a patch that touches `loading` (set solely for stores that opt in via
 * `opts.loading`, which by contract have a `loading: boolean` field) doesn't
 * provably overlap `Partial<S>`. This narrows the unavoidable cast to one place
 * rather than scattering `as` across the envelope.
 */
function asPatch<S extends { error: string | null }>(patch: Record<string, unknown>): Partial<S> {
  return patch as Partial<S>;
}

/**
 * Wraps an async store action in the common
 * `set({ error: null[, loading: true] }); try { … } catch { set({ error, …}) }`
 * envelope.
 *
 * - Always resets `error` to `null` before running `fn`.
 * - With `opts.loading`, flips `loading` to `true` before and back to `false`
 *   on both success and failure.
 * - On failure records `getErrorMessage(err)` into `error`; re-throws only when
 *   `opts.rethrow` is set, otherwise resolves to `undefined`.
 *
 * @returns the resolved value of `fn`, or `undefined` when `fn` rejected and
 *   `opts.rethrow` was not set.
 */
export async function runAction<S extends { error: string | null }, T>(
  set: ErrorSetter<S>,
  fn: () => Promise<T>,
  opts?: { rethrow?: boolean; loading?: boolean },
): Promise<T | undefined> {
  set(asPatch<S>({ error: null, ...(opts?.loading ? { loading: true } : {}) }));
  try {
    const result = await fn();
    if (opts?.loading) set(asPatch<S>({ loading: false }));
    return result;
  } catch (err) {
    set(
      asPatch<S>({
        ...(opts?.loading ? { loading: false } : {}),
        error: getErrorMessage(err),
      }),
    );
    if (opts?.rethrow) throw err;
    return undefined;
  }
}

/**
 * Minimal shape {@link mutateThenRefresh} needs from a run-store `get()`: the
 * runs refresh and the polling starter. Declared structurally so the helper
 * stays decoupled from the full `RunStore` interface.
 */
interface RunRefreshGetters {
  fetchRuns: (projectId: string) => Promise<void>;
  startPolling: (projectId: string) => void;
}

/**
 * The run-store mutation envelope: reset `error`, run `fn` (a mutating request),
 * then `await get().fetchRuns(projectId)` and — when `opts.poll` is set —
 * `get().startPolling(projectId)` so the run's progress is observed. The refresh
 * and the optional poll run only after `fn` succeeds, exactly as the
 * hand-written actions did.
 *
 * On failure records `getErrorMessage(err)` into `error`; re-throws only when
 * `opts.rethrow` is set (matching the actions that surface it to the caller),
 * otherwise resolves to `undefined` (matching the actions that swallow it).
 *
 * @returns the resolved value of `fn`, or `undefined` when `fn` rejected and
 *   `opts.rethrow` was not set.
 */
export async function mutateThenRefresh<S extends { error: string | null }, T>(
  set: ErrorSetter<S>,
  get: () => RunRefreshGetters,
  projectId: string,
  fn: () => Promise<T>,
  opts?: { poll?: boolean; rethrow?: boolean },
): Promise<T | undefined> {
  set(asPatch<S>({ error: null }));
  try {
    const result = await fn();
    await get().fetchRuns(projectId);
    if (opts?.poll) get().startPolling(projectId);
    return result;
  } catch (err) {
    set(asPatch<S>({ error: getErrorMessage(err) }));
    if (opts?.rethrow) throw err;
    return undefined;
  }
}
