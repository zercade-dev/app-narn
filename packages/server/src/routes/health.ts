import { Router } from 'express';
import { getPool } from '../storage/pg/pool.js';
import { logger } from '../modules/M15-console-logger.js';

/**
 * Liveness + readiness probes. Deliberately ungated: no vault, no rate limit.
 * GET passes the CSRF guard (safe method) and, called from inside the container
 * via 127.0.0.1, the host guard (loopback Host header).
 *
 * - /health  : unchanged liveness (the docker-compose healthcheck targets it).
 * - /healthz : liveness alias (conventional name; same semantics as /health).
 * - /readyz  : readiness — the DB is reachable. Schema migrations are applied at
 *   boot (startupSequence runs them FATAL-on-failure before serving), so a
 *   booted server with a reachable DB is ready; this probe re-checks DB
 *   connectivity at request time (the DB can go down after boot).
 */
export const healthRouter: Router = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/readyz', async (_req, res) => {
  try {
    await getPool().query('select 1');
    res.json({ status: 'ready' });
  } catch (err) {
    // Ungated endpoint (no vault, no rate limit) — never echo the raw DB error
    // back to the client, it can embed host/user/connection-string detail.
    // Log the real error server-side and return a generic body.
    logger.error('readyz probe failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({ status: 'not ready' });
  }
});
