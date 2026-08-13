/**
 * Error-classification helpers for the M9 TranslationEngine retry logic.
 */
import { AUTH_401_MESSAGE_RE, RATE_LIMIT_MESSAGE_RE } from '@zercade-dev/narn-shared';

/**
 * Whether an error message signals an auth/authorization failure. Reuses the
 * canonical shared 401 vocabulary (the single source of truth, kept aligned
 * with the AI SDK provider layer) and composes the 403/forbidden/permission-
 * denied additions on top, since a few modules surface auth failures only as a
 * downgraded `error` string rather than a structured AuthError.
 */
const AUTH_MESSAGE_RE = new RegExp(
  `${AUTH_401_MESSAGE_RE.source}|\\b403\\b|forbidden|permission[\\s_-]*denied`,
  'i',
);

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A {@link sleep} that resolves early when `signal` aborts, so a cancelled
 * run doesn't stay parked in the backoff. Resolves (never rejects) on abort —
 * the {@link withRateLimitRetry} loop re-checks cancellation right after and
 * throws {@link CancelledError} itself, so there's no unhandled rejection to
 * chase. The timer and the abort listener are always torn down (whichever
 * fires first clears the other), so neither leaks. With no `signal`, or an
 * already finite short delay, it behaves exactly like {@link sleep}.
 */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Upper bound on an honored provider `Retry-After`. A hostile or broken BYOK
 * endpoint returning `Retry-After: 3600` would otherwise park a slot in the
 * process-global, cross-tenant queue for an hour; the delay is clamped to
 * this so a single tenant can't monopolize a slot on a provider's say-so.
 */
export const MAX_RETRY_AFTER_MS = 60_000;

/**
 * A provider-supplied `retryAfterMs`, clamped to {@link MAX_RETRY_AFTER_MS} so a
 * hostile or broken endpoint cannot sideline a free-tier bucket beyond a minute
 * on its own say-so. Absent ⇒ the caller's own fallback (for a Freeway cooldown,
 * the bucket's next day-scale reset).
 */
export function retryAfterMsOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null || !('retryAfterMs' in err)) return undefined;
  const value = (err as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(Math.round(value), MAX_RETRY_AFTER_MS);
}

/**
 * Floor for a rate limit the provider named as per-MINUTE but sent without a
 * `Retry-After`. Just over a minute, so the window has certainly rolled over.
 */
export const PER_MINUTE_RATE_LIMIT_COOLDOWN_MS = 70_000;

/**
 * A rate limit the provider named as per-MINUTE ("...-per-min",
 * "requests per minute"). Word-bounded on BOTH sides so a camelCase quota name
 * that merely contains the letters — `RequestsPerMinutePerProject` — is not
 * read as a minute-scale limit.
 */
const PER_MINUTE_LIMIT_RE = /\bper[-_\s]?min(ute)?s?\b/i;

/**
 * How long a rate-limited Freeway bucket cools. A limit the provider named as
 * per-minute gets AT LEAST the 70s floor: `Retry-After` is clamped to 60s
 * (below the floor), so honoring a short one would put the bucket back before
 * the minute window has certainly rolled over. Any other rate limit uses the
 * provider's own `Retry-After`, or undefined — which falls back to the
 * bucket's next day-scale reset.
 */
export function rateLimitCooldownMs(err: unknown): number | undefined {
  const retryAfter = retryAfterMsOf(err);
  const message = err instanceof Error ? err.message : String(err);
  if (PER_MINUTE_LIMIT_RE.test(message)) {
    return Math.max(retryAfter ?? 0, PER_MINUTE_RATE_LIMIT_COOLDOWN_MS);
  }
  return retryAfter;
}

/**
 * Whether an error (or a module's per-result `error` string) signals a 429.
 * Detects the shared typed RateLimitError by name first, then falls back to
 * the canonical shared message vocabulary (which covers Google's quota
 * phrasing — "You exceeded your current quota" carries neither "429" nor
 * "rate limit"), so the engine's cool-down retry actually engages for those.
 */
export function isRateLimitError(err: unknown): boolean {
  if (err && typeof err === 'object' && (err as { name?: unknown }).name === 'RateLimitError') {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return RATE_LIMIT_MESSAGE_RE.test(msg);
}

/**
 * Whether an error (or a module's per-result `error` string) signals an
 * authentication/authorization failure — HTTP 401 (invalid credential) or 403
 * (forbidden). Detects the shared `AuthError` (by `name`/`statusCode`) and falls
 * back to the broad message text, since several modules surface auth failures
 * only as a downgraded `error` string.
 *
 * This is the LENIENT, message-level classifier — suitable for per-entry
 * labelling/diagnostics. It deliberately does NOT drive run cancellation: the
 * free-text `forbidden`/`permission denied` vocabulary also matches benign
 * model/content refusals ("content forbidden by safety policy"), which must fail
 * a single entry, not the whole run. Use {@link isRunCancellingAuthError} for
 * the whole-run cancel decision.
 */
export function isAuthError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; statusCode?: unknown };
    if (e.name === 'AuthError') return true;
    if (e.statusCode === 401 || e.statusCode === 403) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return AUTH_MESSAGE_RE.test(msg);
}

