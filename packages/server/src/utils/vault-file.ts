import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWrite } from './fs.js';
import type { VaultFile } from '../modules/M18-vault.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';
import { LOCAL_USER_ID } from '../identity/local-identity-provider.js';
import { resolveProjectPath } from './project-path.js';
import { getVaultFile } from '../config/env.js';

/**
 * Root directory holding the per-TENANT vault files. Each tenant's vault
 * lives at `<cwd>/.translator-vault/<tenantId>.json` so a single shared
 * filesystem can never serve one tenant's encrypted credentials from a fixed
 * global path (the cross-tenant leak the multi-tenant migration closes). In
 * single-user/local mode the tenant is `'local'`, so this resolves to
 * `<cwd>/.translator-vault/local.json`.
 *
 * CWD is packages/server/ for both `pnpm dev` and `start:secure`.
 */
const VAULT_DIR = path.resolve(process.cwd(), '.translator-vault');

/**
 * On-disk location of the encrypted credential vault. Shared single source of
 * truth so the vault router (read/write/harden) and the modules router (the
 * tri-state credential-status probe) agree on the same file. Defaults to the
 * tenant-scoped `<cwd>/.translator-vault/<tenantId>.json`; overridden wholesale
 * by `VAULT_FILE` (which takes precedence and is NOT tenant-qualified — it is an
 * explicit operator override for the single-user/local deployment).
 *
 * The tenant is sourced from the ambient `TenantContext` (`getCurrentTenant`) so
 * a request param can never spoof it; it falls back to `LOCAL_USER_ID`
 * ('local') OFF a request — e.g. the boot-time `harden()` — so local mode keeps
 * a stable path. (Cloud mode replaces `LocalVaultStore` with the DB-backed,
 * fileless CloudVaultStore, so this file path is only ever exercised locally,
 * where the tenant is always 'local'.)
 */
export function vaultPath(): string {
  const override = getVaultFile();
  if (override) return override;
  const tenantId = getCurrentTenant()?.userId ?? LOCAL_USER_ID;
  // Validate `tenantId` as a single safe path segment (defense-in-depth: it is
  // the RLS tenant, but this keeps the dir layout traversal-proof).
  return resolveProjectPath(VAULT_DIR, `${tenantId}.json`);
}

/**
 * Legacy single-user vault location: `<cwd>/.translator-vault.json` (a
 * FILE, not the per-tenant dir). READ-ONLY fallback so an existing LOCAL install
 * keeps its vault after upgrading to the tenant-scoped layout — the first
 * `writeVaultFile` migrates it forward to the scoped path, after which this is
 * never consulted again. Only used in local mode (tenant === LOCAL_USER_ID) with
 * no `VAULT_FILE` override; never in cloud/multi-tenant mode.
 */
const LEGACY_LOCAL_VAULT_FILE = path.resolve(process.cwd(), '.translator-vault.json');

/**
 * The path the readers should open: the scoped `vaultPath()` normally; but in
 * local mode with no scoped file yet AND a legacy file present, the legacy file
 * (one-time upgrade bridge). Returns the scoped path otherwise so ENOENT still
 * means "no vault".
 */
async function resolveReadPath(): Promise<string> {
  const scoped = vaultPath();
  if (getVaultFile()) return scoped; // explicit override: no fallback
  const tenantId = getCurrentTenant()?.userId ?? LOCAL_USER_ID;
  if (tenantId !== LOCAL_USER_ID) return scoped; // cloud/multi-tenant: never fall back
  const scopedExists = await fs.access(scoped).then(
    () => true,
    () => false,
  );
  if (scopedExists) return scoped;
  const legacyExists = await fs.access(LEGACY_LOCAL_VAULT_FILE).then(
    () => true,
    () => false,
  );
  return legacyExists ? LEGACY_LOCAL_VAULT_FILE : scoped;
}

/**
 * Whether the vault file currently exists on disk. Used by the modules router to
 * distinguish a missing vault ('missing' credential status) from one that exists
 * but is locked ('vault-locked').
 */
export async function vaultFileExists(): Promise<boolean> {
  try {
    const p = await resolveReadPath();
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function readVaultFile(): Promise<VaultFile | undefined> {
  try {
    const p = await resolveReadPath();
    const text = await fs.readFile(p, 'utf8');
    return JSON.parse(text) as VaultFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

export async function writeVaultFile(vault: VaultFile): Promise<void> {
  const p = vaultPath();
  // Only create the parent when it is actually missing: under Node's
  // permission model (`start:secure`) mkdir throws even for an existing
  // directory, and the server's own cwd is deliberately not writable.
  const dir = path.dirname(p);
  const dirExists = await fs.access(dir).then(
    () => true,
    () => false,
  );
  if (!dirExists) await fs.mkdir(dir, { recursive: true });
  await atomicWrite(p, vault);
}
