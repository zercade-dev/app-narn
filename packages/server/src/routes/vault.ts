import { Router, type Request } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { validateBody } from '../middleware/validate.js';
import { credentialStore } from '../modules/M16-credential-store.js';
import { maskSecret } from '@zercade-dev/narn-shared';
import { validatePasswordStrength } from '../utils/password-validation.js';
import { createEmptyVaultFile, decryptVault, encryptVault } from '../modules/M18-vault.js';
import { getSessionId, getIdentity } from '../middleware/session.js';
import { auditLogger } from '../services/audit-logger.js';
import { logger } from '../modules/M15-console-logger.js';
import { asyncHandler } from '../http/index.js';
import { getVaultStore, isCloudMode } from '../identity/registry.js';
import { DeviceNotEnrolledError } from '../types/errors.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { sessionCookie, clearSessionCookie } from '../identity/session-cookie.js';
import { clientIp } from '../middleware/client-ip.js';
import { getCurrentTenant } from '../storage/pg/tenant-context.js';
import { isRateLimitDisabled } from '../config/env.js';

export const vaultRouter: Router = Router();

/**
 * Key for the M16 failed-unlock lockout bucket. Mirrors the rate-limiter's
 * `rateLimitKey`: in cloud mode the tenant id, so tenants behind the
 * shared cloud proxy each get their own lockout instead of collapsing onto the
 * proxy IP (one tenant's failed unlocks would otherwise lock out everyone).
 * Open-core / pre-auth: `getCurrentTenant()` is undefined → plain client IP →
 * unchanged single-user behavior. The identity middleware has already resolved
 * the tenant before this route in cloud mode.
 */
export function lockoutKey(req: Request): string {
  if (isCloudMode()) {
    const tenant = getCurrentTenant();
    if (tenant?.userId) return tenant.userId;
  }
  return clientIp(req);
}

/** Sensible default when the create-vault form's name field is left blank. */
const DEFAULT_VAULT_NAME = 'My Vault';

const unlockSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
  // Only meaningful on FIRST unlock (vault creation) — see the `!vault` branch
  // below. Ignored (never overwrites an existing vault's name) once a vault
  // already exists.
  name: z.string().trim().max(100).optional(),
});
const credentialUpdateSchema = z.object({
  updates: z.record(z.string(), z.string().nullable()),
});

// Anti-password-brute-force guard shared by /unlock and /change-password. The
// vault's own failed-unlock lockout (M16's LOCKOUT_THRESHOLD / LOCKOUT_WINDOW_MS)
// engages independently of this window.
const vaultUnlockRateLimiter = rateLimiter({ maxRequests: 20, windowMs: 60_000 });

/** True for the cloud "device not enrolled" failure (DeviceNotEnrolledError). */
function isDeviceNotEnrolled(err: unknown): boolean {
  return (
    err instanceof DeviceNotEnrolledError ||
    (err as { code?: string } | null)?.code === 'device-not-enrolled'
  );
}

// TEST-ONLY lockout reset for the e2e harness. Specs that exercise the lockout UX
// (e.g. vault-unlock-wrong-password / vault-unlock-lockout) deliberately trip the
// per-IP failed-unlock lockout; because every e2e request shares 127.0.0.1 and
// the lockout is keyed per-IP, a tripped lockout would 429 the Before-hook unlock
// of every subsequent spec on that worker. This route lets the harness clear
// the *caller's own* lockout bucket between specs. It is registered ONLY when
// RATE_LIMIT_DISABLED=1 — the same flag that no-ops the unlock rate limiter above
// (an e2e/test server). In production the flag is unset, so this route is never
// registered and returns 404: no added attack surface, and it can only ever clear
// the requester's own anti-brute-force counter, never read or bypass the vault.
//
// ALSO require !isCloudMode(), so this unauthenticated lockout-reset is
// NEVER registered on a multi-tenant cloud host even if RATE_LIMIT_DISABLED
// leaks into that environment — mirroring how the on-disk audit-file routes 404
// in cloud (routes/logs.ts blockAuditFilesInCloud). Evaluated at module load,
// which is after the cloud composition root has wired its adapter.
if (isRateLimitDisabled() && !isCloudMode()) {
  vaultRouter.post('/test-reset-lockout', (req, res) => {
    credentialStore.resetFailedUnlock(clientIp(req));
    res.json({ reset: true });
  });
}

vaultRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const sid = getSessionId(res);
    let vault;
    try {
      vault = await getVaultStore().read();
    } catch (err) {
      // In cloud mode, a not-yet-enrolled device has no per-device vault row.
      // Fail soft so the client can render "set up this device" instead of an
      // error. Inert in open-core mode (LocalVaultStore never throws this).
      if (isDeviceNotEnrolled(err)) {
        // A DEAD/EXPIRED session lands here too: with no identity there is no
        // tenant context, so the cloud store throws the same DeviceNotEnrolledError
        // as an authenticated-but-unenrolled device. These need OPPOSITE outcomes —
        // an unenrolled device → "set up this device" (/vault), but an expired
        // session → re-authenticate (/login). Distinguish by identity: no identity
        // → 401 unauthenticated, which the SPA interceptor turns into a silent
        // /auth/refresh and, failing that, a /login redirect. Inert in open-core
        // (LocalIdentityProvider always resolves an identity, so this never fires).
        if (!getIdentity(res)) {
          res.status(401).json({ error: 'unauthenticated' });
          return;
        }
        res.json({
          hasVault: false,
          setupRequired: true,
          unlocked: false,
          keys: [],
          // DeviceNotEnrolledError is cloud-only, so this branch is always cloud:
          // surface cloudManaged here too, keeping the SPA's cloud signal
          // consistent across every /status shape (gates the sign-out button).
          cloudManaged: true,
        });
        return;
      }
      throw err;
    }
    res.json({
      unlocked: sid ? credentialStore.isUnlocked(sid) : false,
      hasVault: vault !== undefined,
      keys: sid ? credentialStore.listKeys(sid) : [],
      // In cloud mode, the SPA delegates credential-management / change-passphrase
      // to the /vault page (the open-core /api/vault/* writes target a pbkdf2
      // vault, incompatible with the device-bound argon2id envelope). A SERVER
      // discriminator (not a client flag) — false under the local defaults.
      cloudManaged: isCloudMode(),
      // Plaintext vault metadata (never secret) — surfaced even while locked so
      // the SPA can label the vault before the password is entered.
      name: vault?.name,
    });
  }),
);

vaultRouter.post(
  '/unlock',
  vaultUnlockRateLimiter,
  validateBody(unlockSchema),
  asyncHandler(async (req, res) => {
    const { password, name } = req.body as z.infer<typeof unlockSchema>;

    // Validate password strength
    const validation = validatePasswordStrength(password);
    if (!validation.isValid) {
      res.status(400).json({ error: 'weak-password', details: validation.errors });
      return;
    }
    // Per-tenant (cloud) / per-IP (open-core) lockout bucket: one client's
    // failed attempts must not lock out others once the server is public.
    // Behind the cloud proxy all tenants share the proxy IP, so the bucket
    // keys on the tenant id there (see lockoutKey). Local: getCurrentTenant()
    // is undefined → clientIp → unchanged single-user path.
    const origin = lockoutKey(req);
    const lockoutMs = credentialStore.getLockoutMs(origin);
    if (lockoutMs !== undefined) {
      res.status(429).json({ error: 'too-many-attempts', lockoutMs });
      return;
    }

    let vault = await getVaultStore().read();
    if (!vault) {
      // Open-core: auto-create the encrypted vault on first unlock. In CLOUD
      // mode this branch must NOT run: it writes an M18 pbkdf2 VaultFile, but
      // the cloud vault is an argon2id+hkdf VaultEnvelope sealed by the
      // device key, provisioned during device enrollment. Auto-creating a
      // pbkdf2 file in cloud mode would corrupt/diverge the device's real
      // vault, so signal device-not-enrolled (428) and let the cloud setup
      // flow own enrollment.
      if (isCloudMode()) {
        throw new DeviceNotEnrolledError();
      }
      vault = await createEmptyVaultFile(password, name || DEFAULT_VAULT_NAME);
      await getVaultStore().write(vault);
    }

    let credentials: Record<string, string>;
    try {
      const payload = await decryptVault(vault, password);
      credentials = payload.credentials;
    } catch {
      const status = credentialStore.recordFailedUnlock(origin);
      res.status(401).json({
        error: 'invalid-password',
        remaining: status.remaining,
        lockoutMs: status.lockoutMs,
      });
      return;
    }
    credentialStore.resetFailedUnlock(origin);

    const sid = randomUUID();
    credentialStore.unlock(sid, credentials);
    res.setHeader('Set-Cookie', sessionCookie(req, sid));
    res.json({ unlocked: true, keys: credentialStore.listKeys(sid), name: vault.name });
    // In local mode `sid` IS the `translator_session` bearer token — mask it in
    // both log sinks (neither redaction layer catches the key `sessionId`), the
    // same `maskSecret` M16 applies to this value on eviction.
    logger.info('vault:unlocked', { sessionId: maskSecret(sid) });
    auditLogger.log('vault.unlocked', { sessionId: maskSecret(sid) }, req);
  }),
);

