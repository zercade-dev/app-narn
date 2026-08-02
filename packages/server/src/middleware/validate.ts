import type { Request, Response, NextFunction } from 'express';
import { ZodType, ZodError } from 'zod';
import { logger } from '../modules/M15-console-logger.js';

function summarizeIssues(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Middleware factory that validates req.body against a Zod schema.
 * Returns 400 with validation details on failure.
 */
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = summarizeIssues(result.error as ZodError);
      logger.debug('Request body validation failed', {
        method: req.method,
        path: req.path,
        issues: details,
      });
      res.status(400).json({ error: 'Validation error', details });
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory that validates req.query against a Zod schema.
 * Returns 400 with validation details on failure.
 *
 * Validate-only: Express 5 exposes `req.query` through a getter, so the
 * parsed result is not written back — handlers keep reading `req.query`,
 * which is guaranteed to match the schema once this middleware passes.
 */
export function validateQuery<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = summarizeIssues(result.error as ZodError);
      logger.debug('Request query validation failed', {
        method: req.method,
        path: req.path,
        issues: details,
      });
      res.status(400).json({ error: 'Validation error', details });
      return;
    }
    next();
  };
}
