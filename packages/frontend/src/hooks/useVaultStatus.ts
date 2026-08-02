/**
 * useVaultStatus — convenience hook returning vault status from the store and
 * automatically refreshing once on first mount.
 *
 * The one-shot guard lives in the vault store (`refreshStatusOnce`) rather than
 * a module-level boolean, so it is observable, resets with the store, and does
 * not silently couple unrelated components across HMR reloads or test runs.
 */
import { useEffect } from 'react';
import { useVaultStore } from '../stores/vault-store.js';

export function useVaultStatus() {
  const unlocked = useVaultStore((s) => s.unlocked);
  const hasVault = useVaultStore((s) => s.hasVault);
  const keys = useVaultStore((s) => s.keys);
  const name = useVaultStore((s) => s.name);
  const loading = useVaultStore((s) => s.loading);
  const refresh = useVaultStore((s) => s.refresh);
  const refreshStatusOnce = useVaultStore((s) => s.refreshStatusOnce);

  useEffect(() => {
    refreshStatusOnce();
  }, [refreshStatusOnce]);

  return { unlocked, hasVault, keys, name, loading, refresh };
}
