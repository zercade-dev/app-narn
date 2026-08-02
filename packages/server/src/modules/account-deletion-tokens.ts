import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { getPool, TenantDb } from '../storage/pg/pool.js';
import { requireTenant } from '../storage/pg/tenant-context.js';

/**
 * Cloud account-deletion one-time tokens (mint / consume).
 *
 * The possession factor for irreversible account deletion: a short-lived,
 * single-use code is emailed to the user, then presented back to confirm the
 * delete (anti-session-theft). Stored HASHED (sha256) at rest in
 * `account_deletion_tokens` (migration 0013) — one pending token per user
 * (PK = user_id), so a re-request replaces the prior. USER-scoped RLS: every
 * statement runs through a `TenantDb`, so it is scoped to the current tenant
 * (`current_setting('app.user_id')`, never a request param) and fails closed
 * (NoTenantContextError) off-request. Both entry points also `requireTenant()`
 * up front so mint never generates a token it can't persist.
 */

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Crockford-ish base32, restricted to a strict subset of `[A-Z2-7]`: drops the
// visually ambiguous letters I/L/O/U and the digits 0/1/8/9. 28 symbols ×
// 10 chars ≈ 48 bits — ample for a single-use, 15-min, one-per-user code.
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ234567';
const TOKEN_LEN = 10;

/**
 * A random `TOKEN_LEN`-char token drawn from `ALPHABET`.
 *
 * Uses `randomInt(ALPHABET.length)` (a uniform rejection-sampled draw) rather
 * than `randomBytes(...)[i] % ALPHABET.length` — the modulo form is biased
 * toward the low symbols of the alphabet (256 % 28 !== 0), which would skew
 * this token's distribution and reduce its effective entropy below the
 * intended ~48 bits.
 */
function generateToken(): string {
  let out = '';
  for (let i = 0; i < TOKEN_LEN; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** sha256 hex digest of the plaintext token (what is stored / compared). */
function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Generate a fresh deletion token for the current tenant, persist its hash +
 * expiry (replacing any prior pending token), and return the PLAINTEXT token —
 * the only time it is available in the clear. `ttlMs` defaults to 15 min; a
 * negative value yields an already-expired token (used by tests).
 */
export async function mintDeletionToken(opts?: { ttlMs?: number }): Promise<string> {
  requireTenant(); // fail closed before generating anything
  const token = generateToken();
  const tokenHash = hashToken(token);
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  const db = new TenantDb(getPool());
  await db.query(
    `insert into account_deletion_tokens (user_id, token_hash, expires_at, created_at)
       values (current_setting('app.user_id'), $1, now() + ($2::text || ' milliseconds')::interval, now())
     on conflict (user_id) do update set token_hash = excluded.token_hash,
       expires_at = excluded.expires_at, created_at = excluded.created_at`,
    [tokenHash, String(ttl)],
  );
  return token;
}

/**
 * Consume the current tenant's pending deletion token. Returns true iff a
 * matching, non-expired token exists — in which case the row is deleted
 * (single-use). The hash compare is constant-time. Expired (but otherwise
 * matching) tokens are deleted as a side effect and rejected. Must run inside
 * `runWithTenant`.
 */
export async function consumeDeletionToken(token: string): Promise<boolean> {
  requireTenant();
  const db = new TenantDb(getPool());
  const { rows } = await db.query<{ token_hash: string; expired: boolean }>(
    `select token_hash, (expires_at <= now()) as expired
       from account_deletion_tokens where user_id = current_setting('app.user_id')`,
  );
  if (rows.length === 0) return false;
  const row = rows[0];
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(row.token_hash, 'hex');
  const matches = a.length === b.length && timingSafeEqual(a, b);
  if (!matches || row.expired) {
    // Reap an expired-but-matching token so it can't linger; leave a non-match
    // in place (a wrong guess must not evict the legitimate pending token).
    if (row.expired) {
      await db.query(
        `delete from account_deletion_tokens where user_id = current_setting('app.user_id')`,
      );
    }
    return false;
  }
  await db.query(
    `delete from account_deletion_tokens where user_id = current_setting('app.user_id')`,
  ); // single-use
  return true;
}