/** Explicit HTTP 401/403 status token — the only auth marker trustworthy on a
 * bare downgraded error STRING. The shared `AuthError` normalizes the status
 * code INTO its message (see `AuthError` ctor), so a genuine auth failure
 * surfaced only as a `.error` string still carries `401`/`403`; a model/content
 * refusal ("content forbidden by safety policy") does not. */
const AUTH_STATUS_TOKEN_RE = /\b401\b|\b403\b/;

/**
 * STRICT auth classifier that gates whole-run cancellation. Cancelling a
 * run on an auth failure is correct only when the credential is genuinely bad
 * for every job — so we require a STRUCTURED signal (a typed `AuthError`, or an
 * explicit numeric `statusCode` of 401/403 carried on the thrown error), and
 * for the batch path's downgraded per-result `error` STRINGS we accept only an
 * explicit `401`/`403` status token, NOT the broad `forbidden`/`permission
 * denied` vocabulary that {@link isAuthError} matches. This keeps a per-entry
 * content refusal from tearing down an entire run while still cancelling on a
 * real invalid/forbidden credential (whose message is 401/403-normalized).
 */
export function isRunCancellingAuthError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; statusCode?: unknown };
    if (e.name === 'AuthError') return true;
    if (e.statusCode === 401 || e.statusCode === 403) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return AUTH_STATUS_TOKEN_RE.test(msg);
}

/**
 * Delay (ms) before the next rate-limit retry. Honors a provider-supplied
 * `retryAfterMs` when the error carries one (shared RateLimitError — DeepL
 * and the AI SDK layer attach it); otherwise exponential backoff from
 * `baseMs` (default 1s) with ±20% jitter so concurrent jobs don't retry in
 * lockstep.
 */
export function retryDelayMs(err: unknown, attempt: number, baseMs = 1000): number {
  if (typeof err === 'object' && err !== null && 'retryAfterMs' in err) {
    const retryAfterMs = (err as { retryAfterMs?: unknown }).retryAfterMs;
    if (typeof retryAfterMs === 'number' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return Math.min(Math.round(retryAfterMs), MAX_RETRY_AFTER_MS);
    }
  }
  const base = baseMs * 2 ** attempt;
  const jitter = 1 + (Math.random() * 0.4 - 0.2);
  return Math.round(base * jitter);
}

export interface RateLimitRetryOptions {
  /** Max attempts including the first (default 3). */
  attempts?: number;
  /** Base delay (ms) for exponential backoff; forwarded to {@link retryDelayMs}. */
  baseDelayMs?: number;
  /**
   * Throw a {@link CancelledError} before each attempt when this returns true,
   * so an aborted/cancelled run stops retrying immediately. The thrown error is
   * recognised by {@link isAbortError}, so callers treat it as an abort.
   */
  isCancelled?: () => boolean;
  /**
   * Called once per scheduled rate-limit retry, before the backoff sleep, with
   * the just-failed attempt index (0-based), the chosen delay, and the error.
   * Lets callers record metrics / per-entry retry counts without duplicating
   * the loop.
   */
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void;
  /**
   * When provided, the between-attempt backoff sleep races against this signal
   * so a cancel/abort interrupts the wait promptly instead of parking the queue
   * slot for the full delay. After an interrupted sleep the loop's cancellation
   * check throws {@link CancelledError}, so an aborted retry stops.
   */
  signal?: AbortSignal;
}

/**
 * Runs `fn` with rate-limit-aware retries for the M9 dispatch pipeline
 * (the batch loop in `processBatchJob`). Retries only on
 * `isRateLimitError`; any other error (or the final attempt) rethrows. Honors
 * the provider's `retryAfterMs` via {@link retryDelayMs}.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: RateLimitRetryOptions = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs, isCancelled, onRetry, signal } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (isCancelled?.() || signal?.aborted) throw new CancelledError();
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err) || attempt === attempts - 1) throw err;
      const delay = retryDelayMs(err, attempt, baseDelayMs);
      onRetry?.(attempt, delay, err);
      await abortableSleep(delay, signal);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Thrown by {@link withRateLimitRetry} when a run is cancelled mid-retry. Named
 * `'AbortError'` so {@link isAbortError} recognises it by `name`, while the
 * message stays descriptive (a generic `new Error('cancelled')` lost that
 * distinction in logs).
 */
export class CancelledError extends Error {
  constructor(message = 'cancelled') {
    super(message);
    this.name = 'AbortError';
  }
}

interface AbortErrorLike extends Error {
  code?: string;
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === 'AbortError' ||
      err.message === 'cancelled' ||
      err.message === 'The user aborted a request.' ||
      (err as AbortErrorLike).code === 'ABORT_ERR'
    );
  }
  return err === 'cancelled';
}
