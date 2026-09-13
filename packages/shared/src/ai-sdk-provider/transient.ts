/**
 * Transient-error utilities shared by the background-AI review paths (judge,
 * source-review, glossary-suggest, category-classify). A transient error is one
 * worth retrying — a 429, a request timeout, a 5xx, or a network reset — as
 * opposed to an auth failure (not retryable) or a user cancel (terminal).
 *
 * These live in their own module (not core.ts) so the classification can be
 * unit-tested in isolation; they import only the low-level error helpers from
 * core.ts, so there is no import cycle (core.ts imports back from here only for
 * function bodies executed at call time).
 */
import {
  toRateLimitError,
  toAuthError,
  extractSafeErrorMetadata,
  unwrapRetryError,
} from './core.js';
import { toErrorMessage } from '../error-utils.js';

/** Generous default per-request timeout (5 minutes) for every provider call. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 300_000;

/**
 * A request that exceeded its configured timeout. `name` is `'TimeoutError'` so
 * {@link isTransientError} classifies it as transient (retryable) deterministically,
 * regardless of how the underlying SDK surfaces an aborted-by-timeout call.
 */
export class RequestTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`request timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/** Whether an error is a user/cancel abort (NOT a timeout — those are transient). */
export function isAbortLikeError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === 'AbortError' ||
      err.message === 'cancelled' ||
      err.message === 'The user aborted a request.'
    );
  }
  return err === 'cancelled';
}

/**
 * A single request rejected as too big for the provider to accept at all — HTTP
 * 413, or (when a provider reports its token-budget rejection without a
 * structured 413, e.g. Groq's TPM cap) message wording naming the request/
 * payload/message as too large. Unlike a 429 (too many requests — splitting
 * one request into two makes that WORSE) or a 401/403 (same credential fails
 * every half identically), a too-large rejection is exactly the case
 * {@link splitAndRetry}'s halving already exists to fix: a smaller batch is a
 * smaller request, which is the direct remedy for "this request is too big."
 * @internal exported for unit-testing
 */
export const PAYLOAD_TOO_LARGE_MESSAGE_RE =
  /request too large|payload too large|reduce your message size|message size and try again|context length exceeded|maximum context length/i;

/**
 * Whether an error should be retried. True for 429s, timeouts, 5xx, payload-
 * too-large rejections, and network resets; false for auth (401/403) and
 * aborts/cancels. Best-effort: an unclassifiable error returns false so the
 * caller's existing non-transient path (record-as-error) runs unchanged.
 */
export function isTransientError(err: unknown): boolean {
  if (isAbortLikeError(err)) return false;
  if (toAuthError(err)) return false;
  if (toRateLimitError(err)) return true; // 429 (carries Retry-After)
  // Unwrap the AI SDK retry envelope so a wrapped 5xx's status is visible.
  const meta = extractSafeErrorMetadata(unwrapRetryError(err));
  const status = Number(meta.providerStatus);
  if (Number.isFinite(status) && status >= 500 && status <= 599) return true;
  if (status === 413) return true;
  const name = typeof meta.errorName === 'string' ? meta.errorName : '';
  const message = toErrorMessage(err);
  if (name === 'TimeoutError' || /timed?\s*out|etimedout|esockettimedout/i.test(message)) {
    return true;
  }
  if (PAYLOAD_TOO_LARGE_MESSAGE_RE.test(message)) return true;
  return /econnreset|econnrefused|eai_again|enotfound|fetch failed|socket hang up/i.test(message);
}

/**
 * Delay (ms) before a transient retry. Honors a provider `retryAfterMs` (from the
 * shared RateLimitError) when present; otherwise jittered exponential backoff
 * `baseMs * 2 ** attempt` ±20%. Mirrors the server's M9 `retryDelayMs`.
 */
export function transientRetryDelayMs(err: unknown, attempt: number, baseMs = 1000): number {
  const rl = toRateLimitError(err);
  if (
    rl &&
    typeof rl.retryAfterMs === 'number' &&
    Number.isFinite(rl.retryAfterMs) &&
    rl.retryAfterMs > 0
  ) {
    return Math.round(rl.retryAfterMs);
  }
  const base = baseMs * 2 ** attempt;
  const jitter = 1 + (Math.random() * 0.4 - 0.2);
  return Math.round(base * jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `fn`; if it throws a transient error (and `signal` is not aborted), wait a
 * backoff and retry exactly once. Auth/cancel errors and a second failure
 * propagate. Used by the chunk-and-skip review loops (glossary, category), which
 * have no batch to split — so they get the "retry once" half of the strategy.
 */
export async function retryOnceOnTransient<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  baseMs = 1000,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (signal?.aborted || !isTransientError(err)) throw err;
    await sleep(transientRetryDelayMs(err, 0, baseMs));
    return fn();
  }
}

/**
 * Combine the caller's cancel signal (if any) with a fresh timeout signal so a
 * provider call is bounded. The result aborts when EITHER fires. Callers keep
 * their ORIGINAL signal for cancel checks, so a timeout (transient) is never
 * mistaken for a user cancel (terminal).
 */
export function combineAbortSignals(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
