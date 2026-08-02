/**
 * Shared plumbing for `text/plain`-streamed AI chat responses.
 *
 * Extracted verbatim from `routes/color-text.ts` so every chat surface (the
 * Text Styler assistant and the stage-details assistant) classifies provider
 * errors identically and truncates identically once bytes are on the wire.
 *
 * Because the response streams, an error can only be mapped to an HTTP status
 * BEFORE the first byte; once bytes are written we can only end the (truncated)
 * stream and let the client detect the truncation — a `wroteAnything` flag
 * drives that choice. The caller owns the `AbortController` / client-disconnect
 * wiring (it constructs the provider stream); this helper only sets the
 * streaming headers, pumps the deltas, and does the before-first-byte error
 * classification + sanitized logging (the log label is a parameter).
 *
 * Error classification reuses the shared AI-error helpers (`toAuthError` /
 * `toRateLimitError`, which unwrap the AI SDK's `AI_RetryError` envelope and
 * recognise Google's quota-phrased 429s) rather than a hand-rolled taxonomy.
 */
import type { Request, Response } from 'express';
import {
  MissingCredentialError,
  VaultLockedError,
  toAuthError,
  toRateLimitError,
} from '@zercade-dev/narn-shared';
import { UnsupportedChatModuleError } from '../modules/M6-module-registry.js';
import { logger } from '../modules/M15-console-logger.js';
import { sanitizeLogObject } from '../modules/M16-credential-store.js';

/**
 * Map a provider/service error to an HTTP status + stable code, for use BEFORE
 * any stream bytes have been written. Rate-limit is checked before auth to match
 * the shared `rethrowIfAuthOrRateLimit` ordering (a 429 never co-occurs with a
 * 401/403 on the same response, and carries the Retry-After hint). The typed
 * helpers unwrap `AI_RetryError` and cover Google's quota-phrased 429s.
 */
export function classifyChatError(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof VaultLockedError || (err as { name?: string })?.name === 'VaultLockedError') {
    return { status: 423, body: { error: 'vault-locked' } };
  }
  if (
    err instanceof MissingCredentialError ||
    (err as { name?: string })?.name === 'MissingCredentialError'
  ) {
    return { status: 503, body: { error: 'missing-credential' } };
  }
  if (
    err instanceof UnsupportedChatModuleError ||
    (err as { name?: string })?.name === 'UnsupportedChatModuleError'
  ) {
    return {
      status: 400,
      body: { error: err instanceof Error ? err.message : 'unsupported-module' },
    };
  }
  if (toRateLimitError(err)) {
    return { status: 429, body: { error: 'rate-limit' } };
  }
  if (toAuthError(err)) {
    return { status: 401, body: { error: 'auth-error' } };
  }
  return { status: 500, body: { error: 'An internal error occurred' } };
}

/**
 * Stream `stream`'s deltas to the client as `text/plain`. Sets the streaming
 * headers up front (so a zero-delta success still returns text/plain rather
 * than falling back to Express defaults; `setHeader` doesn't flush, so an error
 * thrown before the first delta can still take the classified-status path).
 * Once bytes are committed, a later error only ends the truncated stream.
 *
 * The caller owns the `AbortController` and client-disconnect (`res.on('close')`
 * — NOT `req.on('close')`, which fires once the request body is fully read
 * rather than when the connection actually ends; see `routes/color-text.ts`)
 * wiring; `req` is accepted for symmetry but not used here.
 */
export async function streamPlainTextResponse(
  _req: Request,
  res: Response,
  stream: AsyncIterable<string>,
  logLabel: string,
): Promise<void> {
  let wroteAnything = false;
  try {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    // Reverse proxies (nginx) buffer text/plain bodies by default, which turns
    // this incremental stream into a deliver-on-completion blob — on the cloud
    // deployments the assistant then looks dead until the whole reply is
    // generated. This response header disables that per-response — the same
    // mechanism a proxy can be configured with, but applied here so there is no
    // proxy-config dependency. Headers stay uncommitted until the first delta write,
    // preserving the pre-first-byte classified-status error path below.
    res.setHeader('X-Accel-Buffering', 'no');
    for await (const delta of stream) {
      res.write(delta);
      wroteAnything = true;
    }
    res.end();
  } catch (err) {
    if (wroteAnything || res.headersSent) {
      // Headers/body already committed — we cannot change the status. End the
      // truncated stream; the client detects the truncation.
      logger.error(
        `${logLabel} stream failed after first byte`,
        sanitizeLogObject({
          message: err instanceof Error ? err.message : String(err),
          name: err instanceof Error ? err.name : undefined,
        }),
      );
      res.end();
      return;
    }
    const { status, body: errorBody } = classifyChatError(err);
    // Log the full (redacted) error server-side; the client sees only a code.
    logger.error(
      `${logLabel} failed`,
      sanitizeLogObject({
        status,
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : undefined,
      }),
    );
    res.status(status).json(errorBody);
  }
}
