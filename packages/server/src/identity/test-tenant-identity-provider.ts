import type { Request, Response } from 'express';
import type { ResolvedIdentity } from './types.js';
import { LocalIdentityProvider, LOCAL_USER_ID } from './local-identity-provider.js';
import { ensureTenantProvisioned } from '../storage/ensure-provisioned.js';
import { isCloudMode, setIdentityProvider } from './registry.js';
import { isRateLimitDisabled } from '../config/env.js';

/** Cookie the e2e harness sets per test to choose a per-test RLS tenant. */
export const TEST_TENANT_COOKIE_NAME = 'test_tenant';

/** A test tenant id must be a safe slug — it becomes the `app.user_id` GUC. */
const TEST_TENANT_PATTERN = /^[a-z0-9-]{1,64}$/;

/**
 * Parse + validate the `test_tenant` cookie out of `req.headers.cookie` (manual
 * scan, mirrors parseSessionCookie). Returns the slug, or undefined when the
 * cookie is absent or not a safe slug.
 */
export function readTestTenantCookie(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const raw of cookieHeader.split(';')) {
    const idx = raw.indexOf('=');
    if (idx < 0) continue;
    if (raw.slice(0, idx).trim() === TEST_TENANT_COOKIE_NAME) {
      try {
        const value = decodeURIComponent(raw.slice(idx + 1).trim());
        return TEST_TENANT_PATTERN.test(value) ? value : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/**
 * E2E-only identity provider. EXTENDS LocalIdentityProvider so isCloudMode()
 * (an `instanceof LocalIdentityProvider` check) stays false — preserving all
 * local security/cookie/module behavior. resolve() picks a per-test tenant
 * from the `test_tenant` cookie (default 'local') and lazily provisions it via
 * the same primitive cloud uses per user, so the new tenant has its
 * `<base>:default` module instances seeded before any store is touched.
 */
export class TestTenantIdentityProvider extends LocalIdentityProvider {
  async resolve(req: Request, res: Response): Promise<ResolvedIdentity | undefined> {
    const base = await super.resolve(req, res); // { userId: 'local', sessionId }
    const tenant = readTestTenantCookie(req);
    if (!tenant || tenant === LOCAL_USER_ID) return base;
    await ensureTenantProvisioned(tenant);
    return { ...base, userId: tenant };
  }
}

/**
 * Install the test provider when (and only when) the e2e test gate is on and no
 * cloud provider is present. Returns whether it installed. Mirrors the
 * RATE_LIMIT_DISABLED gate used by the test-reset-lockout seam.
 */
export function installTestTenantProviderIfEnabled(): boolean {
  if (!isRateLimitDisabled() || isCloudMode()) return false;
  setIdentityProvider(new TestTenantIdentityProvider());
  return true;
}
