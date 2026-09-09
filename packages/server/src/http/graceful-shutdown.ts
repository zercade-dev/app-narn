/**
 * Bounded graceful shutdown for the HTTP listener.
 *
 * The ordering is load-bearing in both directions. `server.close()` waits for
 * EVERY open connection, and an SSE stream is an active connection that ends
 * only when the client disconnects, so the streams have to be ended by hand or
 * the drain never finishes at all. In the other direction the Postgres pool
 * marks itself `ending` synchronously and rejects every later `connect()`, so
 * tearing it down alongside `server.close()` fails the very requests the close
 * is still serving — resources may only be released once the listener has
 * drained, or the deadline has passed.
 */
import type { Server } from 'node:http';

/** Minimal logger surface (the app logger and `console` both satisfy it). */
export interface ShutdownLogger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * How long in-flight responses get to finish before the remaining connections
 * are severed. Docker's default `stop_grace_period` is 10s and no compose file
 * raises it, so a longer window would not be a deadline at all — SIGKILL would
 * land first and nothing would ever be released. 8s, plus the `MIN_RELEASE_MS`
 * floor below, leaves ~1s of headroom inside that grace while still covering the
 * slowest ordinary response (a backup ZIP, a CSV/glossary export, a log capture
 * download).
 */
export const SHUTDOWN_DEADLINE_MS = 8_000;

/**
 * Floor on the release window. `pool.end()` waits for checked-out clients to be
 * returned, so a drain that spent the whole budget still gets a moment to close
 * the pool cleanly instead of being abandoned outright.
 */
const MIN_RELEASE_MS = 1_000;

/**
 * How often idle keep-alive sockets are reaped while draining. A socket parked
 * between requests is idle, not in flight, but `server.close()` waits for it all
 * the same — including the ones the ended streams have just freed — so a single
 * sweep is not enough: without a repeated one every shutdown sits out the
 * keep-alive timeout before the close callback fires.
 */
const IDLE_REAP_MS = 100;

export interface ShutdownOutcome {
  /** How many open SSE streams the drain had to end. */
  streams: number;
  /** True when the deadline expired and the remaining connections were severed. */
  forced: boolean;
}

/** True when `p` (which must not reject) settles within `ms`. */
function settlesWithin(p: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  return Promise.race([p.then(() => true), expired]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Stop accepting connections, end the long-lived streams, let the remaining
 * responses finish, and only then release process-wide resources. Bounded by
 * `deadlineMs` plus the release floor, so neither a response that never ends nor
 * a teardown that never returns can hold the process past its stop grace.
 * Never throws.
 */
export async function shutdownGracefully(
  server: Server,
  opts: {
    logger: ShutdownLogger;
    /** Ends every open SSE stream, returning how many were closed. */
    closeStreams: () => number;
    /** Releases process-wide resources; runs only once the listener has drained. */
    release: () => Promise<unknown>;
    deadlineMs?: number;
  },
): Promise<ShutdownOutcome> {
  const deadlineMs = opts.deadlineMs ?? SHUTDOWN_DEADLINE_MS;
  const startedAt = Date.now();

  const closed = new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  const streams = opts.closeStreams();
  const reaper = setInterval(() => server.closeIdleConnections(), IDLE_REAP_MS);
  server.closeIdleConnections();

  const drained = await settlesWithin(closed, deadlineMs);
  clearInterval(reaper);
  const forced = !drained;
  if (forced) {
    opts.logger.warn('Shutdown deadline reached; closing in-flight responses', { deadlineMs });
    server.closeAllConnections();
  }
  opts.logger.info('HTTP server closed', { streams, forced, ms: Date.now() - startedAt });

  const releasing = Promise.resolve()
    .then(() => opts.release())
    .catch((err: unknown) => {
      opts.logger.warn('Shutdown resource release failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  const releaseMs = Math.max(deadlineMs - (Date.now() - startedAt), MIN_RELEASE_MS);
  if (!(await settlesWithin(releasing, releaseMs))) {
    opts.logger.warn('Shutdown resources did not release within the deadline', { releaseMs });
  }

  return { streams, forced };
}
