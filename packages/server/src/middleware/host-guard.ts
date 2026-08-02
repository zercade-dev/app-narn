import type { Request, Response, NextFunction } from 'express';
import { LOOPBACK_HOSTNAMES } from './loopback.js';
import { getAllowedHost } from '../config/env.js';

/**
 * Rejects requests whose Host header is not a loopback name. Defends a
 * local-only server against DNS-rebinding (a remote page re-resolving its
 * own domain to 127.0.0.1 and driving this API). Runs on ALL methods,
 * including GET, so it also protects read endpoints (unlike the CSRF guard).
 *
 * When the server is intentionally bound to a non-loopback interface
 * (HOST=0.0.0.0) or fronted by a CDN/reverse proxy, set ALLOWED_HOST to the
 * hostname(s) clients will use — a comma-separated list for multiple
 * public domains.
 */
/** Strips the port from a Host header value, handling bracketed IPv6 (`[::1]:3001`). */
function hostWithoutPort(rawHost: string): string {
  const trimmed = rawHost.trim();
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    return end === -1 ? trimmed : trimmed.slice(0, end + 1);
  }
  return trimmed.split(':')[0];
}

/**
 * The configured non-loopback hosts. `ALLOWED_HOST` is a comma-separated list
 * (a single value is the one-element case), each entry trimmed + lowercased.
 * Empty/unset → an empty set, so only loopback names pass.
 */
function allowedHosts(): Set<string> {
  const raw = getAllowedHost();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter((h) => h !== ''),
  );
}

export function hostGuard(req: Request, res: Response, next: NextFunction): void {
  const host = hostWithoutPort(req.headers.host ?? '').toLowerCase();
  if (LOOPBACK_HOSTNAMES.has(host) || allowedHosts().has(host)) {
    next();
    return;
  }
  res.status(403).json({ error: 'forbidden-host' });
}
