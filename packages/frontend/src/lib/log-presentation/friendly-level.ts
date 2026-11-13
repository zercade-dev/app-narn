import type { ConsoleFilter } from '../../stores/ui-settings-store.js';
import { LOG_PRESENTERS } from './registry.js';
import { isRawOnly } from './raw-only.js';
import type { LogEntry } from './types.js';

/** The level a line has in the Friendly console; `hidden` lines are Raw-only. */
export type FriendlyLevel = LogEntry['level'] | 'hidden';

/**
 * Raw-only lines are hidden. A presenter's `friendly` field then wins over the
 * entry's own level, so run bookkeeping can be demoted to debug.
 */
export function friendlyLevel(entry: LogEntry): FriendlyLevel {
  const presenter = LOG_PRESENTERS[entry.message];
  if (presenter?.friendly === 'hidden') return 'hidden';
  if (presenter?.friendly === 'debug') return 'debug';
  if (isRawOnly(entry)) return 'hidden';
  return entry.level;
}

/**
 * Friendly tabs: `info` is "Info & up" (info, warn, error, notification);
 * `all` adds demoted lines; `debug` shows only demoted lines. Hidden lines
 * never match.
 */
export function matchesFriendlyFilter(level: FriendlyLevel, filter: ConsoleFilter): boolean {
  if (level === 'hidden') return false;
  switch (filter) {
    case 'all':
      return true;
    case 'info':
      return level !== 'debug';
    case 'notifications':
      return level === 'notification';
    default:
      return level === filter;
  }
}

/** Event keys the Friendly console demotes to debug, derived from the registry. */
export const FRIENDLY_DEMOTED_KEYS: readonly string[] = Object.entries(LOG_PRESENTERS)
  .filter(([, p]) => p.friendly === 'debug')
  .map(([k]) => k);
