import type { LogEntry, PresentedLog, Translate } from './types.js';
import { fallbackText } from './fallback.js';
import { LOG_PRESENTERS } from './registry.js';

/**
 * Render one log entry as user-facing text. A registry hit authors the whole
 * line; anything else degrades through `fallbackText`.
 */
export function presentEntry(entry: LogEntry, t: Translate): PresentedLog {
  const presenter = LOG_PRESENTERS[entry.message];
  if (!presenter) {
    return { text: fallbackText(entry.message), isFallback: true };
  }
  const meta = entry.metadata ?? {};
  const key = typeof presenter.key === 'function' ? presenter.key(meta) : presenter.key;
  return {
    text: t(key, presenter.vars?.(meta)),
    action: presenter.action?.(meta),
    isFallback: false,
  };
}
