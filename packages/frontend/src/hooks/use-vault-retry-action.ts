/**
 * `useVaultRetryAction` — encapsulates the once-guarded "deliver the result of a
 * vault-gated request exactly once across both delivery paths" idiom repeated by
 * every handler that issues an `apiRequest` with `onVaultLockedRetry`.
 *
 * The problem it solves: on a locked vault, `apiRequest` delivers the retried
 * result TWICE — once through the awaited promise (after the unlock dialog
 * replays the request) and once through the `onVaultLockedRetry` callback — so a
 * naive handler would run its success side effect (toast + refresh + close)
 * twice. Each call site hand-rolled the same `let delivered = false` guard,
 * wired `onVaultLockedRetry` to a `deliverOnce`, awaited the request, called
 * `deliverOnce(result)` again, and swallowed the 423 in the catch (the global
 * unlock dialog already shows). This hook owns all of that.
 *
 * Usage — the caller's `run` receives a handle whose `onRetry` it wires into the
 * request's `onVaultLockedRetry`, and resolves with the request's value:
 *
 * ```ts
 * const { invoke } = useVaultRetryAction<TranslateTermsResult>(
 *   ({ onRetry }) =>
 *     apiRequest<TranslateTermsResult>(url, {
 *       method: 'POST',
 *       body,
 *       onVaultLockedRetry: onRetry, // late delivery after unlock
 *     }),
 *   { onResult: (r) => reportResult(r), onError: (e) => setError(getErrorMessage(e)) },
 * );
 * ```
 *
 * `onResult` fires exactly once with the first delivered result (awaited or
 * retried, whichever lands first). A 423 `ApiError` is swallowed (no `onError`).
 * `invoke()` resolves once the request settles; it never rejects — failures go to
 * `onError`. Compose it with {@link useAsyncAction} for the busy flag: pass
 * `invoke` as the action's `fn` (it already handles the 423 + error reporting,
 * so the action's `onError` can be omitted).
 */
import { useCallback, useLayoutEffect, useRef } from 'react';
import { ApiError } from './use-api.js';

/** The handle passed to the caller's `run`; wire `onRetry` into the request. */
export interface VaultRetryHandle<R> {
  /**
   * Wire this as the request's `onVaultLockedRetry`. It delivers the retried
   * result (after the vault unlocks) through `onResult`, once.
   */
  onRetry: (result: R) => void;
}

export interface UseVaultRetryActionOptions<R> {
  /** Runs exactly once with the first delivered result (awaited or retried). */
  onResult: (result: R) => void;
  /**
   * Runs on a non-423 failure. A 423 `ApiError` is always swallowed (the global
   * unlock dialog is already shown). Omit to swallow all errors silently.
   */
  onError?: (error: unknown) => void;
}

export interface UseVaultRetryAction {
  /** Issue the action. Resolves when it settles; never rejects (see `onError`). */
  invoke: () => Promise<void>;
}

/**
 * @param run  issues the vault-gated request; wire the handle's `onRetry` into
 *             the request's `onVaultLockedRetry` and return the request's promise
 * @param opts result/error handling (see {@link UseVaultRetryActionOptions})
 */
export function useVaultRetryAction<R>(
  run: (handle: VaultRetryHandle<R>) => Promise<R>,
  opts: UseVaultRetryActionOptions<R>,
): UseVaultRetryAction {
  // Keep latest run/opts without re-creating `invoke` (handlers are inline). Synced
  // in a layout effect: not during render (react-hooks/refs forbids that), but
  // synchronously after commit and before any user event can fire `invoke`, so it
  // always sees the latest run/opts. Client-only SPA, so no SSR layout-effect concern.
  const runRef = useRef(run);
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    runRef.current = run;
    optsRef.current = opts;
  });

  const invoke = useCallback(async () => {
    // Once-guard shared by both delivery paths: the awaited result AND the
    // onVaultLockedRetry callback resolve with the same value on a locked vault.
    let delivered = false;
    const deliverOnce = (result: R) => {
      if (delivered) return;
      delivered = true;
      optsRef.current.onResult(result);
    };
    try {
      const result = await runRef.current({ onRetry: deliverOnce });
      deliverOnce(result);
    } catch (err) {
      // A 423 means the vault was locked: the unlock dialog is shown and the
      // request replays via `onRetry` above, so don't surface it.
      if (err instanceof ApiError && err.status === 423) return;
      optsRef.current.onError?.(err);
    }
  }, []);

  return { invoke };
}
