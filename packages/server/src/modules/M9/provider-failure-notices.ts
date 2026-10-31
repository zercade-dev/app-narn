/**
 * Repeated provider failures on a translation run. A rerouted failure leaves no
 * mark on the run's result, so a model that rejects everything sent to it would
 * otherwise go unnoticed. Failures are grouped by (model, normalized message)
 * and a group that reaches the threshold becomes a notice on the run status,
 * which persists with it and reaches the client through the normal run polling.
 * Stored messages have credentials scrubbed but are otherwise the provider's
 * text, so one may echo up to 300 characters of the source text it was sent.
 */
import { createHash } from 'node:crypto';
import {
  PAYLOAD_TOO_LARGE_MESSAGE_RE,
  isParseFailureMessage,
  type ProviderFailureNotice,
  type ProviderFailureRouting,
  type RunStatus,
} from '@zercade-dev/narn-shared';
import {
  isAbortError,
  isModelUnavailableError,
  isRateLimitError,
  isRunCancellingAuthError,
  isTimeoutFailure,
  isTransientProviderFailure,
} from './errors.js';

export const PROVIDER_FAILURE_NOTICE_THRESHOLD = 3;
export const MAX_PROVIDER_FAILURE_NOTICES = 10;
export const MAX_PROVIDER_FAILURE_MESSAGE_CHARS = 300;
/** Sub-threshold groups tracked per run: a stream of unique messages must not grow without limit. */
const MAX_TRACKED_GROUPS = 200;

/** Groups still below the notice threshold, for one run. In-memory only. */
export interface ProviderFailureTracker {
  pending: Map<string, { count: number; routing: ProviderFailureRouting }>;
}

export function createProviderFailureTracker(): ProviderFailureTracker {
  return { pending: new Map() };
}

/**
 * Whether a failure is one the user could not learn about any other way, as
 * opposed to a rate limit, a passing fault, an auth failure (which has its own
 * handling), a cancel, or a reply that arrived but did not parse.
 */
export function countsAsProviderFailure(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (isRateLimitError(err) || isRunCancellingAuthError(err)) return false;
  // Checked before the passing-fault test, per its precedence contract.
  if (isModelUnavailableError(err)) return true;
  const statusCode =
    typeof err === 'object' && err !== null
      ? (err as { statusCode?: unknown }).statusCode
      : undefined;
  if (typeof statusCode === 'number' && statusCode >= 500) return false;
  const message = err instanceof Error ? err.message : String(err);
  // Same test the cooldown uses, so a fault is never both retried soon as
  // passing and reported as a repeated failure. A timeout is also a passing
  // fault, whatever its cooldown.
  if (isTransientProviderFailure(err) || isTimeoutFailure(err)) return false;
  // Depends on the input, not the model.
  if (PAYLOAD_TOO_LARGE_MESSAGE_RE.test(message)) return false;
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

const ROUTING_RANK: Record<ProviderFailureRouting, number> = { none: 0, retrying: 1, rerouted: 2 };

function betterRouting(
  a: ProviderFailureRouting,
  b: ProviderFailureRouting,
): ProviderFailureRouting {
  return ROUTING_RANK[b] > ROUTING_RANK[a] ? b : a;
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
 * What became of the requests in one failure, once its batch has settled. Judged
 * from its own entries: a batch can end parked after other languages were served,
 * and it can return results in which every entry errored. `outcomeKind` is absent
 * when the dispatch threw. A cancelled batch claims nothing.
 */
export function routingForHeldFailure(
  failure: { model: string; pairKeys: readonly string[] },
  servedBy: ReadonlyMap<string, string>,
  outcomeKind: string | undefined,
  aborted: boolean,
): ProviderFailureRouting {
  if (aborted) return 'none';
  const moved = failure.pairKeys.some((key) => {
    const server = servedBy.get(key);
    return server !== undefined && server !== failure.model;
  });
  if (moved) return 'rerouted';
  return outcomeKind === 'defer' ? 'retrying' : 'none';
}

/**
 * Count `occurrences` strings failed by `model`. `message` must already have
 * credentials scrubbed. `routing` is what became of those requests. Later occurrences update an existing notice, which
 * is also how a run resumed with a fresh tracker keeps counting onto it.
 */
export function recordProviderFailure(
  status: RunStatus,
  tracker: ProviderFailureTracker,
  failure: {
    model: string;
    message: string;
    occurrences: number;
    routing?: ProviderFailureRouting;
  },
): void {
  const { model, occurrences, routing = 'none' } = failure;
  const message = boundMessage(failure.message);
  const id = createHash('sha256')
    .update(`${model}\0${normalizeProviderFailureMessage(message)}`)
    .digest('hex')
    .slice(0, 16);

  const existing = status.providerFailureNotices?.find((notice) => notice.id === id);
  if (existing) {
    existing.count += occurrences;
    existing.routing = betterRouting(existing.routing, routing);
    return;
  }
  const previous = tracker.pending.get(id);
  if (!previous && tracker.pending.size >= MAX_TRACKED_GROUPS) return;
  const count = (previous?.count ?? 0) + occurrences;
  const merged = betterRouting(previous?.routing ?? 'none', routing);
  tracker.pending.set(id, { count, routing: merged });
  if (count < PROVIDER_FAILURE_NOTICE_THRESHOLD) return;
  if ((status.providerFailureNotices?.length ?? 0) >= MAX_PROVIDER_FAILURE_NOTICES) return;
  const notice: ProviderFailureNotice = {
    id,
    model,
    message,
    count,
    routing: merged,
  };
  (status.providerFailureNotices ??= []).push(notice);
  tracker.pending.delete(id);
}
