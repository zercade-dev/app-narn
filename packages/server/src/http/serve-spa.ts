import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import express, { type Application, type Request, type Response, type NextFunction } from 'express';

// The built index.html carries a <meta http-equiv="Content-Security-Policy">.
// We strip it so the server's per-request CSP *header* is the single source of
// truth (otherwise the browser enforces both and the baked nonce mismatches).
const CSP_META_RE = /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>\s*/i;
// Every script tag (and the inline pre-paint script) carries nonce="<build>".
const NONCE_ATTR_RE = /nonce="[^"]*"/g;

/**
 * Serve the built SPA same-origin with the API.
 *
 * - Hashed assets (/assets/*) are served statically.
 * - Any non-/api GET returns index.html (client-side routing) with the meta
 *   CSP stripped and every nonce rewritten to this request's nonce
 *   (res.locals.nonce, set by setupSecurityHeaders) so it matches the CSP
 *   response header — scripts run; nonce is consistent.
 * - /api/* and non-GET requests fall through (next()) to the JSON 404 in
 *   index.ts, so unknown API routes stay JSON, not HTML.
 *
 * Call AFTER all /api routers and BEFORE the 404 handler.
 */
export function mountSpa(app: Application, frontendDist: string): boolean {
  // No built SPA at this path — e.g. dev mode (Vite serves the frontend on
  // :5173) or a server-only run. Skip same-origin SPA serving and return false
  // so the caller can log it, rather than crashing the API on boot with ENOENT.
  const indexPath = join(frontendDist, 'index.html');
  if (!existsSync(indexPath)) return false;

  // index:false so "/" doesn't auto-serve the untransformed index.html — the
  // fallback below owns it.
  app.use(express.static(frontendDist, { index: false }));

  // Read + meta-strip once at mount time; the only per-request work is the
  // nonce swap.
  const indexTemplate = readFileSync(indexPath, 'utf8').replace(CSP_META_RE, '');

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    // res.locals.nonce is set by setupSecurityHeaders, which also is the ONLY
    // source of the CSP response header. So either it ran (nonce matches the
    // header) or it didn't (no CSP header is set, making the '' fallback inert).
    const nonce = typeof res.locals.nonce === 'string' ? res.locals.nonce : '';
    res.type('html').send(indexTemplate.replace(NONCE_ATTR_RE, `nonce="${nonce}"`));
  });

  return true;
}
