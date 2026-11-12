import { isParseFailureMessage, type FailureCode } from '@zercade-dev/narn-shared';
import {
  isAuthError,
  isModelUnavailableError,
  isRateLimitError,
  isTimeoutFailure,
  isTransientProviderError,
  isTransientProviderFailure,
} from './errors.js';

const CONTROLLED_REASONS: readonly FailureCode[] = [
  'no-route',
  'module-disabled',
  'module-not-found',
];
const EMPTY_REPLY_MESSAGES = ['empty translation', 'empty result'];

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err;
  if (
    err &&
    typeof err === 'object' &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return '';
}

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === 'object') {
    const s = (err as { statusCode?: unknown }).statusCode;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

/** Map a final failure onto the closed FailureCode list. Order encodes precedence. */
export function classifyFailure(err: unknown): FailureCode {
  const message = messageOf(err);
  const controlled = CONTROLLED_REASONS.find((c) => c === message);
  if (controlled) return controlled;
  if (isAuthError(err)) return 'auth';
  if (isRateLimitError(err)) return 'rate-limit';
  if (isModelUnavailableError(err)) return 'model-unavailable';
  if (isTimeoutFailure(err)) return 'timeout';
  if (isParseFailureMessage(message)) return 'parse-failure';
  if (EMPTY_REPLY_MESSAGES.includes(message)) return 'empty-reply';
  const status = statusOf(err);
  if (
    isTransientProviderError(err) ||
    isTransientProviderFailure(err) ||
    (status !== undefined && status >= 500)
  ) {
    return 'provider-error';
  }
  return 'unknown';
}
