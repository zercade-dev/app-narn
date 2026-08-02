/**
 * Shared domain error classes that may be raised by either the server or by
 * pluggable translation modules. Defined here (rather than in `@zercade-dev/narn-server`)
 * so module packages can throw typed errors without taking a dependency on the
 * server package.
 */

export class MissingCredentialError extends Error {
  readonly statusCode = 503;
  readonly missing: readonly string[];

  constructor(missing: string | readonly string[]) {
    const list = typeof missing === 'string' ? [missing] : Array.from(missing);
    super('Missing required credential');
    this.name = 'MissingCredentialError';
    this.missing = list;
  }
}

/**
 * Raised when a request requires a credential whose value lives in the
 * encrypted local vault and the vault has not been unlocked for the current
 * browser session. Mapped to HTTP 423 (Locked) by the server.
 */
export class VaultLockedError extends Error {
  readonly statusCode = 423;

  constructor(message = 'Credential vault is locked') {
    super(message);
    this.name = 'VaultLockedError';
  }
}

/**
 * Raised by a translation module when an upstream provider responds with a
 * rate-limit signal (HTTP 429 or equivalent). The message intentionally
 * contains the literal `rate limit` token so the translation engine's retry
 * regex `/429|rate.?limit/i` matches without inspecting the class itself.
 *
 * `retryAfterMs` carries the provider-supplied `Retry-After` value (converted
 * to milliseconds) when present, allowing the engine to back off precisely.
 */
export class RateLimitError extends Error {
  readonly statusCode = 429;
  readonly retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number) {
    const normalized =
      /rate.?limit/i.test(message) || /429/.test(message) ? message : `${message} (rate limit)`;
    super(normalized);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Raised when an upstream provider rejects a request because the credential is
 * invalid (HTTP 401 Unauthorized) or not permitted (HTTP 403 Forbidden). Unlike
 * a rate limit, this is not retryable and affects every job using that
 * credential, so the translation engine cancels the whole run on encountering
 * one. The message is normalized to contain the literal status code so consumers
 * that only see a downgraded error *string* (e.g. a per-result `error`) can
 * still detect it via `/\b401\b|\b403\b/`.
 */
export class AuthError extends Error {
  readonly statusCode: 401 | 403;

  constructor(message: string, statusCode: 401 | 403 = 401) {
    const normalized = new RegExp(`\\b${statusCode}\\b`).test(message)
      ? message
      : `${message} (${statusCode})`;
    super(normalized);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
