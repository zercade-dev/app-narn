/**
 * M18 — Vault Crypto Primitives
 *
 * Pure AES-256-GCM + PBKDF2-SHA256 helpers used to encrypt the local
 * credential vault file. No filesystem I/O lives here — callers in
 * `routes/vault.ts` handle reads/writes.
 *
 * On-disk format (JSON):
 *   {
 *     "version": 1,
 *     "kdf": "pbkdf2-sha256",
 *     "iterations": <n>,
 *     "salt": "<base64>",
 *     "iv": "<base64>",
 *     "ciphertext": "<base64>",
 *     "tag": "<base64>",
 *     "name": "<optional display name, plaintext>"
 *   }
 *
 * `name` is a user-chosen label for this vault (e.g. "Personal", "Work"). It
 * is NOT secret, so it lives in plaintext alongside the encrypted blob (never
 * inside the encrypted payload) precisely so the server can surface it on
 * `/api/vault/status` without decrypting, even while the vault is locked.
 *
 * The plaintext payload is `{ credentials: Record<string,string> }` JSON.
 */
import { pbkdf2 as pbkdf2Cb, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2 = promisify(pbkdf2Cb);

export const VAULT_KDF_ITERATIONS = 600_000;
const KEY_LENGTH_BYTES = 32; // AES-256
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12; // GCM standard

/**
 * Accepted PBKDF2 iteration bounds for a vault file. The on-disk `iterations`
 * is file-controlled and fed straight into PBKDF2, so a tampered/corrupt vault
 * with an absurd value (e.g. 5e9) would hang the libuv threadpool on unlock.
 * Clamp the *accepted* range to sane values — anything outside is treated as a
 * decrypt failure rather than honoured. The lower bound also rejects a vault
 * weakened below a usable work factor.
 */
const MIN_KDF_ITERATIONS = 100_000;
const MAX_KDF_ITERATIONS = 5_000_000;

export interface VaultFile {
  version: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
  /** base64 */
  ciphertext: string;
  /** base64 */
  tag: string;
  /**
   * Optional user-chosen display name for this vault (e.g. "Personal",
   * "Work"). Plaintext, non-secret metadata — never part of the encrypted
   * payload — so it survives every re-encrypt only when callers thread it
   * through explicitly (see `encryptVault`'s `name` parameter).
   */
  name?: string;
}

export interface VaultPayload {
  credentials: Record<string, string>;
}

export async function deriveKey(
  password: string,
  salt: Buffer,
  iterations: number = VAULT_KDF_ITERATIONS,
): Promise<Buffer> {
  return pbkdf2(password, salt, iterations, KEY_LENGTH_BYTES, 'sha256');
}

export async function encryptVault(
  payload: VaultPayload,
  password: string,
  name?: string,
): Promise<VaultFile> {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const key = await deriveKey(password, salt);

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations: VAULT_KDF_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
    ...(name ? { name } : {}),
  };
}

export async function decryptVault(file: VaultFile, password: string): Promise<VaultPayload> {
  if (file.version !== 1 || file.kdf !== 'pbkdf2-sha256') {
    throw new Error('vault-decrypt-failed');
  }
  if (
    !Number.isInteger(file.iterations) ||
    file.iterations < MIN_KDF_ITERATIONS ||
    file.iterations > MAX_KDF_ITERATIONS
  ) {
    throw new Error('vault-decrypt-failed');
  }
  const salt = Buffer.from(file.salt, 'base64');
  const iv = Buffer.from(file.iv, 'base64');
  const tag = Buffer.from(file.tag, 'base64');
  const ciphertext = Buffer.from(file.ciphertext, 'base64');
  const key = await deriveKey(password, salt, file.iterations);

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString('utf-8')) as VaultPayload;
    // `typeof null === 'object'`, so a payload shaped `{ credentials: null }`
    // would otherwise pass this guard and later hit `Object.entries(null)` (a
    // 500) instead of the mapped vault-decrypt-failed error. Require a
    // non-null object explicitly.
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.credentials === null ||
      typeof parsed.credentials !== 'object'
    ) {
      throw new Error('vault-decrypt-failed');
    }
    return parsed;
  } catch {
    throw new Error('vault-decrypt-failed');
  }
}

export async function createEmptyVaultFile(password: string, name?: string): Promise<VaultFile> {
  return encryptVault({ credentials: {} }, password, name);
}
