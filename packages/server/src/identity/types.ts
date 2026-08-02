import type { Request, Response } from 'express';
import type { VaultFile } from '../modules/M18-vault.js';

/**
 * The resolved principal for a request. `userId` is a forward-compatible seam
 * for a future `can(identity, …)` authorization check — in v1 the only
 * producer is LocalIdentityProvider, which always sets `userId: 'local'`.
 * `sessionId` is the opaque token M16 CredentialStore keys its session map by;
 * it is OPTIONAL because an identity can exist without an unlocked-vault session
 * (the single-user `'local'` tenant is resolved even with no session cookie — e.g.
 * after a vault lock — so tenant-scoped reads keep working; the vault gate keys off
 * `sessionId` being present, so credential routes still 423 when it is absent).
 * `deviceId` identifies the caller's device for the per-device cloud vault —
 * set by CloudIdentityProvider, left undefined locally.
 */
export interface ResolvedIdentity {
  readonly userId: string;
  readonly sessionId?: string;
  readonly deviceId?: string;
}

/**
 * Port: "who is this request?". The default LocalIdentityProvider parses the
 * session cookie; a cloud composition root injects a CloudIdentityProvider at
 * boot. Async because cloud token verification (JWT against the identity
 * provider) is inherently async — locking the signature now avoids a breaking
 * port change later.
 */
export interface IdentityProvider {
  resolve(req: Request, res: Response): Promise<ResolvedIdentity | undefined>;
}

/**
 * Port: at-rest credential persistence (local adapter). The local adapter
 * reads/writes the encrypted `.translator-vault.json` envelope; a cloud
 * adapter is session-only with no at-rest file. M18 owns the crypto; this
 * port owns only where the envelope lives. `harden` tightens file
 * permissions at boot (a no-op for a fileless cloud adapter).
 */
export interface VaultStore {
  read(): Promise<VaultFile | undefined>;
  write(file: VaultFile): Promise<void>;
  exists(): Promise<boolean>;
  harden(): Promise<void>;
}
