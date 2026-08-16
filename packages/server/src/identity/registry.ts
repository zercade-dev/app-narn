import type { IdentityProvider, VaultStore } from './types.js';
import { LocalIdentityProvider } from './local-identity-provider.js';
import { LocalVaultStore } from './local-vault-store.js';
import { setCloudModeResolver, isCloudMode } from './cloud-mode.js';

/**
 * Boot-time registration seam. Defaults to the local adapters so the public
 * app runs standalone exactly as today; a cloud composition root calls
 * setIdentityProvider(...) at boot to inject a CloudIdentityProvider without
 * forking. Providers are read per-request, so registration may happen any
 * time before traffic.
 */
let identityProvider: IdentityProvider = new LocalIdentityProvider();

export function getIdentityProvider(): IdentityProvider {
  return identityProvider;
}

export function setIdentityProvider(provider: IdentityProvider): void {
  identityProvider = provider;
}

/**
 * Boot-time registration seam for at-rest credential persistence. Defaults to
 * the local `.translator-vault.json` adapter so the public app persists
 * credentials on disk exactly as today; a cloud composition root calls
 * setVaultStore(...) at boot to inject a session-only cloud adapter without
 * forking.
 */
let vaultStore: VaultStore = new LocalVaultStore();

export function getVaultStore(): VaultStore {
  return vaultStore;
}

export function setVaultStore(store: VaultStore): void {
  vaultStore = store;
}

/**
 * True when a non-local identity provider OR vault store has been installed —
 * i.e. a cloud composition root injected a cloud adapter. The eager defaults
 * are the `Local*` adapters, so an `instanceof` check needs no extra flag and
 * stays correct across `__resetIdentityForTests()` (which reinstalls the
 * locals). Open-core boot never calls a setter, so this stays `false` and
 * every cloud-gated branch that reads it is inert.
 *
 * Registered into `cloud-mode.js` below and re-exported from there, so callers
 * inside this module's own import chain (M15's logger, reached via the local
 * vault store) can read cloud mode without closing an import cycle — see that
 * file for why the cycle is harmful. `isCloudMode` therefore stays a single
 * function under a single name; only the import path differs.
 */
function resolveCloudMode(): boolean {
  return (
    !(identityProvider instanceof LocalIdentityProvider) || !(vaultStore instanceof LocalVaultStore)
  );
}

setCloudModeResolver(resolveCloudMode);

export { isCloudMode };

/** Test seam — restores the local defaults between tests. */
export function __resetIdentityForTests(): void {
  identityProvider = new LocalIdentityProvider();
  vaultStore = new LocalVaultStore();
}
