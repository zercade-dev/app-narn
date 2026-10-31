import { sha256Hex } from './hash.js';

/**
 * Generates a stable SHA-256 entry ID from raw source text.
 * Case-sensitive, no trimming.
 * Same text always produces the same ID.
 */
export function generateEntryId(rawSourceText: string): string {
  return sha256Hex(rawSourceText);
}

/**
 * Entry ID for a client-collection string. Hashes the key and source text
 * together (unit-separator delimited) so a changed text yields a new entry,
 * and prefixes `client:` so it can never equal a main entry ID.
 */
export function generateClientEntryId(textKey: string, sourceText: string): string {
  return `client:${sha256Hex(`${textKey}\x1f${sourceText}`)}`;
}
