import type { Request, Response, NextFunction } from 'express';
import { ensureProjectId } from '../utils/project-path.js';

/**
 * Router-level `param` guard for a project-id path segment (`:id` or
 * `:projectId`). Validates the value against path traversal via
 * {@link ensureProjectId}; a hostile id throws `PathTraversalError`, which the
 * central error handler maps to 400. The shared replacement for the identical
 * inline `.param()` blocks previously copy-pasted across the project-scoped
 * routers.
 *
 * Register once per router: `router.param('id', projectIdParam)` (or
 * `'projectId'`). Handlers may then read `req.params.id` directly — it is
 * pre-validated by the time the handler runs.
 */
export function projectIdParam(
  _req: Request,
  _res: Response,
  next: NextFunction,
  id: string,
): void {
  try {
    ensureProjectId(id);
    next();
  } catch (err) {
    next(err);
  }
}
