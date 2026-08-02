/**
 * Public identity/credential seam surface (ports & adapters).
 *
 * A cloud composition root injects cloud adapters at boot WITHOUT forking the app:
 *
 *   import { setIdentityProvider, setVaultStore } from '@zercade-dev/narn-server/identity';
 *   setIdentityProvider(new CloudIdentityProvider(...));   // async resolve
 *   setVaultStore(new CloudVaultStore(...));                // session-only, no file
 *   const { start } = await import('@zercade-dev/narn-server');   // importing no longer auto-listens
 *   await start();                                          // explicitly start the server
 *
 * Providers are read per-request (identity) and per-operation (vault store),
 * so registration only has to happen before traffic, not before app.listen.
 * The public app never imports a cloud adapter — only these ports.
 */
export type { ResolvedIdentity, IdentityProvider, VaultStore } from './types.js';
export { LocalIdentityProvider, LOCAL_USER_ID } from './local-identity-provider.js';
export { LocalVaultStore } from './local-vault-store.js';
export {
  SESSION_COOKIE_NAME,
  parseSessionCookie,
  sessionCookie,
  clearSessionCookie,
} from './session-cookie.js';
export { clientIp } from '../middleware/client-ip.js';
export {
  getIdentityProvider,
  setIdentityProvider,
  getVaultStore,
  setVaultStore,
  isCloudMode,
  __resetIdentityForTests,
} from './registry.js';

// Cloud-vault seam: a cloud composition root's vault store + vault routes need
// the M18 envelope type (the VaultStore port's data shape) and the M16 credential
// cache (to load decrypted keys into the per-session store after a cloud unlock).
// Re-exported here so a cloud composition root never deep-imports narn internals.
export type { VaultFile } from '../modules/M18-vault.js';
export { credentialStore } from '../modules/M16-credential-store.js';

// Cloud vault store throws this when the caller's device is not enrolled; the
// open-core error handler maps it to 428. Re-exported here so a cloud
// composition root never deep-imports narn internals.
export { DeviceNotEnrolledError } from '../types/errors.js';
