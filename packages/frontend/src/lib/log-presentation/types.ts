import type { LogEntry } from '../../stores/logger-store.js';

/** Raw metadata carried on a log entry. */
export type LogMeta = Record<string, unknown>;

/** A one-click route to the screen where a logged problem is fixed. */
export interface LogAction {
  /** Key in the `logs` i18n namespace for the link label. */
  labelKey: string;
  run: () => void;
}

/**
 * How one event key is presented. A presenter authors the whole line and
 * interpolates only the metadata fields it names, which is why correlation ids
 * never need an explicit denylist on this path.
 */
export interface LogPresenter {
  /**
   * Key in the `logs` namespace. A function when one event fans out by
   * metadata — `translation:failed` splits on `metadata.error`.
   */
  key: string | ((meta: LogMeta) => string);
  /** Interpolation values pulled out of raw metadata. */
  vars?: (meta: LogMeta) => Record<string, unknown>;
  /** Extra grouping discriminator beyond level + event key. */
  groupKey?: (meta: LogMeta) => string;
  /** Optional quick action offered on the row. */
  action?: (meta: LogMeta) => LogAction | undefined;
}

export interface PresentedLog {
  text: string;
  action?: LogAction;
  /** True when the fallback produced this. Drives no styling; aids tests. */
  isFallback: boolean;
}

/**
 * Minimal translator shape, so the presentation layer does not couple to
 * i18next's TFunction generics and stays trivially testable.
 */
export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export type { LogEntry };
