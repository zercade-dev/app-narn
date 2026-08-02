import { Router, type Request, type Response, type NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import {
  getServerStartedAt,
  getRestartNotice,
  scheduleRestart,
  cancelRestart,
} from '../services/restart-notice.js';
import {
  isRestartBannersEnabled,
  getRestartRecentlyWindowMs,
  getSlotLabel,
  getRestartAdminToken,
  getSupportEmail,
} from '../config/env.js';

/**
 * System status + operator restart-notice.
 *
 * MUST be mounted BEFORE csrfGuard (see index.ts): the global CSRF guard 403s any
 * POST/DELETE without an Origin/Referer (and in cloud mode only CSRF_TRUSTED_ORIGIN
 * passes), which would block an operator's header-only request. The mutating routes
 * authenticate with X-Restart-Token instead — a cross-origin page can't forge it —
 * so the CSRF origin check is redundant for them. hostGuard (loopback) still applies.
 */
function bannersEnabled(): boolean {
  return isRestartBannersEnabled();
}

function restartedWindowMs(): number {
  return getRestartRecentlyWindowMs();
}

function slotLabel(): string | null {
  return getSlotLabel();
}

function requireRestartToken(req: Request, res: Response, next: NextFunction): void {
  const expected = getRestartAdminToken();
  const got = req.get('x-restart-token') ?? '';
  // Constant-time compare (mirrors modules/account-deletion-tokens.ts): a
  // plain `!==` short-circuits on the first mismatched byte, letting a
  // network-timing attacker learn the token one byte at a time. Guard the
  // length check before timingSafeEqual — it throws on unequal-length buffers.
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(got);
  const matches =
    expected !== '' && expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);
  if (!matches) {
    res.status(401).json({ error: 'invalid restart token' });
    return;
  }
  next();
}

export const systemRouter: Router = Router();

systemRouter.get('/status', (_req, res) => {
  const n = getRestartNotice();
  res.json({
    serverNow: Date.now(),
    serverStartedAt: getServerStartedAt(),
    restartAt: n.restartAt,
    restartMessage: n.restartMessage,
    restartCancelledAt: n.cancelledAt,
    bannersEnabled: bannersEnabled(),
    restartedWindowMs: restartedWindowMs(),
    slotLabel: slotLabel(),
    supportEmail: getSupportEmail(),
  });
});

systemRouter.post('/restart-notice', requireRestartToken, (req, res) => {
  const seconds = Number((req.body ?? {}).seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    res.status(400).json({ error: 'seconds must be a positive number' });
    return;
  }
  const message = typeof req.body?.message === 'string' ? req.body.message : null;
  res.json(scheduleRestart(seconds, message));
});

systemRouter.delete('/restart-notice', requireRestartToken, (_req, res) => {
  res.json(cancelRestart());
});
