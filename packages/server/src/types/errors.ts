export class ProjectNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Project not found: ${id}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class EntryNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`String entry not found: ${id}`);
    this.name = 'EntryNotFoundError';
  }
}

/**
 * A run could not be found for the caller — either it does not exist, or it
 * exists but is not visible under the named project (RLS hides another tenant's
 * project, and a run only resolves when `(project_id, run_id)` both match). The
 * two cases yield the SAME 404 by design (no existence leak), exactly as
 * ProjectNotFoundError does for projects. Thrown by `assertRunVisible`, the
 * cross-tenant gate the run-control routes apply before touching an engine.
 */
export class RunNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Run not found: ${id}`);
    this.name = 'RunNotFoundError';
  }
}

export class InvalidLanguageError extends Error {
  readonly statusCode = 400;

  constructor(code: string) {
    super(`Invalid language code: ${code}`);
    this.name = 'InvalidLanguageError';
  }
}

export class ValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export { MissingCredentialError, VaultLockedError } from '@zercade-dev/narn-shared';

export class ModuleNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Module not found: ${id}`);
    this.name = 'ModuleNotFoundError';
  }
}

export class GlossaryNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Glossary '${id}' not found`);
    this.name = 'GlossaryNotFoundError';
  }
}

export class GlossaryTermNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Glossary term not found: ${id}`);
    this.name = 'GlossaryTermNotFoundError';
  }
}

export class ReadOnlyGlossaryError extends Error {
  readonly statusCode = 403;

  constructor(id: string) {
    super(`Glossary '${id}' is read-only and cannot be modified`);
    this.name = 'ReadOnlyGlossaryError';
  }
}

/**
 * A project MEMBER attempted an action their role/writable-language set does
 * not grant. 403 — membership already grants read, so a 403 leaks nothing;
 * NON-members keep getting ProjectNotFoundError (404).
 */
export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(capability: string) {
    super(`forbidden: ${capability}`);
    this.name = 'ForbiddenError';
  }
}

export class TemplateNotFoundError extends Error {
  readonly statusCode = 404;

  constructor(id: string) {
    super(`Template not found: ${id}`);
    this.name = 'TemplateNotFoundError';
  }
}

export class BackupIntegrityError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = 'BackupIntegrityError';
  }
}

/**
 * A back-translation preview could not produce a reference: no enabled module,
 * the routed module vanished, the source entry no longer exists, or the model
 * returned no usable output. These are user-actionable conditions, not server
 * faults, so the central error handler surfaces them as 422 with the reason in
 * `message` (e.g. `no-enabled-module`, `entry-not-found: <id>`).
 */
export class PreviewNotPossibleError extends Error {
  readonly statusCode = 422;

  constructor(message: string) {
    super(message);
    this.name = 'PreviewNotPossibleError';
  }
}

/**
 * A tenant already has MAX_CONCURRENT_RUNS_PER_TENANT non-terminal runs in
 * flight (a per-tenant fairness cap). The central error handler surfaces it
 * as 429 with a Retry-After hint. `retryAfterSec` is advisory.
 */
export class TooManyRunsError extends Error {
  readonly statusCode = 429;
  readonly retryAfterSec: number;

  constructor(retryAfterSec = 10) {
    super('too-many-runs');
    this.name = 'TooManyRunsError';
    this.retryAfterSec = retryAfterSec;
  }
}

/**
 * The request resolved to a cloud identity but the caller's device is not
 * enrolled (no per-device vault row / no ambient deviceId), so a per-device
 * vault operation cannot proceed. The central error handler surfaces it as
 * HTTP 428 Precondition Required with the stable code `device-not-enrolled`,
 * the signal the client uses to prompt device setup. Inert in open-core mode:
 * LocalVaultStore has no device requirement, so it is never thrown there.
 */
export class DeviceNotEnrolledError extends Error {
  readonly statusCode = 428;
  readonly code = 'device-not-enrolled';

  constructor() {
    super('device-not-enrolled');
    this.name = 'DeviceNotEnrolledError';
  }
}
