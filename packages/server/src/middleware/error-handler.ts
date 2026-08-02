import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  ProjectNotFoundError,
  RunNotFoundError,
  EntryNotFoundError,
  InvalidLanguageError,
  ValidationError,
  BackupIntegrityError,
  TemplateNotFoundError,
  MissingCredentialError,
  VaultLockedError,
  ModuleNotFoundError,
  GlossaryNotFoundError,
  GlossaryTermNotFoundError,
  ReadOnlyGlossaryError,
  ForbiddenError,
  PreviewNotPossibleError,
  TooManyRunsError,
  DeviceNotEnrolledError,
} from '../types/errors.js';
import { NoTenantContextError } from '../storage/pg/tenant-context.js';
import { PathTraversalError } from '../errors/PathTraversalError.js';
import { JudgeNotPossibleError } from '../modules/M25-judge-engine.js';
import { SourceReviewNotPossibleError } from '../modules/M26-source-review-engine.js';
import { RelinkRetranslateNotPossibleError } from '../modules/M30-relink-retranslate-engine.js';
import { GlossaryGenerateNotPossibleError } from '../modules/glossary-generator.js';
import { GlossaryTranslateNotPossibleError } from '../modules/glossary-translator.js';
import { logger } from '../modules/M15-console-logger.js';

interface AppError extends Error {
  statusCode?: number;
  // Set by body-parser on malformed request bodies
  status?: number;
  type?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // An error thrown AFTER headers are already out (e.g. sendFile failing
  // mid-stream) can't be turned into a fresh res.status().json() — that would
  // throw again (headers already sent) and destroy the socket, masking the
  // original error. Delegate to Express's default finalizer instead, which
  // just ends/destroys the response without trying to write a new one.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Malformed JSON body rejected by body-parser (express.json)
  if (err instanceof SyntaxError && (err.status === 400 || err.type === 'entity.parse.failed')) {
    res.status(400).json({ error: 'invalid-json' });
    return;
  }

  // Upload rejected by multer itself (oversized file, too many parts, wrong
  // field name, ...) — surface as a clean 400 instead of falling through to
  // the generic 500 branch below.
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: `upload-rejected: ${err.code}` });
    return;
  }

  if (err instanceof VaultLockedError || err?.name === 'VaultLockedError') {
    res.status(423).json({ error: 'vault-locked' });
    return;
  }

  if (err instanceof TooManyRunsError) {
    res.setHeader('Retry-After', String(err.retryAfterSec));
    res.status(429).json({ error: 'too-many-runs' });
    return;
  }

  if (err instanceof PathTraversalError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof MissingCredentialError) {
    res.status(503).json({ error: 'missing-credential' });
    return;
  }

  // Cloud tenancy: a request that resolved no tenant (RLS fail-closed). Do NOT
  // leak err.message — it embeds the internal "runWithTenant" wording. Inert in
  // open-core mode (the local tenant always resolves).
  if (err instanceof NoTenantContextError || err?.name === 'NoTenantContextError') {
    res.status(401).json({ error: 'unauthenticated' });
    return;
  }

  // The caller's device is not enrolled, so it has no per-device vault. 428
  // Precondition Required signals the client to run device setup. Inert in
  // open-core mode (LocalVaultStore never throws this).
  if (err instanceof DeviceNotEnrolledError || err?.name === 'DeviceNotEnrolledError') {
    res.status(428).json({ error: 'device-not-enrolled' });
    return;
  }

  // BackupIntegrityError messages can embed absolute fs paths from yauzl/fs
  // errors — return a stable code; the full message is logged server-side only.
  if (err instanceof BackupIntegrityError) {
    logger.warn('backup-integrity-error', { message: err.message });
    res.status(err.statusCode ?? 400).json({ error: 'backup-integrity-error' });
    return;
  }

  if (
    err instanceof ProjectNotFoundError ||
    err instanceof RunNotFoundError ||
    err instanceof EntryNotFoundError ||
    err instanceof InvalidLanguageError ||
    err instanceof ValidationError ||
    err instanceof TemplateNotFoundError ||
    err instanceof ModuleNotFoundError ||
    err instanceof GlossaryNotFoundError ||
    err instanceof GlossaryTermNotFoundError ||
    err instanceof ReadOnlyGlossaryError ||
    err instanceof ForbiddenError ||
    err instanceof PreviewNotPossibleError ||
    err instanceof JudgeNotPossibleError ||
    err instanceof SourceReviewNotPossibleError ||
    err instanceof RelinkRetranslateNotPossibleError ||
    err instanceof GlossaryGenerateNotPossibleError ||
    err instanceof GlossaryTranslateNotPossibleError
  ) {
    res.status(err.statusCode ?? 500).json({ error: err.message });
    return;
  }

  // Log unexpected errors server-side, but never expose stack traces to clients
  logger.error('Unhandled error', { message: err.message, name: err.name });

  const statusCode = err.statusCode ?? 500;
  res.status(statusCode).json({ error: 'An internal error occurred' });
}
