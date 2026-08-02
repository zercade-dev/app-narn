// Lazy per-tenant provisioning guard.
//
// A cloud composition root's CloudIdentityProvider.resolve() calls
// `ensureTenantProvisioned(userId)` on the first authenticated request (after
// verifying the JWT, before returning the identity) so the tenant's
// GlobalConfig defaults + `<base>:default` module instances exist before any
// store is touched under that tenant. Local mode never calls it (the boot
// path provisions 'local' directly via initTenant).
import { initTenant } from '../startup.js';
import { runWithTenant } from './pg/tenant-context.js';

// Per-process "already provisioned" set. A second request for a known tenant
// skips re-entering initTenant — an OPTIMIZATION, not the correctness boundary:
// initTenant is itself idempotent (M27's schemaVersion no-op), so a fresh process
// / restart (with an empty set) safely re-checks rather than re-provisioning.
const provisioned = new Set<string>();

/**
 * Provision `userId`'s tenant exactly once per process. Establishes the tenant's
 * RLS context and runs the idempotent {@link initTenant}. `resolve()` runs OUTSIDE
 * any tenant context, so this opens its own via `runWithTenant`.
 */
export async function ensureTenantProvisioned(userId: string): Promise<void> {
  if (provisioned.has(userId)) return;
  await runWithTenant({ userId }, () => initTenant(userId));
  // Add only AFTER a successful provision, so a transient failure (e.g. a DB
  // hiccup) leaves the tenant un-marked and the next request retries.
  provisioned.add(userId);
}

/** Test seam — clear the per-process guard so each test starts unprovisioned. */
export function __resetProvisionedForTests(): void {
  provisioned.clear();
}
