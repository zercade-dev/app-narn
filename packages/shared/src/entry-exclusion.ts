/**
 * Single source of truth for "is this entry excluded from AI dispatch?".
 * Replaces the formerly-scattered `!entry.ignored` filters in the engines
 * (M9 translate, M25 judge, M26 source-review, M5 classifier, M28 glossary
 * generator) so the ignored + orphaned rules live in exactly one place.
 */
import type { StringEntry } from './types/string-entry.js';

/**
 * True when the entry must be excluded from every AI dispatch: the user
 * ignored it, or a full-replace CSV import orphaned it (`orphanedAt` set).
 * Structural `Pick` so callers can pass any StringEntry-shaped object.
 */
export function isExcludedFromAi(entry: Pick<StringEntry, 'ignored' | 'orphanedAt'>): boolean {
  return entry.ignored === true || entry.orphanedAt != null;
}