vaultRouter.post(
  '/lock',
  asyncHandler(async (req, res) => {
    const sid = getSessionId(res);
    if (sid) {
      // credentialStore.lock() scopes the copilot-client teardown to this
      // session's token(s) via destroyByToken — see M16-credential-store.ts.
      // Do NOT tear down the whole shared copilot client pool here: that
      // would kill every OTHER tenant's live client on one tenant's
      // lock/logout.
      credentialStore.lock(sid);
    }
    res.setHeader('Set-Cookie', clearSessionCookie(req));
    res.json({ unlocked: false });
    // `sid` is the local-mode bearer token — mask it (see /unlock above).
    auditLogger.log('vault.locked', { sessionId: sid ? maskSecret(sid) : sid }, req);
  }),
);

vaultRouter.put(
  '/credentials',
  validateBody(credentialUpdateSchema),
  asyncHandler(async (req, res) => {
    const sid = getSessionId(res);
    if (!sid || !credentialStore.isUnlocked(sid)) {
      res.status(423).json({ error: 'vault-locked' });
      return;
    }

    // Re-encrypt with the existing password supplied in header
    const password = req.header('x-vault-password');
    if (!password) {
      res.status(400).json({ error: 'password-required' });
      return;
    }

    // Verify the supplied password against the existing vault before
    // re-encrypting — otherwise a wrong value would silently become the new
    // vault password.
    // In cloud mode getVaultStore().read() throws DeviceNotEnrolledError for an
    // un-enrolled device → 428 via the central error handler (not a 500).
    const existingVault = await getVaultStore().read();
    if (!existingVault) {
      res.status(400).json({ error: 'no-vault' });
      return;
    }
    try {
      await decryptVault(existingVault, password);
    } catch {
      res.status(401).json({ error: 'invalid-password' });
      return;
    }

    const { updates } = req.body as z.infer<typeof credentialUpdateSchema>;
    credentialStore.setCredentials(sid, updates);

    const snapshot = credentialStore.snapshot(sid);
    // Preserve the vault's existing name across re-encryption — this route
    // never changes it.
    const newVault = await encryptVault({ credentials: snapshot }, password, existingVault.name);
    await getVaultStore().write(newVault);
    res.json({ keys: credentialStore.listKeys(sid) });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(12, 'Password must be at least 12 characters'),
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
});

vaultRouter.post(
  '/change-password',
  vaultUnlockRateLimiter,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const sid = getSessionId(res);
    if (!sid || !credentialStore.isUnlocked(sid)) {
      res.status(423).json({ error: 'vault-locked' });
      return;
    }

    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    // Validate new password strength
    const newPasswordValidation = validatePasswordStrength(newPassword);
    if (!newPasswordValidation.isValid) {
      res.status(400).json({ error: 'weak-new-password', details: newPasswordValidation.errors });
      return;
    }

    // Verify current password against the vault file
    // In cloud mode getVaultStore().read() throws DeviceNotEnrolledError for an
    // un-enrolled device → 428 via the central error handler (not a 500).
    const vault = await getVaultStore().read();
    if (!vault) {
      res.status(400).json({ error: 'no-vault' });
      return;
    }
    try {
      await decryptVault(vault, currentPassword);
    } catch {
      res.status(401).json({ error: 'invalid-current-password' });
      return;
    }

    // Re-encrypt the in-memory credentials snapshot with the new password,
    // preserving the vault's existing name (this route never changes it).
    const snapshot = credentialStore.snapshot(sid);
    const newVault = await encryptVault({ credentials: snapshot }, newPassword, vault.name);
    await getVaultStore().write(newVault);
    // `sid` is the local-mode bearer token — mask it (see /unlock above).
    logger.info('vault:password-changed', { sessionId: maskSecret(sid) });
    auditLogger.log('vault.password.changed', { sessionId: maskSecret(sid) }, req);
    res.json({ ok: true });
  }),
);
