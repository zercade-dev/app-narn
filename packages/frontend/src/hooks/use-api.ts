/**
 * Centralised API fetch utility.
 * Wraps fetch with base URL, JSON serialization, error parsing, and AbortController timeout.
 */

import { redirectTo } from '../lib/auth-redirect.js';
import { downloadBlob, randomId } from '../lib/utils.js';
import {
  vaultLockedEvent,
  vaultRetryFinishedEvent,
  vaultRetryStartedEvent,
} from '../lib/vault-events.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wires up the vault-unlock retry flow for a 423 response, shared by every `/api`
 * helper (request + download). Dispatches the `vault:locked` event with a `retry`
 * thunk that replays `reissue()` after the vault unlocks, brackets that replay
 * with the `vault:retry-started`/`vault:retry-finished` events, and — when
 * `onResult` is provided — returns a promise settling with the replay's value so
 * the caller can await the retried result.
 *
 * Without `onResult` the replay is fire-and-forget: the caller still throws the
 * 423 and observes the retry via the events / its own callback, so a failing
 * replay never raises `unhandledrejection` (no awaiter is wired). Returns the
 * awaitable promise when `onResult` is set, else `null`.
 *
 * `reissue` re-runs the original operation (already stripped of the vault-retry
 * control keys) and resolves with whatever value the caller wants delivered
 * through `onResult` — the parsed JSON for `apiRequest`, `undefined` for
 * `apiDownload` (whose side effect is the file save).
 */
function handleVaultLocked<R>(
  reissue: () => Promise<R>,
  vaultRetryKey: string | undefined,
  onResult: ((result: R) => void) | undefined,
): Promise<R> | null {
  const retryId = randomId();
  // Only the callback path awaits the retry's value, so only it gets a settleable
  // promise. The callback-less "drive the unlock dialog only" path runs `retry()`
  // purely for its side effects (events + callback); wiring it to a discarded,
  // rejectable promise would trip `unhandledrejection` whenever the retry fails.
  let resolveRetry: ((value: R) => void) | null = null;
  let rejectRetry: ((reason?: unknown) => void) | null = null;
  const retryResult = onResult
    ? new Promise<R>((resolve, reject) => {
        resolveRetry = resolve;
        rejectRetry = reject;
      })
    : null;

  const retry = async () => {
    globalThis.dispatchEvent(vaultRetryStartedEvent({ retryId, vaultRetryKey }));
    let succeeded = false;
    try {
      const result = await reissue();
      succeeded = true;
      onResult?.(result);
      resolveRetry?.(result);
    } catch (retryError) {
      rejectRetry?.(retryError);
      throw retryError;
    } finally {
      globalThis.dispatchEvent(vaultRetryFinishedEvent({ retryId, vaultRetryKey, succeeded }));
    }
  };
  globalThis.dispatchEvent(vaultLockedEvent({ retry, retryId, vaultRetryKey }));
  // With a callback, the caller awaits the retry's result via `retryResult`.
  // Without one (the "drive the unlock dialog only" path, e.g. ReviewTab), the
  // caller throws the 423 while `retry()` runs independently and delivers its
  // outcome through `onResult` / the vault:retry-* events.
  return retryResult;
}

/**
 * Reads the JSON `{ error }` body of a failed (`!ok`) response into an
 * {@link ApiError}, shared by every `/api` helper so error shapes stay identical.
 *
 * Returns the error AND whether the body actually parsed. The two are reported
 * separately because the vault-retry (423) flow must run ONLY when the body
 * parsed — matching the pre-refactor `apiRequest`, where the `vault:locked`
 * dispatch sat inside the same `try` as `response.json()`, so an unparseable 423
 * body skipped the retry and just threw `ApiError(status, 'HTTP <status>')`.
 *
 * Parsing rules mirror the original exactly: the message is `body.error` only
 * when it is truthy (a present-but-empty `error: ''` still falls back to
 * `HTTP <status>`); on a parse failure the error carries NO `data`.
 */
