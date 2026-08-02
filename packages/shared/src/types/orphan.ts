import type { StringEntry } from './string-entry.js';

/**
 * A string entry that exists in the project store but is no longer present in
 * the most recently imported CSV. Carries a precomputed `translationCount`
 * (number of non-empty translation records) so UI can sort by "effort to redo".
 */
export interface OrphanEntry extends StringEntry {
  translationCount: number;
}
