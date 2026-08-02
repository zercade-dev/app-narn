import { createHash } from 'node:crypto';

/**
 * SHA-256 hex digest of a string or Buffer. The single shared crypto primitive
 * the domain wrappers (`generateEntryId`, `hashMaskedSource`, M13's backup
 * file hash) delegate to so there is one hashing implementation of record.
 */
export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}
