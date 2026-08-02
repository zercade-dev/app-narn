import type { RequestHandler } from 'express';
import multer from 'multer';

import type { ResolvedIdentity } from '../identity/types.js';
import { runWithTenant } from '../storage/pg/tenant-context.js';

interface SingleFileUploadOptions {
  /** Max accepted file size in bytes. */
  maxBytes: number;
  /** Field name of the file part (defaults to `file`). */
  field?: string;
  /**
   * When set, files are streamed to this directory on disk (multer `dest`) and
   * exposed via `req.file.path`. Otherwise files are buffered in memory and
   * exposed via `req.file.buffer`.
   */
  dest?: string;
  /** Optional multer fileFilter for restricting accepted file types. */
  fileFilter?: multer.Options['fileFilter'];
}

/**
 * Builds the multer middleware that accepts a single uploaded file. Centralizes
 * the storage/limit/field configuration so the per-route uploaders stay in sync.
 */
export function singleFileUpload(options: SingleFileUploadOptions): RequestHandler {
  const { maxBytes, field = 'file', dest, fileFilter } = options;
  const multerOptions: multer.Options = {
    limits: { fileSize: maxBytes },
    ...(dest ? { dest } : { storage: multer.memoryStorage() }),
    ...(fileFilter ? { fileFilter } : {}),
  };
  // Multer's typings don't line up with Express 5's RequestHandler.
  const upload = multer(multerOptions).single(field) as unknown as RequestHandler;
  // Multer parses the multipart body via the request socket's stream events,
  // whose async resources predate identityMiddleware's `runWithTenant(...)`
  // (`als.run()`) scope — so by the time multer invokes its completion callback
  // the ambient tenant context has been popped and any storage access would throw
  // NoTenantContextError (fail-closed). Re-establish the SAME already-resolved
  // identity (kept on `res.locals`, independent of the ALS) for the downstream
  // continuation. No-op when identity is absent, so the fail-closed guard stands.
  return (req, res, next) => {
    upload(req, res, (err?: unknown) => {
      if (err) {
        next(err as Error);
        return;
      }
      const identity = res.locals.identity as ResolvedIdentity | undefined;
      if (identity) {
        runWithTenant(
          { userId: identity.userId, sessionId: identity.sessionId, deviceId: identity.deviceId },
          () => next(),
        );
      } else {
        next();
      }
    });
  };
}

/**
 * Express middleware that rejects with 400 `{ error: 'No file uploaded' }` when
 * no file was attached to the request. Place it after `singleFileUpload(...)`.
 */
export const requireFile: RequestHandler = (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  next();
};
