/**
 * Repeated provider failures on a translation run. A rerouted failure leaves no
 * mark on the run's result, so a model that rejects everything sent to it would
 * otherwise go unnoticed. Failures are grouped by (model, normalized message)
 * and a group that reaches the threshold becomes a notice on the run status,
 * which persists with it and reaches the client through the normal run polling.
 */
import { createHash } from 'node:crypto';
import {
  isParseFailureMessage,
  type ProviderFailureNotice,
  type RunStatus,
} from '@zercade-dev/narn-shared';
import {
  isAbortError,
  isModelUnavailableError,
  isRateLimitError,
  isRunCancellingAuthError,
  isTransientProviderError,
} from './errors.js';

export const PROVIDER_FAILURE_NOTICE_THRESHOLD = 3;
export const MAX_PROVIDER_FAILURE_NOTICES = 10;
export const MAX_PROVIDER_FAILURE_MESSAGE_CHARS = 300;
/** Sub-threshold groups tracked per run: a stream of unique messages must not grow without limit. */
const MAX_TRACKED_GROUPS = 200;

/** 5xx and connection-level faults the transient classifier's vocabulary does not name. */
const EXTRA_TRANSIENT_RE =
  /\b50\d\b|bad gateway|gateway time|fetch failed|network error|socket hang up|econn\w+|enotfound|etimedout/i;

/** Sub-threshold counts and rerouted models for one run. In-memory only. */
export interface ProviderFailureTracker {
  counts: Map<string, number>;
  reroutedModels: Set<string>;
}

export function createProviderFailureTracker(): ProviderFailureTracker {
  return { counts: new Map(), reroutedModels: new Set() };
}

/**
 * Whether a failure is one the user could not learn about any other way, as
 * opposed to a rate limit, a passing fault, an auth failure (which has its own
 * handling), a cancel, or a reply that arrived but did not parse.
 */
export function countsAsProviderFailure(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (isRateLimitError(err) || isRunCancellingAuthError(err)) return false;
  // Checked before the transient vocabulary, per its precedence contract.
  if (isModelUnavailableError(err)) return true;
  const statusCode =
    typeof err === 'object' && err !== null
      ? (err as { statusCode?: unknown }).statusCode
      : undefined;
  if (typeof statusCode === 'number' && statusCode >= 500) return false;
  const message = err instanceof Error ? err.message : String(err);
  if (isTransientProviderError(err) || EXTRA_TRANSIENT_RE.test(message)) return false;
  return !isParseFailureMessage(message);
}

/** The grouping form of a message: request ids, uuids, hashes and numbers all collapse to `#`. */
export function normalizeProviderFailureMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '#')
    .replace(/\b(?=[a-z_-]*\d)[a-z0-9_-]{6,}\b/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROVIDER_FAILURE_MESSAGE_CHARS);
}

function boundMessage(message: string): string {
  return (
    message
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_PROVIDER_FAILURE_MESSAGE_CHARS)
  );
}

/**
 * Count `occurrences` strings failed by `model`. `message` must already be
 * sanitized for credentials. Later occurrences update an existing notice, which
 * is also how a run resumed with a fresh tracker keeps counting onto it.
 */
export function recordProviderFailure(
  status: RunStatus,
  tracker: ProviderFailureTracker,
  failure: { model: string; message: string; occurrences: number },
): void {
  const { model, occurrences } = failure;
  const message = boundMessage(failure.message);
  const id = createHash('sha256')
    .update(`${model}\0${normalizeProviderFailureMessage(message)}`)
    .digest('hex')
    .slice(0, 16);

  const existing = status.providerFailureNotices?.find((notice) => notice.id === id);
  if (existing) {
    existing.count += occurrences;
    return;
  }
  const previous = tracker.counts.get(id);
  if (previous === undefined && tracker.counts.size >= MAX_TRACKED_GROUPS) return;
  const count = (previous ?? 0) + occurrences;
  tracker.counts.set(id, count);
  if (count < PROVIDER_FAILURE_NOTICE_THRESHOLD) return;
  if ((status.providerFailureNotices?.length ?? 0) >= MAX_PROVIDER_FAILURE_NOTICES) return;
  const notice: ProviderFailureNotice = {
    id,
    model,
    message,
    count,
    rerouted: tracker.reroutedModels.has(model),
  };
  (status.providerFailureNotices ??= []).push(notice);
  tracker.counts.delete(id);
}

/** Requests that failed on `model` moved to another one. */
export function markProviderFailuresRerouted(
  status: RunStatus,
  tracker: ProviderFailureTracker,
  model: string,
): void {
  tracker.reroutedModels.add(model);
  for (const notice of status.providerFailureNotices ?? []) {
    if (notice.model === model) notice.rerouted = true;
  }
}
