/**
 * `useAsyncAction` — the busy-flag + try/finally + toast idiom shared by the many
 * "do something async on click" handlers across the app (save description, apply
 * suggestions, kick off a run, …).
 *
 * It owns a `busy` flag (raised before the work, lowered in `finally`), reports
 * failures with `toast.error(errorMessage(err, opts.errorFallback))`, and — when
 * `opts.successMessage` is set — shows `toast.success` after the work resolves.
 *
 * Composability with the vault-retry flow: a handler that issues a vault-gated
 * `apiRequest` should pass `opts.onError`. It runs FIRST, before the default
 * toast, and may early-return for a 423 so the locked-vault case is silent (the
 * global unlock dialog is already shown). Return `true`/any value from `onError`
 * to suppress the default `toast.error`; return `false`/`undefined`/nothing to
 * let it fire. Pair it with {@link useVaultRetryAction} for the full pattern:
 *
 * ```ts
 * const vault = useVaultRetryAction(run, { onResult: report });
 * const { run: onClick, busy } = useAsyncAction(vault.invoke, {
 *   errorFallback: t('runFailed'),
 *   // onError is rarely needed here: invoke() already swallows the 423 and routes
 *   // other failures to its own onError. Provide it only for errors invoke()
 *   // re-raises (it never re-raises in practice — it resolves and never rejects).
 * });
 * ```
 *
 * IMPORTANT when composing with {@link useVaultRetryAction}: put the SUCCESS side
 * effect (toast/refresh/close) in the vault hook's `onResult`, NOT in this hook's
 * `successMessage`. `invoke()` swallows a 423 and resolves cleanly, so a
 * `successMessage` here would fire even on a locked vault (before the queued retry
 * has run, or if it later fails) — a success toast that lies. `onResult` runs only
 * on a real delivered result, exactly once.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/utils.js';
import { toast } from '../lib/toast.js';

export interface UseAsyncActionOptions {
  /** Localized fallback message when the thrown value is not an `Error`. */
  errorFallback: string;
  /** Shown via `toast.success` after the action resolves. Omit for no toast. */
  successMessage?: string;
  /**
   * Runs before the default error toast. Return a truthy value to suppress the
   * default `toast.error` (e.g. a 423 already handled by the unlock dialog);
   * return falsy/nothing to let it fire.
   */
  onError?: (error: unknown) => boolean | void;
}

export interface UseAsyncAction {
  /** Fire the action. A no-op while a previous invocation is still in flight. */
  run: () => void;
  /** True from just before the work starts until it settles. */
  busy: boolean;
}

/**
 * @param fn   the async work to run on `run()`
 * @param opts error/success messaging (see {@link UseAsyncActionOptions})
 */
export function useAsyncAction(
  fn: () => Promise<void>,
  opts: UseAsyncActionOptions,
): UseAsyncAction {
  const [busy, setBusy] = useState(false);
  // Re-entrancy guard read synchronously: `busy` state lags a tick, so a double
  // click within the same frame would otherwise launch the work twice.
  const runningRef = useRef(false);

  // Keep the latest fn/opts without re-creating `run` (and re-triggering callers'
  // memo deps) every render — handlers are typically inline closures. The refs are
  // synced in a layout effect: not during render (react-hooks/refs forbids that),
  // but synchronously after commit and BEFORE the browser paints / any user event
  // can fire `run`, so `run` always sees the latest fn/opts (no passive-flush
  // staleness window). Client-only SPA, so no SSR layout-effect concern.
  const fnRef = useRef(fn);
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    fnRef.current = fn;
    optsRef.current = opts;
  });

  const run = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    void (async () => {
      try {
        await fnRef.current();
        const { successMessage } = optsRef.current;
        if (successMessage !== undefined) toast.success(successMessage);
      } catch (err) {
        const { onError, errorFallback } = optsRef.current;
        // onError runs first and may suppress the default toast (e.g. a 423 the
        // global unlock dialog already handles) by returning a truthy value.
        const handled = onError?.(err);
        if (!handled) toast.error(errorMessage(err, errorFallback));
      } finally {
        runningRef.current = false;
        setBusy(false);
      }
    })();
  }, []);

  return { run, busy };
}
