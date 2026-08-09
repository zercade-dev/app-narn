import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from '../i18n/index.js';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a human-readable, localized relative time string for a past date,
 * e.g. "5m ago" in English, "hace 5 min" in Spanish, "il y a 5 min" in French.
 * Uses `Intl.RelativeTimeFormat` (narrow style, matching the previous
 * "5m ago"-shaped English output) instead of hardcoding English text, so the
 * result follows the active UI language. Defaults to the current i18next
 * language; pass `locale` to override (e.g. from a context without a live
 * i18next instance).
 */
export function relativeTime(date: Date, locale: string = i18n.language): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) {
    // `numeric: 'auto'` special-cases zero as "now" / "ahora" / "maintenant"
    // instead of "0s ago", mirroring the previous "just now" bucket.
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' }).format(
      0,
      'second',
    );
  }
  const rtf = new Intl.RelativeTimeFormat(locale, { style: 'narrow' });
  const mins = Math.floor(secs / 60);
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.floor(hours / 24), 'day');
}

/** Extracts a human-readable error message from an unknown error value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'An unknown error occurred';
  }
}

/**
 * i18n keys in the `errors` namespace for the HTTP statuses worth naming.
 *
 * `httpStatus()` below duck-types the status instead of `instanceof ApiError`
 * — `hooks/use-api.ts` imports from this module (`downloadBlob`, `randomId`),
 * so importing `ApiError` from `use-api.js` here would create an import cycle.
 */
const HTTP_ERROR_KEYS: Record<number, string> = {
  401: 'errors:http.unauthorized',
  403: 'errors:http.forbidden',
  423: 'errors:http.vaultLocked',
  429: 'errors:http.rateLimited',
};

/** Duck-types an `ApiError`-shaped value's `status` without importing the class. */
function httpStatus(error: unknown): number | undefined {
  return typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined;
}

/**
 * User-facing text for a caught error, given a caller-supplied localized
 * fallback. Use when a thrown value isn't handled specially and a generic
 * JSON dump would be unhelpful in the UI — e.g.
 * `toast.error(errorMessage(err, t('runs.startFailed')))`.
 *
 * The raw `error.message` is deliberately never the headline: it is server or
 * runtime text ("ECONNREFUSED", a zod dump) that means nothing to a user. When
 * `t` is supplied, a recognised `ApiError`-shaped status produces specific
 * wording; otherwise the caller's fallback stands. Raw detail belongs in a
 * description slot via {@link technicalDetail}, or in the console, which
 * keeps everything.
 */
export function errorMessage(error: unknown, fallback: string, t?: (key: string) => string): string {
  if (t) {
    const status = httpStatus(error);
    if (status !== undefined) {
      const key = HTTP_ERROR_KEYS[status] ?? (status >= 500 ? 'errors:http.server' : undefined);
      if (key) return t(key);
    }
  }
  return fallback;
}

/** Raw error text for a description slot or a details disclosure. */
export function technicalDetail(error: unknown): string | undefined {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return undefined;
}

/**
 * A short unique id. Prefers `crypto.randomUUID()` and falls back to a
 * timestamp+random recipe in environments where it is unavailable. Used for
 * vault-retry correlation ids and notification ids.
 */
export function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

/** Triggers a file download from a Blob in the browser. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Defer revocation so the click-triggered download navigation has begun
  // before the object URL is freed; revoking in the same tick can intermittently
  // abort or empty the download for large blobs in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
