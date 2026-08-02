import { sha256Hex } from './hash.js';

/**
 * Generates a stable SHA-256 entry ID from raw source text.
 * Case-sensitive, no trimming.
 * Same text always produces the same ID.
 */
export function generateEntryId(rawSourceText: string): string {
  return sha256Hex(rawSourceText);
}
