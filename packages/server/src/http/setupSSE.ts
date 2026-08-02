import { Request, Response } from 'express';

export interface SSEHandle {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

export function setupSSE(
  req: Request,
  res: Response,
  opts: { allowedOrigin: string; heartbeatMs?: number },
): SSEHandle {
  const origin = req.headers.origin;

  // Defense-in-depth: an EventSource connection is a "simple" cross-origin GET — the
  // browser sends only an Origin header, and no custom header that the csrfGuard
  // (which exempts GET) could check. So reject a PRESENT, non-matching Origin at
  // connect time rather than relying solely on the SameSite=Strict session cookie +
  // vault gate to starve the stream. A same-origin request sends no Origin header (or
  // a matching one), so the real frontend is never blocked.
  if (origin && origin !== opts.allowedOrigin) {
    res.status(403).json({ error: 'forbidden-origin' });
    // The response is ended; hand back an inert handle so the caller's send()/close()
    // become no-ops (its onEntry listener also short-circuits on res.writableEnded).
    const noop = () => {};
    return { send: noop, close: noop };
  }
  if (origin && origin === opts.allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Backpressure: when the OS/socket buffer is full, res.write() returns false.
  // Continuing to enqueue then buffers unbounded server memory for a stalled
  // client, so we stop writing until Node emits 'drain'. Node returns EXACTLY
  // true/false; the `=== false` check leaves any non-boolean stub (test mocks)
  // and the normal true path untouched.
  let paused = false;
  const pauseUntilDrain = () => {
    paused = true;
    res.once('drain', () => {
      paused = false;
    });
  };

  const heartbeatMs = opts.heartbeatMs ?? 30_000;
  const heartbeat = setInterval(() => {
    if (res.writableEnded || paused) return;
    if (res.write(': heartbeat\n\n') === false) pauseUntilDrain();
  }, heartbeatMs);

  const send = (event: string, data: unknown) => {
    if (res.writableEnded || paused) return;
    if (res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) === false)
      pauseUntilDrain();
  };

  // Idempotent teardown shared by caller-initiated close and client disconnect:
  // stop the heartbeat timer. `close` additionally ends the response.
  const stopHeartbeat = () => clearInterval(heartbeat);

  const close = () => {
    stopHeartbeat();
    res.end();
  };

  req.on('close', stopHeartbeat);

  return { send, close };
}
