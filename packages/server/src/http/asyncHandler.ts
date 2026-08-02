import { createHash } from 'node:crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { logger } from '../modules/M15-console-logger.js';

// Express 5 ParamsDictionary types params as `string | string[]`, but route
// params are always plain strings at runtime. This local alias narrows params
// to `string` so handlers can consume req.params without extra casts.
type FlatParams = Record<string, string>;

// Error names that error-handler.ts maps to a clean, well-understood HTTP
// response (401/423/503/428/429 — see the `err.name === '…'` / `instanceof`
// branches there). These are expected, routine control flow (an expired
// session, a locked vault, a missing credential, ...) — not bugs — so they're
// logged quietly (no stack) instead of as a scary ERROR.
const QUIETLY_LOGGED_ERROR_NAMES = new Set([
  'NoTenantContextError',
  'VaultLockedError',
  'MissingCredentialError',
  'DeviceNotEnrolledError',
  'TooManyRunsError',
]);

export const asyncHandler =
  (
    fn: (req: Request<FlatParams>, res: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next) => {
    fn(req as Request<FlatParams>, res, next).catch((err) => {
      // Identity is set by identityMiddleware; guard the access so logging
      // can never itself throw inside the error path. The raw session id is the
      // vault session token, so only a truncated digest is logged — enough to
      // correlate log lines to a session without leaking the token.
      const sessionId =
        typeof res.locals?.identity?.sessionId === 'string' && res.locals.identity.sessionId !== ''
          ? res.locals.identity.sessionId
          : undefined;
      const sessionIdHash = sessionId
        ? createHash('sha256').update(sessionId).digest('hex').slice(0, 12)
        : undefined;
      // Log full error server-side including stack trace, plus request
      // context (method/path only — no query, headers, or body, which may
      // contain sensitive values; the logger redacts metadata as well).
      // Known, cleanly-mapped errors (see QUIETLY_LOGGED_ERROR_NAMES above)
      // are expected control flow, not bugs — log them quietly, without a
      // stack, so they don't show up as scary ERROR-level noise; anything
      // else is genuinely unexpected and keeps the full ERROR+stack log.
      const name = err instanceof Error ? err.name : undefined;
      const meta = {
        method: req.method,
        // baseUrl restores the router mount prefix (req.path alone is
        // relative to the mounted router); query string is deliberately
        // excluded.
        path: `${req.baseUrl ?? ''}${req.path ?? ''}`,
        sessionIdHash,
        message: err instanceof Error ? err.message : String(err),
        name,
      };
      if (name !== undefined && QUIETLY_LOGGED_ERROR_NAMES.has(name)) {
        logger.debug('Unhandled error (expected, mapped)', meta);
      } else {
        logger.error('Unhandled error', {
          ...meta,
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
      // Pass to error handler which will return generic response to client
      next(err);
    });
  };