async function readApiError(response: Response): Promise<{ error: ApiError; parsed: boolean }> {
  const fallback = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: string };
    const message = body.error ? body.error : fallback;
    return { error: new ApiError(response.status, message, body), parsed: true };
  } catch {
    return { error: new ApiError(response.status, fallback), parsed: false };
  }
}

/**
 * Sets up the abort/timeout plumbing shared by the `/api` helpers: a fresh
 * controller aborted by either a `timeout` or the caller's `externalSignal`.
 * Returns the controller's signal and a `cleanup` to run in `finally` (clears
 * the timer and detaches the external-abort listener).
 */
function withTimeout(
  timeout: number,
  externalSignal: AbortSignal | null | undefined,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort(externalSignal.reason);
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

/**
 * Single-flight `POST /auth/refresh`: at the hourly access-token rollover an
 * active SPA fires many parallel `/api` calls (run-polling, lists, SSE
 * reconnects) that all 401 at once. Without dedup each would independently POST
 * `/auth/refresh` against the SAME rotating `narn_refresh` cookie; the identity
 * provider rotates
 * the refresh token on first use, so the racers present an already-rotated token
 * and fail — logging out an active user. `inflightRefresh` funnels every
 * concurrent caller onto ONE in-flight refresh; the rest await its result.
 *
 * Uses a RAW fetch — never `apiRequest` — so its own 401 cannot recurse through
 * the interceptor below. 2xx → true (session refreshed), anything else → false.
 * Same-origin POST so the open-core CSRF guard (origin/referer) is satisfied.
 */
let inflightRefresh: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      const res = await fetch('/auth/refresh', { method: 'POST' });
      return res.ok;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

export async function apiRequest<T>(
  urlPath: string,
  options?: RequestInit & {
    timeout?: number;
    onVaultLockedRetry?: (result: T) => void;
    vaultRetryKey?: string;
    /** Internal: set on the single post-refresh replay so 401 retries once. */
    __authRetried?: boolean;
  },
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    onVaultLockedRetry,
    vaultRetryKey,
    // Destructured out so it is NOT spread into `fetchOptions` (not a RequestInit
    // field); the 401 branch below reads it to cap the post-refresh replay at one.
    __authRetried,
    ...fetchOptions
  } = options ?? {};

  const { signal, cleanup } = withTimeout(timeout, externalSignal);

  try {
    const headers: Record<string, string> = {};
    // Only set Content-Type for non-FormData bodies
    if (!(fetchOptions.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`/api${urlPath}`, {
      ...fetchOptions,
      signal,
      headers: {
        ...headers,
        ...(fetchOptions.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const { error: err, parsed } = await readApiError(response);
      // Only drive the vault-unlock retry on a 423 whose body parsed — the
      // pre-refactor code dispatched `vault:locked` inside the JSON-parse `try`,
      // so an unparseable 423 body never reached this branch.
      if (response.status === 423 && parsed) {
        // Re-issue the original request minus the vault-retry control keys,
        // preserving the caller's timeout and abort signal.
        const retryOptions = { ...fetchOptions, timeout, signal: externalSignal };
        const retryResult = handleVaultLocked<T>(
          () => apiRequest<T>(urlPath, retryOptions),
          vaultRetryKey,
          onVaultLockedRetry,
        );
        // With a callback, await the retry's result. Without one (the "drive the
        // unlock dialog only" path, e.g. ReviewTab), fall through and throw the
        // 423 while the queued retry runs independently.
        if (retryResult) return retryResult;
      }
      // Cloud-mode session expiry: the server returns 401 with body
      // `{ error: 'unauthenticated' }` ONLY when there is no/expired identity.
      // Open-core's own 401s (invalid-password, "Vault is locked", …) carry
      // different bodies and skip this branch, so it is inert there. 423
      // vault-locked is a logged-in state handled above — never here.
      const errorCode = (err.data as { error?: string } | undefined)?.error;
      if (response.status === 401 && parsed && errorCode === 'unauthenticated') {
        // Try to refresh the session once, then replay the ORIGINAL request once.
        // `__authRetried` guards against a second pass (no infinite loop); the
        // refresh call itself is a raw fetch, so it never re-enters this logic.
        // Replay the ORIGINAL request after a successful refresh, re-spreading the
        // caller's full `options` (incl. their `signal` AND the vault-retry
        // callbacks) — intentional, and unlike the 423 path's explicit
        // `signal: externalSignal`: the 401 replay is the same logical request, so
        // it must honor the caller's abort + onVaultLockedRetry/vaultRetryKey
        // exactly. `__authRetried: true` caps it at a single retry (no loop).
        if (!__authRetried && (await refreshSession())) {
          return apiRequest<T>(urlPath, { ...(options ?? {}), __authRetried: true });
        }
        // Refresh failed, or the single retry still came back unauthenticated.
        redirectTo('/login');
        throw err;
      }
      // Cloud vault with no enrolled device: the server returns 428
      // `{ error: 'device-not-enrolled' }` on a mutating route. Send the user to
      // the cloud enrollment page. No auto-retry — enrollment is a user action.
      // Open-core never sends 428, so this is inert there.
      if (response.status === 428 && parsed && errorCode === 'device-not-enrolled') {
        redirectTo('/vault');
        throw err;
      }
      throw err;
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  } finally {
    cleanup();
  }
}

/**
 * Downloads a file from a GET `/api` endpoint and saves it via {@link downloadBlob}.
 * Mirrors {@link apiRequest}'s `/api` base, `!ok` JSON-error parsing, abort/timeout
 * plumbing, and 423 vault-unlock retry flow — so a locked-vault download replays
 * after unlock just like a request and the saved file lands without a manual retry.
 *
 * `opts.onResponse` is invoked with the live {@link Response} BEFORE the body is
 * read, so callers can read response headers (e.g. `X-Export-Roundtrip-Warnings`)
 * while still streaming the blob. It fires on the original successful response and,
 * on a 423, again on the retried response after unlock.
 *
 * The download's "result" is the side effect (the file save), so the vault-retry
 * callback carries no value: on a 423 the retried download runs and saves the file
 * itself, then the original call rejects with the 423 — callers swallow it exactly
 * as they do for {@link apiRequest} (`err instanceof ApiError && err.status === 423`).
 */
export async function apiDownload(
  urlPath: string,
  filename: string,
  opts?: {
    timeout?: number;
    signal?: AbortSignal;
    onResponse?: (res: Response) => void;
    vaultRetryKey?: string;
  },
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    onResponse,
    vaultRetryKey,
  } = opts ?? {};

  const { signal, cleanup } = withTimeout(timeout, externalSignal);

  try {
    const response = await fetch(`/api${urlPath}`, { signal });

    if (!response.ok) {
      const { error: err, parsed } = await readApiError(response);
      // Mirror apiRequest: only drive the vault-unlock retry on a 423 whose body
      // parsed as the `{ error }` lock payload.
      if (response.status === 423 && parsed) {
        // Replay the download (not a JSON request) after unlock so the retried
        // response is saved and its headers reach `onResponse` too.
        const retryResult = handleVaultLocked<void>(
          () => apiDownload(urlPath, filename, { timeout, signal: externalSignal, onResponse }),
          vaultRetryKey,
          // The retry is purely a side effect (the file save); there is no value
          // to deliver, so no result callback — keep it fire-and-forget and let
          // the original call reject with the 423 (callers swallow it).
          undefined,
        );
        if (retryResult) return retryResult;
      }
      throw err;
    }

    // Hand the caller the response (headers available) before the body is read.
    onResponse?.(response);
    downloadBlob(await response.blob(), filename);
  } finally {
    cleanup();
  }
}
