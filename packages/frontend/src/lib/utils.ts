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
 * Error message with a caller-supplied (typically localized) fallback. Use when
 * a thrown value isn't an `Error` and a generic JSON dump would be unhelpful in
 * the UI — e.g. `toast.error(errorMessage(err, t('runs.startFailed')))`.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
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
