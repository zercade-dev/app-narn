import { Router } from 'express';
import { getPool } from '../storage/pg/pool.js';
import { logger } from '../modules/M15-console-logger.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

/**
 * Liveness + readiness probes. Deliberately unauthenticated: no vault gate.
 * GET passes the CSRF guard (safe method) and, called from inside the container
 * via 127.0.0.1, the host guard (loopback Host header).
 *
 * - /health  : unchanged liveness (the docker-compose healthcheck targets it).
 * - /healthz : liveness alias (conventional name; same semantics as /health).
 * - /readyz  : readiness — the DB is reachable. The only one of the three that
 *   is rate-limited, because it is the only one that does work per request;
 *   see the limiter below. Schema migrations are applied at
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

/**
 * `/readyz` runs a query per request, so an unauthenticated caller can turn it
 * into a database-load amplifier. The ceiling is set high on purpose: buckets
 * are keyed by client IP here (a probe carries no tenant), and the container
 * healthcheck calls through 127.0.0.1 — so it holds a bucket of its own that
 * outside traffic cannot consume, and 120/min leaves its 30s interval roughly
 * 60x of headroom.
 */
const readyzRateLimiter = rateLimiter({ maxRequests: 120, windowMs: 60_000 });

healthRouter.get('/readyz', readyzRateLimiter, async (_req, res) => {
  try {
    await getPool().query('select 1');
    res.json({ status: 'ready' });
  } catch (err) {
    // Unauthenticated endpoint — never echo the raw DB error
    // back to the client, it can embed host/user/connection-string detail.
    // Log the real error server-side and return a generic body.
    logger.error('readyz probe failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    res.status(503).json({ status: 'not ready' });
  }
});
