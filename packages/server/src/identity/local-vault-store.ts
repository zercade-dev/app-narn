import { promises as fs } from 'node:fs';
import type { VaultFile } from '../modules/M18-vault.js';
import type { VaultStore } from './types.js';
import { readVaultFile, writeVaultFile, vaultFileExists, vaultPath } from '../utils/vault-file.js';

/**
 * Default VaultStore adapter: the at-rest credential vault file. Wraps the
 * existing utils/vault-file helpers so local mode persists credentials on disk
 * exactly as today (the default path is now tenant-scoped —
 * `<cwd>/.translator-vault/<tenantId>.json`, `local.json` in single-user mode
 * — and `VAULT_FILE` still overrides it wholesale). `harden` is the former
 * hardenVaultFilePermissions (best-effort chmod 0o600; a missing file is fine).
 */
export class LocalVaultStore implements VaultStore {
  read(): Promise<VaultFile | undefined> {
    return readVaultFile();
  }
  write(file: VaultFile): Promise<void> {
    return writeVaultFile(file);
  }
  exists(): Promise<boolean> {
    return vaultFileExists();
  }
  async harden(): Promise<void> {
    await fs.chmod(vaultPath(), 0o600).catch(() => undefined);
  }
}
